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

type ProjectFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: {
    _id: Id<"projects">;
    name: string;
    description?: string;
    startDate?: number;
    endDate?: number;
  };
};

function formatDateForInput(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().split("T")[0];
}

export function ProjectForm({ open, onOpenChange, project }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [startDate, setStartDate] = useState(formatDateForInput(project?.startDate));
  const [endDate, setEndDate] = useState(formatDateForInput(project?.endDate));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);

  const isEditing = !!project;

  // Reset form when project changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setStartDate(formatDateForInput(project?.startDate));
      setEndDate(formatDateForInput(project?.endDate));
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const startTimestamp = startDate ? new Date(startDate).getTime() : undefined;
      const endTimestamp = endDate ? new Date(endDate).getTime() : undefined;

      if (isEditing) {
        await updateProject({
          projectId: project._id,
          name: name.trim(),
          description: description.trim() || undefined,
          startDate: startTimestamp,
          endDate: endTimestamp,
        });
      } else {
        await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          startDate: startTimestamp,
          endDate: endTimestamp,
        });
      }
      onOpenChange(false);
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
    } catch (error) {
      console.error("Failed to save project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Project" : "Create Project"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the project details below."
                : "Add a new project to manage tasks."}
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
                  placeholder="Project name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional project description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
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
