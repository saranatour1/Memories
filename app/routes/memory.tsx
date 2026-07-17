import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { authkitLoader } from "@workos-inc/authkit-react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Car, Mic, Plane, Trash2 } from "lucide-react";
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

type MemoryDoc = NonNullable<
  ReturnType<typeof useQuery<typeof api.memories.get>>
>;
type Item = ReturnType<typeof useQuery<typeof api.items.list>> extends
  | (infer T)[]
  | undefined
  ? T
  : never;

const when = (ms: number) =>
  new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function MemoryPage() {
  const { id } = useParams();
  const memoryId = id as Id<"memories">;
  const { isAuthenticated } = useConvexAuth();
  const memory = useQuery(
    api.memories.get,
    isAuthenticated ? { memoryId } : "skip",
  );
  const items = useQuery(
    api.items.list,
    isAuthenticated && memory ? { memoryId } : "skip",
  );

  if (memory === undefined) {
    return <Shell>Loading…</Shell>;
  }
  if (memory === null) {
    return (
      <Shell>
        You're not a member of this memory. Ask the owner for an invite link.
      </Shell>
    );
  }
  return <MemoryView memory={memory} items={items ?? []} memoryId={memoryId} />;
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
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const save = async (patch: { title?: string; description?: unknown }) => {
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
      </div>

      <Editor
        content={memory.description}
        onUpdate={(description) => save({ description })}
        className="mb-8"
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
          <Button type="submit">Add drive</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ memoryId }: { memoryId: Id<"memories"> }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<unknown>(null);
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
        <Button
          disabled={content === null}
          onClick={async () => {
            await addNote({ memoryId, content });
            setContent(null);
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
