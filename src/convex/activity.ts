import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Activity type validator
const activityTypeValidator = v.union(
  v.literal("task_created"),
  v.literal("task_completed"),
  v.literal("task_updated"),
  v.literal("project_created"),
  v.literal("notebook_entry"),
  v.literal("subsystem_update"),
  v.literal("competition_result"),
  v.literal("part_added"),
  v.literal("meeting_scheduled"),
  v.literal("scouting_report"),
  v.literal("award_won"),
  v.literal("member_joined")
);

const entityTypeValidator = v.union(
  v.literal("task"),
  v.literal("project"),
  v.literal("notebook"),
  v.literal("subsystem"),
  v.literal("competition"),
  v.literal("part"),
  v.literal("meeting"),
  v.literal("scouting")
);

// Get recent activity feed
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("activityLog"),
      type: activityTypeValidator,
      title: v.string(),
      description: v.union(v.string(), v.null()),
      userId: v.id("users"),
      userName: v.string(),
      userImage: v.union(v.string(), v.null()),
      entityType: v.union(entityTypeValidator, v.null()),
      entityId: v.union(v.string(), v.null()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    const activities = await ctx.db
      .query("activityLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);

    const result = [];
    for (const activity of activities) {
      const user = await ctx.db.get(activity.userId);
      if (!user) continue;
      
      const clerkInfo = await ctx.db.get(user.clerkInfoId);
      
      result.push({
        _id: activity._id,
        type: activity.type,
        title: activity.title,
        description: activity.description ?? null,
        userId: activity.userId,
        userName: clerkInfo
          ? `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown"
          : "Unknown",
        userImage: clerkInfo?.imageUrl ?? null,
        entityType: activity.entityType ?? null,
        entityId: activity.entityId ?? null,
        createdAt: activity.createdAt,
      });
    }
    
    return result;
  },
});

// Get activity by type
export const getActivityByType = query({
  args: {
    type: activityTypeValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("activityLog"),
      type: activityTypeValidator,
      title: v.string(),
      description: v.union(v.string(), v.null()),
      userId: v.id("users"),
      userName: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    const activities = await ctx.db
      .query("activityLog")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .order("desc")
      .take(limit);

    const result = [];
    for (const activity of activities) {
      const user = await ctx.db.get(activity.userId);
      if (!user) continue;
      
      const clerkInfo = await ctx.db.get(user.clerkInfoId);
      
      result.push({
        _id: activity._id,
        type: activity.type,
        title: activity.title,
        description: activity.description ?? null,
        userId: activity.userId,
        userName: clerkInfo
          ? `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown"
          : "Unknown",
        createdAt: activity.createdAt,
      });
    }
    
    return result;
  },
});

// Internal mutation to log activity (called from other mutations)
export const logActivity = internalMutation({
  args: {
    type: activityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
    entityType: v.optional(entityTypeValidator),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  returns: v.id("activityLog"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLog", {
      type: args.type,
      title: args.title,
      description: args.description,
      userId: args.userId,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

// Get activity count for dashboard stats
export const getActivityStats = query({
  args: {
    daysBack: v.optional(v.number()),
  },
  returns: v.object({
    total: v.number(),
    byType: v.object({
      tasks: v.number(),
      notebook: v.number(),
      robot: v.number(),
      competitions: v.number(),
      meetings: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 7;
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    
    const activities = await ctx.db
      .query("activityLog")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    
    const recentActivities = activities.filter((a) => a.createdAt >= cutoff);
    
    return {
      total: recentActivities.length,
      byType: {
        tasks: recentActivities.filter(
          (a) => a.type === "task_created" || a.type === "task_completed" || a.type === "task_updated"
        ).length,
        notebook: recentActivities.filter((a) => a.type === "notebook_entry").length,
        robot: recentActivities.filter((a) => a.type === "subsystem_update" || a.type === "part_added").length,
        competitions: recentActivities.filter(
          (a) => a.type === "competition_result" || a.type === "award_won" || a.type === "scouting_report"
        ).length,
        meetings: recentActivities.filter((a) => a.type === "meeting_scheduled").length,
      },
    };
  },
});
