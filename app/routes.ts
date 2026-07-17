import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.ts"),
  route("callback", "routes/callback.ts"),
  route("signout", "routes/signout.ts"),
  route("api/auth/token", "routes/api.auth.token.ts"),
  route("memory/:id", "routes/memory.tsx"),
  route("join/:token", "routes/join.tsx"),
] satisfies RouteConfig;
