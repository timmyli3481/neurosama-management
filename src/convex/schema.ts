import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Approved users - references clerkInfo table
  users: defineTable({
    clerkInfoId: v.id("clerkInfo"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  }).index("by_clerkInfoId", ["clerkInfoId"]),

  // Waitlist - users pending approval, references clerkInfo table
  waitlist: defineTable({
    clerkInfoId: v.id("clerkInfo"),
    createdAt: v.number(),
  }).index("by_clerkInfoId", ["clerkInfoId"]),

  // Clerk user info - synced from Clerk webhooks
  clerkInfo: defineTable({
    clerkId: v.string(),
    email: v.union(v.string(), v.null()),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    username: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  // App settings - each setting is a typed boolean field
  settings: defineTable({
    waitlistEnabled: v.boolean(),
  }),

  // Clerk invites tracking - for revocation
  invites: defineTable({
    clerkInviteId: v.string(),
    invitedBy: v.id("users"),
    createdAt: v.number(),
    status: v.union(v.literal("pending"), v.literal("revoked")),
  }).index("by_clerkInviteId", ["clerkInviteId"]),

  // Teams
  teams: defineTable({
    name: v.string(),
    leaderId: v.id("users"),
    createdAt: v.number(),
  }).index("by_leaderId", ["leaderId"]),

  // Team members - junction table
  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    addedAt: v.number(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_userId", ["userId"])
    .index("by_teamId_and_userId", ["teamId", "userId"]),

  // Projects
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Project assignments - can assign to teams or users
  projectAssignments: defineTable({
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
  }).index("by_projectId", ["projectId"]),

  // Tasks
  tasks: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_status", ["status"])
    .index("by_projectId_and_status", ["projectId", "status"]),

  // Task assignments - can assign to teams or users
  taskAssignments: defineTable({
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
  }).index("by_taskId", ["taskId"]),
});
