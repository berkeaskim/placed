# Phase 2 brief: shared rules for every migration agent

You are one of five agents working in parallel. Each agent has its own git worktree and branch, all branched off
`feat/local-first`, which already contains the foundation layer. Read these first:
`docs/superpowers/specs/2026-10-16-local-first-design.md`, `AGENTS.md` (this Next.js version differs from what you know; check
`node_modules/next/dist/docs` before using Next APIs), and the foundation files `lib/db/schema.ts`, `lib/db/client.ts`,
`lib/db/functions.ts`, `lib/auth/local-user.ts`, `lib/files.ts`, `lib/settings/store.ts`, and `tests/db/local-db.test.ts`
(which shows how to test against a temp SQLite).

## Foundation facts
- Imports: `db` from `@/lib/db/client`; tables are camelCase consts from `@/lib/db/schema` (`profiles`, `cvs`, `cvScores`,
  `cvFeedback`, `confirmedFacts`, `companies`, `jobs`, `matches`, `applications`, `xpEvents`, `badges`, `ingestState`,
  `playbookProgress`, `autopilotVault`, `autopilotPacks`, `outreach`, `linkedinScores`, `interviewPreps`, `appSettings`).
  Row keys are the snake_case SQL column names, so rows have the same shape the Supabase code returned.
- JSON columns come back already parsed. Booleans are real booleans. Timestamps are ISO text. `companies.id` and `xp_events.id`
  are integers.
- Upserts: `onConflictDoUpdate({ target: [...] })` works on the unique indexes. For the partial xp_events indexes, use
  `onConflictDoNothing()` with no target.
- `db.transaction(tx => …)` is SYNCHRONOUS. Never pass an async callback. Inside it use `.get()`, `.all()` and `.run()`.
- `requireUser()` / `getUser()` from `@/lib/auth/local-user` return `{ user: { id, email } }`. There is no `supabase` any more.
  All rows belong to `LOCAL_USER_ID`. Keep `user_id` filters (they are cheap and keep the code honest).
- SQL functions are now TS: `awardXp(userId, delta)`, `activateCv(userId, cvId)`, `ensureProfile(...)` from `@/lib/db/functions`.
- Storage: `putFile` / `getFile` / `deleteFile` / `fileUrl` from `@/lib/files` (buckets "cvs" and "tailored"). Signed URLs become
  `fileUrl(...)`, which points at the same-origin `/api/files/...`.
- Settings: `getSetting` / `setSetting` / `getSecret` / `setSecret` from `@/lib/settings/store`.
- Gmail / Inbox Agent is being DELETED. The tables `gmail_connections` and `inbox_events` no longer exist. Remove any usage in
  your files.
- `lib/auth/rate-limit.ts` keeps its exported function names and becomes an in-memory limiter (the shell agent owns it). Callers
  don't change.

## Rules
- SAFETY: never create or copy a `.env.local`, and never talk to Supabase. Don't run `demo:*`, `user:add` or e2e against prod.
  There is no prod any more. Running things against a temp `PLACED_DATA_DIR` is fine.
- Touch ONLY the files you own (listed in your task). If you need a change in a file you don't own, don't make it. Write a
  local helper in your own files instead, or list it under "needs from others" in your final report. Don't delete
  `lib/supabase/` or the `@supabase/*` deps; the integrator does that last.
- Replace every Supabase query with Drizzle while keeping behaviour identical: the same ordering, limits, filters, error
  semantics and returned shapes. Supabase returned `{ data, error }`, so simplify the callers rather than faking that shape. Do
  not add features.
- Update or rewrite the tests in your area. Remove Supabase mocks and test against a real temp SQLite (see the foundation test).
  Delete tests that only tested Supabase/RLS/auth plumbing that no longer exists.
- Done means: `npx tsc --noEmit 2>&1 | grep -E '<your paths>'` shows zero errors in your files (errors in files other agents
  own are expected), `npx vitest run <your test dirs>` is green, `npx eslint <your files>` is clean, and
  `grep -rn supabase <your files>` is empty.
- Match the codebase style: terse, minimal comments. Commit early and often on your branch, with messages ending in
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Final report: what you changed, any behaviour you could not keep identical, "needs from others", and test results.
