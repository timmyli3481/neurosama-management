import { query } from "../functions";
import { v } from "convex/values";

export const getEvents = query({
  args: { startDate: v.number(), endDate: v.number() },
  returns: v.array(
    v.object({
      id: v.id("calendarEvents"),
      startDate: v.number(),
      endDate: v.number(),
      data: v.union(
        v.object({
          type: v.literal("FirstEvent"),
          firstEvent: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const events = await ctx
      .table("calendarEvents")
      .filter((q) =>
        q.and(
          q.gte(q.field("startDate"), args.startDate),
          q.lte(q.field("startDate"), args.endDate),
        ),
      );

    const result = await Promise.all(
      events.map(async (event) => {
        if (event.firstEventId) {
          const firstEvent = await event.edge("firstEvent");
          if (!firstEvent) {
            return null;
          }
          const officialEvent = await firstEvent.edge("officialEvent");
          if (!officialEvent) {
            return null;
          }
          return {
            id: event._id,
            startDate: event.startDate,
            endDate: event.endDate,
            data: {
              type: "FirstEvent" as const,
              firstEvent: officialEvent.eventCode,
            },
          };
        }
        return null;
      }),
    );

    return result.filter((e) => e !== null);
  },
});
