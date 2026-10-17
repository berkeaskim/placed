# Cover Letter Writer: design

Date: 2026-10-17 · Branch: `docs/cover-letter-playbook` (worktree `worktrees/coverletter`)
Research base: `docs/research/cover-letter/00-playbook.md` (master playbook) and `cover-letter-rules.json` (63 rules + lint lexicon). Read the playbook first; this document only says how the feature uses it.

## 1. Why

Some applications ask for a cover letter or a "Why this firm?" answer. Students either skip them or paste a generic AI letter. The research is blunt about both:

- a generic letter is worth almost nothing (about +17% callbacks vs none, against about +53% for a tailored letter);
- AI-generated tailoring has lost about half its signal value;
- recruiters penalise letters they suspect were written by AI.

What still works is specific, verifiable content from the student's own life: a real reason for wanting this firm, a real experience in their own words, and the student editing the result.

So this feature is a **writer that interviews the student briefly and builds the letter around their own words**, not a one-click letter generator.

## 2. Goals, non-goals, anti-goals

**Goals**
- Write tailored cover letters and "why us" answers from the student's CV, a 3–4 question chat, and optional web research on the firm.
- Two entry points with one shared component:
  - **Autopilot:** when the form has a cover letter or motivation field.
  - **Manual:** a "Write cover letter" button on any job page.
- Every claim is grounded, the playbook lint passes, and the student sees exactly which words are theirs.
- AI thinking, research, writing and editing states are animated and feel alive (Berke called this "very important"). Every animation is verified to actually run.

**Non-goals (v1)**
- Networking notes and LinkedIn messages (Inside Track already covers outreach).
- Civil Service Success Profiles statements and law training-contract forms.
- Calibrating the lint thresholds against a corpus of real letters (it is a follow-up; ship with the research defaults).
- A Chrome Web Store release.

**Anti-goals (failure even if it "works")**
- Any invented fact: experience, number, motivation, contact, event, product usage or company fact.
- A letter that passes the swap test, i.e. would still work with a rival firm's name in it.
- A letter that reads as AI: clichés, em-dash runs, symmetric paragraphs.
- Ever auto-submitting an application.
- Dead or janky AI states: frozen spinners, text appearing all at once with no feedback, animations that run only in the happy path.
- An AI-detector score, anywhere.

## 3. Constraints

- **Local-first.** SQLite through Drizzle, a single user, and AI through `lib/ai/provider.ts` (Gemini / Claude / Ollama). Ollama can take minutes per call, so every long step must show progress and be resumable after a page reload.
- **Ollama queue (`lib/ai/ollama.ts`).** Interactive calls go ahead of background work. The writer's calls are interactive.
- **The UK student context throughout:** en-GB spelling, UK salutation and sign-off conventions, A4.
- **Autopilot's red lines stay:**
  - no submit;
  - no EEO answers;
  - right to work comes only from the student's own vault answer;
  - free text is never stored in the vault.
- **Schema changes** go through `lib/db/schema.ts` → `npm run db:generate`. Tests never touch `./data`.

## 4. What was decided (with Berke)

1. **Both entry points.** An Autopilot card when the form has a cover letter or "why us" field, and a manual "Write cover letter" button on every job page.
2. **A chat interview of 3–4 short, skippable questions** before writing. The letter is written from the answers.
3. **Layout: side by side.** Chat on the left; the letter fills in live on the right. It stacks (chat on top) below about 900px wide. The visual reference is the prototype at `.superpowers/brainstorm/*/content/ai-motion-prototype.html`.
4. **Web research on the firm is allowed.**
5. **UI built with the apple-design skill.** Critically damped springs, motion that starts from where things already are, reduced-motion fallbacks.
6. **The AI motion set from the prototype is approved as is (no slow-motion control):**
   - thinking dots;
   - research card with shimmering source rows;
   - fact chips with a drawn checkmark;
   - skeleton, then words streaming in from a blur behind a caret;
   - green "your words" highlight sweep;
   - lint scan line and chips popping in;
   - AI edit: the paragraph breathes with a "✦ rewriting" tag, old words dissolve and new ones stream in, a removed claim collapses, the word count ticks, and Undo replays the animation in reverse.

