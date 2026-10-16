## Local-first: read before running any script or test

- Placed runs on one machine for one user. There is no Supabase, no hosted database, no login and no demo persona.
- Everything lives in `./data` (or `PLACED_DATA_DIR`): the SQLite database `placed.db`, uploaded files under `files/`,
  and `secret.key`, which encrypts saved API keys and the Autopilot vault. Never commit, print or delete it.
- Database access goes through Drizzle (`@/lib/db/client`, schema in `lib/db/schema.ts`). Schema changes: edit the
  schema, then `npm run db:generate` to add a migration under `drizzle/`. Migrations apply on first use and in `npm run setup`.
- Tests never use `./data`: every vitest file gets a fresh temp `PLACED_DATA_DIR` (`tests/setup/temp-data-dir.ts`), and
  Playwright starts its own server on a temp data dir with `AI_MODE=fixture`.
- The dev server listens on `127.0.0.1` only. Keep it that way: there is no auth, so loopback is the security boundary.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
