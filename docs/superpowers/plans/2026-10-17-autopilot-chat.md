# Autopilot Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Autopilot panel's wall of grouped questions with a full-width chat (one question at a time) plus a progress list, with a three-way long-answer flow (write it for me / give me ideas / I'll write it).

**Architecture:** The pack stays the source of truth (`buildPack` → `PackItem[]` + `Answers`). A pure module (`lib/autopilot/chat-flow.ts`) turns pack + answers into "what to ask next", the progress rows and a rebuilt transcript, so the chat holds no state the server doesn't. Suggestions and drafts are cached on the `autopilot_packs` row; drafts are made on demand. The UI is a new host that opens above the job like `CoverLetterHost`, started from a slim sidebar card.

**Tech Stack:** Next.js App Router (server actions), React client components, Tailwind, Drizzle + SQLite, zod, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-autopilot-chat-design.md`

## Global Constraints

- All user-facing copy is English (British spelling, matching the app). No Turkish anywhere.
- `setAnswer` in `app/(app)/jobs/[id]/autopilot-actions.ts` keeps its contract; every chat answer goes through it immediately. Default `remember` behaviour is kept (changing a vault row updates the remembered value).
- Right-to-work and sponsorship (`CONFIRM_KEYS`) always need an explicit confirm.
- "Open & fill" appears exactly when `canOpen(items, answers)` is true; drafts and cover never block it.
- Nothing ungrounded reaches the user: drafts, ideas and revisions go through the existing gates (`gateDraft`, ref checks).
- Every new AI call has a fixture path (`fixtures/ai/<fn>/…json`) so `AI_MODE=fixture` runs offline.
- Visual language: reuse the current panel's colours/classes (`#5B3DF5` primary, `#FFF1DC`/`#7A4100` warn, `#E3F6EE`/`#0B6B49` done, `btn-quest`, `min-h-11` targets) and `components/cover-letter/motion.css` for bubble motion. Respect `prefers-reduced-motion`.
- Schema changes: edit `lib/db/schema.ts`, then `npm run db:generate`. Never touch `./data`.
- The dev server stays on 127.0.0.1.

## Review Focus

