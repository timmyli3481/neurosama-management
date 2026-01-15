"use client";

import { useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  Users,
  Wrench,
  Target,
  Heart,
  Briefcase,
  Code,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { DateTimePicker } from "@/components/ui/date-picker";
import { FormattedDate } from "@/components/ui/timezone-date-input";
import { useTimezone } from "@/context/TimezoneContext";
import { ScrollArea } from "@/components/ui/scroll-area";

const meetingTypes = [
  { value: "build_day", label: "Build Day", icon: Wrench, color: "bg-orange-500" },
  { value: "strategy", label: "Strategy", icon: Target, color: "bg-blue-500" },
  { value: "outreach", label: "Outreach", icon: Heart, color: "bg-pink-500" },
  { value: "mentor_meeting", label: "Mentor Meeting", icon: Briefcase, color: "bg-purple-500" },
  { value: "competition_prep", label: "Competition Prep", icon: Calendar, color: "bg-green-500" },
  { value: "general", label: "General", icon: Users, color: "bg-slate-500" },
  { value: "code_review", label: "Code Review", icon: Code, color: "bg-cyan-500" },
];

function MeetingCard({ meeting }: {
  meeting: {
    _id: string;
    title: string;
    type: string;
    date: number;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    attendanceCount: { present: number; total: number };
  };
}) {
  const typeInfo = meetingTypes.find((t) => t.value === meeting.type);
  const Icon = typeInfo?.icon || Users;
  const now = Date.now();
  const isPast = meeting.date < now - 24 * 60 * 60 * 1000;
  const isToday = Math.abs(meeting.date - now) < 24 * 60 * 60 * 1000;

  return (
    <Link href={`/meetings/${meeting._id}`}>
      <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${isPast ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${typeInfo?.color} bg-opacity-20`}>
                <Icon className={`h-4 w-4 ${typeInfo?.color.replace("bg-", "text-")}`} />
              </div>
              <div>
                <h3 className="font-semibold">{meeting.title}</h3>
                <Badge variant="outline" className="mt-1 capitalize">
                  {typeInfo?.label}
                </Badge>
              </div>
            </div>
            {isToday && <Badge className="bg-green-500">Today</Badge>}
          </div>
          
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <FormattedDate timestamp={meeting.date} format="weekday" />
            </div>
            
            {meeting.startTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {meeting.startTime}
                {meeting.endTime && ` - ${meeting.endTime}`}
              </div>
            )}
            
            {meeting.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {meeting.location}
              </div>
            )}
          </div>
          
          {meeting.attendanceCount.total > 0 && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>
                {meeting.attendanceCount.present}/{meeting.attendanceCount.total} attended
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MeetingsPage() {
  const { dateToUtcTimestamp } = useTimezone();
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    title: "",
    type: "build_day" as const,
    startTime: "",
    endTime: "",
    location: "",
    agenda: "",
  });

  const { results, status, loadMore } = usePaginatedQuery(
    api.meetings.listMeetings,
    { upcoming: showUpcoming },
    { initialNumItems: 12 }
  );

  const stats = useQuery(api.meetings.getMeetingStats);
  const nextMeeting = useQuery(api.meetings.getNextMeeting);
  const createMeeting = useMutation(api.meetings.createMeeting);

  const handleCreate = async () => {
    if (!formData.title || !date) return;

    await createMeeting({
      title: formData.title,
      type: formData.type,
      date: dateToUtcTimestamp(date, formData.startTime || undefined),
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      location: formData.location || undefined,
      agenda: formData.agenda || undefined,
    });

    setFormData({
      title: "",
      type: "build_day",
      startTime: "",
      endTime: "",
      location: "",
      agenda: "",
    });
    setDate(undefined);
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            Meetings
          </h1>
          <p className="text-muted-foreground">
            Schedule and track team meetings
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {/* Stats & Next Meeting */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.upcomingMeetings}</div>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.thisMonth}</div>
                <p className="text-xs text-muted-foreground">This Month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">{stats.avgAttendance}%</div>
                <p className="text-xs text-muted-foreground">Avg Attendance</p>
              </CardContent>
            </Card>
          </>
        )}
        
        {nextMeeting && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Next Meeting</p>
              <div className="font-semibold truncate">{nextMeeting.title}</div>
              <div className="text-sm text-muted-foreground">
                {nextMeeting.daysUntil === 0
                  ? "Today"
                  : nextMeeting.daysUntil === 1
                  ? "Tomorrow"
                  : `In ${nextMeeting.daysUntil} days`}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          variant={showUpcoming ? "default" : "outline"}
          size="sm"
          onClick={() => setShowUpcoming(true)}
        >
          Upcoming
        </Button>
        <Button
          variant={!showUpcoming ? "default" : "outline"}
          size="sm"
          onClick={() => setShowUpcoming(false)}
        >
          All
        </Button>
      </div>

      {/* Meeting List */}
      {status === "LoadingFirstPage" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No meetings found</h3>
            <p className="text-muted-foreground mb-4">
              {showUpcoming
                ? "No upcoming meetings scheduled"
                : "Schedule your first meeting"}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((meeting) => (
              <MeetingCard key={meeting._id} meeting={meeting} />
            ))}
          </div>

          {status === "CanLoadMore" && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadMore(12)}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
            <DialogDescription>
              Create a new team meeting.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
              <div className="space-y-2">
                <Label>Meeting Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekly Build Day"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meetingTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Date & Start Time *</Label>
                <DateTimePicker
                  value={date}
                  onChange={setDate}
                  time={formData.startTime}
                  onTimeChange={(t) => setFormData({ ...formData, startTime: t })}
                  placeholder="Select date & time"
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
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.title || !date}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
