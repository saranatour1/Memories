# Memories

Plan trips and keep memories together. Add flights, drives, notes, photos and
voice memos to a shared timeline, invite people with one link, and watch
everything update in realtime. Drafts stay private until you publish.

## Features

- **Memories** with a type (day / week / month / trip / custom), an optional
  start–end date range, and a rich-text description
- **Day panels** — for each day in the range, write how the day looked (past)
  and how it could look (future), grouped into calendar weeks and months
- **Items** — flights, drives, notes, images and voice memos, each with
  multiple tags
- **Calendar view** on the home page showing memories across their date spans
- **Watch mode** — play a memory back like a video, slide per day/item, with
  play/pause, prev/next and 0.5×–2× speed
- **Collaboration** — invite via link, realtime updates, draft/publish

## Stack

- [React Router 7](https://reactrouter.com/) (SSR) + Tailwind + Base UI
- [Convex](https://convex.dev) backend (schema in `convex/schema.ts`)
- [WorkOS AuthKit](https://workos.com) auth via the
  [`@convex-dev/workos-authkit`](https://www.convex.dev/components/workos-authkit)
  component (webhook-driven user sync)
- Cloudflare R2 for media via `@convex-dev/r2`
- Tiptap for rich text

## Development

Uses **pnpm**.

```bash
pnpm install
npx convex dev   # deploys backend + regenerates types, keep running
pnpm dev         # app on http://localhost:5173
```

### Environment

`.env.local` (app): `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`,
`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI`,
`WORKOS_COOKIE_PASSWORD`.

Convex deployment (`npx convex env set …`): `WORKOS_API_KEY`,
`WORKOS_CLIENT_ID`, `WORKOS_WEBHOOK_SECRET`.

For user sync, create a webhook in the WorkOS dashboard pointing at
`https://<deployment>.convex.site/workos/webhook` with the `user.created`,
`user.updated` and `user.deleted` events, and set its signing secret as
`WORKOS_WEBHOOK_SECRET`.

### Seed data

```bash
npx convex run seed:run
```

Creates (or resets) a sample trip with flights, drives, tagged notes and day
panels for testing, owned by the first user row in the `users` table. Pass an
explicit owner with `npx convex run seed:run '{"userId": "user_..."}'`.

## Production

`pnpm build` then serve with `pnpm start`, or use the included `Dockerfile`.
