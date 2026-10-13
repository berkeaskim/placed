# Plan amendments: CV Score and tailoring (from the market-2026 research)

Date: 2026-10-13 · Status: **approved by Berke** · Applies to: Tasks 15–23 and 25 of `2026-10-13-placed.md`
Evidence: `docs/research/market-2026/00-synthesis.md` and reports 02, 03, 05 and 06 (section numbers are cited inline).

**How to use this file:** when you reach a task listed here, apply its amendments on top of the original task text. Where they conflict, this file wins. Every amendment is TDD: write the test first.

## Decisions (Berke, 2026-10-13)

- Scope: all of A (spec fixes), all of B (differentiators), and C12 (AI-cliché detector) and C13 (interview-defence questions).
- **University and school names are NOT redacted.** The CV Score keeps them visible. The prompt guard (R11) still tells the judge not to consider prestige, and fairness test T4 is reported, not gated.
- After tailoring, the score is shown **as rules gained** ("Impact: +2 rules passed"), never as a raw before→after number produced by the same LLM.
- Must-ship core if time runs short: **A1, A3, B6, B7, B8**. The rest is in priority order below.

---

## Task 15 (done): retrofit A4 — the CV is untrusted input

Already in `cf763f4`: the untrusted-CV prompt rule. Add:

1. **`lib/cv/safety.ts` → `scanCvSafety(pdfText, pdfMeta)`**, run **before** `parseCV`. Returns `{hiddenText[], injection[], verdict: 'clean'|'flag'}`.
   - **ATS-HID-01:** zero-width and bidi characters (U+200B–U+200D, U+2060, U+FEFF, U+202A–U+202E), and font size under 4pt or white fill when the extractor exposes them.
   - **ATS-INJ-01:** regex lexicon: `ignore (all )?(previous|prior) instructions`, `rank (this|me) (first|top)`, `you are an? (ai|assistant|recruiter)`, `system prompt`, `mark (this|the) (resume|cv) as qualified`.
   - Report 03 §4.2 has the full table.
2. If the scan returns `flag`, strip the flagged spans before `parseCV`, and show the plain warning copy from 03 §4.2. Hidden text is never carried into tailored output or the PDF.
3. **Tests:** fixtures with white text, zero-width characters and "ignore previous instructions" give `flag`. A normal CV gives `clean`. The score is unchanged by the injection (fairness T19).

## Task 16: rule library changes

1. **Dimension base weights:** Clarity **25** / Impact **25** / Relevance **25** / ATS **15** / UK **10**. Sector profiles still shift these as before (02 §5.1).
2. **Evidence downgrades:**
   - The quantification-share rule (G-22 / GEN-04): A → **C**.
   - SWE-07 (GitHub) and SWE-12 (hackathons): A → **B**.
   - Grade rule: reward only **stating ≥2:1 or predicted 2:1**, never a higher grade.
   - Hobbies: minor, and never reward class-coded hobbies.
   - Never score employer or university brand.
3. **New rules** (02 §5.2 and 03 §4.2):
   - **EV-01:** experience present and salient (part-time work and volunteering count). Code + LLM, major.
   - **EV-02:** a client-facing or teamwork bullet with an outcome. LLM, minor.
   - **EV-03:** skills in the skills list are evidenced in at least one bullet. Code, major for tech/data.
   - **AU-01:** AI-cliché density (C12). Code, minor→major.
   - **AU-02:** specificity. At least 60% of bullets have a concrete anchor (named tool, organisation, number, date or link). LLM, major.
   - **AU-03:** read-time. Name, latest role, dates and education all sit in the top third of page 1. Code, minor.
   - **ATS-HID-01, ATS-INJ-01:** critical; they block export.
4. **Every `check: 'llm'` rule becomes one binary question** with `passExample` and `failExample` fields added to the rule shape. Allowed statuses are `pass | fail | not_applicable`. `partial` is allowed only when the rule defines it numerically (06 R1).
5. **Myths:** add "aim for 75–80% match" (no vendor threshold) and "6 seconds" → about 30 seconds (03 N-myths, 02 §3).

## Task 17: deterministic checkers

- Implement **AU-01** (`lib/cv-rules/cliches.ts`): count the lexicon per 100 words (lexicon in 02 §5.2) and return the offending spans. It is reused by `verifyTailoring` as a warning.
- Implement the code side of **AU-03**, **EV-01** and **EV-03**.
- Spelling: British and American spellings both count as correct (06 R12, test T14).

## Task 18: CV Score (A1, A5, B11)

