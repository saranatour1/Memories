import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import {
  authedMutation,
  memberMutation,
  memberQuery,
  requireMembership,
} from "./helpers";
import { r2 } from "./files";

const itemType = literals("flight", "drive", "note", "image", "voice");
const TABLE = {
  flight: "flights",
  drive: "drives",
  note: "notes",
  image: "images",
  voice: "voiceNotes",
} as const;

const signedUrl = (key: string) => r2.getUrl(key, { expiresIn: 60 * 60 });

// Merges all item tables into one chronological list, in the same
// discriminated shape the old union table returned.
export const list = memberQuery({
  args: {},
  handler: async (ctx) => {
    const [flights, drives, notes, images, voiceNotes] = await Promise.all([
      ctx.db.query("flights").withIndex("by_memory_and_happenedAt", (q) => q.eq("memoryId", ctx.memory._id)).collect(),
      ctx.db.query("drives").withIndex("by_memory_and_happenedAt", (q) => q.eq("memoryId", ctx.memory._id)).collect(),
      ctx.db.query("notes").withIndex("by_memory_and_happenedAt", (q) => q.eq("memoryId", ctx.memory._id)).collect(),
      ctx.db.query("images").withIndex("by_memory_and_happenedAt", (q) => q.eq("memoryId", ctx.memory._id)).collect(),
      ctx.db.query("voiceNotes").withIndex("by_memory_and_happenedAt", (q) => q.eq("memoryId", ctx.memory._id)).collect(),
    ]);
    const items = [
      ...flights.map((d) => ({ type: "flight" as const, ...d })),
      ...drives.map((d) => ({ type: "drive" as const, ...d })),
      ...notes.map((d) => ({ type: "note" as const, ...d })),
      ...(await Promise.all(
        images.map(async (d) => ({
          type: "image" as const,
          ...d,
          url: await signedUrl(d.key),
        })),
      )),
      ...(await Promise.all(
        voiceNotes.map(async (d) => ({
          type: "voice" as const,
          ...d,
          url: await signedUrl(d.key),
        })),
      )),
    ];
    return items.sort((a, b) => a.happenedAt - b.happenedAt);
  },
});

const tags = v.optional(v.array(v.string()));
const location = v.optional(v.string());

export const addFlight = memberMutation({
  args: {
    airline: v.string(),
    flightNumber: v.string(),
    from: v.string(),
    to: v.string(),
    departAt: v.number(),
    arriveAt: v.number(),
    tags,
    location,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("flights", {
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      happenedAt: args.departAt,
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
    location,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("drives", {
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      happenedAt: args.plannedAt,
      ...args,
    });
  },
});

export const addNote = memberMutation({
  args: { content: v.any(), tags, location, happenedAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("notes", {
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
      happenedAt: args.happenedAt ?? Date.now(),
    });
  },
});

export const updateNote = memberMutation({
  args: { noteId: v.id("notes"), content: v.any() },
  handler: async (ctx, { noteId, content }) => {
    const note = await ctx.db.get(noteId);
    if (!note || note.memoryId !== ctx.memory._id)
      throw new Error("Note not found");
    await ctx.db.patch(noteId, { content });
  },
});

export const addImage = memberMutation({
  args: {
    key: v.string(),
    caption: v.optional(v.string()),
    tags,
    location,
    happenedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", {
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
      happenedAt: args.happenedAt ?? Date.now(),
    });
  },
});

export const addVoice = memberMutation({
  args: {
    key: v.string(),
    durationMs: v.optional(v.number()),
    tags,
    location,
    happenedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("voiceNotes", {
      memoryId: ctx.memory._id,
      createdBy: ctx.userId,
      ...args,
      happenedAt: args.happenedAt ?? Date.now(),
    });
  },
});

export const setTags = memberMutation({
  args: { type: itemType, id: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const itemId = ctx.db.normalizeId(TABLE[args.type], args.id);
    const item = itemId && (await ctx.db.get(itemId));
    if (!item || item.memoryId !== ctx.memory._id)
      throw new Error("Item not found");
    await ctx.db.patch(item._id, { tags: args.tags });
  },
});

export const remove = authedMutation({
  // id is v.string() + normalizeId so a stale/forged id no-ops instead of throwing.
  args: { type: itemType, id: v.string() },
  handler: async (ctx, { type, id }) => {
    const itemId = ctx.db.normalizeId(TABLE[type], id);
    if (!itemId) return;
    const item = await ctx.db.get(itemId);
    if (!item) return;
    const { membership } = await requireMembership(ctx, item.memoryId);
    if (item.createdBy !== ctx.userId && membership.role !== "owner")
      throw new Error("Only the creator or owner can delete this");
    await ctx.db.delete(item._id);
    if ("key" in item) {
      await r2.deleteObject(ctx, item.key);
    }
  },
});
