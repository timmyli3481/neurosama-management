import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  getCurrentUser,
  isOwnerOrAdmin,
  getProjectPermission,
  getTaskPermission,
  getUserTeamIds,
  hasTaskAccess,
} from "./permissions";

// Task status validator
const taskStatusValidator = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done")
);

type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

/**
 * Create a new task - Admin, team leader, or project assignee
 */
export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(taskStatusValidator),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );

    if (permission === "none") {
      throw new Error("Not authorized - must have access to the project");
    }

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      status: args.status ?? "backlog",
      createdBy: currentUser._id,
      createdAt: now,
      updatedAt: now,
    });

    return taskId;
  },
});

/**
 * Update task details - Admin, team leader, or task assignee
 */
export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(taskStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const permission = await getTaskPermission(ctx, currentUser._id, args.taskId);
    if (permission === "none") {
      throw new Error("Not authorized");
    }

    // Members can only update status
    if (permission === "member") {
      if (args.name !== undefined || args.description !== undefined) {
        throw new Error("Members can only update task status");
      }
    }

    const updates: {
      name?: string;
      description?: string;
      status?: TaskStatus;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.status !== undefined) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.taskId, updates);

    return null;
  },
});

/**
 * Update task status only - for quick status changes
 */
export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: taskStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const permission = await getTaskPermission(ctx, currentUser._id, args.taskId);
    if (permission === "none") {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a task - Admin or team leader only
 */
export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const permission = await getTaskPermission(ctx, currentUser._id, args.taskId);
    if (permission !== "admin" && permission !== "team_leader") {
      throw new Error("Not authorized - admin or team leader required");
    }

    // Delete task assignments
    const assignments = await ctx.db
      .query("taskAssignments")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    // Delete the task
    await ctx.db.delete(args.taskId);

    return null;
  },
});

/**
 * Assign a task to a team or user
 */
export const assignTask = mutation({
  args: {
    taskId: v.id("tasks"),
    assignee: v.union(
      v.object({
        type: v.literal("team"),
        id: v.id("teams"),
      }),
      v.object({
        type: v.literal("user"),
        id: v.id("users"),
      })
    ),
  },
  returns: v.id("taskAssignments"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      task.projectId
    );

    if (permission === "none" || permission === "member") {
      throw new Error("Not authorized - admin or team leader required");
    }

    // Verify assignee exists
    if (args.assignee.type === "team") {
      const team = await ctx.db.get(args.assignee.id);
      if (!team) {
        throw new Error("Team not found");
      }
    } else {
      const user = await ctx.db.get(args.assignee.id);
      if (!user) {
        throw new Error("User not found");
      }
    }

    // Check if already assigned
    const existingAssignments = await ctx.db
      .query("taskAssignments")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    for (const assignment of existingAssignments) {
      if (
        assignment.assignee.type === args.assignee.type &&
        assignment.assignee.id === args.assignee.id
      ) {
        throw new Error("Already assigned to this task");
      }
    }

    const assignmentId = await ctx.db.insert("taskAssignments", {
      taskId: args.taskId,
      assignee: args.assignee,
    });

    return assignmentId;
  },
});

/**
 * Remove assignment from a task
 */
export const unassignTask = mutation({
  args: {
    assignmentId: v.id("taskAssignments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    const task = await ctx.db.get(assignment.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      task.projectId
    );

    if (permission !== "admin" && permission !== "team_leader") {
      throw new Error("Not authorized - admin or team leader required");
    }

    await ctx.db.delete(args.assignmentId);

    return null;
  },
});

/**
 * Get tasks by project - paginated
 */
