import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ========================================
  // CORE TABLES (existing)
  // ========================================

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
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_startDate", ["startDate"])
    .index("by_endDate", ["endDate"]),

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

  // Tasks (enhanced with FTC fields)
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
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    dueDate: v.optional(v.number()),
    subsystemId: v.optional(v.id("robotSubsystems")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_status", ["status"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_subsystemId", ["subsystemId"])
    .index("by_dueDate", ["dueDate"]),

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

  // ========================================
  // FTC COMPETITION TABLES
  // ========================================

  // FTC Competitions/Events
  competitions: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("scrimmage"),
      v.literal("league_meet"),
      v.literal("qualifier"),
      v.literal("championship"),
      v.literal("worlds")
    ),
    location: v.string(),
    address: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    registrationDeadline: v.optional(v.number()),
    registrationStatus: v.union(
      v.literal("not_started"),
      v.literal("registered"),
      v.literal("waitlisted"),
      v.literal("confirmed")
    ),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_startDate", ["startDate"])
    .index("by_type", ["type"]),

  // Competition Matches
  competitionMatches: defineTable({
    competitionId: v.id("competitions"),
    matchNumber: v.number(),
    matchType: v.union(
      v.literal("practice"),
      v.literal("qualification"),
      v.literal("semifinal"),
      v.literal("final")
    ),
    allianceColor: v.union(v.literal("red"), v.literal("blue")),
    alliancePartner: v.optional(v.string()), // Partner team number
    opponents: v.optional(v.array(v.string())), // Opponent team numbers
    ourScore: v.optional(v.number()),
    opponentScore: v.optional(v.number()),
    autoPoints: v.optional(v.number()),
    teleopPoints: v.optional(v.number()),
    endgamePoints: v.optional(v.number()),
    penaltyPoints: v.optional(v.number()),
    notes: v.optional(v.string()),
    scheduledTime: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_competitionId", ["competitionId"])
    .index("by_matchType", ["matchType"]),

  // Competition Awards
  competitionAwards: defineTable({
    competitionId: v.id("competitions"),
    awardName: v.string(),
    placement: v.optional(v.number()), // 1st, 2nd, 3rd, etc.
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_competitionId", ["competitionId"]),

  // ========================================
  // ENGINEERING NOTEBOOK
  // ========================================

  // Engineering Notebook Entries
  engineeringNotebook: defineTable({
    title: v.string(),
    content: v.string(), // Rich text content (markdown or HTML)
    category: v.union(
      v.literal("design"),
      v.literal("build"),
      v.literal("code"),
      v.literal("outreach"),
      v.literal("business"),
      v.literal("team"),
      v.literal("strategy"),
      v.literal("testing")
    ),
    entryDate: v.number(),
    contributors: v.array(v.id("users")),
    subsystemId: v.optional(v.id("robotSubsystems")),
    competitionId: v.optional(v.id("competitions")),
    meetingId: v.optional(v.id("meetings")),
    tags: v.optional(v.array(v.string())),
    imageIds: v.optional(v.array(v.id("_storage"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_entryDate", ["entryDate"])
    .index("by_subsystemId", ["subsystemId"])
    .index("by_createdBy", ["createdBy"]),

  // ========================================
  // ROBOT SUBSYSTEMS
  // ========================================

  // Robot Subsystems (Drivetrain, Intake, Arm, etc.)
  robotSubsystems: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("drivetrain"),
      v.literal("intake"),
      v.literal("arm"),
      v.literal("lift"),
      v.literal("claw"),
      v.literal("shooter"),
      v.literal("sensors"),
      v.literal("vision"),
      v.literal("electronics"),
      v.literal("other")
    ),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("concept"),
      v.literal("design"),
      v.literal("prototyping"),
      v.literal("testing"),
      v.literal("competition_ready"),
      v.literal("needs_repair")
    ),
    progress: v.number(), // 0-100 percentage
    currentVersion: v.optional(v.string()), // e.g., "v2.1"
    leadUserId: v.optional(v.id("users")),
    imageId: v.optional(v.id("_storage")),
    specs: v.optional(v.string()), // Technical specifications
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // Subsystem Iteration/Version Log
  subsystemLogs: defineTable({
    subsystemId: v.id("robotSubsystems"),
    version: v.string(),
    changeType: v.union(
      v.literal("design_change"),
      v.literal("rebuild"),
      v.literal("repair"),
      v.literal("upgrade"),
      v.literal("testing_results")
    ),
    description: v.string(),
    testResults: v.optional(v.string()),
    imageIds: v.optional(v.array(v.id("_storage"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_subsystemId", ["subsystemId"])
    .index("by_createdAt", ["createdAt"]),

  // ========================================
  // MATCH SCOUTING
  // ========================================

  // Scouted Teams Database
  scoutedTeams: defineTable({
    teamNumber: v.string(),
    teamName: v.optional(v.string()),
    school: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_teamNumber", ["teamNumber"]),

  // Scouting Reports
  scoutingReports: defineTable({
    scoutedTeamId: v.id("scoutedTeams"),
    competitionId: v.optional(v.id("competitions")),
    matchNumber: v.optional(v.number()),
    // Robot capabilities
    drivetrainType: v.optional(v.string()),
    autoCapabilities: v.optional(v.string()),
    teleopCapabilities: v.optional(v.string()),
    endgameCapabilities: v.optional(v.string()),
    // Ratings (1-5 scale)
    speedRating: v.optional(v.number()),
    defenseRating: v.optional(v.number()),
    reliabilityRating: v.optional(v.number()),
    driverSkillRating: v.optional(v.number()),
    // Analysis
    strengths: v.optional(v.string()),
    weaknesses: v.optional(v.string()),
    allianceNotes: v.optional(v.string()), // Good partner? Strategy notes
    overallRating: v.optional(v.number()), // 1-10
    scoutedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scoutedTeamId", ["scoutedTeamId"])
    .index("by_competitionId", ["competitionId"])
    .index("by_overallRating", ["overallRating"]),

  // ========================================
  // PARTS INVENTORY
  // ========================================

  // Parts Inventory
  partsInventory: defineTable({
    name: v.string(),
    partNumber: v.optional(v.string()),
    category: v.union(
      v.literal("motors"),
      v.literal("sensors"),
      v.literal("structural"),
      v.literal("electronics"),
      v.literal("hardware"),
      v.literal("3d_prints"),
      v.literal("pneumatics"),
      v.literal("wheels"),
      v.literal("other")
    ),
    quantity: v.number(),
    minQuantity: v.optional(v.number()), // Low stock threshold
    location: v.optional(v.string()), // Where it's stored
    supplier: v.optional(v.string()),
    supplierUrl: v.optional(v.string()),
    unitCost: v.optional(v.number()),
    notes: v.optional(v.string()),
    subsystemId: v.optional(v.id("robotSubsystems")),
    imageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_subsystemId", ["subsystemId"])
    .index("by_quantity", ["quantity"]),

  // Parts Usage Log (tracks when parts are used/restocked)
  partsLog: defineTable({
    partId: v.id("partsInventory"),
    action: v.union(
      v.literal("used"),
      v.literal("restocked"),
      v.literal("returned"),
      v.literal("damaged"),
      v.literal("ordered")
    ),
    quantity: v.number(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_partId", ["partId"])
    .index("by_createdAt", ["createdAt"]),

  // Shopping List / Part Requests
  partRequests: defineTable({
    name: v.string(),
    partNumber: v.optional(v.string()),
    category: v.union(
      v.literal("motors"),
      v.literal("sensors"),
      v.literal("structural"),
      v.literal("electronics"),
      v.literal("hardware"),
      v.literal("3d_prints"),
      v.literal("pneumatics"),
      v.literal("wheels"),
      v.literal("other")
    ),
    quantity: v.number(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    status: v.union(
      v.literal("requested"),
      v.literal("approved"),
      v.literal("ordered"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    estimatedCost: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierUrl: v.optional(v.string()),
    reason: v.optional(v.string()),
    subsystemId: v.optional(v.id("robotSubsystems")),
    requestedBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_requestedBy", ["requestedBy"]),

  // ========================================
  // MEETINGS & ATTENDANCE
  // ========================================

  // Meetings
  meetings: defineTable({
    title: v.string(),
    type: v.union(
      v.literal("build_day"),
      v.literal("strategy"),
      v.literal("outreach"),
      v.literal("mentor_meeting"),
      v.literal("competition_prep"),
      v.literal("general"),
      v.literal("code_review")
    ),
    date: v.number(),
    startTime: v.optional(v.string()), // e.g., "14:00"
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    agenda: v.optional(v.string()),
    notes: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_type", ["type"]),

  // Meeting Attendance
  attendance: defineTable({
    meetingId: v.id("meetings"),
    userId: v.id("users"),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("excused"),
      v.literal("late")
    ),
    arrivalTime: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_meetingId", ["meetingId"])
    .index("by_userId", ["userId"])
    .index("by_meetingId_and_userId", ["meetingId", "userId"]),

  // ========================================
  // ACTIVITY FEED
  // ========================================

  // Activity Log (for activity feed)
  activityLog: defineTable({
    type: v.union(
      v.literal("task_created"),
      v.literal("task_completed"),
      v.literal("task_updated"),
      v.literal("project_created"),
      v.literal("notebook_entry"),
      v.literal("subsystem_update"),
      v.literal("competition_result"),
      v.literal("part_added"),
      v.literal("meeting_scheduled"),
      v.literal("scouting_report"),
      v.literal("award_won"),
      v.literal("member_joined")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
    // Reference to related entity
    entityType: v.optional(v.union(
      v.literal("task"),
      v.literal("project"),
      v.literal("notebook"),
      v.literal("subsystem"),
      v.literal("competition"),
      v.literal("part"),
      v.literal("meeting"),
      v.literal("scouting")
    )),
    entityId: v.optional(v.string()), // ID of the related entity
    metadata: v.optional(v.string()), // JSON string for extra data
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_entityType_and_entityId", ["entityType", "entityId"]),

  // ========================================
  // CALENDAR EVENTS (separate from meetings)
  // ========================================

  calendarEvents: defineTable({
    title: v.string(),
    type: v.union(
      v.literal("competition"),
      v.literal("meeting"),
      v.literal("deadline"),
      v.literal("build_day"),
      v.literal("outreach"),
      v.literal("other")
    ),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()), // Custom color for the event
    // Optional references
    competitionId: v.optional(v.id("competitions")),
    meetingId: v.optional(v.id("meetings")),
    projectId: v.optional(v.id("projects")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_startDate", ["startDate"])
    .index("by_type", ["type"])
    .index("by_competitionId", ["competitionId"])
    .index("by_meetingId", ["meetingId"]),

  // ========================================
  // SEASON / TEAM INFO
  // ========================================

  // Team Season Info
  seasonInfo: defineTable({
    seasonYear: v.string(), // e.g., "2024-2025"
    gameName: v.string(), // e.g., "INTO THE DEEP"
    teamNumber: v.string(),
    teamName: v.string(),
    isActive: v.boolean(),
    startDate: v.optional(v.number()),
    worldsDate: v.optional(v.number()),
    goals: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_isActive", ["isActive"]),
});
