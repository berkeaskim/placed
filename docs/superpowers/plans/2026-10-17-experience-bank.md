# Experience Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one bank per student that holds every experience, project and leadership bullet, gathered from CVs, LinkedIn, pasted posts and manual entry. For each job, a deterministic step selects a one-page subset from the bank, and the existing tailor pipeline runs on that subset.

**Architecture:**
- New module `lib/bank/` (store, match, candidates, import, select, fit), backed by four SQLite tables.
- Selection turns the bank plus the active CV into a `ParsedCV` named `base`, using bank ids.
- `app/(app)/jobs/[id]/actions.ts` → `loadTailorContext` is the single place where tailoring gets its CV, and it now returns `base`. `runTailoring`, `reverifyEdits` and `verifyTailoring` stay unchanged.
- `base` and the selection report are stored in `applications.tailored_json` (StoredTailoring `v: 2`).

**Tech Stack:** Next.js server actions, Drizzle + better-sqlite3, zod, @react-pdf/renderer, unpdf, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-experience-bank-design.md`

## Global Constraints

- A tailored CV is **always one A4 page**, in every sector. No PDF over 1 page is ever saved.
- Nothing becomes a claim unless it is traceable to a bank row or the active CV's `raw_text`. Post-derived bullets enter the bank only through an explicit per-item accept, and posts never get "Accept all".
- The active CV (`cvs`) is never written by bank code.
- With AI off (`aiMode() === "off"`): post import is disabled behind the standard banner pattern, and fixture text is never shown. CV and LinkedIn import, selection and swaps all work without AI.
- Schema changes: edit `lib/db/schema.ts`, then run `npm run db:generate`. Never hand-write SQL. Tests use temp data dirs (`withTempDb` from `tests/cv/temp-db.ts`) and never touch `./data`.
- Copy strings that the spec fixes, used verbatim:
  - "We filled this from your CV. Add more from LinkedIn or your old CVs."
  - "Capture your profile with the extension first"
  - "Your new CV added N suggestions to your bank"
  - "Your bank changed since this was tailored"
  - "added, not tailored — Tailor again to polish"
  - "This is 1.1 pages — remove one of these" (the number is the real page count with one decimal)
- Thresholds:
  - title token overlap ≥ 0.5;
  - bullet near-duplicate Jaccard ≥ 0.7;
  - min 2 bullets per included entry;
  - fit loop: ≤ 5 drops, under-fill threshold 85%, one add-retry;
  - save refusal offers the 3 lowest-scoring bullets.

## Review Focus

1. **Active CV over one page with no extra bank items.** Expect a one-page tailored CV that drops the lowest-scoring bullets and keeps every entry where it can. A test goes in Task 6, and the fit-loop test in Task 7.
2. **The same CV re-uploaded, or the same LinkedIn imported twice.** Expect no duplicate rows and no repeated suggestions; previously rejected suggestions are not offered again. Test in Task 3.
3. **An old application saved before this feature (`v: 1` tailored_json, no `base`).** Preview, save and confirmNumber must still work against the active CV. Test in Task 8.
4. **A bank row in a stored `base` is deleted or hidden after tailoring.** Preview and save still use the frozen `base` without crashing, and the stale banner shows. Test in Task 8.
5. **Pinned items alone exceed one page.** Expect the most recent pinned items to be kept, a `pinnedOverflow` warning in the report, and no crash and no 2-page PDF. Test in Task 6.

---

## File map

| File | Responsibility |
|---|---|
| `lib/db/schema.ts` (modify) | the 4 tables `bank_entries`, `bank_bullets`, `bank_sources`, `bank_suggestions` |
| `lib/bank/types.ts` | `BankEntry`, `BankBullet`, `BankSource`, `Candidate*`, `Suggestion*`, `Selection*` types |
| `lib/bank/store.ts` | DB reads/writes for the bank (the only file in `lib/bank` that imports the db client besides `import.ts`) |
| `lib/bank/match.ts` | pure normalisation, entry matching, bullet dedupe |
| `lib/bank/candidates.ts` | pure: ParsedCV / ParsedLinkedIn → candidate entries |
| `lib/bank/import.ts` | import a source → bootstrap rows or suggestions; `ensureBank` (bootstrap + lazy new-CV pickup) |
| `lib/bank/suggestions.ts` | accept / reject / edit-accept |
| `lib/ai/extractPostBullets.ts` | AI: post text → grounded candidate bullets |
| `lib/bank/select.ts` | pure scoring + greedy fill → `{ base, report, scores }` |
| `lib/bank/fit.ts` | render-and-count page fit loop |
| `app/(app)/jobs/[id]/actions.ts`, `tailor-actions.ts` (modify) | read stored/new `base`; swap actions; stale flag; overflow refusal |
| `app/(app)/jobs/[id]/bank-block.tsx` | "From your bank" UI on the tailor panel |
| `app/(app)/profile/bank/{page.tsx,actions.ts,bank-view.tsx,import-panel.tsx,suggestions-list.tsx}` | the bank page |
| `app/(app)/profile/tabs.tsx` (modify) | add the "Experience bank" tab |

---

### Task 1: Tables, types and store

**Files:**
- Modify: `lib/db/schema.ts` (append after `companyResearch`)
- Create: `lib/bank/types.ts`, `lib/bank/store.ts`
- Generated: `drizzle/0011_*.sql` + `drizzle/meta/*` via `npm run db:generate`
- Test: `tests/bank/store.test.ts`

**Interfaces:**
- Produces:
  - `BANK_SECTION_VALUES = ["experience","projects","leadership"] as const`
  - `BANK_SOURCE_KIND_VALUES = ["cv","linkedin_capture","linkedin_export","linkedin_post","manual"] as const`
  - `BANK_SUGGESTION_KIND_VALUES = ["new_entry","merge_into","new_bullet"] as const`
  - `BANK_SUGGESTION_STATUS_VALUES = ["pending","accepted","rejected"] as const`
  - the tables `bankEntries`, `bankBullets`, `bankSources`, `bankSuggestions`
  - the types in `lib/bank/types.ts`:
    ```ts
    type BankSection = "experience"|"projects"|"leadership";
    type BankBullet = { id: string; entryId: string; text: string; position: number; pinned: boolean; hidden: boolean; sourceIds: string[]; sourceText: string|null; updatedAt: string };
    type BankEntry = { id: string; section: BankSection; org: string; title: string; dates: string; startYm: string|null; endYm: string|null; location: string; pinned: boolean; hidden: boolean; sourceIds: string[]; bullets: BankBullet[]; updatedAt: string };
    type Bank = { entries: BankEntry[] };
    ```
  - `store.ts`:
    - `getBank(userId): Bank` (bullets sorted by `position`)
    - `insertEntry(userId, e: Omit<BankEntry,"id"|"bullets"|"updatedAt"> & { bullets: Omit<BankBullet,"id"|"entryId"|"updatedAt">[] }): BankEntry`
    - `updateEntry(userId, id, patch)`
    - `updateBullet(userId, id, patch)` (a `text` patch sets `sourceIds` to `[...sourceIds, "manual"]` and keeps `sourceText`)
    - `addBullet(userId, entryId, b)`
    - `deleteBullet(userId, id)`
    - `appendBulletSource(userId, bulletId, sourceId)`
    - `appendEntrySource(userId, entryId, sourceId)`
    - `upsertSource(userId, kind, ref: string|null, rawText): { id: string; created: boolean }`
    - `listSuggestions(userId, status?)`
    - `insertSuggestion(...)`
    - `setSuggestionStatus(userId, id, status)`

  Every query is scoped by `user_id`.

- [ ] **Step 1: Write the failing test.** `tests/bank/store.test.ts` uses `withTempDb()`.
  - `"getBank returns entries with bullets in position order"`: insert an entry with bullets at positions 1 and 0; expect `getBank(LOCAL_USER_ID).entries[0].bullets.map(b=>b.position)` to equal `[0,1]`.
  - `"upsertSource is idempotent on (kind, ref)"`: calling it twice with `("cv","cv-1","x")` returns the same id; the second call has `created: false`.
  - `"updateBullet text edit records manual provenance and keeps source_text"`.
  - `"queries are user-scoped"`: rows inserted for user `"other"` are not returned for `LOCAL_USER_ID`.
- [ ] **Step 2: Run** `npx vitest run tests/bank/store.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
  - Add the tables exactly as in spec §3, using the existing `uuid`/`now`/`json`/`bool`/`inList` helpers and a `check` on each enum column.
  - `bank_sources` gets `uniqueIndex("bank_sources_kind_ref").on(t.user_id, t.kind, t.ref).where(sql\`ref is not null\`)`.
  - Run `npm run db:generate`.
  - Write `types.ts` and `store.ts`. Row mapping goes snake_case → camelCase in one `toEntry` helper.
- [ ] **Step 4: Run** `npx vitest run tests/bank/store.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add lib/db/schema.ts drizzle lib/bank tests/bank && git commit -m "feat(bank): tables, types and store"`

---

### Task 2: Matching and dedupe (pure)

**Files:** Create `lib/bank/match.ts`. Test `tests/bank/match.test.ts`.

**Interfaces:**
- Produces:
  - `normOrg(s: string): string`: lowercase; strip `ltd|llp|inc|plc|limited|llc|gmbh|group`, punctuation and extra spaces.
  - `titleOverlap(a: string, b: string): number`: token Jaccard on lowercased words of length ≥ 2.
  - `rangesOverlap(a: {startYm,endYm}, b: {startYm,endYm}): boolean`: a null end means present; if any start is null, return false.
  - `sameEntry(a: {org,title,startYm,endYm}, b: same): boolean`: `normOrg` is equal or one contains the other (both non-empty), **and** (`titleOverlap ≥ 0.5` or `rangesOverlap`).
  - `bulletJaccard(a: string, b: string): number`
  - `isDupBullet(text: string, existing: string[]): boolean`: true when the Jaccard is ≥ 0.7 against any existing bullet.
  - `matchEntry(c, bankEntries): BankEntry[]`: all matches.
  - `parseYm(dates: string): { startYm: string|null; endYm: string|null }`: reuse `DATE_LINE_RE` logic from `lib/linkedin/parse-export.ts` where it fits, and also handle "Jun 2024 – Aug 2024", "2023 - Present" and "Summer 2024" (→ `2024-06`).

- [ ] **Step 1: Failing tests.**
  - `normOrg("Goldman Sachs Group, Inc.")` equals `normOrg("goldman sachs")`.
  - `sameEntry`: "Software Engineering Intern" at "Acme Ltd" (2024-06..2024-08) matches "SWE Intern" at "ACME" (2024-07..2024-09) through the date overlap.
  - Different orgs → false.
  - Same org with disjoint dates and title overlap 0 → false (two separate roles at one firm).
  - `isDupBullet("Built a Python ETL pipeline cutting load time 40%", ["Built Python ETL pipeline, cutting load time by 40%"])` → true.
  - A different claim → false.
  - `parseYm` table: `"June 2025 - August 2025 (3 months)"` → `2025-06/2025-08`; `"Sep 2024 – Present"` → `2024-09/null`; `""` → `null/null`.
- [ ] **Step 2: Run** `npx vitest run tests/bank/match.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `lib/bank/match.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(bank): entry matching and bullet dedupe`

---

### Task 3: Candidates, import, bootstrap, lazy new-CV pickup

**Files:**
- Create: `lib/bank/candidates.ts`, `lib/bank/import.ts`
- Test: `tests/bank/candidates.test.ts`, `tests/bank/import.test.ts`

**Interfaces:**
- Consumes: Task 1 store, Task 2 match, `ParsedCV` (`lib/types`), `ParsedLinkedIn` (`lib/linkedin/parse-export`).
- Produces:
  - `type CandidateEntry = { section: BankSection; org: string; title: string; dates: string; startYm: string|null; endYm: string|null; location: string; bullets: { text: string; sourceText: string }[] }`
  - `fromParsedCv(cv: ParsedCV): CandidateEntry[]`
  - `fromLinkedIn(li: ParsedLinkedIn): CandidateEntry[]`:
    - a title starting `Project: ` → `projects` with the prefix stripped, else `experience`;
    - `description` is split on `\n` and on bullet characters `•·▪-*` at line start;
    - lines are trimmed, and lines under 4 words are dropped.
  - `importCandidates(userId, source: { kind; ref; rawText }, cands: CandidateEntry[], opts: { autoAccept: boolean }): { suggestions: number; duplicates: number }`. For each candidate:
    1. Match it against the bank.
    2. 0 matches → `new_entry` (or, if `autoAccept`, insert directly).
    3. 1 match → for each bullet: if it is a duplicate, `appendBulletSource` and count it; otherwise `new_bullet` (or insert directly). Then `appendEntrySource`.
    4. ≥ 2 matches → `merge_into` with `payload.targets` = the matched ids.

    Skip creating any suggestion whose `(kind, normalised payload)` equals an existing `rejected` or `pending` one for this user.
  - `ensureBank(userId): { bootstrapped: boolean; newCvSuggestions: number }`:
    - if the active CV exists and the bank is empty: upsert source `("cv", activeCv.id, raw_text)` and `importCandidates(..., { autoAccept: true })`;
    - else if the active CV's source row does not exist: import it with `autoAccept: false` and return the suggestion count;
    - otherwise it does nothing.
  - `importLinkedInFromLatestCapture(userId): { ok: true; suggestions: number; duplicates: number } | { error: "Capture your profile with the extension first" }`: reads the newest `linkedin_scores` row by `created_at` and imports its `profile_json` as `ParsedLinkedIn`, with source `("linkedin_capture", profileUrl ?? "capture")`.
  - `importLinkedInExport(userId, pdfBytes: Uint8Array)`: `extractPdf` → `parseLinkedInExport(text)` → import with source `("linkedin_export", sha256 of bytes)`.
  - `importCvPdf(userId, pdfBytes: Uint8Array)`: `extractPdf` → `parseCV({ base64, text })` → `assignIds` → import with source `("cv", sha256)`. It never writes `cvs`.

- [ ] **Step 1: Failing tests.**
  - `candidates.test.ts`: `fromParsedCv` keeps the section and bullet text and parses `startYm`. `fromLinkedIn` routes `"Project: Placed"` to `projects` titled `"Placed"` and splits a 3-line description into 3 bullets.
  - `import.test.ts` (withTempDb, seeding a `cvs` row with `is_active=1`):
    - `"ensureBank bootstraps from the active CV with no suggestions"`
    - `"re-running ensureBank is a no-op"`
    - `"new active CV yields suggestions not rows"`: deactivate the old CV, insert a new one with one extra role, then `ensureBank` → `newCvSuggestions === 1` and the bank entry count is unchanged.
    - `"importing the same LinkedIn twice creates no new suggestions"`
    - `"a rejected suggestion is not offered again"`
    - `"duplicate bullet appends source instead of suggesting"`
    - `"importCvPdf never writes cvs"`: the `cvs` row count is unchanged. Use `fixtures/` PDF text plus fixture-mode `parseCV`.
- [ ] **Step 2: Run** `npx vitest run tests/bank`. Expected: FAIL.
- [ ] **Step 3: Implement** `candidates.ts` and `import.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(bank): import from CV and LinkedIn with suggestion flow`

---

### Task 4: Suggestion review

**Files:** Create `lib/bank/suggestions.ts`. Test `tests/bank/suggestions.test.ts`.

**Interfaces:**
- Produces:
  - `acceptSuggestion(userId, id, opts?: { editedText?: string; targetEntryId?: string }): void`
    - `new_entry` → `insertEntry`;
    - `new_bullet` → `addBullet` at the end, with `sourceText` set to the original candidate text;
    - `merge_into` → requires `targetEntryId`, which must be one of `payload.targets`; adds the candidate's non-duplicate bullets to the target and appends sources.
    - With `editedText`, the bullet's `sourceIds` also gets `"manual"`.
  - `rejectSuggestion(userId, id): void`
  - `acceptAllFromSource(userId, sourceId): number`: throws `Error("Posts are reviewed one by one")` when the source kind is `linkedin_post`.
- [ ] **Step 1: Failing tests.** One test for each kind; `merge_into` without a target throws; the post source refuses accept-all; accepting an already-resolved suggestion is a no-op.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(bank): accept and reject suggestions`

---

### Task 5: Posts → grounded bullet suggestions (AI)

**Files:**
- Create: `lib/ai/extractPostBullets.ts`, `fixtures/ai/extractPostBullets/default.json`
- Modify: `lib/ai/schemas.ts` (add `PostBulletsOutput`), `lib/ai/prompts.ts` (add `SYSTEM_POST_BULLETS`), `lib/bank/import.ts` (add `importPosts`)
- Test: `tests/bank/posts.test.ts`

**Interfaces:**
- Produces:
  - `PostBulletsOutput = z.object({ items: z.array(z.object({ text: z.string().max(300), entryHint: z.object({ org: z.string(), title: z.string() }).nullable(), newProjectTitle: z.string().max(120).nullable(), excerpt: z.string().max(600) })).max(12) })`
  - `extractPostBullets(postText: string, bankEntries: {id,org,title}[]): Promise<PostBulletsOutput>`: calls `runAi` with `tier: "fast"`, `thinking: "low"`, `fn: "extractPostBullets"`, and wraps the post as untrusted data like `wrapJob`. The prompt rules:
    - CV voice: action verb first, ≤ 30 words;
    - only facts and numbers present in the post;
    - `excerpt` is the verbatim sentence or sentences the bullet came from.
  - `importPosts(userId, posts: string[]): Promise<{ suggestions: number; dropped: number }>`. For each post:
    1. Upsert source `("linkedin_post", sha256(text), text)`.
    2. Extract the items.
    3. Drop an item unless `excerpt` is a substring of the post (whitespace-normalised) **and** `numberSet(text) ⊆ numberSet(post)`. `numberSet` is the existing private helper at `lib/verify/tailoring.ts:71`: export it, do not copy it.
    4. Resolve `entryHint` through `sameEntry` against the bank: on a match, make a `new_bullet` suggestion on that entry; otherwise make a `new_entry` with section `projects`, titled `newProjectTitle ?? "Project"`.
  - Throws `AiError(AI_NOT_SET_UP)` when `aiMode() === "off"`; the caller shows the banner.
- [ ] **Step 1: Failing tests.** In fixture mode:
  - a post with "won 1st of 40 teams" yields a suggestion carrying `40`;
  - a fixture item whose text has `"60%"`, which is not in the post, is dropped and counted in `dropped`;
  - a fixture item with an excerpt that is not in the post is dropped;
  - a matching `entryHint` creates a `new_bullet`, otherwise a `new_entry` in projects;
  - with `aiMode` mocked to `"off"`, it rejects with `AI_NOT_SET_UP`.
- [ ] **Step 2: Run** `npx vitest run tests/bank/posts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(bank): grounded bullet suggestions from LinkedIn posts`

---

### Task 6: Selection (pure)

**Files:** Create `lib/bank/select.ts`. Test `tests/bank/select.test.ts`.

**Interfaces:**
- Consumes: `Bank`, `ParsedCV`, `JobListItem`, `jdRequirementSkills` / `computeCoverage` / `cvSkillSource` (`lib/scoring/coverage`), `clicheDensity` (`lib/cv/cliches`).
- Produces:
  ```ts
  type SelectOpts = { pinnedForJob: string[]; excludedForJob: string[]; lineBudget?: number; activeCvSourceId: string|null };
  type ScoreParts = { must: string[]; nice: string[]; quantified: boolean; actionVerb: boolean; cliche: boolean; recency: number };
  type SelItem = { kind: "entry"|"bullet"; id: string; entryId: string; label: string; reason: string };
  type SelectionReport = { added: SelItem[]; leftOut: SelItem[]; pinnedOverflow: boolean };
  type Selection = { base: ParsedCV; report: SelectionReport; scores: Record<string, number>; lineBudget: number };
  function selectForJob(bank: Bank, activeCv: ParsedCV, job: JobListItem, opts: SelectOpts): Selection;
  function estimateLines(entry: { bullets: { text: string }[] }): number; // 1 header line + ceil(chars/95) per bullet
  const DEFAULT_LINE_BUDGET: number; // starting value 46, tuned in Task 7
  ```
- **Scoring** (weights are constants at the top of the file, and the builder tunes them):
  - **bullet** = `3·(# must reqs covered) + 1·(# nice covered) + 2·quantified + 1·actionVerb − 2·cliche + recency`;
    - `recency` ∈ [0, 1] by `endYm` (present = 1, falling by 0.2 per year);
    - `quantified` = the bullet has a digit, `%` or `£/$`;
    - coverage per bullet = running `computeCoverage` on a one-bullet `cvSkillSource`.
  - **entry** = the sum of its top 3 bullet scores.
- **Fill:**
  1. Fixed lines (contact, education, skills, interests from `activeCv`) are subtracted from the budget.
  2. Hidden items and `excludedForJob` items are never used; pinned and `pinnedForJob` items go in first.
  3. Then add entries by score, each with its top `min(2, n)` bullets.
  4. Then add the remaining bullets by score while they fit.
  5. Inside each section, render in date order (newest first, null dates last); bullets keep bank `position` order.
  6. If the pinned items alone overflow, keep pinned items in recency order until the budget is used, and set `pinnedOverflow`.
- **`base`:** `activeCv` with `experience`, `projects` and `leadership` replaced by the selected rows, using the bank ids as `CvEntry.id` and `CvBullet.id`.
- **`report`:**
  - `added` = selected rows whose `sourceIds` lack `activeCvSourceId`;
  - `leftOut` = unselected rows that have `activeCvSourceId`, plus the top 5 other unselected rows by score;
  - `reason` templates: `covers 'X', 'Y' (must-haves)`, `covers 'X' (nice-to-have)`, `kept for a quantified result`, `recent experience`, `pinned`; for left-out items, `lower match for this role than the items kept`.

- [ ] **Step 1: Failing tests** (a hand-built bank of about 6 entries and a quant job with requirements Python and statistics).
  - `"picks the on-topic project over an off-topic one when space is short"`
  - `"keeps a strong quantified off-topic bullet over a weak keyword-only on-topic bullet"`. This is the anti-undersell rule: assert the `scores` order.
  - `"pinned is always in; hidden never"`
  - `"pinnedForJob / excludedForJob override for this job only"`
  - `"every included entry has ≥2 bullets when it has ≥2"`
  - `"sections render newest first"`
  - `"bank equal to a one-page active CV keeps every bullet and an empty report"` (the no-regression property)
  - `"over-long active CV with no extras is trimmed to the budget"` (Review Focus 1)
  - `"pinned items alone over budget set pinnedOverflow and do not throw"` (Review Focus 5)
  - `"reasons name the covered must-haves"`
- [ ] **Step 2: Run** `npx vitest run tests/bank/select.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/bank/select.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(bank): per-job selection with job-fit and strength scoring`

---

### Task 7: One-page fit loop

**Files:** Create `lib/bank/fit.ts`. Test `tests/bank/fit.test.ts`.

**Interfaces:**
- Consumes: `renderCvPdf` (`lib/pdf/cv-document`), `toTailored` (`lib/verify/tailoring`), `renderView` (`lib/tailor/run`), `extractPdf` (`lib/cv/pdf-text`), Task 6.
- Produces:
  - `pageCount(cv: TailoredCV, contact: ParsedCV): Promise<number>`: renders, then reads `extractPdf(pdf).pageCount`.
  - `fillRatio(cv, contact): Promise<number>`: the share of page 1 in use, estimated as the text length of the last page against the full page. Used only for the 85% check.
  - `fitSelection(bank, activeCv, job, opts: SelectOpts): Promise<Selection & { pages: number }>`:
    1. Start from `DEFAULT_LINE_BUDGET`.
    2. While pages > 1 (at most 5 times): remove the lowest-scoring unpinned selected bullet. Keep each entry at ≥ 1 bullet; once that is reached, drop the whole lowest entry.
    3. If pages === 1, fill < 0.85, and unused unhidden bullets remain: re-select with `lineBudget + 4` once, and keep the result if it is still 1 page.
    4. Throws `Error("Could not fit your CV on one page")` if it still overflows.
  - `overflowCandidates(tailored: TailoredCV, scores: Record<string,number>): { bulletId: string; text: string }[]`: the 3 lowest-scoring rendered bullets, used by the save refusal in Task 8.
- [ ] **Step 1: Failing tests** (real render, no mocks).
  - A bank of 30 long bullets → `pages === 1`.
  - A short bank → no trimming, and `pages === 1`.
  - `overflowCandidates` returns 3 ids in ascending score order.
  - Calibrate: log `pages` at `DEFAULT_LINE_BUDGET` on `fixtures/` CVs. Then set the constant so that most fixtures need ≤ 1 drop, and record the chosen value in a comment.
- [ ] **Step 2: Run** `npx vitest run tests/bank/fit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(bank): render-and-count one-page fit`

---

### Task 8: Tailor integration (server)

**Files:**
- Modify: `app/(app)/jobs/[id]/actions.ts`, `app/(app)/jobs/[id]/tailor-actions.ts`, `lib/types.ts` (add optional `untailored?: boolean` to `TailoredBullet`), `lib/ai/schemas.ts` (`TailoredCvFixture` bullets accept optional `untailored`) and `lib/ai/tailorCV.ts` → `normalizeTailored` (keep the flag)
- Create: `lib/bank/tailor-context.ts`
- Test: `tests/bank/tailor-context.test.ts`, `tests/tailor/bank-actions.test.ts`

**Interfaces:**
- Produces:
  - `type StoredTailoring = { v: 1; outcome; final } | { v: 2; outcome: TailorOutcome; final: TailoredCV|null; base: ParsedCV; rawText: string; report: SelectionReport; scores: Record<string,number>; overrides: { pinned: string[]; excluded: string[] }; bankStamp: string }`
    - `bankStamp` = the max `updatedAt` over the bank rows in `base`, plus their ids hashed with sha1.
  - `lib/bank/tailor-context.ts`:
    - `groundingText(activeRaw: string, base: ParsedCV, bank: Bank): string`: active `raw_text`, plus the text and `sourceText` of each bank bullet in `base`, joined with `\n`.
    - `cvForJob(userId, job, stored: StoredTailoring|null, overrides?): Promise<{ parsed: ParsedCV; rawText: string; selection: Selection|null }>`:
      - a stored v2 → return its `base` and `rawText` (frozen);
      - else, if `overrides` are given or nothing is stored → `ensureBank`, then `fitSelection`;
      - a v1 → the active CV (Review Focus 3).
    - `isStale(userId, stored): boolean`: true when the current stamp of the ids in `base` differs, or one of those ids is missing or hidden.
  - `actions.ts`:
    - `loadTailorContext(jobId, mode: "stored"|"fresh", overrides?)` uses `cvForJob`. `TailorCtx.cv` gains `selection`.
    - `tailorForJob` uses `"fresh"` and stores `v: 2`.
    - `finalizeTailoredCv` and `confirmNumber` use `"stored"`.
    - In `renderAndStore`, before storing, if `pageCount > 1` return `{ error: "overflow", pages, remove: overflowCandidates(...) }` and do not store. The UI copy is "This is {pages.toFixed(1)} pages — remove one of these".
  - New server actions in `actions.ts`:
    - `swapBankItem(jobId, itemId, op: "add"|"remove"): Promise<TailorResult>`: no AI. It re-selects with the stored overrides plus this change, keeps the tailored bullets for ids still present, inserts new bullets with their bank text, `changeType: "kept"` and `untailored: true`, re-runs `reverifyEdits` and renders.
    - `reselectFromBank(jobId)` = `tailorForJob` with the stored overrides.
  - `tailor-actions.ts` → `load()` uses `cvForJob(..., "stored")` instead of `getActiveCv`.
- [ ] **Step 1: Failing tests.**
  - `tailor-context.test.ts`:
    - `"v1 stored row falls back to active CV"`
    - `"v2 stored row returns frozen base even after bank edits"`
    - `"isStale after editing a bullet in base"`
    - `"isStale after hiding a bullet in base; preview still works"` (Review Focus 4)
    - `"groundingText contains active raw_text and bank sourceText"`
  - `bank-actions.test.ts` (withTempDb, `AI_MODE=fixture`, seeded job + CV + bank with one extra on-topic project):
    - `tailorForJob` stores `v: 2`, and `report.added` holds the project;
    - `swapBankItem(remove)` makes no AI call (spy on `tailorCV`), and the project is gone from the stored `base`;
    - a 2-page final version is refused with `remove.length === 3` and the stored PDF path unchanged.
- [ ] **Step 2: Run** `npx vitest run tests/bank/tailor-context.test.ts tests/tailor/bank-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the full suite** `npm test && npm run typecheck`. Expected: PASS, including the existing `tests/tailor/*`.
- [ ] **Step 5: Commit.** `feat(bank): tailor from a per-job bank selection`

---

### Task 9: "From your bank" block on the tailor panel

**Files:**
- Create: `app/(app)/jobs/[id]/bank-block.tsx`
- Modify: `app/(app)/jobs/[id]/tailor-panel.tsx`, `app/(app)/jobs/[id]/page.tsx` (pass `report`, `stale` and `newCvSuggestions`)

**Interfaces:**
- Consumes: `SelectionReport`, `swapBankItem`, `reselectFromBank`, `isStale`.
- Produces: `BankBlock({ report, stale, newCvSuggestions, jobId, onResult })`.
  - **Added:** a list where each item shows its label, its reason and a Remove button.
  - **Left out for this role:** a `<details>`, closed by default, showing the top 5 left-out items, each with its reason and Add back.
  - When stale: a banner "Your bank changed since this was tailored" with a Re-select button.
  - When `newCvSuggestions > 0`: "Your new CV added N suggestions to your bank" with a link to `/profile/bank`.
  - Untailored bullets in the change list carry the tag "added, not tailored — Tailor again to polish".
  - The overflow error renders the 3 removal buttons.
- [ ] **Step 1:** Implement, matching the existing panel's Tailwind tokens (`border-2 border-[#E6E6EF]`, pill buttons, `min-h-11`).
- [ ] **Step 2: Verify in the browser.**
  1. `preview_start` the dev server, using a temp `PLACED_DATA_DIR` seeded via `npm run setup` (never Berke's `./data`, and never `AI_MODE=fixture` against his data).
  2. Open a job and click Tailor; check that Added and Left out render.
  3. Add back an item; check that it shows "added, not tailored".
  4. Take a screenshot.
- [ ] **Step 3: Commit.** `feat(bank): show added and left-out items on the tailor panel`

---

### Task 10: Bank page (view and edit)

**Files:**
- Create: `app/(app)/profile/bank/page.tsx`, `actions.ts`, `bank-view.tsx`
- Modify: `app/(app)/profile/tabs.tsx` (add `{ href: "/profile/bank", label: "Experience bank" }` after "Your roles")
- Test: `tests/bank/page-actions.test.ts`

**Interfaces:**
- Produces: server actions in `profile/bank/actions.ts`, each calling `requireUser()` and then the store:
  - `editBullet(id, text)`
  - `toggleBullet(id, field: "pinned"|"hidden")`
  - `toggleEntry(id, field)`
  - `moveBullet(id, dir: -1|1)`
  - `addManualEntry(input)` (source `manual`)
  - `addManualBullet(entryId, text)`
  - `deleteBulletAction(id)`

  Text is validated with zod (≤ 300 chars per bullet, ≤ 120 for org and title).
- The page calls `ensureBank(user.id)` first. If it bootstrapped, it shows the empty-state copy "We filled this from your CV. Add more from LinkedIn or your old CVs." Entries are grouped by section, each with a source badge (CV / LinkedIn / Post / Manual, taken from its `sourceIds` kinds) and pin/hide toggles. A pending-suggestions counter links to the review list.
- [ ] **Step 1: Failing tests:** the actions reject over-long text; `toggleBullet` flips the flag; `moveBullet` swaps positions.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and verify in the browser** (same temp-data rules as Task 9): edit, pin and hide work and survive a reload. Take a screenshot.
- [ ] **Step 5: Commit.** `feat(bank): experience bank page`

---

### Task 11: Imports and suggestion review UI

**Files:**
- Create: `app/(app)/profile/bank/import-panel.tsx`, `suggestions-list.tsx`
- Modify: `app/(app)/profile/bank/actions.ts`

**Interfaces:**
- Produces these actions:
  - `importCvAction(formData)`: PDF, using the existing upload limits from `lib/cv/upload-limits`.
  - `importLinkedInCaptureAction()`
  - `importLinkedInExportAction(formData)`
  - `importPostsAction(texts: string[])`: ≤ 10 posts of ≤ 5000 chars each. With AI off, it returns `{ error: AI_NOT_SET_UP }` and the panel shows the existing "Set up AI" link.
  - `acceptAction(id, opts)`, `rejectAction(id)`, `acceptAllAction(sourceId)`: the Accept-all button is not rendered for post sources.
- Suggestion cards:
  - `new_entry`: the whole entry, with Accept / Edit & accept / Reject.
  - `new_bullet`: "Add to {org} — {title}", plus the text.
  - `merge_into`: a radio to choose the target.
  - Post-derived cards show the verbatim `excerpt` under the bullet.
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the browser** (temp data dir with AI on via a configured provider, or fixture mode on a **temp** dir only):
  1. Upload a second CV PDF; check that suggestions appear.
  2. Accept one; check that it lands in the bank.
  3. Paste a post; check that the excerpt shows and there is no Accept all.
  4. With AI off, check that the posts box shows "Set up AI".
  5. Take screenshots.
- [ ] **Step 3: Commit.** `feat(bank): import sources and review suggestions`

---

### Task 12: End-to-end check

**Files:** Create `e2e/experience-bank.spec.ts`.

- [ ] **Step 1: Write the spec** (the Playwright server already runs `AI_MODE=fixture` on a temp dir):
  1. Upload a CV via onboarding.
  2. Open `/profile/bank`; check that the empty-state copy is visible.
  3. Add a manual project with 2 bullets that mention a requirement of a seeded job.
  4. Tailor that job; check that "From your bank" lists the project under Added.
  5. Click Remove; check that it moves to Left out.
  6. Download the PDF, and assert 1 page with `unpdf`.
- [ ] **Step 2: Run** `npx playwright test e2e/experience-bank.spec.ts`. Expected: PASS.
- [ ] **Step 3: Run everything:** `npm run lint && npm run typecheck && npm test && npm run e2e`. Expected: all green.
- [ ] **Step 4: Commit.** `test(bank): end-to-end experience bank flow`
