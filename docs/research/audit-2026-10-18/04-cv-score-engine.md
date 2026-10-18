# CV Score engine audit (methodology, validity, reliability, fairness, presentation)

**Overall grade: C−.** The basic design is sound and follows the literature: code computes the number, the LLM answers per-rule binary questions, every pass must quote a line, input is redacted, and verdicts are cached by content hash. The implementation then undoes much of that. (1) One deterministic checker is counted up to 4 times as separate "rules". (2) When the judge says not_applicable, misquotes a line or fails, the score goes **up**. (3) A 3-typo cap drops the score by 40 points, and its input is the LLM's own spelling list. (4) "+N pts" is wrong whenever a cap applies. (5) No validity evidence exists: there is no gold set or human agreement data, the live reliability script has never been run, and the "gated" fairness tests for phrasing bias run with the LLM switched off. Scores are not comparable across Claude, Gemini and local Qwen models, but the history sparkline mixes them anyway.

## Scorecard

| Dimension | Grade | Reason |
|---|---|---|
| Evidence quality (methodology choices) | B | Binary checklists, quoted evidence, code aggregation and caching all match the LLM-judge literature (CheckEval, Zheng et al., Schroeder & Wood-Doughty). |
| Weights and aggregation math | D | Dimension weights are graded D (synthesis) by their own doc. A rule's influence depends mostly on how many rules share its dimension (0.18 to 2.13 pts per unit of weight). Duplicate checkers multi-count, N/A or could-not-assess inflates scores, and caps create cliffs. |
| Reliability | D | Claude and Gemini judge at their default temperature (1.0), Ollama at 0.2. Each CV gets one cached sample. Edits trigger a full re-judge, so noise looks like progress or regress. The live test-retest gate (scripts/reliability.ts) has never been run. |
| Validity / calibration | F | No human-labelled gold set, no κ, no convergent validity against recruiter judgments. The 2026-10-13 research doc (06 §5.9) planned this and it was never started. |
| Fairness | C | Redaction is better than most (name, contact, visa, Art. 9 terms, language labels). But universities and schools are kept, gendered societies and religious venues leak, and the LLM-side fairness tests (T13, T15) are vacuous in fixture mode. |
| Security (injection / hidden text) | C+ | Text-level scanning and structural defences are good. The lexicon only catches explicit commands, though the 03 doc says over 90% of real injections are hidden keywords or praise. When the scanner finds nothing, the full PDF goes to a vision parser. |
| Presentation / feedback psychology | C | Leading with the next fix and showing source chips is good (Kluger & DeNisi, Hattie & Timperley). But the "does not predict interviews" disclaimer is collapsed by default, "+pts" uses XP chip styling, "+0 pts" fixes appear, a CV failing half the LLM rules is labelled "Strong", there is no ±SD, and the band cut-offs differ from the research doc. |
| Test coverage | C | Good unit tests for mapping and redaction. Nothing tests lostPoints correctness, cap interaction, duplicate-checker counting, a failed batch 0, or cross-model agreement. |
| Doc ↔ code consistency | D | R2 delta re-judging, R3 reliability, R6 bands and ±N, R10 university redaction, C13 dismiss and C14 model card are all missing or changed. G-17's statement contradicts its checker. G-37 promises things the pipeline does not do. |

---

## Findings

### 1. The judge's failure modes raise the score: N/A, misquotes and missing verdicts are dropped from the denominator
- **Severity**: P0 · **Type**: implementation / validity
- **Where**: `lib/cv-score/aggregate.ts:46-47`; `lib/ai/judgeCvRules.ts:61-66, 86, 92-97`
- **Current**: `if (x.status === "could_not_assess") { couldNotAssess++; continue; } if (x.status === "not_applicable") continue;`. An unknown status maps to not_applicable (`judgeCvRules.ts:65`), and so does a missing verdict (`:86`).
- **Evidence (worked example, computed with the shipped code)**: consulting, with every other rule passing. If 10 LLM rules fail, the total is **94**. If the same 10 come back `not_applicable`, the total is **100**. If they come back `could_not_assess` (the model misquoted the line), the total is also **100**. So a weaker judge produces a higher score. That includes small local models, which under-follow the schema and misquote more often. The literature already finds judges lean lenient (Thakur et al. 2024, arXiv 2406.12624, B: "judges with high percent agreement can still assign vastly different scores"). The ICO's audit criticised providers whose accuracy bar was "at least better than random" (ICO Nov 2024, via Simmons & Simmons summary, B).
- **Fix**:
  1. Treat a missing verdict and an unknown status as `could_not_assess`, not `not_applicable`.
  2. Only let a rule be `not_applicable` if it declares `naWhen` in its definition (e.g. DAT-07 "no competitions listed"). Otherwise coerce N/A to `could_not_assess`.
  3. Add a coverage floor. `coverage = assessedWeight / applicableWeight`. If coverage < 0.8 in any dimension or overall, show the dimension as "—" and the total as "Provisional", with a range from `[score if all unassessed fail]` to `[score if all pass]`, rather than a point estimate.
  4. Persist and display `N not assessed` per dimension.

### 2. One checker is counted as 2–4 independent "rules", so the effective weights are not the stated weights
- **Severity**: P0 · **Type**: implementation / wrong
- **Where**: `lib/cv-rules/rules/general.ts`, `finance.ts`, `tech.ts`. Checker `spelling` drives G-25, GEN-06, FCQ-05 and MKT-07. `quantified_bullets` drives G-22, GEN-04, FCQ-08 and CON-04. `uk_grades` drives G-32, FCQ-04, FIN-02, CON-01, QNT-12 and SWE-15. `page_count` drives G-11, FCQ-01, QNT-09, SWE-01, PRD-01, MKT-02 and RES-01. `uk_personal_details` drives G-17, GEN-01 and FCQ-03.
- **Current (computed)**: in finance, one condition (no explicit grade) fails G-32 + FCQ-04 + FIN-02 = **5.9 pts**. In quant, page count costs G-11 + FCQ-01 + QNT-09 = **6.2 pts**. In consulting, quantification costs 4 rules = **7.8 pts**. Each appears in the panel as a separate fix, so the student sees three "+2" fixes for one edit. "Rules passed X/Y" is inflated or deflated by the same multiplicity.
- **Evidence**: duplicating an item silently multiplies its weight. Standard scale construction (AERA/APA/NCME *Standards* 2014, A) requires item weights to reflect the intended construct, not authoring overlap.
- **Fix**: dedupe at aggregation time. Group results by `checker` (or a new `constructId`) within a sector and keep **one** result per construct, using the max effective weight among the duplicates, never the sum. Merge their statements into a single fix card. Add a unit test: for every sector, no two scored rules share a checker unless they declare `distinctConstruct: true` with distinct params.

