import { useMutation } from "convex/react";
import { Car, Mic, Plane, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { RichText } from "~/components/editor";
import { Button } from "~/components/ui/button";
import { formatDuration, type Item, relative, when } from "~/lib/memory";
import { VoiceAudio } from "~/components/memory/voice-audio";

export function ItemRow({
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
                <VoiceAudio
                  url={item.url}
                  mimeType={item.mimeType}
                  className="h-9 max-w-full"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Voice note…
                </span>
              )}
              {item.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(item.durationMs)}
                </span>
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
              ? `${when(item.departAt)} → ${when(item.arriveAt)} (${relative(item.departAt)})`
              : `${when(item.happenedAt)} (${relative(item.happenedAt)})`}
            {item.location ? ` · ${item.location}` : ""}
            {" · "}
            {authorName}
          </p>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => remove({ type: item.type, id: item._id })}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
