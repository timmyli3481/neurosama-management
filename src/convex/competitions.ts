import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// Competition type validator
const competitionTypeValidator = v.union(
  v.literal("scrimmage"),
  v.literal("league_meet"),
  v.literal("qualifier"),
  v.literal("championship"),
  v.literal("worlds")
);

const registrationStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("registered"),
  v.literal("waitlisted"),
  v.literal("confirmed")
);

const matchTypeValidator = v.union(
  v.literal("practice"),
  v.literal("qualification"),
  v.literal("semifinal"),
  v.literal("final")
);

// List all competitions
export const listCompetitions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    upcoming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const results = args.upcoming
      ? await ctx.db
          .query("competitions")
          .withIndex("by_startDate")
          .order("asc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("competitions")
          .withIndex("by_startDate")
          .order("desc")
          .paginate(args.paginationOpts);
    
    if (args.upcoming) {
      return {
        ...results,
        page: results.page.filter((c) => c.startDate >= now),
      };
    }
    
    return results;
  },
});

// Get upcoming competition (next one)
export const getNextCompetition = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("competitions"),
      name: v.string(),
      type: competitionTypeValidator,
      location: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      daysUntil: v.number(),
      registrationStatus: registrationStatusValidator,
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const now = Date.now();
    
    const competitions = await ctx.db
      .query("competitions")
      .withIndex("by_startDate")
      .order("asc")
      .collect();
    
    const upcoming = competitions.find((c) => c.startDate >= now);
    
    if (!upcoming) {
      return null;
    }
    
    const daysUntil = Math.ceil((upcoming.startDate - now) / (1000 * 60 * 60 * 24));
    
    return {
      _id: upcoming._id,
      name: upcoming.name,
      type: upcoming.type,
      location: upcoming.location,
      startDate: upcoming.startDate,
      endDate: upcoming.endDate,
      daysUntil,
      registrationStatus: upcoming.registrationStatus,
    };
  },
});

// Get competition by ID
export const getCompetition = query({
  args: {
    competitionId: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const competition = await ctx.db.get(args.competitionId);
    if (!competition) return null;
    
    // Get matches
    const matches = await ctx.db
      .query("competitionMatches")
      .withIndex("by_competitionId", (q) => q.eq("competitionId", args.competitionId))
      .collect();
    
    // Get awards
    const awards = await ctx.db
      .query("competitionAwards")
      .withIndex("by_competitionId", (q) => q.eq("competitionId", args.competitionId))
      .collect();
    
    // Calculate stats
    const qualMatches = matches.filter((m) => m.matchType === "qualification");
    const wins = qualMatches.filter(
      (m) => m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore > m.opponentScore
    ).length;
    const losses = qualMatches.filter(
      (m) => m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore < m.opponentScore
    ).length;
    const ties = qualMatches.filter(
      (m) => m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore === m.opponentScore
    ).length;
    
    return {
      ...competition,
      matches,
      awards,
      stats: {
        totalMatches: matches.length,
        qualificationRecord: `${wins}-${losses}-${ties}`,
        wins,
        losses,
        ties,
        avgScore: qualMatches.length > 0
          ? Math.round(
              qualMatches.reduce((sum, m) => sum + (m.ourScore ?? 0), 0) / qualMatches.length
            )
          : 0,
      },
    };
  },
});

// Create competition
export const createCompetition = mutation({
  args: {
    name: v.string(),
    type: competitionTypeValidator,
    location: v.string(),
    address: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    registrationDeadline: v.optional(v.number()),
    registrationStatus: registrationStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.id("competitions"),
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
    
    const competitionId = await ctx.db.insert("competitions", {
      ...args,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "competition_result" as const,
      title: `Competition added: ${args.name}`,
      description: `${args.type} at ${args.location}`,
      userId: user._id,
      entityType: "competition" as const,
      entityId: competitionId,
    });
    
    return competitionId;
  },
});

