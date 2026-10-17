# Cover Letter Writer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cover letter writer that interviews the student in a short chat (3–4 skippable questions), optionally researches the firm, streams a grounded letter into a side-by-side editor with approved AI motion, and hands Ready letters to Autopilot or to the student as PDF/text.

**Architecture:**
- Pure, tested modules in `lib/cover-letter/`:
  - rules/lint, mode choice, stream-marker parser, question state machine;
  - a ready gate;
  - service modules for research, evidence pack, draft, verify, edit and PDF, which take their dependencies as arguments.
- A new `streamText` call in `lib/ai/provider.ts`, with fixture replay.
- SQLite tables for letters, outputs, stories and the research cache.
- Server actions plus one streaming route.
- A client card (`components/cover-letter/`) used both by the job page and by the Autopilot panel.
- Autopilot gets a `cover` pack group, and the extension fills Ready outputs.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript, Drizzle + better-sqlite3, zod 4, `motion` 14, `@react-pdf/renderer`, vitest 5, Playwright, MV3 extension (plain JS).

**Spec:** `docs/superpowers/specs/2026-10-17-cover-letter-writer-design.md`. Research: `docs/research/cover-letter/00-playbook.md`, `docs/research/cover-letter/cover-letter-rules.json`.

## Global Constraints

