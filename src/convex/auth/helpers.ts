import { internalQuery } from "../functions";
import { v } from "convex/values";

// ============================================================================
// AUTH HELPER QUERIES
// ============================================================================

const roleValidator = v.union(v.literal("owner"), v.literal("admin"), v.literal("member"));

/**
 * Get current user's authentication info
 * Returns null if not authenticated or not approved
 */
export const getCurrentUser = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      clerkInfoId: v.id("clerkInfo"),
      userId: v.id("users"),
      role: roleValidator,
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const clerkInfo = await ctx.table("clerkInfo").get("by_clerkId", identity.subject);
    if (!clerkInfo) return null;

    const user = await ctx.table("users").get("clerkInfoId", clerkInfo._id);
    if (!user) return null;

    return {
      clerkInfoId: clerkInfo._id,
      userId: user._id,
      role: user.role,
    };
  },
});

/**
 * Get current user or throw if not authenticated
 */
export const requireAuth = internalQuery({
  args: {},
  returns: v.object({
    clerkInfoId: v.id("clerkInfo"),
    userId: v.id("users"),
    role: roleValidator,
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkInfo = await ctx.table("clerkInfo").get("by_clerkId", identity.subject);
    if (!clerkInfo) throw new Error("Not authenticated");

    const user = await ctx.table("users").get("clerkInfoId", clerkInfo._id);
    if (!user) throw new Error("Not authenticated");

    return {
      clerkInfoId: clerkInfo._id,
      userId: user._id,
      role: user.role,
    };
  },
});

/**
 * Get current user or throw if not admin/owner
 */
export const requireAdmin = internalQuery({
  args: {},
  returns: v.object({
    clerkInfoId: v.id("clerkInfo"),
    userId: v.id("users"),
    role: roleValidator,
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkInfo = await ctx.table("clerkInfo").get("by_clerkId", identity.subject);
    if (!clerkInfo) throw new Error("Not authenticated");

    const user = await ctx.table("users").get("clerkInfoId", clerkInfo._id);
    if (!user) throw new Error("Not authenticated");

    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("Not authorized - owner or admin required");
    }

    return {
      clerkInfoId: clerkInfo._id,
      userId: user._id,
      role: user.role,
    };
  },
});

/**
 * Get current user or throw if not owner
 */
export const requireOwner = internalQuery({
  args: {},
  returns: v.object({
    clerkInfoId: v.id("clerkInfo"),
    userId: v.id("users"),
    role: roleValidator,
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkInfo = await ctx.table("clerkInfo").get("by_clerkId", identity.subject);
    if (!clerkInfo) throw new Error("Not authenticated");

    const user = await ctx.table("users").get("clerkInfoId", clerkInfo._id);
    if (!user) throw new Error("Not authenticated");

    if (user.role !== "owner") {
      throw new Error("Not authorized - owner required");
    }

    return {
      clerkInfoId: clerkInfo._id,
      userId: user._id,
      role: user.role,
    };
  },
});
