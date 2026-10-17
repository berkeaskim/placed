# Employer coverage: top-tier employers in the feed

Date: 2026-10-17 · Branch: `feat/employer-coverage` · Roadmap item: README "More employer coverage"

## Intent

A student opening Placed should see the employers they most want: the Big Four, JPMorgan, Goldman Sachs and the
other bulge-bracket banks, and Big Tech (Google, Microsoft, Meta, Apple, Amazon). If those are missing, the feed looks
thin however many startups it lists. Today 40 of the 159 benchmark employers have live UK roles, and almost none of the
top tier are among them, because they run their own careers sites rather than an ATS we read
(see `docs/research/ingest-coverage-benchmark.md`, "What's still missing").

Berke wants Scrapling (https://github.com/D4Vinci/Scrapling, Python, BSD-3) used for this, including its
`StealthyFetcher`.

## Goals

1. Every employer on the **top-tier list** (below) shows up in the feed with either live, real postings or a
   curated programme card.
2. As many of them as possible come from live postings via a lightweight TypeScript provider that calls the JSON
   endpoint their own careers site uses.
3. Scrapling is used two ways:
   - **Recon (dev-time):** a script that opens a careers page with `DynamicFetcher` and `capture_xhr`, and reports
     the JSON endpoints it calls. We use it to find the endpoints for goal 2.
   - **Optional runtime sidecar:** a `StealthyFetcher` transport fallback for boards that reject a plain Node `fetch`
     (TLS or header fingerprinting, plain 403), for users who opt in by installing it.
4. Curated programme cards for employers with no readable feed: "Deloitte 2027 Graduate Scheme, opens September,
   link", shown in the feed and clearly marked as not yet live-verified.

## Non-goals

- Making Python a requirement. `npm install` and `npm run setup` must keep working with no Python at all.
- HTML scraping with per-site CSS selectors as the main method. Selectors break; JSON endpoints rarely do.
- LinkedIn, Indeed, Bright Network, Gradcracker or other aggregators.
- Changing scoring, tailoring or the feed's ranking logic beyond what programme cards need.

## Anti-goals (fail even if it technically works)

- **No Cloudflare/Turnstile solving or CAPTCHA bypass.** `solve_cloudflare` stays `False` everywhere, hard-coded, and
  is not exposed as a setting. If a response is a challenge or interstitial page, the board is reported as
  `blocked` and skipped. The recon script does not use `StealthyFetcher` at all.
- No proxy rotation, no fingerprint randomisation beyond Scrapling's default stealth profile, no logins.
- A board that silently returns a partial list, so that real postings get marked dead (see the "false closure"
  rules already in the Workday and SmartRecruiters providers).
- Programme cards that look like live, verified postings, or stale cards from a past season.
- A slower default ingest. New providers must stay within the current per-board request style (paged, title filter
  before detail calls, `getJson` retries).

## Top-tier list

Added to `seed/coverage-benchmark.yml` with a `tier: top` field so `npm run coverage` can report them separately:

- Big Four UK: PwC, Deloitte, EY, KPMG
- Banks: JPMorgan, Goldman Sachs, Morgan Stanley, Citi, Barclays, HSBC, Bank of America, UBS, Deutsche Bank
- Big Tech: Google, Microsoft, Meta, Apple, Amazon
- Consulting: McKinsey, BCG, Bain

Some already exist in `companies.yml` (e.g. Morgan Stanley, Barclays, Citi via Workday); they still count.

## Design

### 1. Recon script (dev-time only)

`scripts/recon/capture_xhr.py`, run with `python3 scripts/recon/capture_xhr.py <careers-search-url> [--pattern ...]`.

- Uses `DynamicFetcher` (Playwright Chromium) with `capture_xhr`, `network_idle=True`, headless.
- Prints each captured JSON response: URL, method, request body, status and a short sample of the keys. That's
  enough to write a provider.
- One page per run, by hand. Not part of the app, not in CI, and not wired into npm scripts beyond a documented
  `npm run recon -- <url>` alias.
- Findings go into `docs/research/employer-coverage-recon.md`: per employer, the endpoint, paging, which fields map
  to `RawJob`, and whether it needed anything beyond a plain GET or POST.

### 2. New TypeScript providers

Each follows the existing pattern (`lib/ingest/providers/workday.ts`, `smartrecruiters.ts`): list, title filter,
details only for kept titles, `getJson` retries, and fail the whole board rather than return a partial list.

Candidates, in priority order. Recon decides which are real:

| Provider (`ats` value) | Employers | Note |
|---|---|---|
| `oracle` (Oracle Recruiting Cloud `recruitingCEJobRequisitions`) | JPMorgan, Lazard, Schroders, M&S | Known public REST API; the benchmark already names it as the best next step |
| `amazon` (amazon.jobs `search.json`) | Amazon | Known public JSON |
| `microsoft` | Microsoft | Careers site is backed by a JSON search API |
| `google` | Google | Recon needed |
| `apple` | Apple | Recon needed |
| `meta` | Meta | Recon needed; may be GraphQL, which is fine if public and stable |
| others found in recon | Goldman Sachs, Big Four, MBB, HSBC, UBS | Only if a public JSON endpoint exists |

Every new `ats` value goes into `ATS_VALUES` in `lib/db/schema.ts`, then `npm run db:generate` adds the migration
(the `companies_ats_check` constraint). Seeds go into `seed/companies.yml`. `apiHost` carries the tenant host where
the provider needs one (as for Workday).

An employer whose site is recon'd and turns out to have no usable endpoint is written up in the recon doc and gets a
programme card instead (section 4).

### 3. Optional Scrapling sidecar (`StealthyFetcher` fallback)

- **Where:** `scraper/` at repo root, a small Python package with one entry point, `scraper/fetch.py`. It reads one
  JSON request on stdin (`{url, method, headers, body}`), fetches it with `StealthyFetcher` (headless,
  `solve_cloudflare=False`), and writes one JSON response on stdout (`{status, headers, body, blocked}`).
- **Install:** `npm run scraper:setup` creates `scraper/.venv`, then `pip install "scrapling[fetchers]"` and
  `scrapling install`. Requires Python ≥ 3.10 (the Mac here has 3.9.6, so setup must check the version and explain
  the fix). Documented in the README as optional.
- **Detection:** the Node side treats the sidecar as available only when `scraper/.venv/bin/python` exists and a
  `--version` handshake succeeds. The result is cached per process.
- **Who uses it:** only companies marked `transport: stealth` in `companies.yml` (a new nullable `transport` column on
  `companies`). It's set per board during recon, when a plain `fetch` gets 403 but the page loads in a browser.
  Without the sidecar those boards fail with a clear error (`needs the optional scraper: npm run scraper:setup`)
  rather than silently.
- **Plumbing:** `getJson` gets an optional transport. For a `stealth` board it spawns the sidecar per request (or
  keeps one long-lived process per run; builder's call) and keeps the existing retry and partial-list rules.
- **Blocked detection:** the sidecar sets `blocked: true` when the response is a challenge or interstitial
  (Cloudflare "Just a moment", Turnstile widget, `cf-mitigated` header, Akamai/PerimeterX block pages). Node turns
  that into a board failure labelled `blocked`. It's never retried with more evasion.
- **Settings:** a read-only line in Settings → Job search, "Optional scraper: installed / not installed", next to the
  existing ingest settings. No toggle for stealth behaviour.

### 4. Curated programme cards

- **Source:** `seed/programmes.yml`, maintained in the repo. One entry per programme:
  `{ employer, title, url, location, opens: YYYY-MM, closes?: YYYY-MM-DD, season: 2027, kind: internship|graduate|spring-week, description }`.
  The `url` is the employer's official programme page.
- **Ingest:** a `curated` provider (new `ats` value) with one `companies` row per employer (`slug` = employer key).
  It turns entries into `RawJob`s with a stable `extId` (`<employer>:<season>:<kind>:<title-slug>`), so the normal
  pipeline stores and tags them. Removing an entry from the yml marks it dead.
- **Freshness:** entries whose `season` has passed (programme start year < current recruiting season) are skipped at
  ingest. `closes` in the past also means skipped.
- **Display:** a new nullable `opens_on` column on `jobs`. When it is in the future, the feed card shows a
  "Opens Sep 2027" badge instead of a deadline, and an "Official programme page" link. Curated cards also carry a
  small "Curated" label so they're never mistaken for a live, verified posting. They rank normally but are never
  marked as "closing soon".
- **Granularity (my call):** one card per employer per kind (spring week, internship, graduate), UK only. Not one
  per division or city: that is the employer's own page's job.
- **Season (my call):** `season` is the year the programme *starts* (summer 2027 internship → `season: 2027`).
  A card is shown from ingest until `closes` if given, otherwise until 1 June of `season` (internships and grad
  schemes have stopped recruiting by then). `opens` is when applications open; the badge reads "Opens Sep 2026".
- **Employer key (my call):** a new nullable `employer` column on `companies` (e.g. `barclays`) links a curated row
  to the live boards of the same employer. Set in `companies.yml` for top-tier boards only.
- **Overlap (my call):** if any live board with the same `employer` key has at least one live, kept posting, that
  employer's curated cards are hidden. Matched on employer only, not kind, because live `employment_type` comes
  from the tagger with a different vocabulary.
- **Initial content (Berke decided):** cards for **every** top-tier employer, including those with a live board, so
  they stay visible in the off-season; the overlap rule hides a card while live postings exist. Researched from the
  employers' official pages. Each entry's `url` is checked to return 200 at the time of writing.

### 5. Benchmark and reporting

- `npm run coverage -- --live` gains a "Top tier" section: per employer, live count, curated card, or missing.
- The recon doc and `ingest-coverage-benchmark.md` are updated with the new numbers (snapshot date stated).
- Success: all 21 top-tier employers show as live or curated. The overall benchmark number stays live-only (so it
  stays comparable with the 40), and a second figure reports "live or curated" (my call).

## Testing

- Unit tests per provider with recorded fixtures (`fixtures/`), as for the existing providers: normalisation, paging,
  title filter before details, partial-list failure.
- Sidecar: Node-side tests with a fake sidecar binary (blocked, 403, ok, missing install). No real network in tests.
- Curated provider: season and `closes` filtering, stable ids, overlap hiding.
- Live checks via the existing `vitest.live.config.ts` style, not in CI.

## Constraints

- Local-first: SQLite and Drizzle, migrations via `npm run db:generate`, tests on temp data dirs (CLAUDE.md).
- Node/TS app; Python only in `scripts/recon/` and the optional `scraper/`.
- Public repo: nothing that reads as a bot-wall bypass tool.

## Left to the builder

- Sidecar process model (spawn per request vs. one per run).
- Exact `RawJob` mapping per provider, and whether a provider needs a detail call.
- Which recon findings justify a provider vs. a curated card, judged on stability and request cost.
- Wording and styling of the "Opens …" and "Curated" badges, within the existing feed card style.
