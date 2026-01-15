import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// Meeting type validator
const meetingTypeValidator = v.union(
  v.literal("build_day"),
  v.literal("strategy"),
  v.literal("outreach"),
  v.literal("mentor_meeting"),
  v.literal("competition_prep"),
  v.literal("general"),
  v.literal("code_review")
);

const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("excused"),
  v.literal("late")
);

// List meetings
export const listMeetings = query({
  args: {
    paginationOpts: paginationOptsValidator,
    upcoming: v.optional(v.boolean()),
    type: v.optional(meetingTypeValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    let query;
    if (args.type) {
      query = ctx.db
        .query("meetings")
        .withIndex("by_type", (q) => q.eq("type", args.type!));
    } else {
      query = ctx.db.query("meetings").withIndex("by_date");
    }
    
    if (args.upcoming) {
      query = query.order("asc");
    } else {
      query = query.order("desc");
    }
    
    const results = await query.paginate(args.paginationOpts);
    
    // Enhance with attendance counts
    const enhancedPage = [];
    for (const meeting of results.page) {
      const attendance = await ctx.db
        .query("attendance")
        .withIndex("by_meetingId", (q) => q.eq("meetingId", meeting._id))
        .collect();
      
      const presentCount = attendance.filter((a) => a.status === "present" || a.status === "late").length;
      
      enhancedPage.push({
        ...meeting,
        attendanceCount: {
          present: presentCount,
          total: attendance.length,
        },
      });
    }
    
    // Filter upcoming if needed
    if (args.upcoming) {
      return {
        ...results,
        page: enhancedPage.filter((m) => m.date >= now),
      };
    }
    
    return {
      ...results,
      page: enhancedPage,
    };
  },
});

// Get meeting by ID
export const getMeeting = query({
  args: {
    meetingId: v.id("meetings"),
  },
  handler: async (ctx, args) => {
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting) return null;
    
    // Get attendance records
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .collect();
    
    // Enhance attendance with user info
    const enhancedAttendance = [];
    for (const record of attendance) {
      const user = await ctx.db.get(record.userId);
      if (!user) continue;
      
      const clerkInfo = await ctx.db.get(user.clerkInfoId);
      if (!clerkInfo) continue;
      
      enhancedAttendance.push({
        ...record,
        userName: `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown",
        userImage: clerkInfo.imageUrl,
      });
    }
    
    // Get creator info
    const creator = await ctx.db.get(meeting.createdBy);
    let creatorName = "Unknown";
    if (creator) {
      const clerkInfo = await ctx.db.get(creator.clerkInfoId);
      if (clerkInfo) {
        creatorName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
      }
    }
    
    // Get related notebook entries
    const notebookEntries = await ctx.db
      .query("engineeringNotebook")
      .withIndex("by_entryDate")
      .order("desc")
      .collect();
    
    const relatedEntries = notebookEntries.filter((e) => e.meetingId === args.meetingId);
    
    const stats = {
      present: enhancedAttendance.filter((a) => a.status === "present").length,
      late: enhancedAttendance.filter((a) => a.status === "late").length,
      absent: enhancedAttendance.filter((a) => a.status === "absent").length,
      excused: enhancedAttendance.filter((a) => a.status === "excused").length,
      total: enhancedAttendance.length,
    };
    
    return {
      ...meeting,
      attendance: enhancedAttendance,
      creatorName,
      notebookEntries: relatedEntries,
      stats,
    };
  },
});

// Create meeting
export const createMeeting = mutation({
  args: {
    title: v.string(),
    type: meetingTypeValidator,
    date: v.number(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    agenda: v.optional(v.string()),
  },
  returns: v.id("meetings"),
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
    const meetingId = await ctx.db.insert("meetings", {
      ...args,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "meeting_scheduled" as const,
      title: `Meeting scheduled: ${args.title}`,
      description: `${args.type} on ${new Date(args.date).toLocaleDateString()}`,
      userId: user._id,
      entityType: "meeting" as const,
      entityId: meetingId,
    });
    
    return meetingId;
  },
});

// Update meeting
export const updateMeeting = mutation({
  args: {
    meetingId: v.id("meetings"),
    title: v.optional(v.string()),
    type: v.optional(meetingTypeValidator),
    date: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    agenda: v.optional(v.string()),
    notes: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { meetingId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(meetingId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Delete meeting
export const deleteMeeting = mutation({
  args: {
    meetingId: v.id("meetings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Delete attendance records
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .collect();
    
    for (const record of attendance) {
      await ctx.db.delete(record._id);
    }
    
    await ctx.db.delete(args.meetingId);
    return null;
  },
});

// Record attendance
export const recordAttendance = mutation({
  args: {
    meetingId: v.id("meetings"),
    userId: v.id("users"),
    status: attendanceStatusValidator,
    arrivalTime: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("attendance"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Check if attendance already exists
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_meetingId_and_userId", (q) =>
        q.eq("meetingId", args.meetingId).eq("userId", args.userId)
      )
      .unique();
    
    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        status: args.status,
        arrivalTime: args.arrivalTime,
        notes: args.notes,
      });
      return existing._id;
    }
    
    // Create new record
    return await ctx.db.insert("attendance", {
      meetingId: args.meetingId,
      userId: args.userId,
      status: args.status,
      arrivalTime: args.arrivalTime,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

// Bulk record attendance
export const bulkRecordAttendance = mutation({
  args: {
    meetingId: v.id("meetings"),
    records: v.array(
      v.object({
        userId: v.id("users"),
        status: attendanceStatusValidator,
        arrivalTime: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    for (const record of args.records) {
      const existing = await ctx.db
        .query("attendance")
        .withIndex("by_meetingId_and_userId", (q) =>
          q.eq("meetingId", args.meetingId).eq("userId", record.userId)
        )
        .unique();
      
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: record.status,
          arrivalTime: record.arrivalTime,
          notes: record.notes,
        });
      } else {
        await ctx.db.insert("attendance", {
          meetingId: args.meetingId,
          userId: record.userId,
          status: record.status,
          arrivalTime: record.arrivalTime,
          notes: record.notes,
          createdAt: Date.now(),
        });
      }
    }
    
    return null;
  },
});

// Get next meeting
export const getNextMeeting = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("meetings"),
      title: v.string(),
      type: meetingTypeValidator,
      date: v.number(),
      startTime: v.union(v.string(), v.null()),
      location: v.union(v.string(), v.null()),
      daysUntil: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const now = Date.now();
    
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_date")
      .order("asc")
      .collect();
    
    const upcoming = meetings.find((m) => m.date >= now);
    
    if (!upcoming) return null;
    
    const daysUntil = Math.ceil((upcoming.date - now) / (1000 * 60 * 60 * 24));
    
    return {
      _id: upcoming._id,
      title: upcoming.title,
      type: upcoming.type,
      date: upcoming.date,
      startTime: upcoming.startTime ?? null,
      location: upcoming.location ?? null,
      daysUntil,
    };
  },
});

// Get meeting stats
export const getMeetingStats = query({
  args: {},
  returns: v.object({
    totalMeetings: v.number(),
    upcomingMeetings: v.number(),
    thisMonth: v.number(),
    avgAttendance: v.number(),
    byType: v.object({
      build_day: v.number(),
      strategy: v.number(),
      outreach: v.number(),
      mentor_meeting: v.number(),
      competition_prep: v.number(),
      general: v.number(),
      code_review: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const meetings = await ctx.db.query("meetings").collect();
    const attendance = await ctx.db.query("attendance").collect();
    
    const upcomingMeetings = meetings.filter((m) => m.date >= now).length;
    const thisMonth = meetings.filter((m) => m.date >= monthStart.getTime()).length;
    
    // Calculate average attendance
    let totalPresent = 0;
    let totalRecords = 0;
    for (const meeting of meetings) {
      const meetingAttendance = attendance.filter((a) => a.meetingId === meeting._id);
      const present = meetingAttendance.filter(
        (a) => a.status === "present" || a.status === "late"
      ).length;
      totalPresent += present;
      totalRecords += meetingAttendance.length;
    }
    
    const avgAttendance = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
    
    return {
      totalMeetings: meetings.length,
      upcomingMeetings,
      thisMonth,
      avgAttendance,
      byType: {
        build_day: meetings.filter((m) => m.type === "build_day").length,
        strategy: meetings.filter((m) => m.type === "strategy").length,
        outreach: meetings.filter((m) => m.type === "outreach").length,
        mentor_meeting: meetings.filter((m) => m.type === "mentor_meeting").length,
        competition_prep: meetings.filter((m) => m.type === "competition_prep").length,
        general: meetings.filter((m) => m.type === "general").length,
        code_review: meetings.filter((m) => m.type === "code_review").length,
      },
    };
  },
});

// Get user attendance history
export const getUserAttendanceStats = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  returns: v.object({
    totalMeetings: v.number(),
    attended: v.number(),
    late: v.number(),
    absent: v.number(),
    excused: v.number(),
    attendanceRate: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    let userId = args.userId;
    
    if (!userId) {
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
      
      userId = user._id;
    }
    
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_userId", (q) => q.eq("userId", userId!))
      .collect();
    
    const attended = attendance.filter((a) => a.status === "present").length;
    const late = attendance.filter((a) => a.status === "late").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    const excused = attendance.filter((a) => a.status === "excused").length;
    
    const attendanceRate = attendance.length > 0
      ? Math.round(((attended + late) / attendance.length) * 100)
      : 0;
    
    return {
      totalMeetings: attendance.length,
      attended,
      late,
      absent,
      excused,
      attendanceRate,
    };
  },
});
