import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Helper to get waitlist enabled setting
 */
async function isWaitlistEnabled(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const settings = await ctx.db.query("settings").first();
  // Default to true if not set
  return settings?.waitlistEnabled ?? true;
}

/**
 * Helper function to check if user is owner or admin
 */
async function isOwnerOrAdmin(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return false;
  }
  return user.role === "owner" || user.role === "admin";
}

/**
 * Helper function to get clerkInfo by clerkId (from identity.subject)
 */
async function getClerkInfoBySubject(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
): Promise<{ _id: Id<"clerkInfo">; clerkId: string } | null> {
  const clerkInfo = await ctx.db
    .query("clerkInfo")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
  return clerkInfo ?? null;
}

/**
 * Helper function to get current user by clerkId (via clerkInfo)
 */
async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ _id: Id<"users">; clerkInfoId: Id<"clerkInfo">; role: "owner" | "admin" | "member" } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // First get the clerkInfo
  const clerkInfo = await getClerkInfoBySubject(ctx, identity.subject);
  if (!clerkInfo) {
    return null;
  }

  // Then get the user by clerkInfoId
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
    .first();

  return user ?? null;
}

// ============================================================================
// Clerk Info Internal Mutations
// ============================================================================

/**
 * Clerk info validator for webhook data
 */
const clerkInfoDataValidator = v.object({
  clerkId: v.string(),
  email: v.union(v.string(), v.null()),
  firstName: v.union(v.string(), v.null()),
  lastName: v.union(v.string(), v.null()),
  username: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
});

/**
 * Internal mutation to upsert clerk info (create or update)
 */
