# Playbook audit 2026-10-18: synthesis

Ten auditors each took one area and checked it line by line against primary sources and against the code that ships. The full reports are `01`–`10` in this folder and contain **306 findings** and over **550 source citations** (each report has 33–45 graded sources). This file brings them together: what is broken across areas, what to fix first, and in what order.

I confirmed these P0s directly in the code: `aggregate.ts` dropping N/A results from the denominator, the `uk_grades` regex, `pickActions` having no upper year bound, and the visa gate ignoring role type.

## 1. Report card

| # | Area | Grade | P0 | P1 | P2 | P3 | Report |
|---|---|---|---|---|---|---|---|
| 01 | General CV rules | C+ | 2 | 8 | 13 | 7 | [01](01-cv-rules-general.md) |
| 02 | Finance & consulting CV rules | C− | 2 | 10 | 15 | 3 | [02](02-cv-rules-finance-consulting.md) |
| 03 | Tech, product, data & quant CV rules | C | 3 | 9 | 17 | 3 | [03](03-cv-rules-tech-product.md) |
| 04 | CV Score engine (maths, judge, fairness) | C− | 4 | 15 | 9 | 2 | [04](04-cv-score-engine.md) |
| 05 | Tailor playbooks + fabrication gate | C+ | 4 | 13 | 10 | 3 | [05](05-tailor-playbooks.md) |
| 06 | Role playbooks: finance, quant, consulting | C+ | 2 | 13 | 12 | 4 | [06](06-role-playbooks-finance-consulting.md) |
| 07 | Role playbooks: tech, product, data, other | C | 3 | 10 | 13 | 4 | [07](07-role-playbooks-tech-product.md) |
| 08 | LinkedIn playbook + score | C+ | 2 | 10 | 14 | 6 | [08](08-linkedin.md) |
| 09 | Cover letter playbook + writer | C+ | 2 | 11 | 13 | 4 | [09](09-cover-letter.md) |
| 10 | Job fit, ATS claims, market-2026 evidence | C+ (fit score D+) | 4 | 20 | 5 | 2 | [10](10-fit-ats-market.md) |
| | **Total** | **C** | **28** | **119** | **121** | **38** | |

**One-line verdict:** the research is good and the shipped code is bad. All ten auditors independently found the same pattern: the research docs are careful and honest about their evidence (one area had all 42 cited URLs live with verbatim quotes, another all 49), but the checkers, aggregation, build scripts and prompts lose that care on the way to the user.

## 2. Cross-cutting themes (problems found in several reports)

### T1. Scoring maths inflates and distorts scores (04, 01, 02, 03)
- **Failures raise the score.** `could_not_assess`, `not_applicable` and missing verdicts are dropped from the denominator (`lib/cv-score/aggregate.ts:44-46`). So when the judge fails, misquotes or answers N/A, the score goes *up*. Worked example in 04: a CV that should score 75 shows 100 when the AI is down. The panel's `aiUnavailable` banner helps, but the ring still shows 100 and "Polished".
- **One detector is counted under 2–4 rule IDs.** Examples: `uk_grades` (G-32, SWE-15, FIN-*), quantification (G-22, GEN-04, CON-*), spelling (×3 plus a cap), personal details (G-17, GEN-01, FCQ-03). One issue can cost about 6–10 points, and the duplicates also cancel the only year adjustment that exists (GEN-04).
- **Cliffs and bad maths.** The 3-typo cap is a 40-point drop, based on an unverified LLM spelling list. "+N pts" is wrong whenever a cap applies. A rule's weight varies about 12× depending on how many other rules share its dimension. Evidence grade is multiplied into importance, so "critical D" weighs about the same as "minor A".
- **A failed first judge batch silently passes all spelling rules** (about 10 points in finance).
- **Fix direction:** one rule ID per detector (merge the G/GEN/FCQ/sector duplicates, use `sectorAdjust` instead), treat N/A and could-not-assess as excluded *with a coverage indicator*, and show a "provisional" state instead of a number when coverage is below a threshold. Replace hard caps with graded penalties, and compute "+N pts" by re-running aggregation with that rule set to pass.

