import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

export type MemoryDoc = NonNullable<
  FunctionReturnType<typeof api.memories.get>
>;
export type Item = FunctionReturnType<typeof api.items.list>[number];
export type MemoryListItem = FunctionReturnType<
  typeof api.memories.listMine
>[number];

export const MEMORY_KINDS = ["day", "week", "month", "trip", "custom"] as const;

export const DAY_MS = 86_400_000;

export const when = (ms: number) =>
  new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export const toDateInput = (ms?: number) =>
  ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10);

export const parseTags = (raw: FormDataEntryValue | string | null) => {
  const tags = String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
};