export const upsertClerkInfo = internalMutation({
  args: clerkInfoDataValidator,
  returns: v.id("clerkInfo"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        username: args.username,
        imageUrl: args.imageUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("clerkInfo", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      username: args.username,
      imageUrl: args.imageUrl,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation to delete clerk info by clerkId
 * Cascade deletes: user (with all related data), waitlist entry
 */
export const deleteClerkInfo = internalMutation({
  args: { clerkId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existing) {
      return null;
    }

    // Cascade delete: user and all related data
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", existing._id))
      .first();

    if (user && user.role !== "owner") {
      // Cascade delete: teamMembers
      const teamMemberships = await ctx.db
        .query("teamMembers")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      for (const membership of teamMemberships) {
        await ctx.db.delete(membership._id);
      }

      // Cascade delete: projectAssignments where user is assigned
      const allProjectAssignments = await ctx.db.query("projectAssignments").collect();
      for (const assignment of allProjectAssignments) {
        if (
          assignment.assignee.type === "user" &&
          assignment.assignee.id === user._id
        ) {
          await ctx.db.delete(assignment._id);
        }
      }

      // Cascade delete: taskAssignments where user is assigned
      const allTaskAssignments = await ctx.db.query("taskAssignments").collect();
      for (const assignment of allTaskAssignments) {
        if (
          assignment.assignee.type === "user" &&
          assignment.assignee.id === user._id
        ) {
          await ctx.db.delete(assignment._id);
        }
      }

      // Cascade delete: invites created by this user
      const invites = await ctx.db.query("invites").collect();
      for (const invite of invites) {
        if (invite.invitedBy === user._id) {
          await ctx.db.delete(invite._id);
        }
      }

      // Reassign teams where user is leader to owner
      const ledTeams = await ctx.db
        .query("teams")
        .withIndex("by_leaderId", (q) => q.eq("leaderId", user._id))
        .collect();

      if (ledTeams.length > 0) {
        const allUsers = await ctx.db.query("users").collect();
        const owner = allUsers.find((u) => u.role === "owner");

        for (const team of ledTeams) {
          if (owner) {
            await ctx.db.patch(team._id, { leaderId: owner._id });
          } else {
            // Delete the team cascade
            const members = await ctx.db
              .query("teamMembers")
              .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
              .collect();
            for (const member of members) {
              await ctx.db.delete(member._id);
            }

            for (const assignment of allProjectAssignments) {
              if (
                assignment.assignee.type === "team" &&
                assignment.assignee.id === team._id
              ) {
                await ctx.db.delete(assignment._id);
              }
            }

            for (const assignment of allTaskAssignments) {
              if (
                assignment.assignee.type === "team" &&
                assignment.assignee.id === team._id
              ) {
                await ctx.db.delete(assignment._id);
              }
            }

            await ctx.db.delete(team._id);
          }
        }
      }

      await ctx.db.delete(user._id);
    }

    // Cascade delete: waitlist entry
    const waitlistEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", existing._id))
      .first();

    if (waitlistEntry) {
      await ctx.db.delete(waitlistEntry._id);
    }

    // Delete clerkInfo
    await ctx.db.delete(existing._id);

    return null;
  },
});

/**
 * Internal query to get clerk info by clerkId
 */
export const getClerkInfoByClerkId = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("clerkInfo"),
      clerkId: v.string(),
      email: v.union(v.string(), v.null()),
      firstName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
      username: v.union(v.string(), v.null()),
      imageUrl: v.union(v.string(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const info = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return info ?? null;
  },
});

// ============================================================================
// Auth Status Query (replaces checkAuth mutation)
// ============================================================================

/**
 * Get auth status - query version (no side effects)
 * Returns user status: "approved", "waitlisted", "pending", or "not_authenticated"
 */
export const getAuthStatus = query({
  args: {},
  returns: v.union(
    v.object({
      status: v.literal("approved"),
      user: v.object({
        _id: v.id("users"),
        clerkInfoId: v.id("clerkInfo"),
        role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      }),
    }),
    v.object({
      status: v.literal("waitlisted"),
    }),
    v.object({
      status: v.literal("pending"),
      hasClerkInfo: v.boolean(),
    }),
    v.object({
      status: v.literal("not_authenticated"),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { status: "not_authenticated" as const };
    }

    const clerkId = identity.subject;

    // First check if we have clerkInfo for this user
    const clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!clerkInfo) {
      // No clerk info yet - webhook hasn't been received
      return { 
        status: "pending" as const, 
        hasClerkInfo: false,
      };
    }

    // Check if user is approved (via clerkInfoId)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (user) {
      return {
        status: "approved" as const,
        user: {
          _id: user._id,
          clerkInfoId: user.clerkInfoId,
          role: user.role,
        },
      };
    }

    // Check if already on waitlist (via clerkInfoId)
    const onWaitlist = await ctx.db
      .query("waitlist")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (onWaitlist) {
      return { status: "waitlisted" as const };
    }

    // User has clerkInfo but not in users or waitlist - needs registration
    return { 
      status: "pending" as const, 
      hasClerkInfo: true,
    };
  },
});

/**
 * Ensure user is registered - mutation that handles registration logic
 * Called by client when getAuthStatus returns "pending"
 * 
 * Flow:
 * 1. If clerkInfo doesn't exist, create it from identity token
 * 2. If first user -> auto approve as owner
 * 3. If user in clerkInfo but not in users/waitlist:
 *    - If waitlist enabled -> add to waitlist
 *    - If waitlist disabled -> delete from clerkInfo + Clerk
 */
export const ensureUserRegistered = mutation({
  args: {},
  returns: v.union(
    v.object({
      status: v.literal("approved"),
      user: v.object({
        _id: v.id("users"),
        clerkInfoId: v.id("clerkInfo"),
        role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      }),
    }),
    v.object({
      status: v.literal("waitlisted"),
    }),
    v.object({
      status: v.literal("not_allowed"),
      deleteFromClerk: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;

    // Check if we have clerk info for this user
    let clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    // If no clerkInfo exists, create it from the identity token
    if (!clerkInfo) {
      const now = Date.now();
      const clerkInfoId = await ctx.db.insert("clerkInfo", {
        clerkId,
        email: identity.email ?? null,
        firstName: identity.givenName ?? null,
        lastName: identity.familyName ?? null,
        username: identity.nickname ?? null,
        imageUrl: identity.pictureUrl ?? null,
        createdAt: now,
        updatedAt: now,
      });
      clerkInfo = await ctx.db.get(clerkInfoId);
      if (!clerkInfo) {
        throw new Error("Failed to create clerkInfo");
      }
    }

    // Double-check user is not already approved
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (existingUser) {
      return {
        status: "approved" as const,
        user: {
          _id: existingUser._id,
          clerkInfoId: existingUser.clerkInfoId,
          role: existingUser.role,
        },
      };
    }

    // Double-check user is not already on waitlist
    const onWaitlist = await ctx.db
      .query("waitlist")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (onWaitlist) {
      return { status: "waitlisted" as const };
    }

    // Check if this is the first user (becomes owner)
    const hasAnyUser = await ctx.db.query("users").first();
    if (!hasAnyUser) {
      // First user becomes owner, auto-approved
      const userId = await ctx.db.insert("users", {
        clerkInfoId: clerkInfo._id,
        role: "owner",
      });
      return {
        status: "approved" as const,
        user: {
          _id: userId,
          clerkInfoId: clerkInfo._id,
          role: "owner" as const,
        },
      };
    }

    // User is in clerkInfo but not in users or waitlist
    // Check if waitlist is enabled
    const waitlistEnabled = await isWaitlistEnabled(ctx);

    if (waitlistEnabled) {
      // Add to waitlist
      await ctx.db.insert("waitlist", {
        clerkInfoId: clerkInfo._id,
        createdAt: Date.now(),
      });
      return { status: "waitlisted" as const };
    }

    // Waitlist disabled - clean up and reject
    // Delete from clerkInfo
    await ctx.db.delete(clerkInfo._id);

    // Schedule deletion from Clerk
    await ctx.scheduler.runAfter(0, internal.clerk.deleteClerkUser, {
      clerkId,
    });

    return { status: "not_allowed" as const, deleteFromClerk: true };
  },
});

/**
 * Get current user if approved
 */
export const getUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkInfoId: v.id("clerkInfo"),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      clerkInfo: v.object({
        _id: v.id("clerkInfo"),
        clerkId: v.string(),
        email: v.union(v.string(), v.null()),
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        username: v.union(v.string(), v.null()),
        imageUrl: v.union(v.string(), v.null()),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get clerkInfo first
    const clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!clerkInfo) {
      return null;
    }

    // Get user by clerkInfoId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      clerkInfoId: user.clerkInfoId,
      role: user.role,
      clerkInfo: {
        _id: clerkInfo._id,
        clerkId: clerkInfo.clerkId,
        email: clerkInfo.email,
        firstName: clerkInfo.firstName,
        lastName: clerkInfo.lastName,
        username: clerkInfo.username,
        imageUrl: clerkInfo.imageUrl,
      },
    };
  },
});

