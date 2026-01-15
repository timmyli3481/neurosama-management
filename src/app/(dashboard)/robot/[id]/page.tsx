"use client";

import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bot,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Cog,
  Zap,
  Hand,
  ArrowUp,
  Eye,
  Cpu,
  CircleDot,
  Wrench,
  ClipboardList,
  Package,
  BookOpen,
  History,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";

const subsystemTypes = [
  { value: "drivetrain", label: "Drivetrain", icon: Cog },
  { value: "intake", label: "Intake", icon: Zap },
  { value: "arm", label: "Arm", icon: Hand },
  { value: "lift", label: "Lift", icon: ArrowUp },
  { value: "claw", label: "Claw/Gripper", icon: Hand },
  { value: "shooter", label: "Shooter", icon: CircleDot },
  { value: "sensors", label: "Sensors", icon: Eye },
  { value: "vision", label: "Vision", icon: Eye },
  { value: "electronics", label: "Electronics", icon: Cpu },
  { value: "other", label: "Other", icon: Wrench },
];

const statusOptions = [
  { value: "concept", label: "Concept", color: "bg-slate-500" },
  { value: "design", label: "Design", color: "bg-purple-500" },
  { value: "prototyping", label: "Prototyping", color: "bg-yellow-500" },
  { value: "testing", label: "Testing", color: "bg-blue-500" },
  { value: "competition_ready", label: "Competition Ready", color: "bg-green-500" },
  { value: "needs_repair", label: "Needs Repair", color: "bg-red-500" },
];

const changeTypes = [
  { value: "design_change", label: "Design Change" },
  { value: "rebuild", label: "Rebuild" },
  { value: "repair", label: "Repair" },
  { value: "upgrade", label: "Upgrade" },
  { value: "testing_results", label: "Testing Results" },
];

type SubsystemType = "drivetrain" | "intake" | "arm" | "lift" | "claw" | "shooter" | "sensors" | "vision" | "electronics" | "other";
type SubsystemStatus = "concept" | "design" | "prototyping" | "testing" | "competition_ready" | "needs_repair";
type ChangeType = "design_change" | "rebuild" | "repair" | "upgrade" | "testing_results";