### T2. Code checkers misfire and fall on specific groups (01, 02, 03, 08, 09)
- **`uk_grades`** (`lib/cv-score/checkers.ts:126-130`): a bare "A-levels", "Predicted" or any "72%" passes. It fails Master's Distinction/Merit, GPA/CGPA, IB "38/45", Lower Second and Third. That is a fairness problem for international and postgraduate students. The G-32/SWE-15 copy also tells 2:2 students to hide their grade, and the checker then fails them for doing so.
- **`uk_personal_details`** fails any line containing "Nationality", including a module title, even though the rule says nationality is optional. It never detects photos, gender or religion. FCQ-03 "no photo" reuses this checker and never looks for a photo.
- **`github_link`** passes on the word "portfolio" or "Socket.io" and fails Kaggle, Tableau Public and Hugging Face links.
- **`quantified_bullets`** counts any digit, including dates.
- **The redactor strips "(native)"**, so native speakers fail FIN-09.
- **LinkedIn:** the competition detector matches "step" and "mat", the slug rule fails slugs ending in a year, and the location rule fails international students.
- **Cover letter:** the hard-block lexicon fires on "Overall," and "Yahoo!", and the AI-policy regex misses "AI tools are not permitted".
- **Fix direction:** a shared, tested `lib/text/detectors` module, with a fixture table of real phrasings per detector. Every regex gets at least 10 positive and 10 negative cases taken from the reports.