/**
 * Check if current user is on waitlist
 */
export const isOnWaitlist = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    // Get clerkInfo first
    const clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!clerkInfo) {
      return false;
    }

    const entry = await ctx.db
      .query("waitlist")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    return entry !== null;
  },
});

/**
 * Internal query to list waitlist entries with pagination
 */
export const listWaitlistInternal = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("waitlist"),
        clerkInfoId: v.id("clerkInfo"),
        createdAt: v.number(),
        clerkInfo: v.object({
          _id: v.id("clerkInfo"),
          clerkId: v.string(),
          email: v.union(v.string(), v.null()),
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          username: v.union(v.string(), v.null()),
          imageUrl: v.union(v.string(), v.null()),
        }),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const paginatedResult = await ctx.db
      .query("waitlist")
      .order("desc")
      .paginate(args.paginationOpts);

    // Fetch clerkInfo for each waitlist entry
    const pageWithClerkInfo = await Promise.all(
      paginatedResult.page.map(async (entry) => {
        const clerkInfo = await ctx.db.get(entry.clerkInfoId);
        if (!clerkInfo) {
          throw new Error(`ClerkInfo not found for waitlist entry ${entry._id}`);
        }
        return {
          _id: entry._id,
          clerkInfoId: entry.clerkInfoId,
          createdAt: entry.createdAt,
          clerkInfo: {
            _id: clerkInfo._id,
            clerkId: clerkInfo.clerkId,
            email: clerkInfo.email,
            firstName: clerkInfo.firstName,
            lastName: clerkInfo.lastName,
            username: clerkInfo.username,
            imageUrl: clerkInfo.imageUrl,
          },
        };
      }),
    );

    return {
      page: pageWithClerkInfo,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Waitlist entry with clerk info type
 */
type WaitlistEntryWithClerkInfo = {
  _id: Id<"waitlist">;
  clerkInfoId: Id<"clerkInfo">;
  createdAt: number;
  clerkInfo: {
    _id: Id<"clerkInfo">;
    clerkId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    imageUrl: string | null;
  };
};

/**
 * List waitlist entries - for owner/admin
 * Now uses local clerkInfo instead of calling Clerk API
 */
export const listWaitlist = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("waitlist"),
        clerkInfoId: v.id("clerkInfo"),
        createdAt: v.number(),
        clerkInfo: v.object({
          _id: v.id("clerkInfo"),
          clerkId: v.string(),
          email: v.union(v.string(), v.null()),
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          username: v.union(v.string(), v.null()),
          imageUrl: v.union(v.string(), v.null()),
        }),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const paginatedResult = await ctx.db
      .query("waitlist")
      .order("desc")
      .paginate(args.paginationOpts);

    // Fetch clerkInfo for each waitlist entry
    const pageWithClerkInfo: WaitlistEntryWithClerkInfo[] = await Promise.all(
      paginatedResult.page.map(async (entry) => {
        const clerkInfo = await ctx.db.get(entry.clerkInfoId);
        if (!clerkInfo) {
          throw new Error(`ClerkInfo not found for waitlist entry ${entry._id}`);
        }
        return {
          _id: entry._id,
          clerkInfoId: entry.clerkInfoId,
          createdAt: entry.createdAt,
          clerkInfo: {
            _id: clerkInfo._id,
            clerkId: clerkInfo.clerkId,
            email: clerkInfo.email,
            firstName: clerkInfo.firstName,
            lastName: clerkInfo.lastName,
            username: clerkInfo.username,
            imageUrl: clerkInfo.imageUrl,
          },
        };
      }),
    );

    return {
      page: pageWithClerkInfo,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Approve a user from waitlist - moves them to users table
 */
export const approveFromWaitlist = mutation({
  args: {
    waitlistId: v.id("waitlist"),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const waitlistEntry = await ctx.db.get(args.waitlistId);
    if (!waitlistEntry) {
      throw new Error("Waitlist entry not found");
    }

    // Create user with reference to clerkInfo
    const userId = await ctx.db.insert("users", {
      clerkInfoId: waitlistEntry.clerkInfoId,
      role: args.role ?? "member",
    });

    // Remove from waitlist
    await ctx.db.delete(args.waitlistId);

    return userId;
  },
});

/**
 * Remove from waitlist (deny) - optionally delete from Clerk
 */
export const removeFromWaitlist = mutation({
  args: {
    waitlistId: v.id("waitlist"),
    deleteFromClerk: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const waitlistEntry = await ctx.db.get(args.waitlistId);
    if (!waitlistEntry) {
      throw new Error("Waitlist entry not found");
    }

    // Get clerkInfo to get clerkId for Clerk deletion
    const clerkInfo = await ctx.db.get(waitlistEntry.clerkInfoId);

    // Remove from waitlist
    await ctx.db.delete(args.waitlistId);

    // Optionally delete from Clerk and clerkInfo
    if (args.deleteFromClerk && clerkInfo) {
      // Delete clerkInfo
      await ctx.db.delete(clerkInfo._id);
      
      // Schedule deletion from Clerk
      await ctx.scheduler.runAfter(0, internal.clerk.deleteClerkUser, {
        clerkId: clerkInfo.clerkId,
      });
    }

    return null;
  },
});

/**
 * User with clerk info type
 */
type UserWithClerkInfo = {
  _id: Id<"users">;
  clerkInfoId: Id<"clerkInfo">;
  role: "owner" | "admin" | "member";
  clerkInfo: {
    _id: Id<"clerkInfo">;
    clerkId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    imageUrl: string | null;
  };
};

/**
 * List all approved users with pagination - for admin
 */
export const listUsers = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("users"),
        clerkInfoId: v.id("clerkInfo"),
        role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
        clerkInfo: v.object({
          _id: v.id("clerkInfo"),
          clerkId: v.string(),
          email: v.union(v.string(), v.null()),
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          username: v.union(v.string(), v.null()),
          imageUrl: v.union(v.string(), v.null()),
        }),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, currentUser._id);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const paginatedResult = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);

    // Fetch clerkInfo for each user
    const pageWithClerkInfo: UserWithClerkInfo[] = await Promise.all(
      paginatedResult.page.map(async (user) => {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        if (!clerkInfo) {
          throw new Error(`ClerkInfo not found for user ${user._id}`);
        }
        return {
          _id: user._id,
          clerkInfoId: user.clerkInfoId,
          role: user.role,
          clerkInfo: {
            _id: clerkInfo._id,
            clerkId: clerkInfo.clerkId,
            email: clerkInfo.email,
            firstName: clerkInfo.firstName,
            lastName: clerkInfo.lastName,
            username: clerkInfo.username,
            imageUrl: clerkInfo.imageUrl,
          },
        };
      }),
    );

    return {
      page: pageWithClerkInfo,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Update user role
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const currentUserDoc = await ctx.db.get(currentUser._id);
    if (!currentUserDoc || currentUserDoc.role !== "owner") {
      throw new Error("Not authorized - owner required");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === "owner") {
      throw new Error("Cannot change owner role");
    }

    await ctx.db.patch(args.userId, { role: args.role });
    return null;
  },
});

