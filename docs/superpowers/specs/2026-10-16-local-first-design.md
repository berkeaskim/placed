# Local-first Placed: design

Date: 2026-10-16. Branch: `feat/local-first`.

## Goal

Anyone can run Placed on their own computer with `git clone`, then `npm install && npm run setup && npm run dev`. No Supabase, no Vercel and no cloud account are needed. The only thing a person may bring is an AI key (Claude or Gemini), or nothing at all if they run Ollama locally. All data lives in `./data/`.

## Decisions (agreed with Berke)

| Area | Before | After |
|---|---|---|
| Database | Supabase Postgres + RLS | SQLite file `data/placed.db` via `better-sqlite3` + `drizzle-orm` |
| Users | Supabase Auth (guest, password, OTP, Google OAuth) | **Single local user, no login.** The server binds to `127.0.0.1`. |
| Files | Supabase Storage buckets `cvs` and `tailored` | `data/files/<bucket>/<path>`, served by a local API route |
| Daily ingest | Vercel cron hitting `/api/ingest` | `npm run ingest` plus a "Refresh jobs" button in the app |
| AI | Anthropic or Gemini key in env | Anthropic, Gemini **or Ollama**, chosen and configured in an in-app **Settings → AI** page. Env vars still override. |
| Extension | prod origin + `*.supabase.co` | default origin `http://localhost:3000`; supabase host permission removed |
| Gmail / Inbox Agent | Gmail OAuth + `inbox_events` | **removed entirely** (Chrome extension stays) |
| Hosted bits | Vercel config, live demo persona, demo:* scripts | removed |

## Core interfaces (owned by the foundation task; other tasks consume, never redefine)

- `lib/db/schema.ts`: Drizzle SQLite schema for every table in `supabase/migrations/0001…0015`. Rules:
  uuid → `text` (generated with `crypto.randomUUID()`), timestamptz → `text` ISO string, jsonb → `text({ mode: "json" })`,
  arrays → json text, booleans → `integer({ mode: "boolean" })`. Column names stay **snake_case in the DB** and are exposed as the
  **same snake_case keys** in TS, so row objects keep the shape the existing code expects.
- `lib/db/client.ts`: `db` (singleton Drizzle instance, WAL mode, `foreign_keys = ON`), path from `PLACED_DATA_DIR` (default `./data`).
- `lib/db/migrate.ts` + `drizzle/` folder: generated migrations, applied automatically on first `db` use and by `npm run setup`.
- `lib/auth/local-user.ts`: `LOCAL_USER_ID` constant, and `requireUser()` returning `{ user: { id, email } }` with the profile row
  ensured. The `user_id` columns stay so the logic barely changes; they always hold `LOCAL_USER_ID`.
- `lib/files.ts`: `putFile(bucket, path, bytes)`, `getFile(bucket, path)`, `deleteFile`, `fileUrl(bucket, path)`, which returns
  `/api/files/<bucket>/<path>`. It refuses path traversal.
- `lib/settings/store.ts`: synchronous `getSetting(key)` / `setSetting(key, value)` over an `app_settings` table. Secrets (API keys) are encrypted with the existing vault AES-GCM helper using a key generated at setup into `data/secret.key`.
- Former SQL functions (`activate_cv`, `award_xp`, the trigger) are reimplemented as TS functions in a `db.transaction`.

RLS goes away. There is one user, and the server only listens on loopback.

## AI providers

`lib/ai/provider.ts` gains `ollama`. Provider resolution order: `AI_PROVIDER` env → setting `ai.provider` → the first configured
provider. Keys are resolved env-first, then from settings. `aiProvider()` stays synchronous (better-sqlite3 is sync).

Ollama adapter: it talks to `OLLAMA_HOST` / setting `ai.ollama.host` (default `http://127.0.0.1:11434`) through `/api/chat` with
`format: <JSON schema from zod>` for structured output. PDF parts are converted to text with `unpdf` before sending. The grounded
web-search call returns null, as Anthropic does today.

Settings → AI page:
- A provider picker (Claude / Gemini / Ollama), key fields with a "Test connection" button, and a model override per tier (fast/smart).
- An Ollama section that detects whether Ollama is running, lists installed models, and shows a **hardware-tiered recommendation
  table** (RAM detected server-side with `os.totalmem()`). Each row has the `ollama pull` command and a one-click "Download" that uses
  Ollama's `/api/pull` with progress. The model list lives in `lib/ai/local-models.ts` as data. It is researched for structured-JSON
  quality on CV/job tasks as of Oct 2026, and has about 4 tiers (≈8 GB, 16 GB, 32 GB, 64 GB+ RAM).

## Setup and DX

- `npm run setup`: creates `data/`, generates `data/secret.key` and the vault key if missing, runs migrations, seeds companies/jobs
  from `seed/`, and prints next steps.
- `.env.example` shrinks to optional overrides only (`AI_PROVIDER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_HOST`,
  `PLACED_DATA_DIR`, `PORT`).
- `next dev`/`start` bind to `127.0.0.1`.
- README gets a "Run it locally" section, a section on choosing an AI backend, and a backup note ("copy the `data/` folder").
- Tests: vitest runs against a temp SQLite file (`PLACED_DATA_DIR` = tmp dir). Supabase mocks are removed.

## Removal list

`@supabase/*` deps, `lib/supabase/`, `supabase/` folder (kept in git history only), `proxy.ts` auth refresh, login/signup/guest/OAuth
callback pages, admin user scripts (`add-user`, `create-demo-user`, `reset-demo`, `seed-demo-tracker`), `vercel.json`, the
`CRON_SECRET` path, the whole Gmail/Inbox Agent feature (`lib/gmail/`, `app/api/gmail/`, `inbox_events`,
`gmail_connections`, inbox banner/actions on the tracker, Gmail settings), the demo-mode env, rate-limit code that keys on auth user (it stays if keyed on IP/route; it is harmless locally).

## Success criteria

1. On a fresh clone with no `.env.local`: `npm install && npm run setup && npm run dev` reaches the dashboard, with no login.
2. Upload CV → score → match jobs → tailor CV → PDF download works with Claude, Gemini and Ollama.
3. `npm run typecheck`, `npm run lint` and `npm test` pass. `grep -ri supabase` over app/lib/components/scripts/extension finds nothing.
4. The extension works against `localhost:3000`.