export default function SubsystemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subsystemId = params.id as Id<"robotSubsystems">;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addLogOpen, setAddLogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "drivetrain" as SubsystemType,
    description: "",
    status: "concept" as SubsystemStatus,
    progress: 0,
    currentVersion: "",
    specs: "",
  });

  const [logData, setLogData] = useState({
    version: "",
    changeType: "design_change" as ChangeType,
    description: "",
    testResults: "",
  });

  const subsystem = useQuery(api.robot.getSubsystem, { subsystemId });
  const { results: availableUsers } = usePaginatedQuery(
    api.users.listUsersForAssignment,
    {},
    { initialNumItems: 50 }
  );

  const updateSubsystem = useMutation(api.robot.updateSubsystem);
  const deleteSubsystem = useMutation(api.robot.deleteSubsystem);
  const addLog = useMutation(api.robot.addLog);

  const handleEdit = () => {
    if (subsystem) {
      setFormData({
        name: subsystem.name,
        type: subsystem.type,
        description: subsystem.description ?? "",
        status: subsystem.status,
        progress: subsystem.progress,
        currentVersion: subsystem.currentVersion ?? "",
        specs: subsystem.specs ?? "",
      });
      setEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name) return;

    await updateSubsystem({
      subsystemId,
      name: formData.name,
      type: formData.type,
      description: formData.description || undefined,
      status: formData.status,
      progress: formData.progress,
      currentVersion: formData.currentVersion || undefined,
      specs: formData.specs || undefined,
    });

    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteSubsystem({ subsystemId });
    router.push("/robot");
  };

  const handleAddLog = async () => {
    if (!logData.version || !logData.description) return;

    await addLog({
      subsystemId,
      version: logData.version,
      changeType: logData.changeType,
      description: logData.description,
      testResults: logData.testResults || undefined,
    });

    setLogData({
      version: "",
      changeType: "design_change",
      description: "",
      testResults: "",
    });
    setAddLogOpen(false);
  };

  if (subsystem === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (subsystem === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Subsystem not found</h3>
        <p className="text-muted-foreground mb-4">
          This subsystem may have been deleted.
        </p>
        <Link href="/robot">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Robot
          </Button>
        </Link>
      </div>
    );
  }

  const typeInfo = subsystemTypes.find((t) => t.value === subsystem.type);
  const statusInfo = statusOptions.find((s) => s.value === subsystem.status);
  const TypeIcon = typeInfo?.icon || Wrench;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/robot">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TypeIcon className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="capitalize">
                {typeInfo?.label}
              </Badge>
              <Badge
                variant="outline"
                className={`${statusInfo?.color} bg-opacity-20 border-0`}
              >
                <div className={`w-2 h-2 rounded-full ${statusInfo?.color} mr-1.5`} />
                {statusInfo?.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{subsystem.name}</h1>
            {subsystem.currentVersion && (
              <p className="text-sm text-muted-foreground font-mono">
                Version: {subsystem.currentVersion}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddLogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Log
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Progress & Stats */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2">Development Progress</h2>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-primary">
                  {subsystem.progress}%
                </div>
                <div className="flex-1 max-w-md">
                  <Progress value={subsystem.progress} className="h-3" />
                </div>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{subsystem.stats.totalTasks}</div>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{subsystem.stats.completedTasks}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{subsystem.stats.activeTasks}</div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{subsystem.stats.partsCount}</div>
                <p className="text-xs text-muted-foreground">Parts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Description */}
        {subsystem.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{subsystem.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Lead User */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Subsystem Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subsystem.leadUser ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={subsystem.leadUser.imageUrl ?? undefined} />
                  <AvatarFallback>
                    {subsystem.leadUser.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{subsystem.leadUser.name}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">No lead assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Specs */}
        {subsystem.specs && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Technical Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap font-mono text-sm">{subsystem.specs}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Version History / Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History ({subsystem.logs.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setAddLogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Log
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {subsystem.logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No version history recorded yet.
            </p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-6">
                {subsystem.logs.map((log, index) => (
                  <div key={log._id} className="relative pl-10">
                    <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs text-primary-foreground font-bold">
                        {subsystem.logs.length - index}
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{log.version}</span>
                            <Badge variant="outline" className="capitalize">
                              {log.changeType.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm mt-2">{log.description}</p>
                          {log.testResults && (
                            <div className="mt-2 p-2 bg-background rounded border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Test Results:</p>
                              <p className="text-sm">{log.testResults}</p>
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{log.createdByName}</p>
                          <p>{new Date(log.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related Tasks */}
      {subsystem.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Related Tasks ({subsystem.tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subsystem.tasks.slice(0, 5).map((task) => (
                <div
                  key={task._id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <TaskStatusBadge status={task.status} />
                    <span className="font-medium">{task.name}</span>
                  </div>
                  {task.dueDate && (
                    <span className="text-sm text-muted-foreground">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
              {subsystem.tasks.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{subsystem.tasks.length - 5} more tasks
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Parts */}
      {subsystem.parts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Related Parts ({subsystem.parts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subsystem.parts.slice(0, 5).map((part) => (
                  <TableRow key={part._id}>
                    <TableCell>
                      <Link href={`/inventory/${part._id}`} className="font-medium hover:underline text-primary">
                        {part.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{part.partNumber || "-"}</TableCell>
                    <TableCell className="text-center">{part.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{part.location || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {subsystem.parts.length > 5 && (
              <p className="text-sm text-muted-foreground text-center pt-2">
                +{subsystem.parts.length - 5} more parts
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Related Notebook Entries */}
      {subsystem.notebookEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Related Notebook Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subsystem.notebookEntries.map((entry) => (
                <Link
                  key={entry._id}
                  href={`/notebook/${entry._id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {entry.category} • {new Date(entry.entryDate).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Subsystem Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Subsystem</DialogTitle>
            <DialogDescription>
              Update subsystem details.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subsystem Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mecanum Drivetrain"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as SubsystemType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subsystemTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as SubsystemStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status.color}`} />
                            {status.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Progress ({formData.progress}%)</Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current Version</Label>
                  <Input
                    value={formData.currentVersion}
                    onChange={(e) => setFormData({ ...formData, currentVersion: e.target.value })}
                    placeholder="e.g., v2.1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the subsystem..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Technical Specifications</Label>
                <Textarea
                  value={formData.specs}
                  onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                  placeholder="Motors, gear ratios, dimensions..."
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subsystem</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{subsystem.name}&quot;? This will also delete all version logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Log Dialog */}
      <Dialog open={addLogOpen} onOpenChange={setAddLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Version Log</DialogTitle>
            <DialogDescription>
              Document a change or update to this subsystem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Version *</Label>
                <Input
                  value={logData.version}
                  onChange={(e) => setLogData({ ...logData, version: e.target.value })}
                  placeholder="e.g., v2.1"
                />
              </div>

              <div className="space-y-2">
                <Label>Change Type</Label>
                <Select
                  value={logData.changeType}
                  onValueChange={(v) => setLogData({ ...logData, changeType: v as ChangeType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {changeTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={logData.description}
                onChange={(e) => setLogData({ ...logData, description: e.target.value })}
                placeholder="What changed?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Test Results (optional)</Label>
              <Textarea
                value={logData.testResults}
                onChange={(e) => setLogData({ ...logData, testResults: e.target.value })}
                placeholder="Testing notes, metrics, observations..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLog} disabled={!logData.version || !logData.description}>
              Add Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
