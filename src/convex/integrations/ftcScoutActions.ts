"use node";

import { internalAction, action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client/core";
import {
  AwardFieldsFragmentDoc,
  EventCoreFragmentFragment,
  GetTeamInfoQuery,
  GetTeamInfoDocument,
  GetEventBasicInfoQuery,
  GetEventBasicInfoDocument,
  MatchCoreFragmentFragmentDoc,
  MatchFragmentFragmentDoc,
  TeamMatchParticipationCoreFragmentDoc,
  TeamCoreFragmentFragmentDoc,
  EventCoreFragmentFragmentDoc,
  EventFragmentFragmentDoc,
  type EventFragmentFragment,
  TeamCoreFragmentFragment,
} from "../../gql/graphql";
import { getFragmentData } from "../../gql";
import { fromZonedTime } from "date-fns-tz";

// ========================================
// Timezone Helpers
// ========================================

/**
 * Parse a local date string (YYYY-MM-DD) in the given timezone and return UTC timestamp.
 * The date is interpreted as midnight (00:00:00) in the specified timezone.
 */
function parseLocalDateToUtc(dateString: string, timezone: string): number {
  // Create a date-time at midnight in the specified timezone
  const localDateTime = `${dateString}T00:00:00`;
  // fromZonedTime converts a local time in a timezone to UTC
  const utcDate = fromZonedTime(localDateTime, timezone);
  return utcDate.getTime();
}

/**
 * Parse a local date string (YYYY-MM-DD) as the end of day in the given timezone.
 * Returns UTC timestamp for 23:59:59 in the specified timezone.
 */
function parseLocalEndDateToUtc(dateString: string, timezone: string): number {
  // Create a date-time at end of day in the specified timezone
  const localDateTime = `${dateString}T23:59:59`;
  const utcDate = fromZonedTime(localDateTime, timezone);
  return utcDate.getTime();
}

/**
 * Parse a local datetime string in the given timezone and return UTC timestamp.
 * Handles ISO datetime strings that are in the event's local timezone.
 */
function parseLocalDateTimeToUtc(
  dateTimeString: string,
  timezone: string,
): number {
  // fromZonedTime interprets the datetime as being in the specified timezone
  const utcDate = fromZonedTime(dateTimeString, timezone);
  return utcDate.getTime();
}

// ========================================
// Fragment Filter Functions
// ========================================

/**
 * Extract only TeamCore fields from TeamStats data.
 * Uses getFragmentData to unwrap nested fragment, then picks core fields only.
 * Strips quickStats and returns just basic team identification info.
 */
function filterTeamCore(teamCore: TeamCoreFragmentFragment): TeamCoreFragmentFragment {
  return {
    number: teamCore.number,
    name: teamCore.name,
    schoolName: teamCore.schoolName,
    rookieYear: teamCore.rookieYear,
    website: teamCore.website,
    location: teamCore.location,
    quickStats: teamCore.quickStats,
  };
}

/**
 * Extract only EventCore fields from EventFragment data.
 * Uses getFragmentData to unwrap nested fragment, then picks core fields only.
 * Strips nested matches and awards, returns just core event info.
 */
function filterEventCore(eventCore: EventCoreFragmentFragment): EventCoreFragmentFragment {
  return {
    season: eventCore.season,
    code: eventCore.code,
    name: eventCore.name,
    type: eventCore.type,
    address: eventCore.address,
    location: eventCore.location,
    regionCode: eventCore.regionCode,
    leagueCode: eventCore.leagueCode,
    districtCode: eventCore.districtCode,
    divisionCode: eventCore.divisionCode,
    start: eventCore.start,
    end: eventCore.end,
    timezone: eventCore.timezone,
    remote: eventCore.remote,
    hybrid: eventCore.hybrid,
    fieldCount: eventCore.fieldCount,
    published: eventCore.published,
    started: eventCore.started,
    ongoing: eventCore.ongoing,
    finished: eventCore.finished,
    hasMatches: eventCore.hasMatches,
    website: eventCore.website,
    liveStreamURL: eventCore.liveStreamURL,
    webcasts: eventCore.webcasts,
    createdAt: eventCore.createdAt,
    updatedAt: eventCore.updatedAt,
  };
}

// ========================================
// Apollo Client Setup
// ========================================

function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: "https://api.ftcscout.org/graphql",
      fetch: fetch,
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: "no-cache",
        errorPolicy: "all",
      },
    },
  });
}

