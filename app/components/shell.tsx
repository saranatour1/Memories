import { Link } from "react-router";

// Minimal page frame for loading / error / not-found states.
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Memories
      </Link>
      <p className="mt-10 text-center text-muted-foreground">{children}</p>
    </main>
  );
}