- Local-first: SQLite through Drizzle (`@/lib/db/client`). Schema changes go in `lib/db/schema.ts`, then `npm run db:generate`. Tests never touch `./data`.
- Single user: get the id with `requireUser()` from `@/lib/auth/local-user`.
- Every LLM call goes through `lib/ai/provider.ts`. Writer calls are interactive (never `background: true`).
- No invented facts. Locked spans (the student's answers) appear verbatim, with only spelling and grammar fixed.
- No auto-submit. The extension fills only outputs whose status is `ready`.
- Visa, right to work, disability, grades and gaps are never mentioned by the writer in v1.
- Never compute or show an AI-detector score.
- en-GB spelling, UK dates (`17 October 2026`), salutation and sign-off per playbook §3. Our own UI copy has no exclamation marks.
- Length bands (from `cover-letter-rules.json` → `modes`):

  | Mode | Length |
  |---|---|
  | `full_letter` | 250–400 words, hard max 450 |
  | `short_letter` | about 300 words (150–330) |
  | `field_answer` | 85–100% of the form limit (default 300 words) |
  | `short_note` | 50–150 words |

- Research cache TTL is 7 days. Facts older than 12 months are dropped or labelled.
- At most 2 repair rounds after the draft.
- Motion uses critically damped springs (damping 1.0, response 0.35–0.4s). Animate only `transform`, `opacity` and `filter`, except the removed-span width collapse. Typing dots show for at most 450ms.
- `prefers-reduced-motion: reduce` gets cross-fades only (no blur, spin or breathing), and text appears per sentence instead of per word.
- Approved motion reference: `.superpowers/brainstorm/79004-1792231195/content/ai-motion-prototype.html`. Port its CSS tokens and keyframes; don't redesign them.

## Review Focus

1. **A reload in the middle of a stream.** Reopening the card shows the saved partial state (answers kept, draft either complete or marked "interrupted, write again"). No spinner is left running. Covered in Task 11 (`resumes interrupted draft as idle`).
2. **Research or the provider fails or times out.** The chat shows the inline error with Retry, the letter can still be written from the job description and answers, and no `.orb` keeps spinning. Covered in Task 6 (`research failure returns none`) and Task 14 (an e2e step with research forced to fail).
3. **The student skips every question.** The writer still produces a letter using only CV facts. The "why them" paragraph uses job-description anchors and is flagged "add your own reason". There is no invented motivation. Covered in Task 8 (`all-skipped draft has no unsupported them-sentence`).
4. **A form limit given in characters.** Counted including spaces and newlines, and Ready is blocked when over. Covered in Task 1 (`counts characters with newlines`) and Task 8 (`ready blocked over char limit`).
5. **A student answer containing a banned phrase or US spelling.** It stays verbatim and gets an amber note, never a block. Covered in Task 8 (`own text is exempt from block`).

---

## File Structure

```
lib/cover-letter/
  rules.json            copy of docs/research/cover-letter/cover-letter-rules.json (sync-tested)
  rules.ts              lexicon/counter lint, pure: lintParagraph, lintLetter, countWords, countChars
  mode.ts               chooseMode, aiPolicyBlocks, isMotivationLabel
  stream-parse.ts       incremental ⟦marker⟧ parser → sentences with refs
  questions.ts          deterministic interview state machine
  gate.ts               canMarkReady (Ready gate)
  store.ts              DB read/write for letters, outputs, stories, research cache
  research.ts           researchCompany: Gemini grounded → Serper+fetch → none (deps injected)
  evidence.ts           buildEvidence (generateStructured)
  draft.ts              buildDraftPrompt, streamDraft
  verify.ts             verifyOutput: lint + grounding + locked spans; repair loop
  edit.ts               applyEdit (targeted rewrite) + undo
  pdf.tsx               renderLetterPdf
  service.ts            orchestration used by actions/route
  types.ts              shared types (below)
lib/ai/provider.ts      + streamText; adapters in gemini.ts / anthropic.ts / ollama.ts
lib/db/schema.ts        + cover_letters, cover_letter_outputs, cover_letter_stories, company_research
lib/files.ts            + "letters" bucket
lib/autopilot/classify.ts, pack.ts, server.ts, drafts.ts   (cover group, claim payload, hard-lexicon lint)
app/(app)/jobs/[id]/cover-letter-actions.ts               server actions
app/api/cover-letter/[jobId]/draft/route.ts               streaming route (SSE)
components/cover-letter/*.tsx + motion.css                card, chat, letter pane, research card, chips
extension/background.js, content.js, fillers/*.js         coverFile / coverText
e2e/cover-letter.spec.ts                                  motion + flow e2e
fixtures/ai/coverLetter*/                                  fixtures
```

### Shared types (`lib/cover-letter/types.ts`, created in Task 1, extended later only by adding fields)

```ts
export type Mode = "skip" | "full_letter" | "short_letter" | "field_answer" | "short_note";
export type Limit = { unit: "words" | "chars"; max: number } | null;
export type SpanKind = "ai" | "theirs";
export type Span = { start: number; end: number; kind: SpanKind; refs: string[]; flag?: string };
export type LintHit = { ruleId: string; label: string; severity: "block" | "high" | "med" | "low"; start: number; end: number; scope: SpanKind | "letter" };
export type Fact = { id: string; claim: string; url: string; publisher: string; date: string | null };
export type Answer = { id: string; question: "why_firm" | "facts" | "story" | "touchpoint" | "product"; text: string | null; pickedFactIds?: string[]; cvEntryId?: string };
export type OutputTarget = { kind: "upload" } | { kind: "field"; fieldKey: string; label: string };
export type OutputStatus = "draft" | "ready";
```

---

### Task 1: Rules module and lint

**Files:**
- Create: `lib/cover-letter/types.ts`, `lib/cover-letter/rules.json` (byte copy of the research JSON), `lib/cover-letter/rules.ts`
- Test: `tests/cover-letter/rules.test.ts`

**Interfaces:**
- Produces:
  - `countWords(text: string): number`
  - `countChars(text: string): number`: raw length, including spaces and newlines.
  - `lintParagraph(text: string): LintHit[]`: lexicon (hard + soft) plus paragraph-scope counters (em dash, not-only-but, triplet).
  - `lintLetter(text: string, opts: { mode: Mode; limit: Limit; company: string; role: string; otherEmployers: string[]; ownSpans: Span[] }): LintHit[]`: everything in `lintParagraph`, plus length and limit, company and role in the first paragraph (first sentence for `field_answer`), salutation/sign-off pairing for letter modes, absence of furniture for `field_answer`/`short_note`, other-employer names, sentence and paragraph rhythm counters, and the soft-density rule (> 3 distinct soft hits per 300 words).
  - Each hit inside an `ownSpans` range gets `scope: "theirs"`, else `"ai"`; letter-level hits get `"letter"`.
  - `RULES`: the parsed JSON.

- [ ] **Step 1: Write failing tests**

```ts
it("rules.json is identical to the research copy", () => {
  expect(readFileSync("lib/cover-letter/rules.json", "utf8")).toBe(readFileSync("docs/research/cover-letter/cover-letter-rules.json", "utf8"));
});
// The five weak/strong pairs from docs/research/cover-letter/02-structure-craft.md §3 (copy the quoted paragraphs as constants).
it.each(WEAK)("weak paragraph %# gets at least one hit", (p) => expect(lintParagraph(p).length).toBeGreaterThan(0));
it.each(STRONG)("strong paragraph %# has no lexicon hits", (p) => expect(lintParagraph(p).filter((h) => h.ruleId === "CL-50" || h.ruleId === "CL-51")).toEqual([]));
it("counts characters with newlines", () => expect(countChars("ab\ncd ")).toBe(6));
it("flags another employer and missing company", () => {
  const hits = lintLetter("Dear Hiring Manager,\n\nI am applying to Goldman Sachs.", { mode: "full_letter", limit: null, company: "Morgan Stanley", role: "Analyst", otherEmployers: ["Goldman Sachs"], ownSpans: [] });
  expect(hits.map((h) => h.ruleId)).toEqual(expect.arrayContaining(["CL-20", "CL-21"]));
});
it("field_answer must not have Dear/Yours", () => expect(lintLetter("Dear team, I want this. Yours sincerely", { mode: "field_answer", limit: { unit: "words", max: 150 }, company: "X", role: "Y", otherEmployers: [], ownSpans: [] }).some((h) => h.ruleId === "CL-04")).toBe(true));
it("marks hits inside own spans as theirs", () => {
  const t = "I am a team player at Acme.";
  expect(lintParagraphScoped(t, [{ start: 0, end: t.length, kind: "theirs", refs: [] }])[0].scope).toBe("theirs");
});
```

`lintParagraphScoped(text, ownSpans)` is the exported helper `lintLetter` uses to assign scope.

- [ ] **Step 2: Run** `npx vitest run tests/cover-letter/rules.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
  - Compile every lexicon pattern once with `RULES.lexicon.flags`.
  - Hard hits map to `CL-50` / severity `block`, except these labels, which map to their own rule and severity: `Placeholder` and `Chatbot leakage` → `CL-21`, `Salutation` → `CL-42`, `Consulting stepping-stone` → `CL-70`, `Money as motivation` → `CL-71`, `Deficit framing` → `CL-35`.
  - Soft hits → `CL-51` / `med`.
  - Rhythm counters → `CL-53`/`CL-54`/`CL-55` / `low`.
  - Length/limit → `CL-02` (`block` over the limit) and `CL-03` (`high` outside the band).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): rules JSON and deterministic lint`

---

### Task 2: Mode choice, AI-policy check, motivation classification

**Files:**
- Create: `lib/cover-letter/mode.ts`
- Modify: `lib/autopilot/classify.ts` (add a `motivation` kind), `lib/autopilot/pack.ts` (add a `cover` group)
- Test: `tests/cover-letter/mode.test.ts`, extend `tests/autopilot/classify.test.ts` and `tests/autopilot/pack.test.ts`

**Interfaces:**
- Produces:
  - `isMotivationLabel(label: string): boolean`. Matches `/cover letter|covering letter|why (do you want|are you interested|this|us|join)|motivat|interest in (the )?(role|firm|company|programme|program|division|team)/i`. Never matches `additional information|anything else` (those stay `yours`).
  - `chooseMode(input: { target: OutputTarget; fieldType?: "file" | "textarea"; wordLimit?: number; charLimit?: number; jdText: string }): { mode: Mode; limit: Limit; reason: string }`.
  - `aiPolicyBlocks(jdText: string): boolean`: uses `RULES.lexicon.counters.aiPolicy`.
  - `noLetterWanted(jdText: string): boolean`: matches `/no (cover|covering) letter|cover letters? (are|is) not (required|needed|accepted)|do not (send|include) a cover letter/i`.
  - `classify()` returns `{ kind: "motivation" }` for a textarea whose label passes `isMotivationLabel`. The check runs before the existing `freeText` rules and after the RTW/sponsorship and `YOURS` checks.
  - `PackGroup` gains `"cover"`. A `file`+`cover` field and a `motivation` field both become `item("cover")`.

- [ ] **Step 1: Failing tests**

```ts
expect(chooseMode({ target: { kind: "upload" }, fieldType: "file", jdText: "" })).toMatchObject({ mode: "full_letter", limit: null });
expect(chooseMode({ target: { kind: "field", fieldKey: "q1", label: "Why us?" }, fieldType: "textarea", wordLimit: 250, jdText: "" })).toMatchObject({ mode: "field_answer", limit: { unit: "words", max: 250 } });
expect(chooseMode({ target: { kind: "field", fieldKey: "q1", label: "Why us?" }, fieldType: "textarea", jdText: "" }).limit).toEqual({ unit: "words", max: 300 });
expect(chooseMode({ target: { kind: "upload" }, fieldType: "file", jdText: "Please note: no cover letter is required." }).mode).toBe("skip");
expect(aiPolicyBlocks("Please don't use AI assistants when applying")).toBe(true);
expect(classify("Why do you want to join Monzo?", "textarea")).toEqual({ kind: "motivation" });
expect(classify("Additional information", "textarea")).toEqual({ kind: "yours" });
expect(classify("Cover Letter", "file")).toEqual({ kind: "file", which: "cover" });
// pack: a cover file field and a motivation textarea land in the "cover" group
```

- [ ] **Step 2: Run** `npx vitest run tests/cover-letter/mode.test.ts tests/autopilot/classify.test.ts tests/autopilot/pack.test.ts`. Expected: new cases FAIL.
- [ ] **Step 3: Implement**, as described in Interfaces.
  - In `buildPack`, `motivation` fields are no longer sent to `draftAnswer`.
  - In `toFillPlan`, a `cover` item is emitted with mode `"yours"` for now; Task 13 switches it to fill.
- [ ] **Step 4: Run the tests plus the full `tests/autopilot` folder.** Expected: PASS, with no regressions.
- [ ] **Step 5: Commit** `feat(cover-letter): mode choice and motivation fields route to the writer`

---

### Task 3: Schema, files bucket and store

**Files:**
- Modify: `lib/db/schema.ts`, `lib/files.ts` (add the `"letters"` bucket to `BUCKETS`); a new migration from `npm run db:generate`
- Create: `lib/cover-letter/store.ts`
- Test: `tests/cover-letter/store.test.ts`

**Interfaces:**
- **Tables** (use the existing `uuid`/`now`/`json` helpers):
  - `cover_letters`:
    - `id`; `user_id`;
    - `job_id` (FK jobs, cascade);
    - `chat: json<ChatMsg[]>`, `answers: json<Answer[]>`, `facts: json<Fact[]>`, `evidence: json<Evidence | null>`;
    - `research_state`: one of `"idle" | "running" | "done" | "none" | "failed"`;
    - `draft_state`: one of `"idle" | "streaming" | "done" | "interrupted"`;
    - `created_at`, `updated_at`;
    - unique (`user_id`, `job_id`).
  - `cover_letter_outputs`:
    - `id`; `letter_id` (FK, cascade);
    - `target: json<OutputTarget>`, `mode`, `limit: json<Limit>`;
    - `status`: `draft | ready`;
    - `text`, `spans: json<Span[]>`, `lint: json<LintHit[]>`, `undo: json<{ text: string; spans: Span[] }[]>`;
    - `pdf_path`, `updated_at`.
  - `cover_letter_stories`:
    - `id`, `user_id`;
    - `cv_entry_id` (nullable), `company` (nullable);
    - `kind`: `"story" | "why_firm"`;
    - `text`, `created_at`, `updated_at`, `last_used_at`.
  - `company_research`:
    - `id`; `company_key` (lowercased company + `|` + division);
    - `facts: json<Fact[]>`, `rivals: json<string[]>`;
    - `provider`: `"gemini" | "serper" | "none"`;
    - `fetched_at`;
    - unique (`company_key`).
- `ChatMsg = { id: string; from: "bot" | "me"; text: string; kind?: "question" | "research" | "facts" | "done" | "error"; questionId?: Answer["question"] }`. `Evidence` is defined in Task 7; store it as `unknown` here and narrow it later.
- **Store functions:**
  - `getOrCreateLetter(userId, jobId): LetterRow`
  - `saveLetter(id, patch: Partial<LetterRow>): void`
  - `listOutputs(letterId): OutputRow[]`
  - `upsertOutput(letterId, target: OutputTarget, patch): OutputRow`
  - `pushUndo(outputId, prev)`
  - `popUndo(outputId): { text; spans } | null`
  - `rememberStory(userId, s: { kind; cvEntryId?; company?; text })`
  - `findStories(userId, q: { cvEntryId?: string; company?: string; kind }): StoryRow[]`
  - `deleteStory(userId, id)`
  - `getResearch(key, now = Date.now()): ResearchRow | null`: null when older than 7 days.
  - `putResearch(row)`

- [ ] **Step 1: Failing tests** (temp data dir, provided by `tests/setup/temp-data-dir.ts`):
  - `getOrCreateLetter` is idempotent;
  - outputs are keyed by `target.fieldKey`, or by `upload`;
  - `popUndo` returns entries last in, first out;
  - `getResearch` returns null at 7 days + 1 ms;
  - `findStories` filters by `cvEntryId` and by `kind`.
- [ ] **Step 2: Run** `npx vitest run tests/cover-letter/store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Edit the schema, run `npm run db:generate`, check the generated SQL by eye, then write the store.
- [ ] **Step 4: Run the tests plus `tests/db`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): tables, letters bucket and store`

---

### Task 4: `streamText` in the provider (+ fixture replay)

**Files:**
- Modify: `lib/ai/provider.ts`, `lib/ai/gemini.ts`, `lib/ai/anthropic.ts`, `lib/ai/ollama.ts`
- Test: `tests/ai/stream.test.ts`

**Interfaces:**
- **Produces:**
  - `type StreamRequest = { tier: "fast" | "smart"; system: string; prompt: string; signal?: AbortSignal; maxTokens?: number }`
  - `streamText(req: StreamRequest, o: { fn: string; fixtureKey?: string }): AsyncIterable<string>`. It yields text deltas.
- **Fixture mode** (`aiMode() === "fixture"`):
  - Reads `fixtures/ai/<fn>/<fixtureKey|default>.txt`.
  - Yields it in chunks of 1–3 words, with `await new Promise(r => setTimeout(r, 15))` between chunks, so the UI animates deterministically.
  - With no fixture, it yields nothing.
- **Adapters:** `geminiStream(req, c?)`, `anthropicStream(req, c?)`, `ollamaStream(req, f = httpFetch)`.
  - Each takes an injectable client, like the structured adapters do.
  - Gemini uses `models.generateContentStream` with LOW thinking.
  - Anthropic uses `messages.stream`, yielding on `text` events.
  - Ollama uses `/api/chat` with `stream: true`, parsing NDJSON lines and yielding `message.content`. It goes through the existing interactive-before-background queue and honours `OLLAMA_TIMEOUT_MS`.
  - Errors are thrown as `AiError` with the shared messages.

- [ ] **Step 1: Failing tests:**
  - each adapter, driven by a fake client or fetch that emits 3 chunks, yields exactly those 3 strings;
  - an aborted signal stops the iteration;
  - fixture mode yields the full file text once the chunks are joined.
- [ ] **Step 2: Run** `npx vitest run tests/ai/stream.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it plus `tests/ai`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(ai): streamText across Gemini, Claude and Ollama with fixture replay`

---

### Task 5: Stream marker parser

**Files:**
- Create: `lib/cover-letter/stream-parse.ts`
- Test: `tests/cover-letter/stream-parse.test.ts`

**Interfaces:**
- **Produces:**
  - `type Marked = { text: string; about: "me" | "them" | "you" | null; refs: string[] }`
  - `class MarkerParser`:
    - `push(delta: string): { visible: string; closed: Marked[] }`: `visible` is the newly displayable text with markers stripped; `closed` lists sentences finished in this push.
    - `end(): Marked[]`
- **Marker grammar:** `⟦(me|them|you):[a-z0-9_,:-]+⟧`. It sits at the end of a sentence and attaches to the text since the previous marker or paragraph break.
  - Text with no marker before a paragraph break closes with `about: null`.
  - A partial marker split across deltas is held back and never shown.
  - Paragraph breaks (`\n\n`) pass through to `visible`.

- [ ] **Step 1: Failing tests:**
  - a marker split across 3 deltas is never visible;
  - `"I ran the desk.⟦me:b12,b14⟧ Your rotation…⟦them:fact2⟧"` → two `Marked`, with refs `["b12","b14"]` and `["fact2"]`;
  - a sentence with no marker → `about: null`;
  - `visible` concatenated equals the input with all markers removed.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** a small state machine (normal / in-marker), with a buffer for a possible `⟦` prefix.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): streaming sentence-marker parser`

---

### Task 6: Firm research

**Files:**
- Create: `lib/cover-letter/research.ts`
- Test: `tests/cover-letter/research.test.ts`

**Interfaces:**
- **Consumes:** `generateGrounded` and `generateStructured` (provider); `serperKey()` from `lib/inside-track/find.ts`; `httpFetch` from `lib/ai/http-fetch.ts`; `getResearch`/`putResearch` (Task 3); `escapeUntrusted` from `lib/ai/prompts.ts`.
- **Produces:**
  - `type ResearchDeps = { grounded: typeof generateGrounded; structured: typeof generateStructured; search: SearchFn | null; fetchPage: (url: string) => Promise<string>; now: () => number }`
  - `researchCompany(input: { company: string; division: string | null; jdText: string }, deps: ResearchDeps): Promise<{ facts: Fact[]; rivals: string[]; provider: "gemini" | "serper" | "none" }>`
- **Order:**
  1. The cache, if fresh.
  2. Otherwise `grounded`, if it returns non-null.
  3. Otherwise, when `search` is set: run the query `"{company}" {division} graduate OR internship OR news`, fetch the top 3 pages (strip tags, cap 6,000 chars each), and give them to `structured` wrapped as untrusted data.
  4. Otherwise `{ facts: [], rivals: [], provider: "none" }`.
- **Structured schema:** `{ facts: { claim, url, publisher, date (YYYY-MM or null) }[] (max 5), rivals: string[] (max 3) }`.
- **Post-filter:** drop facts whose date is more than 12 months before `now()`; keep undated facts but label them `date: null`; drop facts whose `url` is not among the grounded chunks or fetched URLs.
- Store the result in the cache.
- Any thrown error → `provider: "none"`, nothing cached, and the error is logged.
- A real `defaultResearchDeps()` wires the actual functions.

- [ ] **Step 1: Failing tests:**
  - cache hit: no calls made;
  - grounded path maps chunks to facts;
  - Serper path fetches 3 pages;
  - a 13-month-old fact is dropped;
  - a fact URL not among the sources is dropped;
  - `research failure returns none` when `grounded` throws (`provider: "none"`, nothing cached).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): firm research with Gemini grounding, Serper fallback and cache`