export const getTasksByProject = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(taskStatusValidator),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("tasks"),
        projectId: v.id("projects"),
        name: v.string(),
        description: v.optional(v.string()),
        status: taskStatusValidator,
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
        assignees: v.array(
          v.object({
            assignmentId: v.id("taskAssignments"),
            type: v.union(v.literal("team"), v.literal("user")),
            id: v.string(),
            name: v.string(),
            imageUrl: v.union(v.string(), v.null()),
          })
        ),
        permission: v.union(
          v.literal("admin"),
          v.literal("team_leader"),
          v.literal("member"),
          v.literal("none")
        ),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const projectPermission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAdmin && projectPermission === "none") {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get paginated tasks
    const paginatedResult = args.status
      ? await ctx.db
          .query("tasks")
          .withIndex("by_projectId_and_status", (q) =>
            q.eq("projectId", args.projectId).eq("status", args.status!)
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("tasks")
          .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
          .order("desc")
          .paginate(args.paginationOpts);

    const tasksWithDetails = [];

    for (const task of paginatedResult.page) {
      const permission = await getTaskPermission(ctx, currentUser._id, task._id);

      // Get assignees
      const assignments = await ctx.db
        .query("taskAssignments")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      const assignees = [];
      for (const assignment of assignments) {
        if (assignment.assignee.type === "team") {
          const team = await ctx.db.get(assignment.assignee.id);
          if (team) {
            assignees.push({
              assignmentId: assignment._id,
              type: "team" as const,
              id: team._id as string,
              name: team.name,
              imageUrl: null,
            });
          }
        } else {
          const user = await ctx.db.get(assignment.assignee.id);
          if (user) {
            const clerkInfo = await ctx.db.get(user.clerkInfoId);
            const name =
              clerkInfo?.firstName || clerkInfo?.lastName
                ? `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim()
                : clerkInfo?.email ?? "Unknown";
            assignees.push({
              assignmentId: assignment._id,
              type: "user" as const,
              id: user._id as string,
              name,
              imageUrl: clerkInfo?.imageUrl ?? null,
            });
          }
        }
      }

      tasksWithDetails.push({
        _id: task._id,
        projectId: task.projectId,
        name: task.name,
        description: task.description,
        status: task.status,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        assignees,
        permission,
      });
    }

    return {
      page: tasksWithDetails,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * List tasks for current user (my tasks)
 */
export const listMyTasks = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(taskStatusValidator),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("tasks"),
        projectId: v.id("projects"),
        projectName: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        status: taskStatusValidator,
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Get all tasks and filter by access
    const paginatedResult = args.status
      ? await ctx.db
          .query("tasks")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("tasks")
          .order("desc")
          .paginate(args.paginationOpts);

    const myTasks = [];

    for (const task of paginatedResult.page) {
      // Filter by project if specified
      if (args.projectId && task.projectId !== args.projectId) {
        continue;
      }

      // Check if user has access to this task
      const hasAccess = await hasTaskAccess(ctx, currentUser._id, task._id);
      if (!hasAccess) {
        continue;
      }

      // Get project name
      const project = await ctx.db.get(task.projectId);

      myTasks.push({
        _id: task._id,
        projectId: task.projectId,
        projectName: project?.name ?? "Unknown Project",
        name: task.name,
        description: task.description,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });
    }

    return {
      page: myTasks,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Get a single task with details
 */
export const getTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.object({
      _id: v.id("tasks"),
      projectId: v.id("projects"),
      projectName: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      status: taskStatusValidator,
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      assignees: v.array(
        v.object({
          assignmentId: v.id("taskAssignments"),
          type: v.union(v.literal("team"), v.literal("user")),
          id: v.string(),
          name: v.string(),
          imageUrl: v.union(v.string(), v.null()),
        })
      ),
      permission: v.union(
        v.literal("admin"),
        v.literal("team_leader"),
        v.literal("member"),
        v.literal("none")
      ),
      creator: v.object({
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return null;
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return null;
    }

    const permission = await getTaskPermission(ctx, currentUser._id, args.taskId);

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAdmin && permission === "none") {
      return null;
    }

    // Get project
    const project = await ctx.db.get(task.projectId);

    // Get assignees
    const assignments = await ctx.db
      .query("taskAssignments")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    const assignees = [];
    for (const assignment of assignments) {
      if (assignment.assignee.type === "team") {
        const team = await ctx.db.get(assignment.assignee.id);
        if (team) {
          assignees.push({
            assignmentId: assignment._id,
            type: "team" as const,
            id: team._id as string,
            name: team.name,
            imageUrl: null,
          });
        }
      } else {
        const user = await ctx.db.get(assignment.assignee.id);
        if (user) {
          const clerkInfo = await ctx.db.get(user.clerkInfoId);
          const name =
            clerkInfo?.firstName || clerkInfo?.lastName
              ? `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim()
              : clerkInfo?.email ?? "Unknown";
          assignees.push({
            assignmentId: assignment._id,
            type: "user" as const,
            id: user._id as string,
            name,
            imageUrl: clerkInfo?.imageUrl ?? null,
          });
        }
      }
    }

    // Get creator info
    const creatorUser = await ctx.db.get(task.createdBy);
    const creatorClerkInfo = creatorUser
      ? await ctx.db.get(creatorUser.clerkInfoId)
      : null;

    return {
      _id: task._id,
      projectId: task.projectId,
      projectName: project?.name ?? "Unknown Project",
      name: task.name,
      description: task.description,
      status: task.status,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      assignees,
      permission,
      creator: {
        firstName: creatorClerkInfo?.firstName ?? null,
        lastName: creatorClerkInfo?.lastName ?? null,
      },
    };
  },
});

/**
 * Get available teams for task assignment - paginated
 */
