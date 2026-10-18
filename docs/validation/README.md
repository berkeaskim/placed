# Validating the CV Score

This folder holds the tools and documents for checking that the CV Score measures what it claims to, consistently. They follow the validation plan in `docs/research/audit-2026-10-18/04-cv-score-engine.md`.

| File | What it is |
|---|---|
| `MODEL_CARD.md` | What the score measures and doesn't, the models it uses, known biases, and how to read the panel. Linked from the panel's "How this score works". |
| `GOLD_FORMAT.md` | The `placed-gold/1` format for human-labelled CVs, the redaction protocol, and the privacy rules. |
| `gold/synthetic-example.json` | **Synthetic.** Ten made-up CVs, each labelled by three made-up raters. It lets the harness and its tests run in CI without AI. It says nothing about validity. |
| `reports/` | Reports from `--live` runs (created on first use). |

## Commands

| Command | AI calls? | What it does |
|---|---|---|
| `npm run validate:cv` | No | Runs on the synthetic gold file (or `--gold <file>`). Reports (a) inter-rater agreement per rule: Cohen's κ for 2 raters, Fleiss' κ for 3 or more, with Gwet's AC1 for 2; and (b) each code checker against the human majority: κ, AC1, precision, recall and specificity of "fail", and N/A mismatches. |
| `npm run validate:cv -- --live` | Yes | Also runs the production AI judge on every gold CV (same redaction, rules and target context as the app, no cache). Reports per-rule κ against the human majority and flags rules below **0.6** for rewriting, moving to code, or demoting. Writes `reports/<date>-<model>.md`. |
| `npm run reliability` | No (dry run) | Prints the test–retest plan. |
| `npm run reliability -- --live [--runs N] [--gold <file>]` | Yes | Scores each CV N times (default 10) with no cache. Reports per-CV totals, SD and SEM; per-rule flip rate with a 95% Wilson interval; Fleiss' κ across runs; and ICC(1,1) and SEM for totals. Writes `tests/fairness/RELIABILITY-<model>-<date>.md`. |
| `npm run validate:feedback` | No | Reads your local database and ranks rules by how often you pressed "I disagree" when they were shown. Rules over 15% on at least 20 showings are flagged for review. |

`npm test` covers the statistics, gold-file validation, the offline harness on the synthetic set, and the `--live` wiring with the judge mocked. Tests never call a live AI.

## Gates (from the audit's validation plan)

- **Per rule, AI judge vs human consensus:** κ ≥ 0.6. Read AC1 next to κ for rules where nearly every CV passes, because κ collapses when prevalence is skewed. Human–human κ is the ceiling: a rule the raters can't agree on needs rewording before the AI is blamed.
- **Test–retest, per model:** SD of the total ≤ 2 points, and no rule whose flip-rate interval lies wholly above 10%.
- **Rule disputes:** > 15% over ≥ 20 showings sends the rule to review.

## What's still needed (needs people, not code)

1. **A real gold set.** The plan: about 120 consented, redacted student CVs, stratified by sector, year and home/international students; three raters (two careers advisers and one recruiter); labels from the same rule wording the AI sees.
2. **Live runs** of `validate:cv --live` and `reliability --live` for each provider (Claude, Gemini, one recommended local model).
3. **Results into the model card:** per-rule κ, the SD for each model, cross-model differences, and band cut-offs set from the gold-set distribution.
