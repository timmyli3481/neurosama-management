"use client";

import { useState } from "react";
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
  };
};

export function ProjectForm({ open, onOpenChange, project }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);

  const isEditing = !!project;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateProject({
          projectId: project._id,
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      onOpenChange(false);
      setName("");
      setDescription("");
    } catch (error) {
      console.error("Failed to save project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
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
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
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
