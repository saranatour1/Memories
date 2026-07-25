import { useState } from "react";
import {
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Editor } from "~/components/editor";
import { Label } from "~/components/ui/label";
import { DateTime } from "luxon";
import { DAY_MS, utcDate } from "~/lib/memory";

// Day panels for the memory's date range: pick a day, write how it looked
// (past) and how it could look (future). Days are grouped into calendar
// months, laid out in weeks.
export function DaysSection({
  memoryId,
  startAt,
  endAt,
}: {
  memoryId: Id<"memories">;
  startAt?: number;
  endAt?: number;
}) {
  const daysResult = useQuery({ query: api.days.list, args: { memoryId } });
  const days = daysResult.status === "success" ? daysResult.data : undefined;
  const upsert = useMutation(api.days.upsert);
  const [openDate, setOpenDate] = useState<string | null>(null);

  if (startAt === undefined || endAt === undefined || endAt < startAt) {
    return (
      <p className="mb-8 text-sm text-muted-foreground">
        Set start and end dates above to plan day by day.
      </p>
    );
  }

  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const dates: string[] = [];
  // ponytail: capped at 366 days; split bigger spans into separate memories
  for (let t = startAt; t <= endAt && dates.length <= 366; t += DAY_MS) {
    dates.push(DateTime.fromMillis(t, { zone: "utc" }).toISODate() ?? "");
  }
  const months = new Map<string, string[]>();
  for (const d of dates) {
    const key = d.slice(0, 7);
    const list = months.get(key) ?? [];
    list.push(d);
    months.set(key, list);
  }
  const open = openDate ? byDate.get(openDate) : undefined;

  return (
    <div className="mb-8">
      <h2 className="mb-2 text-sm font-medium">Days</h2>
      {[...months.entries()].map(([month, monthDates]) => (
        <div key={month} className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">
            {utcDate(`${month}-01`).toLocaleString({
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {/* offset so each row is a real Sunday-to-Saturday week
                (luxon weekday is Mon=1…Sun=7, so %7 puts Sunday at 0) */}
            {Array.from({
              length: utcDate(monthDates[0]).weekday % 7,
            }).map((_, i) => (
              <span key={i} />
            ))}
            {monthDates.map((date) => {
              const hasContent =
                byDate.get(date)?.past !== undefined ||
                byDate.get(date)?.future !== undefined;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setOpenDate(openDate === date ? null : date)}
                  className={`rounded-md border px-1 py-1.5 text-xs ${
                    openDate === date
                      ? "border-primary bg-primary text-primary-foreground"
                      : hasContent
                        ? "bg-muted font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {openDate && (
        <div key={openDate} className="mt-3 rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">
            {utcDate(openDate).toLocaleString(DateTime.DATE_HUGE)}
          </p>
          <Label className="mb-1 block text-xs text-muted-foreground">
            How the day looked
          </Label>
          <Editor
            content={open?.past}
            onUpdate={(past) => upsert({ memoryId, date: openDate, past })}
            className="mb-3"
          />
          <Label className="mb-1 block text-xs text-muted-foreground">
            How it could look
          </Label>
          <Editor
            content={open?.future}
            onUpdate={(future) => upsert({ memoryId, date: openDate, future })}
          />
        </div>
      )}
    </div>
  );
}