// ========================================
// Internal Action: Fetch and Save Team Data
// ========================================

export const fetchTeamData = internalAction({
  args: {
    teamNumber: v.number(),
    addToCalendar: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const client = createApolloClient();

    try {
      const result = await client.query<GetTeamInfoQuery>({
        query: GetTeamInfoDocument,
        variables: { number: args.teamNumber, season: 2025 },
      });

      if (!result.data?.teamByNumber) {
        console.error(`Team ${args.teamNumber} not found`);
        return false;
      }

      if (args.addToCalendar) {
        await ctx.runMutation(internal.calender.FirstEvents.deleteAllFirstEvents, {});
      }

      // Save team info - extract only core team data (without quickStats)
      const teamCore = getFragmentData(
        TeamCoreFragmentFragmentDoc,
        result.data.teamByNumber,
      );
      const teamCoreData = filterTeamCore(teamCore);

      const teamInfoResult = await ctx.runMutation(
        internal.integrations.ftcScout.saveTeamInfo,
        {
          teamNumber: args.teamNumber,
          data: teamCoreData,
        },
      );
      const teamInfoId = teamInfoResult.id;

      // Clear existing team-specific data for this team
      await ctx.runMutation(internal.integrations.ftcScout.clearTeamEvents, {
        teamInfoId,
      });
      await ctx.runMutation(internal.integrations.ftcScout.clearTeamMatches, {
        teamInfoId,
      });
      await ctx.runMutation(internal.integrations.ftcScout.clearTeamAwards, {
        teamInfoId,
      });

      // Process each event participation
      for (const eventParticipation of result.data.teamByNumber.events) {
        // Get full event data (includes nested matches/awards for iteration)
        const eventCore = getFragmentData(
          EventFragmentFragmentDoc,
          eventParticipation.event,
        );

        // Extract core event data - filter out nested matches/awards
        const coreEventData = filterEventCore(getFragmentData(EventCoreFragmentFragmentDoc, eventCore));

        // Parse dates using the event's timezone
        const eventTimezone = coreEventData.timezone;
        const eventStartUtc = parseLocalDateToUtc(
          coreEventData.start,
          eventTimezone,
        );
        const eventEndUtc = parseLocalEndDateToUtc(
          coreEventData.end,
          eventTimezone,
        );

        // Save or update official event with core data only
        const eventResult = await ctx.runMutation(
          internal.integrations.ftcScout.saveOfficialEvent,
          {
            eventCode: coreEventData.code,
            season: coreEventData.season,
            data: coreEventData,
            startDate: eventStartUtc,
            endDate: eventEndUtc,
          },
        );
        const eventId = eventResult.id;

        if (args.addToCalendar) {
          await ctx.runMutation(internal.calender.FirstEvents.createFirstEvent, {
            eventId: eventResult.id,
            startDate: eventStartUtc,
            endDate: eventEndUtc,
          });
        }

        // Save team event junction
        const teamEventResult = await ctx.runMutation(
          internal.integrations.ftcScout.saveTeamEvent,
          {
            teamInfoId,
            eventId,
            startDate: eventStartUtc,
          },
        );
        const teamEventId = teamEventResult.id;

        for (const match of eventCore.matches) {
          const matchCore = getFragmentData(
            MatchCoreFragmentFragmentDoc,
            getFragmentData(MatchFragmentFragmentDoc, match),
          );
          const matchStartUtc = matchCore.scheduledStartTime
            ? parseLocalDateTimeToUtc(matchCore.scheduledStartTime, eventTimezone)
            : undefined;

          const teamParticipation = matchCore.teams.map((t) => getFragmentData(TeamMatchParticipationCoreFragmentDoc, t));
          const teamNumbers = teamParticipation.map((t) => t.teamNumber);

          await ctx.runMutation(
            internal.integrations.ftcScout.saveOfficialMatch,
            {
              eventId,
              matchId: matchCore.id,
              teamNumbers,
              data: matchCore,
              startDate: matchStartUtc,
            },
          );


        }

        // Process matches from the event
        for (const matchEntry of eventParticipation.matches) {
          // Get match core data (includes teams participation)
          const matchData = getFragmentData(
            MatchCoreFragmentFragmentDoc,
            matchEntry.match,
          );

          // Extract team participation data
          const teamsParticipation = matchData.teams.map((team) =>
            getFragmentData(TeamMatchParticipationCoreFragmentDoc, team),
          );
          const teamNumbers = teamsParticipation.map((t) => t.teamNumber);

          // Find the current team's participation data
          const currentTeamParticipation = teamsParticipation.find(
            (t) => t.teamNumber === args.teamNumber,
          );

          // Parse match time using event timezone
          const matchStartUtc = matchData.scheduledStartTime
            ? parseLocalDateTimeToUtc(matchData.scheduledStartTime, eventTimezone)
            : undefined;

          // Save or update official match with core data (includes teams)
          const matchResult = await ctx.runMutation(
            internal.integrations.ftcScout.saveOfficialMatch,
            {
              eventId,
              matchId: matchData.id,
              teamNumbers,
              data: matchData,
              startDate: matchStartUtc,
            },
          );

          // Save team match junction with TeamMatchParticipationCore data
          await ctx.runMutation(internal.integrations.ftcScout.saveTeamMatch, {
            teamInfoId,
            teamEventId,
            matchId: matchResult.id,
            startDate: matchStartUtc,
            data: currentTeamParticipation,
          });
        }

        // Process awards from event participation
        for (const award of eventParticipation.awards) {
          const awardData = getFragmentData(AwardFieldsFragmentDoc, award);

          // Save or update official award
          const awardResult = await ctx.runMutation(
            internal.integrations.ftcScout.saveOfficialAward,
            {
              eventId,
              awardType: awardData.type,
              placement: awardData.placement,
              teamNumber: args.teamNumber,
              data: awardData,
            },
          );

          // Save team award junction
          await ctx.runMutation(internal.integrations.ftcScout.saveTeamAward, {
            teamInfoId,
            teamEventId,
            awardId: awardResult.id,
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Error fetching team data:", error);
      return false;
    }
  },
});

// ========================================
// Internal Action: Fetch Current Team Data
// ========================================

export const fetchCurrentTeamData = internalAction({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const settings = await ctx.runQuery(
      internal.settings.settings.getFtcSettingsInternal,
      {},
    );

    if (!settings.ftcTeamNumber) {
      console.error(
        "No team number configured. Please set FTC team number in settings.",
      );
      return false;
    }

    await ctx.runAction(internal.integrations.ftcScoutActions.fetchTeamData, {
      teamNumber: settings.ftcTeamNumber,
      addToCalendar: true,
    });

    return true;
  },
});

// ========================================
// Public Action: Sync FTC Scout Data
// ========================================

type SyncResult = {
  success: boolean;
  message: string;
  teamNumber: number | null;
};

export const syncFtcScoutData = action({
  args: {
    teamNumber: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    teamNumber: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args): Promise<SyncResult> => {
    const user = await ctx.runQuery(internal.auth.helpers.getCurrentUser, {});

    if (!user) {
      return {
        success: false,
        message: "User not found",
        teamNumber: null,
      };
    }

    if (!args.teamNumber) {
      return {
        success: false,
        message: "No team number provided.",
        teamNumber: null,
      };
    }

    console.log(`Syncing FTC Scout data for team ${args.teamNumber}`);

    try {
      const success = await ctx.runAction(
        internal.integrations.ftcScoutActions.fetchTeamData,
        {
          teamNumber: args.teamNumber,
          addToCalendar: false,
        },
      );

      if (success) {
        return {
          success: true,
          message: `Successfully synced all data for team ${args.teamNumber}`,
          teamNumber: args.teamNumber,
        };
      } else {
        return {
          success: false,
          message: `Failed to sync data for team ${args.teamNumber}`,
          teamNumber: args.teamNumber,
        };
      }
    } catch (error) {
      console.error("Sync error:", error);
      return {
        success: false,
        message: `Error syncing data: ${error}`,
        teamNumber: args.teamNumber,
      };
    }
  },
});

export const syncCurrentTeamData = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.auth.helpers.getCurrentUser, {});

    if (!user) {
      console.error("User not found");
      return {
        success: false,
        message: "User not found",
      };
    }

    console.log(`Syncing FTC Scout data for current team`);
    try {
      const success = await ctx.runAction(
        internal.integrations.ftcScoutActions.fetchCurrentTeamData,
        {},
      );
      if (success) {
        return {
          success: true,
          message: "Successfully synced data for current team",
        };
      } else {
        return {
          success: false,
          message: "Failed to sync data for current team",
        };
      }
    } catch (error) {
      console.error("Sync error:", error);
      return {
        success: false,
        message: `Error syncing data: ${error}`,
      };
    }
    
  },
});

