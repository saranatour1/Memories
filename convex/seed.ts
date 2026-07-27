import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const TITLE = "Sample trip: Amman → Lisbon (seeded)";
const TRIP_TITLE = "Summer 2026 (seeded)";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const day = (d: string) => Date.parse(`2026-08-${d}`);

const ITEM_TABLES = [
  "flights",
  "drives",
  "notes",
  "images",
  "voiceNotes",
] as const;

// Re-runnable test fixture: deletes the previously seeded trip + memory
// (matched by title) and recreates them with flights, drives, tagged notes
// and day panels.
export const run = internalMutation({
  args: {
    userId: v.optional(v.string()),
  },
  returns: v.object({
    tripId: v.id("trips"),
    memoryId: v.id("memories"),
    items: v.number(),
    days: v.number(),
  }),
  handler: async (ctx, args) => {
    const OWNER = args.userId ?? (await ctx.db.query("users").first())?.userId;
    if (!OWNER) {
      throw new Error(
        "No userId provided and no users exist yet — pass one explicitly: npx convex run seed:run '{\"userId\": \"user_...\"}'",
      );
    }

    let existing = null;
    for await (const m of ctx.db
      .query("memories")
      .withIndex("by_owner", (q) => q.eq("ownerId", OWNER))) {
      if (m.title === TITLE) {
        existing = m;
        break;
      }
    }
    if (existing) {
      for (const table of ITEM_TABLES) {
        for await (const row of ctx.db
          .query(table)
          .withIndex("by_memory_and_happenedAt", (q) =>
            q.eq("memoryId", existing._id),
          )) {
          await ctx.db.delete(row._id);
        }
      }
      for await (const row of ctx.db
        .query("days")
        .withIndex("by_memory_date", (q) => q.eq("memoryId", existing._id))) {
        await ctx.db.delete(row._id);
      }
      for await (const m of ctx.db
        .query("members")
        .withIndex("by_memory_user", (q) => q.eq("memoryId", existing._id))) {
        await ctx.db.delete(m._id);
      }
      await ctx.db.delete(existing._id);
    }
    for await (const t of ctx.db
      .query("trips")
      .withIndex("by_owner", (q) => q.eq("ownerId", OWNER))) {
      if (t.title !== TRIP_TITLE) continue;
      for await (const tm of ctx.db
        .query("tripMembers")
        .withIndex("by_trip_and_user", (q) => q.eq("tripId", t._id))) {
        await ctx.db.delete(tm._id);
      }
      await ctx.db.delete(t._id);
    }

    const tripId = await ctx.db.insert("trips", {
      title: TRIP_TITLE,
      ownerId: OWNER,
      startAt: day("01"),
      endAt: day("31"),
    });
    await ctx.db.insert("tripMembers", { tripId, userId: OWNER, role: "owner" });

    const memoryId = await ctx.db.insert("memories", {
      title: TITLE,
      description: doc(
        "A seeded week in Lisbon to test lists, tags, day panels, the calendar and the player.",
      ),
      ownerId: OWNER,
      status: "draft",
      inviteToken: crypto.randomUUID(),
      tripId,
      kind: "trip",
      startAt: day("10"),
      endAt: day("16"),
    });
    await ctx.db.insert("members", { memoryId, userId: OWNER, role: "owner" });

    const base = { memoryId, createdBy: OWNER };
    const flights = [
      { ...base, airline: "TAP", flightNumber: "TP1024", from: "AMM", to: "LIS", departAt: day("10") + 8 * 3600_000, arriveAt: day("10") + 13 * 3600_000, happenedAt: day("10") + 8 * 3600_000, tags: ["travel", "outbound"] },
      { ...base, airline: "TAP", flightNumber: "TP1025", from: "LIS", to: "AMM", departAt: day("16") + 15 * 3600_000, arriveAt: day("16") + 22 * 3600_000, happenedAt: day("16") + 15 * 3600_000, tags: ["travel", "return"] },
    ];
    const drives = [
      { ...base, from: "Lisbon", to: "Sintra", plannedAt: day("12") + 9 * 3600_000, happenedAt: day("12") + 9 * 3600_000, notes: "Pena Palace day trip", location: "Sintra", tags: ["day-trip", "sightseeing"] },
      { ...base, from: "Lisbon", to: "Cascais", plannedAt: day("14") + 10 * 3600_000, happenedAt: day("14") + 10 * 3600_000, location: "Cascais", tags: ["day-trip", "beach"] },
    ];
    const notes = [
      { ...base, content: doc("Pack sunscreen, adapter plugs, and the good camera."), happenedAt: day("09") + 20 * 3600_000, tags: ["packing", "todo"] },
      { ...base, content: doc("Restaurant list: Time Out Market, Cervejaria Ramiro, Pastéis de Belém."), happenedAt: day("11") + 12 * 3600_000, location: "Lisbon", tags: ["food"] },
      { ...base, content: doc("Fado night in Alfama on Thursday?"), happenedAt: day("13") + 21 * 3600_000, location: "Alfama, Lisbon", tags: ["evening", "music", "maybe"] },
    ];
    for (const f of flights) await ctx.db.insert("flights", f);
    for (const d of drives) await ctx.db.insert("drives", d);
    for (const n of notes) await ctx.db.insert("notes", n);

    const days = [
      { date: "2026-08-10", past: doc("Landed, tram 28 at sunset, dinner in Bairro Alto."), future: doc("Could add a river cruise if we land earlier next time.") },
      { date: "2026-08-12", past: doc("Sintra was misty and perfect."), future: doc("Book Pena tickets in advance, queue was long.") },
      { date: "2026-08-15", future: doc("Free day — maybe LX Factory market, maybe nothing at all.") },
    ];
    for (const d of days) await ctx.db.insert("days", { memoryId, ...d });

    return {
      tripId,
      memoryId,
      items: flights.length + drives.length + notes.length,
      days: days.length,
    };
  },
});