---

### Task 7: Interview questions and evidence pack

**Files:**
- Create: `lib/cover-letter/questions.ts`, `lib/cover-letter/evidence.ts`
- Test: `tests/cover-letter/questions.test.ts`, `tests/cover-letter/evidence.test.ts`

**Interfaces:**
- **Produces (questions):**
  - `nextQuestion(state: { answers: Answer[]; researchState: LetterRow["research_state"]; facts: Fact[]; storyEntry: { id: string; label: string } | null; archetype: Archetype | null; hasTouchpointAnswer: boolean }): { id: Answer["question"]; text: string; chips: string[] } | { id: "wait_research" } | null`
  - **Order:**
    1. `why_firm`
    2. `facts`: only when research is done with ≥ 1 fact; `wait_research` while it's running; skipped when it's `none` or `failed`.
    3. `story`: when `storyEntry` is set.
    4. `touchpoint`: only when `why_firm` was skipped or doesn't mention a person or event. For a product archetype, ask `product` instead.
  - Cap: 4 questions. `null` means done.
  - **Copy, exact:**
    - `why_firm`: `Why {company}, in one sentence? Something you saw, read, or someone you met.`
    - `facts`: `I found {n} things about {company}. Which ones actually interest you?`
    - `story`: `Your CV mentions {label}. What did you do there, and what happened?`
    - `touchpoint`: `Have you met anyone from {company} or been to one of their events?`
    - `product`: `Have you used {company}'s product? One thing you noticed is enough.`
  - **Chips:** always include `Skip`. `story` adds `Use my saved answer` when a story exists.
