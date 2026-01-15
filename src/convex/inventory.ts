import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// Category validator
const categoryValidator = v.union(
  v.literal("motors"),
  v.literal("sensors"),
  v.literal("structural"),
  v.literal("electronics"),
  v.literal("hardware"),
  v.literal("3d_prints"),
  v.literal("pneumatics"),
  v.literal("wheels"),
  v.literal("other")
);

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

const requestStatusValidator = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("ordered"),
  v.literal("received"),
  v.literal("cancelled")
);

const actionValidator = v.union(
  v.literal("used"),
  v.literal("restocked"),
  v.literal("returned"),
  v.literal("damaged"),
  v.literal("ordered")
);

// List inventory items
export const listParts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(categoryValidator),
    lowStockOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query;
    
    if (args.category) {
      query = ctx.db
        .query("partsInventory")
        .withIndex("by_category", (q) => q.eq("category", args.category!));
    } else {
      query = ctx.db.query("partsInventory");
    }
    
    const results = await query.order("desc").paginate(args.paginationOpts);
    
    // Filter low stock if needed
    if (args.lowStockOnly) {
      return {
        ...results,
        page: results.page.filter(
          (p) => p.minQuantity !== undefined && p.quantity <= p.minQuantity
        ),
      };
    }
    
    return results;
  },
});

// Get part by ID
export const getPart = query({
  args: {
    partId: v.id("partsInventory"),
  },
  handler: async (ctx, args) => {
    const part = await ctx.db.get(args.partId);
    if (!part) return null;
    
    // Get usage logs
    const logs = await ctx.db
      .query("partsLog")
      .withIndex("by_partId", (q) => q.eq("partId", args.partId))
      .order("desc")
      .take(20);
    
    // Enhance logs with user names
    const enhancedLogs = [];
    for (const log of logs) {
      const user = await ctx.db.get(log.createdBy);
      let userName = "Unknown";
      if (user) {
        const clerkInfo = await ctx.db.get(user.clerkInfoId);
        if (clerkInfo) {
          userName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      enhancedLogs.push({
        ...log,
        userName,
      });
    }
    
    // Get subsystem if linked
    let subsystem = null;
    if (part.subsystemId) {
      subsystem = await ctx.db.get(part.subsystemId);
    }
    
    return {
      ...part,
      logs: enhancedLogs,
      subsystem,
      isLowStock: part.minQuantity !== undefined && part.quantity <= part.minQuantity,
    };
  },
});

// Create part
export const createPart = mutation({
  args: {
    name: v.string(),
    partNumber: v.optional(v.string()),
    category: categoryValidator,
    quantity: v.number(),
    minQuantity: v.optional(v.number()),
    location: v.optional(v.string()),
    supplier: v.optional(v.string()),
    supplierUrl: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    notes: v.optional(v.string()),
    subsystemId: v.optional(v.id("robotSubsystems")),
  },
  returns: v.id("partsInventory"),
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
    const partId = await ctx.db.insert("partsInventory", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "part_added" as const,
      title: `Part added: ${args.name}`,
      description: `Quantity: ${args.quantity}`,
      userId: user._id,
      entityType: "part" as const,
      entityId: partId,
    });
    
    return partId;
  },
});

