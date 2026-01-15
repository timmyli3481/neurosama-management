import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export type PermissionLevel = "admin" | "team_leader" | "member" | "none";

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const clerkInfo = await ctx.db
    .query("clerkInfo")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!clerkInfo) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
    .first();

  return user ?? null;
}

/**
 * Check if user is owner or admin
 */
export async function isOwnerOrAdmin(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return false;
  }
  return user.role === "owner" || user.role === "admin";
}

/**
 * Check if user is the leader of a specific team
 */
export async function isTeamLeader(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  teamId: Id<"teams">
): Promise<boolean> {
  const team = await ctx.db.get(teamId);
  if (!team) {
    return false;
  }
  return team.leaderId === userId;
}

/**
 * Check if user is a member of a specific team
 */
export async function isTeamMember(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  teamId: Id<"teams">
): Promise<boolean> {
  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_teamId_and_userId", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .first();
  return membership !== null;
}

/**
 * Get all team IDs that a user belongs to (as member or leader)
 */
export async function getUserTeamIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Id<"teams">[]> {
  const teamIds: Id<"teams">[] = [];

  // Teams where user is a member
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  for (const membership of memberships) {
    teamIds.push(membership.teamId);
  }

  // Teams where user is the leader
  const ledTeams = await ctx.db
    .query("teams")
    .withIndex("by_leaderId", (q) => q.eq("leaderId", userId))
    .collect();

  for (const team of ledTeams) {
    if (!teamIds.includes(team._id)) {
      teamIds.push(team._id);
    }
  }

  return teamIds;
}

/**
 * Check if user has access to a project (assigned directly or via team)
 */
export async function hasProjectAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">
): Promise<boolean> {
  // Get all assignments for this project
  const assignments = await ctx.db
    .query("projectAssignments")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .collect();

  // Check direct user assignment
  for (const assignment of assignments) {
    if (assignment.assignee.type === "user" && assignment.assignee.id === userId) {
      return true;
    }
  }

  // Check team assignments
  const userTeamIds = await getUserTeamIds(ctx, userId);
  for (const assignment of assignments) {
    if (
      assignment.assignee.type === "team" &&
      userTeamIds.includes(assignment.assignee.id)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has access to a task (assigned directly or via team or project)
 */
export async function hasTaskAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">
): Promise<boolean> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    return false;
  }

  // Get all assignments for this task
  const assignments = await ctx.db
    .query("taskAssignments")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();

  // Check direct user assignment to task
  for (const assignment of assignments) {
    if (assignment.assignee.type === "user" && assignment.assignee.id === userId) {
      return true;
    }
  }

  // Check team assignments to task
  const userTeamIds = await getUserTeamIds(ctx, userId);
  for (const assignment of assignments) {
    if (
      assignment.assignee.type === "team" &&
      userTeamIds.includes(assignment.assignee.id)
    ) {
      return true;
    }
  }

  // Check if user has access to the project
  return hasProjectAccess(ctx, userId, task.projectId);
}

/**
 * Get permission level for a team
 */
export async function getTeamPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  teamId: Id<"teams">
): Promise<PermissionLevel> {
  // Check if admin/owner
  if (await isOwnerOrAdmin(ctx, userId)) {
    return "admin";
  }

  // Check if team leader
  if (await isTeamLeader(ctx, userId, teamId)) {
    return "team_leader";
  }

  // Check if team member
  if (await isTeamMember(ctx, userId, teamId)) {
    return "member";
  }

  return "none";
}

/**
 * Get permission level for a project
 */
export async function getProjectPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">
): Promise<PermissionLevel> {
  // Check if admin/owner
  if (await isOwnerOrAdmin(ctx, userId)) {
    return "admin";
  }

  // Get all assignments for this project
  const assignments = await ctx.db
    .query("projectAssignments")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .collect();

  // Check if user leads a team assigned to this project
  const ledTeams = await ctx.db
    .query("teams")
    .withIndex("by_leaderId", (q) => q.eq("leaderId", userId))
    .collect();

  for (const team of ledTeams) {
    for (const assignment of assignments) {
      if (
        assignment.assignee.type === "team" &&
        assignment.assignee.id === team._id
      ) {
        return "team_leader";
      }
    }
  }

  // Check if user has access (member level)
  if (await hasProjectAccess(ctx, userId, projectId)) {
    return "member";
  }

  return "none";
}

/**
 * Get permission level for a task
 */
export async function getTaskPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">
): Promise<PermissionLevel> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    return "none";
  }

  // Check if admin/owner
  if (await isOwnerOrAdmin(ctx, userId)) {
    return "admin";
  }

  // Check project-level permission (team leader of assigned team)
  const projectPermission = await getProjectPermission(
    ctx,
    userId,
    task.projectId
  );
  if (projectPermission === "team_leader") {
    return "team_leader";
  }

  // Check if user has access to task (member level)
  if (await hasTaskAccess(ctx, userId, taskId)) {
    return "member";
  }

  return "none";
}

/**
 * Check if user leads any team
 */
export async function isAnyTeamLeader(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<boolean> {
  const ledTeam = await ctx.db
    .query("teams")
    .withIndex("by_leaderId", (q) => q.eq("leaderId", userId))
    .first();
  return ledTeam !== null;
}
