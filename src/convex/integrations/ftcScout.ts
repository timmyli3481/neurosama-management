import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { query } from "../functions";

// ========================================
// Team Info
// ========================================

export const saveTeamInfo = internalMutation({
  args: {
    teamNumber: v.number(),
    data: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("teamInfo"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamInfo")
      .withIndex("by_teamNumber", (q) => q.eq("teamNumber", args.teamNumber))
      .first();

    let id: Id<"teamInfo">;
    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data });
      id = existing._id;
    } else {
      id = await ctx.db.insert("teamInfo", {
        teamNumber: args.teamNumber,
        data: args.data,
      });
    }
    return { success: true, id };
  },
});

export const getTeamInfo = internalQuery({
  args: {
    teamNumber: v.number(),
  },
  returns: v.union(
    v.object({
      id: v.id("teamInfo"),
      teamNumber: v.number(),
      data: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamInfo")
      .withIndex("by_teamNumber", (q) => q.eq("teamNumber", args.teamNumber))
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      teamNumber: existing.teamNumber,
      data: existing.data,
    };
  },
});

// ========================================
// Official Events
// ========================================

export const saveOfficialEvent = internalMutation({
  args: {
    eventCode: v.string(),
    season: v.number(),
    data: v.any(),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("officialEvents"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialEvents")
      .withIndex("by_season_and_eventCode", (q) =>
        q.eq("season", args.season).eq("eventCode", args.eventCode),
      )
      .first();

    let id: Id<"officialEvents">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        startDate: args.startDate,
        endDate: args.endDate,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("officialEvents", {
        eventCode: args.eventCode,
        season: args.season,
        data: args.data,
        startDate: args.startDate,
        endDate: args.endDate,
      });
    }
    return { success: true, id };
  },
});

export const getOfficialEvent = internalQuery({
  args: {
    eventCode: v.string(),
    season: v.number(),
  },
  returns: v.union(
    v.object({
      id: v.id("officialEvents"),
      eventCode: v.string(),
      season: v.number(),
      data: v.any(),
      startDate: v.number(),
      endDate: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialEvents")
      .withIndex("by_season_and_eventCode", (q) =>
        q.eq("season", args.season).eq("eventCode", args.eventCode),
      )
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      eventCode: existing.eventCode,
      season: existing.season,
      data: existing.data,
      startDate: existing.startDate,
      endDate: existing.endDate,
    };
  },
});

// ========================================
// Official Matches
// ========================================

export const saveOfficialMatch = internalMutation({
  args: {
    eventId: v.id("officialEvents"),
    matchId: v.number(),
    teamNumbers: v.array(v.number()),
    data: v.any(),
    startDate: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("officialMatches"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialMatches")
      .withIndex("by_eventId_and_matchId", (q) =>
        q.eq("eventId", args.eventId).eq("matchId", args.matchId),
      )
      .first();

    let id: Id<"officialMatches">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        teamNumbers: args.teamNumbers,
        data: args.data,
        startDate: args.startDate,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("officialMatches", {
        eventId: args.eventId,
        matchId: args.matchId,
        teamNumbers: args.teamNumbers,
        data: args.data,
        startDate: args.startDate,
      });
    }
    return { success: true, id };
  },
});

export const getOfficialMatch = internalQuery({
  args: {
    eventId: v.id("officialEvents"),
    matchId: v.number(),
  },
  returns: v.union(
    v.object({
      id: v.id("officialMatches"),
      eventId: v.id("officialEvents"),
      matchId: v.number(),
      teamNumbers: v.array(v.number()),
      data: v.any(),
      startDate: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialMatches")
      .withIndex("by_eventId_and_matchId", (q) =>
        q.eq("eventId", args.eventId).eq("matchId", args.matchId),
      )
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      eventId: existing.eventId,
      matchId: existing.matchId,
      teamNumbers: existing.teamNumbers,
      data: existing.data,
      startDate: existing.startDate,
    };
  },
});

// ========================================
// Official Awards
// ========================================

export const saveOfficialAward = internalMutation({
  args: {
    eventId: v.id("officialEvents"),
    awardType: v.string(),
    placement: v.number(),
    teamNumber: v.optional(v.number()),
    data: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("officialAwards"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialAwards")
      .withIndex("by_eventId_and_awardType_and_placement", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("awardType", args.awardType)
          .eq("placement", args.placement),
      )
      .first();

    let id: Id<"officialAwards">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        teamNumber: args.teamNumber,
        data: args.data,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("officialAwards", {
        eventId: args.eventId,
        awardType: args.awardType,
        placement: args.placement,
        teamNumber: args.teamNumber,
        data: args.data,
      });
    }
    return { success: true, id };
  },
});

export const getOfficialAward = internalQuery({
  args: {
    eventId: v.id("officialEvents"),
    awardType: v.string(),
    placement: v.number(),
  },
  returns: v.union(
    v.object({
      id: v.id("officialAwards"),
      eventId: v.id("officialEvents"),
      awardType: v.string(),
      placement: v.number(),
      teamNumber: v.optional(v.number()),
      data: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialAwards")
      .withIndex("by_eventId_and_awardType_and_placement", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("awardType", args.awardType)
          .eq("placement", args.placement),
      )
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      eventId: existing.eventId,
      awardType: existing.awardType,
      placement: existing.placement,
      teamNumber: existing.teamNumber,
      data: existing.data,
    };
  },
});

// ========================================
// Team Events (Junction)
// ========================================

export const clearTeamEvents = internalMutation({
  args: {
    teamInfoId: v.id("teamInfo"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("teamEvents")
      .withIndex("teamInfoId", (q) => q.eq("teamInfoId", args.teamInfoId))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }
    return true;
  },
});

export const saveTeamEvent = internalMutation({
  args: {
    teamInfoId: v.id("teamInfo"),
    eventId: v.id("officialEvents"),
    startDate: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("teamEvents"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamEvents")
      .withIndex("by_teamInfoId_and_eventId", (q) =>
        q.eq("teamInfoId", args.teamInfoId).eq("eventId", args.eventId),
      )
      .first();

    let id: Id<"teamEvents">;
    if (existing) {
      await ctx.db.patch(existing._id, { startDate: args.startDate });
      id = existing._id;
    } else {
      id = await ctx.db.insert("teamEvents", {
        teamInfoId: args.teamInfoId,
        eventId: args.eventId,
        startDate: args.startDate,
      });
    }
    return { success: true, id };
  },
});

export const getTeamEvent = internalQuery({
  args: {
    teamInfoId: v.id("teamInfo"),
    eventId: v.id("officialEvents"),
  },
  returns: v.union(
    v.object({
      id: v.id("teamEvents"),
      teamInfoId: v.id("teamInfo"),
      eventId: v.id("officialEvents"),
      startDate: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamEvents")
      .withIndex("by_teamInfoId_and_eventId", (q) =>
        q.eq("teamInfoId", args.teamInfoId).eq("eventId", args.eventId),
      )
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      teamInfoId: existing.teamInfoId,
      eventId: existing.eventId,
      startDate: existing.startDate,
    };
  },
});

// ========================================
// Team Matches (Junction)
// ========================================

export const clearTeamMatches = internalMutation({
  args: {
    teamInfoId: v.id("teamInfo"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("teamMatches")
      .withIndex("teamInfoId", (q) => q.eq("teamInfoId", args.teamInfoId))
      .collect();

    for (const match of matches) {
      await ctx.db.delete(match._id);
    }
    return true;
  },
});

export const saveTeamMatch = internalMutation({
  args: {
    teamInfoId: v.id("teamInfo"),
    teamEventId: v.id("teamEvents"),
    matchId: v.id("officialMatches"),
    startDate: v.optional(v.number()),
    data: v.any(), // TeamMatchParticipationCore fragment data
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("teamMatches"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamMatches")
      .withIndex("matchId", (q) => q.eq("matchId", args.matchId))
      .first();

    let id: Id<"teamMatches">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        startDate: args.startDate,
        data: args.data,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("teamMatches", {
        teamInfoId: args.teamInfoId,
        teamEventId: args.teamEventId,
        matchId: args.matchId,
        startDate: args.startDate,
        data: args.data,
      });
    }
    return { success: true, id };
  },
});

export const getTeamMatch = internalQuery({
  args: {
    matchId: v.id("officialMatches"),
  },
  returns: v.union(
    v.object({
      id: v.id("teamMatches"),
      teamInfoId: v.id("teamInfo"),
      teamEventId: v.id("teamEvents"),
      matchId: v.id("officialMatches"),
      startDate: v.optional(v.number()),
      data: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamMatches")
      .withIndex("matchId", (q) => q.eq("matchId", args.matchId))
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      teamInfoId: existing.teamInfoId,
      teamEventId: existing.teamEventId,
      matchId: existing.matchId,
      startDate: existing.startDate,
      data: existing.data,
    };
  },
});

// ========================================
// Team Awards (Junction)
// ========================================

export const clearTeamAwards = internalMutation({
  args: {
    teamInfoId: v.id("teamInfo"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const awards = await ctx.db
      .query("teamAwards")
      .withIndex("teamInfoId", (q) => q.eq("teamInfoId", args.teamInfoId))
      .collect();

    for (const award of awards) {
      await ctx.db.delete(award._id);
    }
    return true;
  },
});

export const saveTeamAward = internalMutation({
  args: {
    teamInfoId: v.id("teamInfo"),
    teamEventId: v.id("teamEvents"),
    awardId: v.id("officialAwards"),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.id("teamAwards"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamAwards")
      .withIndex("awardId", (q) => q.eq("awardId", args.awardId))
      .first();

    let id: Id<"teamAwards">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        teamInfoId: args.teamInfoId,
        teamEventId: args.teamEventId,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("teamAwards", {
        teamInfoId: args.teamInfoId,
        teamEventId: args.teamEventId,
        awardId: args.awardId,
      });
    }
    return { success: true, id };
  },
});

export const getTeamAward = internalQuery({
  args: {
    awardId: v.id("officialAwards"),
  },
  returns: v.union(
    v.object({
      id: v.id("teamAwards"),
      teamInfoId: v.id("teamInfo"),
      teamEventId: v.id("teamEvents"),
      awardId: v.id("officialAwards"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamAwards")
      .withIndex("awardId", (q) => q.eq("awardId", args.awardId))
      .first();

    if (!existing) return null;
    return {
      id: existing._id,
      teamInfoId: existing.teamInfoId,
      teamEventId: existing.teamEventId,
      awardId: existing.awardId,
    };
  },
});

export const getEvent = query({
  args: {
    eventCode: v.string(),
  },
  returns: v.union(
    v.object({
      id: v.id("officialEvents"),
      data: v.any(),
      matches: v.array(
        v.object({
          id: v.id("officialMatches"),
          data: v.any(),
        }),
      ),
      awards: v.array(
        v.object({
          id: v.id("officialAwards"),
          data: v.any(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx
      .table("officialEvents")
      .filter((q) => q.eq(q.field("eventCode"), args.eventCode))
      .first();
    if (!existing) return null;

    const matches = await existing.edge("officialMatches");
    const awards = await existing.edge("officialAwards");
    return {
      id: existing._id,
      data: existing.data,
      matches: matches.map((match) => ({
        id: match._id,
        data: match.data,
      })),
      awards: awards.map((award) => ({
        id: award._id,
        data: award.data,
      })),
    };
  },
});

// List all official events (for events page)
export const listEvents = query({
  args: {
    season: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("officialEvents"),
      eventCode: v.string(),
      season: v.number(),
      startDate: v.number(),
      endDate: v.number(),
      data: v.any(),
    }),
  ),
  handler: async (ctx, args) => {
    let events;
    if (args.season) {
      events = await ctx
        .table("officialEvents")
        .filter((q) => q.eq(q.field("season"), args.season))
        .order("desc");
    } else {
      events = await ctx.table("officialEvents").order("desc");
    }

    return events.map((event) => ({
      id: event._id,
      eventCode: event.eventCode,
      season: event.season,
      startDate: event.startDate,
      endDate: event.endDate,
      data: event.data,
    }));
  },
});

// Get team info by team number (public query)
export const getTeamByNumber = query({
  args: {
    teamNumber: v.number(),
  },
  returns: v.union(
    v.object({
      id: v.id("teamInfo"),
      teamNumber: v.number(),
      data: v.any(),
      events: v.array(
        v.object({
          id: v.id("teamEvents"),
          eventId: v.id("officialEvents"),
          eventCode: v.string(),
          eventData: v.any(),
          startDate: v.number(),
        }),
      ),
      matches: v.array(
        v.object({
          id: v.id("teamMatches"),
          matchId: v.id("officialMatches"),
          matchData: v.any(),
          startDate: v.optional(v.number()),
          participation: v.any(),
        }),
      ),
      awards: v.array(
        v.object({
          id: v.id("teamAwards"),
          awardId: v.id("officialAwards"),
          awardData: v.any(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const teamInfo = await ctx
      .table("teamInfo")
      .filter((q) => q.eq(q.field("teamNumber"), args.teamNumber))
      .first();

    if (!teamInfo) return null;

    // Get team events with event details
    const teamEvents = await teamInfo.edge("teamEvents");
    const eventsWithData = await Promise.all(
      teamEvents.map(async (te) => {
        const event = await te.edge("event");
        return {
          id: te._id,
          eventId: te.eventId,
          eventCode: event.eventCode,
          eventData: event.data,
          startDate: te.startDate,
        };
      }),
    );

    // Get team matches with match details
    const teamMatches = await teamInfo.edge("teamMatches");
    const matchesWithData = await Promise.all(
      teamMatches.map(async (tm) => {
        const match = await tm.edge("match");
        return {
          id: tm._id,
          matchId: tm.matchId,
          matchData: match.data,
          startDate: tm.startDate,
          participation: tm.data,
        };
      }),
    );

    // Get team awards with award details
    const teamAwards = await teamInfo.edge("teamAwards");
    const awardsWithData = await Promise.all(
      teamAwards.map(async (ta) => {
        const award = await ta.edge("award");
        return {
          id: ta._id,
          awardId: ta.awardId,
          awardData: award.data,
        };
      }),
    );

    return {
      id: teamInfo._id,
      teamNumber: teamInfo.teamNumber,
      data: teamInfo.data,
      events: eventsWithData.sort((a, b) => b.startDate - a.startDate),
      matches: matchesWithData.sort((a, b) => (b.startDate || 0) - (a.startDate || 0)),
      awards: awardsWithData,
    };
  },
});

// Check if event exists in database
export const eventExists = query({
  args: {
    eventCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const event = await ctx
      .table("officialEvents")
      .filter((q) => q.eq(q.field("eventCode"), args.eventCode))
      .first();
    return event !== null;
  },
});

// Check if team exists in database
export const teamExists = query({
  args: {
    teamNumber: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const team = await ctx
      .table("teamInfo")
      .filter((q) => q.eq(q.field("teamNumber"), args.teamNumber))
      .first();
    return team !== null;
  },
});

// Get current team's events (based on ftcTeamNumber in settings)
export const getCurrentTeamEvents = query({
  args: {},
  returns: v.union(
    v.object({
      teamNumber: v.number(),
      teamName: v.union(v.string(), v.null()),
      events: v.array(
        v.object({
          id: v.id("teamEvents"),
          eventId: v.id("officialEvents"),
          eventCode: v.string(),
          season: v.number(),
          startDate: v.number(),
          endDate: v.number(),
          data: v.any(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    // Get the configured team number from settings
    const settings = await ctx.table("settings").first();
    const teamNumber = settings?.ftcTeamNumber;
    
    if (!teamNumber) return null;

    // Find the team info
    const teamInfo = await ctx
      .table("teamInfo")
      .filter((q) => q.eq(q.field("teamNumber"), teamNumber))
      .first();

    if (!teamInfo) return null;

    // Get team events with event details
    const teamEvents = await teamInfo.edge("teamEvents");
    const eventsWithData = await Promise.all(
      teamEvents.map(async (te) => {
        const event = await te.edge("event");
        return {
          id: te._id,
          eventId: te.eventId,
          eventCode: event.eventCode,
          season: event.season,
          startDate: event.startDate,
          endDate: event.endDate,
          data: event.data,
        };
      }),
    );

    // Sort by start date (most recent first)
    eventsWithData.sort((a, b) => b.startDate - a.startDate);

    return {
      teamNumber,
      teamName: teamInfo.data?.name ?? null,
      events: eventsWithData,
    };
  },
});
