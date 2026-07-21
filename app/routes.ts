import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/app-layout.tsx", [
    index("routes/home.tsx"),
    route("memory/:id", "routes/memory.tsx"),
    route("trip/:id", "routes/trip.tsx"),
  ]),
  route("login", "routes/login.ts"),
  route("callback", "routes/callback.ts"),
  route("signout", "routes/signout.ts"),
  route("api/auth/token", "routes/api.auth.token.ts"),
  route("join/:token", "routes/join.tsx"),
] satisfies RouteConfig;
