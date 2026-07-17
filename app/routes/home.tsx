import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Mic, Plane, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuthKitUser } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Memories</h1>
        <form method="post" action="/signout">
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </header>
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
        <Button variant="outline" size="sm" render={<a href="/login" />}>
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
        <Button size="lg" className="mt-8" render={<a href="/login" />}>
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
  const memories = useQuery(api.memories.listMine, isAuthenticated ? {} : "skip");
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

  return (
    <div className="flex flex-col gap-8">
      <Button
        className="self-start"
        onClick={async () => navigate(`/memory/${await create({})}`)}
      >
        New memory
      </Button>
      {memories === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <MemoryList title="Drafts" memories={drafts} />
          <MemoryList title="Published" memories={published} />
        </>
      )}
    </div>
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
          <Link key={m._id} to={`/memory/${m._id}`}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle>{m.title}</CardTitle>
                <CardDescription>
                  {m.role === "owner" ? "Owned by you" : "Shared with you"}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
