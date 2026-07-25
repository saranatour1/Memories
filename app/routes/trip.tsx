import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { authkitLoader } from "@workos-inc/authkit-react-router";
import {
  useConvexAuth,
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuthKitUser } from "~/lib/auth";
import { fromDateInput, toDateInput } from "~/lib/memory";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { MemoryCard } from "~/components/memory-card";
import { Shell } from "~/components/shell";
import type { Route } from "./+types/trip";

export const loader = (args: Route.LoaderArgs) =>
  authkitLoader(args, { ensureSignedIn: true });

type TripDoc = NonNullable<FunctionReturnType<typeof api.trips.get>>;

export default function TripPage() {
  const { id } = useParams();
  const { isAuthenticated } = useConvexAuth();
  const trip = useQuery({
    query: api.trips.get,
    args: isAuthenticated ? { tripId: id ?? "" } : "skip",
  });

  if (trip.status === "pending") {
    return <Shell>Loading…</Shell>;
  }
  if (trip.status === "error") {
    return <Shell>Something went wrong loading this trip. Try reloading.</Shell>;
  }
  if (trip.data === null) {
    return <Shell>This trip doesn't exist, or you're not a member of it.</Shell>;
  }
  return <TripView trip={trip.data} />;
}

function TripView({ trip }: { trip: TripDoc }) {
  const user = useAuthKitUser();
  const { isAuthenticated } = useConvexAuth();
  const update = useMutation(api.trips.update);
  const addMemory = useMutation(api.trips.addMemory);
  const removeMemory = useMutation(api.trips.removeMemory);
  const createMemory = useMutation(api.memories.create);
  const navigate = useNavigate();
  // Edits stay local until the Save button sends them in one mutation.
  type Draft = { title?: string; startAt?: number | null; endAt?: number | null };
  const [draft, setDraft] = useState<Draft>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const setField = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = Object.keys(draft).length > 0;

  const saveAll = async () => {
    if (!dirty) return;
    setSaveFailed(false);
    try {
      await update({ tripId: trip._id, ...draft });
    } catch {
      setSaveFailed(true); // draft kept so Save can be retried
      return;
    }
    setDraft({});
  };

  const mine = useQuery({
    query: api.memories.listMine,
    args: isAuthenticated ? {} : "skip",
  });
  const ungrouped = (mine.status === "success" ? mine.data : []).filter(
    (m) => !m.tripId,
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <Input
          key={trip._id}
          defaultValue={trip.title}
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl"
          onChange={(e) => setField({ title: e.target.value })}
        />
        {saveFailed ? (
          <span className="text-xs text-destructive">Save failed</span>
        ) : dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved</span>
        ) : null}
        <Button
          variant={dirty ? "default" : "outline"}
          size="sm"
          disabled={!dirty}
          onClick={saveAll}
        >
          Save
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        <Input
          type="date"
          className="w-auto"
          defaultValue={toDateInput(trip.startAt)}
          onChange={(e) =>
            setField({
              startAt: e.target.value ? fromDateInput(e.target.value) : null,
            })
          }
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          className="w-auto"
          defaultValue={toDateInput(trip.endAt)}
          onChange={(e) =>
            setField({
              endAt: e.target.value ? fromDateInput(e.target.value) : null,
            })
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          onClick={async () =>
            navigate(`/memory/${await createMemory({ tripId: trip._id })}`)
          }
        >
          New memory
        </Button>
        {ungrouped.length > 0 && (
          <select
            value=""
            onChange={(e) =>
              e.target.value &&
              addMemory({
                tripId: trip._id,
                memoryId: e.target.value as Id<"memories">,
              })
            }
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="" disabled>
              Add existing memory…
            </option>
            {ungrouped.map((m) => (
              <option key={m._id} value={m._id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-3">
        {trip.memories.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No memories in this trip yet.
          </p>
        )}
        {trip.memories.map((m) => (
          <div key={m._id} className="group relative">
            <MemoryCard
              memory={{
                ...m,
                role: m.ownerId === user?.id ? "owner" : "member",
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => removeMemory({ memoryId: m._id })}
            >
              Remove from trip
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
