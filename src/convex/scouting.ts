import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// List scouted teams
export const listScoutedTeams = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("scoutedTeams")
      .order("desc")
      .paginate(args.paginationOpts);
    
    // Enhance with scouting report count and average rating
    const enhancedPage = [];
    for (const team of results.page) {
      const reports = await ctx.db
        .query("scoutingReports")
        .withIndex("by_scoutedTeamId", (q) => q.eq("scoutedTeamId", team._id))
        .collect();
      
      const avgRating = reports.length > 0
        ? Math.round(
            reports.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) / reports.length
          )
        : 0;
      
      enhancedPage.push({
        ...team,
        reportCount: reports.length,
        avgRating,
      });
    }
    
    return {
      ...results,
      page: enhancedPage,
    };
  },
});

// Get team by number
export const getTeamByNumber = query({
  args: {
    teamNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("scoutedTeams")
      .withIndex("by_teamNumber", (q) => q.eq("teamNumber", args.teamNumber))
      .unique();
    
    if (!team) return null;
    
    // Get all reports for this team
    const reports = await ctx.db
      .query("scoutingReports")
      .withIndex("by_scoutedTeamId", (q) => q.eq("scoutedTeamId", team._id))
      .order("desc")
      .collect();
    
    // Enhance reports with scout names
    const enhancedReports = [];
    for (const report of reports) {
      const scout = await ctx.db.get(report.scoutedBy);
      let scoutName = "Unknown";
      if (scout) {
        const clerkInfo = await ctx.db.get(scout.clerkInfoId);
        if (clerkInfo) {
          scoutName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      
      enhancedReports.push({
        ...report,
        scoutName,
      });
    }
    
    return {
      ...team,
      reports: enhancedReports,
    };
  },
});

// Get scouted team by ID
export const getScoutedTeam = query({
  args: {
    teamId: v.id("scoutedTeams"),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;
    
    // Get all reports for this team
    const reports = await ctx.db
      .query("scoutingReports")
      .withIndex("by_scoutedTeamId", (q) => q.eq("scoutedTeamId", args.teamId))
      .order("desc")
      .collect();
    
    // Enhance reports with scout names and competition info
    const enhancedReports = [];
    for (const report of reports) {
      const scout = await ctx.db.get(report.scoutedBy);
      let scoutName = "Unknown";
      if (scout) {
        const clerkInfo = await ctx.db.get(scout.clerkInfoId);
        if (clerkInfo) {
          scoutName = `${clerkInfo.firstName ?? ""} ${clerkInfo.lastName ?? ""}`.trim() || clerkInfo.email || "Unknown";
        }
      }
      
      let competitionName = null;
      if (report.competitionId) {
        const competition = await ctx.db.get(report.competitionId);
        if (competition) {
          competitionName = competition.name;
        }
      }
      
      enhancedReports.push({
        ...report,
        scoutName,
        competitionName,
      });
    }
    
    // Calculate aggregate stats
    const avgRatings = {
      speed: 0,
      defense: 0,
      reliability: 0,
      driverSkill: 0,
      overall: 0,
    };
    
    let ratingCount = 0;
    for (const report of reports) {
      if (report.overallRating) {
        avgRatings.speed += report.speedRating ?? 0;
        avgRatings.defense += report.defenseRating ?? 0;
        avgRatings.reliability += report.reliabilityRating ?? 0;
        avgRatings.driverSkill += report.driverSkillRating ?? 0;
        avgRatings.overall += report.overallRating ?? 0;
        ratingCount++;
      }
    }
    
    if (ratingCount > 0) {
      avgRatings.speed = Math.round(avgRatings.speed / ratingCount * 10) / 10;
      avgRatings.defense = Math.round(avgRatings.defense / ratingCount * 10) / 10;
      avgRatings.reliability = Math.round(avgRatings.reliability / ratingCount * 10) / 10;
      avgRatings.driverSkill = Math.round(avgRatings.driverSkill / ratingCount * 10) / 10;
      avgRatings.overall = Math.round(avgRatings.overall / ratingCount * 10) / 10;
    }
    
    return {
      ...team,
      reports: enhancedReports,
      avgRatings,
    };
  },
});

// Create or update scouted team
export const upsertScoutedTeam = mutation({
  args: {
    teamNumber: v.string(),
    teamName: v.optional(v.string()),
    school: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("scoutedTeams"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Check if team already exists
    const existing = await ctx.db
      .query("scoutedTeams")
      .withIndex("by_teamNumber", (q) => q.eq("teamNumber", args.teamNumber))
      .unique();
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        teamName: args.teamName,
        school: args.school,
        location: args.location,
        notes: args.notes,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    
    // Create new
    return await ctx.db.insert("scoutedTeams", {
      teamNumber: args.teamNumber,
      teamName: args.teamName,
      school: args.school,
      location: args.location,
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Add scouting report
export const addScoutingReport = mutation({
  args: {
    scoutedTeamId: v.id("scoutedTeams"),
    competitionId: v.optional(v.id("competitions")),
    matchNumber: v.optional(v.number()),
    drivetrainType: v.optional(v.string()),
    autoCapabilities: v.optional(v.string()),
    teleopCapabilities: v.optional(v.string()),
    endgameCapabilities: v.optional(v.string()),
    speedRating: v.optional(v.number()),
    defenseRating: v.optional(v.number()),
    reliabilityRating: v.optional(v.number()),
    driverSkillRating: v.optional(v.number()),
    strengths: v.optional(v.string()),
    weaknesses: v.optional(v.string()),
    allianceNotes: v.optional(v.string()),
    overallRating: v.optional(v.number()),
  },
  returns: v.id("scoutingReports"),
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
    
    const team = await ctx.db.get(args.scoutedTeamId);
    if (!team) throw new Error("Scouted team not found");
    
    const now = Date.now();
    const reportId = await ctx.db.insert("scoutingReports", {
      ...args,
      scoutedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    
    // Log activity
    await ctx.scheduler.runAfter(0, internal.activity.logActivity, {
      type: "scouting_report" as const,
      title: `Scouting report for Team ${team.teamNumber}`,
      description: args.overallRating ? `Rating: ${args.overallRating}/10` : undefined,
      userId: user._id,
      entityType: "scouting" as const,
      entityId: reportId,
    });
    
    return reportId;
  },
});

// Update scouting report
export const updateScoutingReport = mutation({
  args: {
    reportId: v.id("scoutingReports"),
    drivetrainType: v.optional(v.string()),
    autoCapabilities: v.optional(v.string()),
    teleopCapabilities: v.optional(v.string()),
    endgameCapabilities: v.optional(v.string()),
    speedRating: v.optional(v.number()),
    defenseRating: v.optional(v.number()),
    reliabilityRating: v.optional(v.number()),
    driverSkillRating: v.optional(v.number()),
    strengths: v.optional(v.string()),
    weaknesses: v.optional(v.string()),
    allianceNotes: v.optional(v.string()),
    overallRating: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { reportId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await ctx.db.patch(reportId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});

// Delete scouting report
export const deleteScoutingReport = mutation({
  args: {
    reportId: v.id("scoutingReports"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    await ctx.db.delete(args.reportId);
    return null;
  },
});

// Get top rated teams for alliance selection
export const getTopRatedTeams = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("scoutedTeams"),
      teamNumber: v.string(),
      teamName: v.union(v.string(), v.null()),
      avgRating: v.number(),
      reportCount: v.number(),
      strengths: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    const teams = await ctx.db.query("scoutedTeams").collect();
    
    const teamsWithRatings = [];
    for (const team of teams) {
      const reports = await ctx.db
        .query("scoutingReports")
        .withIndex("by_scoutedTeamId", (q) => q.eq("scoutedTeamId", team._id))
        .collect();
      
      if (reports.length === 0) continue;
      
      const avgRating = Math.round(
        reports.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) / reports.length * 10
      ) / 10;
      
      // Get most recent strengths
      const latestReport = reports.sort((a, b) => b.createdAt - a.createdAt)[0];
      
      teamsWithRatings.push({
        _id: team._id,
        teamNumber: team.teamNumber,
        teamName: team.teamName ?? null,
        avgRating,
        reportCount: reports.length,
        strengths: latestReport?.strengths ?? null,
      });
    }
    
    // Sort by rating and take top N
    teamsWithRatings.sort((a, b) => b.avgRating - a.avgRating);
    
    return teamsWithRatings.slice(0, limit);
  },
});

// Get scouting stats
export const getScoutingStats = query({
  args: {},
  returns: v.object({
    totalTeamsScouted: v.number(),
    totalReports: v.number(),
    reportsThisWeek: v.number(),
  }),
  handler: async (ctx) => {
    const teams = await ctx.db.query("scoutedTeams").collect();
    const reports = await ctx.db.query("scoutingReports").collect();
    
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    return {
      totalTeamsScouted: teams.length,
      totalReports: reports.length,
      reportsThisWeek: reports.filter((r) => r.createdAt >= weekAgo).length,
    };
  },
});
