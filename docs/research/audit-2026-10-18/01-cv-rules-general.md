# General CV scoring rules audit (sector-agnostic UK conventions)

Auditor 01 · 2026-10-18 · Scope: `docs/research/cv-rules-general.md`, `lib/cv-rules/rules/{general,amendments,sources}.ts`, `lib/cv-rules/{myths,profiles,types}.ts`, `lib/cv/cliches.ts`, plus the code that runs them (`lib/cv-score/{checkers,aggregate,run,pii}.ts`, `lib/ai/judgeCvRules.ts`, `lib/ai/prompts.ts`). Context from `market-2026/02` and `03`.

**Executive verdict: C+.**
1. The research doc is unusually honest about evidence quality. Most of its *conventions* (≤2 pages, no photo or DOB, reverse chronological order, action verbs, ≤150-word optional profile) match what UK careers services say in 2025–26.
2. The shipped scorer is less sound than the doc. The same checker runs under 2–3 rule IDs (G-/GEN-/FCQ-), so a single issue is penalised two or three times. That also defeats the only year adjustment that exists (GEN-04).
3. Two code checkers are wrong in ways that fall on specific groups. `uk_personal_details` fails anyone who writes "Nationality", even though the rule says nationality is optional. `uk_grades` fails every Master's grade (Distinction/Merit), every international GPA, and Lower Second/Third.
4. Several statistics are stale or misdated. The "48% need a 2:1 (2024)" figure is actually from the ISE 2022 survey. Key evidence citations (Ladders, Frontiers, Sterkens) are described more strongly than their method supports.
5. Around six LLM rules ask the judge about things it never receives (file name, fonts, file type, header/footer position, link liveness), and one "rule" (G-37) is a system guardrail that is scored. These add noise or free points.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality | B− | The doc grades honestly. But code grades drift (e.g. G-12 "D" vs GEN-10 "A" for the same rule), and Ladders/Frontiers are over-read. |
| Freshness | C | ISE entry-requirement figures are from 2022 but labelled 2024. The ISE Oct 2025 numbers, the Graduate route cut (Jan 2027) and Workday's LLM grading (Aug 2026) are missing from rules and myths. |
| Coverage | C+ | Core conventions are covered. Missing: right-to-work guidance, Master's/international grade formats, template-placeholder detection, duration salience, year-aware length. |
| Implementation fidelity | D+ | Duplicate checkers, statement↔checker mismatches (GEN-01, G-16, G-17, EV-01, G-06), rule params ignored (AU-01), unassessable LLM rules, a scored guardrail. |
| Consistency | C− | G-19 says ≤150 words but GEN-08 and its checker say 2–3 lines / 400 chars. AU-03 penalises the Education-first order that G-13 and G-33 recommend. M3 says PDF is always fine; Prospects (2025) says it isn't always. |
| UX / copy | C | Several statements overclaim ("ATS can't read images" is fine, "two typos cut interview chances by 7 points" is not). G-32 copy implies 2:2 students should hide their grade, while the checker fails them if they do. |

## Findings

### 1. `uk_personal_details` fails "Nationality" lines and module names, contradicting the rule's own text, and the penalty is applied 2–3 times
- **Severity**: P0 · **Type**: fairness / implementation / contradiction
- **Where**: `lib/cv-score/checkers.ts:102-105`. Used by `G-17` (`general.ts:140`), `GEN-01` (`general.ts:310`) and `FCQ-03` (`finance.ts:35`). The test `tests/cv-score/checkers.test.ts:39` locks the behaviour in.
- **Current**: the regex `/(date of birth|d\.o\.b\.?|\bdob\b|marital status|nationality|\bage:\s*\d{2})/i` produces a fail with the fix "Remove date of birth, age, nationality and marital status — UK employers don't want them." G-17's statement says "Nationality is optional; a right-to-work line is fine."
- **Evidence**: I ran the regex. It flags "Nationality: British" and "Modules: Nationality and Citizenship Law". It does **not** flag "Gender: Female", "Religion: Muslim", "Married", "Age 19", or a photo. So it penalises the one item UK sources disagree on and misses the items they agree on.
  - (B) University of Manchester Careers, "Creating your CV" (current): "Nationality is optional but it is good to mention the countries in which you have worked and studied." https://www.careers.manchester.ac.uk/applicationsinterviews/cv/step1creatingyourcv/
  - (B) National Careers Service, "CV sections": "You should not include your age, your date of birth, whether you're married or your nationality." https://nationalcareers.service.gov.uk/careers-advice/cv-sections
  - (B) Warwick Careers: UK CVs "shouldn't include date of birth, marital status, gender, nationality, or a photograph." https://warwick.ac.uk/services/careers/applications/cvs/
  - Nationality falls under race in the Equality Act 2010 (s.9). A scorer that marks down international students, who are the most likely to write it, for an item one Russell Group careers service calls optional is a fairness risk. Finance students lose this in the UK dimension, which is weighted 20 for finance, three times over.
- **Fix**:
  1. Split the checker. `uk_personal_details` (major) should match `\b(date of birth|d\.?o\.?b\.?|age:\s*\d{2}|\d{2}\s*years old|marital status|married|single|divorced|gender:|sex:|religion:|religious|ethnicity:)\b` and only within the first 25% of page 1 or in a "Personal details" block, so module names don't match.
  2. Add a new **tip-only** check `nationality_tip` that is never scored. Copy: "Nationality is optional on a UK CV. If you need sponsorship information on there, a right-to-work line is clearer: 'Right to work: Graduate visa (no sponsorship needed until 2029)'."
  3. Add photo detection: a PDF embedded image ≥ 2 cm² in the top 30% of page 1. That is a reliable signal the text checker can't give.
  4. Run each checker **once per CV**. See Finding 3.
  5. Update the test to assert that nationality is *not* failed.