/**
 * Remove user - for owner only
 * Cascade deletes: teamMembers, projectAssignments, taskAssignments, invites
 * Note: Will fail if user is a team leader - must reassign leadership first
 */
export const removeUser = mutation({
  args: {
    userId: v.id("users"),
    deleteFromClerk: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const currentUserDoc = await ctx.db.get(currentUser._id);
    if (!currentUserDoc || currentUserDoc.role !== "owner") {
      throw new Error("Not authorized - owner required");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === "owner") {
      throw new Error("Cannot remove owner");
    }

    // Check if user is a team leader - must reassign first
    const ledTeams = await ctx.db
      .query("teams")
      .withIndex("by_leaderId", (q) => q.eq("leaderId", args.userId))
      .collect();

    if (ledTeams.length > 0) {
      throw new Error(
        `Cannot remove user - they lead ${ledTeams.length} team(s). Reassign leadership first.`
      );
    }

    // Cascade delete: teamMembers
    const teamMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const membership of teamMemberships) {
      await ctx.db.delete(membership._id);
    }

    // Cascade delete: projectAssignments where user is assigned
    const allProjectAssignments = await ctx.db.query("projectAssignments").collect();
    for (const assignment of allProjectAssignments) {
      if (
        assignment.assignee.type === "user" &&
        assignment.assignee.id === args.userId
      ) {
        await ctx.db.delete(assignment._id);
      }
    }

    // Cascade delete: taskAssignments where user is assigned
    const allTaskAssignments = await ctx.db.query("taskAssignments").collect();
    for (const assignment of allTaskAssignments) {
      if (
        assignment.assignee.type === "user" &&
        assignment.assignee.id === args.userId
      ) {
        await ctx.db.delete(assignment._id);
      }
    }

    // Cascade delete: invites created by this user
    const invites = await ctx.db.query("invites").collect();
    for (const invite of invites) {
      if (invite.invitedBy === args.userId) {
        await ctx.db.delete(invite._id);
      }
    }

    // Get clerkInfo for Clerk deletion
    const clerkInfo = await ctx.db.get(user.clerkInfoId);

    // Delete user
    await ctx.db.delete(args.userId);

    if (args.deleteFromClerk && clerkInfo) {
      // Delete clerkInfo
      await ctx.db.delete(clerkInfo._id);
      
      // Schedule deletion from Clerk
      await ctx.scheduler.runAfter(0, internal.clerk.deleteClerkUser, {
        clerkId: clerkInfo.clerkId,
      });
    }

    return null;
  },
});