- **Produces (evidence):**
  - `type Evidence = { requirements: { text: string; cvRefs: string[] }[]; storyEntry: { id: string; label: string } | null; rivals: string[]; sector: Archetype | null }`
  - `pickStoryEntry(cv: ParsedCV, jdLines: string[]): { id: string; label: string } | null`: deterministic. The entry whose bullets share the most non-stopword tokens with the job description wins; ties go to the most recent. Label = `"{title} at {org}"`.
  - `buildEvidence(i: { cv: ParsedCV; jdLines: string[]; company: string; rivals: string[]; archetype: Archetype | null }): Promise<Evidence>`: `generateStructured`, `tier: "fast"`, 2–3 requirements. Every `cvRefs` id must exist in `cvBulletIndex(cv)` (unknown ids are dropped). Runs through `runAi` with `fn: "coverLetterEvidence"`.

- [ ] **Step 1: Failing tests:**
  - the full question walk: research running → `wait_research`;
  - research `none` → skips `facts`;
  - `why_firm` that mentions "met" → no `touchpoint`;
  - the cap of 4;
  - product archetype → `product`;
  - `pickStoryEntry` chooses the trading fund entry for a markets JD;
  - `buildEvidence` drops unknown refs (fixture).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add the fixture `fixtures/ai/coverLetterEvidence/default.json`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): interview state machine and evidence pack`

---

### Task 8: Draft, verify, repair and the Ready gate

**Files:**
- Create: `lib/cover-letter/draft.ts`, `lib/cover-letter/verify.ts`, `lib/cover-letter/gate.ts`
- Modify: `lib/autopilot/drafts.ts` (export `themSupported` and `meBlock`, unchanged)
- Test: `tests/cover-letter/draft.test.ts`, `tests/cover-letter/verify.test.ts`, `tests/cover-letter/gate.test.ts`

**Interfaces:**
- **Consumes:** `streamText` (Task 4), `MarkerParser` (Task 5), `lintLetter` (Task 1), `Evidence` (Task 7), `themSupported`/`meBlock`/`cvBulletIndex` from `drafts.ts`, `playbookPrompt(archetype)` from `lib/tailor/playbooks.ts`, `styleAnchors(cv)` from `lib/ai/tailorCV.ts`, `wrapJob` from `lib/ai/prompts.ts`.
- **Produces (draft):**
  - `buildDraftPrompt(i: DraftInput): { system: string; prompt: string }`
  - `DraftInput = { mode: Mode; limit: Limit; company: string; role: string; ref: string | null; cv: ParsedCV; jdLines: string[]; evidence: Evidence; answers: Answer[]; facts: Fact[]; pickedFacts: Fact[]; confirmedFacts: { id: string; claim: string }[] }`
  - **The system prompt must contain:**
    - the marker instruction (`end every sentence with ⟦me:<cv ids>⟧, ⟦them:<fact ids or jd>⟧ or ⟦you:<answer id>⟧`);
    - "copy answer text verbatim inside ⟦you⟧ sentences";
    - the length band for the mode;
    - the UK salutation/sign-off rules (playbook §3);
    - a ban on the 4 opening clichés only: "I am writing to", "I am thrilled/excited to apply", "My name is", "I hope this finds you well";
    - "no exclamation marks, no bullets".
  - The prompt includes `wrapJob(jd)`, the evidence pack, answers as `<answer id=…>` blocks, picked facts with ids, and style anchors. For a `null` `why_firm` answer it adds: "write the why-them part only from job-description anchors and end that sentence with ⟦them:jd⟧".
  - `streamDraft(i: DraftInput, o: { signal?: AbortSignal; fixtureKey?: string }): AsyncIterable<{ visible: string; closed: Marked[] }>`. Built on `streamText` with `fn: "coverLetterDraft"` and `MarkerParser`.
- **Produces (verify):**
  - `verifyOutput(i: { text: string; sentences: Marked[]; input: DraftInput; ownSpans: Span[] }): { spans: Span[]; lint: LintHit[] }`
    - `you` sentences become `theirs` spans, and must contain their answer text verbatim modulo whitespace and case (else the span is flagged `"changed your words"`).
    - `me` sentences are checked with `meBlock`; `them` with `themSupported` against picked facts plus the job description.
    - Numbers must appear in the sources (CL-11).
    - Unsupported sentences get an `ai` span with `flag` set to the reason (`"not on your CV"`, `"would work for any firm"`, …).
    - The result also includes `lintLetter`.
  - `repair(i, verified, rewrite: (sentence: string, reason: string) => Promise<string>, rounds = 2): Promise<{ text; spans; lint }>`. Rewrites only flagged `ai` sentences, re-verifies, and stops after `rounds`.
- **Produces (gate):**
  - `canMarkReady(o: { text: string; spans: Span[]; lint: LintHit[]; limit: Limit }): { ok: true } | { ok: false; reasons: string[] }`. Blocked by:
    - any `block` hit whose scope is `ai` or `letter`;
    - any `ai` span with a `flag`;
    - over the limit.
  - Hits with scope `theirs` never block.

- [ ] **Step 1: Failing tests:**
  - `verify`: an injected number not in the sources → flagged span;
  - `verify`: a wrong company name → CL-21 block;
  - `verify`: a `⟦you:a1⟧` sentence that paraphrases the answer → flagged `"changed your words"`;
  - `gate`: an invented number cannot be marked Ready;
  - `gate`: a placeholder `[Company]` cannot be marked Ready;
  - `gate`: `own text is exempt from block` (a student span containing "team player!" → ok);
  - `gate`: `ready blocked over char limit`;
  - `draft`: the prompt contains the marker instruction and the verbatim answer text;
  - `draft`: `all-skipped draft has no unsupported them-sentence` (fixture stream → `verifyOutput` → no `them` sentence without a `jd`/fact ref);
  - `repair`: stops after 2 rounds.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add fixtures `fixtures/ai/coverLetterDraft/default.txt` (a marked full letter for the e2e job, using the Northbridge-style text from the prototype adapted to the e2e fixture job) and `fixtures/ai/coverLetterDraft/skipped.txt`.
- [ ] **Step 4: Run it plus `tests/autopilot/drafts.test.ts`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): streamed draft, grounding, repair and Ready gate`

