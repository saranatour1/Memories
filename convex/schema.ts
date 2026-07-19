import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

// Fields shared by every item table.
const itemBase = {
  memoryId: v.id("memories"),
  createdBy: v.string(),
  tags: v.optional(v.array(v.string())),
  happenedAt: v.number(), // real event time (ms epoch)
  location: v.optional(v.string()), // plain string for now, no geo
};

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  trips: defineTable({
    title: v.string(),
    description: v.optional(v.any()), // Tiptap JSON
    ownerId: v.string(),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  tripMembers: defineTable({
    tripId: v.id("trips"),
    userId: v.string(),
    role: literals("owner", "member"),
  })
    .index("by_trip_and_user", ["tripId", "userId"])
    .index("by_user", ["userId"]),

  memories: defineTable({
    title: v.string(),
    description: v.optional(v.any()), // Tiptap JSON
    ownerId: v.string(),
    status: literals("draft", "published"),
    inviteToken: v.string(),
    tripId: v.optional(v.id("trips")),
    // Time span the memory covers (ms epoch); optional for undated memories.
    kind: v.optional(literals("day", "week", "month", "trip", "custom")),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_token", ["inviteToken"])
    .index("by_trip", ["tripId"]),

  // One panel per calendar day of a memory: how the day looked (past) and
  // how it could look (future). Weeks/months are derived groupings in the UI.
  days: defineTable({
    memoryId: v.id("memories"),
    date: v.string(), // YYYY-MM-DD
    past: v.optional(v.any()), // Tiptap JSON
    future: v.optional(v.any()), // Tiptap JSON
  }).index("by_memory_date", ["memoryId", "date"]),

  members: defineTable({
    memoryId: v.id("memories"),
    userId: v.string(),
    role: literals("owner", "member"),
  })
    .index("by_memory_user", ["memoryId", "userId"])
    .index("by_user", ["userId"]),

  flights: defineTable({
    ...itemBase,
    airline: v.string(),
    flightNumber: v.string(),
    from: v.string(),
    to: v.string(),
    departAt: v.number(),
    arriveAt: v.number(),
  }).index("by_memory_and_happenedAt", ["memoryId", "happenedAt"]),

  drives: defineTable({
    ...itemBase,
    from: v.string(),
    to: v.string(),
    plannedAt: v.number(),
    notes: v.optional(v.string()),
  }).index("by_memory_and_happenedAt", ["memoryId", "happenedAt"]),

  notes: defineTable({
    ...itemBase,
    content: v.any(), // Tiptap JSON
  }).index("by_memory_and_happenedAt", ["memoryId", "happenedAt"]),

  images: defineTable({
    ...itemBase,
    key: v.string(), // R2 object key
    caption: v.optional(v.string()),
  }).index("by_memory_and_happenedAt", ["memoryId", "happenedAt"]),

  voiceNotes: defineTable({
    ...itemBase,
    key: v.string(), // R2 object key
    durationMs: v.optional(v.number()),
  }).index("by_memory_and_happenedAt", ["memoryId", "happenedAt"]),
});
