import { v } from "convex/values";
import { memberMutation, memberQuery } from "./helpers";

export const list = memberQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("days")
      .withIndex("by_memory_date", (q) => q.eq("memoryId", ctx.memory._id))
      .collect();
  },
});

export const upsert = memberMutation({
  args: {
    date: v.string(), // YYYY-MM-DD
    past: v.optional(v.any()),
    future: v.optional(v.any()),
  },
  handler: async (ctx, { date, past, future }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
    const patch = {
      ...(past !== undefined ? { past } : {}),
      ...(future !== undefined ? { future } : {}),
    };
    const existing = await ctx.db
      .query("days")
      .withIndex("by_memory_date", (q) =>
        q.eq("memoryId", ctx.memory._id).eq("date", date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("days", {
      memoryId: ctx.memory._id,
      date,
      ...patch,
    });
  },
});