---

### Task 9: Targeted AI edits and undo

**Files:**
- Create: `lib/cover-letter/edit.ts`
- Test: `tests/cover-letter/edit.test.ts`

**Interfaces:**
- **Produces:**
  - `type EditKind = "shorter" | "remove_flag" | "add_close" | "more_formal" | "free"`
  - `planEdit(text: string, spans: Span[], kind: EditKind, instruction?: string): { paragraph: number } | { span: Span }`: deterministic target choice.
    - `remove_flag` → the first flagged span;
    - `add_close` → append a new paragraph (index = paragraph count);
    - `shorter` / `more_formal` / `free` → the paragraph named in the instruction ("opening" = 1, "close"/"ending" = last), else the longest `ai` paragraph.
  - `applyEdit(i: { text; spans; kind: EditKind; instruction?: string; input: DraftInput }): AsyncIterable<{ phase: "target"; paragraph: number } | { phase: "delta"; visible: string } | { phase: "done"; text: string; spans: Span[]; lint: LintHit[] }>`
    - `remove_flag` deletes the span and tidies the punctuation (`"size; ."` → `"size."`) without an LLM.
    - Others stream a rewrite of that paragraph only via `streamText` (`fn: "coverLetterEdit"`). `theirs` spans inside the paragraph are passed as locked text and must survive verbatim.
    - The result is re-verified (Task 8 `verifyOutput`) and re-linted.
  - The caller pushes the previous `{ text, spans }` with `pushUndo` before applying.