### T3. The LLM judge is blind to the context its rules depend on (03, 04, 08)
- The CV judge never receives year, sector, sub-track or the job advert, and the LinkedIn judge never receives year or sector thresholds. So every conditional rule ("for DS roles", "first-years may…") is a guess, and `yearAdjust` does nothing for about half the rules.
- The judge prompt omits the rule *statement* (03 #23).
- About six rules ask about things the judge never sees (file name, fonts, file type, header/footer, link liveness).
- G-37 is a system guardrail that gets scored ("Always answer yes").
- Passes require a quote but fails do not, so the judge can invent absence-fails.
- **Fix direction:** pass a `context` block (year, sector, sub-track, JD-present flag) and resolve the year/sector-adjusted rule text *before* sending it. Move unobservable rules to code or delete them, and require a quote or an explicit "absent" proof for fails.

### T4. No validity or reliability evidence (04)
- There is no human-labelled gold set, no inter-rater agreement and no recruiter calibration. `scripts/reliability.ts` has never been run.
- The fairness tests T13 and T15 pass only because the LLM is off during the test.
- Claude and Gemini run at default temperature with one cached sample, and a one-character edit re-rolls every verdict, so noise looks like progress.
- Scores from different models (Ollama, Claude, Gemini) share one history and one set of bands.
- **Fix direction:** follow the validation plan in 04 §Validation plan:
  1. Build a 60–100 CV gold set labelled by 2–3 raters per rule.
  2. Measure Cohen's/Fleiss' κ per rule, and drop or rewrite any rule below 0.6.
  3. Run test-retest on 3 samples, and only re-judge rules whose evidence lines changed.
  4. Tag every score with its model, and reset history when the model changes.

### T5. Employer AI policy is ignored, but this is now a 2026 compliance issue (02, 05, 09, 10)
- Bain London allows AI on CVs **only for spelling and grammar**. McKinsey allows "refining". Anthropic now says "draft it yourself first, then refine with Claude". ISE 2026 reports 92% of employers suspect AI misconduct.
- The tailor has **no** policy check, and FCQ-12 tells every user "AI can help you polish".
- The cover-letter detector reads only the JD, with a stale regex.
- **Fix direction:** a curated per-employer `aiPolicy` table (`allowed | grammar_only | draft_yourself_first | banned_in_tests`, with source URL and date), plus a JD regex fallback. It gates the tailor and cover letter, and shows a banner before any AI rewrite.

### T6. The fabrication gate has blind spots, and the prompt pushes the model into them (05, 09)
- In 56 probes against the real `verifyTailoring`, the gate caught **14 of 48** fabrications. The misses were:
  - **Summary claims:** £5k→£5m, Predicted 2:2→"First-class", Spring Insight→"former GS summer analyst".
  - **Hedge and modality drops:** "estimated", "paper/simulated", "drafted", "predicted".
  - **Outcome upgrades:** "finalist"→"won".
  - **Scope inflation:** "committee"→"senior management".
  - **Frequency changes:** "monthly"→"weekly".
  - **Proficiency escalation.**
- `SYSTEM_TAILOR` demands an 8–12-change rewrite where "unchanged is never the safe default", writes a summary from scratch when the CV has none, and runs on the fast tier.
- In the cover letter, one "This is true" tap clears a failed swap test, and the AI sentence becomes a confirmed fact that also feeds tailoring.
- On `feat/experience-bank`, bullets extracted from LinkedIn posts skip the skills and ownership checks. **Fix this before merging.**
- **Fix direction:**
  1. Add the 16 checks specified in 05 §New rules: a hedge/modality lexicon diff, outcome ladder, scope/audience ladder, frequency ladder, grade/qualification entity check, and summary-as-bullets verification.
  2. Never generate a summary the CV doesn't have.
  3. Change the prompt from "substantial rewrite" to "select and reorder; minimal edits".
  4. Run the tailor on the smart tier.

### T7. Time-bound data goes stale silently (06, 07, 10)
- Build scripts drop `reviewBy` from dated guidance, and drop the honest `signalValue` labels.
- None of the five tech/product archetypes has a single dated item, even though Google's 2027 internships close around 19 Oct 2026 and Monzo's on 1 Nov 2026.
- The market docs are a release behind ISE 2026 (14 Oct 2026):

| Figure | In the docs | ISE 2026 |
|---|---|---|
| Applications per graduate vacancy | 140 | 141 |
| Graduate hiring | −8% | +4% |
| Employers giving no AI guidance | 45% | 18% |
| Employers allowing AI use | 49% | up to 64% |

- The Graduate visa cut to 18 months for applications from 1 Jan 2027 is **missing from every doc and from the logic**.
- **Fix direction:** keep `reviewBy` and `signalValue` through the build, add a test that fails when any `expiresOn`/`reviewBy` is in the past, and add a deadline-calendar data file with sources.

### T8. Year and eligibility model is wrong (06, 07, 10)
- `pickActions` filters only on `minYear` (`lib/target/actions.ts:27`), so finalists and Master's students see first-year-only programmes (Jane Street FTTP, JPM Spring Insights) in their top three.
- "2nd" vs "penultimate" is ambiguous on 3-year degrees, and `yearGuess` assumes 3-year degrees.
- Employers gate on **graduation year**, but the heuristic parser maps "graduating 2028" to final year, and its pattern only covers 2026–28.
- **Fix direction:** model `graduationYear` + `courseLength` + `placementYear` and derive cycle eligibility from them. Add `maxYear` or `eligibleGradYears` to actions, and a test matrix of year × programme.

### T9. Fairness: visa, access, cost (10, 06, 01, 04)
- **Visa gate** (`lib/scoring/fit.ts:77`): "needs visa" plus "no sponsorship" means "Not recommended" plus less XP *for every role type*. But Student-visa holders can legally do vacation internships, spring weeks and course placements (UKCISA). The `tagJob` prompt also treats "must have right to work" as "no sponsorship", and the regex matches "no sponsorship required".
- **Access:** no access or diversity programmes (SEO London, upReach, Rare, Jane Street FOCUS, which closes 8 Nov 2026). BMC is rewarded by the CV rules, but UCL has no terminals and the course costs $149.
- **Redaction** keeps university and school names and misses several proxies for protected characteristics.
- **Fix direction:** visa gate applies only to permanent and graduate roles; for internships, show an info note instead. Add an access-programme playbook section. Remove the BMC reward or add a free alternative. Extend redaction per 04 #15–16.

### T10. The playbooks describe a 2022 market (07, 06, 09, 10)
- The SWE playbook never mentions online coding tests or DSA interviews, which are the real gate. There is no AI-era signal: Canva and Meta assess AI use in interviews, while Google's in-person round, Anthropic and Monzo ban it.
- No model of the assessment stage (SHL, Cappfinity, HireVue, Sova, Arctic Shores), even though that is where most UK knockouts happen.
- The skill-overlap matcher has no action for 54 of 79 SWE skills.
- **Missing archetypes:** Big 4 (the largest UK graduate recruiters), asset management, actuarial, corporate banking, quant dev, ML engineer, data engineer, SRE, security, UX, placement years and off-cycle internships.
- **Strategic finding (09):** UK firms are moving "why us" into form boxes and recorded video, and PwC and KPMG ask for no letter at all. The cover-letter writer should become a **per-firm motivation bank** that renders letters, form answers, HireVue scripts and interview-prep cards.

### T11. Contradictions between playbooks (01, 02, 03, 05, 08, 09)

| Contradiction | Where |
|---|---|
| Page length: CV rules say one or two pages, but finance says one page and SWE says one page | G-11 vs FCQ-01 vs SWE-01; the myth list says one or two pages |
| Grade disclosure: LinkedIn requires the grade for finance, CV rules say state it only if 2:1 or above | LI-FIN-11 vs G-32 |
| CFA wording: "CFA Level I – passed" is the form CFA Institute forbids | FIN-11 (CV) vs LinkedIn rule |
| Tailor playbooks say put numbers and the target role in the summary; the system prompt forbids both | tailor JSON vs SYSTEM_TAILOR |
| The cover-letter draft prompt is fed the **CV tailoring** playbook | lib/cover-letter/draft.ts |
| "I/my": banned on CVs, required on LinkedIn, with no explanation to the user | G-24 vs LI first-person rules |
| Spring-week timing differs between the role playbook and the CV-rules doc | 06 #19 |
| Virtual work experience is labelled differently across the engines | 08 #26 |
| Profile length: three different limits | G-19 vs GEN-08 vs `summary_length` |

**Fix direction:** one shared `lib/conventions.ts` (page length by sector, grade disclosure policy, credential wording, first-person policy), and all engines read from it.

### T12. Evidence grading and copy overclaim (01, 03, 06, 08, 10)
- **Misgraded or misused sources:**
  - Ladders 2012 is a marketing piece cited for four rules.
  - The Frontiers "30 seconds" figure was set by the study's own design.
  - The 3-typo cap rests on a study that only tested 0, 2 and 5 errors.
  - "97% fabrication" comes from a single-author preprint on 10 synthetic CVs (grade C, not A).
  - Several "A" grades rest on US or experienced-hire sources.
- **Misquoted numbers in market-2026:**
  - Cui 51% is a drop in correlation, not "payoff".
  - The 28% AI-use figure is ISE 2023; the 2026 figure is 16%.
  - "75% CIPD" applies only to the 35% of employers who monitor AI, so it is about 26% of all employers.
  - The "100+ applications" figure is from Jisc, not HESA.
  - The Wiles sample was about 480k, not 195k.
- **Copy and presentation:** the "does not predict interviews" disclaimer is hidden, and XP-style gamification sits on the score. The "Gap Closer" badge and "Verified" state overclaim.
- **Fix direction:** apply the re-verification table in 10 §Re-verification. Cap the grade at B for careers-page conventions and at C for single-author preprints, and add a lint that fails on an A-graded source whose publisher is a vendor.

## 3. All P0s (fix now)

**Score engine and CV rules**
1. N/A, could-not-assess and judge failures raise the score: `lib/cv-score/aggregate.ts:44-46` (04 #1)
2. One detector is counted as 2–4 rules (04 #2, 01 #3, 02 #3, 03 #6)
3. 3-typo cap is a 40-point cliff fed by an unverified LLM spelling list (04 #3)
4. A failed first judge batch passes every spelling rule (04 #4)
5. `uk_grades` false passes and false fails, plus copy telling students to hide a 2:2: `checkers.ts:126` (01 #2, 02 #2, 03 #2)
6. `uk_personal_details` fails "Nationality" and never detects photos (01 #1, 02 #4)
7. SWE-01 imposes a one-page limit, against UK sources and our own myth list (03 #1)
8. `github_link` false passes and false fails (03 #3)

**Tailor and cover letter**

9. Tailor and FCQ-12 ignore employer AI policy (Bain grammar-only) (02 #1, 05 #13)
10. Summary is unguarded and generated from scratch (05 #1)
11. Role-type inflation of a real employer passes (05 #2)
12. Hedge and modality drops are invisible (05 #3)
13. Outcome upgrades ("finalist"→"won") are only a warning (05 #4)
14. Cover-letter AI-policy detector is stale and its regex misses (09 #1)
15. Wrong-employer check does nothing in local-first mode (09 #2)

**Role playbooks**

16. First-year-only programmes recommended to finalists: `lib/target/actions.ts:27` (06 #1)
17. `reviewBy` stripped at build, so stale dates never expire (06 #2)
18. SWE playbook omits online coding tests and DSA interviews (07 #1)
19. No AI-in-interviews signal (07 #2)
20. Zero dated items for tech/product while deadlines close now (07 #3)

**LinkedIn**

21. CV↔LinkedIn date cross-check raises false critical fails: `lib/linkedin-score/cross-check.ts:56-65` (08 #1)
22. LLM-only critical integrity rules with no required quote trigger the 59 cap (08 #2)

**Fit score**

23. Visa gate blocks legal internships and placements: `lib/scoring/fit.ts:77` (10 #1)
24. Heuristic year parser misreads graduation-year windows (10 #2)
25. "Not recommended" and reduced XP amplify gate errors (10 #3)
26. Deadline proximity weighs as much as skill match; "no deadline" is penalised (10 #4)

The reports count 28 P0s. Two (01 #18 `quantified_bullets` and 06 #5 ranker) are listed as P0 in their reports but fold into themes T2 and T7 above.

## 4. Roadmap

**Phase 0: this week (deadlines are live)**
- Dated playbook entries with sources for live windows:
  - Google 2027 internships (~19 Oct)
  - Monzo (1 Nov)
  - Jane Street FOCUS (8 Nov)
  - BlackRock spring insight (4 Dec)
  - Bain ACI
  - JPM Spring Insights
- Visa gate scoped to permanent and graduate roles, with UKCISA wording for internships.
- `pickActions` upper year bound.
- Graduate-visa 18-month note for finalists.

**Phase 1: score integrity (1–2 days of work)**
- Deduplicate rule IDs.
- N/A and coverage handling, and a "provisional" state.
- Graded typo penalty.
- Correct "+N pts".
- Rewrite `uk_grades`, `uk_personal_details`, `github_link` and `quantified_bullets` with fixture tables.
- Pass year/sector/JD context to both judges, and require quotes on fails.
- Delete or move G-37 and the unobservable rules.

**Phase 2: tailoring safety**
- Add the 16 new gate checks from 05.
- No invented summary.
- Prompt changed to "select + minimal edit".
- Smart tier.
- Employer AI-policy table gating tailor and cover letter.
- Fix the experience-bank laundering before merging.

**Phase 3: content refresh**
- SWE assessment and AI-in-interview signals.
- New archetypes: Big 4, AM, quant dev, ML/data engineering, placement year.
- Access-programme section.
- Shared `lib/conventions.ts` to remove contradictions.
- Apply the market-2026 corrections from ISE 2026.

**Phase 4: validity**
- Gold set + κ per rule.
- Test-retest.
- Model-tagged score history.
- Wire the "I disagree" feedback into the rule review queue.

**Strategic**
- Turn the cover-letter writer into a motivation bank (letters, form answers, video scripts, interview cards).
- Fit score: must-haves met (n/m) gates the score, add a 2:1-floor signal, model the assessment stage.

## 5. Caveats on this audit
- Firecrawl ran out of credits and the shared web-search budget ran out late in several runs. Each report's *Open questions* lists what is only partly verified. Examples:
  - Oxford, UCL and PwC pages returned 403.
  - The ICO audit PDF couldn't be extracted.
  - The Bloomberg LLM name-bias page returned 403.
  - LinkedIn PDF export fields are unverified.
- Several auditors ran the shipped code in scratch scripts (regexes, `verifyTailoring`, `aggregateCvScore`, `pickActions`) to produce the worked examples. No app, DB or repo code was changed.
