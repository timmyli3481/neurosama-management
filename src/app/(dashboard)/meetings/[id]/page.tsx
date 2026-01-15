"use client";

import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  CalendarDays,
  ArrowLeft,
  Edit,
  Trash2,
  Clock,
  MapPin,
  Users,
  User,
  Wrench,
  Target,
  Heart,
  Briefcase,
  Code,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock3,
  UserPlus,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

const meetingTypes = [
  { value: "build_day", label: "Build Day", icon: Wrench, color: "bg-orange-500" },
  { value: "strategy", label: "Strategy", icon: Target, color: "bg-blue-500" },
  { value: "outreach", label: "Outreach", icon: Heart, color: "bg-pink-500" },
  { value: "mentor_meeting", label: "Mentor Meeting", icon: Briefcase, color: "bg-purple-500" },
  { value: "competition_prep", label: "Competition Prep", icon: Calendar, color: "bg-green-500" },
  { value: "general", label: "General", icon: Users, color: "bg-slate-500" },
  { value: "code_review", label: "Code Review", icon: Code, color: "bg-cyan-500" },
];

type MeetingType = "build_day" | "strategy" | "outreach" | "mentor_meeting" | "competition_prep" | "general" | "code_review";
type AttendanceStatus = "present" | "absent" | "excused" | "late";

const attendanceStatuses: { value: AttendanceStatus; label: string; icon: typeof CheckCircle; color: string }[] = [
  { value: "present", label: "Present", icon: CheckCircle, color: "text-green-500" },
  { value: "late", label: "Late", icon: Clock3, color: "text-yellow-500" },
  { value: "excused", label: "Excused", icon: AlertCircle, color: "text-blue-500" },
  { value: "absent", label: "Absent", icon: XCircle, color: "text-red-500" },
];