- [ ] **Step 1: Failing tests:**
  - `remove_flag` removes "we placed 3rd of 62 teams" and leaves "position size." (no LLM call);
  - `shorter` with "opening" targets paragraph 1;
  - a locked span survives a fixture rewrite verbatim;
  - `add_close` appends a paragraph;
  - the word count drops after `shorter` (fixture).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add fixtures `fixtures/ai/coverLetterEdit/{shorter,add_close}.txt`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): targeted AI edits with locked spans`

---

### Task 10: PDF and Ready

**Files:**
- Create: `lib/cover-letter/pdf.tsx`
- Test: `tests/cover-letter/pdf.test.ts`

**Interfaces:**
- **Consumes:** `CV_FONT_FILES` and the font registration pattern from `lib/pdf/cv-document.tsx`; `putFile("letters", …)`.
- **Produces:**
  - `renderLetterPdf(i: { name: string; email: string; phone: string | null; linkedin: string | null; date: Date; company: string; ref: string | null; role: string; body: string }): Promise<Buffer>`
    - A4, one page, Noto Sans 11pt.
    - Header: name, then contact details on one line.
    - Date formatted `d MMMM yyyy` (en-GB).
    - A `Ref:` line with the role (and ref).
    - Body paragraphs split on blank lines.
  - `letterFilename(first: string, last: string, company: string, date: Date): string` → `First-Last_Cover-Letter_Company_YYYY-MM.pdf` (non-alphanumerics → `-`).

- [ ] **Step 1: Failing tests:**
  - the PDF parses with `unpdf` and has 1 page;
  - the extracted text contains the date "17 October 2026" and the body's first sentence;
  - `letterFilename("Berke", "Askım", "Goldman Sachs", new Date("2026-10-17"))` → `"Berke-Ask-m_Cover-Letter_Goldman-Sachs_2026-10.pdf"`, or a transliterated form if `safeNamePart` from `lib/autopilot/handoff.ts` does that already. Reuse `safeNamePart`; the test asserts its output.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): A4 letter PDF`

---

### Task 11: Service, server actions and the streaming route

**Files:**
- Create: `lib/cover-letter/service.ts`, `app/(app)/jobs/[id]/cover-letter-actions.ts`, `app/api/cover-letter/[jobId]/draft/route.ts`
- Test: `tests/cover-letter/service.test.ts`, `tests/cover-letter/route.test.ts`

