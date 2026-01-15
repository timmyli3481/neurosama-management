import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Helper function to get current user via clerkInfo
 */
async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // First get clerkInfo by clerkId
  const clerkInfo = await ctx.db
    .query("clerkInfo")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!clerkInfo) {
    return null;
  }

  // Then get user by clerkInfoId
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
    .first();

  return user?._id ?? null;
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
 * Record a Clerk invite in our database
 * Called after successfully creating an invite via Clerk API
 */
export const recordInvite = mutation({
  args: {
    clerkInviteId: v.string(),
  },
  returns: v.id("invites"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUser(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, userId);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    // Check if invite already recorded
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_clerkInviteId", (q) => q.eq("clerkInviteId", args.clerkInviteId))
      .first();

    if (existing) {
      return existing._id;
    }

    const inviteId = await ctx.db.insert("invites", {
      clerkInviteId: args.clerkInviteId,
      invitedBy: userId,
      createdAt: Date.now(),
      status: "pending",
    });

    return inviteId;
  },
});

/**
 * List all invites - for owner/admin - paginated
 */
export const listInvites = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("invites"),
        clerkInviteId: v.string(),
        invitedBy: v.id("users"),
        createdAt: v.number(),
        status: v.union(v.literal("pending"), v.literal("revoked")),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUser(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, userId);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const paginatedResult = await ctx.db
      .query("invites")
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: paginatedResult.page,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Revoke an invite - marks as revoked in our DB and revokes in Clerk
 */
export const revokeInvite = mutation({
  args: {
    inviteId: v.id("invites"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUser(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, userId);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status === "revoked") {
      throw new Error("Invite already revoked");
    }

    // Mark as revoked in our DB
    await ctx.db.patch(args.inviteId, { status: "revoked" });

    // Revoke in Clerk
    await ctx.scheduler.runAfter(0, internal.clerk.revokeClerkInvite, {
      clerkInviteId: invite.clerkInviteId,
    });

    return null;
  },
});

/**
 * Internal mutation to mark invite as revoked (used by webhooks)
 */
export const markInviteRevoked = internalMutation({
  args: {
    clerkInviteId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_clerkInviteId", (q) => q.eq("clerkInviteId", args.clerkInviteId))
      .first();

    if (invite) {
      await ctx.db.patch(invite._id, { status: "revoked" });
    }

    return null;
  },
});
