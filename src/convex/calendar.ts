import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Event type validator
const eventTypeValidator = v.union(
  v.literal("competition"),
  v.literal("meeting"),
  v.literal("deadline"),
  v.literal("build_day"),
  v.literal("outreach"),
  v.literal("other")
);

// Get events for a date range
export const getEventsInRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    // Get calendar events
    const calendarEvents = await ctx.db
      .query("calendarEvents")
      .withIndex("by_startDate")
      .collect();
    
    const eventsInRange = calendarEvents.filter(
      (e) => e.startDate >= args.startDate && e.startDate <= args.endDate
    );
    
    // Get competitions in range
    const competitions = await ctx.db
      .query("competitions")
      .withIndex("by_startDate")
      .collect();
    
    const competitionsInRange = competitions.filter(
      (c) => c.startDate >= args.startDate && c.startDate <= args.endDate
    );
    
    // Get meetings in range
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_date")
      .collect();
    
    const meetingsInRange = meetings.filter(
      (m) => m.date >= args.startDate && m.date <= args.endDate
    );
    
    // Get tasks with due dates in range
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_dueDate")
      .collect();
    
    const tasksInRange = tasks.filter(
      (t) => t.dueDate && t.dueDate >= args.startDate && t.dueDate <= args.endDate
    );
    
    // Get projects with dates in range
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_startDate")
      .collect();
    
    const projectsInRange = projects.filter(
      (p) => (p.startDate && p.startDate >= args.startDate && p.startDate <= args.endDate) ||
             (p.endDate && p.endDate >= args.startDate && p.endDate <= args.endDate)
    );
    
    // Combine all into unified format
    type CalendarEvent = {
      id: string;
      title: string;
      type: "competition" | "meeting" | "deadline" | "build_day" | "outreach" | "other" | "project";
      startDate: number;
      endDate: number | null;
      allDay: boolean;
      location: string | null;
      description: string | null;
      color: string;
      source: "calendar" | "competition" | "meeting" | "task" | "project";
      sourceId: string;
    };
    
    const allEvents: Array<CalendarEvent> = [];
    
    // Add calendar events
    for (const event of eventsInRange) {
      allEvents.push({
        id: event._id,
        title: event.title,
        type: event.type,
        startDate: event.startDate,
        endDate: event.endDate ?? null,
        allDay: event.allDay,
        location: event.location ?? null,
        description: event.description ?? null,
        color: event.color ?? getDefaultColor(event.type),
        source: "calendar",
        sourceId: event._id,
      });
    }
    
    // Add competitions
    for (const comp of competitionsInRange) {
      allEvents.push({
        id: `comp-${comp._id}`,
        title: comp.name,
        type: "competition",
        startDate: comp.startDate,
        endDate: comp.endDate,
        allDay: true,
        location: comp.location,
        description: comp.notes ?? null,
        color: "#f57e25", // FTC Orange
        source: "competition",
        sourceId: comp._id,
      });
    }
    
    // Add meetings
    for (const meeting of meetingsInRange) {
      allEvents.push({
        id: `meeting-${meeting._id}`,
        title: meeting.title,
        type: meeting.type === "build_day" ? "build_day" : "meeting",
        startDate: meeting.date,
        endDate: null,
        allDay: !meeting.startTime,
        location: meeting.location ?? null,
        description: meeting.agenda ?? null,
        color: meeting.type === "build_day" ? "#22c55e" : "#3b82f6",
        source: "meeting",
        sourceId: meeting._id,
      });
    }
    
    // Add task deadlines
    for (const task of tasksInRange) {
      allEvents.push({
        id: `task-${task._id}`,
        title: `Due: ${task.name}`,
        type: "deadline",
        startDate: task.dueDate!,
        endDate: null,
        allDay: true,
        location: null,
        description: task.description ?? null,
        color: "#ef4444", // Red for deadlines
        source: "task",
        sourceId: task._id,
      });
    }
    
    // Add projects with dates
    for (const project of projectsInRange) {
      // Add project start date event
      if (project.startDate && project.startDate >= args.startDate && project.startDate <= args.endDate) {
        allEvents.push({
          id: `project-start-${project._id}`,
          title: `Project Start: ${project.name}`,
          type: "project",
          startDate: project.startDate,
          endDate: project.endDate ?? null,
          allDay: true,
          location: null,
          description: project.description ?? null,
          color: "#8b5cf6", // Purple for projects
          source: "project",
          sourceId: project._id,
        });
      }
      // Add project end date (deadline) event if different from start
      if (project.endDate && project.endDate >= args.startDate && project.endDate <= args.endDate && 
          project.endDate !== project.startDate) {
        allEvents.push({
          id: `project-end-${project._id}`,
          title: `Project Due: ${project.name}`,
          type: "deadline",
          startDate: project.endDate,
          endDate: null,
          allDay: true,
          location: null,
          description: project.description ?? null,
          color: "#8b5cf6", // Purple for projects
          source: "project",
          sourceId: project._id,
        });
      }
    }
    
    // Sort by start date
    allEvents.sort((a, b) => a.startDate - b.startDate);
    
    return allEvents;
  },
});