1. **Returning mid-way** (reload after answering 3 of 6): the transcript must rebuild with those 3 answered and the chat must resume on question 4, with no AI call re-run. → Task 1 test `buildPack reuses stored suggestions`, Task 2 test `transcript rebuilds answered turns in form order`.
2. **Everything already known** (all items `vault`/`yours`): the chat must not ask anything; it shows the opening summary, the "you'll fill these" note and Open & fill straight away. → Task 2 test `nothing to ask when every item is vault or yours`.
3. **Editing an answer from the list after moving on**: clicking a ticked row re-asks it; saving updates the list and the chat returns to the first still-unanswered item, not to the item after the edited one. → Task 2 test `nextToAsk returns the first unanswered item regardless of the last edit`.
4. **Draft generation fails or is thin** (`source: "none"` / `thin`): "Write it for me" must say so in plain words and leave ideas / own writing available; it must not show an empty bubble or block. → Task 3 test `generateDraft stores and returns the empty result on failure`, Task 6 e2e asserts the thin note copy.
5. **Revising the user's own text keeps their claims**: Tidy up on a sentence not on the CV must keep it. → Task 3 test `revise keeps the user's own sentences`.

---

### Task 1: Cache suggestions and drafts on the pack; drafts on demand

**Files:**
- Modify: `lib/db/schema.ts:260-274` (add two columns to `autopilotPacks`)
- Create: `drizzle/<generated>.sql` via `npm run db:generate`
- Modify: `lib/autopilot/server.ts` (`buildPack`, new `draftInputFor`, new `generateDraft`)
- Modify: `app/(app)/jobs/[id]/autopilot-actions.ts` (`openAndFill` call site)
- Test: `tests/autopilot/build-pack-cache.test.ts`

**Interfaces:**
- Produces:
  - Columns `suggestions: json<Record<string, string | string[]>>("suggestions")` (nullable; null = not computed yet) and `drafts: json<Record<string, DraftResult>>("drafts").notNull().default(sql\`'{}'\`)`.
  - `buildPack(userId: string, jobId: string): Promise<{ items: PackItem[]; answers: Answers }>`. The `withDrafts` option is removed. It never generates drafts. Suggestions: if the row's `suggestions` is null, run `suggestAnswers` once for unanswered `ask` items and store the result (an empty object counts as computed); otherwise reuse it. Draft items get `draft` from the stored `drafts` map.
  - `draftInputFor(userId: string, jobId: string, fieldKey: string): Promise<DraftInput | null>` (null when the job, active CV, pack or a `freeText` field with that key is missing).
  - `generateDraft(userId: string, jobId: string, fieldKey: string): Promise<DraftResult | null>`: builds the input, calls `draftAnswer`, writes it into `drafts[fieldKey]` on the pack row, returns it. Returns the stored draft without calling the AI if one already exists. Null when `draftInputFor` is null.

- [ ] **Step 1: Write failing tests** in `tests/autopilot/build-pack-cache.test.ts` (use `withTempDb`/`seedJob` from `tests/cv/temp-db`, seed a pack row with a `form` so `fetchForm` is never called, `vi.mock("@/lib/autopilot/suggest")` and `vi.mock("@/lib/autopilot/drafts", async (o) => ({ ...(await o()), draftAnswer: vi.fn() }))`):
  - `buildPack reuses stored suggestions`: call `buildPack` twice → `suggestAnswers` called once; the second result still has the item in group `"confirm"` with `sourceLabel: "suggested from your CV"`.
  - `buildPack never drafts`: a form with one textarea field → `draftAnswer` not called; the draft item has `draft: undefined`.
  - `generateDraft stores and reuses`: first call calls `draftAnswer` once and the row's `drafts[key]` equals the result; second call returns the same object and `draftAnswer` is still called once; a later `buildPack` returns that draft on the item.
  - `generateDraft stores and returns the empty result on failure`: `draftAnswer` resolves `{ text: "", source: "none", thin: true, … }` → it is stored and returned (not null).
  - `generateDraft returns null for a non-free-text field key`.

- [ ] **Step 2: Run** `npx vitest run tests/autopilot/build-pack-cache.test.ts` — expect FAIL (columns / functions missing).

- [ ] **Step 3: Add the columns, run** `npm run db:generate`, **then implement** `buildPack`, `draftInputFor`, `generateDraft` in `lib/autopilot/server.ts`. In `openAndFill`, drop the `{ withDrafts: false }` argument. Write suggestions in the same upsert as `form`/`answers`.

- [ ] **Step 4: Run** `npx vitest run tests/autopilot` — expect PASS (existing `autopilot-actions.test.ts` mocks `buildPack`, so it is unaffected).

- [ ] **Step 5: Commit** `feat(autopilot): cache suggestions and drafts on the pack`

---

### Task 2: Chat flow (pure logic)

**Files:**
- Create: `lib/autopilot/chat-flow.ts`
- Test: `tests/autopilot/chat-flow.test.ts`

**Interfaces:**
- Consumes: `PackItem`, `Answers` from `lib/autopilot/pack.ts`.
- Produces:
  ```ts
  export type RowState = "done" | "current" | "upcoming" | "skipped" | "yours";
  export type ProgressRow = { key: string; label: string; state: RowState; group: PackGroup; sourceLabel: string | null };
  export type Turn =
    | { kind: "summary"; filled: number }                 // opening "I filled N answers…"
    | { kind: "ask"; key: string }                        // a bot question for item `key`
    | { kind: "answer"; key: string; text: string }       // the user's saved answer, as display text
    | { kind: "yours"; labels: string[] };                // closing "You'll fill these yourself…"
  export type ControlKind = "chips" | "dropdown" | "multi" | "text";
  export function isAskable(item: PackItem): boolean;     // confirm | ask | draft | cover
  export function isDone(item: PackItem, answers: Answers, coverReady: ReadonlySet<string>): boolean;
  export function isSkipped(item: PackItem, answers: Answers): boolean; // draft with saved empty value
  export function nextToAsk(items: PackItem[], answers: Answers, coverReady: ReadonlySet<string>, coverSkipped: ReadonlySet<string>): PackItem | null;
  export function progressRows(items: PackItem[], answers: Answers, coverReady: ReadonlySet<string>, current: string | null): ProgressRow[];
  export function transcript(items: PackItem[], answers: Answers, coverReady: ReadonlySet<string>): Turn[];
  export function controlKind(field: FormField): ControlKind;
  export function displayValue(field: FormField, v: string | string[] | null | undefined): string;
  export const coverKey: (item: PackItem) => string; // "upload" for file fields, else field.key
  ```
- Rules: an item is done when it has a saved answer (draft: `approved === true` with non-empty value; cover: `coverReady.has(coverKey(item))`). A draft is skipped when its saved value is empty. `nextToAsk` walks form order and returns the first askable item that is neither done, skipped, nor (for cover) in `coverSkipped`. `controlKind` matches today's `Choice`: `chips` for boolean or non-multiselect with ≤4 options all ≤40 chars; `multi` for multiselect with options; `dropdown` for other option lists; else `text`. `displayValue` maps option values to labels (Yes/No for booleans), joined by ", ". `vault` and `yours` rows are never `current`; `vault` rows are `done`, `yours` rows are `yours`, skipped drafts are `skipped`.

- [ ] **Step 1: Write failing tests** in `tests/autopilot/chat-flow.test.ts` with small hand-built `PackItem`s:
  - `nothing to ask when every item is vault or yours`: `nextToAsk` → null; `transcript` → `[{kind:"summary",filled:2},{kind:"yours",labels:["Gender"]}]`.
  - `nextToAsk walks form order and skips done items`: items [vault, confirm(answered), ask, draft] → returns the ask item.
  - `nextToAsk returns the first unanswered item regardless of the last edit`: items [ask A (unanswered), ask B (answered)] → A.
  - `a draft counts as done only when approved with text`; `a draft with a saved empty value is skipped and not asked`.
  - `cover is done when its key is in coverReady, and not asked when in coverSkipped`.
  - `transcript rebuilds answered turns in form order`: answered confirm + ask → `summary`, `ask`, `answer` (text via `displayValue`, e.g. `"Yes"` for `"true"`), `ask`, `answer`, then `yours` only when there are yours items.
  - `progressRows marks current, done, skipped, yours`.
  - `controlKind` cases: boolean → chips; 3 short options → chips; 5 options → dropdown; multiselect → multi; textarea → text; an option label of 41 chars → dropdown.

- [ ] **Step 2: Run** `npx vitest run tests/autopilot/chat-flow.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `lib/autopilot/chat-flow.ts`. Move `YES_NO`, `optionsOf`, `asArray`, `labelsOf` (as `displayValue`) here from `autopilot-panel.tsx` so the UI imports them.

- [ ] **Step 4: Run** the test file — expect PASS.

- [ ] **Step 5: Commit** `feat(autopilot): chat flow logic`

---

### Task 3: Ideas and revise AI calls + server actions

**Files:**
- Create: `lib/autopilot/ideas.ts`, `lib/autopilot/revise.ts`
- Create: `fixtures/ai/autopilotIdeas/default.json`, `fixtures/ai/autopilotRevise/default.json`
- Modify: `app/(app)/jobs/[id]/autopilot-actions.ts` (three new actions)
- Test: `tests/autopilot/ideas-revise.test.ts`, extend `tests/autopilot/autopilot-actions.test.ts`

**Interfaces:**
- Consumes: `DraftInput`, `DraftResult`, `gateDraft`, `cvBulletIndex` from `lib/autopilot/drafts.ts`; `runAi`, `generateStructured` from `lib/ai/provider.ts`; `draftInputFor`, `generateDraft` from Task 1.
- Produces:
  ```ts
  // lib/autopilot/ideas.ts
  export type Idea = { text: string; refs: string[] };
  export function gateIdeas(raw: Idea[], i: DraftInput): Idea[];   // keep ideas whose refs all resolve (CV bullet id, fact:<id>, jd:<n>) and pass lexiconBlock; max 3
  export async function suggestIdeas(i: DraftInput): Promise<Idea[]>; // fn "autopilotIdeas", fixtureKey `${jobExtId}-${fieldKey}`, tier "fast"; [] on error
  // lib/autopilot/revise.ts
  export type ReviseHow = "shorter" | "warmer" | "tidy";
  export function ownFacts(text: string): { id: string; claim: string }[]; // one per sentence of the user's text, ids "own-0", "own-1", …
  export async function reviseAnswer(i: DraftInput, text: string, how: ReviseHow): Promise<DraftResult>; // fn "autopilotRevise"
  // autopilot-actions.ts (all: requireUser, env.autopilot, isUuid, vault completed, else { ok: false })
  export async function draftFor(jobId: string, fieldKey: string): Promise<{ ok: true; draft: DraftResult } | { ok: false }>;
  export async function ideasFor(jobId: string, fieldKey: string): Promise<{ ok: true; ideas: Idea[] } | { ok: false }>;
  export async function reviseFor(jobId: string, fieldKey: string, text: string, how: ReviseHow): Promise<{ ok: true; draft: DraftResult } | { ok: false }>;
  ```
- Revise grounding: call the model with the CV, facts, job lines and the user's text as `ownFacts` appended to `facts`, then `gateDraft(raw, { ...i, facts: [...i.facts, ...ownFacts(text)] })`. So the user's own sentences cite `fact:own-N` and survive; new unsupported model claims are caught. `reviseFor` rejects `text` over 5000 chars and unknown `how`. Prompt: same rules as `SYSTEM` in `drafts.ts`, plus "Rewrite <answer> to be {shorter: about 70% of its words | warmer: friendlier, still professional | tidy: fix grammar and flow only}. Keep every claim the student made; add no new ones."
- Ideas prompt: "Suggest up to 3 one-line angles the student could write about for <question>, each tied to cited lines." Output schema `{ ideas: [{ text, refs }] }`.

- [ ] **Step 1: Write failing tests** in `tests/autopilot/ideas-revise.test.ts` (`vi.mock("@/lib/ai/provider")` so `runAi` returns given raw output):
  - `gateIdeas drops ideas with unknown refs and caps at 3`.
  - `suggestIdeas returns [] when the model throws`.
  - `ownFacts splits sentences with stable ids` (`"I led X. I ran Y."` → ids `own-0`, `own-1`).
  - `revise keeps the user's own sentences`: user text `"I organised a 40-person hackathon."` (not on the CV), model returns that sentence citing `fact:own-0` → kept in `text`.
  - `revise catches an added unsupported claim`: model adds `"I managed a £2m budget."` citing `fact:own-0` → appears in `caught`, not in `text`.
  - In `autopilot-actions.test.ts`: `draftFor/ideasFor/reviseFor refuse when the feature is off or the vault is incomplete`; `reviseFor rejects oversize text and unknown how`.

- [ ] **Step 2: Run** `npx vitest run tests/autopilot/ideas-revise.test.ts tests/autopilot/autopilot-actions.test.ts` — expect FAIL.

- [ ] **Step 3: Implement** `ideas.ts`, `revise.ts`, the fixtures (shape of the raw model output; reuse ids from `fixtures/ai/autopilotDraft/8232726-question_69481992.json` so they resolve on the e2e CV), and the three actions.

- [ ] **Step 4: Run** `npx vitest run tests/autopilot` — expect PASS.

- [ ] **Step 5: Commit** `feat(autopilot): ideas and revise for long answers`

---

### Task 4: Cover-letter ready signal

**Files:**
- Modify: `components/cover-letter/cover-letter-host.tsx` (export event helpers)
- Modify: `components/cover-letter/cover-letter-card.tsx` (dispatch after a successful `markReady`, near line 37/219)
- Modify: `app/(app)/jobs/[id]/autopilot-actions.ts` (new action)
- Test: extend `tests/autopilot/autopilot-actions.test.ts`

**Interfaces:**
- Produces:
  - `export const COVER_READY_EVENT = "placed:cover-letter-ready"`, `export function announceCoverReady(key: string): void` and `export function onCoverReady(cb: (key: string) => void): () => void` in `cover-letter-host.tsx`. `key` is `"upload"` or the output's `fieldKey` (same as `chat-flow` `coverKey`).
  - `export async function coverReadyKeys(jobId: string): Promise<string[]>` in `autopilot-actions.ts`: keys of this user's `coverLetterOutputs` with `status = "ready"` for the job (`"upload"` for upload targets, else `target.fieldKey`); `[]` when off / bad id.

- [ ] **Step 1: Write failing test** `coverReadyKeys lists ready outputs only` (seed a cover letter with one ready upload output and one draft field output → `["upload"]`).
- [ ] **Step 2: Run** it — expect FAIL.
- [ ] **Step 3: Implement** the action and helpers; in the card, call `announceCoverReady` only when `markReady` returns successfully.
- [ ] **Step 4: Run** `npx vitest run tests/autopilot tests/cover-letter` — expect PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): announce when an output is ready`

---

### Task 5: Chat UI, host and sidebar card; remove the old panel

**Files:**
- Create: `components/autopilot-chat/autopilot-host.tsx` — `AutopilotHost({ jobId })`, `openAutopilotChat()`, progress event helpers
- Create: `components/autopilot-chat/autopilot-start-card.tsx` — sidebar card
- Create: `components/autopilot-chat/autopilot-chat.tsx` — loads the pack, owns `answers`, renders the two columns
- Create: `components/autopilot-chat/chat-thread.tsx` — bubbles from `Turn[]` plus the live question
- Create: `components/autopilot-chat/answer-controls.tsx` — chips / dropdown / multi (+ Done) / text composer per `controlKind`
- Create: `components/autopilot-chat/long-answer.tsx` — the draft flow
- Create: `components/autopilot-chat/progress-list.tsx` — bar, rows, Open & fill
- Modify: `app/(app)/jobs/[id]/page.tsx:90` (mount `<AutopilotHost jobId={job.id} />` next to `CoverLetterHost`) and `:146` (replace `AutopilotPanel` with `AutopilotStartCard`)
- Delete: `app/(app)/jobs/[id]/autopilot-panel.tsx`

**Interfaces:**
- Consumes: `preparePack`, `setAnswer`, `openAndFill`, `draftFor`, `ideasFor`, `reviseFor`, `coverReadyKeys` (actions); everything from `lib/autopilot/chat-flow.ts`; `openCoverLetterCard`, `onCoverReady`; `ExtensionHint`.
- Produces: `openAutopilotChat(): void` (window event `"placed:autopilot"`), `announceAutopilotProgress(left: number | null)` / `onAutopilotProgress(cb)` (event `"placed:autopilot-progress"`).

Behaviour (copy is exact where quoted):
- **Start card** (sidebar): idle → `btn-quest` "Autopilot this application" + the existing subline; on click calls `openAutopilotChat()`. While open, it shows "Autopilot is open above" with a "Jump to it" link and, from the progress event, "N left" / "All answered". Locked and error states live in the chat area (same copy as today: "Set up Autopilot first (2 min)", error message + "Apply on company site").
- **Host**: full width above the job, `scroll-mt-4`, scrolls into view on open (reduced-motion aware), close button. Section `aria-label="Autopilot"`. Loading text "Reading the form…".
- **Layout**: `lg:grid-cols-[minmax(0,1fr)_280px]`; below `lg`, the progress list collapses to a bar "N of M left" above the chat that expands on tap.
- **Opening turn**: `summary` → "I filled {n} answers from your profile and past applications." + "Show" button that highlights the done rows. Omitted when n = 0.
- **Confirm question**: "{sourceLabel, capitalised}: {label}? → {displayValue}" phrased as e.g. "From your CV: Do you have the right to work in the UK? I've put **Yes**." Chips: the suggested value (primary, saves it) and "Change" (shows the full control). When ≥2 confirms with values are pending, an extra chip "Looks right, confirm all {n}" saves them in sequence (same as today's confirm-all).
- **Ask question**: bot bubble = field label (+ " *" if required); control per `controlKind`. Chips/dropdown save on pick; multi saves on "Done"; text saves on Enter / send. Each save calls `setAnswer` then appends the answer turn and moves to `nextToAsk`. On failure: inline "Couldn't save. Try again." and stay.
- **Long answer** (`long-answer.tsx`): bot asks "{label} (up to {limit} words)". Chips: "Write it for me", "Give me ideas", "I'll write it", and quieter "Skip, I'll write it on the form".
  - Write it for me → "Writing…" then `draftFor`; shows text, "{words} / {limit} words", "Built from:" chips (`sourceChip` logic from the old panel), "Caught it" details; chips "Use this" (`setAnswer(..., { approved: true })`), "Shorter", "Warmer" (`reviseFor`), "Edit" (text into composer; saving an edit uses `approved: false` and shows "Not approved yet" with a "This is my answer" chip). Thin/none: "Not enough on your CV for this one. Add your own words." and the ideas / I'll write chips stay.
  - Give me ideas → `ideasFor`; numbered ideas as toggle chips; composer with live word counter; after they type, a "Tidy up" chip (`reviseFor(..., "tidy")`) then the same "Use this" flow. No ideas → "I couldn't find a strong angle on your CV. Try writing a few lines and I'll tidy them."
  - I'll write it → composer with counter → "This is my answer".
  - Skip → `setAnswer(jobId, key, "", { approved: false })`, row shows "You'll fill".
- **Cover question**: "This form needs a cover letter." (file) / "{label}" (text field) with chips "Write cover letter" / "Write this answer" (calls `openCoverLetterCard` as the old panel did) and "Skip for now" (client-only `coverSkipped`). Ticks live via `onCoverReady`; initial state from `coverReadyKeys`.
- **Closing turn**: `yours` → "You'll fill these yourself on the form: {labels}." + "Diversity, consent and declarations stay yours."
- **Progress list**: bar (done / askable+vault), rows with state styling (done = tick + muted, current = highlighted, skipped/yours = grey "You'll fill"). Clicking a done/skipped/upcoming row makes it the live question (re-ask) and scrolls the chat to the bottom; after it is saved, the chat continues from `nextToAsk`. Under the rows: "Open & fill →" (`btn-quest`, enabled when `canOpen`), the "Nothing opened? Open the form. This link works once." fallback, open errors, `ExtensionHint` — all as the old panel.
- Emit `announceAutopilotProgress(left)` whenever `answers` change.
- Motion: new bubbles use the cover-letter `motion.css` entrance; no typing delay when reduced motion.

- [ ] **Step 1: Build the components and wire `page.tsx`; delete the old panel.**
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test` — expect all PASS (fix any import of `autopilot-panel`).
- [ ] **Step 3: Verify in the browser** (dev server via `.claude/launch.json` entry for this worktree on a free port, `NEXT_PUBLIC_AUTOPILOT=1 AI_MODE=fixture`): open a job with a seeded pack, run through confirm, ask, long answer (all four chips), cover handoff, re-ask from the list, reload mid-way, mobile width 375px, dark/light. Screenshot desktop and mobile.
- [ ] **Step 4: Commit** `feat(autopilot): chat replaces the question panel`

