import { defineEnt, defineEntSchema, getEntDefinitions } from "convex-ents";
import { v } from "convex/values";
import { defineSchema } from "convex/server";

const schema = defineEntSchema({
  // ========================================
  // USER MANAGEMENT
  // ========================================

  // Clerk user info - synced from Clerk webhooks
  clerkInfo: defineEnt({
    clerkId: v.string(),
    email: v.union(v.string(), v.null()),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    username: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .edges("users", { ref: true })
    .edges("waitlist", { ref: true }),

  // Approved users - references clerkInfo table
  users: defineEnt({
    clerkInfoId: v.id("clerkInfo"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })
    .edge("clerkInfo", { to: "clerkInfo", field: "clerkInfoId" })
    .edges("invites", { ref: "invitedBy" }),

  // Waitlist - users pending approval, references clerkInfo table
  waitlist: defineEnt({
    clerkInfoId: v.id("clerkInfo"),
    createdAt: v.number(),
  }).edge("clerkInfo", { to: "clerkInfo", field: "clerkInfoId" }),

  // App settings - each setting is a typed boolean field
  settings: defineEnt({
    waitlistEnabled: v.boolean(),
    // FTC Scout integration settings
    ftcTeamNumber: v.optional(v.number()), // The team number to fetch data for
  }),

  // Clerk invites tracking - for revocation
  invites: defineEnt({
    clerkInviteId: v.string(),
    invitedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    status: v.union(v.literal("pending"), v.literal("revoked")),
  })
    .index("by_clerkInviteId", ["clerkInviteId"])
    .edge("invitedByUser", { to: "users", field: "invitedBy", optional: true }),

  // ========================================
  // FTC SCOUT DATA
  // ========================================
  // Data is stored from GraphQL fragments defined in src/graphql/ftcScout.graphql
  // Fragment types are generated in src/gql/graphql.ts
  //
  // Data field mapping:
  // - teamInfo.data         → TeamStatsFragmentFragment
  // - officialEvents.data   → EventCoreFragmentFragment (stripped of nested matches/awards)
  // - officialMatches.data  → MatchCoreFragmentFragment (includes teams participation)
  // - officialAwards.data   → AwardFieldsFragment
  // - teamMatches.data      → TeamMatchParticipationCoreFragment (this team's participation only)

  teamInfo: defineEnt({
    teamNumber: v.number(),
    data: v.any(), // TeamStatsFragmentFragment
  })
    .index("by_teamNumber", ["teamNumber"])
    .edges("teamEvents", { ref: "teamInfoId" })
    .edges("teamMatches", { ref: "teamInfoId" })
    .edges("teamAwards", { ref: "teamInfoId" })
    .edges("teamScouting", { ref: "teamInfoId" }),

  officialEvents: defineEnt({
    eventCode: v.string(),
    season: v.number(),
    data: v.any(), // EventCoreFragmentFragment (stripped of nested matches/awards)
    startDate: v.number(),
    endDate: v.number(),
  })
    .index("by_eventCode", ["eventCode"])
    .index("by_startDate", ["startDate"])
    .index("by_season", ["season"])
    .index("by_season_and_eventCode", ["season", "eventCode"])
    .edges("officialMatches", { ref: "eventId" })
    .edges("officialAwards", { ref: "eventId" })
    .edges("teamEvents", { ref: "eventId" })
    .edge("calenderFirstEvent", { to: "calenderFirstEvents", ref: "eventId" }),

  officialMatches: defineEnt({
    eventId: v.id("officialEvents"),
    matchId: v.number(), // The match ID from FTC Scout API
    teamNumbers: v.array(v.number()),
    data: v.any(), // MatchCoreFragmentFragment (includes teams participation)
    startDate: v.optional(v.number()),
  })
    .index("by_eventId_and_matchId", ["eventId", "matchId"])
    .index("by_startDate", ["startDate"])
    .edge("event", { to: "officialEvents", field: "eventId" })
    .edges("teamMatches", { ref: "matchId" }),

  officialAwards: defineEnt({
    eventId: v.id("officialEvents"),
    awardType: v.string(),
    placement: v.number(),
    teamNumber: v.optional(v.number()),
    data: v.any(), // AwardFieldsFragment
  })
    .index("by_teamNumber", ["teamNumber"])
    .index("by_eventId_and_awardType", ["eventId", "awardType"])
    .index("by_eventId_and_awardType_and_placement", [
      "eventId",
      "awardType",
      "placement",
    ])
    .edge("event", { to: "officialEvents", field: "eventId" })
    .edges("teamAwards", { ref: "awardId" }),

  // Junction tables for team-specific relationships
  teamEvents: defineEnt({
    teamInfoId: v.id("teamInfo"),
    eventId: v.id("officialEvents"),
    startDate: v.number(),
  })
    .index("by_startDate", ["startDate"])
    .index("by_teamInfoId_and_eventId", ["teamInfoId", "eventId"])
    .edge("teamInfo", { to: "teamInfo", field: "teamInfoId" })
    .edge("event", { to: "officialEvents", field: "eventId" })
    .edges("teamMatches", { ref: "teamEventId" })
    .edges("teamAwards", { ref: "teamEventId" }),

  // Junction table linking team to matches they participated in
  teamMatches: defineEnt({
    teamInfoId: v.id("teamInfo"),
    teamEventId: v.id("teamEvents"),
    matchId: v.id("officialMatches"),
    startDate: v.optional(v.number()),
    data: v.any(), // TeamMatchParticipationCoreFragment (this team's participation only)
  })
    .index("by_startDate", ["startDate"])
    .edge("teamInfo", { to: "teamInfo", field: "teamInfoId" })
    .edge("teamEvent", { to: "teamEvents", field: "teamEventId" })
    .edge("match", { to: "officialMatches", field: "matchId" }),

  teamAwards: defineEnt({
    teamInfoId: v.id("teamInfo"),
    teamEventId: v.id("teamEvents"),
    awardId: v.id("officialAwards"),
  })
    .edge("teamInfo", { to: "teamInfo", field: "teamInfoId" })
    .edge("teamEvent", { to: "teamEvents", field: "teamEventId" })
    .edge("award", { to: "officialAwards", field: "awardId" }),

  calenderFirstEvents: defineEnt({
    eventId: v.id("officialEvents"),
  })
    .edge("officialEvent", { to: "officialEvents", field: "eventId" })
    .edge("calendarEvent", { to: "calendarEvents", ref: "firstEventId" }),

  calendarEvents: defineEnt({
    startDate: v.number(),
    endDate: v.number(),
    
    firstEventId: v.optional(v.id("calenderFirstEvents")),
  })
    .index("by_startDate", ["startDate"])
    .index("by_endDate", ["endDate"])
    .edge("firstEvent", { to: "calenderFirstEvents", field: "firstEventId", optional: true }),

  teamScouting: defineEnt({
    teamCode: v.string(),
    createdAt: v.number(),
    teamInfoId: v.optional(v.id("teamInfo")),
  })
    .index("by_teamCode", ["teamCode"])
    .edges("teamComments", { ref: "teamScoutingId" })
    .edge("teamInfo", { to: "teamInfo", field: "teamInfoId" }),

  teamComments: defineEnt({
    teamScoutingId: v.id("teamScouting"),
    comment: v.string(),
    createdAt: v.number(),
  })
    .edge("teamScouting", { to: "teamScouting", field: "teamScoutingId" }),
});

export const entDefinitions = getEntDefinitions(schema);
export default schema;
