import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const OWNER = "user_01KPV0ZSC23E7FWQ8XXVDGHRER";
const TITLE = "Sample trip: Amman → Lisbon (seeded)";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const day = (d: string) => Date.parse(`2026-08-${d}`);

// Re-runnable test fixture: deletes the previously seeded memory (matched by
// title) and recreates it with flights, drives, tagged notes and day panels.
export const run = internalMutation({
  args: {},
  returns: v.object({
    memoryId: v.id("memories"),
    items: v.number(),
    days: v.number(),
  }),
  handler: async (ctx) => {
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
      for await (const row of ctx.db
        .query("items")
        .withIndex("by_memory", (q) => q.eq("memoryId", existing._id))) {
        await ctx.db.delete(row._id);
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

    const memoryId = await ctx.db.insert("memories", {
      title: TITLE,
      description: doc(
        "A seeded week in Lisbon to test lists, tags, day panels, the calendar and the player.",
      ),
      ownerId: OWNER,
      status: "draft",
      inviteToken: crypto.randomUUID(),
      kind: "trip",
      startAt: day("10"),
      endAt: day("16"),
    });
    await ctx.db.insert("members", { memoryId, userId: OWNER, role: "owner" });

    const base = { memoryId, createdBy: OWNER };
    const items = [
      { ...base, type: "flight" as const, airline: "TAP", flightNumber: "TP1024", from: "AMM", to: "LIS", departAt: day("10") + 8 * 3600_000, arriveAt: day("10") + 13 * 3600_000, tags: ["travel", "outbound"] },
      { ...base, type: "flight" as const, airline: "TAP", flightNumber: "TP1025", from: "LIS", to: "AMM", departAt: day("16") + 15 * 3600_000, arriveAt: day("16") + 22 * 3600_000, tags: ["travel", "return"] },
      { ...base, type: "drive" as const, from: "Lisbon", to: "Sintra", plannedAt: day("12") + 9 * 3600_000, notes: "Pena Palace day trip", tags: ["day-trip", "sightseeing"] },
      { ...base, type: "drive" as const, from: "Lisbon", to: "Cascais", plannedAt: day("14") + 10 * 3600_000, tags: ["day-trip", "beach"] },
      { ...base, type: "note" as const, content: doc("Pack sunscreen, adapter plugs, and the good camera."), tags: ["packing", "todo"] },
      { ...base, type: "note" as const, content: doc("Restaurant list: Time Out Market, Cervejaria Ramiro, Pastéis de Belém."), tags: ["food"] },
      { ...base, type: "note" as const, content: doc("Fado night in Alfama on Thursday?"), tags: ["evening", "music", "maybe"] },
    ];
    for (const item of items) await ctx.db.insert("items", item);

    const days = [
      { date: "2026-08-10", past: doc("Landed, tram 28 at sunset, dinner in Bairro Alto."), future: doc("Could add a river cruise if we land earlier next time.") },
      { date: "2026-08-12", past: doc("Sintra was misty and perfect."), future: doc("Book Pena tickets in advance, queue was long.") },
      { date: "2026-08-15", future: doc("Free day — maybe LX Factory market, maybe nothing at all.") },
    ];
    for (const d of days) await ctx.db.insert("days", { memoryId, ...d });

    return { memoryId, items: items.length, days: days.length };
  },
});
