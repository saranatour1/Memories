import { v } from "convex/values";
import {
  authedMutation,
  memberMutation,
  memberQuery,
  requireMembership,
} from "./helpers";
import { r2 } from "./files";

export const list = memberQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("items")
      .withIndex("by_memory", (q) => q.eq("memoryId", ctx.memory._id))
      .collect();
    return Promise.all(
      items.map(async (item) =>
        item.type === "image" || item.type === "voice"
          ? { ...item, url: await r2.getUrl(item.key, { expiresIn: 60 * 60 }) }
          : item,
      ),
    );
  },
});

const tags = v.optional(v.array(v.string()));

export const addFlight = memberMutation({
  args: {
    airline: v.string(),
    flightNumber: v.string(),
    from: v.string(),
    to: v.string(),
    departAt: v.number(),
    arriveAt: v.number(),
    tags,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("items", {
      type: "flight",
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
    });
  },
});

export const addDrive = memberMutation({
  args: {
    from: v.string(),
    to: v.string(),
    plannedAt: v.number(),
    notes: v.optional(v.string()),
    tags,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("items", {
      type: "drive",
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
    });
  },
});

export const addNote = memberMutation({
  args: { content: v.any(), tags },
  handler: async (ctx, { content, tags }) => {
    await ctx.db.insert("items", {
      type: "note",
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      content,
      tags,
    });
  },
});

export const updateNote = memberMutation({
  args: { itemId: v.id("items"), content: v.any() },
  handler: async (ctx, { itemId, content }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.memoryId !== ctx.memory._id || item.type !== "note")
      throw new Error("Note not found");
    await ctx.db.patch(itemId, { content });
  },
});

export const addImage = memberMutation({
  args: { key: v.string(), caption: v.optional(v.string()), tags },
  handler: async (ctx, args) => {
    await ctx.db.insert("items", {
      type: "image",
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
    });
  },
});

export const addVoice = memberMutation({
  args: { key: v.string(), durationMs: v.optional(v.number()), tags },
  handler: async (ctx, args) => {
    await ctx.db.insert("items", {
      type: "voice",
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
    });
  },
});

export const setTags = memberMutation({
  args: { itemId: v.id("items"), tags: v.array(v.string()) },
  handler: async (ctx, { itemId, tags }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.memoryId !== ctx.memory._id)
      throw new Error("Item not found");
    await ctx.db.patch(itemId, { tags });
  },
});

export const remove = authedMutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return;
    const { membership } = await requireMembership(ctx, item.memoryId);
    if (item.createdBy !== ctx.userId && membership.role !== "owner")
      throw new Error("Only the creator or owner can delete this");
    await ctx.db.delete(itemId);
    if (item.type === "image" || item.type === "voice") {
      await r2.deleteObject(ctx, item.key);
    }
  },
});