// ========================================
// Internal Action: Fetch Event Data
// ========================================

export const fetchEventData = internalAction({
  args: {
    eventCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const client = createApolloClient();

    try {
      const result = await client.query<GetEventBasicInfoQuery>({
        query: GetEventBasicInfoDocument,
        variables: { code: args.eventCode, season: 2025 },
      });

      if (!result.data?.eventByCode) {
        console.error(`Event ${args.eventCode} not found for season 2025`);
        return false;
      }

      // Get full event data (includes nested matches/awards)
      const eventData = getFragmentData(
        EventFragmentFragmentDoc,
        result.data.eventByCode,
      );

      // Extract core event data - filter out nested matches/awards
      const coreEventData = filterEventCore(getFragmentData(EventCoreFragmentFragmentDoc, eventData));

      // Parse dates using the event's timezone
      const eventTimezone = coreEventData.timezone;
      const eventStartUtc = parseLocalDateToUtc(
        coreEventData.start,
        eventTimezone,
      );

      const eventEndUtc = parseLocalEndDateToUtc(
        coreEventData.end,
        eventTimezone,
      );

      // Save or update official event with core data only
      const eventResult = await ctx.runMutation(
        internal.integrations.ftcScout.saveOfficialEvent,
        {
          eventCode: coreEventData.code,
          season: coreEventData.season,
          data: coreEventData,
          startDate: eventStartUtc,
          endDate: eventEndUtc,
        },
      );

      for (const match of eventData.matches) {
        const matchData = getFragmentData(
          MatchCoreFragmentFragmentDoc,
          getFragmentData(MatchFragmentFragmentDoc, match),
        );
        const teamsParticipation = matchData.teams.map((team) =>
          getFragmentData(TeamMatchParticipationCoreFragmentDoc, team),
        );
        const teamNumbers = teamsParticipation.map((t) => t.teamNumber);

        // Parse match time using event timezone
        const matchStartUtc = matchData.scheduledStartTime
          ? parseLocalDateTimeToUtc(matchData.scheduledStartTime, eventTimezone)
          : undefined;

        const matchResult = await ctx.runMutation(
          internal.integrations.ftcScout.saveOfficialMatch,
          {
            eventId: eventResult.id,
            matchId: matchData.id,
            teamNumbers,
            data: matchData,
            startDate: matchStartUtc,
          },
        );

        for (const teamParticipationOne of teamsParticipation) {
          const teamInfo = await ctx.runQuery(
            internal.integrations.ftcScout.getTeamInfo,
            {
              teamNumber: teamParticipationOne.teamNumber,
            },
          );
          if (!teamInfo) {
            console.error(`Team ${teamParticipationOne.teamNumber} not found`);
            continue;
          }
          let teamEvent = (
            await ctx.runQuery(internal.integrations.ftcScout.getTeamEvent, {
              teamInfoId: teamInfo.id,
              eventId: eventResult.id,
            })
          )?.id;
          if (!teamEvent) {
            teamEvent = (
              await ctx.runMutation(
                internal.integrations.ftcScout.saveTeamEvent,
                {
                  teamInfoId: teamInfo.id,
                  eventId: eventResult.id,
                  startDate: eventStartUtc,
                },
              )
            ).id;
          }
          await ctx.runMutation(internal.integrations.ftcScout.saveTeamMatch, {
            teamInfoId: teamInfo.id,
            teamEventId: teamEvent,
            matchId: matchResult.id,
            startDate: matchStartUtc,
            data: teamParticipationOne,
          });
        }
      }

      for (const award of eventData.awards) {
        const awardData = getFragmentData(AwardFieldsFragmentDoc, award);
        const awardResult = await ctx.runMutation(
          internal.integrations.ftcScout.saveOfficialAward,
          {
            eventId: eventResult.id,
            awardType: awardData.type,
            placement: awardData.placement,
            teamNumber: awardData.teamNumber,
            data: awardData,
          },
        );

        const teamInfo = await ctx.runQuery(
          internal.integrations.ftcScout.getTeamInfo,
          {
            teamNumber: awardData.teamNumber,
          },
        );
        if (!teamInfo) {
          console.error(`Team ${awardData.teamNumber} not found`);
          continue;
        }
        let teamEvent = (
          await ctx.runQuery(internal.integrations.ftcScout.getTeamEvent, {
            teamInfoId: teamInfo.id,
            eventId: eventResult.id,
          })
        )?.id;
        if (!teamEvent) {
          teamEvent = (
            await ctx.runMutation(
              internal.integrations.ftcScout.saveTeamEvent,
              {
                teamInfoId: teamInfo.id,
                eventId: eventResult.id,
                startDate: eventStartUtc,
              },
            )
          ).id;
        }
        await ctx.runMutation(internal.integrations.ftcScout.saveTeamAward, {
          teamInfoId: teamInfo.id,
          teamEventId: teamEvent,
          awardId: awardResult.id,
        });
      }
      console.log(
        `Successfully fetched event ${args.eventCode} for season 2025`,
      );
      return true;
    } catch (error) {
      console.error("Error fetching event data:", error);
      return false;
    }
  },
});