## 5. My calls (Berke can override)

- **Facts the student picks.** Research facts never go into the letter automatically. The bot lists what it found (with source and date) and asks which ones actually interest the student. This counts as one of the 3–4 questions.
- **Research sources:**
  - Gemini key → `generateGrounded` (Google Search grounding, same as Interview Prep).
  - Otherwise, with a Serper key (Settings → People search, same as Inside Track) → Serper search, then fetch 2–3 result pages with `lib/ai/http-fetch.ts`, then summarise into facts with the active provider.
  - Otherwise → no research, and one line in the chat saying so.
  - Research results are cached per company for 7 days. Anything older than 12 months is dropped or labelled.
- **Memory:**
  - Personal stories (the answer to "what did you do there?", keyed to a CV entry) are remembered and offered again as a "Use my saved answer" chip.
  - "Why this firm" is asked fresh every time (a reused one is exactly the generic letter we're avoiding). It is remembered per company only, for a second role at the same firm.
  - Stories live in a new table, not the Autopilot vault, because the vault rule says no free text.
- **Real streaming.** `lib/ai/provider.ts` currently has no streaming call. Add a `streamText` path for the prose draft (Gemini, Anthropic and Ollama all support streaming). The streamed words drive the writing animation, so progress is real, not faked. Lint and ground-check run after the stream ends. Sentences they reject are then removed or flagged with the collapse or amber animations. That keeps the UI honest, and on Ollama the student watches real progress instead of a 4-minute spinner. Fixture mode replays a recorded draft through the same stream interface, so Playwright can test the animation deterministically.
- **The mode is chosen deterministically** (playbook §2), never by the model:
  - From the Autopilot form: a file field marked `which: "cover"` → `full_letter`. A long textarea whose label matches why/motivation/cover/additional → `field_answer`, with its limit.
  - From the job (manual): `full_letter` by default. The student can switch to short letter, field answer (they enter the limit) or startup note from a small segmented control at the top of the card. The chat's first message states the mode and why.
  - When the job description or employer says "no cover letter", the card says so and offers "why us" notes instead.
- **Feedback-only mode:** if the job description matches the AI-policy regex (`cover-letter-rules.json` → `lexicon.counters.aiPolicy`), the card does not generate anything. The student pastes or types their own letter; Placed lints it and comments.
- **Relationship to `lib/autopilot/drafts.ts`:** Autopilot's existing free-text drafts keep working for short competency questions. Fields classified as cover letter or motivation move to the new writer. `drafts.ts` also gains the deterministic lint pass (hard lexicon only), so every Autopilot draft benefits.
- **PDF:** reuse `@react-pdf/renderer` and the vendored Noto Sans from `lib/pdf/cv-document.tsx`. A4, one page, letter layout per playbook §3. Filename `First-Last_Cover-Letter_Company_YYYY-MM.pdf`. The plain-text twin is stored next to it.
- **Autopilot upload:** the extension already uploads the CV as a `File` (`content.js` → `ctx.cvFile`). Add `ctx.coverFile` and `ctx.coverText`:
  - fillers upload the PDF into cover letter file fields;
  - fillers paste the text into cover letter text fields (Greenhouse "Enter manually");
  - `field_answer` text goes into its textarea.

  The extension only takes letters the student has marked **Ready**; drafts are never filled.

### Calls made after the builder check

**Ready gate.** Text is either *AI-written* or *the student's own* (locked answer spans plus anything they typed or edited into the letter).

- **Ready is blocked only by:**
  - (a) a placeholder or chatbot leftover;
  - (b) another employer's name, or the target company or role missing;
  - (c) a hard-lexicon hit **in AI-written text**;
  - (d) an AI-written claim the ground-check couldn't support;
  - (e) going over a stated limit.
- **The student's own text** is linted too, but every hit is a soft amber note, never a block. Their true facts and their voice win.
- **To clear a (d) flag,** the student can:
  - edit the sentence, which makes it theirs; or
  - tap "This is true". That saves the claim to the existing `confirmed_facts` table, so it grounds future letters and tailoring too, and marks the span as theirs.
- **Severities from the rules JSON:**
  - `block`: as above;
  - `high`: auto-repair, then amber;
  - `med`/`low`: amber or nothing.

**One interview per job, one output per field.** `cover_letters` is keyed by job. It holds the interview (chat, answers, picked facts, evidence pack) once, plus an `outputs` list with one entry per target: the full letter for an upload, and each motivation textarea as its own `field_answer` with its own limit, text, lint and Ready state.

- Field answers are drafted from the same evidence pack, not cut down from the letter. Each answers its own question.
- The card shows the outputs as tabs over the letter pane.
- The claim payload is `{ coverFile?, texts: { [fieldKey]: string } }`.
- The manual entry point starts with a single output; "Add a 'why us' answer" adds another.

**The file-02 unit test.** It runs the lexicon and paragraph-scope counters (no letter-level rules) on each paragraph.

- **Weak paragraphs:** each must produce at least one hard or soft hit.
- **Strong paragraphs:** must produce zero hard hits and zero soft-lexicon hits.
- Sentence-rhythm counters are letter-level only and aren't asserted per paragraph. Strong Example A's 47-word sentence is fine there.
- `rules.ts` exposes `lintParagraph` and `lintLetter`.

**Grounding a streamed draft.** The draft prompt asks the model to end each sentence with an inline marker: `⟦me:b12,b14⟧`, `⟦them:fact3,jd⟧` or `⟦you:a1⟧` for a locked answer.

- The stream parser strips the markers before rendering, so the UI never shows them, and attaches the refs to the sentence. Ground-checking a sentence then works like `drafts.ts` and can start as soon as the sentence closes, overlapping the stream.
- If a sentence arrives without a marker (small models), it goes into one batched structured tag call after the stream.
- Fixtures record the raw marked stream.

**"Additional information" stays the student's.** The existing `classify.ts` rule is deliberate and it stands. The writer takes only fields whose label matches cover letter / why / motivation / interest in (role|firm|programme|division). Generic "additional information" and "anything else" stay `yours`.

**Visa, disability, grades and gaps are out of v1.** The writer never mentions them. Right to work and sponsorship stay in the form's own fields, answered from the vault as today. The playbook rules for them are a follow-up with the profile fields and opt-ins they need.

## 6. How it works

### 6.1 Flow

1. **Open the card.** The Autopilot panel shows a "Cover letter" group when the pack has a cover or motivation field; the job page has a "Write cover letter" button. Both open the same `CoverLetterCard`. If a letter for this job already exists, it opens in its saved state.
2. **Mode + policy check** (deterministic, instant). The first bot message names the mode and length.
3. **Questions** (3–4, each skippable, answers saved as they arrive):
   - Q1 "Why {Company}, in one sentence?" (also offer a per-company saved answer, if any).
   - Q2 Research facts: "I found N things… which ones actually interest you?" The research starts in the background as soon as the card opens. While it runs, the chat shows the research card. If it is slower than Q1, Q2 waits with the research animation.
   - Q3 "Your CV mentions {entry}. What did *you* do there, and what happened?" The entry is the CV item that best matches the top job requirement, from an evidence-pack step. Offer a saved story chip if one exists.
   - Q4, optional and only when relevant: a touchpoint ("Have you met anyone from {Company} or been to one of their events?"), or a product-usage question for PM roles.
4. **Evidence pack** (structured, non-streamed, `generateStructured`):
   - 2–3 job-description requirements, each mapped to CV bullet IDs;
   - picked facts with their sources;
   - answers as locked spans;
   - sector (from the job's archetype, reusing `lib/tailor` / playbook data);
   - the firm's top-3 rivals (from research, or the model, for the swap test only).
5. **Draft** (streamed). The prompt carries the evidence pack, locked spans (verbatim), the matching sector section of the playbook, style anchors (the student's own bullets, as in `tailorCV.ts`), mode, length band, and a short opening-cliché ban.
6. **Checks** after the stream:
   - (a) Deterministic lint from `cover-letter-rules.json`: lexicon, counters, length, salutation and sign-off, company/role in the first paragraph, other-employer names, placeholders, en-GB.
   - (b) Ground-check: reuse the `drafts.ts` / `verifyTailoring` machinery so every "me" sentence is supported by the CV or answers, and every "them" sentence by a picked fact or the job description.
   - (c) An LLM judge for the swap test and requirement coverage.
   - Locked spans must appear verbatim. Numbers must appear in the sources.
7. **Repair:** rewrite only the flagged sentences, at most 2 rounds (playbook §6.8). Whatever is still flagged is shown as amber with a reason ("not on your CV", "would work for any bank").
8. **Edit loop:** suggestion chips (shorter, remove a flagged claim, add or strengthen the close, more formal) plus free text in the composer. Each edit targets the smallest unit (one paragraph or sentence), re-lints it, and keeps an undo stack. The student can also type straight into the letter. Typed text counts as theirs (green).
9. **Ready:** the student marks it Ready. This generates the PDF and text, logs `cover_letter_ready` to the tracker/XP, and exposes the letter to Autopilot. Download PDF and Copy are always available.

### 6.2 Data (new tables; exact columns left to the builder)

- `cover_letters`:
  - one row per job: `job_id`;
  - `chat` (JSON transcript);
  - `answers` and `picked_facts` (JSON, with sources);
  - evidence pack;
  - `outputs` (JSON list or child table), where each output has a target (upload, or a field key with its label), mode, limit, status `draft | ready`, text, spans metadata (theirs, AI-written, flagged), lint result, and `pdf_path` under `data/files/` for the letter;
  - timestamps.
- `cover_letter_stories`: the student's reusable stories keyed to a CV entry ID or company. Text, created/updated, last used. Editable and deletable from the Autopilot setup page, next to "Remembered answers".
- `company_research`: a cache keyed by company + division: facts (claim, source URL, publisher, date), rivals, provider, fetched_at. 7-day TTL.

### 6.3 Code layout (suggested)

- `lib/cover-letter/`:
  - `mode.ts`: deterministic mode choice;
  - `rules.ts`: loads `cover-letter-rules.json` and runs the lint as pure functions;
  - `research.ts`: Gemini grounded → Serper+fetch → none;
  - `evidence.ts`, `draft.ts` (streaming), `verify.ts`, `pdf.tsx`, `service.ts`.
- `lib/ai/provider.ts`: add `streamText` per provider, plus a fixture replay.
- `app/(app)/jobs/[id]/cover-letter/`: the card. Server actions for answers and edits; a route handler for the streamed draft (SSE or a ReadableStream).
- `components/cover-letter/`: chat, letter pane, research card, fact chips, lint chips, motion primitives.
- Extension: `ctx.coverFile` / `ctx.coverText` in `content.js` and the three fillers; `/api/autopilot/claim` returns the ready letter.
- Copy the rules JSON into `lib/cover-letter/` (as `lib/tailor/playbook-data.json` was), so docs and runtime don't drift apart silently. A test asserts that the two are identical.

## 7. Motion spec (apple-design)

- **Spring tokens:**
  - default: critically damped (damping 1.0, response ~0.35–0.4s), via CSS `linear()` easing for keyframes or Motion for JS;
  - no bounce anywhere except the fact-chip check.
- **States:**

| State | What runs |
|---|---|
| idle | Static, nothing animating |
| thinking | Three-dot typing bubble |
| researching | Research card: spinning ring, shimmer rows, rows replaced by sources as they resolve, ring turns green when done |
| asking | Message springs in from its own side (transform-origin = its corner) |
| picking | Fact chips stagger in at 70ms; the check stroke draws itself |
| drafting | Skeleton lines → streamed words fade in from `blur(4px)` behind a blinking caret; locked spans get a green background sweep when complete |
| checking | Scan line over the letter (or only over the edited paragraph); chips dim, then pop in staggered |
| editing | Target paragraph gets the breathing outline plus a "✦ rewriting" tag; old words dissolve (staggered blur-out, ≤ 260ms total), then new words stream; removed spans collapse width to 0; word count ticks with ease-out over 600ms; the paragraph glow fades over 1.6s |
| done | Buttons enable; the bot's "Done: a → b words [Undo]" message |
| error | The step that failed shows a red inline status with Retry; nothing keeps spinning |

- **Interruptibility:** the student can type, skip or ask for an edit at any time. A new action cancels the in-flight animation from its current state (no queued animations finishing first). Leaving and reopening the card mid-stream resumes from saved state, without replaying finished animations.
- **Response:** buttons and chips scale to 0.97 on press. No artificial delays except the minimum typing-dots time (≤ 450ms) so bot replies don't flash.
- **Reduced motion:** cross-fades only, no blur, no spinning, no breathing (a static outline instead), and text appears per sentence instead of per word. Reduced transparency/contrast per apple-design §14.
- **Animate `transform`, `opacity` and `filter` only.** Never animate layout properties except the removed-span collapse.
- **Verification (required, not optional):** Playwright with `AI_MODE=fixture` drives a full run: mode, Q1–Q3, research (fixture), picking, streaming, lint, one edit of each type, Undo, Ready. It asserts:
  - each state's DOM marker appears and then clears, with no stuck `.editing` or spinners at the end;
  - the word count updates;
  - locked spans are verbatim;
  - Undo restores the previous text;
  - under `prefers-reduced-motion: reduce`, the same flow completes with no `filter`/`transform` animations running.

  Plus one manual pass in the browser with a real provider, with a screenshot recorded at each state.

## 8. Honesty and safety (must hold; see the playbook §7 for the full list)

- Grounding is enforced by code, not by the prompt alone (§6.1 step 6).
- Visa, right to work, disability, grades and gaps are never mentioned by the writer in v1 (see §5).
- Named people from the student's answers need a one-tap confirmation before they appear in the letter.
- Feedback-only mode when the employer forbids AI.
- No auto-submit. The extension fills only Ready letters, and the student clicks Submit.
- Research text is untrusted input. Wrap it like the job description (`wrapJob`-style), never follow instructions found in it, and keep facts as data with their source.

## 9. Left to the builder

- Exact table columns, indexes and migration naming.
- The SSE vs ReadableStream transport; the Motion vs pure-CSS split per animation.
- How "best matching CV entry" is scored for Q3 (reusing the existing skills/match code is fine).
- Copy for bot messages (keep it short, plain, UK English, no exclamation marks: the lint applies to our own UI copy too).
- The PDF layout details within playbook §3.

## 10. Done when

- Manual and Autopilot entry points both produce a letter end to end on Gemini, Claude and Ollama (qwen3:8b). On Ollama this may be slow, but progress is visible throughout.
- The Playwright motion test above passes in fixture mode, including the reduced-motion run.
- Running the lint on the five weak/strong example paragraphs in research file 02 flags every weak one and passes every strong one (a unit test).
- A letter with an injected invented number, wrong company name or placeholder cannot be marked Ready.
- The extension fills a Greenhouse cover-letter file field and a "why us" textarea from a Ready letter, and stops before Submit.
