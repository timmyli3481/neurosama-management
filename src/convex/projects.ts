import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  getCurrentUser,
  isOwnerOrAdmin,
  getProjectPermission,
  getUserTeamIds,
  isAnyTeamLeader,
} from "./permissions";

// Task status type
type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

/**
 * Create a new project - Admin or team leader
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    const isLeader = await isAnyTeamLeader(ctx, currentUser._id);

    if (!isAdmin && !isLeader) {
      throw new Error("Not authorized - admin or team leader required");
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      createdBy: currentUser._id,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

/**
 * Update project details - Admin or assigned users with permission
 */
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );
    if (permission === "none" || permission === "member") {
      throw new Error("Not authorized - admin or team leader required");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const updates: { name?: string; description?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }

    await ctx.db.patch(args.projectId, updates);

    return null;
  },
});

/**
 * Delete a project - Admin or team leader
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );
    if (permission !== "admin" && permission !== "team_leader") {
      throw new Error("Not authorized - admin or team leader required");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Delete all tasks in the project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const task of tasks) {
      // Delete task assignments
      const taskAssignments = await ctx.db
        .query("taskAssignments")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      for (const assignment of taskAssignments) {
        await ctx.db.delete(assignment._id);
      }

      await ctx.db.delete(task._id);
    }

    // Delete project assignments
    const projectAssignments = await ctx.db
      .query("projectAssignments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const assignment of projectAssignments) {
      await ctx.db.delete(assignment._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);

    return null;
  },
});

/**
 * Assign a project to a team or user
 */
export const assignProject = mutation({
  args: {
    projectId: v.id("projects"),
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
  returns: v.id("projectAssignments"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );
    if (permission !== "admin" && permission !== "team_leader") {
      throw new Error("Not authorized - admin or team leader required");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
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
      .query("projectAssignments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const assignment of existingAssignments) {
      if (
        assignment.assignee.type === args.assignee.type &&
        assignment.assignee.id === args.assignee.id
      ) {
        throw new Error("Already assigned to this project");
      }
    }

    const assignmentId = await ctx.db.insert("projectAssignments", {
      projectId: args.projectId,
      assignee: args.assignee,
    });

    return assignmentId;
  },
});

/**
 * Remove assignment from a project
 */
export const unassignProject = mutation({
  args: {
    assignmentId: v.id("projectAssignments"),
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

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      assignment.projectId
    );
    if (permission !== "admin" && permission !== "team_leader") {
      throw new Error("Not authorized - admin or team leader required");
    }

    await ctx.db.delete(args.assignmentId);

    return null;
  },
});

/**
 * List all projects - filtered by access
 */
export const listProjects = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filter: v.optional(
      v.union(v.literal("all"), v.literal("my"), v.literal("team"))
    ),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("projects"),
        name: v.string(),
        description: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
        taskStats: v.object({
          total: v.number(),
          backlog: v.number(),
          todo: v.number(),
          in_progress: v.number(),
          review: v.number(),
          done: v.number(),
        }),
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
      throw new Error("Not authenticated");
    }

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    const filter = args.filter ?? "all";

    // Get paginated projects
    const paginatedResult = await ctx.db
      .query("projects")
      .order("desc")
      .paginate(args.paginationOpts);

    const projectsWithDetails = [];

    for (const project of paginatedResult.page) {
      const permission = await getProjectPermission(
        ctx,
        currentUser._id,
        project._id
      );

      // Filter based on access
      if (!isAdmin && permission === "none") {
        continue;
      }

      // Apply additional filters
      if (filter === "my") {
        // Only show projects directly assigned to user
        const assignments = await ctx.db
          .query("projectAssignments")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .collect();

        const isDirectlyAssigned = assignments.some(
          (a) => a.assignee.type === "user" && a.assignee.id === currentUser._id
        );

        if (!isDirectlyAssigned && project.createdBy !== currentUser._id) {
          continue;
        }
      } else if (filter === "team") {
        // Only show projects assigned to user's teams
        const userTeamIds = await getUserTeamIds(ctx, currentUser._id);
        const assignments = await ctx.db
          .query("projectAssignments")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .collect();

        const isTeamAssigned = assignments.some(
          (a) =>
            a.assignee.type === "team" && userTeamIds.includes(a.assignee.id)
        );

        if (!isTeamAssigned) {
          continue;
        }
      }

      // Get task stats
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();

      const taskStats = {
        total: tasks.length,
        backlog: 0,
        todo: 0,
        in_progress: 0,
        review: 0,
        done: 0,
      };

      for (const task of tasks) {
        taskStats[task.status as TaskStatus]++;
      }

      projectsWithDetails.push({
        _id: project._id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        taskStats,
        permission,
      });
    }

    return {
      page: projectsWithDetails,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Get a single project with details
 */
export const getProject = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      name: v.string(),
      description: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      taskStats: v.object({
        total: v.number(),
        backlog: v.number(),
        todo: v.number(),
        in_progress: v.number(),
        review: v.number(),
        done: v.number(),
      }),
      assignees: v.array(
        v.object({
          assignmentId: v.id("projectAssignments"),
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

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );

    // Check access
    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAdmin && permission === "none") {
      return null;
    }

    // Get task stats
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const taskStats = {
      total: tasks.length,
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };

    for (const task of tasks) {
      taskStats[task.status as TaskStatus]++;
    }

    // Get assignees
    const assignments = await ctx.db
      .query("projectAssignments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
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
    const creatorUser = await ctx.db.get(project.createdBy);
    const creatorClerkInfo = creatorUser
      ? await ctx.db.get(creatorUser.clerkInfoId)
      : null;

    return {
      _id: project._id,
      name: project.name,
      description: project.description,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      taskStats,
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
 * Get available teams for assignment - paginated
 */
export const getAvailableTeamsForProject = query({
  args: {
    projectId: v.id("projects"),
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

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );
    if (permission !== "admin" && permission !== "team_leader") {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get current team assignments
    const assignments = await ctx.db
      .query("projectAssignments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
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
 * Get available users for assignment - paginated
 */
export const getAvailableUsersForProject = query({
  args: {
    projectId: v.id("projects"),
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

    const permission = await getProjectPermission(
      ctx,
      currentUser._id,
      args.projectId
    );
    if (permission !== "admin" && permission !== "team_leader") {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get current user assignments
    const assignments = await ctx.db
      .query("projectAssignments")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
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
