"use client";

import { useState, useEffect } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type TeamFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: {
    _id: Id<"teams">;
    name: string;
    leaderId: Id<"users">;
  };
};

export function TeamForm({ open, onOpenChange, team }: TeamFormProps) {
  const [name, setName] = useState(team?.name ?? "");
  const [leaderId, setLeaderId] = useState<string>(team?.leaderId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only fetch users when dialog is open to avoid permission errors
  const { results: users, status: usersStatus } = usePaginatedQuery(
    api.users.listUsersForAssignment,
    open ? {} : "skip",
    { initialNumItems: 100 }
  );
  const createTeam = useMutation(api.teams.createTeam);
  const updateTeam = useMutation(api.teams.updateTeam);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setLeaderId(team?.leaderId ?? "");
    }
  }, [open, team]);

  const isEditing = !!team;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !leaderId) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateTeam({
          teamId: team._id,
          name: name.trim(),
          leaderId: leaderId as Id<"users">,
        });
      } else {
        await createTeam({
          name: name.trim(),
          leaderId: leaderId as Id<"users">,
        });
      }
      onOpenChange(false);
      setName("");
      setLeaderId("");
    } catch (error) {
      console.error("Failed to save team:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Team" : "Create Team"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the team details below."
                : "Create a new team and assign a leader."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Development Team"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leader">Team Leader</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  {usersStatus === "LoadingFirstPage" ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : users?.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No users available
                    </SelectItem>
                  ) : (
                    users?.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.firstName || user.lastName
                          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                          : user.email ?? "Unknown"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={isSubmitting || !name.trim() || !leaderId}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
