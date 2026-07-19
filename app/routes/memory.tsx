import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { authkitLoader } from "@workos-inc/authkit-react-router";
import {
  useConvexAuth,
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Car,
  Mic,
  Pause,
  Plane,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuthKitUser } from "~/lib/auth";
import { Editor, RichText } from "~/components/editor";
import { AddImageButton, AddVoiceButton } from "~/components/media";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { Route } from "./+types/memory";

export const loader = (args: Route.LoaderArgs) =>
  authkitLoader(args, { ensureSignedIn: true });

type MemoryDoc = NonNullable<FunctionReturnType<typeof api.memories.get>>;
type Item = FunctionReturnType<typeof api.items.list>[number];

const when = (ms: number) =>
  new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const DAY_MS = 86_400_000;
const toDateInput = (ms?: number) =>
  ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10);
const parseTags = (raw: FormDataEntryValue | null) => {
  const tags = String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
};

const MEMORY_KINDS = ["day", "week", "month", "trip", "custom"] as const;

export default function MemoryPage() {
  const { id } = useParams();
  const memoryId = id as Id<"memories">;
  const { isAuthenticated } = useConvexAuth();
  const memory = useQuery({
    query: api.memories.get,
    args: isAuthenticated ? { memoryId } : "skip",
  });
  const items = useQuery({
    query: api.items.list,
    args:
      isAuthenticated && memory.status === "success" && memory.data
        ? { memoryId }
        : "skip",
  });

  if (memory.status === "pending") {
    return <Shell>Loading…</Shell>;
  }
  if (memory.status === "error") {
    return <Shell>Something went wrong loading this memory. Try reloading.</Shell>;
  }
  if (memory.data === null) {
    return (
      <Shell>
        You're not a member of this memory. Ask the owner for an invite link.
      </Shell>
    );
  }
  return (
    <MemoryView
      memory={memory.data}
      items={items.status === "success" ? items.data : []}
      memoryId={memoryId}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Memories
      </Link>
      <p className="mt-10 text-center text-muted-foreground">{children}</p>
    </main>
  );
}

