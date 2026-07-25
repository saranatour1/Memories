import { useEffect, useMemo, useState } from "react";
import { useQuery_experimental as useQuery } from "convex/react";
import {
  Car,
  Mic,
  Pause,
  Plane,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RichText } from "~/components/editor";
import { Button } from "~/components/ui/button";
import { count, type Item, relative, when } from "~/lib/memory";

const SLIDE_MS = 4000;
const SPEEDS = [0.5, 1, 1.5, 2] as const;

type Slide =
  | { kind: "day"; time: number; date: string; past?: unknown; future?: unknown }
  | { kind: "item"; time: number; item: Item };

// Plays the memory back like a video: one slide per day panel and per item,
// in chronological order, auto-advancing with adjustable speed.
export function MemoryPlayer({
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
        time: item.happenedAt,
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
            {slides.length === 0
              ? "0 / 0"
              : `${count(index + 1)} / ${count(slides.length)}`}
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
            timeZone: "UTC",
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
            {when(item.departAt)} → {when(item.arriveAt)} (
            {relative(item.departAt)})
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
            {when(item.plannedAt)} ({relative(item.plannedAt)})
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
          {item.url && <audio controls src={item.url} className="mx-auto" />}
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