### 2. `uk_grades` fails every Master's grade, international GPAs, Lower Second and Third, and the G-32 copy pushes 2:2 students to hide their grade
- **Severity**: P0 · **Type**: wrong / fairness / copy
- **Where**: `checkers.ts:126-130`. Used by `G-32` (`general.ts:256`), `FCQ-04` (critical), `FIN-02`, `QNT-12`, `CON-01` (critical), `SWE-15`.
- **Current**: regex test results: "MSc Finance, Distinction" FAIL; "MSc Data Science (Merit)" FAIL; "GPA 3.8/4.0" FAIL; "CGPA 8.9/10" FAIL; "Lower Second Class Honours" FAIL; "Third Class Honours" FAIL; "First place in UKMT challenge" PASS (a false pass). The G-32 statement reads: "State your grade if it's a 2:1 or above, or predicted 2:1".
- **Evidence**:
  - (B) TARGETjobs, "How long should a CV be… FAQs" (12 Aug 2026): "Don't be put off stating your 2.2 qualification in your CV", because "many employers now set this as their academic requirement." https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/how-long-should-cv-be-graduate-jobs-and-other-cv-faqs-answered
  - (B) ISE via Prospects Luminate (Oct 2025): "47% require a 2:1 degree, and 20% accept a 2:2", with no minimum at 23%. https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards
  - The code's own comment says the grade rule rewards stating a grade, not its level. As written, it fails Master's students (UK Distinction/Merit is standard) and international students (GPA/CGPA). A student who follows the copy and hides a 2:2 also fails.
- **Fix**:
  1. Regex: add `distinction|merit|\bpass\b(?=\s*(with|\(|$))|lower second|\bthird\b(?=[- ]class)|\b2:2\b|\bgpa\b\s*[\d.]+|\bcgpa\b|\b\d(\.\d{1,2})?\s*\/\s*(4|4\.0|5|10)\b|on track for|expected (grade|classification)`.
  2. Count `first` only as `first[- ]class|\bfirst\b(?=\s*(class|\(|,|$))`.
  3. New statement: "Show your degree result or your current average/predicted grade — including a 2:2 or an international GPA (name the scale, e.g. 'GPA 3.7/4.0'). One in five large UK employers accept a 2:2, and a missing grade is usually read as a low one."
  4. Keep the rule "never give extra credit for a higher grade".

### 3. The same checker runs under 2–3 rule IDs, multiplying penalties and cancelling the year adjustment
- **Severity**: P1 · **Type**: implementation
- **Where**: `general.ts`: G-22/GEN-04 (`quantified_bullets`), G-25/GEN-06 (`spelling`), G-17/GEN-01 (`uk_personal_details`). For finance these become three IDs each (FCQ-05, FCQ-08, FCQ-03, FCQ-04 + G-32 + FIN-02). LLM pairs: G-12/GEN-10, G-20+G-21/GEN-03, G-30/GEN-05, G-04/GEN-02, G-29/GEN-07, G-36/GEN-09/AU-01, G-27/GEN-12, G-19/GEN-08. Aggregation is in `aggregate.ts:43-58`.
- **Current**: GEN-04 relaxes the quantification threshold to 0.2 for first-years, but G-22 (`params: {threshold: 0.4}`, no `yearAdjust`) still fails the same first-year at 0.4. Spelling counts three times (G-25 critical A = weight 3.0, GEN-06 major B = 1.7, plus the score cap at `aggregate.ts:66`).
- **Evidence**: arithmetic from `aggregate.ts` (weight = `SEV × EVID`). One missed quantification share for a finance first-year costs G-22 (0.8) + GEN-04 (1.2 → passes at 0.2) + FCQ-08 (2.0) within impact. The first-year relief therefore covers 1.2 of 4.0 weight units, about 30%.
- **Fix**:
  1. Merge into one canonical rule per behaviour. Keep the G- id and move the GEN- citations into it. Sector files should *override* severity or params through `sectorAdjust`, not add new IDs.
  2. Add a build-time test: `new Set(rulesFor(s).filter(r=>r.check==='code').map(r=>r.checker+JSON.stringify(r.params))).size === count` for each sector.
  3. Delete GEN-01, GEN-03, GEN-04 (after moving `yearAdjust` to G-22), GEN-05, GEN-06, GEN-07, GEN-08, GEN-09, GEN-10, GEN-12 once merged.

### 4. G-37 (fairness guardrail) is scored as a rule: "Always answer yes" but a pass needs a quoted CV line
- **Severity**: P1 · **Type**: implementation
- **Where**: `general.ts:300-306`; `judgeCvRules.ts:80-104` (pass needs `evidence_line` that is a substring of the CV).
- **Current**: llmGuidance reads "Always answer yes; this is a system guardrail." Severity minor, evidence A, so it carries weight 1.0 in the UK dimension.
- **Evidence**: the judge either quotes a random CV line, giving a free "pass" that inflates the UK dimension and the "rules passed X/Y" count, or returns no quote. With no quote the verdict becomes `could_not_assess` and adds to the reliability counter the user sees. Either way the result says nothing. The guardrail itself is real and is enforced elsewhere (`pii.ts`, `JUDGE_FAIRNESS_GUARD`, `tests/fairness/`).
- **Fix**: remove G-37 from `GENERAL_RULES`. Keep it as documentation in a `SYSTEM_GUARDRAILS` constant shown on the methodology page. Keep the counterfactual name-swap test in `tests/fairness/score.test.ts` as the enforcement.

### 5. The spelling gate is harsher than its evidence, and LLM-detected "errors" carry fairness risk
- **Severity**: P1 · **Type**: unsupported / fairness / copy
- **Where**: `G-25` (`general.ts:200`, critical, A), `GEN-06`, the cap at `aggregate.ts:66` (≥3 errors caps the total at 50), the spelling list from the LLM (`judgeCvRules.ts:111`, `prompts.ts:51`), and M6.
- **Current**: "In a study of 445 recruiters, two typos cut interview chances by about 7 points and five typos by about 19."
- **Evidence**: (A) Sterkens et al. 2023, *PLOS ONE*, https://pmc.ncbi.nlm.nih.gov/articles/PMC10075394/
  - It was a hypothetical vignette survey of 445 Flemish HR professionals in 2020, with **Dutch** errors, mostly "dt-rule" verb conjugations.
  - The authors: "the hypothetical nature of participants' decisions is our methodology's main limitation."
  - Conditions were 0, 2 or 5 errors. There was **no 3-error condition**, so a cap at 3 has no grounding in the study.
  - The direction is credible, and Wiles/van Inwegen et al. 2025 is field evidence on writing quality generally. But the spelling list comes from an LLM, and non-English names, society names and place names (Turkish, Chinese, Nigerian) are the likeliest false positives. That puts the 50-cap disproportionately on international students.
