# Model card: Placed CV Score

Last updated: 18 October 2026 · rules: 142 · prompt version `judge-2026-10-18.1-…` (the exact value is in `lib/ai/judgeCvRules.ts`)

The UK government's *Responsible AI in Recruitment* guide (DSIT, 25 March 2024) says developers should publish model cards for AI tools used in hiring. Placed's CV Score is a self-help tool for students, not a hiring tool. We publish this card anyway, so you can judge how far to trust the number.

**Status: beta, not validated.** No one has yet compared the score with judgements from careers advisers or recruiters. The tools to do that are in place (see "Validation" below), but no human labels exist yet.

## What the score is for

- **Intended use:** a student checks their own CV against widely given, sourced advice for UK graduate and internship applications in one of 8 sectors, and gets a ranked list of fixes.
- **Not for:** screening, ranking or comparing candidates; predicting interviews or offers; any decision about another person. The score is computed on your machine for you alone. There are no leaderboards.

## What it measures, and what it doesn't

**It measures** how closely a CV follows conventions that UK sources recommend for the chosen sector, year of study and track. Examples: a readable text layer, standard headings, education and grades shown in the UK format, action-led and quantified bullets, no photo or date of birth, and sector-specific signals such as projects with a tech stack for software roles.

**It does not measure** how good a candidate you are, whether your experience is impressive, how a particular employer screens, or how likely you are to get an interview. A CV can score 95 and be rejected, or score 60 and succeed. The panel says this under the score: *"It does not predict whether you'll get an interview."*

## How the number is made

1. **Rules.** There are 142 rules in total: 37 are checked by code, and 105 are judged by an AI model. Each sector uses 48–59 of them (52–61 on the spring-week track, 54–65 on the placement-year track). Each rule has a severity: 5 critical, 78 major and 59 minor. Each also has an evidence grade, shown on its fix card:
   - **A** (39 rules): peer-reviewed studies, field experiments, official employer or regulator pages, or large surveys.
   - **B** (63 rules): reputable careers services and recruiter guidance.
   - **C** (14) and **D** (21): common practice or synthesis. These are tagged "Convention" on the card, and a C or D rule can be at most "major".
2. **Code checks** are deterministic, such as the text layer, page count, grades, personal details, skill-rating glyphs and links. The main checkers have fixture tests built from real phrasings.
3. **The AI judge** answers one yes/no question per rule, at temperature 0 where the provider allows it. Before it reads the CV, Placed removes your name, contact details, visa status and sensitive personal terms. University and school names are kept because rules check the education section; the judge is told to ignore prestige. A pass or a fail must quote a line from your CV, or name the sections that are missing something. Any other answer is "couldn't assess".
4. **Aggregation.** A rule's weight is its severity, scaled by the square root of its sector's dimension weight. The dimension weights are graded D (synthesis) in the code, so they are a judgement call, not a measurement. A rule the AI couldn't assess counts at half credit, so a dodged question can't raise the score. Two caps apply: an image-only PDF is capped at 50, and a CV with no phone or email at 40. "Worth ~N pts" on a fix is the real change from re-running the score with that rule passed.
5. **Edits.** When you upload an edited CV, rules whose evidence didn't change keep their earlier verdict. Only rules your edit could affect go back to the AI (`lib/cv-score/delta.ts`), and the panel says how many it re-checked. A change of model, prompt, rules or year of study re-checks everything.

## How to read the panel

- **A range instead of one number** ("Provisional: 62–88") means the AI couldn't assess enough of the rules: less than 80% of the applicable rule weight, or less than half of one dimension. Your score lies somewhere in that range. Score again for a full review. Provisional runs are left out of your trend.
- **"AI review unavailable"** means the AI call failed, so only the automatic checks ran.
- **Bands** (Needs work under 50, Developing 50–69, Strong 70–84, Polished 85 and above) are rough guides. They were not set from data. Once there is a gold set, the plan is to set them from how advisers rate real CVs.
- **"Judged by …"** names the model. Scores from different models are **not** comparable, so your trend line only shows scores from the same model.
- **"Judged by the same AI family that tailored it"** appears when you scored a PDF made by Placed's tailor. AI judges tend to rate their own writing more kindly (Panickssery et al. 2024; Xu et al. 2025). So a higher score than your original isn't proof that the tailored version is better, and your trend never puts the two on the same line. The tailor's own "rules gained" view uses only the deterministic code checks, never an AI before-and-after number.
- **"I disagree"** marks that verdict as **Disputed**. It stays visible and still counts: we never hide or flip a verdict because of a dispute. Disputes feed a rule-review report (`npm run validate:feedback`). A rule disputed on more than 15% of at least 20 showings goes up for review.

