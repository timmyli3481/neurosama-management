import { internalMutation } from "../functions";
import { v } from "convex/values";

export const deleteAllFirstEvents = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await Promise.all(
      (await ctx.table("calenderFirstEvents")).map((event) => {
        return event.delete();
      }),
    );
    return null;
  },
});

export const createFirstEvent = internalMutation({
  args: {
    eventId: v.id("officialEvents"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if a calenderFirstEvent already exists for this official event
    const existing = await ctx
      .table("calenderFirstEvents")
      .get("eventId", args.eventId);

    if (existing) {
      // Update or create the calendar event for the existing first event
      const calendarEvent = await existing.edge("calendarEvent");
      if (calendarEvent) {
        // Update existing calendar event
        await ctx.table("calendarEvents").getX(calendarEvent._id).patch({
          startDate: args.startDate,
          endDate: args.endDate,
        });
      } else {
        // Create new calendar event for existing first event
        await ctx.table("calendarEvents").insert({
          firstEventId: existing._id,
          startDate: args.startDate,
          endDate: args.endDate,
        });
      }
      return null;
    }

    // Create new calenderFirstEvent
    const firstEventId = await ctx.table("calenderFirstEvents").insert({
      eventId: args.eventId,
    });

    // Create associated calendar event
    await ctx.table("calendarEvents").insert({
      firstEventId: firstEventId,
      startDate: args.startDate,
      endDate: args.endDate,
    });

    return null;
  },
});