**Interfaces:**
- **Produces:**
  - `type CardView = { letterId: string; company: string; role: string; chat: ChatMsg[]; next: ReturnType<typeof nextQuestion>; researchState; draftState; facts: Fact[]; outputs: { id: string; target: OutputTarget; mode: Mode; limit: Limit; status: OutputStatus; text: string; spans: Span[]; lint: LintHit[]; words: number; canReady: ReturnType<typeof canMarkReady> }[]; feedbackOnly: boolean; noLetter: boolean }`
  - `openCard(userId, jobId, target?: OutputTarget): Promise<CardView>`:
    - creates the letter and output (from `chooseMode`);
    - kicks off research in the background when `research_state === "idle"`, setting it to `running` and saving `done/none/failed` when finished;
    - turns `draft_state === "streaming"` older than 2 minutes into `interrupted`;
    - sets `feedbackOnly = aiPolicyBlocks(jd)` and `noLetter = mode === "skip"`.
  - **Server actions** (all `"use server"`, all `requireUser()`, all returning `CardView`):
    - `answerQuestion(jobId, questionId, text | null)`: saves the answer; `why_firm` and `story` are also saved with `rememberStory`.
      - Named people: if a `why_firm` or `touchpoint` answer contains a capitalised two-word name that is not the company, `CardView` gets `confirmPerson: { name: string } | null`.
      - Until `confirmPersonAction(jobId, name, ok)` is called, the draft prompt replaces that name with "a {company} associate".
    - `pickFacts(jobId, factIds)`
    - `useSavedStory(jobId, storyId)`
    - `confirmTrue(jobId, outputId, spanStart)`: inserts a `confirmed_facts` row with the span text, sets the span to `theirs`, re-lints.
    - `saveText(jobId, outputId, text)`: diffs the change into `theirs` spans (the student's edits are theirs) and re-lints.
    - `undoEdit(jobId, outputId)`
    - `markReady(jobId, outputId)`: runs `canMarkReady`. For an upload target it renders the PDF to `letters/{userId}/{letterId}.pdf`. It awards XP with `awardXP(userId, { type: "cover_letter_ready" }, jobId)`, after adding `"cover_letter_ready"` to `XpEventType` in `lib/gamify/core.ts` with 20 XP in its XP table. The `xp_events_once_per_job` index makes this once per job.
    - `addFieldOutput(jobId, label, limit)`
  - **Route `POST /api/cover-letter/[jobId]/draft`**:
    - Body: `{ outputId, kind: "draft" } | { outputId, kind: "edit"; edit: EditKind; instruction?: string }`.
    - Responds with `text/event-stream` events: `phase` (`thinking` | `target` | `checking`), `delta` (`{ visible }`), `done` (`CardView`), `error` (`{ message }`).
    - Draft: `buildEvidence` (if missing) → `streamDraft` → `verifyOutput` → `repair` → save.
    - Edit: `pushUndo` → `applyEdit` → save.
    - Sets `draft_state` to `streaming` at the start and `done` at the end; it becomes `interrupted` on abort.
    - Feedback-only letters get 409 for `kind: "draft"`.

- [ ] **Step 1: Failing tests** (fixture mode):
  - `openCard` twice returns the same letter;
  - an answer naming "Sarah Khan" sets `confirmPerson`, and the draft prompt has no "Sarah Khan" until it is confirmed;
  - the question flow through actions reaches `next === null`;
  - the route draft emits `phase:thinking`, then ≥ 5 `delta`, then `done` with a non-empty output;
  - `resumes interrupted draft as idle`: a stale `streaming` letter opens as `interrupted`;
  - `markReady` fails when the gate fails and succeeds after `confirmTrue`;
  - feedback-only → 409.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow the style of `app/api/interview-prep` for the route and of `autopilot-actions.ts` for the actions.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cover-letter): service, actions and streaming route`

---

### Task 12: The card UI and motion (apple-design)

**Files:**
- Create:
  - `components/cover-letter/cover-letter-card.tsx`: client; owns state and the SSE reader;
  - `chat-pane.tsx`, `letter-pane.tsx`, `research-card.tsx`, `fact-chips.tsx`, `lint-chips.tsx`, `edit-chips.tsx`;
  - `motion.css`: tokens and keyframes ported from the prototype;
  - `use-word-stream.ts`.
- Modify: `app/(app)/jobs/[id]/page.tsx` (a "Write cover letter" button that opens the card in the main column), `app/(app)/jobs/[id]/autopilot-panel.tsx` (a "Cover letter" group listing `cover` items, each opening the card targeted at that field), `app/(app)/autopilot/setup/page.tsx` (a "Saved stories" list with Forget, next to Remembered answers).
- Test: `tests/cover-letter/ui-state.test.ts` (pure reducer)

**Interfaces:**
- **Consumes:** `CardView` and the actions (Task 11), the SSE events (Task 11).
- **Produces:** `cardReducer(state, event)`: pure, exported from `cover-letter-card.tsx`'s sibling `card-state.ts`. States: `idle | thinking | researching | asking | picking | drafting | checking | editing | done | error`. Each DOM state is marked with `data-cl-state` on the card root, which Task 14 asserts.
- **Layout:**
  - side by side at ≥ 900px (chat 0.92fr / letter 1.08fr), stacked below that;
  - output tabs over the letter pane when there is more than one output;
  - a mode segmented control (full / short / field answer / startup note) in the header, for the manual entry point only.
- **Motion:** every state in spec §7 table, ported from `ai-motion-prototype.html`:
  - classes `.msg.bot/.me` (`pop` keyframes, `--spring` `linear()` token);
  - `.typing`, `.research`/`.orb`/`.shimmer`, `.fact` with `.box svg` stroke draw;
  - `.skel`, `.w` word fade from `blur(4px)`, `.caret`, `.yours.lit` sweep, `.scan`, `.chip`;
  - `.paper p.editing` (breathing + `::before` "✦ rewriting"), `.out` dissolve, `.gone` collapse;
  - the `tick()` word counter (600ms ease-out cubic).
- **Interruptibility:**
  - a new action aborts the in-flight `fetch` through `AbortController`;
  - the reducer moves to the new state immediately;
  - the in-flight `.w` spans finish their CSS fade, and no queue waits on them;
  - on reopen, saved text renders with no word animation.
- **Reduced motion:** the `@media (prefers-reduced-motion: reduce)` block from the prototype, plus `use-word-stream` reveals by sentence when `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- **Spans:** `theirs` → green (`.yours`); flagged `ai` → amber with a tooltip giving the reason and two buttons, "Edit" and "This is true" (`confirmTrue`).
- **Contenteditable editing:** on blur, call `saveText`.
- **Buttons:** Download PDF (when ready, `/api/files/letters/...`), Copy (plain text), and "Mark ready" (disabled with `canReady.reasons` as helper text). In the Autopilot context, "Mark ready" is labelled "Use in Autopilot".

- [ ] **Step 1: Failing reducer tests:**
  - `delta` events append to `visible` only in `drafting`/`editing`;
  - `error` from any state → `error`, with `retry` set to the last action;
  - `done` → `done` and clears `editing`;
  - a new user action during `drafting` → `asking`/`editing` (interrupt) and sets `abort: true`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the reducer, then the components.** Load the `apple-design` skill before writing the components.
