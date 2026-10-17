# Employer Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every top-tier employer (Big Four, bulge-bracket banks, Big Tech, MBB) shows in the feed with live postings
or a clearly labelled curated programme card.

**Architecture:** Scrapling's `DynamicFetcher` + `capture_xhr` is a dev-time recon tool to find each careers site's
JSON endpoint; those endpoints become lightweight TS providers in `lib/ingest/providers/`. An optional Python sidecar
wraps `StealthyFetcher` (never `solve_cloudflare`) as a drop-in `fetch` for boards marked `transport: stealth`.
Employers with no readable feed get cards from `seed/programmes.yml` through a `curated` provider that runs through
the normal ingest pipeline.

**Tech Stack:** Next.js / TypeScript, SQLite + Drizzle, vitest; Python ≥ 3.10 + `scrapling[fetchers]` (optional).

**Spec:** `docs/superpowers/specs/2026-10-17-employer-coverage-design.md`

## Global Constraints

- `npm install` and `npm run setup` must work with no Python installed.
- `solve_cloudflare=False`, hard-coded; not a setting. Recon never uses `StealthyFetcher`. No proxies, no logins.
- A challenge/interstitial response fails the board with an error containing `blocked`; never retried with more evasion.
- Providers fail the whole board rather than return a partial list (no false closures). Title filter before detail calls; use `getJson` from `lib/ingest/providers/http.ts`.
- Schema changes: edit `lib/db/schema.ts`, then `npm run db:generate`. Tests use temp data dirs (CLAUDE.md). Never touch `./data`.
- Curated cards: one per employer per kind (`spring-week | internship | graduate`), UK only, carry a "Curated" label, never in "Closing soon".
- `season` = year the programme starts. Card visible until `closes`, else until `${season}-06-01`.
- Curated cards of an employer are hidden while any non-curated board with the same `employer` key has a live job.
- Overall benchmark number stays live-only; add a "live or curated" figure and a top-tier section.
- New seed employer names must join `KNOWN_EMPLOYERS` in `lib/verify/tailoring.ts` (enforced by `tests/verify/tailoring.test.ts`).
- Every task ends with `npm test`, `npm run typecheck` and `npm run lint` green.

## Review Focus

