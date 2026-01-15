"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUSES, getStatusLabel } from "./TaskStatusBadge";

type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

type TaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  task?: {
    _id: Id<"tasks">;
    name: string;
    description?: string;
    status: TaskStatus;
    dueDate?: number;
  };
};

function formatDateForInput(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().split("T")[0];
}

export function TaskForm({ open, onOpenChange, projectId, task }: TaskFormProps) {
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "backlog");
  const [dueDate, setDueDate] = useState(formatDateForInput(task?.dueDate));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);

  const isEditing = !!task;

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? "backlog");
      setDueDate(formatDateForInput(task?.dueDate));
    }
  }, [open, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const dueDateTimestamp = dueDate ? new Date(dueDate).getTime() : undefined;

      if (isEditing) {
        await updateTask({
          taskId: task._id,
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          dueDate: dueDateTimestamp,
        });
      } else {
        await createTask({
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          dueDate: dueDateTimestamp,
        });
      }
      onOpenChange(false);
      setName("");
      setDescription("");
      setStatus("backlog");
      setDueDate("");
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the task details below."
                : "Add a new task to this project."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Task name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional task description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {getStatusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