// ========================================
// Public Action: Sync Event Data
// ========================================

type SyncEventResult = {
  success: boolean;
  message: string;
  eventCode: string | null;
};

export const syncEventData = action({
  args: {
    eventCode: v.string(),
    season: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    eventCode: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<SyncEventResult> => {
    const user = await ctx.runQuery(internal.auth.helpers.getCurrentUser, {});

    if (!user) {
      return {
        success: false,
        message: "User not found",
        eventCode: null,
      };
    }

    if (!args.eventCode) {
      return {
        success: false,
        message: "No event code provided.",
        eventCode: null,
      };
    }

    console.log(
      `Syncing FTC Scout event data for ${args.eventCode} (season 2025)`,
    );

    try {
      const success = await ctx.runAction(
        internal.integrations.ftcScoutActions.fetchEventData,
        {
          eventCode: args.eventCode,
        },
      );

      if (success) {
        return {
          success: true,
          message: `Successfully synced event ${args.eventCode} for season 2025`,
          eventCode: args.eventCode,
        };
      } else {
        return {
          success: false,
          message: `Failed to sync event ${args.eventCode}`,
          eventCode: args.eventCode,
        };
      }
    } catch (error) {
      console.error("Sync error:", error);
      return {
        success: false,
        message: `Error syncing event data: ${error}`,
        eventCode: args.eventCode,
      };
    }
  },
});
