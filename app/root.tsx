import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { ConvexProviderWithAuth } from "convex/react";
import { authkitLoader } from "@workos-inc/authkit-react-router";

import type { Route } from "./+types/root";
import { convex } from "./lib/convex";
import { useAuthFromAuthKit } from "./lib/auth";
import "./app.css";

export const loader = (args: Route.LoaderArgs) => authkitLoader(args);


export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script below sets a class here before React hydrates, which
    // React would otherwise flag as a mismatch it refuses to patch up
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Applies a pinned theme before first paint, so it doesn't flash the
            other one. No stored value means the OS preference wins. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.theme;if(t==="light"||t==="dark")document.documentElement.classList.add(t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
      <Outlet />
    </ConvexProviderWithAuth>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
