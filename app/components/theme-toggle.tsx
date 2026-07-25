import { Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";

// ponytail: no React state. The icons swap via the `dark:` variant and the
// current theme is read off the DOM at click time, so there is no state to keep
// in sync with the class the no-flash script in root.tsx sets before hydration.
export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Toggle theme"
      aria-label="Toggle theme"
      onClick={() => {
        const root = document.documentElement;
        const isDark =
          root.classList.contains("dark") ||
          (!root.classList.contains("light") &&
            matchMedia("(prefers-color-scheme: dark)").matches);
        const next = isDark ? "light" : "dark";
        root.classList.remove("light", "dark");
        root.classList.add(next);
        try {
          localStorage.theme = next;
        } catch {
          // private mode / storage disabled: the toggle still works for this page
        }
      }}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