- **Fix**:
  1. Detect candidates with a deterministic en-GB dictionary (Hunspell/nspell) and use the LLM only to *confirm*. Never let the LLM add words the dictionary accepts.
  2. Show the flagged words with a one-click "This is a name/term" dismissal that is stored per user.
  3. Move the cap to ≥5 *confirmed* errors (the study's high condition). 1–2 errors = partial, 3–4 = fail with no cap.
  4. Copy: "In a Belgian experiment, recruiters were about 7 percentage points less likely to invite a graduate with two spelling errors, and about 19 points less with five."
  5. Keep one spelling rule only (Finding 3).

### 6. AU-03 "read time" penalises the Education-first layout that G-13 and G-33 recommend
- **Severity**: P1 · **Type**: contradiction / implementation
- **Where**: `amendments.ts:53-58`; `checkers.ts:204-225`; `G-13` (`general.ts:109`), `G-33` (`general.ts:262`).
- **Current**: the checker passes only if the name, latest role title, latest role dates **and** education institution all appear in the first third (by characters) of page 1.
- **Evidence**:
  - (B) NCS, "CV sections": put education first early in your career.
  - (B) Prospects (May 2025): experience before education only "If you have plenty of relevant work experience."
  - A student who follows G-13 (Education first) and G-33 (A-levels with grades, GCSE summary, plus modules) pushes the first experience entry below the top third, and AU-03 then fails. The 02 report's own evidence for the rule (Kristal et al. 2022) is about making *experience* salient for experienced workers with gaps, not students.
- **Fix**: pass when the name plus the *first section's* first entry (education or experience) plus at least one date appear in the top third. Add the latest role only when the CV puts experience first. Downgrade to a tip for 1st/2nd years (`yearAdjust: {"1st": {skip: true}, "2nd": {severity: "minor"}}`).

### 7. ISE entry-requirement statistics are misdated and stale
- **Severity**: P1 · **Type**: stale / wrong
- **Where**: `cv-rules-general.md:36, 263, 315`; `sources.ts:36` (`THE_ISE_2024`); M7 (`myths.ts:50-55`); G-32 citations.
- **Current**: "48% of ISE employers required a 2:1 minimum in 2024 (57% in 2021)… 26% had no minimum."
- **Evidence**:
  - (B) The cited THE article (`/node/724569`) is dated **1 Dec 2022** and reports the ISE **2022** survey (48% 2:1, ~20% 2:2, 13% UCAS, 26% no minimum). https://www.timeshighereducation.com/node/724569
  - Newer: (B) Isherwood/ISE, Prospects Luminate (Oct 2025): "2:1 requirement: 71% (2015/2016) vs. 47% (2024/2025)"; no minimum 23%; specific A-level grades 13% (from 26%); the decline is "plateauing". https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards
  - I could not find the "57% in 2021" figure in either source.
- **Fix**: rename the citation to `THE_ISE_2022` with title "…(ISE Student Recruitment Survey 2022)". Add `ISE_LUMINATE_2025` (already in `sources.ts` as `F_S32`) to G-32, G-33 and M7. M7 verdict: "47% of large UK graduate employers required a 2:1 in 2024/25 (71% in 2015/16); 20% accept a 2:2 and 23% set no minimum."

### 8. GEN-01 statement and checker don't match, and G-16/G-17/EV-01/G-06 claim more than their checkers test
- **Severity**: P1 · **Type**: implementation / copy
- **Where**:
  - `GEN-01` (`general.ts:310`): statement about contact details first, checker `uk_personal_details`.
  - `G-16` (`:135`): claims town/city + LinkedIn + professional email; `contact_present` checks only email and phone.
  - `G-17`: claims photo, gender, religion; the checker detects none (Finding 1).
  - `EV-01` (`amendments.ts:17`): "volunteering or a society role all count"; `experience_present` (`checkers.ts:180`) checks only `cv.experience`, so society roles parsed into `leadership` fail.
  - `G-06` (`:57`, evidence A): "standard section headings"; `section_headings` (`checkers.ts:90`) checks only whether education, experience/projects and skills sections were *parsed*, never the heading text.
- **Current**: users get a fail for something different from what the statement says, or a pass for something that wasn't checked.
- **Evidence**: code reading (see the line refs). EV-01 is the most harmful. First-years whose only experience is a society or volunteering role, which is common for students without family networks, get "Add any experience" even though G-34 and the 02 report (Baert & Vujić 2021) count volunteering as experience.
- **Fix**:
  - `experience_present` should count `experience ∪ leadership ∪ projects`-with-dates.
  - `contact_present` adds a town/city check (a UK postcode area or a known-city gazetteer in the first 300 chars) and a professional-email heuristic (doc G-16: `/(babe|sexy|420|69|xx)/` or 6+ digit runs → minor).
  - `section_headings` matches the raw heading lines against a synonym dictionary and flags "My Journey"-style headings.
  - Delete GEN-01 (Finding 3).

### 9. G-09 "keyword stuffing" is critical, judged by the LLM, and can fire on a legitimate skills line; it duplicates ATS-HID-01
- **Severity**: P1 · **Type**: implementation / severity
- **Where**: `general.ts:78-84`; `amendments.ts:62`.
- **Current**: critical, evidence D. Fail example: "Keywords: stakeholder management agile synergy leadership Python SQL Excel communication teamwork". Pass example: "Skills: Python, SQL, Tableau (used in the projects below)".
- **Evidence**: the boundary between a dense skills list and "an uncontextualised list of job-advert terms" is a judgement call. The judge is not shown the JD when scoring generically, so it can't test "copied from a job description". A *critical* rule with evidence D and a subjective trigger is the worst combination for false positives. Hidden text is already covered by the deterministic ATS-HID-01 (critical, blocks export).
- **Fix**: make G-09 code-only: (a) a ≥25-token verbatim overlap with the JD when one is supplied, or (b) a line with ≥12 comma/space-separated items under a heading matching `/keywords?|key terms/i`. Severity major. Remove the hidden-text wording (ATS-HID-01 owns it).

### 10. Evidence grades differ for identical rules, and careers-page conventions are graded "A"
- **Severity**: P1 · **Type**: implementation / consistency
- **Where**: G-12 (D) vs GEN-10 (**A**), both reverse chronological. G-25 (A, critical) vs GEN-06 (B, major). G-04 (A) vs GEN-02 (B). G-06 (A), whose checker doesn't test headings. GEN-01 (A, citing a TARGETjobs guide and a Prospects example CV). GEN-05 (A). `EVID` in `aggregate.ts:7` (A=1, D=0.4) makes this a 2.5× weight difference.
- **Evidence**: the brief's own hierarchy puts careers-service pages at B. Without an experiment or a vendor-documented mechanism, a convention is D ("consensus-only") by the doc's own §0 definition.
- **Fix**: re-grade GEN-10 to D (then merge into G-12), GEN-01 to B, GEN-05 to B, and G-06 to B for the human-reader effect (A only for a heading-*text* parse check once implemented). Add a unit test: rules with the same `checker` and the same intent must share `evidence`.

### 11. Six LLM rules ask about inputs the judge never receives
- **Severity**: P2 · **Type**: implementation
- **Where**:
  - `G-10` (file name), `GEN-11` (file type), `G-28` (font and size): the judge gets only `redactedText` and `structuredText` (`pii.ts:103-108`).
  - `G-03` (header/footer/text box): flattened text loses position, and contact details are redacted to placeholders.
  - `G-35` (links "live"): links reduced to `[link: linkedin.com]` (`pii.ts:37-40`).
  - `G-15` (name as title): the name is redacted.
- **Current**: the guidance includes "(Not applicable if the file name is unknown.)", "(Not applicable if font metadata is unavailable.)". It is *always* unavailable.
- **Evidence**: code. The best case is a permanent `not_applicable` (dead rules shown to users as "rules we check"). The worst case is a hallucinated pass or fail with a random quote.
- **Fix**: make them code checks using upload metadata that already exists at upload time.
  - G-10: regex on the original file name, `/(final|v\d|copy|\(\d\)|untitled|document\d*)/i`.
  - GEN-11: MIME/extension.
  - G-28: font names and sizes from pdf.js `textContent.styles` and `transform`. Body median < 9.5pt → major. Novelty font list (Comic Sans, Papyrus, script fonts) → major.
  - G-03: email/phone y-coordinate inside the top or bottom 6% band on 2+ pages, or DOCX header/footer XML.
  - G-35: HTTP HEAD with a timeout plus a `linkedin.com/in/` format check.
  - Until then, drop them from `rulesFor()`.

### 12. M13 and AU-03 use the Frontiers study as evidence of a "30-second first screen", but the 30 seconds came from the study design
- **Severity**: P2 · **Type**: unsupported / copy
- **Where**: `myths.ts:93-99` (M13); `amendments.ts:55` (AU-03 statement); `sources.ts:129`.
- **Current**: "Better estimates put the first screen at about 30 seconds (median 31 s across ~2,200 judgements)…" citing interviewing.io and Osanami Törngren et al. (graded A in the 02 report).
- **Evidence**:
  - (A, small n) Osanami Törngren et al. 2024, *Frontiers in Sociology*: 40 Swedish recruiters, each "rated 10 fictitious entry-level economist CVs in 5 minutes". The ~30 s/CV is the protocol's time budget, not an observed behaviour. CVs carried photos (Swedish convention). https://www.frontiersin.org/journals/sociology/articles/10.3389/fsoc.2024.1222850/full
  - (C) interviewing.io: 76 technical recruiters judging *experienced engineers* on its platform, median 31 s. The authors have a commercial interest and "haven't proven causality". https://interviewing.io/blog/are-recruiters-better-than-a-coin-flip-at-judging-resumes
- **Fix**: M13 copy: "The '6 seconds' figure comes from a commercial study. One recruiter dataset (experienced engineers, US tech) found a median of about 30 seconds. Either way the first look is short and focuses on titles, organisations, dates and education." Remove Frontiers as evidence for duration. Keep it only for "longer dwell didn't predict higher ratings". Merge M2 and M13 (they are the same myth).

### 13. Ladders 2012 is a marketing document and is cited as evidence for four rules and two myths
- **Severity**: P2 · **Type**: unsupported
- **Where**: `LADDERS_2012` (G-14), `HRDIVE_LADDERS_2018` (G-04, G-23), M2, M8 (photos), M13; doc §2 G-17 note ("profile photos took about 19% of recruiter fixation time").
- **Evidence**: (D) I read the PDF (https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf). It reports 30 recruiters over a 10-week period. The 19% photo figure is about **LinkedIn profiles versus TheLadders' own profile pages** (and claims a "55% improvement in readability over LinkedIn"). Professionally rewritten résumés were rated 6.2 vs 3.9 for self-written ones. It closes with "Click here to learn more about TheLadders resume re-writing services". So it is advertising, not evidence about CV photos.
- **Fix**: drop Ladders from G-04 and G-23 (Greenhouse plus careers services suffice) and from M8. Keep it in G-14 only with the label "(commercial, method unpublished)". M8 should rest on UK convention plus the bias rationale: (B) Manchester: "It is not usual practice to use a photograph on a UK CV"; (B) LSE: "UK employers don't typically want a photo"; (A) GEMM/Nuffield CSI 2019 on ethnic penalties in UK callbacks.

### 14. M3 and GEN-11 overstate "PDF is safe"; UK careers advice and Prospects (2025) still hedge
- **Severity**: P2 · **Type**: contradiction / copy
- **Where**: `myths.ts:22-28` (M3 "False for major ATS… Lever, iCIMS…"); `GEN-11` (`general.ts:382`, "Send your CV as a PDF unless the employer asks for a different format").
- **Evidence**:
  - (B) Prospects, "How to write a CV" (May 2025): "Not all ATS' are compatible with a PDF. Check to see which file format you'll need." https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/how-to-write-a-cv
  - (B) Sheffield: "Submit your CV as a Word document (.doc), text (.txt) or rich text (.rtf) file." https://sheffield.ac.uk/careers/support/apply/applications/tracking-systems
  - (B) Manchester: "Using a word document is often the best way to help an ATS."
  - (B) Oxford Careers (search snippet) recommends saving as PDF.
  - (A) Greenhouse contrasts images with documents "such as a .docx or .pdf".
  - The iCIMS and Lever PDF support is marked unverified in `sources.ts` itself.
- **Fix**: M3 verdict: "Mostly false. Greenhouse, Workday and Taleo document PDF support; a few older systems and some UK careers services still prefer Word. Use whatever the advert asks for; otherwise a text-based PDF or DOCX are both fine." GEN-11: "Use the format the employer asks for; otherwise a text-based PDF or DOCX." Remove "Lever, iCIMS" from the verdict until verified.

### 15. Profile length rules contradict each other (G-19 vs GEN-08 vs `summary_length`)
- **Severity**: P2 · **Type**: contradiction
- **Where**: `G-19` (`general.ts:155`: "under about 150 words (3–6 lines)"); `GEN-08` (`:360`: "keep it to 2–3 lines"); `summary_length` checker (`checkers.ts:149`: >400 characters ≈ 60–70 words → partial, fix "Cut your profile to two lines").
- **Evidence**:
  - (B) Prospects personal-statement guide (May 2025): "should be no longer than 150 words"; first or third person both acceptable; optional. https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/writing-a-personal-statement-for-your-cv
  - (B) Manchester: "brief 3-6 lines".
  - (B) TARGETjobs (Jun 2023): most graduates "should remove their personal statements" unless they can't send a cover letter. https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/are-personal-statements-waste-space-graduate-cvs
  - So a 100-word profile passes G-19 and fails GEN-08.
- **Fix**: one rule. Pass at ≤ 100 words (≈ 4 lines at 10–11pt). Partial at 101–150. Fail above 150. Never fail a missing profile. The checker counts words, not characters. Delete GEN-08.

### 16. G-11 length: no year adjustment, and the doc's fill-ratio logic isn't implemented
- **Severity**: P2 · **Type**: implementation / missing
- **Where**: `G-11` (`general.ts:96`, `maxPages: 2`); `page_count` (`checkers.ts:84-89`); doc §2 G-11 scoring ("2 pages with a mostly empty page 2 (<25% filled) = minor").
- **Evidence**:
  - (B) LSE Careers: "Finance CVs are typically one-page, other sectors will often be happy with two… if you can get the relevant experience on one page, do so." https://info.lse.ac.uk/current-students/careers/information-and-resources/application-process/cvs
  - (B) Warwick: finance and consulting "often like to see a concise 1 page CV", law and engineering "generally want a 2 page document".
  - (B) Oxford (snippet): one or two pages; investment banks expect one.
  - (B) TARGETjobs (Aug 2026): "maximum standard length for a graduate CV is two pages of A4".
  - (D) ResumeGo 2018 "2.3×" for two pages is vendor data (only 1.4× at entry level). https://www.resumego.net/research/one-or-two-page-resumes/
  - The conventions are right, but a first-year's 1.2-page CV passes G-11 silently.
- **Fix**: implement page-2 fill (`pageTexts[1]` chars / median full-page chars). < 25% filled → partial: "Condense to one page." Add `yearAdjust: {"1st": {...}, "2nd": {...}}` so that more than 1 page with < 60% page-2 fill → partial. Keep sector overrides.

### 17. `cliche_density` ignores the rule's params, counts em-dashes as an AI tell, and flags common legitimate words
- **Severity**: P2 · **Type**: implementation / unsupported / fairness
- **Where**: `AU-01` (`amendments.ts:40`, `params: {threshold: 1, majorThreshold: 3}`); `checkers.ts:226-232` calls `clicheDensity(c.text)` with no params; `cliches.ts:37` (`CLICHE_MAJOR_THRESHOLD = 2.5`); em-dash counting `cliches.ts:137-142`; lexicon `:49-81` ("innovative", "robust", "dynamic", "foster", "pivotal", "showcasing").
- **Evidence**:
  - The rule says 3, the code uses 2.5, so the params are dead.
  - There is no study showing em-dashes or these words mark a *CV* as AI-written. The closest evidence, (A) Kobak et al., *Science Advances* 2025 ("Delving into LLM-assisted writing…", https://arxiv.org/abs/2406.07016), finds *excess* frequency of style words like "delve" across 15M PubMed abstracts. That is a population-level signal, not a per-document detector.
  - The 02 report (F6) found international students more likely to be *suspected* of AI writing. A lexicon that includes ordinary formal-register words reproduces that bias. Placed's own rule statements use em-dashes.
  - The `AU-01` fail fix text also mentions "leverage", which the allowlist excuses in finance phrases.
- **Fix**:
  1. Pass `{minor: rule.params.threshold, major: rule.params.majorThreshold}` into `clicheDensity`, or delete the params.
  2. Drop em-dashes and "not only… but also" from the *score*, keeping them as tailoring-output warnings only.
  3. Keep only verbs/adjectives that are vague when they have no object (leveraged, spearheaded, synergy, passionate about, results-driven, proven track record, fast-paced environment, team player, detail-oriented, go-getter, delve, tapestry, "in today's … landscape").
  4. Count a buzzword only when no number or named entity appears in the same bullet.
  5. Label the rule "generic phrasing", never "AI-sounding", in copy.

### 18. `quantified_bullets` counts any digit
- **Severity**: P2 · **Type**: implementation
- **Where**: `checkers.ts:42-52, 106-115`; doc G-22 says "plus LLM to reject meaningless numbers (e.g. '1 year')".
- **Current**: "Year 2 group project", "Top 10 society", "COMP0002 coursework", "worked 1 day a week" all count as quantified.
- **Fix**: strip module codes `\b[A-Z]{3,4}\d{4}\b`, ordinal year phrases `\b(year|yr)\s*\d\b|\b\d(st|nd|rd|th)[- ]year\b`, and "\d+ (day|week|month|year)s?" when not preceded by "saved|cut|reduced|in". Require the number to sit next to a unit, %, £, ×, or a countable noun in the same clause. Add the 0.2/0.5 `yearAdjust` to G-22 (Finding 3).

### 19. G-34 mixes three rules, and its fail example contradicts its question
- **Severity**: P2 · **Type**: implementation / copy
- **Where**: `general.ts:271-278`.
- **Current**: the question asks "at least one extracurricular entry… with a role and an achievement?", but the fail example is "Interests: reading, travelling, socialising". A CV with good society entries and generic interests can be failed.
- **Evidence**:
  - (B) Prospects (2025): generic interests like "'Socialising'… and 'reading'" won't catch attention; "leave this section out" if none are relevant.
  - (B) TARGETjobs (Jun 2023) on interests: include only true, discussable interests. https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/what-put-further-interests-section-graduate-cv
  - (A) Rivera & Tilcsik 2016 supports the class-coded-hobby guard.
- **Fix**: split into G-34a "≥1 activity entry with role + outcome" (minor; major for 1st years with no experience) and G-34b "interests are specific or absent" (minor, code: the `generic_interests` checker already exists). Fail example for G-34a: "Member, Netball Club (no role, dates or outcome)".

### 20. G-30 and GEN-05 "without a JD, judge against the sector profile" is undefined
- **Severity**: P2 · **Type**: implementation
- **Where**: `general.ts:242, 340`.
- **Current**: "(Without a job description, judge against the chosen sector profile.)" No sector must-have list is passed to the judge (`buildJudgePrompt` sends only rules and CV).
- **Evidence**: code. The judge invents its own "must-haves", so the verdict is unstable across runs and models. That matters because 02 F7 shows LLM screeners flip 30–41% of decisions on presentation.
- **Fix**: when no JD is supplied, mark G-30 `not_applicable` and show "Add a job to check tailoring". Or pass an explicit 6–10 item sector skills list from `lib/cv-rules/profiles.ts` into the prompt as data.

### 21. Right-to-work guidance is missing, redacted from the judge, and the example will date after Jan 2027
- **Severity**: P2 · **Type**: missing
- **Where**: doc G-17 product note and open question 5; `pii.ts:97` (work authorisation redacted); no rule exists.
- **Evidence**:
  - (B) Graduate route cut to **18 months** for applications from 1 Jan 2027 (Loughborough ISAS; BUILA/PIE News). https://www.lboro.ac.uk/services/isas/visa-advice/grroute/ · https://www.buila.ac.uk/articles/shorter-graduate-route-from-january-2027-uk-govt-confirms
  - (C) Swansea student guide advises telling employers you are eligible to work.
  - I found no UK careers service that says to put it *on the CV*. Open question.
- **Fix**: add tip-only rule `G-RTW` (never scored, shown when the onboarding visa field is set): "If you won't need sponsorship for the role's duration, one line near your contact details can help: 'Right to work: UK Graduate visa (valid to MM/YYYY), no sponsorship required.' If you will need sponsorship, leave it off the CV and answer the application-form question honestly." Example dates must use 18 months for 2027+ graduates.

### 22. Missing rule: template placeholders and "fake" data that Greenhouse refuses to parse
- **Severity**: P2 · **Type**: missing
- **Where**: none.
- **Evidence**: (A) Greenhouse, "Unsuccessful resume parse": "A fake resume is one that contains fake or poorly disguised data", and placeholder names, towns or companies like "Company 1" are skipped. It also lists job titles like "Sr. Account Exec" and company names without identifiers. https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse
- **Fix**: new code rule `G-38 template_residue` (ats, major, A): regex `/(Company\s*\d|Your Name|Lorem ipsum|\[(Company|Role|Date|University)\]|Job Title Here|XX\/XX)/i` → fail with the offending span. This also catches Placed's own `NEEDS_NUMBER` if it ever leaks into an export.

### 23. G-14 requires month+year dates but ignores the one UK RCT on how dates are shown
- **Severity**: P3 · **Type**: missing / nuance
- **Where**: `general.ts:117-123`.
- **Evidence**: (A) Kristal, Nicks, Gloor & Hauser, *Nature Human Behaviour* (2022/23), a pre-registered audit of 9,022 UK openings. Showing years worked instead of date ranges raised callbacks by ~8% (no gap) and ~15% (gap). The mechanism is salience of experience. https://ore.exeter.ac.uk/repository/handle/10871/131446. The sample was experienced workers, and the gaps were 2.5 years.
- **Fix**: keep month+year (parsers extract dates; UK convention). Add to the G-14 tip: "For longer roles, adding the duration helps it stand out: 'Sep 2023 – Jun 2025 (21 months)'." Accept "Summer 2025 (10 weeks)" as passing for internships.

### 24. M1 and M9 need updating for LLM grading inside major ATSs
- **Severity**: P3 · **Type**: stale
- **Where**: `myths.ts:6-13, 63-69`; doc §1 row 5.
- **Current**: M1 says auto-rejection is "mainly through knockout questions". M9 says "employer AI use in hiring is currently minimal" (ISE). Doc §1 claims Enhancv found "100% used knockout questions".
- **Evidence**:
  - (D) IT Brief on Enhancv (19 Nov 2025): 25 US recruiters, 8% auto-reject; **no knockout-question percentage is reported**. https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth
  - (A) Workday HiredScore release notes, 5 Aug 2026 (per market-2026/03 F1): an LLM now "evaluates each screenable qualification individually" and assigns A–D grades.
  - (B) ISE insight, 4 Jun 2026: 95% of students believe employers use AI to shortlist; ISE calls employer use "currently minimal". https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment
- **Fix**: remove the "100% knockout" claim. Add to M1: "Since 2026 some large ATSs (e.g. Workday HiredScore) use AI to *grade* CVs against each requirement. Recruiters still decide, but clear evidence for each requirement matters more than keyword counts." M9: "ISE says most UK early-careers assessment is still human-led, though some large employers' ATSs now include AI grading."

### 25. `skill_rating_glyphs` misses the common cases
- **Severity**: P3 · **Type**: implementation
- **Where**: `checkers.ts:122-125`; `G-05`.
- **Evidence**: skill bars are usually vector shapes or images with no text-layer glyphs, so they are invisible to the regex. "Python (4/5)" and "SQL ●●●○○" with spaces are missed. The checker does catch "8/10".
- **Fix**: add `\b[1-5]\s*\/\s*5\b` near a skill token, `[●○■□★☆](\s?[●○■□★☆]){2,}`, and a pdf.js operator scan for ≥3 filled rectangles of identical height aligned with skill lines.

### 26. `bullet_length` threshold drifts from the statement, and bullets-per-role isn't checked
- **Severity**: P3 · **Type**: implementation
- **Where**: `G-23` ("about 12–30 words… 2–5 bullets per role"); `checkers.ts:142-148` (>35 words only).
- **Fix**: fail a bullet at > 40 words, partial at 31–40. Add a minor flag for any entry with > 6 bullets or a single bullet > 3 lines. Align the statement with this.

### 27. G-31's guidance never runs, because guidance on code rules is ignored
- **Severity**: P3 · **Type**: implementation
- **Where**: `general.ts:248-252` (code rule with `llmGuidance` about relevance and generic items); the same for G-25's "3+ errors = critical" (`:202`). `buildJudgePrompt` sends only `check === "llm"` rules (`judgeCvRules.ts:44`).
- **Fix**: either split out an LLM companion rule ("skills relevant and not generic") or delete the misleading guidance strings. Add a type-level ban on `llmGuidance` for code rules, or rename it `notes`.

### 28. GEN-12 has no citations, and several citations are dead or blocked
- **Severity**: P3 · **Type**: unsupported / stale
- **Where**: `general.ts:395` (`citations: []`). Gradcracker/Experian (`GRADCRACKER_EXPERIAN`, used by G-36 and GEN-09) returned 403 to me. The UCL Careers blog (2015) is 410 Gone (not cited in code, but the only UCL CV page search surfaced). Oxford's old `careers.ox.ac.uk/cvs` 301-redirects. LSE's one-vs-two-pages page sits on `blogstest.lse.ac.uk`.
- **Fix**: GEN-12 → cite NCS ("always use the same style throughout") and Sheffield ("Add dates at the end of the line"). Replace the LSE test-domain reference with the live LSE CVs page (quoted in Finding 16). Re-verify the Gradcracker page or swap it for the Civil Service guidance (B: PublicTechnology, 31 Oct 2025: applicants "should not use AI to generate full or false responses").

### 29. G-24 forbids "I/my" without limiting it to bullets clearly enough
- **Severity**: P3 · **Type**: copy
- **Where**: `general.ts:193-197`.
- **Evidence**: (B) Prospects (May 2025): a profile "can be written in either the first or third person" as long as it is consistent. (B) LSE prefers no personal pronouns.
- **Fix**: guidance: "In experience/activity bullets only… Ignore the profile." Add the profile case to the pass example.

### 30. The fairness guardrail lacks an outcome check
- **Severity**: P2 · **Type**: fairness / missing
- **Where**: `tests/fairness/` (name-swap and redaction tests exist); no aggregate monitoring.
- **Evidence**: (A) the ICO "AI in recruitment" audit outcomes (6 Nov 2024) found tools inferring gender or ethnicity from names, and recommended accuracy and bias testing and transparency. https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2024/11/ico-intervention-into-ai-recruitment-tools-leads-to-better-data-protection-for-job-seekers. Placed doesn't make hiring decisions, but its score steers students.
  - Findings 1, 2, 5 and 17 are exactly the proxy effects (nationality, international grade formats, non-English words, formal register) that a name-swap test won't catch.
- **Fix**: add a fixture suite of matched CV pairs that differ only in (a) UK vs international grade format, (b) "Nationality" line present or absent, (c) non-English society or place names, (d) Master's Distinction vs First. Assert the score delta is ≤ 2 points. Run it in CI next to `tests/fairness/score.test.ts`.

## New rules / signals to add

| id | Text | Check | Severity | Pass / fail anchors | Sources |
|---|---|---|---|---|---|
| G-38 `template_residue` | "Delete template leftovers ('Company 1', '[Role]', 'Lorem ipsum') — ATS treat them as fake data and skip parsing." | code regex | major (ats), A | Pass: no matches. Fail: "Intern, Company 1, XX/XX" | Greenhouse "Unsuccessful resume parse" |
| G-39 `photo_present` | "Remove the photo — it isn't usual on UK CVs and invites bias." | code: PDF image ≥ 2 cm² in top 30% of p.1 | major (uk), B | Pass: no image. Fail: headshot top right | Manchester; LSE; Warwick; GEMM 2019 |
| G-RTW (tip, unscored) | Right-to-work line guidance (Finding 21) | onboarding visa field | tip | — | Loughborough ISAS; BUILA |
| G-40 `page2_fill` (merge into G-11) | "Your second page is mostly empty — condense to one." | code | minor; partial for 1st/2nd years if page 2 < 60% filled | Pass: 1 page, or 2 well-filled. Fail: page 2 has 4 lines | LSE; Warwick; Oxford |
| G-41 `grade_format` (replaces G-32 regex) | Degree result or average in any recognised scale, including 2:2, Distinction/Merit, GPA with scale | code | major (uk), B | Pass: "MSc, Distinction (expected)", "GPA 3.6/4.0", "2:2". Fail: degree with no result or average | ISE/Luminate 2025; TARGETjobs Aug 2026 |
| G-42 `duration_salience` (tip) | "Add durations to longer roles: 'Sep 2023 – Jun 2025 (21 months)'." | code tip | not scored | — | Kristal et al. 2022 |
| G-43 `font_size` (replaces G-28 LLM) | Body text ≥ 10pt (Prospects 10–12; NCS ≥ 11; Oxford 10–11) | code (pdf.js) | major below 9.5pt, minor 9.5–9.9 | Pass: median body 10.5pt | Prospects; NCS; Oxford |
| G-44 `filename` (replaces G-10 LLM) | Professional file name | code (upload metadata) | minor | Pass: "Priya-Shah-CV.pdf". Fail: "CV_final_v3(2).pdf" | Prospects ("Joe-Smith-CV") |

## Rules to delete or downgrade

- **Delete** G-37 (guardrail, not a CV rule: Finding 4).
- **Delete after merge** GEN-01, GEN-03, GEN-04 (move its `yearAdjust` into G-22), GEN-05, GEN-06, GEN-07, GEN-08, GEN-09, GEN-10, GEN-12 (Finding 3). Sector files keep overrides only.
- **Downgrade** G-09 critical → major and make it code-only (Finding 9).
- **Downgrade** G-25 cap from ≥3 to ≥5 confirmed errors; dedupe (Finding 5).
- **Re-grade** GEN-10 A→D, GEN-01 A→B, GEN-05 A→B, G-06 A→B (until heading text is checked) (Finding 10).
- **Downgrade** AU-03 to minor for 2nd year and skip for 1st year; change the pass condition (Finding 6).
- **Remove from scoring until code-checked**: G-03, G-10, G-15, G-28, G-35, GEN-11 (Finding 11).
- **Demote to tip**: nationality (Finding 1); em-dash and "not only… but also" in `cliche_density` (Finding 17).
- **Merge** M2 into M13 (Finding 12).

## Open questions

1. Could not open Oxford's live CV page (403) or Cambridge's undergraduate CV PDF (> 10 MB). The Oxford claims (1–2 pages, 10–11pt, PDF) rest on search snippets. The Cambridge "1–2 page" claim comes from its Short CV Guide listing only.
2. No current UCL Careers CV page was reachable (403 on ucl.ac.uk/careers; the 2015 blog is 410 Gone). For a UCL-born product this is worth a manual check.
3. The Acas PDF was unreadable to my tools. The doc's quote is unverified by me.
4. The "57% required a 2:1 in 2021" figure: not found in either ISE source checked.
5. Whether any UK careers service explicitly recommends a right-to-work line on the CV (vs the application form).
6. Wiles/van Inwegen et al. 2025 (*Management Science*) was not re-opened. Note the 02 report gives ~10% higher wages while the general doc says 8.4%. Reconcile.
7. Bright Network's "a one-page CV" page returned 403. The snippet says students "should be one page", which would strengthen Finding 16 if confirmed.
8. Thoms et al. (1999) on one-page CVs remains unread (as the doc already notes).

## Sources

**A**
1. Sterkens et al. (2023), "Costly mistakes…", *PLOS ONE* 18(4): e0283280. https://pmc.ncbi.nlm.nih.gov/articles/PMC10075394/ (opened)
2. Kristal, Nicks, Gloor & Hauser (2022/23), *Nature Human Behaviour*, Exeter repository. https://ore.exeter.ac.uk/repository/handle/10871/131446 (abstract)
3. Osanami Törngren et al. (2024), *Frontiers in Sociology*. https://www.frontiersin.org/journals/sociology/articles/10.3389/fsoc.2024.1222850/full (opened)
4. Kobak et al. (2025), *Science Advances* 11(27), "Delving into LLM-assisted writing…". https://arxiv.org/abs/2406.07016
5. Greenhouse Support, "Unsuccessful resume parse" (current). https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse (opened)
6. Workday Admin Guide, "Resume parsing". https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html (opened)
7. ICO, "ICO intervention into AI recruitment tools…" (6 Nov 2024). https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2024/11/ico-intervention-into-ai-recruitment-tools-leads-to-better-data-protection-for-job-seekers
8. Nuffield College CSI (Di Stasio & Heath, GEMM), Jan 2019 press release. https://www.nuffield.ox.ac.uk/news-events/news/new-csi-report-on-ethnic-minority-job-discrimination/
9. Equality Act 2010. https://www.legislation.gov.uk/ukpga/2010/15/contents
10. Rivera & Tilcsik (2016), *ASR*, via Kellogg. https://www.kellogg.northwestern.edu/faculty/research/detail/2016/class-advantage-commitment-penalty-the-interplay-of-social-class (cited via 02; not re-opened)

**B**

11. Prospects, "How to write a CV" (Jemma Smith, May 2025). https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/how-to-write-a-cv (opened)
12. Prospects, "Writing a personal statement for your CV" (May 2025). https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/writing-a-personal-statement-for-your-cv (opened)
13. National Careers Service, "CV sections". https://nationalcareers.service.gov.uk/careers-advice/cv-sections (opened)
14. University of Manchester Careers, "Creating your CV". https://www.careers.manchester.ac.uk/applicationsinterviews/cv/step1creatingyourcv/ (opened)
15. LSE Careers, "CVs". https://info.lse.ac.uk/current-students/careers/information-and-resources/application-process/cvs (opened)
16. University of Warwick Careers, "CVs". https://warwick.ac.uk/services/careers/applications/cvs/ (opened)
17. University of Oxford Careers Service, CVs (search snippet; live page 403). https://www.ox.ac.uk/careers/careers-guidance/job-search-and-applications/writing-applications/cvs
18. University of Cambridge Careers, "CVs and cover letters" (opened; no rules on page). https://www.careers.cam.ac.uk/applying-for-jobs/cvs-and-cover-letters
19. University of Sheffield Careers, "Applicant tracking systems". https://sheffield.ac.uk/careers/support/apply/applications/tracking-systems (opened)
20. University of Nottingham Careers, "ATS: stop trying to beat the system…" (8 Sep 2026). https://www.nottingham.ac.uk/careers/students/career-insights/ats-stop-trying-to-beat-the-system-and-focus-on-what-really-matters.aspx (opened)
21. TARGETjobs, "How long should a CV be… FAQs" (12 Aug 2026). https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/how-long-should-cv-be-graduate-jobs-and-other-cv-faqs-answered (opened)
22. TARGETjobs, "Are personal statements a waste of space…" (21 Jun 2023). https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/are-personal-statements-waste-space-graduate-cvs (opened)
23. TARGETjobs, "What to put in the further interests section…" (Jun 2023). https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/what-put-further-interests-section-graduate-cv (search summary)
24. Isherwood (ISE), "Early careers recruitment in 2025…", Prospects Luminate (Oct 2025). https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards (opened)
25. Times Higher Education, "Less than half of UK's big graduate recruiters now demand a 2:1" (1 Dec 2022). https://www.timeshighereducation.com/node/724569 (opened)
26. ISE, "Students use AI to compete yet oppose AI assessment" (4 Jun 2026). https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment (opened)
27. PublicTechnology, civil service AI guidance for applicants (31 Oct 2025). https://www.publictechnology.net/2025/10/31/education-and-skills/what-new-civil-service-guidance-on-ai-for-job-applicants-tells-us-about-shifts-in-recruitment/ (opened)
28. HR Dive, HBS/Accenture *Hidden Workers* (2021). https://www.hrdive.com/news/report-applicant-tracking-systems-may-exclude-whole-segments-of-candidates/606614/ (opened)
29. Textkernel, "Improving extraction from column resumes" (undated, c. 2024–26; vendor). https://www.textkernel.com/improving-extraction-from-column-resumes/ (opened: column-gap accuracy 60→82%, render 62→90%; both docs are right but quote different metrics)
30. Loughborough ISAS, Graduate Route. https://www.lboro.ac.uk/services/isas/visa-advice/grroute/
31. BUILA, "Shorter Graduate Route from January 2027…". https://www.buila.ac.uk/articles/shorter-graduate-route-from-january-2027-uk-govt-confirms

**C / D**

32. (D) TheLadders, "Keeping an eye on recruiter behavior" (2012). https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf (opened; contains a service advert)
33. (C) interviewing.io, "Are recruiters better than a coin flip…". https://interviewing.io/blog/are-recruiters-better-than-a-coin-flip-at-judging-resumes (opened)
34. (D) Enhancv via IT Brief UK (19 Nov 2025). https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth (opened)
35. (D) ResumeGo, "Settling the Debate: One or Two Page Resumes" (2018). https://www.resumego.net/research/one-or-two-page-resumes/ (via search)
36. (C) Swansea University student guide (right to work). https://iss-myuni-00.swan.ac.uk/media/Student-Guide---with-logo.pdf (via search)
37. (C, stale) UCL Careers blog, engineering CV tips (2014). https://blogs.ucl.ac.uk/ucl-careers/2014/10/21/seven-top-tips-to-perfect-your-engineering-cv-and-covering-letter