## Models

Placed runs whichever AI provider you set up. The defaults are pinned in `lib/ai/models.ts`:

| Provider | Default judge model | Notes |
|---|---|---|
| Anthropic | `claude-sonnet-5-5` | Temperature is not sent (the adapter drops it). |
| Google | `gemini-3.8-flash` | Gemini 3 keeps its default temperature (Google recommends 1.0). |
| Ollama (local) | your chosen model, e.g. `qwen3.5:9b` | Temperature 0. Shown as "experimental": small local models follow the rule format less reliably and are more often provisional. |

**Results differ across models.** The same CV can get a different score from Claude, Gemini and a local model, because the models disagree on borderline rules. We have not yet measured how much they differ, or how much one model varies between runs. When a model or setting changes, the cache treats the score as new.

## Known limits and biases

- **No validity evidence yet.** There is no human-labelled gold set, no agreement statistics, and no check of the score against recruiter judgements (audit 2026-10-18, finding 04 "Validity: F").
- **Run-to-run variation is unmeasured.** The reliability script exists (`npm run reliability -- --live`) but has not been run against a live model. Until it has, we can't show a "±" next to the score.
- **Fairness tests are code-only for phrasing.** Redaction is tested: names, contact details, visa lines, identity societies, disability terms and addresses produce byte-identical judge input. But the AI-side tests for non-native phrasing (T13) and AI-style rewrites (T15) have **not been run** (`tests/fairness/REPORT.md`). Research finds that LLMs can misjudge non-native English writing (Liang et al. 2023).
- **University names reach the judge.** It is told to ignore prestige. Prompt instructions reduce bias but don't remove it (Tamkin et al. 2023).
- **Some proxies for protected characteristics are not redacted yet**, such as some gendered, religious and ethnic-programme terms (audit 04#16).
- **Spelling** comes from the AI's list, filtered against UK/US variants and words that aren't in your text. It is not yet checked against a dictionary.
- **Weights are judgement, not data.** Sector dimension weights are graded D. The plan is to fit them to adviser ratings once a gold set exists.
- **Self-preference** (above): detected only for PDFs that Placed rendered and that weren't re-saved in another app.

## Validation

See `docs/validation/README.md`. In short:

- `npm run validate:cv` compares the code checks with human labels in a gold file (format: `docs/validation/GOLD_FORMAT.md`). It reports agreement between raters (Cohen's κ for 2 raters, Fleiss' κ for 3 or more) and precision, recall and κ for each code rule.
- `npm run validate:cv -- --live` also runs the AI judge on the gold CVs. It flags every rule with κ below 0.6 for rewriting, moving to code, or demoting to an unscored tip.
- `npm run reliability -- --live` measures test–retest reliability: per-rule flip rates with Wilson intervals, Fleiss' κ across runs, ICC(1,1) and the SEM.
- The only gold file in the repo is **synthetic**: made-up CVs and labels that test the harness. No number computed from it says anything about the score's validity.

When real results exist, this card will report them: per-rule κ for each model, test–retest SD for each model, and the fairness results.

## Sources

- DSIT, *Responsible AI in Recruitment* (25 March 2024): https://www.gov.uk/government/publications/responsible-ai-in-recruitment-guide/responsible-ai-in-recruitment
- Panickssery, Bowman & Feng, "LLM Evaluators Recognize and Favor Their Own Generations" (2024): https://arxiv.org/abs/2404.13076
- Xu, Li & Jiang, "AI Self-preferencing in Algorithmic Hiring" (2025): https://arxiv.org/abs/2509.00462
- Liang et al., "GPT detectors are biased against non-native English writers", *Patterns* (2023): https://arxiv.org/abs/2304.02819
- Tamkin et al., "Evaluating and Mitigating Discrimination in Language Model Decisions" (2023): https://arxiv.org/abs/2312.03689
- Google, Gemini 3 developer guide (temperature): https://ai.google.dev/gemini-api/docs/gemini-3
- Internal: `docs/research/audit-2026-10-18/04-cv-score-engine.md`, `tests/fairness/REPORT.md`

The DSIT guide (its model-card passage and the 25 March 2024 publication date) and the four arXiv titles were checked at the URLs above on 18 October 2026. The Gemini guide is cited as the 2026-10-18 audit (04) recorded it.