// Update competition
export const updateCompetition = mutation({
  args: {
    competitionId: v.id("competitions"),
    name: v.optional(v.string()),
    type: v.optional(competitionTypeValidator),
    location: v.optional(v.string()),
    address: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    registrationDeadline: v.optional(v.number()),
    registrationStatus: v.optional(registrationStatusValidator),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { competitionId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(competitionId, filteredUpdates);
    return null;
  },
});

// Delete competition
export const deleteCompetition = mutation({
  args: {
    competitionId: v.id("competitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Delete associated matches
    const matches = await ctx.db
      .query("competitionMatches")
      .withIndex("by_competitionId", (q) => q.eq("competitionId", args.competitionId))
      .collect();
    
    for (const match of matches) {
      await ctx.db.delete(match._id);
    }
    
    // Delete associated awards
    const awards = await ctx.db
      .query("competitionAwards")
      .withIndex("by_competitionId", (q) => q.eq("competitionId", args.competitionId))
      .collect();
    
    for (const award of awards) {
      await ctx.db.delete(award._id);
    }
    
    await ctx.db.delete(args.competitionId);
    return null;
  },
});

// Add match result
export const addMatch = mutation({
  args: {
    competitionId: v.id("competitions"),
    matchNumber: v.number(),
    matchType: matchTypeValidator,
    allianceColor: v.union(v.literal("red"), v.literal("blue")),
    alliancePartner: v.optional(v.string()),
    opponents: v.optional(v.array(v.string())),
    ourScore: v.optional(v.number()),
    opponentScore: v.optional(v.number()),
    autoPoints: v.optional(v.number()),
    teleopPoints: v.optional(v.number()),
    endgamePoints: v.optional(v.number()),
    penaltyPoints: v.optional(v.number()),
    notes: v.optional(v.string()),
    scheduledTime: v.optional(v.number()),
  },
  returns: v.id("competitionMatches"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    return await ctx.db.insert("competitionMatches", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update match result
export const updateMatch = mutation({
  args: {
    matchId: v.id("competitionMatches"),
    ourScore: v.optional(v.number()),
    opponentScore: v.optional(v.number()),
    autoPoints: v.optional(v.number()),
    teleopPoints: v.optional(v.number()),
    endgamePoints: v.optional(v.number()),
    penaltyPoints: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { matchId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(matchId, filteredUpdates);
    return null;
  },
});

// Add award
export const addAward = mutation({
  args: {
    competitionId: v.id("competitions"),
    awardName: v.string(),
    placement: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("competitionAwards"),
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
    
    const awardId = await ctx.db.insert("competitionAwards", {
      ...args,
      createdAt: Date.now(),
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "award_won" as const,
      title: `Award won: ${args.awardName}`,
      description: args.placement ? `${args.placement}${getOrdinalSuffix(args.placement)} place` : undefined,
      userId: user._id,
      entityType: "competition" as const,
      entityId: args.competitionId,
    });
    
    return awardId;
  },
});

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Get season stats
export const getSeasonStats = query({
  args: {},
  returns: v.object({
    totalCompetitions: v.number(),
    upcomingCompetitions: v.number(),
    completedCompetitions: v.number(),
    totalMatches: v.number(),
    wins: v.number(),
    losses: v.number(),
    ties: v.number(),
    winRate: v.number(),
    totalAwards: v.number(),
    avgScore: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const competitions = await ctx.db.query("competitions").collect();
    const matches = await ctx.db.query("competitionMatches").collect();
    const awards = await ctx.db.query("competitionAwards").collect();
    
    const qualMatches = matches.filter((m) => m.matchType === "qualification");
    const wins = qualMatches.filter(
      (m) => m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore > m.opponentScore
    ).length;
    const losses = qualMatches.filter(
      (m) => m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore < m.opponentScore
    ).length;
    const ties = qualMatches.filter(
      (m) => m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore === m.opponentScore
    ).length;
    
    const playedMatches = wins + losses + ties;
    
    return {
      totalCompetitions: competitions.length,
      upcomingCompetitions: competitions.filter((c) => c.startDate >= now).length,
      completedCompetitions: competitions.filter((c) => c.endDate < now).length,
      totalMatches: matches.length,
      wins,
      losses,
      ties,
      winRate: playedMatches > 0 ? Math.round((wins / playedMatches) * 100) : 0,
      totalAwards: awards.length,
      avgScore: qualMatches.length > 0
        ? Math.round(qualMatches.reduce((sum, m) => sum + (m.ourScore ?? 0), 0) / qualMatches.length)
        : 0,
    };
  },
});
