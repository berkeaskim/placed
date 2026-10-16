# Contributing to Placed

Thanks for helping. Bug reports, fixes, new employers in `seed/companies.yml` and better CV rules (with sources) are
all welcome.

## Dev setup

Node.js 22.12 or newer.

```bash
npm install
npm run setup   # creates ./data, runs migrations, loads the seed jobs
npm run dev     # http://127.0.0.1:3000
```

No AI key is needed for development: without one the app replays recorded outputs from `fixtures/ai/`
(`AI_MODE=fixture` forces this even when a key is set). See the README for Claude, Gemini and Ollama.

## Checks

Run these before opening a pull request. CI runs the same three, with no secrets.

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` never touches your `./data`: every test file gets a fresh temp `PLACED_DATA_DIR` with a freshly migrated
SQLite (`tests/setup/temp-data-dir.ts`). Test against that real database rather than mocking it; see
`tests/db/local-db.test.ts` for the pattern.

- `npm run e2e` runs Playwright against its own dev server on port 3100, with a temp data dir and `AI_MODE=fixture`.
- `npx vitest run -c vitest.live.config.ts` runs the live AI suite against a real provider (uses your key; costs money).

## Database changes

1. Edit `lib/db/schema.ts`.
2. Run `npm run db:generate`. It writes a new SQL migration to `drizzle/`. Commit it with the schema change.
3. Migrations apply automatically the next time the app or `npm run setup` opens the database.

Don't edit a migration that has already been merged; add a new one.

## Code style

- Read `AGENTS.md` first. This project uses Next.js 16, which differs from older versions: check
  `node_modules/next/dist/docs/` before using a Next API.
- Keep it terse: small functions, few comments, comments that say *why*.
- AI output is never trusted: every model call returns Zod-validated JSON, and job text is data, never instructions.
- Never fabricate. Anything that ends up on a CV must trace back to the user's own CV or something they confirmed
  (`lib/verify`). Changes that weaken this won't be merged.
- `db.transaction(tx => ...)` is synchronous (better-sqlite3). Never pass an async callback.
- The server binds to `127.0.0.1` and has no login. Don't add anything that listens on other interfaces.

## Pull requests

Keep them focused, describe what changed and how you tested it, and add or update tests for behaviour changes.
By contributing you agree that your work is released under the [MIT License](LICENSE).