- [ ] **Step 4: Run the reducer tests, `npm run typecheck` and `npm run lint`.** Expected: PASS.
- [ ] **Step 5: Manual check in the browser** (`preview_start` dev server, a job with `AI_MODE=fixture`). Run through the flow and take a screenshot of each `data-cl-state`.
- [ ] **Step 6: Commit** `feat(cover-letter): side-by-side card with approved AI motion`

---

### Task 13: Autopilot fill

**Files:**
- Modify: `lib/autopilot/pack.ts` (`toFillPlan`), `lib/autopilot/server.ts` (`ClaimBody`, `claimPack`, `buildPack`), `extension/background.js`, `extension/content.js`, `extension/fillers/{greenhouse,lever,ashby}.js`
- Test: extend `tests/autopilot/claim-pack.test.ts`, `tests/autopilot/extension-fill-plan.test.ts`

**Interfaces:**
- **`FillInstruction` gains `asset?: "cv" | "cover"`.**
  - In `toFillPlan(items, answers, covers)`, `covers: Record<string, { text: string } | { file: true }>` holds Ready outputs keyed by field key (`"upload"` for the file).
  - A `cover` item with a Ready output → mode `"fill"`, `sourceLabel: "your cover letter"`, with `value` = the text (textarea) or `asset: "cover"` (file).
  - Without a Ready output it stays `"yours"`.
  - CV file fields get `asset: "cv"`.
- **`ClaimBody` gains `cover: { url: string; filename: string } | null`.** The URL comes from `fileUrl("letters", pdf_path)`, validated with the same `own()` path check as the CV.
- **`background.js`** fetches `cover` exactly like `cv` (same byte cap) → `res.cover`.
- **`content.js`** builds `coverFile` and passes `ctx = { cvFile, coverFile, … }`.
- **Fillers:** for `file`, use `field.asset === "cover" ? ctx.coverFile : ctx.cvFile`. Textareas are already filled from `value`.
- **The "Open & fill" gate (`canOpen`)** does not require cover items: they are optional and never block.

- [ ] **Step 1: Failing tests:**
  - `toFillPlan` with a Ready upload output → a file instruction with `asset: "cover"`;
  - with a draft output → mode `yours`;
  - a Ready field output → mode `fill` with the text value;
  - `claimPack` returns `cover` only for a path under the user's prefix;
  - extension fill-plan: a cover file field picks `coverFile`.
- [ ] **Step 2: Run** `npx vitest run tests/autopilot`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Manual check:** load the unpacked extension and open a Greenhouse fixture form from `e2e/fixtures`. The cover file field and the "why us" textarea are filled, and nothing is submitted.
- [ ] **Step 6: Commit** `feat(autopilot): fill Ready cover letters and why-us answers`

---

### Task 14: Hard-lexicon lint on Autopilot drafts, plus the e2e motion test

**Files:**
- Modify: `lib/autopilot/drafts.ts`: run `lintParagraph` on each sentence in `gateDraft`; any `CL-50` or `CL-21` hit moves the sentence to `caught` with reason `"sounds like AI"` or `"placeholder"`.
- Create: `e2e/cover-letter.spec.ts`; fixtures under `e2e/fixtures` for one job with a Greenhouse form (cover file + "Why us?" textarea), reusing `e2e/autopilot.spec.ts` setup helpers.
- Test: extend `tests/autopilot/drafts.test.ts`.

**Interfaces:** consumes everything above.

- [ ] **Step 1: Failing unit test:** a draft sentence "I am thrilled to apply to this dynamic team." is caught as "sounds like AI".
- [ ] **Step 2: Write the e2e spec** (`AI_MODE=fixture`). For each step it waits for `[data-cl-state=<state>]` to appear.
  1. Open the job, then click "Write cover letter".
  2. `thinking` → `asking`: answer `why_firm`.
  3. `researching` (`.research .orb` visible) → `picking`: tick 2 facts (`.fact.on` count 2).
  4. `asking`: answer `story`.
  5. `drafting`: `.w` count grows across 3 samples 200ms apart; `.caret` visible.
  6. `checking` (`.scan.go`) → `done`: chips visible.
  7. Every `[data-span=theirs]` text equals the typed answers.
  8. Edit chip "Make the opening shorter" → `editing` (`p.editing` visible) → `done`; the word count changes; no `.editing` left.
  9. Undo → the text equals the pre-edit text.
  10. Flagged span → "This is true" → "Mark ready" enabled → click → the Download PDF link responds 200.
  11. **Research failure:** set the env fixture `coverLetterResearch` to `fail`, reopen a second job, and assert that the chat shows Retry, no `.orb` spins after 3s, and the draft still completes.
  12. **Reduced motion:** `page.emulateMedia({ reducedMotion: "reduce" })`, repeat steps 1–6 on a third job, and assert `getComputedStyle(.w).filter === "none"` and no element with a running `animation-name` of `breathe|spin|sh`.
  13. **At the end of every test:** `document.querySelectorAll(".editing, .typing, .research:not(.done) .orb").length === 0`.
- [ ] **Step 3: Run** `npx vitest run tests/autopilot/drafts.test.ts && npm run e2e -- e2e/cover-letter.spec.ts`. Expected: PASS.
- [ ] **Step 4: Run the whole suite:** `npm test && npm run typecheck && npm run lint && npm run e2e`. Expected: everything PASS.
- [ ] **Step 5: Commit** `test(cover-letter): e2e flow and motion, lint Autopilot drafts`

---

### Task 15: Live-provider check

**Files:** none (verification only). Record the results in the PR description.

- [ ] **Step 1:** With a Gemini key, run the manual flow on a real job. Record the time to first word, total time, and a screenshot of each state.
- [ ] **Step 2:** Repeat with Claude, which has no research: confirm the "no research" line appears and the `facts` question is skipped.
- [ ] **Step 3:** Repeat with Ollama `qwen3:8b`. Confirm words stream throughout (no gap over 10s without a visible change; dots or shimmer count) and that the letter passes the gate or shows actionable flags.
- [ ] **Step 4:** Fix any bug found with a test first, then commit `fix(cover-letter): …`.
