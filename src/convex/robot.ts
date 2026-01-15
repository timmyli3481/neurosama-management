import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Subsystem type validator
const subsystemTypeValidator = v.union(
  v.literal("drivetrain"),
  v.literal("intake"),
  v.literal("arm"),
  v.literal("lift"),
  v.literal("claw"),
  v.literal("shooter"),
  v.literal("sensors"),
  v.literal("vision"),
  v.literal("electronics"),
  v.literal("other")
);

const subsystemStatusValidator = v.union(
  v.literal("concept"),
  v.literal("design"),
  v.literal("prototyping"),
  v.literal("testing"),
  v.literal("competition_ready"),
  v.literal("needs_repair")
);

const changeTypeValidator = v.union(
  v.literal("design_change"),
  v.literal("rebuild"),
  v.literal("repair"),
  v.literal("upgrade"),
  v.literal("testing_results")
);

// List all subsystems
export const listSubsystems = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("robotSubsystems"),
      name: v.string(),
      type: subsystemTypeValidator,
      description: v.union(v.string(), v.null()),
      status: subsystemStatusValidator,
      progress: v.number(),
      currentVersion: v.union(v.string(), v.null()),
      leadUserId: v.union(v.id("users"), v.null()),
      leadName: v.union(v.string(), v.null()),
      taskCount: v.number(),
      recentLogs: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const subsystems = await ctx.db.query("robotSubsystems").collect();
    
    const result = [];
    for (const subsystem of subsystems) {
      // Get lead user name
      let leadName = null;
      if (subsystem.leadUserId) {
        const lead = await ctx.db.get(subsystem.leadUserId);
        if (lead) {
          const clerkInfo = await ctx.db.get(lead.clerkInfoId);
          if (clerkInfo) {
            leadName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email;
          }
        }
      }
      
      // Count tasks linked to this subsystem
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_subsystemId", (q) => q.eq("subsystemId", subsystem._id))
        .collect();
      
      // Count recent logs (last 7 days)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const logs = await ctx.db
        .query("subsystemLogs")
        .withIndex("by_subsystemId", (q) => q.eq("subsystemId", subsystem._id))
        .collect();
      const recentLogs = logs.filter((l) => l.createdAt >= weekAgo).length;
      
      result.push({
        _id: subsystem._id,
        name: subsystem.name,
        type: subsystem.type,
        description: subsystem.description ?? null,
        status: subsystem.status,
        progress: subsystem.progress,
        currentVersion: subsystem.currentVersion ?? null,
        leadUserId: subsystem.leadUserId ?? null,
        leadName,
        taskCount: tasks.length,
        recentLogs,
        createdAt: subsystem.createdAt,
        updatedAt: subsystem.updatedAt,
      });
    }
    
    return result;
  },
});

