import { useMemo, useRef } from "react";
import { EditorContent, generateHTML, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "~/lib/utils";

export function Editor({
  content,
  onUpdate,
  className,
}: {
  content?: unknown;
  onUpdate: (json: unknown) => void;
  className?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editor = useEditor({
    extensions: [StarterKit],
    content: (content as never) ?? "",
    immediatelyRender: false, // SSR: only render client-side
    onUpdate: ({ editor }) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onUpdate(editor.getJSON()), 750);
    },
  });
  return (
    <EditorContent
      editor={editor}
      className={cn(
        "min-h-24 rounded-md border px-3 py-2 text-sm [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-20",
        className,
      )}
    />
  );
}

// Read-only rendering of stored Tiptap JSON. Only rendered client-side
// (data arrives via useQuery), so generateHTML's DOM dependency is fine.
export function RichText({ content }: { content: unknown }) {
  const html = useMemo(() => {
    try {
      return generateHTML(content as never, [StarterKit]);
    } catch {
      return "";
    }
  }, [content]);
  return (
    <div
      className="text-sm [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