---

### Task 6: End-to-end coverage

**Files:**
- Create: `e2e/autopilot-chat.spec.ts`
- Modify: `e2e/autopilot.spec.ts` (opt-in Monzo test: drive the chat instead of `[data-autopilot-group]` rows and the "Application pack" region)

**Interfaces:**
- Consumes: the UI from Task 5; seeding helpers in the style of `e2e/cover-letter.spec.ts` (`seedCv`, `seedJob`).

- [ ] **Step 1: Write** `e2e/autopilot-chat.spec.ts` (skips unless `NEXT_PUBLIC_AUTOPILOT=1`): fill `/autopilot/setup` with the fictional Ayşe Demir persona (as `autopilot.spec.ts` does), seed a CV and a job whose `autopilot_packs.form` is pre-inserted (fields: a boolean right-to-work, a 3-option select, a required text "Notice period", a textarea "Why us?" with `wordLimit: 150`, a gender select), so no employer page is fetched. Then:
  - Start from the sidebar → `region "Autopilot"` visible above the job.
  - Assert the opening summary text matches `/I filled \d+ answers/`.
  - Answer each question via chips / composer; assert the progress list ticks each row.
  - On "Why us?": "Write it for me" → draft visible with a `/\d+ \/ 150 words/` counter → "Use this".
  - Reload → the answered turns are back and no question is pending; "Open & fill →" enabled.
  - Click a ticked row → it is re-asked; change the answer → list updates.
