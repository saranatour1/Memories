import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Editor } from "~/components/editor";
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
import { parseTags } from "~/lib/memory";

export function FlightDialog({ memoryId }: { memoryId: Id<"memories"> }) {
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

export function DriveDialog({ memoryId }: { memoryId: Id<"memories"> }) {
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

export function NoteDialog({ memoryId }: { memoryId: Id<"memories"> }) {
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
