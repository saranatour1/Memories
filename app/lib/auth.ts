import { useCallback, useMemo, useRef } from "react";
import { useRouteLoaderData } from "react-router";

// Structural subset of the WorkOS User the root authkitLoader exposes.
export type AuthKitUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
};

export function useAuthKitUser(): AuthKitUser | null {
  const data = useRouteLoaderData("root") as
    | { user: AuthKitUser | null }
    | undefined;
  return data?.user ?? null;
}

// Bridges the cookie-based AuthKit session to Convex's JWT-based auth.
export function useAuthFromAuthKit() {
  const user = useAuthKitUser();
  const tokenRef = useRef<string | null>(null);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (tokenRef.current === null || forceRefreshToken) {
        const res = await fetch("/api/auth/token");
        tokenRef.current = res.ok
          ? ((await res.json()).accessToken ?? null)
          : null;
      }
      return tokenRef.current;
    },
    [],
  );
  return useMemo(
    () => ({ isLoading: false, isAuthenticated: user !== null, fetchAccessToken }),
    [user, fetchAccessToken],
  );
}
