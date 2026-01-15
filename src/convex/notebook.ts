import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// Category validator
const categoryValidator = v.union(
  v.literal("design"),
  v.literal("build"),
  v.literal("code"),
  v.literal("outreach"),
  v.literal("business"),
  v.literal("team"),
  v.literal("strategy"),
  v.literal("testing")
);

// List notebook entries with pagination
export const listEntries = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, args) => {
    let query;
    
    if (args.category) {
      query = ctx.db
        .query("engineeringNotebook")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc");
    } else {
      query = ctx.db
        .query("engineeringNotebook")
        .withIndex("by_entryDate")
        .order("desc");
    }
    
    const results = await query.paginate(args.paginationOpts);
    
    // Enhance with contributor names
    const enhancedPage = [];
    for (const entry of results.page) {
      const contributorNames = [];
      for (const contributorId of entry.contributors) {
        const user = await ctx.db.get(contributorId);
        if (user) {
          const clerkInfo = await ctx.db.get(user.clerkInfoId);
          if (clerkInfo) {
            contributorNames.push(
              `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown"
            );
          }
        }
      }
      
      // Get author name
      const author = await ctx.db.get(entry.createdBy);
      let authorName = "Unknown";
      if (author) {
        const clerkInfo = await ctx.db.get(author.clerkInfoId);
        if (clerkInfo) {
          authorName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      
      enhancedPage.push({
        ...entry,
        contributorNames,
        authorName,
      });
    }
    
    return {
      ...results,
      page: enhancedPage,
    };
  },
});

// Get entry by ID
export const getEntry = query({
  args: {
    entryId: v.id("engineeringNotebook"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return null;
    
    // Get contributor details
    const contributors = [];
    for (const contributorId of entry.contributors) {
      const user = await ctx.db.get(contributorId);
      if (user) {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        if (clerkInfo) {
          contributors.push({
            _id: user._id,
            name: `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown",
            imageUrl: clerkInfo.imageUrl,
          });
        }
      }
    }
    
    // Get author details
    const author = await ctx.db.get(entry.createdBy);
    let authorInfo = null;
    if (author) {
      const clerkInfo = await ctx.db.get(author.clerkInfoId);
      if (clerkInfo) {
        authorInfo = {
          _id: author._id,
          name: `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown",
          imageUrl: clerkInfo.imageUrl,
        };
      }
    }
    
    // Get subsystem if linked
    let subsystem = null;
    if (entry.subsystemId) {
      subsystem = await ctx.db.get(entry.subsystemId);
    }
    
    // Get competition if linked
    let competition = null;
    if (entry.competitionId) {
      competition = await ctx.db.get(entry.competitionId);
    }
    
    // Get meeting if linked
    let meeting = null;
    if (entry.meetingId) {
      meeting = await ctx.db.get(entry.meetingId);
    }
    
    return {
      ...entry,
      contributors,
      author: authorInfo,
      subsystem,
      competition,
      meeting,
    };
  },
});

// Create notebook entry
export const createEntry = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: categoryValidator,
    entryDate: v.number(),
    contributors: v.array(v.id("users")),
    subsystemId: v.optional(v.id("robotSubsystems")),
    competitionId: v.optional(v.id("competitions")),
    meetingId: v.optional(v.id("meetings")),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id("engineeringNotebook"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const clerkInfo = await ctx.db
      .query("clerkInfo")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!clerkInfo) throw new Error("User not found");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkInfoId", (q) => q.eq("clerkInfoId", clerkInfo._id))
      .unique();
    if (!user) throw new Error("User not approved");
    
    const now = Date.now();
    const entryId = await ctx.db.insert("engineeringNotebook", {
      title: args.title,
      content: args.content,
      category: args.category,
      entryDate: args.entryDate,
      contributors: args.contributors.length > 0 ? args.contributors : [user._id],
      subsystemId: args.subsystemId,
      competitionId: args.competitionId,
      meetingId: args.meetingId,
      tags: args.tags,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "notebook_entry" as const,
      title: `Notebook entry: ${args.title}`,
      description: `Category: ${args.category}`,
      userId: user._id,
      entityType: "notebook" as const,
      entityId: entryId,
    });
    
    return entryId;
  },
});

// Update notebook entry
export const updateEntry = mutation({
  args: {
    entryId: v.id("engineeringNotebook"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(categoryValidator),
    entryDate: v.optional(v.number()),
    contributors: v.optional(v.array(v.id("users"))),
    subsystemId: v.optional(v.id("robotSubsystems")),
    competitionId: v.optional(v.id("competitions")),
    meetingId: v.optional(v.id("meetings")),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { entryId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(entryId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Delete notebook entry
export const deleteEntry = mutation({
  args: {
    entryId: v.id("engineeringNotebook"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    await ctx.db.delete(args.entryId);
    return null;
  },
});

// Get notebook stats
export const getNotebookStats = query({
  args: {},
  returns: v.object({
    totalEntries: v.number(),
    thisWeek: v.number(),
    thisMonth: v.number(),
    byCategory: v.object({
      design: v.number(),
      build: v.number(),
      code: v.number(),
      outreach: v.number(),
      business: v.number(),
      team: v.number(),
      strategy: v.number(),
      testing: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const entries = await ctx.db.query("engineeringNotebook").collect();
    
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    return {
      totalEntries: entries.length,
      thisWeek: entries.filter((e) => e.createdAt >= weekAgo).length,
      thisMonth: entries.filter((e) => e.createdAt >= monthAgo).length,
      byCategory: {
        design: entries.filter((e) => e.category === "design").length,
        build: entries.filter((e) => e.category === "build").length,
        code: entries.filter((e) => e.category === "code").length,
        outreach: entries.filter((e) => e.category === "outreach").length,
        business: entries.filter((e) => e.category === "business").length,
        team: entries.filter((e) => e.category === "team").length,
        strategy: entries.filter((e) => e.category === "strategy").length,
        testing: entries.filter((e) => e.category === "testing").length,
      },
    };
  },
});

// Get recent entries for dashboard
export const getRecentEntries = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("engineeringNotebook"),
      title: v.string(),
      category: categoryValidator,
      entryDate: v.number(),
      authorName: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    
    const entries = await ctx.db
      .query("engineeringNotebook")
      .withIndex("by_entryDate")
      .order("desc")
      .take(limit);
    
    const result = [];
    for (const entry of entries) {
      const author = await ctx.db.get(entry.createdBy);
      let authorName = "Unknown";
      if (author) {
        const clerkInfo = await ctx.db.get(author.clerkInfoId);
        if (clerkInfo) {
          authorName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      
      result.push({
        _id: entry._id,
        title: entry.title,
        category: entry.category,
        entryDate: entry.entryDate,
        authorName,
        createdAt: entry.createdAt,
      });
    }
    
    return result;
  },
});