### 3. The 3-typo cap is a 40-point cliff, and its input is the LLM's unverified spelling list
- **Severity**: P0 · **Type**: implementation / unsupported
- **Where**: `lib/cv-score/aggregate.ts:66`; `lib/cv-score/run.ts:85`; `lib/ai/judgeCvRules.ts:190, 111-119`
- **Current**: `if (i.facts.spellingErrors >= 3) { total = Math.min(total, 50) … }`. The facts come from `llm.spellingErrors`. `cleanSpelling` only checks that the word occurs in the text and is not a UK/US variant. It never checks that the word is actually misspelled.
- **Evidence (computed)**: a finance CV with otherwise perfect rules scores **95** with 2 typos (partial), **90** with 3 typos uncapped, and **50** with the cap. The cited study shows a *graded* penalty: error-laden CVs cut interview probability by 18.5 pp and lightly erroneous ones by 7.3 pp (Sterkens et al., *PLOS ONE* 18(4) e0283280, 2023, A, https://pmc.ncbi.nlm.nih.gov/articles/PMC10075394/). Nothing there supports halving the score at 3. LLM "misspellings" on a non-native student's CV often include transliterated names, non-English institution names and domain terms. The prompt asks to ignore these, but nothing enforces it. That creates an indirect-discrimination risk under Equality Act s.19 (A).
- **Fix**:
  1. Remove the spelling cap. The three spelling rules (after the dedupe in #2) already carry the penalty.
  2. Verify each LLM-flagged word against a deterministic en-GB + en-US dictionary (e.g. `nspell` with `dictionary-en-gb` and `dictionary-en`). Count only words that are absent from both, absent from the CV's own skills and entity list, and not capitalised mid-sentence.
  3. Show the flagged words with "Not a typo?" dismissal.

### 4. A failed first judge batch silently passes every spelling rule
- **Severity**: P0 · **Type**: implementation
- **Where**: `lib/ai/judgeCvRules.ts:190`
- **Current**: `spelling_errors: outs[0]?.spelling_errors ?? []`. If batch 0 times out or errors, `outs[0]` is null and spelling becomes `[]`, not `null`. `checkers.ts:173-174` then returns **pass** for G-25, GEN-06 and FCQ-05, critical A-rules worth about 10 pts in finance, and the panel only says "AI review unavailable".
- **Fix**: `const first = ok[0]; spelling = first ? first.spelling_errors : null;`. Take spelling from the first *successful* batch, or ask for spelling in its own small call. Set `spellingErrors: null` whenever it was not obtained, so the spelling rules become N/A and appear under "couldn't assess". Add a test for batch 0 failing.

### 5. "+N pts" is wrong whenever a cap applies, and "+0 pts" fixes are shown
- **Severity**: P1 · **Type**: implementation / copy
- **Where**: `aggregate.ts:73`; `components/cv-score-panel.tsx:86, 137`
- **Current**: lostPoints is the uncapped marginal contribution `(W_d/ΣW_active)·100·w·(1−credit)/ΣW_d`. Hand-check: the formula is correct without caps (product example: lostPoints sum 14 = 100 − 86 ✔). With a cap it is wrong.
- **Evidence (computed)**: software engineering with no phone or email is capped at 40. The panel shows "SWE-03 +2", but fixing SWE-03 leaves the score at **40**. With the 3-typo cap, the three spelling fixes show +4, +4 and +2 (total 10), while fixing them actually lifts the score by **40**. Quant G-10 and GEN-11 show "+0 pts". Promising points that never arrive breaks the feedback loop that Hattie & Timperley (2007, A) say makes feedback work, which needs an accurate answer to "where to next".
- **Fix**: compute `gain(rule) = total(after setting rule to pass, caps re-applied) − total(now)` by re-running `aggregateCvScore` per fix (cheap, pure). When a cap binds, show the cap-lifting fix first with its real gain. Hide fixes with gain < 1 under "Minor polish". Show "+<1" rather than "+0".

### 6. A dimension with one assessed rule carries the whole dimension weight
- **Severity**: P1 · **Type**: implementation
- **Where**: `aggregate.ts:55-62`
- **Evidence (computed)**: product, where the judge marks every Impact rule N/A except G-20 (fail). Impact becomes 0, the total drops to 75, and G-20 alone shows **+25 pts**. Per-rule influence is otherwise 0.07–6.4 pts. Sparse dimensions make the total hypersensitive to one noisy verdict.
- **Fix**: shrink sparse dimensions towards a prior. `dimScore = (Σw·credit + k·μ)/(Σw + k)` with `k = 2` (weight units) and `μ = 50`, or simply mark a dimension "—" when its assessed weight is under 40% of its applicable weight (see #1).

### 7. A rule's weight depends on how many other rules share its dimension (arbitrary 12× spread)
- **Severity**: P1 · **Type**: unsupported / implementation
- **Where**: `lib/cv-rules/profiles.ts:5-22`; `aggregate.ts:48, 57`
- **Current (computed, 2nd year)**: points per unit of rule weight range from **0.18** (quant ATS: 15 rules share 5%) to **2.13** (product clarity). As a result, G-01 "text-based PDF" (critical A) is worth 0.55 pts in quant but 1.76 in software engineering, and ATS-HID-01 hidden text (critical) is worth 0.47 in quant. Adding a rule to a dimension silently devalues every other rule in it. The weights themselves are graded D ("The docs grade the sector offsets D (synthesis); tune against outcome data", `profiles.ts:11`).
- **Evidence**: weights for composites should be justified empirically (regression on a criterion) or by expert judgment with documented agreement (*Standards* 2014, ch. 1 and 4, A). Neither has been done.
- **Fix**:
  1. Short term: publish the effective per-rule maximum points per sector in a generated `docs/cv-score-weights.md` (script above), and add a CI test that fails if any critical rule is worth less than any minor rule within the same sector.
  2. Medium term: derive weights from the gold set (see Validation plan). Fit a non-negative logistic model of expert "would shortlist" judgments on per-rule verdicts. Fall back to equal weights per construct where the data is underpowered (equal weights are robust; Dawes 1979).

### 8. Evidence grade is multiplied into importance, so "critical D" weighs about the same as "minor A"
- **Severity**: P1 · **Type**: unsupported
- **Where**: `aggregate.ts:6-7, 48`
- **Current**: `w = SEV × EVID`, with critical = 3 and D = 0.4, giving 1.2. Minor A gives 1.0. G-16 "contact details" (critical, D) therefore counts for less than many minor B rules, yet a missing email also triggers a 40-cap.
- **Evidence**: confidence in a claim and the size of its effect are separate quantities. Down-weighting by evidence is defensible as shrinkage, but mixing it into severity hides the reason from users. The panel shows "Convention" only as a tag.
- **Fix**: keep severity as the weight. Use evidence as (a) a cap on severity (D rules max "major", C max "major", only A/B can be "critical") and (b) the UI tag. Re-grade G-16 to `major/D` and keep the contact cap as the real enforcement.

### 9. No temperature control on Claude or Gemini, one cached sample, and a full re-judge on every edit, so noise looks like progress
- **Severity**: P1 · **Type**: implementation / reliability
- **Where**: `lib/ai/anthropic.ts:36` (temperature never sent); `lib/ai/gemini.ts:52-53` (Gemini 3+ drops temperature, so the default is 1.0, and the judge runs at LOW thinking); `lib/ai/ollama.ts:133` (0.2); `run.ts:57-74` (any text change means a new hash and a full re-judge of all ~45 LLM rules)
- **Evidence**: Google: "For all Gemini 3 models, we strongly recommend keeping the temperature parameter at its default value of 1.0" (Google AI for Developers, Gemini 3 guide, A/B, https://ai.google.dev/gemini-api/docs/gemini-3). Even deterministic settings vary: "none of the LLMs consistently delivers repeatable accuracy across all tasks" (Atil et al. 2024, arXiv 2408.04667, B). "a single sample from the model's probability distribution can still be misleading" (Schroeder & Wood-Doughty 2024, arXiv 2412.12509, B). The project's own research recommended delta re-judging (06 R2). It is not implemented.
- **Fix**:
  1. **Delta re-judging**: store verdicts keyed by `(ruleId, sha256(evidence_scope))`, where the scope is the whole CV for global rules and the changed entry for entry-level rules. Re-judge only the rules whose scope text changed.
  2. For borderline rules (flip rate > 10% in the reliability run), take a majority of 3 samples.
  3. Show the measured SD as "±N" next to the ring.

### 10. Scores are model-dependent, but history and bands treat them as one scale
- **Severity**: P1 · **Type**: validity / UX
- **Where**: `lib/cv-score/panel-data.ts:66-69` (history is pulled without `model_id`); `lib/ai/models.ts:7-8`; `lib/ai/local-models.ts:24-41` (4B–35B local models)
- **Current**: the cache key includes model_id (good), but the sparkline mixes totals from Claude Sonnet, Gemini Flash and Qwen 3.5 4B, plus code-only "AI unavailable" runs. No cross-model agreement has been measured.
- **Evidence**: judge agreement with humans varies widely by model: "only the best and largest" approach human alignment (Thakur et al. 2024, B). Self-preference also differs by model family (Panickssery et al. 2024, arXiv 2404.13076, B: a "linear correlation between self-recognition capability and the strength of self-preference bias").
- **Fix**:
  1. Store `model_id` and `ai_unavailable` with every history point. Break the sparkline line when the model changes and label the segment ("scored by Qwen 3.5 4B").
  2. Show a "Judge: <model>" chip under the ring.
  3. Run the cross-model protocol in the Validation plan. Until a local model reaches κ ≥ 0.6 against the gold set, label local scores "Experimental (local model)".
  4. Do not compare scores across models in any copy.

### 11. Code-only "AI unavailable" scores are shown on the same ring and bands
- **Severity**: P1 · **Type**: UX / validity
- **Where**: `run.ts:73, 94`; `cv-score-panel.tsx:232-236`
- **Evidence (computed)**: consulting, where half the LLM rules fail and all code rules pass, scores **75**. With the AI down, the same CV scores **100 "Polished"**. The amber note sits *below* the ring.
- **Fix**: when `aiUnavailable`, do not render a total. Show "Automatic checks: X/Y passed" and dimension bars for code rules only, with "Full score needs the AI review". Do not add the run to history.

### 12. The fairness suite's LLM-side tests pass trivially because the LLM is off
- **Severity**: P1 · **Type**: implementation / copy (overclaim)
- **Where**: `tests/fairness/score.test.ts:58, 157-168`; `tests/fairness/REPORT.md` ("T13 … ✅ gated, pass: Δ 0 and 0")
- **Current**: the suite runs with `AI_MODE = "fixture"`. Without an exact fixture, every LLM rule is `not_applicable` (`judgeCvRules.ts:161`), so T13 (non-native phrasing) only exercises code rules. The REPORT admits the score half "cannot measure model variance or model bias". The status table still says pass.
- **Evidence**: non-native and prose-style effects live in the LLM judgments, not the code checks. LLM evaluators misjudge non-native writing: "these detectors consistently misclassify non-native English writing samples as AI-generated" (Liang et al., *Patterns* 2023, A, arXiv 2304.02819).
- **Fix**: relabel T13 and T15 as "code-only: pass; LLM: NOT RUN". Add `tests/live/fairness.live.ts`, gated on an API key and run before each release. It should cover 10 bases, all T1–T19, 3 runs with the median, and every configured provider including a recommended Ollama model. Use equivalence testing (TOST, ±2 pts) rather than "Δ ≤ 2 on one run".

### 13. The live reliability gate has never been run, and as written it cannot separate noise from signal
- **Severity**: P1 · **Type**: implementation
- **Where**: `scripts/reliability.ts:26, 57-60`; `lib/cv-score/reliability.ts:8-9`; REPORT.md ("written but not yet run")
- **Current**: 5 runs × 5 CVs. A flip threshold of 10% with 5 runs means a single flip (20%) fails, so the gate is effectively "zero flips". The SD is estimated from 5 samples (95% CI roughly 0.6–2.9× the point estimate). The script uses `heuristicParseCv`, not the production LLM parse, and `pageTexts: [text]`.
- **Evidence**: one 2026 study needed about 11 repeats for a majority vote to match a 50-run verdict with 95% probability ("The Coin Flip Judge?", arXiv 2606.13685, B, cited in 06 F6).
- **Fix**: RUNS ≥ 10, CVs ≥ 20 (the gold set). Report per-rule flip rate with a Wilson CI, and Fleiss' κ across runs per rule. For the total, report ICC(1,1) and the SEM. Run it per provider. Parse with the production path (`uploadedRawText` + `parseCV`). Commit the output to `tests/fairness/RELIABILITY-<model>-<date>.md`.

### 14. G-37 is a scored "Always answer yes" rule that makes false fairness claims
- **Severity**: P1 · **Type**: wrong / copy / implementation
- **Where**: `lib/cv-rules/rules/general.ts:300-306`
- **Current**: llmGuidance: "Always answer yes; this is a system guardrail." Statement: "… school or university prestige, or postcode don't change your score." passExample references `[UNIVERSITY]`.
- **Evidence**:
  - A pass must quote a CV line (`judgeCvRules.ts:92-93`), so G-37 either earns free credit when the model quotes any line, or turns into could_not_assess noise. Either way it pads "Rules passed".
  - Universities are deliberately **not** redacted (`redact.ts:5-6`), so `[UNIVERSITY]` never appears.
  - G-17's checker penalises "nationality", which contradicts the statement's claim about nationality.
  - Prompt-level instructions only partly mitigate bias. Tamkin et al. 2023 (arXiv 2312.03689, B) report reductions "through careful prompt engineering", not elimination.
- **Fix**: delete G-37 from `RULES`. Move the statement to the "How this score works" panel, reworded: "We remove your name, contact details, visa status and sensitive personal terms before the AI reads your CV. University and school names are kept because rules check your education section; the AI is told not to consider their prestige."

### 15. Universities and schools are kept even though the judge is told to ignore prestige
- **Severity**: P1 · **Type**: fairness / contradiction
- **Where**: `lib/cv/redact.ts:5-6`; `lib/ai/prompts.ts:39-40`; REPORT.md Decision 1
- **Evidence**:
  - Recruiter-side LLMs over-weight pedigree. interviewing.io's reproduction found ChatGPT "over-weighted top-school and top-company pedigree" (interviewing.io blog, C).
  - The 06 doc cites prestige-tier effects of +0.30 on a 10-point scale (arXiv 2608.18107, B).
  - The ICO's November 2024 findings stress minimisation: "collect the minimum personal information to achieve the AI's purpose" (via Simmons & Simmons, B).
  - The current LLM rules do not need the institution's name. Grade, degree, dates and modules suffice.
- **Fix**: in `prepareJudgeInput` only (not in the student's own CV), replace institution names with `[UNIVERSITY]` / `[SCHOOL]`, keeping degree, grade, modules and dates. Keep the raw name for code rules (`uk_grades`, `read_time`, education-first). Then run T4 as a gate (byte-identical judge input across Oxford, Bedfordshire, Lagos and HKU).

### 16. Redaction misses common proxies for protected characteristics
- **Severity**: P1 · **Type**: fairness / missing
- **Where**: `lib/cv/redact.ts:361-400` (CORES); REPORT.md Decision 3
- **Current gaps**, checked against Equality Act s.4 (age, disability, gender reassignment, marriage/civil partnership, pregnancy/maternity, race, religion or belief, sex, sexual orientation; A):
  - **Sex**: "Women in Tech" is kept on purpose. "Girls Who Code", "Head Girl / Head Boy", "Women's 1st XV captain", "sorority", "fraternity" and "Chairwoman" are not caught.
  - **Religion**: only "<Faith> Society/Soc/Chaplaincy" is caught. Volunteering at a mosque, church, gurdwara, synagogue or temple, "Eid", "Ramadan", "Hajj", "Bible study" and "church choir" all leak.
  - **Sexual orientation / gender reassignment**: "Gay", "Lesbian", "Bisexual", "Trans", "Stonewall" and "Out in Tech" are not in the list (only LGBT*, Queer, Pride).
  - **Disability**: "deaf", "blind", "BSL", "hearing impaired", "chronic illness", "extenuating/mitigating circumstances" and "reasonable adjustments" are missing.
  - **Race**: ethnic programmes such as "SEO London", "Rare Recruitment", "upReach", "10,000 Black Interns" and "Black Professionals Scheme" (only "Black" + noun is caught) are missing, as are acronyms like "ACS" (African-Caribbean Society).
  - **Age**: "mature student" and GCSE/A-level years are kept. Years are needed by code, but the judge does not need school years.
- **Evidence**:
  - LLMs penalise disability-related content: "We find that GPT-4 exhibits prejudice towards these enhanced CVs" (Glazko et al. 2024, arXiv 2402.01732, A/B).
  - Name and identity bias is documented across models: Bloomberg 2024 found GPT-3.5 ranked Asian women's names top 17.2% of the time vs 7.6% for Black men, against a parity of 12.5% (Yin, Alba & Nicoletti, Bloomberg, Mar 2024, B; reanalysis disputes its significance, interviewing.io, C).
  - An et al. 2025 (*PNAS Nexus* 4(3) pgaf089, A): "many models are biased against black male candidates."
- **Fix**:
  1. Extend CORES with the terms above, using the same `[SOCIETY]`/`[AWARD]` placeholder logic and keeping the role and number.
  2. Add T3 (gendered terms), T7 (languages) and T10 (gaps) as gated redaction tests.
  3. Revisit Decision 3: redact "Women in X" in the *judge input only*. The "sector relevance" argument does not hold, because no rule scores membership of a specific society.

### 17. Hidden-text and injection defence misses the dominant real-world pattern, and a clean scan sends the raw PDF to a vision parser
- **Severity**: P1 · **Type**: implementation / security
- **Where**: `lib/cv/safety.ts:9-18, 79-91, 148-191`; `app/(app)/profile/build/actions.ts:56`; `lib/ai/parseCV.ts:11-13`
- **Current**: the lexicon has 9 English command patterns. White text is only detected on pages with no prior fill, and opacity, render mode 3, clipping, metadata and XMP are not checked. `textOnly` is only true when the scan flagged something, so an undetected payload (white-on-dark sidebar, low opacity, text inside an image) reaches the multimodal parser and then the judge via `structuredText`.
- **Evidence**:
  - The 03 doc (F15) reports that over 90% of injections "were hidden keywords or praise", not commands.
  - OWASP LLM01:2025 (B) lists a resume with split prompts and recommends "Segregate and identify external content".
  - Greshake et al. 2023 (arXiv 2302.12173, B): "LLM-Integrated Applications blur the line between data and instructions."
  - The 03 doc's own spec (§4.2) asks for opacity ≈ 0 and metadata/XMP checks.
- **Fix**:
  1. **Always** parse from the extracted text layer (`textOnly: true`). Use vision only as a fallback when the text layer is empty (image-only path), and then OCR with a visible-region check.
  2. Add checks for ExtGState `ca/CA < 0.1`, text render mode 3 on pages that also have a normal text layer, and XMP/metadata fields over 50 words.
  3. Add praise and keyword-dump heuristics, e.g. "excellent candidate", "perfect fit", "top 1%" outside bullets, or a run of 15+ comma-separated nouns that match the JD with no verbs.
  4. Validate `evidence_line` against the visible text only (already the case) **and** require entry-level rules to quote from the entry they concern.

### 18. Several LLM rules ask about things the judge cannot observe
- **Severity**: P1 · **Type**: implementation / validity
- **Where**:
  - `general.ts:86-88` G-10 (file name, which is never sent to the judge);
  - `general.ts:36-38` G-03 (header/footer position, which is lost in text extraction, and the name is redacted);
  - G-04 / GEN-02 (columns and tables, judged from linearised text);
  - `general.ts:78-80` G-09 (hidden text, which is stripped before the judge sees it)
- **Evidence**: construct validity requires the rater to have access to the evidence (*Standards* 2014, A). With fails allowed to carry a null evidence_line (`judgeCvRules.ts:92`), unobservable rules become free fails or free N/As depending on the model.
- **Fix**:
  - G-10: move to code. Pass `fileName` into `CvContext` from the upload and check `/final|v\d|copy|\(\d\)/i`. If the name is unknown, return N/A.
  - G-03: code, using pdf.js item y-positions; fail if email or phone only appears in the top or bottom 6% of the page, or inside a repeated per-page band.
  - G-04/GEN-02: code, using column detection (x-clustering of pdf.js items) plus the existing parse-order heuristic. Dedupe them into one rule.
  - G-09: delete it (ATS-HID-01 covers hidden text). Keep "pasted JD blocks" as code once JD context exists.

### 19. Rule statements and their checkers disagree
- **Severity**: P1 · **Type**: contradiction / implementation
- **Where**:
  - G-17 (`general.ts:140-141`) says "Nationality is optional; a right-to-work line is fine", but `checkers.ts:102-105` fails on `nationality`.
  - GEN-01 (`general.ts:310-312`) says "Put contact details first…", but its checker is `uk_personal_details`. It never checks contact order.
  - FCQ-03 (`finance.ts:35-36`) is about photos, with the `uk_personal_details` checker, which cannot see images.
  - SWE-09 (`tech.ts:79-81`) is "Group skills by category", with the `skill_rating_glyphs` checker.
  - DAT-06 (`tech.ts:184-185`) mentions Kaggle, Tableau Public, Streamlit and Hugging Face, but `checkers.ts:131-133` only matches `github|gitlab|.dev|.io|portfolio`, so "kaggle.com/…" fails.
  - RES-02 ("in detail: modules, dissertation…") only checks section order.
  - Code-rule `llmGuidance` severity tiers ("Bars/stars = major; ungrouped = minor") are ignored by code.
- **Fix**:
  - G-17: drop `nationality` from the regex. Its statement allows it, and the redactor already neutralises it for the judge.
  - GEN-01: switch to a new `contact_first` checker (email or phone within the first 15% of page-1 text).
  - FCQ-03: add a `photo_present` checker (pdf.js `paintImageXObject` in the top 30% of page 1, with an aspect ratio of 0.6–1.0).
  - SWE-09: add `skills_grouped` (≥ 2 skill groups or ≥ 2 labelled lines).
  - DAT-06: extend the regex with `kaggle\.com|public\.tableau\.com|streamlit\.app|huggingface\.co`.
  - RES-02: either add an LLM sub-question or re-state the rule as order only.
  - Remove severity prose from code-rule `llmGuidance`, or implement it as `params`.

### 20. The judge is not told the sector or year, though some LLM rules depend on them
- **Severity**: P2 · **Type**: implementation
- **Where**: `lib/ai/judgeCvRules.ts:44-56`; `lib/ai/prompts.ts:42`
- **Evidence**: guidance strings such as DAT-06 ("Major for data science/ML roles; minor for analyst roles") and CON-04 (year thresholds) assume context. The prompt says "UK graduate recruiter" generically. Ambiguous or conditional checklist items drive human–LLM disagreement (06 F8, arXiv 2608.20385, B).
- **Fix**: every LLM rule's question must be self-contained, with year-specific thresholds resolved in code before prompting (substitute `{threshold}`). Optionally add a line `Context: target sector <label>; year of study <year>` to the prompt, and add both to the cache key.

### 21. Passes need a quote but fails do not, so absence-fails can be invented
- **Severity**: P2 · **Type**: implementation
- **Where**: `judgeCvRules.ts:92-97`; `run.ts:93` (`unevidencedFails` stored but never surfaced)
- **Fix**: for "absence" fails, require the judge to return `searched_sections: string[]`. Code checks that those sections exist (or are empty) in the structured CV. If more than 30% of a run's LLM fails are unevidenced, mark the run low-confidence and show "provisional". Surface `unevidencedFails` in the reliability report.

### 22. Score bands are arbitrary, compressed at the top, and differ from the research doc
- **Severity**: P2 · **Type**: copy / unsupported
- **Where**: `lib/cv-score/present.ts:13-19` (<50 / 50–69 / 70–84 / ≥85) vs 06 R6 (0–39 / 40–59 / 60–79 / 80–100)
- **Evidence (computed)**: a consulting CV failing **half** of all LLM rules scores 75, which is "Strong". With about 80 rules each worth 0.1–4 pts, scores cluster at 70–95 unless a cap fires. So the bands carry little information, and the cliff caps dominate the bottom end. Feedback with low information content is the least effective kind (Wisniewski, Zierer & Hattie 2020, *Front. Psychol.* 10:3087, A).
- **Fix**: set band cut-offs from the gold-set distribution (quartiles of expert-labelled CVs), and document them in the model card. Until then, label bands by rule coverage ("Polished = all critical and ≥ 90% of major rules pass"), which is criterion-referenced and explainable.

### 23. The "does not predict interviews" disclaimer is hidden, and the score uses XP-style gamification
- **Severity**: P2 · **Type**: copy / psychology
- **Where**: `cv-score-panel.tsx:244-252` (disclaimer inside a collapsed `<details>`); `:86, 137` (`chip-xp` "+N pts"); `:210` (CountUp animation)
- **Evidence**:
  - Kluger & DeNisi (1996, *Psych. Bull.* 119:254, A): mean d = .41, but over a third of feedback interventions lowered performance, especially when attention shifts to the self.
  - Deci, Koestner & Ryan (1999, A): expected contingent rewards undermine intrinsic motivation.
  - The 06 doc (R6) asked for the sentence **under the ring**.
- **Fix**: render `disclaimer(sector)` visibly under the ring (12 px, muted). Restyle "+N pts" as a neutral grey "worth ~N" chip, not the XP chip. Keep CountUp, but put the next-fix card first on mobile as well (check the grid order at the small breakpoint).

### 24. No uncertainty is shown, and no model card exists
- **Severity**: P2 · **Type**: missing
- **Where**: `present.ts`; no model-card doc (grep for "model card" in app/components/docs only finds the research doc)
- **Evidence**: DSIT *Responsible AI in Recruitment* (25 Mar 2024, A): "Model cards should be produced by the developer of an AI system…". Bias audits "should be repeated at regular intervals".
- **Fix**:
  1. Add `docs/cv-score-model-card.md` covering model IDs per provider, prompt version and rules version, effective per-rule weights, test–retest SD per model, cross-model κ, fairness results, known gaps (this report), and intended use.
  2. Link it from "How this score works".
  3. Show "±SD" once measured.

### 25. "I disagree" records feedback but does nothing with it
- **Severity**: P2 · **Type**: missing
- **Where**: `components/cv-score/actions.ts:11-19`; `disagree-button.tsx:5`
- **Evidence**: DSIT (2024, A): "Where harms are identified through routes to contestability, appropriate redress should be made". The 06 doc's C13 asked to "let the student dismiss the rule".
- **Fix**:
  1. Dismissal: mark the rule `dismissed` for the (cv, sector). Recompute the total without it and show "N rules dismissed".
  2. Add `scripts/rule-disputes.ts`, which reports the dispute rate per rule. Any rule above 15% disputes (n ≥ 20) goes to the rule-review queue. This is the cheapest source of validity data.

### 26. Judge outputs and interim states are not covered by tests of score correctness
- **Severity**: P2 · **Type**: missing (tests)
- **Where**: `tests/cv-score/aggregate.test.ts` (10 cases)
- **Fix**: add these tests:
  1. Σ lostPoints = 100 − total when uncapped (property test, fast-check).
  2. The per-fix true gain matches lostPoints when uncapped and is computed exactly when capped.
  3. No two scored rules share a checker (#2).
  4. Batch 0 failure gives spelling = null (#4).
  5. N/A coercion (#1).
  6. Monotonicity: changing any result from fail to pass never lowers the total.
  7. Invariance: reordering rules or results does not change the total.

### 27. Local-model batching risks partial runs on typical student laptops
- **Severity**: P2 · **Type**: implementation
- **Where**: `judgeCvRules.ts:173-181`; `lib/ai/ollama.ts:18-35` (parallel = 1); `lib/ai/config.ts:83` (20 min)
- **Evidence**: about 45 LLM rules make 4 batches, each sending the CV twice (structured + raw). They queue in Ollama, but all 4 deadline timers start at `Promise.all`, so batches 3–4 can time out while still queued on a 4B CPU model. The result is partial and not cached, which repeats on every visit.
- **Fix**: start each batch's deadline when its Ollama slot is acquired (expose a hook from `withSlot`). For local providers, send only `structuredText` with line numbers and validate quotes against raw text, which roughly halves the prompt. Allow caching per batch so that completed batches persist.

### 28. Self-preference loop between the tailor and the judge is not separated in the score
- **Severity**: P2 · **Type**: fairness / validity
- **Where**: the tailor (`prompts.ts:84-110`) and the judge share the same provider. REPORT T15 found AI-style rewrites score 4–5 *lower* only because of the code cliché rule.
- **Evidence**: Xu et al. 2025 (arXiv 2509.00462, B): self-preference of "67% to 82%". Panickssery et al. 2024 (B).
- **Fix**: score tailored CVs with code rules plus a *different-family* judge when one is configured, or report the "after" score with the label "scored by the same AI that rewrote it". Run T15 live per provider.

### 29. The panel caveat and copy over-generalise sector screening
- **Severity**: P3 · **Type**: copy
- **Where**: `profiles.ts:32-37`
- **Fix**: add dates and sources inline ("as of 2026 cycle; PwC/Deloitte use forms and tests"). Owned by the cv-finance auditor for factual content. Flagged here for presentation only.

### 30. A whitespace-only re-export keeps its score, but a one-character fix re-rolls every verdict
- **Severity**: P3 · **Type**: UX
- **Where**: `cache.ts:9-11`
- **Fix**: covered by delta re-judging (#9). Until then, warn after an edit: "Your score was re-checked by the AI; small changes in other rules can come from AI variation (±N)."

---

## New rules / signals to add

| Id | Text | Severity | Pass / fail anchors | Source |
|---|---|---|---|---|
| SYS-COVERAGE (system signal, unscored) | "We could assess N of M rules." Total shown as provisional below 80% weighted coverage. | — | Pass: ≥ 80% of applicable weight assessed. Fail: <80%, so show a range. | *Standards* 2014 (reliability reporting); #1 |
| SYS-JUDGE-ID (signal) | Show the judge model and break history on model change. | — | — | Thakur et al. 2024; #10 |
| G-10c (code, replaces G-10) | File name has no draft markers. | minor/D | Pass: `Jane-Doe-CV.pdf`. Fail: `CV_final_v3(2).pdf`. N/A if unknown. | existing G-10 |
| G-03c (code, replaces G-03) | Email or phone appears in the page body, not only in a repeated header or footer band. | major/B | Pass: contact y in 6–94% of page height. Fail: only in the top or bottom 6% band repeated on every page. | existing G-03 citation |
| G-04c (code, merges G-04/GEN-02) | Single-column reading order. | major/A | Pass: one x-cluster of text starts per page. Fail: ≥ 2 clusters with ≥ 30% of lines each. | existing G-04 citations |
| FCQ-03c checker `photo_present` | No photo. | major/A | Fail: raster image in the top 30% of page 1 with an aspect ratio of 0.6–1.0 and an area > 1% of the page. | GS recruiter quote (existing) |
| CONTACT-FIRST checker | Contact details in the first 15% of page-1 text. | major/A | as stated | GEN-01 citations |
| ATS-HID-02 (code) | No low-opacity, render-mode-3-overlay or metadata keyword text. | critical/B | Fail: ExtGState ca < 0.1 on text; mode 3 text on a page with a normal text layer; XMP or keywords over 50 words. | 03 doc §4.2; OWASP LLM01 |
| ATS-INJ-02 (code) | No hidden praise or keyword dumps aimed at screeners. | critical/B | Fail: praise phrases ("perfect fit", "top candidate") outside bullets, or 15+ comma-separated nouns with no verb. | 03 doc F15 (over 90% non-command) |

## Rules to delete or downgrade

| Rule | Action | Reason |
|---|---|---|
| G-37 | Delete from scoring | "Always answer yes" padding, a false claim about university prestige, and a contradiction with G-17 (#14). |
| G-09 | Delete | Unobservable after stripping. Duplicates ATS-HID-01 (#18). |
| G-10, G-03, G-04/GEN-02 (llm) | Replace with code versions | The judge cannot observe them (#18). |
| Duplicate-checker rules (GEN-06, FCQ-05/MKT-07 vs G-25; GEN-04, FCQ-08, CON-04 vs G-22; FCQ-04, FIN-02, CON-01, QNT-12, SWE-15 vs G-32; FCQ-01, QNT-09, SWE-01, PRD-01, MKT-02, RES-01 vs G-11) | Collapse to one construct per sector, using the sector's strongest severity and the threshold `params` | #2 |
| Spelling cap (`aggregate.ts:66`) | Delete | Cliff unsupported by Sterkens et al. Input not deterministic (#3). |
| G-16 critical/D | Downgrade to major/D | The cap already enforces it. Critical with D evidence is inconsistent (#8). |

---

## Validation plan (concrete)

**Goal**: show (a) per-rule verdict validity against trained humans, (b) reliability within and across models, (c) convergent validity of the total against recruiter judgement, and (d) no adverse differential effect on protected-proxy variants. Until (a) and (b) pass, the UI should say "beta, not validated".

**1. Gold set (G-120)**
- 120 real, consented, redacted student CVs (UCL Careers partnership; 06 §5.9 already proposes it).
- Stratified across 8 sectors × 3 year bands (1st, penultimate, final/Master's) × 2 strata (home vs international or non-native English; Russell Group vs not). Target at least 10 per sector.
- Add 40 synthetic counterfactual pairs, built from 10 bases × T1/T3/T4/T7/T8/T9/T10/T13.
- Sample size: to estimate κ ≈ 0.6 with a 95% CI half-width ≤ 0.12 at prevalence 0.3, plan n ≈ 100–120 per rule (Sim & Wright 2005 approach). Rare-prevalence rules need targeted oversampling.

**2. Human labelling**
- Three raters per CV: two UK careers advisers and one early-careers recruiter.
- Raters see the same redacted text and the same rule question, pass/fail anchors and allowed statuses as the LLM.
- Each rater labels independently, and an adjudicated consensus becomes ground truth.
- Each rater also gives a holistic 1–7 "would invite to the next stage for <sector>" rating before seeing any rule.

**3. Metrics**
- **Per rule**: Cohen's κ (LLM vs consensus), Gwet's AC1 and PABAK, because most rules have skewed prevalence and κ is depressed by the Feinstein–Cicchetti paradox. Also report prevalence, sensitivity and specificity of "fail", and the human–human κ as the ceiling.
  - Gate: LLM–consensus AC1 ≥ 0.6 **and** at least (human–human κ − 0.1).
  - Rules failing the gate are rewritten, moved to code, or demoted to unscored "tips".
- **Totals**: ICC(2,1) absolute agreement between the LLM total and a "human-verdict total" (the same aggregation applied to consensus labels). Gate ≥ 0.75 (Koo & Li 2016, "good"). Add a Bland–Altman plot with limits of agreement.
- **Test–retest**: 10 runs per CV per model. Per-rule flip rate with a Wilson CI, Fleiss' κ across runs, total SD and SEM. Gate: SD ≤ 2 and the upper CI of the flip rate ≤ 10%.
- **Cross-model**: Claude Sonnet, Gemini Flash, Qwen 3.5 9B and 4B. Per-rule κ for each model vs consensus, and ICC across models for totals. A model below gate gets the "experimental" label, or stays off by default for scoring.
- **Convergent validity**: Spearman ρ between the total and the mean holistic recruiter rating, per sector. Expect only a moderate ρ (0.3–0.5), because the score measures conventions, not the candidate. Publish it either way. Also test discriminant validity: ρ with word count should be low (verbosity bias; Saito et al. 2023).
- **Fairness**: counterfactual pairs with 3 runs and the median. Equivalence test (TOST) with ±2-point bounds on the mean Δ. Per-rule McNemar for verdict flips. Report differential item functioning on the real-CV strata, by logistic regression of each rule verdict on the human consensus label plus stratum (flag rules where the stratum coefficient is significant after Holm correction).

**4. Process**
- Script it as `scripts/validate.ts`, producing `docs/research/validation/<date>-<model>.md`.
- Re-run on every `RULES_VERSION` or `PROMPT_VERSION` change for the changed rules, and in full each release.
- Feed `cv_feedback` dispute rates (#25) into rule review.

---

## Open questions

1. The exact wording in the ICO November 2024 PDF could not be extracted (binary PDF). The quotes here come from the Simmons & Simmons summary and should be checked against the ICO PDF.
2. The ICO's final ADM/profiling guidance after the 31 Mar–29 May 2026 consultation could not be confirmed as published. If it is, check whether a self-help score needs specific transparency wording.
3. The claim that Claude Sonnet 5.5 rejects `temperature` is taken from a code comment (`anthropic.ts:36`). It was not verified against current Anthropic docs.
4. The Bloomberg 2024 page returned 403. The figures come from secondary coverage and the GitHub repository listing. Its statistical significance is disputed (interviewing.io).
5. Is the panel's grid order correct on mobile (next-fix card before the ring)? Not verified without running the app (the brief forbids running it).
6. Cross-model differences are inferred from the design and the literature. They were not measured (no API calls were made).

## Sources

| # | Source | Grade |
|---|---|---|
| 1 | AERA/APA/NCME, *Standards for Educational and Psychological Testing* (2014), https://www.testingstandards.net/open-access-files.html | A |
| 2 | Equality Act 2010 s.4, https://www.legislation.gov.uk/ukpga/2010/15/section/4 | A |
| 3 | Equality Act 2010 s.19, https://www.legislation.gov.uk/ukpga/2010/15/section/19 | A |
| 4 | Equality Act 2010 s.29, https://www.legislation.gov.uk/ukpga/2010/15/section/29 | A |
| 5 | ICO, *AI tools in recruitment: audit outcomes report* (6 Nov 2024), https://ico.org.uk/media2/migrated/4031620/ai-in-recruitment-outcomes-report.pdf (text not extractable; see #6) | A |
| 6 | Simmons & Simmons, "AI in recruitment: the ICO lifts the curtain…" (2024), https://www.simmons-simmons.com/en/publications/cm6ye0gyw004otfm0oly7a0bd/ai-in-recruitment-the-ico-lifts-the-curtain-on-providers-of-ai-tools | B |
| 7 | ICO draft ADM/profiling guidance consultation (31 Mar 2026), coverage: https://www.insideprivacy.com/united-kingdom-2/uk-ico-consults-on-draft-automated-decision-making-guidance-and-sets-expectations-for-adm-in-recruitment/ | B |
| 8 | DSIT, *Responsible AI in Recruitment* (25 Mar 2024), https://www.gov.uk/government/publications/responsible-ai-in-recruitment-guide/responsible-ai-in-recruitment | A |
| 9 | Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B, https://arxiv.org/abs/2306.05685 | A |
| 10 | Wang et al., "Large Language Models are not Fair Evaluators" (2023), https://arxiv.org/abs/2305.17926 | B |
| 11 | Panickssery, Bowman & Feng, "LLM Evaluators Recognize and Favor Their Own Generations" (2024), https://arxiv.org/abs/2404.13076 | B |
| 12 | Saito et al., "Verbosity Bias in Preference Labeling by LLMs" (2023), https://arxiv.org/abs/2310.10076 | B |
| 13 | Thakur et al., "Judging the Judges" (2024), https://arxiv.org/abs/2406.12624 | B |
| 14 | Schroeder & Wood-Doughty, "Can You Trust LLM Judgments?" (2024), https://arxiv.org/abs/2412.12509 | B |
| 15 | Atil et al., "Non-Determinism of 'Deterministic' LLM Settings" (2024), https://arxiv.org/abs/2408.04667 | B |
| 16 | Lee et al., CheckEval, EMNLP 2025, https://arxiv.org/abs/2403.18771 | A/B |
| 17 | Shankar et al., "Who Validates the Validators?" (2024), https://arxiv.org/abs/2404.12272 | B |
| 18 | Google, Gemini 3 developer guide (temperature 1.0 recommendation), https://ai.google.dev/gemini-api/docs/gemini-3 | B |
| 19 | Ollama, "Structured outputs" blog (temperature 0 tip), https://ollama.com/blog/structured-outputs | C |
| 20 | Yin, Alba & Nicoletti, "OpenAI's GPT Is a Recruiter's Dream Tool. Tests Show There's Racial Bias", Bloomberg (Mar 2024), https://www.bloomberg.com/graphics/2024-openai-gpt-hiring-racial-discrimination/ (repo: https://github.com/BloombergGraphics/2024-openai-gpt-hiring-racial-discrimination) | B |
| 21 | interviewing.io, "Refuting Bloomberg's analysis", https://interviewing.io/blog/refuting-bloombergs-analysis-chatgpt-isnt-racist | C |
| 22 | Armstrong, Liu, MacNeil & Metaxa, "The Silicon Ceiling" (2024), https://arxiv.org/abs/2405.04412 | B |
| 23 | Wilson & Caliskan, "Gender, Race, and Intersectional Bias in Resume Screening via Language Model Retrieval", AIES 2024, https://arxiv.org/abs/2407.20371 | A |
| 24 | An, Huang, Lin & Tai, *PNAS Nexus* 4(3) pgaf089 (2025), https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8071848 | A |
| 25 | Rozado, "Gender and Positional Biases in LLM-Based Hiring Decisions" (2025), https://arxiv.org/abs/2505.17049 | B |
| 26 | Gaebler, Goel, Huq & Tambe, "Auditing the Use of Language Models to Guide Hiring Decisions" (2024), https://arxiv.org/abs/2404.03086 | B |
| 27 | Glazko et al., "Identifying and Improving Disability Bias in GPT-Based Resume Screening" (FAccT 2024), https://arxiv.org/abs/2402.01732 | A/B |
| 28 | Xu, Li & Jiang, "AI Self-preferencing in Algorithmic Hiring" (2025), https://arxiv.org/abs/2509.00462 | B |
| 29 | Tamkin et al., "Evaluating and Mitigating Discrimination in Language Model Decisions" (2023), https://arxiv.org/abs/2312.03689 | B |
| 30 | Liang et al., "GPT detectors are biased against non-native English writers", *Patterns* (2023), https://arxiv.org/abs/2304.02819 | A |
| 31 | Greshake et al., "Not what you've signed up for… Indirect Prompt Injection" (2023), https://arxiv.org/abs/2302.12173 | B |
| 32 | OWASP GenAI, LLM01:2025 Prompt Injection, https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | B |
| 33 | Sterkens et al., "Costly mistakes: why and when spelling errors in resumes jeopardise interview chances", *PLOS ONE* 18(4) e0283280 (2023), https://pmc.ncbi.nlm.nih.gov/articles/PMC10075394/ | A |
| 34 | Kluger & DeNisi, "The effects of feedback interventions on performance", *Psychological Bulletin* 119(2) 254–284 (1996), https://doi.org/10.1037/0033-2909.119.2.254 (abstract: https://scholars.huji.ac.il/node/1802) | A |
| 35 | Hattie & Timperley, "The Power of Feedback", *Review of Educational Research* 77(1) (2007), https://doi.org/10.3102/003465430298487 | A |
| 36 | Wisniewski, Zierer & Hattie, *Frontiers in Psychology* 10:3087 (2020), https://doi.org/10.3389/fpsyg.2019.03087 | A |
| 37 | Deci, Koestner & Ryan, *Psychological Bulletin* 125(6) (1999), https://doi.org/10.1037/0033-2909.125.6.627 | A |
| 38 | Koo & Li, ICC guideline, *J Chiropractic Medicine* 15(2) (2016), https://doi.org/10.1016/j.jcm.2016.02.012 | A |
| 39 | Feinstein & Cicchetti (1990), kappa paradoxes, discussed in "High Agreement and High Prevalence: The Paradox of Cohen's Kappa", https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5712640/ | A |
| 40 | Wongpakaran et al., Gwet's AC1 vs κ, *BMC Med Res Methodol* 13:61 (2013), https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/1471-2288-13-61 | A |
| 41 | Di Stasio & Heath, CSI/GEMM, "Are employers in Britain discriminating against ethnic minorities?" (Jan 2019), https://www.nuffield.ox.ac.uk/news-events/news/new-csi-report-on-ethnic-minority-job-discrimination/ | A |
| 42 | Dawes, "The robust beauty of improper linear models", *American Psychologist* 34(7) (1979), https://doi.org/10.1037/0003-066X.34.7.571 (cited from knowledge; not re-opened) | A |
| 43 | Internal: docs/research/market-2026/06-scoring-validity-fairness.md; 03-ats-ai-screening.md; tests/fairness/REPORT.md | D |
