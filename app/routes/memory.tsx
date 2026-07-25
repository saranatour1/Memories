import { useRef, useState } from "react";
import { useParams } from "react-router";
import { authkitLoader } from "@workos-inc/authkit-react-router";
import {
  useConvexAuth,
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import { Play } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuthKitUser } from "~/lib/auth";
import {
  MEMORY_KINDS,
  fromDateInput,
  type Item,
  type MemoryDoc,
  toDateInput,
} from "~/lib/memory";
import { Editor } from "~/components/editor";
import { AddImageButton, AddVoiceButton } from "~/components/media";
import { Shell } from "~/components/shell";
import { MemoryPlayer } from "~/components/memory/player";
import { DaysSection } from "~/components/memory/days-section";
import { ItemRow } from "~/components/memory/item-row";
import {
  DriveDialog,
  FlightDialog,
  NoteDialog,
} from "~/components/memory/add-item-dialogs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { Route } from "./+types/memory";

export const loader = (args: Route.LoaderArgs) =>
  authkitLoader(args, { ensureSignedIn: true });

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
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [copied, setCopied] = useState(false);
  const [watching, setWatching] = useState(false);
  const editorFlush = useRef<(() => void) | null>(null);

  // Edits stay local until the Save button sends them in one mutation.
  // The ref mirrors the state so saveAll sees a synchronous editor flush.
  type Draft = {
    title?: string;
    description?: unknown;
    kind?: (typeof MEMORY_KINDS)[number];
    startAt?: number | null;
    endAt?: number | null;
  };
  const draftRef = useRef<Draft>({});
  const [draft, setDraftState] = useState<Draft>({});
  const setField = (patch: Draft) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraftState(draftRef.current);
    setSaved("idle");
  };
  const dirty = Object.keys(draft).length > 0;

  const saveAll = async () => {
    editorFlush.current?.(); // pulls any in-flight description edit into the draft
    if (Object.keys(draftRef.current).length === 0) return;
    setSaved("saving");
    try {
      await update({ memoryId, ...draftRef.current });
    } catch {
      setSaved("failed"); // draft kept so Save can be retried
      return;
    }
    draftRef.current = {};
    setDraftState({});
    setSaved("saved");
  };

  const sorted = [...items].sort((a, b) => a.happenedAt - b.happenedAt);
  const isOwner = memory.role === "owner";
  const nameOf = (userId: string) =>
    memory.members.find((m) => m.userId === userId)?.name ?? "Someone";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${saved === "failed" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {saved === "failed"
              ? "Save failed — try again"
              : dirty
                ? "Unsaved changes"
                : saved === "saving"
                  ? "Saving…"
                  : saved === "saved"
                    ? "Saved"
                    : ""}
          </span>
          {/* Not disabled when clean: the editor debounce may hold an edit
              that only lands in the draft when saveAll flushes it. */}
          <Button
            variant={dirty ? "default" : "outline"}
            size="sm"
            onClick={saveAll}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-3">
        <Input
          key={memory._id}
          defaultValue={memory.title}
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl"
          onChange={(e) => setField({ title: e.target.value })}
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
          value={draft.kind ?? memory.kind ?? ""}
          onChange={(e) =>
            e.target.value &&
            setField({ kind: e.target.value as (typeof MEMORY_KINDS)[number] })
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
            setField({
              startAt: e.target.value ? fromDateInput(e.target.value) : null,
            })
          }
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          className="w-auto"
          defaultValue={toDateInput(memory.endAt)}
          onChange={(e) =>
            setField({
              endAt: e.target.value ? fromDateInput(e.target.value) : null,
            })
          }
        />
      </div>

      <Editor
        content={memory.description}
        onUpdate={(description) => setField({ description })}
        flushRef={editorFlush}
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