// Get subsystem by ID with full details
export const getSubsystem = query({
  args: {
    subsystemId: v.id("robotSubsystems"),
  },
  handler: async (ctx, args) => {
    const subsystem = await ctx.db.get(args.subsystemId);
    if (!subsystem) return null;
    
    // Get lead user
    let leadUser = null;
    if (subsystem.leadUserId) {
      const lead = await ctx.db.get(subsystem.leadUserId);
      if (lead) {
        const clerkInfo = await ctx.db.get(lead.clerkInfoId);
        if (clerkInfo) {
          leadUser = {
            _id: lead._id,
            name: `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown",
            imageUrl: clerkInfo.imageUrl,
          };
        }
      }
    }
    
    // Get logs
    const logs = await ctx.db
      .query("subsystemLogs")
      .withIndex("by_subsystemId", (q) => q.eq("subsystemId", args.subsystemId))
      .order("desc")
      .take(20);
    
    const logsWithUser = [];
    for (const log of logs) {
      const user = await ctx.db.get(log.createdBy);
      let userName = "Unknown";
      if (user) {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        if (clerkInfo) {
          userName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      logsWithUser.push({
        ...log,
        createdByName: userName,
      });
    }
    
    // Get related tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_subsystemId", (q) => q.eq("subsystemId", args.subsystemId))
      .collect();
    
    // Get related parts
    const parts = await ctx.db
      .query("partsInventory")
      .withIndex("by_subsystemId", (q) => q.eq("subsystemId", args.subsystemId))
      .collect();
    
    // Get related notebook entries
    const notebookEntries = await ctx.db
      .query("engineeringNotebook")
      .withIndex("by_subsystemId", (q) => q.eq("subsystemId", args.subsystemId))
      .order("desc")
      .take(5);
    
    return {
      ...subsystem,
      leadUser,
      logs: logsWithUser,
      tasks,
      parts,
      notebookEntries,
      stats: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "done").length,
        activeTasks: tasks.filter((t) => t.status === "in_progress").length,
        partsCount: parts.length,
        logCount: logs.length,
      },
    };
  },
});

// Create subsystem
export const createSubsystem = mutation({
  args: {
    name: v.string(),
    type: subsystemTypeValidator,
    description: v.optional(v.string()),
    status: v.optional(subsystemStatusValidator),
    progress: v.optional(v.number()),
    leadUserId: v.optional(v.id("users")),
  },
  returns: v.id("robotSubsystems"),
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
    const subsystemId = await ctx.db.insert("robotSubsystems", {
      name: args.name,
      type: args.type,
      description: args.description,
      status: args.status ?? "concept",
      progress: args.progress ?? 0,
      leadUserId: args.leadUserId,
      createdAt: now,
      updatedAt: now,
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "subsystem_update" as const,
      title: `New subsystem created: ${args.name}`,
      description: `${args.type} subsystem added`,
      userId: user._id,
      entityType: "subsystem" as const,
      entityId: subsystemId,
    });
    
    return subsystemId;
  },
});

// Update subsystem
export const updateSubsystem = mutation({
  args: {
    subsystemId: v.id("robotSubsystems"),
    name: v.optional(v.string()),
    type: v.optional(subsystemTypeValidator),
    description: v.optional(v.string()),
    status: v.optional(subsystemStatusValidator),
    progress: v.optional(v.number()),
    currentVersion: v.optional(v.string()),
    leadUserId: v.optional(v.id("users")),
    specs: v.optional(v.string()),
  },
  returns: v.null(),
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
    
    const { subsystemId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    const subsystem = await ctx.db.get(subsystemId);
    if (!subsystem) throw new Error("Subsystem not found");
    
    await ctx.db.patch(subsystemId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "subsystem_update" as const,
      title: `Subsystem updated: ${subsystem.name}`,
      userId: user._id,
      entityType: "subsystem" as const,
      entityId: subsystemId,
    });
    
    return null;
  },
});

// Delete subsystem
export const deleteSubsystem = mutation({
  args: {
    subsystemId: v.id("robotSubsystems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Delete associated logs
    const logs = await ctx.db
      .query("subsystemLogs")
      .withIndex("by_subsystemId", (q) => q.eq("subsystemId", args.subsystemId))
      .collect();
    
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    
    await ctx.db.delete(args.subsystemId);
    return null;
  },
});

// Add subsystem log entry
export const addLog = mutation({
  args: {
    subsystemId: v.id("robotSubsystems"),
    version: v.string(),
    changeType: changeTypeValidator,
    description: v.string(),
    testResults: v.optional(v.string()),
  },
  returns: v.id("subsystemLogs"),
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
    
    // Update subsystem version
    await ctx.db.patch(args.subsystemId, {
      currentVersion: args.version,
      updatedAt: Date.now(),
    });
    
    return await ctx.db.insert("subsystemLogs", {
      subsystemId: args.subsystemId,
      version: args.version,
      changeType: args.changeType,
      description: args.description,
      testResults: args.testResults,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// Get overall robot readiness
export const getRobotReadiness = query({
  args: {},
  returns: v.object({
    overallProgress: v.number(),
    subsystemsReady: v.number(),
    totalSubsystems: v.number(),
    needsAttention: v.array(
      v.object({
        _id: v.id("robotSubsystems"),
        name: v.string(),
        status: subsystemStatusValidator,
        progress: v.number(),
      })
    ),
    byStatus: v.object({
      concept: v.number(),
      design: v.number(),
      prototyping: v.number(),
      testing: v.number(),
      competition_ready: v.number(),
      needs_repair: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const subsystems = await ctx.db.query("robotSubsystems").collect();
    
    if (subsystems.length === 0) {
      return {
        overallProgress: 0,
        subsystemsReady: 0,
        totalSubsystems: 0,
        needsAttention: [],
        byStatus: {
          concept: 0,
          design: 0,
          prototyping: 0,
          testing: 0,
          competition_ready: 0,
          needs_repair: 0,
        },
      };
    }
    
    const ready = subsystems.filter((s) => s.status === "competition_ready").length;
    const avgProgress = Math.round(
      subsystems.reduce((sum, s) => sum + s.progress, 0) / subsystems.length
    );
    
    const needsAttention = subsystems
      .filter((s) => s.status === "needs_repair" || s.progress < 50)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        status: s.status,
        progress: s.progress,
      }));
    
    const byStatus = {
      concept: subsystems.filter((s) => s.status === "concept").length,
      design: subsystems.filter((s) => s.status === "design").length,
      prototyping: subsystems.filter((s) => s.status === "prototyping").length,
      testing: subsystems.filter((s) => s.status === "testing").length,
      competition_ready: subsystems.filter((s) => s.status === "competition_ready").length,
      needs_repair: subsystems.filter((s) => s.status === "needs_repair").length,
    };
    
    return {
      overallProgress: avgProgress,
      subsystemsReady: ready,
      totalSubsystems: subsystems.length,
      needsAttention,
      byStatus,
    };
  },
});
