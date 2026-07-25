import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

// TODO: After fixing the domain DNS we do this
export const r2 = new R2(components.r2);

export const { generateUploadUrl, syncMetadata } = r2.clientApi<DataModel>({
  checkUpload: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
  },
});
