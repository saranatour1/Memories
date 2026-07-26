import type { FunctionReturnType } from "convex/server";
import { DateTime } from "luxon";
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
  DateTime.fromMillis(ms).toLocaleString(DateTime.DATETIME_MED);

/** "3 days ago", "in 2 months" — largest unit that fits. */
export const relative = (ms: number, base = DateTime.now()) =>
  DateTime.fromMillis(ms).toRelative({ base }) ?? "";

// ponytail: luxon has no number formatting, so this stays native Intl.
export const count = (n: number) => new Intl.NumberFormat([]).format(n);

/**
 * Day dates are stored as UTC midnight, so they must be read in UTC —
 * parsing them locally shifts the day for anyone west of UTC. See #1.
 */
export const utcDate = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

export const toDateInput = (ms?: number) =>
  ms === undefined
    ? ""
    : (DateTime.fromMillis(ms, { zone: "utc" }).toISODate() ?? "");

/** `<input type="date">` value → UTC-midnight ms, matching how dates are stored. */
export const fromDateInput = (value: string) =>
  DateTime.fromISO(value, { zone: "utc" }).toMillis();

/** `<input type="datetime-local">` value → ms in the viewer's own zone. */
export const fromLocalInput = (value: FormDataEntryValue | null) =>
  DateTime.fromISO(String(value ?? "")).toMillis();

/** `65_000` → `"1:05"`; includes an hours segment past 60 minutes. */
export const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
    : `${minutes}:${ss}`;
};

export const parseTags = (raw: FormDataEntryValue | string | null) => {
  const tags = String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
};