- [ ] **Step 2: Run** `NEXT_PUBLIC_AUTOPILOT=1 npx playwright test e2e/autopilot-chat.spec.ts` — expect PASS.
- [ ] **Step 3: Update** `e2e/autopilot.spec.ts` selectors to the chat; run it only if the Monzo job is seeded locally (it is opt-in; note in the PR if not run).
- [ ] **Step 4: Commit** `test(autopilot): e2e for the chat`

---

## Addendum tasks (spec addendum, 2026-10-17)

### Task 7: Remember diversity (EEO) answers

**Files:**
- Modify: `lib/autopilot/pack.ts` (`assemblePack` `case "eeo"`; `canOpen`)
- Modify: `app/(app)/jobs/[id]/autopilot-actions.ts` (`setAnswer`)
- Modify: `lib/autopilot/server.ts` (exclude EEO from `toSuggest`)
- Modify: tests that assert EEO is never stored (`tests/autopilot/autopilot-actions.test.ts` "never stores or remembers an answer for EEO…", any in `pack.test.ts`)
- Test: `tests/autopilot/pack.test.ts`, `tests/autopilot/autopilot-actions.test.ts`

**Interfaces:**
- `assemblePack`: `case "eeo"` → `recall() ?? item("ask")` (asked whether required or optional). `consent` and `yours` unchanged.
- `canOpen(items, answers)`: an `ask` item whose field is not `required` never blocks.
- `setAnswer`: accepts `kind === "eeo"` and remembers it like `extra` (same `rememberable`, same 200-key cap). Remove the `isEeoLabel` exclusion from the remember branch.
- `buildPack`: `toSuggest` excludes EEO items (`classify(...).kind === "eeo"` or `isEeoLabel`), so they are never AI-suggested. `suggestAnswers` keeps its own EEO filter.
- `lib/autopilot/chat-flow.ts` needs no change (EEO items are plain `ask` items); the chat's closing "yours" note text "Diversity, consent and declarations stay yours." becomes "Consent and declarations stay yours."