// Update part
export const updatePart = mutation({
  args: {
    partId: v.id("partsInventory"),
    name: v.optional(v.string()),
    partNumber: v.optional(v.string()),
    category: v.optional(categoryValidator),
    quantity: v.optional(v.number()),
    minQuantity: v.optional(v.number()),
    location: v.optional(v.string()),
    supplier: v.optional(v.string()),
    supplierUrl: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    notes: v.optional(v.string()),
    subsystemId: v.optional(v.id("robotSubsystems")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { partId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(partId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Delete part
export const deletePart = mutation({
  args: {
    partId: v.id("partsInventory"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Delete associated logs
    const logs = await ctx.db
      .query("partsLog")
      .withIndex("by_partId", (q) => q.eq("partId", args.partId))
      .collect();
    
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    
    await ctx.db.delete(args.partId);
    return null;
  },
});

// Log part usage
export const logPartAction = mutation({
  args: {
    partId: v.id("partsInventory"),
    action: actionValidator,
    quantity: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("partsLog"),
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
    
    const part = await ctx.db.get(args.partId);
    if (!part) throw new Error("Part not found");
    
    // Update quantity based on action
    let newQuantity = part.quantity;
    switch (args.action) {
      case "used":
      case "damaged":
        newQuantity = Math.max(0, part.quantity - args.quantity);
        break;
      case "restocked":
      case "returned":
        newQuantity = part.quantity + args.quantity;
        break;
      case "ordered":
        // Don't change quantity for ordered
        break;
    }
    
    await ctx.db.patch(args.partId, {
      quantity: newQuantity,
      updatedAt: Date.now(),
    });
    
    return await ctx.db.insert("partsLog", {
      partId: args.partId,
      action: args.action,
      quantity: args.quantity,
      notes: args.notes,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// Create part request
export const createPartRequest = mutation({
  args: {
    name: v.string(),
    partNumber: v.optional(v.string()),
    category: categoryValidator,
    quantity: v.number(),
    priority: priorityValidator,
    estimatedCost: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierUrl: v.optional(v.string()),
    reason: v.optional(v.string()),
    subsystemId: v.optional(v.id("robotSubsystems")),
  },
  returns: v.id("partRequests"),
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
    return await ctx.db.insert("partRequests", {
      ...args,
      status: "requested",
      requestedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update part request status
export const updatePartRequestStatus = mutation({
  args: {
    requestId: v.id("partRequests"),
    status: requestStatusValidator,
  },
  returns: v.null(),
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
    
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    
    if (args.status === "approved") {
      updates.approvedBy = user._id;
    }
    
    await ctx.db.patch(args.requestId, updates);
    return null;
  },
});

// List part requests
export const listPartRequests = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(requestStatusValidator),
  },
  handler: async (ctx, args) => {
    let query;
    
    if (args.status) {
      query = ctx.db
        .query("partRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      query = ctx.db.query("partRequests");
    }
    
    const results = await query.order("desc").paginate(args.paginationOpts);
    
    // Enhance with user names
    const enhancedPage = [];
    for (const request of results.page) {
      const requestedByUser = await ctx.db.get(request.requestedBy);
      let requestedByName = "Unknown";
      if (requestedByUser) {
        const clerkInfo = await ctx.db.get(requestedByUser.clerkInfoId);
        if (clerkInfo) {
          requestedByName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      
      let approvedByName = null;
      if (request.approvedBy) {
        const approvedByUser = await ctx.db.get(request.approvedBy);
        if (approvedByUser) {
          const clerkInfo = await ctx.db.get(approvedByUser.clerkInfoId);
          if (clerkInfo) {
            approvedByName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
          }
        }
      }
      
      enhancedPage.push({
        ...request,
        requestedByName,
        approvedByName,
      });
    }
    
    return {
      ...results,
      page: enhancedPage,
    };
  },
});

// Get inventory stats
export const getInventoryStats = query({
  args: {},
  returns: v.object({
    totalParts: v.number(),
    totalItems: v.number(),
    lowStockCount: v.number(),
    totalValue: v.number(),
    pendingRequests: v.number(),
    byCategory: v.record(v.string(), v.number()),
  }),
  handler: async (ctx) => {
    const parts = await ctx.db.query("partsInventory").collect();
    const requests = await ctx.db.query("partRequests").collect();
    
    const lowStockCount = parts.filter(
      (p) => p.minQuantity !== undefined && p.quantity <= p.minQuantity
    ).length;
    
    const totalValue = parts.reduce(
      (sum, p) => sum + (p.unitCost ?? 0) * p.quantity,
      0
    );
    
    const pendingRequests = requests.filter(
      (r) => r.status === "requested" || r.status === "approved" || r.status === "ordered"
    ).length;
    
    const byCategory: Record<string, number> = {
      motors: parts.filter((p) => p.category === "motors").length,
      sensors: parts.filter((p) => p.category === "sensors").length,
      structural: parts.filter((p) => p.category === "structural").length,
      electronics: parts.filter((p) => p.category === "electronics").length,
      hardware: parts.filter((p) => p.category === "hardware").length,
      prints_3d: parts.filter((p) => p.category === "3d_prints").length,
      pneumatics: parts.filter((p) => p.category === "pneumatics").length,
      wheels: parts.filter((p) => p.category === "wheels").length,
      other: parts.filter((p) => p.category === "other").length,
    };
    
    return {
      totalParts: parts.length,
      totalItems: parts.reduce((sum, p) => sum + p.quantity, 0),
      lowStockCount,
      totalValue: Math.round(totalValue * 100) / 100,
      pendingRequests,
      byCategory,
    };
  },
});

// Get low stock items
export const getLowStockItems = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("partsInventory"),
      name: v.string(),
      category: categoryValidator,
      quantity: v.number(),
      minQuantity: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    const parts = await ctx.db.query("partsInventory").collect();
    
    const lowStock = parts
      .filter((p) => p.minQuantity !== undefined && p.quantity <= p.minQuantity)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        quantity: p.quantity,
        minQuantity: p.minQuantity!,
      }))
      .sort((a, b) => a.quantity / a.minQuantity - b.quantity / b.minQuantity)
      .slice(0, limit);
    
    return lowStock;
  },
});
