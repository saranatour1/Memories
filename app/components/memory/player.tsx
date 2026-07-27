import { useEffect, useMemo, useState } from "react";
import { useQuery_experimental as useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
import { DateTime } from "luxon";
import {
  count,
  type Item,
  relative,
  textLength,
  utcDate,
  when,
} from "~/lib/memory";
import { VoiceAudio } from "~/components/memory/voice-audio";

const SLIDE_MS = 4000;
const MIN_SLIDE_MS = 3000;
const MAX_SLIDE_MS = 15000;
const MAX_VOICE_SLIDE_MS = 30000;
const MS_PER_CHAR = 60;
const SPEEDS = [0.5, 1, 1.5, 2] as const;

type Slide =
  | { kind: "day"; time: number; date: string; past?: unknown; future?: unknown }
  | { kind: "item"; time: number; item: Item };

/** How long a slide should stay up, scaled to how much there is to read/hear. */
function slideDurationMs(slide: Slide): number {
  if (slide.kind === "day") {
    const chars = textLength(slide.past) + textLength(slide.future);
    return clamp(chars * MS_PER_CHAR, MIN_SLIDE_MS, MAX_SLIDE_MS);
  }
  if (slide.item.type === "note") {
    return clamp(
      textLength(slide.item.content) * MS_PER_CHAR,
      MIN_SLIDE_MS,
      MAX_SLIDE_MS,
    );
  }
  if (slide.item.type === "voice" && slide.item.durationMs) {
    return clamp(slide.item.durationMs, MIN_SLIDE_MS, MAX_VOICE_SLIDE_MS);
  }
  return SLIDE_MS;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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

  // Freeze the slide list the moment it's first available, so a reactive
  // update to `items` or `days` mid-playback can't reorder or resize it
  // out from under the viewer (see #13).
  const [itemsSnapshot] = useState(items);
  const [daysSnapshot, setDaysSnapshot] =
    useState<FunctionReturnType<typeof api.days.list>>();
  useEffect(() => {
    if (daysSnapshot === undefined && daysResult.status === "success") {
      setDaysSnapshot(daysResult.data);
    }
  }, [daysResult, daysSnapshot]);

  const slides = useMemo<Slide[]>(() => {
    return [
      ...(daysSnapshot ?? [])
        .filter((d) => d.past !== undefined || d.future !== undefined)
        .map((d) => ({
          kind: "day" as const,
          time: utcDate(d.date).toMillis(),
          date: d.date,
          past: d.past,
          future: d.future,
        })),
      ...itemsSnapshot.map((item) => ({
        kind: "item" as const,
        time: item.happenedAt,
        item,
      })),
    ].sort((a, b) => a.time - b.time);
  }, [daysSnapshot, itemsSnapshot]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setIndex((i) => Math.min(i + 1, slides.length - 1));
  const togglePlaying = () =>
    setPlaying((p) => {
      if (!p && index >= slides.length - 1) setIndex(0);
      return !p;
    });

  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))];

  useEffect(() => {
    if (!playing || slides.length === 0) return;
    if (index >= slides.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex(index + 1), slideDurationMs(slide) / speed);
    return () => clearTimeout(t);
  }, [playing, index, speed, slides.length, slide]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlaying();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
            onClick={goPrev}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={togglePlaying}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={index >= slides.length - 1}
            onClick={goNext}
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
          {utcDate(slide.date).toLocaleString(DateTime.DATE_HUGE)}
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
          {item.url && (
            <VoiceAudio
              url={item.url}
              mimeType={item.mimeType}
              className="mx-auto"
            />
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