- [ ] **Step 1: Update/replace tests:** `eeo is asked, and recalled exactly once remembered` (pack); `an optional ask item never blocks canOpen` (pack); `remembers an EEO option label like any other answer` (actions, replacing the old never-store test); `EEO items are never sent to suggestAnswers` (build-pack-cache test, mock asserts the items passed).
- [ ] **Step 2: Run** `npx vitest run tests/autopilot` — expect the new tests to FAIL.
- [ ] **Step 3: Implement** the four changes above plus the copy change in `components/autopilot-chat/chat-thread.tsx`.
- [ ] **Step 4: Run** `npx vitest run tests/autopilot && npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(autopilot): remember diversity answers`

### Task 8: Reuse earlier long answers

**Files:**
- Modify: `lib/db/schema.ts` (new table `autopilotLongAnswers`), `npm run db:generate`
- Modify: `app/(app)/jobs/[id]/autopilot-actions.ts` (`setAnswer` stores approved long answers)
- Modify: `lib/autopilot/server.ts` (`buildPack` attaches `previous`)
- Modify: `lib/autopilot/pack.ts` (`PackItem.previous`)
- Modify: `components/autopilot-chat/long-answer.tsx` (new first chip)
- Modify: `app/(app)/autopilot/setup/remembered-answers.tsx`, its page and `actions.ts` (list + forget long answers)
- Test: `tests/autopilot/long-answers.test.ts`

