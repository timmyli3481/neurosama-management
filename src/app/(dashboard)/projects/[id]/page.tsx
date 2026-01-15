"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskStatusBadge, TASK_STATUSES, getStatusLabel } from "@/components/tasks/TaskStatusBadge";
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  User,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";

type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as Id<"projects">;

  const [editOpen, setEditOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignType, setAssignType] = useState<"team" | "user">("user");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [taskAssignOpen, setTaskAssignOpen] = useState<Id<"tasks"> | null>(null);
  const [taskAssignType, setTaskAssignType] = useState<"team" | "user">("user");
  const [selectedTaskAssignee, setSelectedTaskAssignee] = useState<string>("");

  const project = useQuery(api.projects.getProject, { projectId });
  const { results: tasks, status: tasksLoadStatus, loadMore } = usePaginatedQuery(
    api.tasks.getTasksByProject,
    {
      projectId,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    { initialNumItems: 20 }
  );

  // Available teams and users for project assignment
  const { results: availableTeams } = usePaginatedQuery(
    api.projects.getAvailableTeamsForProject,
    project?.permission === "admin" || project?.permission === "team_leader"
      ? { projectId }
      : "skip",
    { initialNumItems: 50 }
  );
  const { results: availableUsers } = usePaginatedQuery(
    api.projects.getAvailableUsersForProject,
    project?.permission === "admin" || project?.permission === "team_leader"
      ? { projectId }
      : "skip",
    { initialNumItems: 50 }
  );

  // Available teams and users for task assignment
  const { results: availableTaskTeams } = usePaginatedQuery(
    api.tasks.getAvailableTeamsForTask,
    taskAssignOpen && (project?.permission === "admin" || project?.permission === "team_leader")
      ? { taskId: taskAssignOpen }
      : "skip",
    { initialNumItems: 50 }
  );
  const { results: availableTaskUsers } = usePaginatedQuery(
    api.tasks.getAvailableUsersForTask,
    taskAssignOpen && (project?.permission === "admin" || project?.permission === "team_leader")
      ? { taskId: taskAssignOpen }
      : "skip",
    { initialNumItems: 50 }
  );

  const deleteProject = useMutation(api.projects.deleteProject);
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const assignProject = useMutation(api.projects.assignProject);
  const unassignProject = useMutation(api.projects.unassignProject);
  const assignTask = useMutation(api.tasks.assignTask);
  const unassignTask = useMutation(api.tasks.unassignTask);

  const handleDeleteProject = async () => {
    await deleteProject({ projectId });
    router.push("/projects");
  };

  const handleStatusChange = async (taskId: Id<"tasks">, status: TaskStatus) => {
    await updateTaskStatus({ taskId, status });
  };

  const handleDeleteTask = async (taskId: Id<"tasks">) => {
    await deleteTask({ taskId });
  };

  const handleAssignProject = async () => {
    if (!selectedAssignee) return;
    await assignProject({
      projectId,
      assignee:
        assignType === "team"
          ? { type: "team", id: selectedAssignee as Id<"teams"> }
          : { type: "user", id: selectedAssignee as Id<"users"> },
    });
    setAssignOpen(false);
    setSelectedAssignee("");
  };

  const handleUnassignProject = async (assignmentId: Id<"projectAssignments">) => {
    await unassignProject({ assignmentId });
  };

  const handleAssignTask = async () => {
    if (!taskAssignOpen || !selectedTaskAssignee) return;
    await assignTask({
      taskId: taskAssignOpen,
      assignee:
        taskAssignType === "team"
          ? { type: "team", id: selectedTaskAssignee as Id<"teams"> }
          : { type: "user", id: selectedTaskAssignee as Id<"users"> },
    });
    setTaskAssignOpen(null);
    setSelectedTaskAssignee("");
  };

  const handleUnassignTask = async (assignmentId: Id<"taskAssignments">) => {
    await unassignTask({ assignmentId });
  };

  if (project === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground mb-4">
          The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button asChild>
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const canEdit =
    project.permission === "admin" || project.permission === "team_leader";

  const completionRate =
    project.taskStats.total > 0
      ? Math.round((project.taskStats.done / project.taskStats.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.permission !== "member" && (
              <Badge variant="outline">
                {project.permission === "admin" ? "Admin" : "Team Leader"}
              </Badge>
            )}
          </div>
          {project.description && (
            <p className="text-muted-foreground ml-10">{project.description}</p>
          )}
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Stats & Assignees */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{project.taskStats.done} of {project.taskStats.total} tasks completed</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Assignees</CardTitle>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {project.assignees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignees yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {project.assignees.map((assignee) => (
                  <Badge
                    key={assignee.assignmentId}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {assignee.type === "team" ? (
                      <Users className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {assignee.name}
                    {canEdit && (
                      <button
                        onClick={() =>
                          handleUnassignProject(assignee.assignmentId)
                        }
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <Button onClick={() => setCreateTaskOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All ({project.taskStats.total})
          </Button>
          {TASK_STATUSES.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {getStatusLabel(status)} ({project.taskStats[status]})
            </Button>
          ))}
        </div>

        {/* Task List */}
        {tasksLoadStatus === "LoadingFirstPage" ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">
                {statusFilter === "all"
                  ? "No tasks yet. Create your first task!"
                  : `No tasks with status "${getStatusLabel(statusFilter)}"`}
              </p>
              {statusFilter === "all" && (
                <Button onClick={() => setCreateTaskOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card key={task._id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{task.name}</h3>
                        <TaskStatusBadge status={task.status} />
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2 flex-wrap items-center">
                        {task.assignees.map((a) => (
                          <Badge
                            key={a.assignmentId}
                            variant="outline"
                            className="text-xs flex items-center gap-1 pr-1"
                          >
                            {a.type === "team" ? (
                              <Users className="h-2 w-2" />
                            ) : (
                              <User className="h-2 w-2" />
                            )}
                            {a.name}
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnassignTask(a.assignmentId);
                                }}
                                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                              >
                                <X className="h-2 w-2" />
                              </button>
                            )}
                          </Badge>
                        ))}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskAssignOpen(task._id);
                            }}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {TASK_STATUSES.filter((s) => s !== task.status).map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleStatusChange(task._id, status)}
                          >
                            Move to {getStatusLabel(status)}
                          </DropdownMenuItem>
                        ))}
                        {canEdit && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteTask(task._id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>

            {tasksLoadStatus === "CanLoadMore" && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => loadMore(20)}>
                  Load More Tasks
                </Button>
              </div>
            )}

            {tasksLoadStatus === "LoadingMore" && (
              <div className="flex justify-center">
                <Button variant="outline" disabled>
                  Loading...
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <ProjectForm
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />

      <TaskForm
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        projectId={projectId}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{project.name}&quot; and all its tasks.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Assignment Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Assignee to Project</DialogTitle>
            <DialogDescription>
              Assign a team or user to this project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Tabs
              value={assignType}
              onValueChange={(v) => {
                setAssignType(v as "team" | "user");
                setSelectedAssignee("");
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user">User</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
              <TabsContent value="user" className="mt-4">
                <Select
                  value={selectedAssignee}
                  onValueChange={setSelectedAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers?.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No users available
                      </SelectItem>
                    ) : (
                      availableUsers?.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.firstName || user.lastName
                            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                            : user.email ?? "Unknown"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="team" className="mt-4">
                <Select
                  value={selectedAssignee}
                  onValueChange={setSelectedAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams?.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No teams available
                      </SelectItem>
                    ) : (
                      availableTeams?.map((team) => (
                        <SelectItem key={team._id} value={team._id}>
                          {team.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignProject} disabled={!selectedAssignee}>
              Add Assignee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Assignment Dialog */}
      <Dialog
        open={taskAssignOpen !== null}
        onOpenChange={(open) => !open && setTaskAssignOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Assign a team or user to this task.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Tabs
              value={taskAssignType}
              onValueChange={(v) => {
                setTaskAssignType(v as "team" | "user");
                setSelectedTaskAssignee("");
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user">User</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
              <TabsContent value="user" className="mt-4">
                <Select
                  value={selectedTaskAssignee}
                  onValueChange={setSelectedTaskAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTaskUsers?.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No users available
                      </SelectItem>
                    ) : (
                      availableTaskUsers?.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.firstName || user.lastName
                            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                            : user.email ?? "Unknown"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="team" className="mt-4">
                <Select
                  value={selectedTaskAssignee}
                  onValueChange={setSelectedTaskAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTaskTeams?.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No teams available
                      </SelectItem>
                    ) : (
                      availableTaskTeams?.map((team) => (
                        <SelectItem key={team._id} value={team._id}>
                          {team.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskAssignOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignTask}
              disabled={!selectedTaskAssignee}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
