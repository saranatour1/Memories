import { v } from "convex/values";
import { authedMutation } from "./helpers";

export const ensure = authedMutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = {
      userId: ctx.userId,
      email: (ctx.identity.email as string | undefined) ?? args.email ?? "",
      name: (ctx.identity.name as string | undefined) ?? args.name,
      avatarUrl:
        (ctx.identity.pictureUrl as string | undefined) ?? args.avatarUrl,
    };
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, profile);
      return existing._id;
    }
    return await ctx.db.insert("users", profile);
  },
});
