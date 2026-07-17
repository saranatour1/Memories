import { v } from "convex/values";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function requireIdentity(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity;
}

export async function requireMembership(
  ctx: QueryCtx,
  memoryId: Id<"memories">,
) {
  const identity = await requireIdentity(ctx);
  const userId = identity.subject;
  const memory = await ctx.db.get(memoryId);
  if (!memory) throw new Error("Memory not found");
  const membership = await ctx.db
    .query("members")
    .withIndex("by_memory_user", (q) =>
      q.eq("memoryId", memoryId).eq("userId", userId),
    )
    .unique();
  if (!membership) throw new Error("Not a member of this memory");
  return { userId, memory, membership };
}

const authed = customCtx(async (ctx: QueryCtx) => {
  const identity = await requireIdentity(ctx);
  return { identity, userId: identity.subject };
});

export const authedQuery = customQuery(query, authed);
export const authedMutation = customMutation(mutation, authed);

const memberInput = {
  args: { memoryId: v.id("memories") },
  input: async (ctx: QueryCtx, { memoryId }: { memoryId: Id<"memories"> }) => ({
    ctx: await requireMembership(ctx, memoryId),
    args: {},
  }),
};

export const memberQuery = customQuery(query, memberInput);
export const memberMutation = customMutation(mutation, memberInput);
