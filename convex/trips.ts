import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  authedMutation,
  authedQuery,
  requireMembership,
  requireTripMembership,
} from "./helpers";

export const create = authedMutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, { title }) => {
    const tripId = await ctx.db.insert("trips", {
      title: title ?? "Untitled trip",
      ownerId: ctx.userId,
    });
    await ctx.db.insert("tripMembers", {
      tripId,
      userId: ctx.userId,
      role: "owner",
    });
    return tripId;
  },
});

const memoriesOf = (ctx: QueryCtx, tripId: Id<"trips">) =>
  ctx.db
    .query("memories")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();

export const listMine = authedQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("tripMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const rows = await Promise.all(
      memberships.map(async (m) => ({
        trip: await ctx.db.get(m.tripId),
        role: m.role,
      })),
    );
    return Promise.all(
      rows.flatMap(({ trip, role }) =>
        trip
          ? [
              memoriesOf(ctx, trip._id).then((memories) => ({
                ...trip,
                role,
                memories,
              })),
            ]
          : [],
      ),
    );
  },
});

// Returns null (not an error) for malformed ids and non-members so the page
// can render a friendly state — same pattern as memories.get.
export const get = authedQuery({
  args: { tripId: v.string() },
  handler: async (ctx, args) => {
    const tripId = ctx.db.normalizeId("trips", args.tripId);
    if (!tripId) return null;
    const trip = await ctx.db.get(tripId);
    if (!trip) return null;
    const membership = await ctx.db
      .query("tripMembers")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", tripId).eq("userId", ctx.userId),
      )
      .unique();
    if (!membership) return null;
    return {
      ...trip,
      role: membership.role,
      memories: await memoriesOf(ctx, tripId),
    };
  },
});

export const update = authedMutation({
  args: {
    tripId: v.id("trips"),
    title: v.optional(v.string()),
    description: v.optional(v.any()),
    // null clears a previously set date
    startAt: v.optional(v.union(v.number(), v.null())),
    endAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireTripMembership(ctx, args.tripId);
    await ctx.db.patch(args.tripId, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      ...(args.startAt !== undefined
        ? { startAt: args.startAt ?? undefined }
        : {}),
      ...(args.endAt !== undefined ? { endAt: args.endAt ?? undefined } : {}),
    });
  },
});

export const addMemory = authedMutation({
  args: { tripId: v.id("trips"), memoryId: v.id("memories") },
  handler: async (ctx, { tripId, memoryId }) => {
    await requireTripMembership(ctx, tripId);
    await requireMembership(ctx, memoryId);
    await ctx.db.patch(memoryId, { tripId });
  },
});

export const removeMemory = authedMutation({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, { memoryId }) => {
    const { memory } = await requireMembership(ctx, memoryId);
    if (!memory.tripId) return;
    await requireTripMembership(ctx, memory.tripId);
    await ctx.db.patch(memoryId, { tripId: undefined });
  },
});