/**
 * Internal mutation to delete user by clerkId
 * Called by webhook when user is deleted from Clerk
 * Cascade deletes: user (with teamMembers, assignments, invites), waitlist, clerkInfo
 */
/**
 * List all users for assignment purposes - for any authenticated user
 * This is used for team forms, project/task assignments, etc.
 * Returns minimal user info needed for selection UI.
 */
export const listUsersForAssignment = query({
  args: {
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
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const paginatedResult = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);

    // Fetch clerkInfo for each user
    const pageWithInfo = await Promise.all(
      paginatedResult.page.map(async (user) => {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        return {
          _id: user._id,
          firstName: clerkInfo?.firstName ?? null,
          lastName: clerkInfo?.lastName ?? null,
          email: clerkInfo?.email ?? null,
          imageUrl: clerkInfo?.imageUrl ?? null,
        };
      }),
    );

    return {
      page: pageWithInfo,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

export const deleteUserByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get clerkInfo first
    const clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!clerkInfo) {
      // No clerkInfo found, nothing to do
      return null;
    }

    // Remove from users (if exists and not owner)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (user && user.role !== "owner") {
      // Cascade delete: teamMembers
      const teamMemberships = await ctx.db
        .query("teamMembers")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      for (const membership of teamMemberships) {
        await ctx.db.delete(membership._id);
      }

      // Cascade delete: projectAssignments where user is assigned
      const allProjectAssignments = await ctx.db.query("projectAssignments").collect();
      for (const assignment of allProjectAssignments) {
        if (
          assignment.assignee.type === "user" &&
          assignment.assignee.id === user._id
        ) {
          await ctx.db.delete(assignment._id);
        }
      }

      // Cascade delete: taskAssignments where user is assigned
      const allTaskAssignments = await ctx.db.query("taskAssignments").collect();
      for (const assignment of allTaskAssignments) {
        if (
          assignment.assignee.type === "user" &&
          assignment.assignee.id === user._id
        ) {
          await ctx.db.delete(assignment._id);
        }
      }

      // Cascade delete: invites created by this user
      const invites = await ctx.db.query("invites").collect();
      for (const invite of invites) {
        if (invite.invitedBy === user._id) {
          await ctx.db.delete(invite._id);
        }
      }

      // Reassign teams where user is leader to owner (find owner)
      const ledTeams = await ctx.db
        .query("teams")
        .withIndex("by_leaderId", (q) => q.eq("leaderId", user._id))
        .collect();

      if (ledTeams.length > 0) {
        // Find owner to reassign leadership
        const allUsers = await ctx.db.query("users").collect();
        const owner = allUsers.find((u) => u.role === "owner");

        for (const team of ledTeams) {
          if (owner) {
            // Reassign to owner
            await ctx.db.patch(team._id, { leaderId: owner._id });
          } else {
            // No owner found, delete the team and its related data
            // Delete team members
            const members = await ctx.db
              .query("teamMembers")
              .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
              .collect();
            for (const member of members) {
              await ctx.db.delete(member._id);
            }

            // Delete project assignments for this team
            for (const assignment of allProjectAssignments) {
              if (
                assignment.assignee.type === "team" &&
                assignment.assignee.id === team._id
              ) {
                await ctx.db.delete(assignment._id);
              }
            }

            // Delete task assignments for this team
            for (const assignment of allTaskAssignments) {
              if (
                assignment.assignee.type === "team" &&
                assignment.assignee.id === team._id
              ) {
                await ctx.db.delete(assignment._id);
              }
            }

            await ctx.db.delete(team._id);
          }
        }
      }

      await ctx.db.delete(user._id);
    }

    // Remove from waitlist (if exists)
    const waitlistEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .first();

    if (waitlistEntry) {
      await ctx.db.delete(waitlistEntry._id);
    }

    // Delete clerkInfo
    await ctx.db.delete(clerkInfo._id);

    return null;
  },
});
