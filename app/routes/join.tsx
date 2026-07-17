import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { authkitLoader } from "@workos-inc/authkit-react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Route } from "./+types/join";

export const loader = (args: Route.LoaderArgs) =>
  authkitLoader(args, { ensureSignedIn: true });

export default function Join() {
  const { token } = useParams();
  const { isAuthenticated } = useConvexAuth();
  const join = useMutation(api.memories.joinByToken);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !token || fired.current) return;
    fired.current = true;
    join({ token })
      .then((memoryId) => navigate(`/memory/${memoryId}`, { replace: true }))
      .catch(() => setError("This invite link is invalid or has been revoked."));
  }, [isAuthenticated, token, join, navigate]);

  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-muted-foreground">{error ?? "Joining memory…"}</p>
    </main>
  );
}
