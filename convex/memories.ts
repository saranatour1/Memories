import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { authedMutation, authedQuery, memberMutation } from "./helpers";

export const create = authedMutation({
  args: {},
  handler: async (ctx) => {
    const memoryId = await ctx.db.insert("memories", {
      title: "Untitled memory",
      ownerId: ctx.userId,
      status: "draft",
      inviteToken: crypto.randomUUID(),
    });
    await ctx.db.insert("members", {
      memoryId,
      userId: ctx.userId,
      role: "owner",
    });
    return memoryId;
  },
});

export const listMine = authedQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const memories = await Promise.all(
      memberships.map((m) => ctx.db.get(m.memoryId)),
    );
    return memories
      .filter((m) => m !== null)
      .map((memory, i) => ({ ...memory, role: memberships[i].role }));
  },
});

// Returns null (not an error) for non-members so the page can render a friendly state.
export const get = authedQuery({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return null;
    const membership = await ctx.db
      .query("members")
      .withIndex("by_memory_user", (q) =>
        q.eq("memoryId", memoryId).eq("userId", ctx.userId),
      )
      .unique();
    if (!membership) return null;
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_memory_user", (q) => q.eq("memoryId", memoryId))
      .collect();
    const members = await Promise.all(
      memberships.map(async (m) => {
        const profile = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", m.userId))
          .unique();
        return {
          userId: m.userId,
          role: m.role,
          name: profile?.name,
          email: profile?.email,
          avatarUrl: profile?.avatarUrl,
        };
      }),
    );
    return { ...memory, role: membership.role, members };
  },
});

export const update = memberMutation({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.any()),
    kind: v.optional(literals("day", "week", "month", "trip", "custom")),
    // null clears a previously set date
    startAt: v.optional(v.union(v.number(), v.null())),
    endAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.memory._id, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
      ...(args.startAt !== undefined
        ? { startAt: args.startAt ?? undefined }
        : {}),
      ...(args.endAt !== undefined ? { endAt: args.endAt ?? undefined } : {}),
    });
  },
});

export const setStatus = memberMutation({
  args: { status: literals("draft", "published") },
  handler: async (ctx, { status }) => {
    if (ctx.membership.role !== "owner")
      throw new Error("Only the owner can publish");
    await ctx.db.patch(ctx.memory._id, { status });
  },
});

export const joinByToken = authedMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_token", (q) => q.eq("inviteToken", token))
      .unique();
    if (!memory) throw new Error("Invalid invite link");
    const existing = await ctx.db
      .query("members")
      .withIndex("by_memory_user", (q) =>
        q.eq("memoryId", memory._id).eq("userId", ctx.userId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("members", {
        memoryId: memory._id,
        userId: ctx.userId,
        role: "member",
      });
    }
    return memory._id;
  },
});
