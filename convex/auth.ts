import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// Typed indirection breaks the TS circularity of referencing this file's own exports.
const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

type WorkOSUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

async function upsertUser(ctx: MutationCtx, user: WorkOSUser) {
  const profile = {
    userId: user.id,
    email: user.email,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    avatarUrl: user.profilePictureUrl ?? undefined,
  };
  const existing = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", user.id))
    .unique();
  if (existing) await ctx.db.patch(existing._id, profile);
  else await ctx.db.insert("users", profile);
}

// WorkOS pushes user changes to the component's webhook route (signature
// verification handled by the component); these handlers mirror them into
// the app's users table.
export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await upsertUser(ctx, event.data);
  },
  "user.updated": async (ctx, event) => {
    await upsertUser(ctx, event.data);
  },
  "user.deleted": async (ctx, event) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", event.data.id))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const { backfillUsers } = authKit.utils();