1. **`evidence_line` must be an exact substring** of the redacted CV, normalising whitespace only. If it isn't, the verdict becomes `could_not_assess`: the rule is dropped from the denominator and shown as "couldn't assess" (06 R1).
2. **Cache key** = `sha256(normalised redacted text) + sector + rules_version + model_id + prompt_version`. Store `model_id` and `prompt_version` in `cv_scores`. On edits, re-judge only the rules whose evidence lines changed (06 R2).
3. **Redaction (A5, without the university):**
   - Redact name, email and phone, plus LinkedIn and GitHub URL slugs (keep "LinkedIn present").
   - Replace nationality, visa and right-to-work lines with `[WORK_AUTHORISATION_STATEMENT]`.
   - Replace special-category society or health terms with `[SOCIETY]` or `[AWARD]`, keeping the verb and number.
   - Strip "native" and "mother tongue" labels from language lines.
   - **Keep university and school names.**
   - Add the R11 prompt guard line.
4. **UI (B11):**
   - **Next best fix card first**, then the ring: the offending line → why, with a source chip → the rephrase → "+X pts".
   - Show a band label (Needs work / Developing / Strong / Polished), a "N couldn't assess" note, and the one-line disclaimer: *"Measures how well your CV follows evidence-based conventions for {sector}. It does not predict whether you'll get an interview."*
   - Add an "I disagree" button per fix that records feedback and changes nothing else.
   - Add a **"What our AI saw"** toggle that shows the redacted text.
   - No leaderboards. Show a personal sparkline plus "rules passed 23/31".
5. **XP:** award XP for completing a fix, never for the score going up on its own. Placeholder numbers score as fail.

## Task 21: requirement table as the headline (B10)

- The job-detail headline becomes **"Must-haves met: 4/5"**, from the critical/high rows.
- Keyword coverage is shown second, labelled **"Findability"** with Strong / Good / Partial / Limited bands. Never show a "pass mark" percentage.
- If coverage is above 85% and AU-01 or the keyword density looks stuffed, show the stuffing warning.

## Task 22: `verifyTailoring`, new checks (A3)

Add these to the §7.3 table. Report 05 §3 has the implementation details.

| # | Check | Result |
|---|---|---|
| 1b | `inventedMetrics`, **scoped**: a number must appear in a *cited* source bullet that shares at least one context word with the new bullet | block |
| 9 | `siblingContamination`: tool families {AWS/GCP/Azure}, {PyTorch/TensorFlow/JAX}, {React/Vue/Angular}, {Tableau/PowerBI/Looker}, {Excel/Sheets}, SQL dialects. A family member in `after` that is absent from the cited sources | block |
| 10 | `qualifierDrop`: "team of N", "as part of", "assisted", "helped", "contributed to", "co-", "~", "approx", "up to", "personal/university project", "shadowed" missing from `after` | block for team/role qualifiers, warn for hedges |
| 11 | `structuralLoss`: per role, bullets kept + explicitly dropped = the original count | warn |
| 12 | `temporal`: a tool released after the role's end date (table of about 40 tools) | block |
| 13 | AU-01 cliché density on the tailored output | warn |

Extend `authorshipEscalation` to the full verb ladder: familiar < used/assisted/helped/contributed < built/developed/implemented < led/owned/managed/founded.

**Required fixtures (05 §3):**
- (a) "Helped organise" → "Led" gives block.
- (b) "Used pandas" → "Built a PyTorch pipeline" gives block.
- (c) AWS Lambda → Azure Functions gives block.
- (d) "team of 4" dropped gives block.
- (e) 20% → 25% gives block.
- (f) a number moved across two refs gives block.
- (g) a pure reorder plus a JD synonym already in the CV gives pass.
- (h) the JD trap "CFA Level I" shows up only in `gapsStillOpen`.

## Task 23: tailoring pipeline and screen (B6, B7, B8, B9, C13)

Pipeline (05 §2):
1. **Deterministic pre-pass:** gap skills are **never** sent to `tailorCV`.
2. `tailorCV` (smart tier, low temperature):
   - Each bullet carries `changeType` (kept / reordered / rephrased / merged / dropped) and `qualifiersKept[]`.
   - The model may output a `NEEDS_NUMBER` placeholder instead of a metric, and may return a bullet unchanged.
   - Feed 2–3 of the student's own bullets as **style anchors**.
