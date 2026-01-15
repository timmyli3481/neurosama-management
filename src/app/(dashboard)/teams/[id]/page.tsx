"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { TeamForm } from "@/components/teams/TeamForm";
import {
  ArrowLeft,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Crown,
} from "lucide-react";
import Link from "next/link";

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as Id<"teams">;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [removeMemberOpen, setRemoveMemberOpen] = useState<Id<"users"> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const team = useQuery(api.teams.getTeam, { teamId });
  const { 
    results: availableUsers, 
    status: usersLoadStatus, 
    loadMore: loadMoreUsers 
  } = usePaginatedQuery(
    api.teams.getAvailableUsersForTeam,
    { teamId },
    { initialNumItems: 20 }
  );

  const deleteTeam = useMutation(api.teams.deleteTeam);
  const addMember = useMutation(api.teams.addTeamMember);
  const removeMember = useMutation(api.teams.removeTeamMember);

  const handleDeleteTeam = async () => {
    await deleteTeam({ teamId });
    router.push("/teams");
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    await addMember({ teamId, userId: selectedUserId as Id<"users"> });
    setAddMemberOpen(false);
    setSelectedUserId("");
  };

  const handleRemoveMember = async (userId: Id<"users">) => {
    await removeMember({ teamId, userId });
    setRemoveMemberOpen(null);
  };

  if (team === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (team === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Team not found</h2>
        <p className="text-muted-foreground mb-4">
          The team you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button asChild>
          <Link href="/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  const canEdit = team.permission === "admin" || team.permission === "team_leader";
  const canManageMembers = team.permission === "admin" || team.permission === "team_leader";
  const canDelete = team.permission === "admin";

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const name = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/teams">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
            {team.permission !== "member" && (
              <Badge variant="outline">
                {team.permission === "admin" ? "Admin" : "Team Leader"}
              </Badge>
            )}
          </div>
        </div>

        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Team
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteOpen(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Team
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Team Leader Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            Team Leader
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={team.leader.imageUrl ?? undefined} />
              <AvatarFallback>
                {getInitials(team.leader.firstName, team.leader.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {team.leader.firstName || team.leader.lastName
                  ? `${team.leader.firstName ?? ""} ${team.leader.lastName ?? ""}`.trim()
                  : "Unknown"}
              </p>
              {team.leader.email && (
                <p className="text-sm text-muted-foreground">{team.leader.email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Members ({team.members.length})
          </h2>
          {canManageMembers && (
            <Button onClick={() => setAddMemberOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          )}
        </div>

        {team.members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">
                No members yet. Add members to this team.
              </p>
              {canManageMembers && (
                <Button onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {team.members.map((member) => (
              <Card key={member._id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.imageUrl ?? undefined} />
                      <AvatarFallback>
                        {getInitials(member.firstName, member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.firstName || member.lastName
                          ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
                          : "Unknown"}
                      </p>
                      {member.email && (
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {canManageMembers && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoveMemberOpen(member._id)}
                    >
                      <UserMinus className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <TeamForm
        open={editOpen}
        onOpenChange={setEditOpen}
        team={team}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{team.name}&quot; and remove all members.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Select a user to add to this team.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {usersLoadStatus === "LoadingFirstPage" ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : availableUsers.length === 0 ? (
                  <SelectItem value="none" disabled>No users available</SelectItem>
                ) : (
                  availableUsers.map((user) => (
                    <SelectItem key={user._id} value={user._id}>
                      {user.firstName || user.lastName
                        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                        : user.email ?? "Unknown"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {usersLoadStatus === "CanLoadMore" && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => loadMoreUsers(20)}
              >
                Load More Users
              </Button>
            )}
            {usersLoadStatus === "LoadingMore" && (
              <Button variant="outline" size="sm" className="w-full" disabled>
                Loading...
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId}>
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeMemberOpen !== null}
        onOpenChange={(open) => !open && setRemoveMemberOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the team?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberOpen && handleRemoveMember(removeMemberOpen)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
