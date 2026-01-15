import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
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
 * Get or create settings document
 */
async function getOrCreateSettings(ctx: MutationCtx) {
  const existing = await ctx.db.query("settings").first();
  if (existing) {
    return existing;
  }
  // Create default settings
  const id = await ctx.db.insert("settings", {
    waitlistEnabled: true,
  });
  return (await ctx.db.get(id))!;
}

/**
 * Get all settings
 */
export const getSettings = query({
  args: {},
  returns: v.object({
    waitlistEnabled: v.boolean(),
  }),
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").first();
    // Return defaults if no settings exist
    return {
      waitlistEnabled: settings?.waitlistEnabled ?? true,
    };
  },
});

/**
 * Get all settings - for admin dashboard (with auth check)
 */
export const getAllSettings = query({
  args: {},
  returns: v.object({
    waitlistEnabled: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getCurrentUser(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const isAuthorized = await isOwnerOrAdmin(ctx, userId);
    if (!isAuthorized) {
      throw new Error("Not authorized - owner or admin required");
    }

    const settings = await ctx.db.query("settings").first();
    return {
      waitlistEnabled: settings?.waitlistEnabled ?? true,
    };
  },
});

/**
 * Set waitlist enabled setting - owner/admin only
 */
export const setWaitlistEnabled = mutation({
  args: {
    enabled: v.boolean(),
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

    const settings = await getOrCreateSettings(ctx);
    await ctx.db.patch(settings._id, { waitlistEnabled: args.enabled });

    return null;
  },
});
