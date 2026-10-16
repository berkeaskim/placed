## LIVE DEMO: read before running any script or test

- The "Try the demo" persona (Ayşe, `DEMO_EMAIL`) is the **live public demo** on prod. Real people and judges use it. It is not a test account.
- There is one Supabase project: local dev, scripts and Playwright (`.env.local`) all hit the **production database**.
- Never run `demo:reset`, `demo:user`, `demo:tracker`, or the demo e2e specs without Berke's explicit OK. They refuse unless `PLACED_ALLOW_LIVE_DEMO_WRITE=1`; never set it yourself.
- For testing, use the e2e test persona (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`), never the demo account.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