**Interfaces:**
- Table `autopilot_long_answers`: `id uuid pk`, `user_id text not null`, `job_id text not null references jobs(id) on delete cascade`, `field_label text not null`, `company text not null`, `text text not null` (sealed with `sealVault("extra", userId, …)`-style encryption via a new `sealText`/`openText` pair in `lib/autopilot/vault-crypto.ts` if no text helper exists), `updated_at`; unique `(user_id, job_id, field_label)`.
- `setAnswer`: when `kind === "freeText"`, `opts.approved === true` and the value is a non-empty string, upsert the row (company from the job). An unapproved or empty save deletes nothing.
- `PackItem.previous?: { text: string; company: string; words: number }`.
- `findPreviousAnswer(userId: string, jobId: string, label: string): { text: string; company: string } | null` in `lib/autopilot/server.ts`: rows for this user from OTHER jobs, matched with `findRemembered` over a `{ normLabel(field_label): … }` map (most recent row wins per label); `buildPack` sets `previous` on `draft` items.
- Chat: for a draft item with `previous`, the first chip is "Use my answer from {company}". Tapping it shows the text with "{words} / {limit} words" (warn colour when over), and chips "Use this" / "Shorter" / "Warmer" / "Edit" — the same handlers as the "Write it for me" result. The other chips stay.
- Remembered answers page: a second list "Long answers ({n})" showing label, company and the first 140 chars, each with Forget (`forgetLongAnswer(id: string): Promise<{ ok: boolean }>`).

- [ ] **Step 1: Write failing tests** in `tests/autopilot/long-answers.test.ts`: `an approved long answer is stored per job and encrypted at rest` (raw column ≠ plain text); `an unapproved save stores nothing`; `findPreviousAnswer matches a similar label on another job and ignores the same job`; `buildPack attaches previous to the matching draft item`; `forgetLongAnswer removes only the user's row`.
- [ ] **Step 2: Run** them — expect FAIL.
- [ ] **Step 3: Implement** schema + migration, storage, matching, the chip, and the Remembered answers list.
- [ ] **Step 4: Run** `npx vitest run tests/autopilot && npm run typecheck && npm run lint` — expect PASS.
- [ ] **Step 5: Commit** `feat(autopilot): reuse earlier long answers`