export const getAvailableTeamsForTask = query({
  args: {
    taskId: v.id("tasks"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("teams"),
        name: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      task.projectId
    );

    if (permission !== "admin" && permission !== "team_leader") {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get current team assignments
    const assignments = await ctx.db
      .query("taskAssignments")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    const assignedTeamIds = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.assignee.type === "team") {
        assignedTeamIds.add(assignment.assignee.id as string);
      }
    }

    // Get paginated teams
    const paginatedResult = await ctx.db
      .query("teams")
      .order("desc")
      .paginate(args.paginationOpts);

    // Filter out already assigned teams
    const availableTeams = paginatedResult.page
      .filter((t) => !assignedTeamIds.has(t._id as string))
      .map((t) => ({
        _id: t._id,
        name: t.name,
      }));

    return {
      page: availableTeams,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Get available users for task assignment - paginated
 */
export const getAvailableUsersForTask = query({
  args: {
    taskId: v.id("tasks"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("users"),
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        email: v.union(v.string(), v.null()),
        imageUrl: v.union(v.string(), v.null()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      task.projectId
    );

    if (permission !== "admin" && permission !== "team_leader") {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get current user assignments
    const assignments = await ctx.db
      .query("taskAssignments")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    const assignedUserIds = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.assignee.type === "user") {
        assignedUserIds.add(assignment.assignee.id as string);
      }
    }

    // Get paginated users
    const paginatedResult = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);

    // Filter out already assigned users and enrich with clerk info
    const availableUsers = [];
    for (const user of paginatedResult.page) {
      if (!assignedUserIds.has(user._id as string)) {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        availableUsers.push({
          _id: user._id,
          firstName: clerkInfo?.firstName ?? null,
          lastName: clerkInfo?.lastName ?? null,
          email: clerkInfo?.email ?? null,
          imageUrl: clerkInfo?.imageUrl ?? null,
        });
      }
    }

    return {
      page: availableUsers,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Get dashboard stats
 * Note: For performance, this query limits the scan to 500 items per table.
 * For very large datasets, consider implementing aggregation tables.
 */
export const getDashboardStats = query({
  args: {},
  returns: v.object({
    totalProjects: v.number(),
    totalTasks: v.number(),
    tasksByStatus: v.object({
      backlog: v.number(),
      todo: v.number(),
      in_progress: v.number(),
      review: v.number(),
      done: v.number(),
    }),
    myTasks: v.number(),
    teamCount: v.number(),
  }),
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return {
        totalProjects: 0,
        totalTasks: 0,
        tasksByStatus: {
          backlog: 0,
          todo: 0,
          in_progress: 0,
          review: 0,
          done: 0,
        },
        myTasks: 0,
        teamCount: 0,
      };
    }

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    const SCAN_LIMIT = 500;

    // Count projects (limited scan)
    const projects = await ctx.db.query("projects").take(SCAN_LIMIT);
    let accessibleProjects = 0;
    for (const project of projects) {
      const permission = await getProjectPermission(
        ctx,
        currentUser._id,
        project._id
      );
      if (isAdmin || permission !== "none") {
        accessibleProjects++;
      }
    }

    // Count tasks by status using indexed queries for efficiency
    const tasksByStatus = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };

    // Get user's team IDs once for efficiency
    const userTeamIds = await getUserTeamIds(ctx, currentUser._id);

    let totalTasks = 0;
    let myTasks = 0;

    // For admins, we can count more efficiently by status
    if (isAdmin) {
      // Count by status using indexed queries
      for (const status of ["backlog", "todo", "in_progress", "review", "done"] as const) {
        const tasksForStatus = await ctx.db
          .query("tasks")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(SCAN_LIMIT);
        tasksByStatus[status] = tasksForStatus.length;
        totalTasks += tasksForStatus.length;
      }
      
      // Count my tasks (tasks assigned to user or their teams)
      const tasks = await ctx.db.query("tasks").take(SCAN_LIMIT);
      for (const task of tasks) {
        const hasAccess = await hasTaskAccess(ctx, currentUser._id, task._id);
        if (hasAccess) {
          myTasks++;
        }
      }
    } else {
      // Non-admin: only count tasks they have access to
      const tasks = await ctx.db.query("tasks").take(SCAN_LIMIT);
      for (const task of tasks) {
        const hasAccess = await hasTaskAccess(ctx, currentUser._id, task._id);
        if (hasAccess) {
          totalTasks++;
          tasksByStatus[task.status as TaskStatus]++;
          myTasks++;
        }
      }
    }

    // Count teams
    let teamCount = 0;
    if (isAdmin) {
      const teams = await ctx.db.query("teams").take(SCAN_LIMIT);
      teamCount = teams.length;
    } else {
      teamCount = userTeamIds.length;
    }

    return {
      totalProjects: accessibleProjects,
      totalTasks,
      tasksByStatus,
      myTasks,
      teamCount,
    };
  },
});
