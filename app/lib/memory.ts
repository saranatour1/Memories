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

const RELATIVE_UNITS = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
] as const;

/** "yesterday", "in 3 months", "now" — largest unit that fits. */
export const relative = (ms: number, now = Date.now()) => {
  const diff = ms - now;
  const [unit, size] =
    RELATIVE_UNITS.find(([, s]) => Math.abs(diff) >= s) ??
    RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return new Intl.RelativeTimeFormat([], { numeric: "auto" }).format(
    Math.round(diff / size),
    unit,
  );
};

export const count = (n: number) => new Intl.NumberFormat([]).format(n);

export const toDateInput = (ms?: number) =>
  ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10);

export const parseTags = (raw: FormDataEntryValue | string | null) => {
  const tags = String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
};
