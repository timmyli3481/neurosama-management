import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import {
  getCurrentUser,
  isOwnerOrAdmin,
  isTeamLeader,
  getTeamPermission,
} from "./permissions";

/**
 * Create a new team - Admin only
 */
export const createTeam = mutation({
  args: {
    name: v.string(),
    leaderId: v.id("users"),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    if (!(await isOwnerOrAdmin(ctx, currentUser._id))) {
      throw new Error("Not authorized - admin required");
    }

    // Verify leader exists
    const leader = await ctx.db.get(args.leaderId);
    if (!leader) {
      throw new Error("Leader user not found");
    }

    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      leaderId: args.leaderId,
      createdAt: Date.now(),
    });

    return teamId;
  },
});

/**
 * Update team details - Admin only
 */
export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    leaderId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    if (!(await isOwnerOrAdmin(ctx, currentUser._id))) {
      throw new Error("Not authorized - admin required");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const updates: { name?: string; leaderId?: Id<"users"> } = {};
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.leaderId !== undefined) {
      // Verify new leader exists
      const leader = await ctx.db.get(args.leaderId);
      if (!leader) {
        throw new Error("Leader user not found");
      }
      updates.leaderId = args.leaderId;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.teamId, updates);
    }

    return null;
  },
});

/**
 * Delete a team - Admin only
 */
export const deleteTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    if (!(await isOwnerOrAdmin(ctx, currentUser._id))) {
      throw new Error("Not authorized - admin required");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Delete all team members
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all project assignments for this team
    const projectAssignments = await ctx.db
      .query("projectAssignments")
      .collect();

    for (const assignment of projectAssignments) {
      if (
        assignment.assignee.type === "team" &&
        assignment.assignee.id === args.teamId
      ) {
        await ctx.db.delete(assignment._id);
      }
    }

    // Delete all task assignments for this team
    const taskAssignments = await ctx.db.query("taskAssignments").collect();

    for (const assignment of taskAssignments) {
      if (
        assignment.assignee.type === "team" &&
        assignment.assignee.id === args.teamId
      ) {
        await ctx.db.delete(assignment._id);
      }
    }

    // Delete the team
    await ctx.db.delete(args.teamId);

    return null;
  },
});

/**
 * Add a member to a team - Admin or team leader
 */
export const addTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.id("teamMembers"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    const isLeader = await isTeamLeader(ctx, currentUser._id, args.teamId);

    if (!isAdmin && !isLeader) {
      throw new Error("Not authorized - admin or team leader required");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .first();

    if (existingMembership) {
      throw new Error("User is already a member of this team");
    }

    const membershipId = await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      userId: args.userId,
      addedAt: Date.now(),
    });

    return membershipId;
  },
});

/**
 * Remove a member from a team - Admin or team leader
 */
export const removeTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    const isLeader = await isTeamLeader(ctx, currentUser._id, args.teamId);

    if (!isAdmin && !isLeader) {
      throw new Error("Not authorized - admin or team leader required");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Can't remove the team leader
    if (team.leaderId === args.userId) {
      throw new Error("Cannot remove team leader from team");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this team");
    }

    await ctx.db.delete(membership._id);

    return null;
  },
});

/**
 * List all teams - filtered by access
 */
export const listTeams = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("teams"),
        name: v.string(),
        leaderId: v.id("users"),
        createdAt: v.number(),
        memberCount: v.number(),
        leader: v.object({
          _id: v.id("users"),
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          imageUrl: v.union(v.string(), v.null()),
        }),
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

    // Get paginated teams
    const paginatedResult = await ctx.db
      .query("teams")
      .order("desc")
      .paginate(args.paginationOpts);

    // Filter teams based on access
    const teamsWithDetails = [];
    for (const team of paginatedResult.page) {
      // Admins see all teams, others see only teams they lead or belong to
      if (!isAdmin) {
        const permission = await getTeamPermission(ctx, currentUser._id, team._id);
        if (permission === "none") {
          continue;
        }
      }

      // Get member count
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
        .collect();

      // Get leader info
      const leaderClerkInfo = await ctx.db.get(
        (await ctx.db.get(team.leaderId))?.clerkInfoId ?? ("" as Id<"clerkInfo">)
      );

      teamsWithDetails.push({
        _id: team._id,
        name: team.name,
        leaderId: team.leaderId,
        createdAt: team.createdAt,
        memberCount: members.length,
        leader: {
          _id: team.leaderId,
          firstName: leaderClerkInfo?.firstName ?? null,
          lastName: leaderClerkInfo?.lastName ?? null,
          imageUrl: leaderClerkInfo?.imageUrl ?? null,
        },
      });
    }

    return {
      page: teamsWithDetails,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Get a single team with members
 */
export const getTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.union(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      leaderId: v.id("users"),
      createdAt: v.number(),
      leader: v.object({
        _id: v.id("users"),
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        email: v.union(v.string(), v.null()),
        imageUrl: v.union(v.string(), v.null()),
      }),
      members: v.array(
        v.object({
          _id: v.id("users"),
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          email: v.union(v.string(), v.null()),
          imageUrl: v.union(v.string(), v.null()),
          addedAt: v.number(),
        })
      ),
      permission: v.union(
        v.literal("admin"),
        v.literal("team_leader"),
        v.literal("member"),
        v.literal("none")
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return null;
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }

    const permission = await getTeamPermission(ctx, currentUser._id, args.teamId);

    // Only team members, leaders, or admins can view team details
    if (permission === "none") {
      return null;
    }

    // Get leader info
    const leaderUser = await ctx.db.get(team.leaderId);
    const leaderClerkInfo = leaderUser
      ? await ctx.db.get(leaderUser.clerkInfoId)
      : null;

    // Get members
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    const members = [];
    for (const membership of memberships) {
      const user = await ctx.db.get(membership.userId);
      if (user) {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        members.push({
          _id: user._id,
          firstName: clerkInfo?.firstName ?? null,
          lastName: clerkInfo?.lastName ?? null,
          email: clerkInfo?.email ?? null,
          imageUrl: clerkInfo?.imageUrl ?? null,
          addedAt: membership.addedAt,
        });
      }
    }

    return {
      _id: team._id,
      name: team.name,
      leaderId: team.leaderId,
      createdAt: team.createdAt,
      leader: {
        _id: team.leaderId,
        firstName: leaderClerkInfo?.firstName ?? null,
        lastName: leaderClerkInfo?.lastName ?? null,
        email: leaderClerkInfo?.email ?? null,
        imageUrl: leaderClerkInfo?.imageUrl ?? null,
      },
      members,
      permission,
    };
  },
});

/**
 * Get all users available to add to a team - paginated
 */
export const getAvailableUsersForTeam = query({
  args: {
    teamId: v.id("teams"),
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

    const isAdmin = await isOwnerOrAdmin(ctx, currentUser._id);
    const isLeader = await isTeamLeader(ctx, currentUser._id, args.teamId);

    if (!isAdmin && !isLeader) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Get current team members
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    const memberUserIds = new Set(memberships.map((m) => m.userId as string));
    memberUserIds.add(team.leaderId as string); // Exclude leader too

    // Get paginated users
    const paginatedResult = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);

    // Filter out team members and enrich with clerk info
    const availableUsers = [];
    for (const user of paginatedResult.page) {
      if (!memberUserIds.has(user._id as string)) {
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
