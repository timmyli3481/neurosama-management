"use node";

import { createClerkClient } from "@clerk/backend";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create Clerk client instance
 */
function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY not configured");
  }
  return createClerkClient({ secretKey });
}

/**
 * Clerk user info validator
 */
const clerkUserInfoValidator = v.object({
  id: v.string(),
  firstName: v.union(v.string(), v.null()),
  lastName: v.union(v.string(), v.null()),
  emailAddress: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  createdAt: v.number(),
  lastSignInAt: v.union(v.number(), v.null()),
});

/**
 * Get user info from Clerk using getUserList with userId filtering
 * Supports pagination for large sets of users
 */
export const getClerkUsers = internalAction({
  args: {
    userIds: v.array(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    data: v.array(clerkUserInfoValidator),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.userIds.length === 0) {
      return { data: [], totalCount: 0 };
    }

    try {
      const clerkClient = getClerkClient();

      const { data: users, totalCount } = await clerkClient.users.getUserList({
        userId: args.userIds,
        limit: args.limit,
        offset: args.offset,
      });

      // Map Clerk SDK response to our format
      const data = users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddress: user.emailAddresses?.[0]?.emailAddress ?? null,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      }));

      return { data, totalCount };
    } catch (error) {
      console.error(`Error getting Clerk users:`, error);
      return { data: [], totalCount: 0 };
    }
  },
});

/**
 * Delete a user from Clerk
 */
export const deleteClerkUser = internalAction({
  args: {
    clerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const clerkClient = getClerkClient();
      await clerkClient.users.deleteUser(args.clerkId);
    } catch (error) {
      console.error(`Error deleting Clerk user ${args.clerkId}:`, error);
    }

    return null;
  },
});

/**
 * Revoke a Clerk invite
 */
export const revokeClerkInvite = internalAction({
  args: {
    clerkInviteId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const clerkClient = getClerkClient();
      await clerkClient.invitations.revokeInvitation(args.clerkInviteId);
    } catch (error) {
      console.error(`Error revoking Clerk invite ${args.clerkInviteId}:`, error);
    }

    return null;
  },
});

/**
 * Create a Clerk invite and return the invite ID
 */
export const createClerkInvite = internalAction({
  args: {
    emailAddress: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    try {
      const clerkClient = getClerkClient();
      const invite = await clerkClient.invitations.createInvitation({
        emailAddress: args.emailAddress,
      });
      return invite.id;
    } catch (error) {
      console.error(`Error creating Clerk invite:`, error);
      return null;
    }
  },
});