function MemoryView({
  memory,
  items,
  memoryId,
}: {
  memory: MemoryDoc;
  items: Item[];
  memoryId: Id<"memories">;
}) {
  const user = useAuthKitUser();
  const update = useMutation(api.memories.update);
  const setStatus = useMutation(api.memories.setStatus);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  const [watching, setWatching] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const save = async (patch: {
    title?: string;
    description?: unknown;
    kind?: (typeof MEMORY_KINDS)[number];
    startAt?: number | null;
    endAt?: number | null;
  }) => {
    setSaved("saving");
    await update({ memoryId, ...patch });
    setSaved("saved");
  };

  const sortKey = (i: Item) =>
    i.type === "flight"
      ? i.departAt
      : i.type === "drive"
        ? i.plannedAt
        : i._creationTime;
  const sorted = [...items].sort((a, b) => sortKey(a) - sortKey(b));
  const isOwner = memory.role === "owner";
  const nameOf = (userId: string) =>
    memory.members.find((m) => m.userId === userId)?.name ?? "Someone";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Memories
        </Link>
        <span className="text-xs text-muted-foreground">
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-3">
        <Input
          key={memory._id}
          defaultValue={memory.title}
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl"
          onChange={(e) => {
            clearTimeout(titleTimer.current);
            const title = e.target.value;
            titleTimer.current = setTimeout(() => save({ title }), 750);
          }}
        />
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {memory.status}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <MemberAvatars members={memory.members} />
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(
              `${location.origin}/join/${memory.inviteToken}`,
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy invite link"}
        </Button>
        {isOwner && (
          <Button
            size="sm"
            onClick={() =>
              setStatus({
                memoryId,
                status: memory.status === "draft" ? "published" : "draft",
              })
            }
          >
            {memory.status === "draft" ? "Publish" : "Unpublish"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setWatching(true)}>
          <Play className="size-4" /> Watch
        </Button>
      </div>

      {watching && (
        <MemoryPlayer
          memoryId={memoryId}
          title={memory.title}
          items={items}
          onClose={() => setWatching(false)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <select
          value={memory.kind ?? ""}
          onChange={(e) =>
            e.target.value &&
            save({ kind: e.target.value as (typeof MEMORY_KINDS)[number] })
          }
          className="h-9 rounded-md border bg-transparent px-2"
        >
          <option value="" disabled>
            Type of memory
          </option>
          {MEMORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <Input
          type="date"
          className="w-auto"
          defaultValue={toDateInput(memory.startAt)}
          onChange={(e) =>
            save({ startAt: e.target.value ? Date.parse(e.target.value) : null })
          }
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          className="w-auto"
          defaultValue={toDateInput(memory.endAt)}
          onChange={(e) =>
            save({ endAt: e.target.value ? Date.parse(e.target.value) : null })
          }
        />
      </div>

      <Editor
        content={memory.description}
        onUpdate={(description) => save({ description })}
        className="mb-8"
      />

      <DaysSection
        memoryId={memoryId}
        startAt={memory.startAt}
        endAt={memory.endAt}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Add:</span>
        <FlightDialog memoryId={memoryId} />
        <DriveDialog memoryId={memoryId} />
        <NoteDialog memoryId={memoryId} />
        <AddImageButton memoryId={memoryId} />
        <AddVoiceButton memoryId={memoryId} />
      </div>

      <div className="flex flex-col gap-3">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing planned yet. Add a flight, drive or note above.
          </p>
        )}
        {sorted.map((item) => (
          <ItemRow
            key={item._id}
            item={item}
            canDelete={isOwner || item.createdBy === user?.id}
            authorName={nameOf(item.createdBy)}
          />
        ))}
      </div>
    </main>
  );
}

const SLIDE_MS = 4000;
const SPEEDS = [0.5, 1, 1.5, 2] as const;

type Slide =
  | { kind: "day"; time: number; date: string; past?: unknown; future?: unknown }
  | { kind: "item"; time: number; item: Item };

// Plays the memory back like a video: one slide per day panel and per item,
// in chronological order, auto-advancing with adjustable speed.
function MemoryPlayer({
  memoryId,
  title,
  items,
  onClose,
}: {
  memoryId: Id<"memories">;
  title: string;
  items: Item[];
  onClose: () => void;
}) {
  const daysResult = useQuery({ query: api.days.list, args: { memoryId } });
  const days = daysResult.status === "success" ? daysResult.data : undefined;
  const slides = useMemo<Slide[]>(() => {
    const itemTime = (i: Item) =>
      i.type === "flight"
        ? i.departAt
        : i.type === "drive"
          ? i.plannedAt
          : i._creationTime;
    return [
      ...(days ?? [])
        .filter((d) => d.past !== undefined || d.future !== undefined)
        .map((d) => ({
          kind: "day" as const,
          time: Date.parse(d.date),
          date: d.date,
          past: d.past,
          future: d.future,
        })),
      ...items.map((item) => ({
        kind: "item" as const,
        time: itemTime(item),
        item,
      })),
    ].sort((a, b) => a.time - b.time);
  }, [days, items]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  useEffect(() => {
    if (!playing || slides.length === 0) return;
    if (index >= slides.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex(index + 1), SLIDE_MS / speed);
    return () => clearTimeout(t);
  }, [playing, index, speed, slides.length]);

  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">{title}</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4">
        {slides.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing to watch yet — add day panels or items first.
          </p>
        ) : (
          <div key={index} className="w-full max-w-xl">
            <SlideView slide={slide} />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-6">
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width:
                slides.length === 0
                  ? "0%"
                  : `${((index + 1) / slides.length) * 100}%`,
            }}
          />
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (!playing && index >= slides.length - 1) setIndex(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={index >= slides.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            <SkipForward className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-14"
            onClick={() =>
              setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])
            }
          >
            {speed}×
          </Button>
          <span className="text-xs text-muted-foreground">
            {slides.length === 0 ? "0 / 0" : `${index + 1} / ${slides.length}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  if (slide.kind === "day") {
    return (
      <div>
        <p className="mb-4 text-center text-lg font-medium">
          {new Date(slide.date).toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        {slide.past !== undefined && (
          <div className="mb-4">
            <p className="mb-1 text-xs uppercase text-muted-foreground">
              How the day looked
            </p>
            <RichText content={slide.past} />
          </div>
        )}
        {slide.future !== undefined && (
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">
              How it could look
            </p>
            <RichText content={slide.future} />
          </div>
        )}
      </div>
    );
  }
  const { item } = slide;
  return (
    <div className="text-center">
      {item.type === "flight" && (
        <div>
          <Plane className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-lg font-medium">
            {item.airline} {item.flightNumber}
          </p>
          <p className="text-muted-foreground">
            {item.from} → {item.to}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {when(item.departAt)} → {when(item.arriveAt)}
          </p>
        </div>
      )}
      {item.type === "drive" && (
        <div>
          <Car className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-lg font-medium">
            {item.from} → {item.to}
          </p>
          {item.notes && <p className="text-muted-foreground">{item.notes}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {when(item.plannedAt)}
          </p>
        </div>
      )}
      {item.type === "note" && (
        <div className="text-left">
          <RichText content={item.content} />
        </div>
      )}
      {item.type === "image" && item.url && (
        <img
          src={item.url}
          alt={item.caption ?? "Photo"}
          className="mx-auto max-h-[60vh] rounded-lg"
        />
      )}
      {item.type === "voice" && (
        <div>
          <Mic className="mx-auto mb-3 size-8 text-muted-foreground" />
          {item.url && (
            <audio controls src={item.url} className="mx-auto" />
          )}
        </div>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Day panels for the memory's date range: pick a day, write how it looked
// (past) and how it could look (future). Days are grouped into calendar
// months, laid out in weeks.
function DaysSection({
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
    dates.push(new Date(t).toISOString().slice(0, 10));
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
            {new Date(`${month}-01`).toLocaleDateString([], {
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {/* offset so each row is a real Sunday-to-Saturday week */}
            {Array.from({
              length: new Date(monthDates[0]).getUTCDay(),
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
                  onClick={() =>
                    setOpenDate(openDate === date ? null : date)
                  }
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
            {new Date(openDate).toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
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

function MemberAvatars({ members }: { members: MemoryDoc["members"] }) {
  return (
    <div className="flex -space-x-2">
      {members.map((m) =>
        m.avatarUrl ? (
          <img
            key={m.userId}
            src={m.avatarUrl}
            alt={m.name ?? m.email ?? "Member"}
            title={m.name ?? m.email ?? undefined}
            className="size-7 rounded-full border-2 border-background"
          />
        ) : (
          <span
            key={m.userId}
            title={m.name ?? m.email ?? undefined}
            className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs"
          >
            {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
          </span>
        ),
      )}
    </div>
  );
}

function ItemRow({
  item,
  canDelete,
  authorName,
}: {
  item: Item;
  canDelete: boolean;
  authorName: string;
}) {
  const remove = useMutation(api.items.remove);
  return (
    <div className="group rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.type === "flight" && (
            <div className="flex items-center gap-2 text-sm">
              <Plane className="size-4 shrink-0" />
              <span className="font-medium">
                {item.airline} {item.flightNumber}
              </span>
              <span>
                {item.from} → {item.to}
              </span>
            </div>
          )}
          {item.type === "drive" && (
            <div className="flex items-center gap-2 text-sm">
              <Car className="size-4 shrink-0" />
              <span className="font-medium">
                {item.from} → {item.to}
              </span>
              {item.notes && (
                <span className="text-muted-foreground">{item.notes}</span>
              )}
            </div>
          )}
          {item.type === "note" && <RichText content={item.content} />}
          {item.type === "image" &&
            (item.url ? (
              <img
                src={item.url}
                alt={item.caption ?? "Photo"}
                className="max-h-80 rounded-md"
              />
            ) : (
              <span className="text-sm text-muted-foreground">Photo…</span>
            ))}
          {item.type === "voice" && (
            <div className="flex items-center gap-2">
              <Mic className="size-4 shrink-0" />
              {item.url ? (
                <audio controls src={item.url} className="h-9 max-w-full" />
              ) : (
                <span className="text-sm text-muted-foreground">Voice note…</span>
              )}
            </div>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {item.type === "flight"
              ? `${when(item.departAt)} → ${when(item.arriveAt)}`
              : item.type === "drive"
                ? when(item.plannedAt)
                : when(item._creationTime)}
            {" · "}
            {authorName}
          </p>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => remove({ itemId: item._id })}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FlightDialog({ memoryId }: { memoryId: Id<"memories"> }) {
  const [open, setOpen] = useState(false);
  const addFlight = useMutation(api.items.addFlight);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Flight
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add flight</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await addFlight({
              memoryId,
              airline: f.get("airline") as string,
              flightNumber: f.get("flightNumber") as string,
              from: f.get("from") as string,
              to: f.get("to") as string,
              departAt: new Date(f.get("departAt") as string).getTime(),
              arriveAt: new Date(f.get("arriveAt") as string).getTime(),
              tags: parseTags(f.get("tags")),
            });
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field name="airline" label="Airline" />
            <Field name="flightNumber" label="Flight #" />
            <Field name="from" label="From" />
            <Field name="to" label="To" />
            <Field name="departAt" label="Departs" type="datetime-local" />
            <Field name="arriveAt" label="Arrives" type="datetime-local" />
          </div>
          <Field name="tags" label="Tags (comma separated)" required={false} />
          <Button type="submit">Add flight</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DriveDialog({ memoryId }: { memoryId: Id<"memories"> }) {
  const [open, setOpen] = useState(false);
  const addDrive = useMutation(api.items.addDrive);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Drive
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add planned drive</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await addDrive({
              memoryId,
              from: f.get("from") as string,
              to: f.get("to") as string,
              plannedAt: new Date(f.get("plannedAt") as string).getTime(),
              notes: (f.get("notes") as string) || undefined,
              tags: parseTags(f.get("tags")),
            });
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field name="from" label="From" />
            <Field name="to" label="To" />
            <Field name="plannedAt" label="When" type="datetime-local" />
            <Field name="notes" label="Notes" required={false} />
          </div>
          <Field name="tags" label="Tags (comma separated)" required={false} />
          <Button type="submit">Add drive</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ memoryId }: { memoryId: Id<"memories"> }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [tagsText, setTagsText] = useState("");
  const addNote = useMutation(api.items.addNote);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Note
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
        </DialogHeader>
        <Editor content={undefined} onUpdate={setContent} />
        <Input
          placeholder="Tags (comma separated)"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
        <Button
          disabled={content === null}
          onClick={async () => {
            await addNote({ memoryId, content, tags: parseTags(tagsText) });
            setContent(null);
            setTagsText("");
            setOpen(false);
          }}
        >
          Add note
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
