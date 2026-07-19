import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// One-shot: copy every legacy `items` doc into its per-type table, then delete
// it. Idempotent — re-run until it reports 0 total (dataset is a few dozen
// docs; the take() bound just caps a single transaction). Delete this file
// once `items` is dropped from the schema.
export const backfillItems = internalMutation({
  args: {},
  returns: v.object({
    flights: v.number(),
    drives: v.number(),
    notes: v.number(),
    images: v.number(),
    voiceNotes: v.number(),
  }),
  handler: async (ctx) => {
    const counts = { flights: 0, drives: 0, notes: 0, images: 0, voiceNotes: 0 };
    const items = await ctx.db.query("items").take(1000);
    for (const item of items) {
      if (item.type === "flight") {
        const { _id, _creationTime, type, ...rest } = item;
        await ctx.db.insert("flights", { ...rest, happenedAt: item.departAt });
        counts.flights++;
      } else if (item.type === "drive") {
        const { _id, _creationTime, type, ...rest } = item;
        await ctx.db.insert("drives", { ...rest, happenedAt: item.plannedAt });
        counts.drives++;
      } else if (item.type === "note") {
        const { _id, _creationTime, type, ...rest } = item;
        await ctx.db.insert("notes", {
          ...rest,
          happenedAt: item._creationTime,
        });
        counts.notes++;
      } else if (item.type === "image") {
        const { _id, _creationTime, type, ...rest } = item;
        await ctx.db.insert("images", {
          ...rest,
          happenedAt: item._creationTime,
        });
        counts.images++;
      } else {
        const { _id, _creationTime, type, ...rest } = item;
        await ctx.db.insert("voiceNotes", {
          ...rest,
          happenedAt: item._creationTime,
        });
        counts.voiceNotes++;
      }
      await ctx.db.delete(item._id);
    }
    return counts;
  },
});