3. Run the gate. On block: retry once, then revert those bullets.
4. **Optional:** a fast-tier entailment judge runs per changed bullet. It is advisory only and turns a bullet amber, which then needs an explicit accept.
5. Show the diff UI.
6. **Re-run the gate on the student's final edits** before rendering the PDF.

Screen:
- **B7 source line:** each changed bullet shows, inline or on hover, the original CV line(s) from `sourceRefs`, plus the JD requirement it serves.
- **B8 per-bullet accept / edit / reject**, with live updates to "Must-haves met" and the rules-gained count, and undo. XP comes with a **"Made it yours"** badge when the student edits a suggestion.
- **B9 "Confirm this number":** a `NEEDS_NUMBER` placeholder opens the 4-outcome dialog. A confirmed number is stored in `confirmed_facts` and earns XP.
- **B6 "Caught it" moment:** reverted bullets are listed with a strike-through and the reason ("number not in your CV"). The badge flips to "✅ Every claim traced to your original CV" after the revert.
- **Score after tailoring:** shown as **rules gained per dimension**, labelled *"AI-assisted rewrite"*. There is no single before→after LLM number.
- **C13 "Be ready to defend this":** after acceptance, one fast-tier call generates one likely interview question per changed bullet. This can be lazy and cached.
- Copy never says "beat the ATS" or "% more interviews".

## Task 25: demo and fairness

1. **Demo fixtures:**
   - Record one **blocked** tailoring run (an invented "Reduced regressions by 20%" plus an AWS→Azure swap) and one **passed** run.
   - The demo JD includes a plausible requirement the persona lacks (e.g. "CFA Level I"), which shows up as ❌ "we didn't invent it".
2. **`tests/fairness/` minimum set:**
   - Gated: T1, T2, T8, T9, T13, T17 and T19.
   - T4 (university) runs and is reported only.
   - Write `tests/fairness/REPORT.md` (06 §3).
3. **Reliability:** run `judgeCvRules` 5 times on the persona CV plus 4 others with the cache bypassed. Rewrite any rule that flips more than 10% of the time. Put the total-score SD in the pitch.
4. **Demo order:** sector switch → source chip → tailor → source line → "caught it" → confirm number (XP) → defend-this question.

## Modules built in parallel on branch `feat/cv-modules` (worktree `~/Repository/ucl-hackathon-cv`)

A separate team builds these **pure, tested modules**. The main build session must **not** write these files. It imports them after `feat/cv-modules` is merged and wires them into its tasks.

| Module | Used by | Contents |
|---|---|---|
| `lib/cv/safety.ts` | Task 15 retrofit (before `parseCV`) | `scanCvSafety()` hidden-text and injection scan, plus `stripFlaggedSpans()` |
| `lib/cv/redact.ts` | Task 18 (before `judgeCvRules`) | `redactCv()`: the A5 redaction, keeping university names; returns redacted text and a placeholder map |
| `lib/cv/cliches.ts` | Task 17 (AU-01) and Task 22 (#13) | AI-cliché lexicon and `clicheDensity()` |
| `lib/verify/checks-extra.ts` | Task 22 | `siblingContamination`, `qualifierDrop`, `structuralLoss`, `temporal`, `authorshipLevel` (verb ladder), `scopedMetrics`, each returning `Issue[]` |
| `lib/ai/defendQuestions.ts` | Task 23 (C13) | `defendQuestions()` via the provider interface, with a Zod schema and fixture |
| `tests/fairness/**` | Task 25 | redaction fairness tests T1, T2, T6, T8, T9, T12 and T19, plus fixtures; LLM-dependent tests are scaffolded as `todo` |

## Team split (if run with parallel implementers)

| Implementer | Owns | Files |
|---|---|---|
| **Rules & score** | Tasks 16, 17, 18 amendments, AU-01 lexicon | `lib/cv-rules/**`, `lib/cv-score/**`, `tests/cv-rules/**`, `tests/cv-score/**` |
| **Tailoring & verify** | Tasks 22 and 23 (backend), C13 | `lib/verify/**`, `lib/ai/tailorCV*`, `lib/ai/prompts.ts` (tailor section), `tests/verify/**` |
| **Safety & fairness** | Task 15 retrofit, `tests/fairness/**`, reliability script | `lib/cv/safety.ts`, `tests/fairness/**`, `scripts/reliability.ts` |
| **UI** | Score panel (Task 18 UI), Task 21 headline, Task 23 screen | `app/(app)/**`, `components/cv/**`, `components/tailor/**` |

Integration order: Safety → Rules & score → Verify → Tailor → UI. Each implementer commits only its own files and reviews against this file.
