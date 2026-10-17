# AI fixtures (fixture mode)

`AI_MODE=fixture` (the default when no AI key is set) makes each AI function return the JSON recorded here
instead of calling a model (spec §7.4). The app then shows the "Demo mode" badge. Each file goes through the
same Zod schema and post-processing as a live answer (C6), so a fixture cannot skip the anti-fabrication gate.

## Demo fixtures: hand-labelled for a FICTIONAL persona

Everything below was **written by hand for the fictional demo student "Ayşe Demir"** (`seed/demo/ayse.json`, a
made-up 2nd-year UCL Economics student; no real person's data). None of it is recorded model output. The job
postings are real and unedited (`seed/jobs.json`). The tests in `tests/demo/demo-fixtures.test.ts` check every
claim below.

| Function | File | Key | What it shows |
|---|---|---|---|
| `parseCV` | `parseCV/<12 hex>.json` | sha1 of the demo PDF's base64 (`profile/build/actions.ts`) | Uploading `seed/demo/ayse-demir-cv.pdf` returns the persona exactly. Regenerated with the PDF by `npm run demo:cv`. |
| `judgeCvRules` | `judgeCvRules/<textHash16>-<sector>.json` for `data_analytics`, `consulting`, `finance_banking` | sha256 of the redacted CV text + sector (`lib/cv-score/run.ts`) | A few verdicts per sector; every other rule is not applicable. Every `evidence_line` is an exact line of the redacted CV (A1). The quick win: **GEN-03 fails on "Organised weekly society events"**, fix "…for [add your real number] members". Labels live in `seed/demo/judge-labels.json`; `npm run demo:cv` copies them here. |
| `tailorCV` | `tailorCV/a2214edc-39e3-4c70-8a09-875bb991062f.json` | job extId: Lendable, Credit Analyst Intern (June 2027) | **The blocked run.** It invents "Reduced regressions by 20%" and swaps AWS for Azure. `verifyTailoring` blocks both, the retry returns the same answer, and both lines are reverted to the originals ("Caught it"). It also adds Stata to Skills (it is in her modules line) and leaves a `NEEDS_NUMBER` blank on the events bullet ("Confirm this number"). |
| `tailorCV` | `tailorCV/e001dc0b-6e0f-46a7-95ba-38a3733db2f4.json` | Lendable, Summer Intern 2027 (same JD text) | **The passed run.** An honest rephrase plus the same blank and Stata, with nothing blocked. |
| `explainMatch` | `explainMatch/<both Lendable extIds>.json` | job extId | Python and SQL are Strong with a verified quote. The case-study requirement ("Case Interviews") is Missing, with a gap and how to close it. |
| `defendQuestions` | `defendQuestions/<both Lendable extIds>.json` | job extId (falls back to `default.json`) | Likely interview questions for the events bullet and the rent-tracker bullet. |
| `autopilotDraft` | `autopilotDraft/8232726-question_69481992.json` | `<jobExtId>-<fieldKey>` | Monzo Data Intern "Why Monzo?" for Ayşe: four sentences, each citing her bullet ids or Monzo `jd:` lines. **Deliberate catch:** one sentence swaps Excel for Google Sheets (bullet `p0-b1`); the gate's `siblingContamination` removes it ("tool not on your CV"), leaving three. |

The demo job was chosen because it is a real London internship for 2nd/penultimate-year students whose tagged
must-haves are Python, SQL and "Case Interviews" (from its interview process: two case studies). The persona has
the first two and **genuinely lacks the third**, so tailoring shows it as "Not in your CV — we didn't invent it".

## Cover letter draft fixtures

`coverLetterDraft/default.txt` and `skipped.txt` are raw marked streams (`⟦me:…⟧`, `⟦them:…⟧`, `⟦you:…⟧`) written by
hand for the fictional student "Alex Morgan" and the fictional Northbridge Capital job defined in
`tests/cover-letter/fixtures.ts` (CV bullet ids, answer ids `a1`–`a4`, and the research fixture's fact ids).
`default.txt` quotes three answers verbatim and has **one deliberate catch**: "We placed 3rd of 62 teams." is not on
the CV, so the ground-check flags it "unsupported number". `skipped.txt` is the letter when every question was skipped:
no `⟦you⟧` sentence and the why-them part cites only `⟦them:jd⟧`.
`spaced.txt` is `default.txt` with a space before every marker, as small models write it (the draft is stored with the
spacing the paper renders). The job post's last line carries the reference `SA-MKT-27` that the opening quotes.
`coverLetterJudge/default.json` (and `e2e-cl.json`, the same verdicts held back 1.5s) is the judge's verdict on
`default.txt`: an explicit "ok" for every sentence but the furniture and the courtesy close (indexes 1–15).
`skipped.json` does the same for `skipped.txt`. The ground-check fails closed: an AI-written sentence with no verdict
is flagged "couldn't check this claim about the firm". An "ok" never clears a deterministic flag, so the one deliberate
catch stays.

## Other fixtures

`defendQuestions/default.json` is a generic fallback from the C13 module (not persona-specific). Without an exact
fixture, `parseCV`, `explainMatch` and `tailorCV` fall back to deterministic heuristics. `judgeCvRules` then scores
code rules only: it has no default file on purpose.