function formatDateForInput(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().split("T")[0];
}

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.id as Id<"meetings">;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "build_day" as MeetingType,
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    agenda: "",
    notes: "",
  });

  // Attendance state - track status for each user
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceStatus>>({});

  const meeting = useQuery(api.meetings.getMeeting, { meetingId });
  const { results: allUsers } = usePaginatedQuery(
    api.users.listUsersForAssignment,
    {},
    { initialNumItems: 100 }
  );

  const updateMeeting = useMutation(api.meetings.updateMeeting);
  const deleteMeeting = useMutation(api.meetings.deleteMeeting);
  const bulkRecordAttendance = useMutation(api.meetings.bulkRecordAttendance);

  const handleEdit = () => {
    if (meeting) {
      setFormData({
        title: meeting.title,
        type: meeting.type,
        date: formatDateForInput(meeting.date),
        startTime: meeting.startTime ?? "",
        endTime: meeting.endTime ?? "",
        location: meeting.location ?? "",
        agenda: meeting.agenda ?? "",
        notes: meeting.notes ?? "",
      });
      setEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!formData.title || !formData.date) return;

    await updateMeeting({
      meetingId,
      title: formData.title,
      type: formData.type,
      date: new Date(formData.date).getTime(),
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      location: formData.location || undefined,
      agenda: formData.agenda || undefined,
      notes: formData.notes || undefined,
    });

    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteMeeting({ meetingId });
    router.push("/meetings");
  };

  const openAttendanceDialog = () => {
    // Initialize attendance records from existing data
    const records: Record<string, AttendanceStatus> = {};
    if (meeting?.attendance) {
      for (const att of meeting.attendance) {
        records[att.userId] = att.status as AttendanceStatus;
      }
    }
    setAttendanceRecords(records);
    setAttendanceOpen(true);
  };

  const handleSaveAttendance = async () => {
    const records = Object.entries(attendanceRecords).map(([userId, status]) => ({
      userId: userId as Id<"users">,
      status,
    }));

    if (records.length > 0) {
      await bulkRecordAttendance({
        meetingId,
        records,
      });
    }

    setAttendanceOpen(false);
  };

  const setUserAttendance = (userId: string, status: AttendanceStatus) => {
    setAttendanceRecords((prev) => ({
      ...prev,
      [userId]: status,
    }));
  };

  const markAllAs = (status: AttendanceStatus) => {
    const records: Record<string, AttendanceStatus> = {};
    if (allUsers) {
      for (const user of allUsers) {
        records[user._id] = status;
      }
    }
    setAttendanceRecords(records);
  };

  if (meeting === undefined) {
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

  if (meeting === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Meeting not found</h3>
        <p className="text-muted-foreground mb-4">
          This meeting may have been deleted.
        </p>
        <Link href="/meetings">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meetings
          </Button>
        </Link>
      </div>
    );
  }

  const typeInfo = meetingTypes.find((t) => t.value === meeting.type);
  const Icon = typeInfo?.icon || Users;
  const isPast = meeting.date < Date.now() - 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/meetings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={`${typeInfo?.color} bg-opacity-20 border-0`}
              >
                <Icon className="h-3 w-3 mr-1" />
                {typeInfo?.label}
              </Badge>
              {isPast && <Badge variant="secondary">Past</Badge>}
            </div>
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Created by {meeting.creatorName}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAttendanceDialog}>
            <Users className="h-4 w-4 mr-2" />
            Track Attendance
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

      {/* Meeting Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(meeting.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            {meeting.startTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {meeting.startTime}
                  {meeting.endTime && ` - ${meeting.endTime}`}
                </span>
              </div>
            )}
            {meeting.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{meeting.location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-green-500">{meeting.stats.present}</div>
                <div className="text-xs text-muted-foreground">Present</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">{meeting.stats.late}</div>
                <div className="text-xs text-muted-foreground">Late</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-500">{meeting.stats.excused}</div>
                <div className="text-xs text-muted-foreground">Excused</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{meeting.stats.absent}</div>
                <div className="text-xs text-muted-foreground">Absent</div>
              </div>
            </div>
            {meeting.stats.total > 0 && (
              <div className="mt-4 pt-4 border-t text-center">
                <span className="text-sm text-muted-foreground">
                  {Math.round(((meeting.stats.present + meeting.stats.late) / meeting.stats.total) * 100)}% attendance rate
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agenda & Notes */}
      <div className="grid gap-4 md:grid-cols-2">
        {meeting.agenda && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{meeting.agenda}</p>
            </CardContent>
          </Card>
        )}
        {meeting.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Meeting Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{meeting.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Items */}
      {meeting.actionItems && meeting.actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {meeting.actionItems.map((item, idx) => (
                <li key={idx} className="text-sm">{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Attendance List */}
      {meeting.attendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendance ({meeting.attendance.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {meeting.attendance.map((att) => {
                const statusInfo = attendanceStatuses.find((s) => s.value === att.status);
                const StatusIcon = statusInfo?.icon || CheckCircle;
                return (
                  <div
                    key={att._id}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={att.userImage ?? undefined} />
                      <AvatarFallback>
                        {att.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.userName}</p>
                      {att.arrivalTime && (
                        <p className="text-xs text-muted-foreground">
                          Arrived: {att.arrivalTime}
                        </p>
                      )}
                    </div>
                    <StatusIcon className={`h-4 w-4 ${statusInfo?.color}`} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Notebook Entries */}
      {meeting.notebookEntries && meeting.notebookEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Related Notebook Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {meeting.notebookEntries.map((entry) => (
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Meeting</DialogTitle>
            <DialogDescription>
              Update meeting details.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Meeting Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekly Build Day"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as MeetingType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingTypes.map((type) => {
                        const TypeIcon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <TypeIcon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., School Robotics Lab"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Agenda</Label>
                <Textarea
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  placeholder="Meeting agenda..."
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Meeting Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes from the meeting..."
                  rows={4}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.title || !formData.date}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This will also delete all attendance records. This action cannot be undone.
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

      {/* Attendance Tracking Dialog */}
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Track Attendance</DialogTitle>
            <DialogDescription>
              Record attendance for all team members.
            </DialogDescription>
          </DialogHeader>
          
          {/* Quick Actions */}
          <div className="flex gap-2 pb-2 border-b">
            <Button variant="outline" size="sm" onClick={() => markAllAs("present")}>
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              Mark All Present
            </Button>
            <Button variant="outline" size="sm" onClick={() => markAllAs("absent")}>
              <XCircle className="h-3 w-3 mr-1 text-red-500" />
              Mark All Absent
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers?.map((user) => {
                  const currentStatus = attendanceRecords[user._id];
                  const userName = user.firstName || user.lastName
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : user.email ?? "Unknown";
                  
                  return (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.imageUrl ?? undefined} />
                            <AvatarFallback>
                              {userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {attendanceStatuses.map((status) => {
                            const StatusIcon = status.icon;
                            const isSelected = currentStatus === status.value;
                            return (
                              <Button
                                key={status.value}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                className={isSelected ? "" : "opacity-50"}
                                onClick={() => setUserAttendance(user._id, status.value)}
                              >
                                <StatusIcon className={`h-3 w-3 mr-1 ${isSelected ? "" : status.color}`} />
                                {status.label}
                              </Button>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAttendance}>
              Save Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
