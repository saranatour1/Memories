import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useConvexAuth,
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import { ChevronLeft, ChevronRight, Mic, Plane, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuthKitUser } from "~/lib/auth";
import { DateTime } from "luxon";
import { count, DAY_MS, type MemoryListItem } from "~/lib/memory";
import { Button } from "~/components/ui/button";
import { MemoryCard } from "~/components/memory-card";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Memories" },
    { name: "description", content: "Plan trips and keep memories together" },
  ];
}

export default function Home() {
  const user = useAuthKitUser();
  if (!user) return <SignedOut />;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Dashboard />
    </main>
  );
}

const features = [
  {
    icon: Plane,
    title: "Plan the trip",
    text: "Flights and drives land on one shared timeline, in order.",
  },
  {
    icon: Users,
    title: "Bring people in",
    text: "Share one link. Everyone sees changes the moment they happen.",
  },
  {
    icon: Mic,
    title: "Keep everything",
    text: "Notes, photos and voice memos live alongside the plan.",
  },
];

function SignedOut() {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">Memories</span>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href="/login" />}
        >
          Sign in
        </Button>
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-4 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Trips, planned and remembered — together
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          One place for the plan,
          <br />
          and everything worth keeping.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-muted-foreground">
          Add flights and drives, invite the people going, and watch the trip
          come together in realtime. Drafts stay private until you publish.
        </p>
        <Button
          size="lg"
          className="mt-8"
          nativeButton={false}
          render={<a href="/login" />}
        >
          Get started
        </Button>
        <div className="mt-16 grid w-full gap-8 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon className="mb-3 size-5 text-muted-foreground" />
              <h2 className="text-sm font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
        Memories — plan it, live it, keep it.
      </footer>
    </main>
  );
}

function Dashboard() {
  const user = useAuthKitUser();
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensure);
  const create = useMutation(api.memories.create);
  const navigate = useNavigate();
  const result = useQuery({
    query: api.memories.listMine,
    args: isAuthenticated ? {} : "skip",
  });
  const memories = result.status === "success" ? result.data : undefined;
  const ensured = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || ensured.current) return;
    ensured.current = true;
    ensure({
      email: user.email ?? undefined,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
      avatarUrl: user.profilePictureUrl ?? undefined,
    });
  }, [isAuthenticated, user, ensure]);

  const drafts = (memories ?? []).filter((m) => m.status === "draft");
  const published = (memories ?? []).filter((m) => m.status === "published");
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Button onClick={async () => navigate(`/memory/${await create({})}`)}>
          New memory
        </Button>
        <div className="flex gap-1">
          {(["list", "calendar"] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView(v)}
            >
              {v === "list" ? "List" : "Calendar"}
            </Button>
          ))}
        </div>
      </div>
      {result.status === "error" ? (
        <p className="text-muted-foreground">
          Couldn't load your memories. Try reloading.
        </p>
      ) : memories === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : view === "calendar" ? (
        <CalendarView memories={memories} />
      ) : (
        <>
          <MemoryList title="Drafts" memories={drafts} />
          <MemoryList title="Published" memories={published} />
        </>
      )}
    </div>
  );
}

type Memory = MemoryListItem;

function CalendarView({ memories }: { memories: Memory[] }) {
  // The grid is UTC-dated (that's how memory dates are stored), but it opens
  // on the viewer's current month.
  const [month, setMonth] = useState(() => {
    const now = DateTime.local();
    return DateTime.utc(now.year, now.month, 1).toMillis();
  });
  const first = DateTime.fromMillis(month, { zone: "utc" });
  const daysInMonth = first.daysInMonth ?? 0;
  // luxon weekday is Mon=1…Sun=7, so %7 puts Sunday at 0
  const offset = first.weekday % 7;

  const dated = memories.filter((m) => m.startAt !== undefined);
  const undatedCount = memories.length - dated.length;
  const onDay = (dayStart: number) =>
    dated.filter(
      (m) =>
        m.startAt! < dayStart + DAY_MS && (m.endAt ?? m.startAt!) >= dayStart,
    );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">
          {first.toLocaleString({ month: "long", year: "numeric" })}
        </h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(first.minus({ months: 1 }).toMillis())}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(first.plus({ months: 1 }).toMillis())}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayStart = first.plus({ days: i }).toMillis();
          const hits = onDay(dayStart);
          return (
            <div
              key={i}
              className="min-h-16 rounded-md border p-1 text-xs"
            >
              <span className="text-muted-foreground">{i + 1}</span>
              {hits.map((m) => (
                <Link
                  key={m._id}
                  to={`/memory/${m._id}`}
                  className="mt-0.5 block truncate rounded bg-primary/10 px-1 py-0.5 text-primary hover:bg-primary/20"
                  title={m.title}
                >
                  {m.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      {undatedCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {count(undatedCount)}{" "}
          {undatedCount === 1 ? "memory has" : "memories have"} no
          dates and only appear in the list view.
        </p>
      )}
    </section>
  );
}

function MemoryList({
  title,
  memories,
}: {
  title: string;
  memories: { _id: string; title: string; role: string }[];
}) {
  if (memories.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-3">
        {memories.map((m) => (
          <MemoryCard key={m._id} memory={m} />
        ))}
      </div>
    </section>
  );
}