function getDefaultColor(type: string): string {
  switch (type) {
    case "competition":
      return "#f57e25";
    case "meeting":
      return "#3b82f6";
    case "deadline":
      return "#ef4444";
    case "build_day":
      return "#22c55e";
    case "outreach":
      return "#a855f7";
    default:
      return "#6b7280";
  }
}

// Create calendar event
export const createEvent = mutation({
  args: {
    title: v.string(),
    type: eventTypeValidator,
    startDate: v.number(),
    endDate: v.optional(v.number()),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    competitionId: v.optional(v.id("competitions")),
    meetingId: v.optional(v.id("meetings")),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.id("calendarEvents"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!clerkInfo) throw new Error("User not found");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .unique();
    if (!user) throw new Error("User not approved");
    
    const now = Date.now();
    return await ctx.db.insert("calendarEvents", {
      ...args,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update calendar event
export const updateEvent = mutation({
  args: {
    eventId: v.id("calendarEvents"),
    title: v.optional(v.string()),
    type: v.optional(eventTypeValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { eventId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(eventId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Delete calendar event
export const deleteEvent = mutation({
  args: {
    eventId: v.id("calendarEvents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    await ctx.db.delete(args.eventId);
    return null;
  },
});

// Get upcoming events summary
export const getUpcomingEventsSummary = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      type: v.string(),
      startDate: v.number(),
      daysUntil: v.number(),
      color: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const now = Date.now();
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
    
    // Get all events in next 30 days
    const calendarEvents = await ctx.db
      .query("calendarEvents")
      .withIndex("by_startDate")
      .collect();
    
    const competitions = await ctx.db
      .query("competitions")
      .withIndex("by_startDate")
      .collect();
    
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_date")
      .collect();
    
    type UpcomingEvent = {
      id: string;
      title: string;
      type: string;
      startDate: number;
      daysUntil: number;
      color: string;
    };
    
    const allEvents: Array<UpcomingEvent> = [];
    
    // Add calendar events
    for (const event of calendarEvents) {
      if (event.startDate >= now && event.startDate <= thirtyDaysFromNow) {
        allEvents.push({
          id: event._id,
          title: event.title,
          type: event.type,
          startDate: event.startDate,
          daysUntil: Math.ceil((event.startDate - now) / (1000 * 60 * 60 * 24)),
          color: event.color ?? getDefaultColor(event.type),
        });
      }
    }
    
    // Add competitions
    for (const comp of competitions) {
      if (comp.startDate >= now && comp.startDate <= thirtyDaysFromNow) {
        allEvents.push({
          id: `comp-${comp._id}`,
          title: comp.name,
          type: "competition",
          startDate: comp.startDate,
          daysUntil: Math.ceil((comp.startDate - now) / (1000 * 60 * 60 * 24)),
          color: "#f57e25",
        });
      }
    }
    
    // Add meetings
    for (const meeting of meetings) {
      if (meeting.date >= now && meeting.date <= thirtyDaysFromNow) {
        allEvents.push({
          id: `meeting-${meeting._id}`,
          title: meeting.title,
          type: meeting.type,
          startDate: meeting.date,
          daysUntil: Math.ceil((meeting.date - now) / (1000 * 60 * 60 * 24)),
          color: meeting.type === "build_day" ? "#22c55e" : "#3b82f6",
        });
      }
    }
    
    // Sort and limit
    allEvents.sort((a, b) => a.startDate - b.startDate);
    
    return allEvents.slice(0, limit);
  },
});