1. **Sidecar missing or broken mid-run** (python gone, venv deleted, process crashes): the stealth board fails with a clear message, the other boards finish. Test in Task 6.
2. **Curated entry with `opens` in the past and no `closes`** (applications open now): the card shows like a normal job with "No closing date published", not "Opens …". Test in Task 4.
3. **Malformed `seed/programmes.yml` row** (missing url, bad `opens` format): setup and ingest skip that row with a warning and keep the rest. Test in Task 4.
4. **Curated employer whose live board fails this run** (network error): its previous live jobs stay live (ingest doesn't mark them dead on error), so the curated card stays hidden; no flip-flop. Test in Task 5.
5. **Oracle/Amazon paging when total shrinks mid-run**: the board fails rather than returning a partial list. Test in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/schema.ts` | `ATS_VALUES` += `oracle`, `amazon`, `curated`; `companies.employer`, `companies.transport`; `jobs.opens_on` |
| `drizzle/0005_*.sql` | generated migration |
| `lib/types.ts` | `RawJob.opensOn?: string \| null` |
| `lib/ingest/providers/index.ts` | `CompanySeed` gains `employer`, `transport`; dispatch for new providers; picks `fetchImpl` by transport |
| `lib/ingest/providers/oracle.ts` | Oracle Recruiting Cloud provider |
| `lib/ingest/providers/amazon.ts` | amazon.jobs provider |
| `lib/ingest/providers/<name>.ts` | one per recon-confirmed endpoint (Task 8) |
| `lib/ingest/curated.ts` | load + validate `seed/programmes.yml`, season filter, to `RawJob` |
| `lib/ingest/stealth.ts` | sidecar process manager, `stealthFetch: typeof fetch`, `isChallenge()` |
| `lib/ingest/run.ts` | write `opens_on`; pass `employer`/`transport` |
| `lib/db/queries.ts` | `JobListItem` gains `opensOn`, `curated`; overlap hiding in `getLiveJobs` |
| `lib/scoring/dates.ts` | `closingLabel` handles `opensOn` |
| `lib/feed/filters.ts` | curated excluded from "soon" |
| `components/job-card.tsx` | "Curated" label |
| `scripts/setup.ts` | seed `employer`/`transport`; upsert curated companies from programmes.yml |
| `scraper/fetch.py`, `scraper/requirements.txt`, `scripts/scraper-setup.ts` | optional sidecar + installer |
| `scripts/recon/capture_xhr.py` | dev-time recon |
| `components/settings/job-search.tsx` | "Optional scraper: installed / not installed" |
| `seed/programmes.yml`, `seed/companies.yml`, `seed/coverage-benchmark.yml` | data |
| `lib/ingest/coverage.ts`, `scripts/coverage.ts` | top-tier section, live-or-curated figure |
| `docs/research/employer-coverage-recon.md` | recon findings |

---

### Task 1: Schema and plumbing

**Files:**
- Modify: `lib/db/schema.ts`, `lib/types.ts`, `lib/ingest/providers/index.ts`, `lib/ingest/run.ts`, `scripts/setup.ts`
- Create: generated `drizzle/0005_*.sql`
- Test: `tests/ingest/run.test.ts`, `tests/setup/` (existing setup test file, or new `tests/setup/seed-companies.test.ts`)

**Interfaces:**
- Produces:
  - `ATS_VALUES = ["greenhouse","lever","ashby","workday","smartrecruiters","oracle","amazon","curated"]`
  - `TRANSPORT_VALUES = ["stealth"] as const`; `companies.transport: text | null` (check constraint null or in list), `companies.employer: text | null`
  - `jobs.opens_on: text | null` (YYYY-MM-DD)
  - `RawJob.opensOn?: string | null`
  - `CompanySeed = { slug; name; ats: Ats; apiHost?: string | null; employer?: string | null; transport?: "stealth" | null }`
  - `CompanyRow` gains `employer: string | null; transport: "stealth" | null`; `JobRow` gains `opens_on: string | null`
  - `export function seedCompanyRows(yml: unknown[]): NewCompany[]` in `scripts/setup.ts` moved to `lib/ingest/seed.ts` so it is testable

- [ ] **Step 1: Write failing tests**
  - `run.test.ts › "stores opensOn as opens_on"`: fake `fetchJobs` returns a passing job with `opensOn: "2026-09-01"`; expect stored row `opens_on === "2026-09-01"`; a job without it stores `null`.
  - `seed-companies.test.ts › "maps employer and transport"`: `seedCompanyRows([{slug:"x",name:"X",ats:"oracle",apiHost:"h",employer:"jpmorgan",transport:"stealth"}])` → `{ats:"oracle", api_host:"h", employer:"jpmorgan", transport:"stealth", enabled:true}`; unknown `transport: "foo"` → `transport: null`; unknown ats row dropped.
- [ ] **Step 2:** `npx vitest run tests/ingest/run.test.ts tests/setup` → FAIL.
- [ ] **Step 3:** Edit schema, `npm run db:generate` (check the SQL recreates `companies` with the widened check and adds the two columns, adds `jobs.opens_on`). Add types, pass `employer`/`transport` from `CompanyRow` into `fetchJobs`, write `opens_on: j.opensOn ?? null`. Move seed mapping to `lib/ingest/seed.ts`, use it from `setup.ts` and include `employer`, `transport` in the upsert `set`. Add `opensOn` to `jobContentHash` input so a changed opening date re-processes.
- [ ] **Step 4:** Tests pass; `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 5:** Commit `feat(ingest): schema for new providers, employer key, stealth transport, opens_on`.

---

### Task 2: Recon tool and findings

**Files:**
- Create: `scripts/recon/capture_xhr.py`, `scripts/recon/README.md`, `docs/research/employer-coverage-recon.md`
- Modify: `package.json` (`"recon": "python3 scripts/recon/capture_xhr.py"`)

**Interfaces:**
- Produces: `docs/research/employer-coverage-recon.md` with one section per top-tier employer: careers search URL, captured endpoint (method, URL template, body), paging, field → `RawJob` mapping, plain `fetch` result (200 / 403 / challenge), verdict: `provider:<name>` | `existing:<ats>/<slug>` | `stealth` | `curated`. Tasks 3, 8, 9 read this.

- [ ] **Step 1:** Write `capture_xhr.py <url> [--pattern REGEX] [--wait MS]`: `DynamicFetcher.fetch(url, headless=True, network_idle=True, capture_xhr=pattern or ".*")`; for each captured response whose content-type is JSON print method, URL, request body, status, top-level keys and the first item's keys. Imports `DynamicFetcher` only; a comment states `StealthyFetcher` is deliberately not used here. Exits 2 with an install hint if `scrapling` is missing.
- [ ] **Step 2:** In a scratch venv (Python ≥ 3.10; `brew install python@3.12` if needed — ask Berke before installing system packages), install `scrapling[fetchers]`, `scrapling install`.
- [ ] **Step 3:** Run it once per top-tier employer's student/early-careers search page (PwC UK, Deloitte UK, EY UK, KPMG UK, JPMorgan, Goldman Sachs, Morgan Stanley, Citi, Barclays, HSBC, Bank of America, UBS, Deutsche Bank, Google, Microsoft, Meta, Apple, Amazon, McKinsey, BCG, Bain). Sequential, one page each, a few seconds apart. If a page shows a challenge, record `blocked` and stop on that site.
- [ ] **Step 4:** For each captured endpoint, test it with plain Node `fetch` (`node -e`) and record 200/403/challenge.
- [ ] **Step 5:** Write the recon doc (snapshot date at top) with a verdict table. Commit `docs(research): employer coverage recon`.

---

### Task 3: Oracle Recruiting Cloud provider (JPMorgan et al.)

**Files:**
- Create: `lib/ingest/providers/oracle.ts`, `tests/fixtures/ats/oracle-list.json`, `tests/fixtures/ats/oracle-detail.json`, `tests/ingest/oracle.test.ts`
- Modify: `lib/ingest/providers/index.ts`, `seed/companies.yml`, `lib/verify/tailoring.ts`

**Interfaces:**
- Consumes: `getJson`, `mapLimit` (http.ts); `CompanySeed` (Task 1).
- Produces: `fetchOracle(slug: string, host: string, keepTitle: (t: string) => boolean, fetchImpl?: typeof fetch, sleep?): Promise<{ jobs: RawJob[]; listed: number }>`; `normalizeOracleDetail(json: unknown, host: string, slug: string): RawJob | null`. Seed: `slug = "<siteNumber>"` (e.g. `CX_1001`), `apiHost = "<tenant>.fa.<region>.oraclecloud.com"`.

- [ ] **Step 1:** Record real fixtures from the endpoint Task 2 confirmed (`/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=<slug>,limit=<n>,offset=<o>` and the detail `recruitingCEJobRequisitionDetails`), trimmed to a few items.
- [ ] **Step 2:** Tests in `oracle.test.ts`, styled after `smartrecruiters.test.ts`:
  - `"normalizes a recorded detail"`: title, `extId`, `url` = public apply URL, location includes country, `html` non-empty, `postedAt` ISO.
  - `"pages the list and fetches details only for kept titles"`: fake with 45 postings, alternating intern/senior → detail calls == count of intern titles.
  - `"fails the board when a list page errors"` (404 on page 2) → rejects.
  - `"fails when fewer unique ids than TotalJobsCount"` (Review Focus 5) → rejects with message containing `partial`.
  - `fetchJobs({ats:"oracle",...})` wraps errors as `ProviderError` starting `oracle/`.
- [ ] **Step 3:** Implement; add `oracle` case to `endpointFor` and `fetchJobs`. Seed JPMorgan (and Lazard, Schroders, M&S if recon confirms) with `employer` keys. Add names to `KNOWN_EMPLOYERS`.
- [ ] **Step 4:** Tests green; then `npx tsx -e` one live call for JPMorgan prints a kept count (not in CI).
- [ ] **Step 5:** Commit `feat(ingest): Oracle Recruiting Cloud provider (JPMorgan)`.

---

### Task 4: Curated programmes loader

**Files:**
- Create: `lib/ingest/curated.ts`, `tests/ingest/curated.test.ts`, `seed/programmes.yml` (two example entries only; content is Task 9)

**Interfaces:**
- Produces:
  - `type Programme = { employer: string; name: string; title: string; url: string; location: string; opens: string /*YYYY-MM*/; closes?: string /*YYYY-MM-DD*/; season: number; kind: "spring-week"|"internship"|"graduate"; description: string }`
  - `loadProgrammes(yml: string, warn?: (msg: string) => void): Programme[]` — drops invalid rows with a warning
  - `visibleProgrammes(ps: Programme[], today: string): Programme[]`
  - `programmeToRawJob(p: Programme): RawJob` — `extId = ${employer}:${season}:${kind}:${slugify(title)}`, `opensOn = ${opens}-01`, `deadline = closes ?? null`, `html` = `<p>${escaped description}</p>`, `remote: false`, `postedAt: null`
  - `curatedEmployers(ps: Programme[]): { slug: string; name: string }[]`

- [ ] **Step 1: Failing tests**
  - `"skips rows with missing url or bad opens"` (Review Focus 3): yml with 3 rows, one without `url`, one with `opens: "Sept"` → 1 programme, `warn` called twice.
  - `"hides a programme after closes"`: `closes: "2026-11-30"`, today `2026-12-01` → hidden; today `2026-11-30` → visible.
  - `"hides after 1 June of season when no closes"`: season 2027, today `2027-06-01` → hidden; `2027-05-31` → visible.
  - `"stable extId"`: same input twice → same id; `extId === "deloitte:2027:graduate:audit-and-assurance-graduate-programme"` for title "Audit & Assurance Graduate Programme".
  - `"opensOn is the first of the month"`: `opens: "2026-09"` → `opensOn: "2026-09-01"`.
  - `"escapes description html"`: `<script>` in description appears escaped in `html`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `yaml` (already a dependency).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ingest): curated programme loader`.

---

### Task 5: Curated provider, feed display and overlap hiding

**Files:**
- Modify: `lib/ingest/providers/index.ts`, `lib/ingest/seed.ts`, `scripts/setup.ts`, `lib/db/queries.ts`, `lib/scoring/dates.ts`, `lib/feed/filters.ts`, `components/job-card.tsx`, `lib/ingest/filter.ts` (if needed)
- Test: `tests/ingest/providers.test.ts`, `tests/db/` (new `tests/db/live-jobs-curated.test.ts`), `tests/feed/filters.test.ts`, `tests/scoring/` (existing dates test file)

**Interfaces:**
- Consumes: Task 4's functions; Task 1's columns.
- Produces: `fetchJobs({ats:"curated", slug})` returns `visibleProgrammes(...)` for that employer as `RawJob[]`, reading `seed/programmes.yml` (path overridable via `PLACED_PROGRAMMES_FILE` for tests); `seedCuratedCompanies(ps)` upserts `{ats:"curated", slug: employer, name, employer}`; `JobListItem` gains `opensOn: string | null; curated: boolean`; `closingLabel(job: { deadline; rolling?; opensOn? }, today)`.

- [ ] **Step 1: Failing tests**
  - providers: `"curated fetchJobs returns only that employer's visible programmes"`.
  - Curated rows must pass `passesTitleFilter` and `passesLocationFilter`: test that a seeded "Spring Week" / "Graduate Programme" / "Summer Internship" title with location "London, UK" passes both; if a title fails, set curated titles in Task 9 accordingly rather than loosening the filter.
  - `live-jobs-curated.test.ts › "hides curated cards while the employer has a live job"`: companies `workday/barclays` (employer `barclays`) with one live job and `curated/barclays` with one → `getLiveJobs` returns only the workday job; mark the workday job dead → curated job returned with `curated: true`.
  - `"keeps curated hidden when the live board errored this run"` (Review Focus 4): run `ingestCompany` for the live board with a throwing `fetchJobs`, then `getLiveJobs` → still hidden.
  - dates: `closingLabel({deadline:null, opensOn:"2026-12-01"}, "2026-10-17") === "Opens Dec 2026"`; with `opensOn:"2026-09-01"` (past) and no deadline → `"No closing date published"` (Review Focus 2).
  - filters: `soon: true` excludes a curated job whose deadline is in 3 days.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Overlap in `getLiveJobs`: select `companies.ats`, `companies.employer`, `jobs.opens_on`; after the query, collect employers with a non-curated row, drop curated rows of those employers (in TS; the list is ≤ 5000). Job card: when `r.job.curated`, render `<span className="chip">Curated</span>` next to `CompanyMark`, and title link stays `/jobs/:id` (job page "Apply" already uses `url`, the official programme page). Setup calls `seedCuratedCompanies`.
- [ ] **Step 4:** Tests green; start the dev server (`.claude/launch.json` entry with a free port, temp `PLACED_DATA_DIR`), run setup + `npm run ingest -- curated`, screenshot a feed card showing "Curated" and "Opens …".
- [ ] **Step 5:** Commit `feat(feed): curated programme cards with overlap hiding`.

---

### Task 6: Optional stealth sidecar

**Files:**
- Create: `scraper/fetch.py`, `scraper/requirements.txt` (`scrapling[fetchers]==<latest at time of writing, pinned>`), `scripts/scraper-setup.ts`, `lib/ingest/stealth.ts`, `tests/ingest/stealth.test.ts`, `tests/fixtures/fake-sidecar.mjs`
- Modify: `package.json` (`"scraper:setup": "tsx scripts/scraper-setup.ts"`), `lib/ingest/providers/index.ts`, `components/settings/job-search.tsx` (+ its data loader), `README.md` (optional scraper section), `.gitignore` (`scraper/.venv`)

**Interfaces:**
- Protocol (JSON lines over stdin/stdout, one long-lived process): request `{"id": n, "url", "method", "headers", "body"}` → response `{"id": n, "status", "headers", "body"}` or `{"id": n, "error"}`. `fetch.py` holds one `StealthySession(headless=True, solve_cloudflare=False)` and never passes `solve_cloudflare=True`.
- Produces (`lib/ingest/stealth.ts`):
  - `sidecarPath(): string` → `scraper/.venv/bin/python`; overridable by `PLACED_SCRAPER_CMD` (tests point it at `node tests/fixtures/fake-sidecar.mjs`)
  - `scraperInstalled(): Promise<boolean>` (cached; runs `fetch.py --version`)
  - `stealthFetch: typeof fetch` — starts the process lazily, closes it after 60 s idle; turns a response into a `Response`; throws `Error("blocked: …")` when `isChallenge` is true; throws `Error("needs the optional scraper: npm run scraper:setup")` when not installed; a crashed process rejects pending calls and restarts on the next call.
  - `isChallenge(status: number, headers: Record<string,string>, body: string): boolean` — true for `cf-mitigated: challenge`, "Just a moment...", `challenges.cloudflare.com/turnstile`, Akamai "Access Denied" reference pages, PerimeterX `_pxCaptcha`/"Press & Hold".
- `fetchJobs` uses `c.transport === "stealth" ? stealthFetch : fetchImpl`.

- [ ] **Step 1: Failing tests** (`stealth.test.ts`, using the fake sidecar):
  - `"isChallenge detects Cloudflare, Turnstile, Akamai, PerimeterX and passes a normal JSON body"` (one assertion per sample).
  - `"stealthFetch returns the sidecar's JSON as a Response"`.
  - `"a challenge response fails with blocked"` → rejects `/blocked/`.
  - `"missing install gives the setup hint"` (`PLACED_SCRAPER_CMD` → nonexistent) → rejects `/npm run scraper:setup/`.
  - `"sidecar crash mid-run fails that board only"` (Review Focus 1): fake exits on request 2; `runIngest` with two companies (one stealth, one normal via fake fetch) → summary `failed: 1`, normal board's jobs stored.
  - `"fetch.py never enables solve_cloudflare"`: read `scraper/fetch.py` text, assert it contains `solve_cloudflare=False` and not `solve_cloudflare=True`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `fetch.py`, `stealth.ts`, fake sidecar. `scraper-setup.ts`: find `python3.12`/`python3.11`/`python3.10`/`python3` with version ≥ 3.10 (else print the brew/pyenv hint and exit 1), create `scraper/.venv`, `pip install -r scraper/requirements.txt`, `scrapling install`, then the `--version` handshake. Settings line reads `scraperInstalled()`.
- [ ] **Step 4:** Tests green. If Python ≥ 3.10 is available, run `npm run scraper:setup` and one stealth fetch of a recon-flagged endpoint; otherwise note it in the PR as unverified live.
- [ ] **Step 5:** Commit `feat(ingest): optional Scrapling stealth sidecar (no challenge solving)`.

---

### Task 7: Amazon provider

**Files:**
- Create: `lib/ingest/providers/amazon.ts`, `tests/fixtures/ats/amazon-search.json`, `tests/ingest/amazon.test.ts`
- Modify: `lib/ingest/providers/index.ts`, `seed/companies.yml`

**Interfaces:**
- Produces: `fetchAmazon(slug: string /* "uk" */, keepTitle, fetchImpl?, sleep?): Promise<{ jobs: RawJob[]; listed: number }>`; `normalizeAmazon(item: unknown): RawJob | null`. Uses the `search.json` endpoint recorded in Task 2 with country GBR and student/early-career category filters; descriptions come in the list (no detail call) if recon confirms.

- [ ] **Step 1:** Record fixture; tests: `"normalizes a recorded item"`, `"pages until hits is reached"`, `"fails on partial list"`, `ProviderError` prefix `amazon/`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Seed `{slug: uk, name: Amazon, ats: amazon, employer: amazon}`.
- [ ] **Step 5:** Commit `feat(ingest): amazon.jobs provider`.

---

### Task 8: Recon-confirmed providers (repeat per employer)

For each employer whose recon verdict is `provider:<name>` (expected candidates: Microsoft, Google, Apple, Meta; others if found):

**Files:** `lib/ingest/providers/<name>.ts`, `tests/fixtures/ats/<name>-*.json`, `tests/ingest/<name>.test.ts`; modify `schema.ts` `ATS_VALUES` + `npm run db:generate`, `providers/index.ts`, `seed/companies.yml`.

**Interfaces:** same shape as Task 7: `fetch<Name>(slug, keepTitle, fetchImpl?, sleep?) → { jobs, listed }`, `normalize<Name>(…) → RawJob | null`.

- [ ] Same five steps as Task 7, one commit per provider: `feat(ingest): <name> provider`. Verdict `existing:<ats>/<slug>` → add the seed row only. Verdict `stealth` → seed with `transport: stealth`. Verdict `curated` → nothing here (Task 9).

---

### Task 9: Curated content for all 21 top-tier employers

**Files:** `seed/programmes.yml`, `scripts/check-programmes.ts`, `package.json` (`"programmes:check"`), `seed/companies.yml` (`employer` keys on existing top-tier boards: Morgan Stanley, Barclays, Citi, Deutsche Bank, etc.), `lib/verify/tailoring.ts`

- [ ] **Step 1:** Write `check-programmes.ts`: loads the yml via `loadProgrammes`, fails on any warning, GETs each `url` (HEAD then GET fallback, 15 s, sequential) and fails on non-2xx/3xx; prints a table.
- [ ] **Step 2:** For each of the 21 employers, up to three entries (spring week, internship, graduate) for the 2027 season, taken from the employer's official UK early-careers pages: title, url, location, opens month, closes if published, 2–4 sentence description in our own words. Titles must pass the title filter (Task 5 test).
- [ ] **Step 3:** `npm run programmes:check` → all OK.
- [ ] **Step 4:** Set `employer` on every top-tier live board in `companies.yml` so overlap hiding works.
- [ ] **Step 5:** Commit `feat(seed): curated 2027 programmes for top-tier employers`.

---

### Task 10: Benchmark, docs, roadmap

**Files:** `seed/coverage-benchmark.yml` (`tier: top` on the 21; add missing ones with `sources` incl. `curated:<employer>`), `lib/ingest/coverage.ts`, `scripts/coverage.ts`, `tests/ingest/coverage.test.ts`, `docs/research/ingest-coverage-benchmark.md`, `README.md`

**Interfaces:** `BenchmarkEmployer.tier?: "top"`; `summarize()` result gains `liveOrCurated: number` and `topTier: { name: string; status: "live" | "curated" | "missing"; kept?: number }[]`. A `curated:*` source counts as curated when `seed/programmes.yml` has a visible entry for it (offline, no fetch).

- [ ] **Step 1:** Tests: `"top-tier status prefers live over curated"`, `"liveOrCurated counts curated-only employers"`, `"overall live count ignores curated sources"`.
- [ ] **Step 2–3:** FAIL → implement → PASS.
- [ ] **Step 4:** `npm run coverage -- --live` ; expect all 21 top-tier rows `live` or `curated`; paste results (dated) into the benchmark doc. Tick the README roadmap item and add the optional scraper to the README.
- [ ] **Step 5:** Commit `docs: employer coverage results`; open the PR.
