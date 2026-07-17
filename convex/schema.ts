import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const itemBase = {
  memoryId: v.id("memories"),
  createdBy: v.string(),
};

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  memories: defineTable({
    title: v.string(),
    description: v.optional(v.any()), // Tiptap JSON
    ownerId: v.string(),
    status: literals("draft", "published"),
    inviteToken: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_token", ["inviteToken"]),

  members: defineTable({
    memoryId: v.id("memories"),
    userId: v.string(),
    role: literals("owner", "member"),
  })
    .index("by_memory_user", ["memoryId", "userId"])
    .index("by_user", ["userId"]),

  items: defineTable(
    v.union(
      v.object({
        ...itemBase,
        type: v.literal("flight"),
        airline: v.string(),
        flightNumber: v.string(),
        from: v.string(),
        to: v.string(),
        departAt: v.number(),
        arriveAt: v.number(),
      }),
      v.object({
        ...itemBase,
        type: v.literal("drive"),
        from: v.string(),
        to: v.string(),
        plannedAt: v.number(),
        notes: v.optional(v.string()),
      }),
      v.object({
        ...itemBase,
        type: v.literal("note"),
        content: v.any(), // Tiptap JSON
      }),
      v.object({
        ...itemBase,
        type: v.literal("image"),
        key: v.string(), // R2 object key
        caption: v.optional(v.string()),
      }),
      v.object({
        ...itemBase,
        type: v.literal("voice"),
        key: v.string(), // R2 object key
        durationMs: v.optional(v.number()),
      }),
    ),
  ).index("by_memory", ["memoryId"]),
});
