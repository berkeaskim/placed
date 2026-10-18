# Finance & consulting CV rules audit

**Verdict: C−.** The research doc (`cv-rules-finance-consulting.md`) is honest about its gaps, and most of its headline conventions hold up against primary sources: one page, education first, no photo, grades stated, quantified bullets and specific interests. What ships in `lib/cv-rules/rules/finance.ts` is weaker than the doc. Code-checked rules are stacked three or four deep on the same detector (grades, quantification, spelling, personal details), so one signal can cost up to ~10 points. "No photo" (FCQ-03) never looks for a photo. The grade regex passes a 2:2 and "A-levels" with no grades, but fails Master's Distinction/Merit, IB written "38/45" and international GPAs. The scorer also has no idea which firm, division or programme is being targeted, so the firm/division rules (FCQ-10, FIN-12, FIN-13, FIN-14, MBB vs Big 4) are guesses.

The most serious gap is the 2026 one. Employer rules on AI use now differ by firm: Bain London allows AI **only** for CV grammar and spelling, while McKinsey allows "refining" a résumé. Yet the CV tailor rewrites CVs with no firm-policy check, and FCQ-12 tells every user "AI can help you polish".

Several citations are mis-graded. The Goldman transcript is a US video with a "may not reflect institutional views" disclaimer. The eFC 2025/26 guide is mostly CV-writing-vendor opinion. The BlackRock link is dead. The PwC date the code marks "unverified" is verifiable: 14 Aug 2022.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality | C+ | The core conventions have A/B sources (Cambridge, LSE, Warwick, Bain, BCG). Severities and thresholds are D synthesis labelled A, and several sources are vendor/US material graded A/B. |
| Freshness | C | No 2026 cycle facts (rolling openings from June to Aug 2026, application caps, AI policies). Still cites a 2015 eFC piece, a 2016 MS page and a 2017 Bright Network template. The BlackRock deep link is dead. |
| Coverage | C− | Missing: deal/transaction bullets and confidentiality, how to list a spring week, A4 vs US Letter and other US conventions, firm AI policies, Big 4 form-first weighting in code, Master's and international grades, extenuating circumstances. |
| Implementation fidelity | D | The same checker repeats 3–4×. FCQ-03 doesn't detect photos. The grade regex gives false passes and false fails. `education_first` passes Experience-then-Education. `leadership_lexicon` misses "Founded". There is no sub-sector or firm context. "critical" has no gating meaning. |
| Consistency | D+ | G-11 (≤2 pages, pass) vs FCQ-01 (1 page, fail). FIN-12 penalises GCSE detail vs G-33 and LSE/Lancaster, which show a one-line GCSE summary. FIN-03 rewards cohort rank vs FCQ-04 "rank earns nothing". FCQ-12 "AI may polish" vs Bain. The cover-letter module checks JD AI policy; the tailor doesn't. |
| UX / copy | C | Statements are mostly clear. Some overclaim ("students in these sectors always lead with it"; "sans-serif" as ATS-required). FIN-02/G-32 copy implies hiding a 2:2. FIN-09 has no citation. |

## Findings

### 1. The CV tailor and FCQ-12 ignore firm AI-use policies; Bain London allows AI only for spelling and grammar
- **Severity**: P0 · **Type**: missing / contradiction / copy
- **Where**: `lib/cv-rules/rules/finance.ts:98-105` (FCQ-12); doc `cv-rules-finance-consulting.md:67`; tailor pipeline `lib/tailor/*` has no policy check (grep finds Bain only inside a prompt red-flag string, `lib/tailor/playbook-data.json:789`); `lib/cover-letter/mode.ts:6,14` does check, but only scans JD text.
- **Current**: FCQ-12: "AI can help you polish, but not misrepresent" (shown to every finance/consulting user). The tailor rewrites bullets for any employer.
- **Evidence**:
  - (A) Bain & Company, London recruiting page (fetched 2026-10-18), https://www.bain.com/careers/recruiting/london-recruiting/: "only use AI, such as Chat GPT or Claude, to check grammar and spelling in your CV." AI is also not permitted in the online assessment or interviews.
  - (B) McKinsey's careers page, as reported by Fortune (J. Angelo, 14 Jan 2026), https://fortune.com/2026/01/14/how-to-get-hired-at-mckinsey-ai-tools-liberal-arts-creativity: candidates "can use the technology to refine résumés and practice interview questions". AI is barred in assessments, for interview answers and for embellishment.
  - (A, tier-2 consulting) The PSC, "AI policy for Early Career Consultant Recruitment 2025", https://thepsc.co.uk/downloads/AI_policy_for_Early_Career_Consultant_Recruitment.pdf. Candidates sign a declaration; banned uses include using AI "To inflate skills and experiences".
  - (A) Barclays Hints and tips, https://search.jobs.barclays/hints-and-tips: "third-party AI tools are not permitted during your Barclays interview".
  - (B) Wonkhe on the ISE 2026 survey (D. Kernohan, 14 Oct 2026), https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs: "few employers ban the use of large language models in applications"; most set boundaries instead.
- **Fix**:
  1. Add `lib/employers/ai-policy.ts`, a table of `{employer, scope: "cv"|"form"|"assessment"|"interview", policy: "grammar_only"|"refine_ok"|"declaration"|"unknown", source, checkedAt}`. Seed it with Bain London (`grammar_only`), McKinsey (`refine_ok`), The PSC (`declaration`) and Barclays (interview ban).
  2. In the tailor: if the target employer's policy is `grammar_only`, switch to "suggest-only" mode. Show the diff as suggestions the student retypes, and offer only spelling/grammar fixes automatically. Show the banner: "Bain asks applicants to use AI only to check spelling and grammar on their CV. Placed will only suggest fixes here — rewrite in your own words."
  3. Reuse `aiPolicyBlocks()` on JD text as a second signal.
  4. Rewrite FCQ-12: "Write in your own words with specific facts. Some firms (e.g. Bain London) allow AI only for spelling and grammar checks, so check each firm's policy before using AI on your CV."

### 2. The grade checker passes 2:2s and "A-levels" without grades, and fails Master's, IB and international grades
- **Severity**: P0 · **Type**: implementation / fairness
- **Where**: `lib/cv-score/checkers.ts:126-129` (`uk_grades`), used by FCQ-04 (critical), FIN-02, CON-01 (critical), QNT-12 and G-32.
- **Current**: The regex accepts `\b2:2\b`, any `\d{2}%` (e.g. "52%"), bare `a-levels?` and `\bpredicted\b`. It has no `distinction|merit`, no `\d{2}/45`, no `GPA`, no `/20`, no `CGPA`.
- **Evidence**: The rule text says pass "when a degree grade of 2:1 or above, or a predicted 2:1, is stated" (`finance.ts:42`). BCG UK requires "at least a 2:1 degree or equivalent" (A, https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs). "Equivalent" means international and Master's systems must be recognised. A Master's student writing "MSc Finance — Distinction (predicted)" fails a critical rule today, and so does an IB student writing "IB Diploma: 40/45".
- **Fix**: Replace the regex with a parser returning `{system: "uk_ug"|"uk_pg"|"ib"|"a_level"|"gpa"|"other", value, predicted}`:
  - Pass: UK UG First/2:1/≥60%; UK PG Distinction/Merit/≥60%; IB `\d{2}\s*/\s*45` or `IB(?: Diploma)?[:\s]+\d{2}`; any `GPA\s*\d\.\d{1,2}(\s*/\s*4(\.0)?)?`; `\d{1,2}(\.\d)?\s*/\s*20`; `CGPA \d(\.\d+)?\s*/\s*10`.
  - "A-levels" counts only when grades follow (`A\*|[A-E](?![a-z])`).
  - Non-UK values: send to the LLM for an "equivalent to 2:1?" verdict, with `could_not_assess` rather than fail when unsure.
  - A stated 2:2 is **pass for "stated"** (honesty), with separate copy (see #9). Never fail a CV because it shows a grade below 2:1.

### 3. One signal is scored three or four times
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/cv-rules/rules/finance.ts` + `general.ts`, combined by `rulesFor()` (`lib/cv-rules/index.ts:9-11`).
- **Current** (computed by script from `rulesFor()` + `aggregate.ts` weights):

  | Checker | Rules | Share of total score |
  |---|---|---|
  | `spelling` | G-25, GEN-06, FCQ-05 | ≈10.1 pts (finance), 8.7 (consulting), 9.9 (quant) |
  | `quantified_bullets` (consulting) | G-22, GEN-04, FCQ-08, CON-04 | ≈7.8 pts |
  | `uk_grades` (finance) | G-32, FCQ-04, FIN-02 | ≈5.9 pts |
  | `uk_personal_details` | G-17, GEN-01, FCQ-03 | ≈5.2 pts |
  | `page_count` (quant) | G-11, FCQ-01, QNT-09 | ≈6.2 pts |

  Spelling also triggers a separate cap at 50 (`aggregate.ts`).
- **Evidence**: The doc itself says sector rules "only override severities" of the GEN baseline (`cv-rules-finance-consulting.md:30`), not add copies. Each copy carries a different evidence grade (G-22 D, GEN-04 C, FCQ-08 A, CON-04 A), so the weight is arbitrary.
- **Fix**: Add a `supersedes?: string[]` field to `CvRule`. Have `rulesFor(sector)` drop any rule a sector-specific rule supersedes:
  - FCQ-01 supersedes G-11. QNT-09 is deleted.
  - FCQ-04 supersedes G-32. FIN-02 becomes an LLM rule about A-levels only (merge with G-33). QNT-12 and CON-01 become `sectorAdjust` on FCQ-04.
  - FCQ-05 supersedes G-25 and GEN-06.
  - FCQ-08 supersedes G-22 and GEN-04. CON-04 becomes `sectorAdjust: { consulting: { threshold… } }` on FCQ-08 (this needs a `threshold` field in `sectorAdjust`).
  - FCQ-03 supersedes nothing; see #4.

  Add a test asserting that no checker appears twice in `rulesFor(s)` for any sector.

### 4. FCQ-03 ("no photo") never detects a photo
- **Severity**: P1 · **Type**: implementation
- **Where**: `finance.ts:34-38` uses `checker: "uk_personal_details"`. The checker (`checkers.ts:101-104`) only regexes DOB, nationality and marital status. No photo detection exists anywhere in `lib/cv` or `lib/cv-score`.
- **Current**: "Don't add a photo…" passes for every CV that has a photo but no DOB line.
- **Evidence**: Cambridge banking guide 2025–26, p.7 (A): "No Photo: Do not include a photo on your CV for UK applications." Goldman recruiter transcript: "I would be cautious of putting your picture on your resume" (US video, B).
- **Fix**: New checker `photo_present`. Using the PDF operator list already walked in `lib/cv/safety.ts:153-180`, flag any `paintImageXObject` on page 1 whose bounding box lies in the top 30% of the page and is ≥ 2 cm in both dimensions with an aspect ratio of 0.6–1.0. Severity major for FCQ, minor elsewhere. Copy: "Remove the photo — UK employers don't expect one and it takes space from your evidence."

### 5. The scorer doesn't know the target firm, division or programme, so firm/division rules are guesses
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/cv-score/run.ts:42-51` (input is `{userId, cvId, sector, year}` only). Affected rules: FCQ-10 (`finance.ts:83-89`), FIN-12 (wrong firm, `:191-197`), FIN-13 (AM only), FIN-14 (S&T only), QNT-03/QNT-11 (QR vs QT), and the CON-01/02/04 MBB-vs-Big 4 split (`:316,322,337`).
- **Current**: The guidance says e.g. "Critical for MBB, major for Big 4", but `effectiveSeverity()` (`lib/cv-score/aggregate.ts:32-34`) can only vary by archetype and year. Every consulting user, including Big 4 applicants, gets MBB-critical grade, leadership and quantification rules. FIN-13/FIN-14 ask the judge to decide "for AM roles" with no role given.
- **Evidence**: The doc's own implementation hint (`cv-rules-finance-consulting.md:261`) asks for `programmeType` and `sectorVariant ∈ {IBD, S&T, AM, QT, QR, MBB, B4}`. Big 4 differ materially on grades: PwC dropped the 2:1 (A, see #12); Deloitte still asks most programmes for a predicted 2:1 (A, https://www.deloitte.com/uk/en/careers/early-careers/early-careers-application.html); EY removed 2:1 and UCAS criteria in 2015 (B, Cambridge Network, 3 Feb 2017, https://www.cambridgenetwork.co.uk/news/ey-drives-social-mobility-removing-academic-entry-criteria).
- **Fix**:
  1. Add an optional `variant` input (`IBD|ST|AM|QT|QR|MBB|T2|B4`) and an optional `targetEmployer`, inferred from the tracked job when scoring "for this job".
  2. Add `variantAdjust` alongside `sectorAdjust`.
  3. When no variant is known, FIN-13, FIN-14, QNT-11 and FIN-12's wrong-firm clause return `not_applicable`.
  4. CON-01/02/04 default to **major**, becoming critical only when `variant === "MBB"`.

### 6. "critical" has no gating meaning, so "likely rejection" findings can sit beside a high score
- **Severity**: P1 · **Type**: implementation / copy
- **Where**: doc `:18` ("critical: likely to cause rejection at screen on its own"); `aggregate.ts` (critical = weight 3, no cap).
- **Current**: A banking CV with no grade at all loses roughly 3–4 points of the total and can still show 85/100.
- **Evidence**: Cambridge (A) says screens look for "key criteria (grades, skills)" (banking guide p.6). BCG and Bain state grade expectations on their pages (A).
- **Fix**: Don't add more caps, since that compounds harshness. Instead, add a `blocker` flag to results from critical rules that fail outright (not partial) for FCQ-01, FCQ-04 and FIN-12-wrong-firm. Render them above the score as "Fix before you apply", and exclude them from the "rules passed" ratio headline. Keep the numeric score as is.

### 7. G-11 and FCQ-01 give contradictory length verdicts on the same CV
- **Severity**: P1 · **Type**: contradiction
- **Where**: `general.ts:96-99` (G-11, `maxPages: 2`, applies to all) vs `finance.ts:23-28` (FCQ-01, `maxPages: 1`). Myth M4, `myths.ts:28-33`.
- **Current**: A two-page banking CV gets a "pass" on G-11 ("at most two A4 pages") and a "partial" on FCQ-01 in the same report.
- **Evidence**:
  - (A) Cambridge banking 2025–26 p.7: "For roles in the UK/USA, keep your CV to one page." Cambridge consulting 2024 p.8: "your CV should be on 1 page… 2 pages is okay" for advanced-degree or experienced candidates.
  - (A) LSE Careers CVs: "Finance CVs are typically one-page."
  - (A) Warwick: finance (particularly banking) and consulting "often like to see a concise 1 page CV".
- **Fix**: FCQ-01 supersedes G-11 for FCQ sectors (see #3). Add `yearAdjust` and a PhD exception: if the education level is PhD, `maxPages: 2`. Copy: "Finance and consulting CVs are one page for students (Cambridge, LSE and Warwick careers services all say so). Two pages is for PhDs and experienced hires."

### 8. `education_first` passes when Experience comes first
- **Severity**: P2 · **Type**: implementation
- **Where**: `checkers.ts:94-97`. It passes if `education` is at index 0 **or 1** of `sectionOrder`.
- **Current**: [Experience, Education, …] passes FCQ-02.
- **Evidence**: The intent is "Education is the first section after contact details" (doc `:57`). eFC guide 2025/26 p.23 (C): "students always have education listed first."
- **Fix**: Pass only when Education is first, or second with the first section being `summary|profile`. Return `partial` (not fail) when the user is `masters`/`final` and the first section is a ≥10-week internship, which matches G-13's exception.

### 9. Grade copy implies hiding a 2:2; there's no route for honest lower grades or extenuating circumstances
- **Severity**: P1 · **Type**: copy / fairness / missing
- **Where**: `finance.ts:41` (FCQ-04), `:118` (FIN-02), `:307` (QNT-12), `:315` (CON-01), `general.ts:257` (G-32): "State your grade explicitly if it's a 2:1 or above…"
- **Current**: A 2:2 student reads "state it if 2:1+" as "leave it off", but bank and Big 4 forms ask for it anyway.
- **Evidence**:
  - (A) Cambridge consulting guide p.9: "If you do not have grades for any reason at all, then you can add a note to extenuating circumstances or put in a prediction with an asterisk."
  - (A) Cambridge banking p.7: "Include grades and exam marks and mention any extenuating circumstances in the additional information section."
  - (A) ISE (S. Isherwood, Oct 2025): "47% of employers specifying a 2:1 degree and 20% accepting a 2:2 degree", https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards.
  - (B) TARGETjobs, "Do A levels matter for jobs?" (2 May 2025): contextual recruitment (Rare) assesses grades "in the context of your life circumstances".
- **Fix**: New statement: "State your degree result or current average, or a predicted grade marked with an asterisk. Forms will ask anyway, so leaving it off only looks like a gap. If your result was affected by circumstances, say so in the application's additional-information box, not on the CV. Many banks and Big 4 firms use contextual recruitment." In the grade parser (#2), a 2:2 counts as stated (pass), and the UI shows that employer's grade bar from the jobs data when known.

### 10. The fairness redactor strips "native", so native speakers fail FIN-09
- **Severity**: P1 · **Type**: implementation / fairness
- **Where**: `lib/cv/redact.ts:333-350` removes `(native)`, "native speaker", "mother tongue" and "first language". FIN-09 (`finance.ts:168-175`) asks "Is every listed spoken language paired with a level (CEFR A1–C2, native, fluent or professional working)?"
- **Current**: "Turkish (native), French (B2)" reaches the judge as "Turkish, French (B2)". The judge marks FIN-09 failed, so multilingual or international students are penalised for exactly the label we told them to add. FIN-09 also has `citations: []` and grade D.
- **Evidence**: G-37 (`general.ts:300-306`) promises that nationality never changes the score. Equality Act 2010 s.9 lists nationality and ethnic or national origins under race (A, https://www.legislation.gov.uk/ukpga/2010/15/section/9).
- **Fix**: Either (a) replace the stripped label with a neutral placeholder `[LEVEL]` that the judge is told counts as a valid level, or (b) make FIN-09 a code rule run on **unredacted** text that checks only for the presence of any level token. Downgrade FIN-09 to `minor`, grade D, and either cite a source or label it "Placed convention" (`convention: true` already shows for C/D).

### 11. FIN-12 penalises GCSE detail on penultimate CVs, but UK careers services show a one-line GCSE summary
- **Severity**: P2 · **Type**: contradiction
- **Where**: `finance.ts:191-197` (FIN-12: "school-level detail on a penultimate-year CV" is a red flag; guidance "GCSE-level detail"); `general.ts:262-268` (G-33: "Summarise GCSEs in one line").
- **Evidence**:
  - (A) LSE Careers CV page sample lists A-levels and GCSEs under the school entry, e.g. "4 A levels: Maths (A*), Physics (A*)…", https://info.lse.ac.uk/current-students/careers/information-and-resources/application-process/cvs.
  - (B) Lancaster LUMS (P. McCormick, 31 May 2024): "Don't list any AS Levels or individual GCSEs"; summarise strong GCSEs, e.g. "10 GCSEs: Grades 9 - 7", https://www.lancaster.ac.uk/lums/careers/blogs/financial-market-cvs.
  - (A) Cambridge consulting p.9: "they don't need a paragraph about your GCSE or A Level choices."
  - (A) Deloitte still collects A-level/GCSE data on its form.
- **Fix**: Narrow the FIN-12 clause to "a paragraph or per-subject list of GCSEs/AS-levels". Pass a single summary line ("11 GCSEs incl. Maths 9"). Add the Lancaster pass/fail anchors.

### 12. The PwC 2:1 date is verifiable: remove "(unverified)" and the evidence downgrade
- **Severity**: P2 · **Type**: stale
- **Where**: `sources.ts:108-109` (F_S29 "2022 (unverified)"); doc `:44`, `:313`.
- **Evidence**: (B) Consultancy.uk, 22 Aug 2022, https://www.consultancy.uk/news/32093/pwc-removes-21-requirement-for-graduate-staff: "Undergraduate and graduate roles will no longer need applicants to have a 2:1 degree." The press release itself is dated 14 Aug 2022 (via search index; pwc.co.uk returns 403 to bots).
- **Fix**: `year: "14 Aug 2022"` and drop the "(unverified)" title suffix. Add EY (2015 removal of 300 UCAS and 2:1; blind CV policy) as F_S38, and the Deloitte form text ("removed A-Level and GCSE requirements to join most of our programmes"; most programmes still ask a predicted 2:1) as an updated F_S31 quote.

### 13. Big 4 often take no CV at all: the caveat is right, but the rules still score as if the CV is read
- **Severity**: P1 · **Type**: implementation / missing
- **Where**: `profiles.ts:32-37` (SECTOR_CAVEATS); all CON rules.
- **Current**: There's a caveat sentence, but scoring is unchanged, and MBB-critical rules apply to Big 4 (see #5).
- **Evidence**:
  - (A) Deloitte UK application page refers only to an online form ("Enter them into your application form"); no CV is mentioned.
  - (A) Cambridge consulting p.8: "You may not be asked for a CV or cover letter straight away, or at all."
  - (B) TARGETjobs spring weeks (A. Lewis, 2 May 2025): applicants "usually complete a condensed online form", with tests; only "some law and consulting firms" ask for a CV.
  - (B) EY has a "blind CV policy".
- **Fix**: When `variant === "B4"`, or the programme is a spring or insight scheme with a form, show the score as "CV readiness" and surface a "Form readiness" checklist: grades entered exactly as on the transcript, competency answers, tests practised. Lower the FCQ-01 and FCQ-07 severities to minor for these, since the CV may be uploaded but not screened.

### 14. Year adjustment keys on "1st" only, but spring weeks also target 2nd years on four-year courses
- **Severity**: P2 · **Type**: implementation
- **Where**: `yearAdjust: { "1st": … }` on FIN-04, FIN-07, QNT-02/03/05, CON-07; `lib/types.ts:19` (`YEARS`).
- **Evidence**: (B) TARGETjobs, 2 May 2025: spring weeks are "traditionally aimed at first-year students on three-year courses" (and second years on four-year courses). (A) Rothschild Global Advisory 2027 is "aimed at students in their second or penultimate year", https://www.rothschildandco.com/en/careers/students-and-graduates/opportunities/2027-uk-global-advisory-summer-analyst-programme-london/.
- **Fix**: Derive `stage = "insight" | "internship" | "graduate"` from `year + courseLength + programmeType`, and key the step-down on `stage === "insight"`, not on `year === "1st"`.

### 15. FCQ-04's "no credit for a higher grade" contradicts FIN-03's cohort-rank bonus and drops the source's advice
- **Severity**: P2 · **Type**: contradiction / copy
- **Where**: `finance.ts:42` ("a First, a higher percentage or a rank earns nothing more") vs `:124-127` (FIN-03 bonus, passExample "Top 5% of cohort"); QNT-01/06 pass examples reward "Probability 78%".
- **Evidence**: (A) Cambridge banking p.7: "specify your class standing and high module grades." The no-extra-credit choice is a defensible fairness decision (Quadlin 2018), but the sources say to show strong marks.
- **Fix**: Keep the scoring neutral, but make the advice match the sources. FCQ-04 statement: "…A First earns no extra points in Placed, but listing strong module marks or a class rank still helps recruiters." Make FIN-03 `not_applicable`-only (it can never reduce the score) and remove "rank" from FCQ-04's guidance, or remove ranks from FIN-03. Pick one.

### 16. Leadership checker misses "Founded", "Lead", "Head Girl/Boy" and "Prefect"
- **Severity**: P2 · **Type**: implementation
- **Where**: `checkers.ts:157-160` (`leadership_lexicon`, used by FIN-06 and by CON-02, which is critical).
- **Current**: The regex has `founder` but not `founded|co-founded|launched|started`, `\bled\b` but not `\blead\b`, `head of` but not `head (girl|boy|student)|prefect|captain` (captain is present), and no `managed|ran|coordinated`. It also ignores `projects`. "Founded a 60-member coding society" fails a critical consulting rule.
- **Evidence**: CON-05's own lexicon (doc `:175`) lists founded, launched, initiated. Cambridge consulting p.9 says "Volunteering, entrepreneurship, leadership roles and more are all valued."
- **Fix**: Use `/(president|vice[- ]president|captain|(co-)?found(ed|er)|launched|head (of|girl|boy|student)|prefect|\bl(ed|ead)\b|chair|treasurer|secretary|committee|officer|organis(ed|er)|organiz(ed|er)|mentor(ed)?|managed|coordinated|ran\b|trained)/i` over experience, leadership **and projects**. Add a test fixture.

### 17. Quantification thresholds are D-grade product numbers but carry A-grade weight
- **Severity**: P2 · **Type**: unsupported
- **Where**: `finance.ts:68` (FCQ-08, evidence A, threshold 0.4/0.25/0.5) and `:335-338` (CON-04, critical, 0.5/0.3/0.6). Doc `:254` presents the thresholds without a source.
- **Evidence**:
  - (B) TARGETjobs on McKinsey (J. Barrett, 19 May 2025): quantify achievements "wherever possible"; no share given.
  - (A) JPMC "How we hire": "using measurable data when applicable".
  - (A) Cambridge consulting p.8: "quantify your outcomes".

  No source sets 50% or 60%, and nothing supports "critical".
- **Fix**: Split the rule. "Bullets show outcomes and are quantified where possible" stays A, as an LLM verdict on the best 3 bullets. The ratio becomes a D `convention: true` rule, severity minor, with one threshold of 0.33 for every year. Remove CON-04's critical. A first-year retail CV can't truthfully reach 60%, and the current rule invites invented metrics, which conflicts with G-36.

### 18. FCQ-07 requires sans-serif fonts; that's a CV vendor's claim, graded B
- **Severity**: P2 · **Type**: unsupported
- **Where**: `finance.ts:59-66` (FCQ-07, major, B); doc `:62` (cites [S7] "eFC guide (McLean)").
- **Evidence**:
  - (C) eFC Inside Knowledge 2025/26 p.23 quotes Victoria McLean (founder of a CV-writing firm): CVs "must be written in Arial, Calibri, Tahoma or Verdana… serif fonts in particular, must be avoided."
  - (A) Warwick gives the real ATS risk: "some ATS systems are not able to detect any content within a table and/or text box."
  - (B) Nottingham Careers (B. Dooley, 8 Sep 2026): "You don't need elaborate graphics or heavily designed layouts."

  No ATS documentation reviewed says serif fonts fail.
- **Fix**: Statement: "Use a single-column layout with no tables, text boxes or graphics for content, and one readable font at 10–12pt." Drop "sans-serif". Evidence B (Warwick); remove the eFC font claim.

### 19. Mis-graded sources: the GS transcript, the eFC guide and BlackRock
- **Severity**: P2 · **Type**: stale / unsupported
- **Where**: `sources.ts:79` (F_S3 graded A in doc `:285`), `:82` (F_S7), `:115` (F_S37); FIN-13 `finance.ts:199-205` cites only F_S37 but is graded B.
- **Evidence**:
  - The GS PDF is a US video transcript ("resume", "your professor… your mom") and carries a disclaimer that it "may not necessarily reflect the institutional views of Goldman Sachs". Grade B, US.
  - The eFC guide's CV section is quotes from a CV-writing vendor (McLean) and a Wall Street coach (Cohen), plus pedigree claims ("The better your university, the better your chance"). Grade C. Never use it for format or school-tier claims.
  - `https://careers.blackrock.com/early-careers/emea/` now redirects to `careers.blackrock.com/` (curl, 2026-10-18). The only "student of the markets" text found is a 2019 EMEA brochure (search index).
- **Fix**: F_S3 becomes B with title suffix "(US recruiter video)". F_S7 becomes C. Replace F_S37 with `https://careers.blackrock.com/en/students-and-graduates-emea` and downgrade FIN-13 to C. Better: re-source FIN-13 to the Cambridge banking guide's "Share details about past projects and evidence of their success" (A) plus a D synthesis note.

### 20. No rule covers deal/transaction bullets, including overclaiming and confidentiality
- **Severity**: P1 · **Type**: missing
- **Where**: The doc and finance.ts have no deal rule. The tailor playbook covers honest scope (`tailor-playbooks-finance-consulting.md:87-88`) but the scorer doesn't.
- **Evidence**:
  - (C) eFC (Z. Toulon, 21 Nov 2022) quoting McLean: "You didn't originate or execute the deal, so don't feel that you need to claim that you did", https://www.efinancialcareers.com/news/2022/11/what-not-to-put-banking-cv.
  - (B) The TARGETjobs IB CV template writes intern work as "Assisted more senior team members with the execution of deals" (via the tailor doc TF5).
  - (A) UK MAR Art. 10: "unlawful disclosure of inside information arises where a person possesses inside information" and discloses it, https://www.legislation.gov.uk/eur/2014/596/article/10.
  - (C, corroboration) Practitioner guides advise naming only announced deals, otherwise using sector + type + rounded size.
- **Fix**: Add FIN-15 (spec below).

### 21. Nothing tells students how to list a spring week, insight day or virtual internship
- **Severity**: P2 · **Type**: missing
- **Where**: FIN-04 (`finance.ts:131-138`) counts spring weeks and "virtual internships" equally as commitment.
- **Evidence**: (B) TARGETjobs, 2 May 2025: strong spring-week performers may be "fast-tracked to the final interview or assessment centre stage", so recruiters do read them as real experience. No primary source treats virtual internships (Forage etc.) as equivalent; their weight is unsupported (D). (C) Purple CV / WSO: put a spring week under Experience; once you have internships, collapse it to one line.
- **Fix**: Add FIN-16 (spec below). In FIN-04, a virtual internship alone yields `partial`, not pass.

### 22. US conventions (GPA, US Letter, "Class of", SAT) aren't flagged on UK CVs
- **Severity**: P2 · **Type**: missing
- **Where**: No rule exists. The doc notes the trade press is US-centric (`:48`) but encodes no check.
- **Evidence**:
  - (C) eFC template (Z. Toulon, 29 Sep 2023): "your CV should fit on a single A4 page."
  - (A) Imperial: "advice may differ in other countries"; LSE: "check out what's expected wherever you are applying".
  - (B) Oliver Wyman's **US** posting asks for "GPA and SAT/ACT scores" (via search index, RippleMatch/Greenhouse). That's a US convention UK students copy from Mergers & Inquisitions / WSO templates.
- **Fix**: Add UK-01 (spec below).

### 23. The 2026 cycle's facts are missing: rolling openings from June to Aug, application caps, record volumes
- **Severity**: P2 · **Type**: stale
- **Where**: doc `:243-245` ("US-office deadlines open as early as December or January"; spring weeks "September to October").
- **Evidence**:
  - (A) Cambridge banking 2025–26 p.4: "Recruitment can start as early as June"; have the CV "ready by mid-May".
  - (A) Rothschild GA 2027 opened 19 Aug 2026, "on a rolling basis".
  - (A) Goldman Sachs 2027 EMEA roles: "up to 4 separate business / location combinations in any given recruiting year", https://higher.gs.com/roles/170644.
  - (A) BCG UK: graduate applications 9 Sep–18 Oct 2026; internships 1–24 Jan 2027.
  - (A) Bain London: closes 15 Oct 2026.
  - (B) Wonkhe/ISE 2026: employers are moving to "automated eligibility screening" and per-employer application limits.
  - (B) eFC (S. Butcher, 9 Feb 2026): "record high applications and record low acceptance rates".
- **Fix**: Replace doc §7 bullets with these dated facts. Add a scorer UX note: when the tracked job's `opens`/`rolling` flag is set, label CV fixes "fix before applying — this scheme fills on a rolling basis". With per-firm caps, the relevance rules (FCQ-10) should push division choice before tailoring.

### 24. Bain London misdescribed as a "penultimate-year ACI"
- **Severity**: P2 · **Type**: wrong
- **Where**: doc `:38` ("Bain London: penultimate-year ACI, no cover letter, full grades"), `:244` (summer programmes "for penultimate-year students: … Bain London ACI").
- **Evidence**: (A) Bain London University Hiring is for final-year students or those with "less than two years of experience in industry since graduation"; no cover letter; "as much detail as possible about your qualifications and grades"; online assessment of "numerical aptitude, logical reasoning, and behavioural preferences".
- **Fix**: Correct both lines. Add Bain's assessment and AI policy to the source note.

### 25. "216 UCAS points (A\*A\*A\*A, sic: that is 3A\*+A)" is confused, and UCAS points shouldn't be suggested for CVs
- **Severity**: P3 · **Type**: wrong / copy
- **Where**: doc `:78`; `sources.ts:84` (F_S7_UCAS "unverified").
- **Evidence**: The eFC guide p.24 says: "although banks don't stipulate A level grades, it will help if you have 216 UCAS points (A*A*A*A)". A\*A\*A\*A is three A\*s and an A (56×3+48=216), so the "sic" is wrong. The figure is now verified in the source, though it is still a C claim. TARGETjobs (2 May 2025) instead says "120–136 UCAS points" for many banks; that article also says MBB require "a first-class degree", which contradicts BCG's own "2:1". Treat both as unreliable.
- **Fix**: Delete the UCAS figure from rule text. CV copy: "List A-level (or IB/Highers) grades by subject; don't convert them to UCAS points." Keep UCAS only in the Big 4 / apprenticeship form checklist (Deloitte BrightStart requires 104 UCAS points).

### 26. FIN-12's "unexplained gaps" red flag is a fairness risk
- **Severity**: P2 · **Type**: fairness
- **Where**: `finance.ts:192-193`.
- **Evidence**: Equality Act 2010 s.15 (discrimination arising from disability) (A, https://www.legislation.gov.uk/ukpga/2010/15/section/15). Cambridge (A) routes circumstances to the additional-information box, not the CV. No finance source in the doc supports penalising student gaps; the only citation is the 2015 eFC piece.
- **Fix**: Remove "unexplained gaps" from FIN-12. If dates show a gap of ≥ 6 months, give a neutral tip: "If you took time out, a one-line entry (e.g. 'Career break — caring responsibilities') is fine; you never have to explain health reasons."

### 27. The "AI-generic" rules lack the 2026 evidence that firms actively check
- **Severity**: P3 · **Type**: stale
- **Where**: FCQ-12, CON-13.
- **Evidence**:
  - (A) ISE 2025 (Isherwood): frequent cheating rose "from 7% last year to 15% this year"; undisclosed AI in interviews was "cited by 61% of respondents".
  - (B) Wonkhe/ISE 2026: 92% suspected or identified cheating.
  - (C) eFC 2026: "A lot of recruiting teams turn off matching software on their ATS". The same article says hiring managers are "actively penalising AI-generated applications" (vendor quote).
  - PwC UK states it reviews submissions for "indicators of AI support" (search index only; pwc.co.uk 403).
- **Fix**: Keep FCQ-12 minor (major for CON is unsupported). Cite ISE 2025 and Bain, and drop the vendor quote.

### 28. The "Big 4" caveat sits under finance_banking, so audit/tax applicants get banking-template rules
- **Severity**: P2 · **Type**: implementation
- **Where**: `profiles.ts:35-36` (finance caveat mentions Big 4); FIN-01/FIN-07 (`finance.ts:109-115,154-161`) demand a banking template and DCF/LBO/Bloomberg skills.
- **Evidence**: Deloitte, PwC and EY use form-plus-tests routes (A, #13). The FIN keyword bank (doc `:94-101`) has no audit/assurance vocabulary.
- **Fix**: Route Big 4 audit, tax and assurance jobs to `consulting` + `variant: "B4"`, or to a new `professional_services` archetype. Make FIN-07 `not_applicable` for B4.

### 29. CON-03 and CON-09 are graded A but rest on generic statements
- **Severity**: P3 · **Type**: unsupported
- **Where**: `finance.ts:325-333` (CON-03 A), `:374-381` (CON-09 B, "~25 words").
- **Evidence**: McKinsey's "strong intellectual abilities and rigor" (search-indexed, B) doesn't establish a problem→analysis→recommendation bullet arc. TARGETjobs on McKinsey (B, 2025): "Always use language that is clear to any reader" supports CON-09's principle but not the word count.
- **Fix**: CON-03 evidence becomes D (synthesis), still major. CON-09 drops the 25-word cap from the LLM question; `bullet_length` (G-23) already covers length.

### 30. The doc names McKinsey, BCG and Bain recruiting pages, but their stated hiring facts never reach the rules
- **Severity**: P3 · **Type**: missing
- **Where**: CON-01 cites BCG and Bain, but tests and windows aren't surfaced.
- **Evidence**:
  - (A) BCG UK: "we'll invite you to complete a short numerical assessment, which forms part of your application".
  - (B) TARGETjobs: McKinsey uses Solve ("there is no need to prepare") and the cover letter is optional.
  - (B) Oliver Wyman (TARGETjobs, J. Barrett, 13 May 2025): five stages, starting with an online test.
  - (B) McKinsey CEO, via Fortune Jan 2026: the firm is "looking more at liberal arts majors".
- **Fix**: Feed these into SECTOR_CAVEATS for consulting: "MBB and tier-2 firms read your CV, but most also send a numerical/logic test straight after you apply — practise before you submit." For CON-08 (non-STEM analytics), add the McKinsey liberal-arts quote, so non-STEM students aren't told consulting is out of reach.

## New rules / signals to add

**FIN-15: Deal and transaction bullets** (finance_banking; LLM; major; evidence B/C)
- **Text**: "Describe deal work at your real level ('built comps for a £300m sell-side in UK healthcare'). Only name a client or deal if it has been publicly announced; otherwise use sector, deal type and a rounded size."
- **Pass**: "Prepared trading comps and a precedent-transactions table for an announced £1.2bn UK infrastructure acquisition."
- **Fail**: "Led the sale of [named unannounced company]" / "Executed a $2bn M&A deal" (intern).
- **Guidance**: Flag a verb above "supported/prepared/built" for intern roles. Flag named targets with no "announced/public" signal as a confidentiality risk. This is a warning, never an accusation.
- **Sources**: eFC 2022 (C); TARGETjobs IB template (B); UK MAR Art. 10 (A).

**FIN-16: Spring week / insight listing** (FCQ; LLM; minor; D + B)
- **Text**: "List a spring week or insight programme under Experience with dates and one or two bullets on what you did (e.g. 'pitched a case to an MD panel; team placed 2nd of 8'), not just 'attended'. Once you have an internship, shrink it to one line."
- **Pass**: "Spring Week, Barclays (Apr 2026): rotated through DCM and Equities; presented a 5-slide ESG bond pitch to a VP panel."
- **Fail**: "Attended Barclays Spring Week."
- **Sources**: TARGETjobs 2025 (B); Purple CV (C).

**UK-01: US-format conventions on a UK application** (all; code + LLM; minor; C)
- **Detect**: page size 612×792pt (US Letter) where the target country is UK; tokens `\bGPA\b` with a UK university, `\bClass of 20\d\d\b`, `\b(sophomore|junior|senior) year\b`, `\bSAT\b|\bACT\b`, `Relevant Coursework` with more than 8 modules, `Objective:`.
- **Text**: "This looks like a US-style résumé. For UK applications use A4, state your UK classification (or predicted grade), and drop GPA/SAT unless the firm asks."
- **Sources**: eFC 2023 template (C); Imperial and LSE (A); OW US posting (B, US).

**AI-POL-01: Firm AI-policy notice** (all; employer table; blocker-style notice, not scored)
- **Behaviour**: see Finding 1.
- **Pass**: no policy, or `refine_ok`.
- **Notice**: `grammar_only` / `declaration`.
- **Sources**: Bain (A), McKinsey via Fortune (B), The PSC (A), Barclays (A), ISE 2026 (B).

**PHOTO-01: Photo detector** (all; code; major in FCQ, minor elsewhere; A). Spec in Finding 4.

**FORM-01: Form readiness checklist** (consulting-B4, insight/spring; not scored; A)
- **Items**: grades exactly as on the transcript (incl. GCSE Maths/English where asked); A-level subjects; extenuating circumstances drafted; test practice done. These replace CV weight for Deloitte, PwC and EY routes.
- **Sources**: Deloitte (A), Cambridge (A), TARGETjobs (B).

**GRADE-PARSE: Structured grade parser.** Replaces the `uk_grades` regex. Spec in Finding 2.

## Rules to delete or downgrade

| Rule | Action | Reason |
|---|---|---|
| QNT-09 | Delete | Duplicate `page_count` (third copy). Keep the cover-letter-paragraph note in FCQ-01 guidance. |
| FCQ-03 | Re-point to the new `photo_present` checker | Currently a duplicate of G-17/GEN-01 that never detects photos. |
| FIN-02 | Change to LLM "A-level/IB grades listed", merge with G-33 | Duplicate `uk_grades`. |
| CON-01, QNT-12 | Delete; express as `sectorAdjust`/`variantAdjust` on FCQ-04 | Duplicates. |
| CON-04 | Delete; make it a consulting threshold on FCQ-08, minor | Fourth copy of `quantified_bullets`; "critical" unsupported. |
| G-11, G-22, GEN-04, G-25, GEN-06, G-32 | Superseded in FCQ sectors | Double counting (Finding 3). |
| FCQ-07 | Drop the sans-serif clause; grade B on Warwick only | Vendor claim. |
| FIN-09 | Minor, D, `convention`; fix redaction interaction | No source; fails native speakers. |
| FIN-13 | Downgrade to C; re-source | Dead link; 2019 brochure. |
| FIN-12 | Remove "unexplained gaps"; narrow GCSE clause | Fairness; contradicts LSE/G-33. |
| CON-02, CON-04 (critical) | Major by default; critical only for `variant=MBB` | Big 4 mis-scored. |
| CON-03 | Evidence A → D | Synthesis. |
| FCQ-08 / CON-04 thresholds | Evidence A → D; one threshold | No source sets percentages. |

## Open questions
- **PwC UK's exact candidate AI policy.** pwc.co.uk returns 403 to bots. A search snippet says PwC UK reviews submissions for "indicators of AI support", and PwC US says it wants "authentic responses". Re-check manually before seeding the AI-policy table.
- **Current KPMG UK grade bar.** Only the Times Top 100 (2024–25) "2:1" was found via search; it wasn't opened.
- **AI-use statements from the banks.** GS, JPM, MS, Citi, BofA, Rothschild, Lazard and Evercore pages fetched or searched show no statement on CVs (Barclays covers interviews only). Absence isn't permission.
- **Bright Network IB/consulting CV pages** (F_S9, F_S28) return 403. The "2017 template" date can't be re-verified.
- **Whether bulge-bracket spring-week tests are sent before or after CV screening.** Practitioner sources disagree; no bank states it. This affects how much CV weight to show first-years.
- **How jobs map to archetypes for Big 4 audit/tax.** Not traced in code in this audit (Finding 28 assumes they fall under finance_banking, based on the caveat text).
- **The spelling judge on finance jargon** (e.g. "CapIQ", "EBITDA", "LBO"). It wasn't tested, but with triple spelling rules plus a cap, false positives here would be costly.

## Sources

| # | Source | Publisher, date | URL | Grade | Verified |
|---|---|---|---|---|---|
| 1 | Banking & Financial Markets Short Guide 2025–26 | Univ. of Cambridge Careers, 2025 | https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf | A | PDF read |
| 2 | Management & Strategy Consulting Quick Guide | Univ. of Cambridge Careers, 2024 | https://www.careers.cam.ac.uk/files/management_strategy_consulting_-_quick_guide_to_recruitment_2024.pdf | A | PDF read |
| 3 | Resume Advice transcript | Goldman Sachs, undated (US video) | https://www.goldmansachs.com/careers/materials/Resume-Advice-Transcript.pdf | B | PDF read |
| 4 | 2027 EMEA London Engineering Summer Analyst | Goldman Sachs, 2026 | https://higher.gs.com/roles/170644 | A | fetched |
| 5 | Hints and tips | Barclays, undated | https://search.jobs.barclays/hints-and-tips | A | fetched |
| 6 | How we hire | JPMorganChase, live 2026 | https://www.jpmorganchase.com/careers/how-we-hire | A | fetched |
| 7 | 2027 UK Global Advisory Summer Analyst | Rothschild & Co, Aug 2026 | https://www.rothschildandco.com/en/careers/students-and-graduates/opportunities/2027-uk-global-advisory-summer-analyst-programme-london/ | A | fetched |
| 8 | London recruiting (University Hiring, AI policy) | Bain & Company, live Oct 2026 | https://www.bain.com/careers/recruiting/london-recruiting/ | A | fetched |
| 9 | Associate jobs: United Kingdom | BCG, live 2026 | https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs | A | fetched |
| 10 | How to get hired at McKinsey (career-page AI guidance) | Fortune, J. Angelo, 14 Jan 2026 | https://fortune.com/2026/01/14/how-to-get-hired-at-mckinsey-ai-tools-liberal-arts-creativity | B | fetched (McKinsey page timed out) |
| 11 | AI policy for Early Career Consultant Recruitment 2025 | The PSC, Sep 2025 | https://thepsc.co.uk/downloads/AI_policy_for_Early_Career_Consultant_Recruitment.pdf | A | PDF read |
| 12 | Early Careers Application | Deloitte UK, live 2026 | https://www.deloitte.com/uk/en/careers/early-careers/early-careers-application.html | A | fetched |
| 13 | PwC removes 2:1 requirement | Consultancy.uk, 22 Aug 2022 | https://www.consultancy.uk/news/32093/pwc-removes-21-requirement-for-graduate-staff | B | fetched |
| 14 | PwC removes 2:1 criteria (press release, 14 Aug 2022) | PwC UK | https://www.pwc.co.uk/press-room/press-releases/corporate-news/pwc-removes-2-1-criteria-for-undergraduate-and-graduate-roles-to.html | A | 403; date via search index |
| 15 | EY drives social mobility by removing academic entry criteria | Cambridge Network, 3 Feb 2017 | https://www.cambridgenetwork.co.uk/news/ey-drives-social-mobility-removing-academic-entry-criteria | B (old) | fetched |
| 16 | Early careers recruitment in 2025 (ISE survey) | Prospects Luminate, S. Isherwood, Oct 2025 | https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards | A | fetched |
| 17 | A slightly better outlook for graduate jobs (ISE 2026) | Wonkhe, D. Kernohan, 14 Oct 2026 | https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs | B | fetched |
| 18 | CVs | LSE Careers, live 2026 | https://info.lse.ac.uk/current-students/careers/information-and-resources/application-process/cvs | A | fetched |
| 19 | CVs | Warwick Careers, live 2026 | https://warwick.ac.uk/services/careers/applications/cvs/ | A | fetched |
| 20 | CVs and resumes | Imperial Careers, live 2026 | https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/cv/ | B | fetched |
| 21 | Generative AI | Imperial Careers, live 2026 | https://imperial.ac.uk/careers/applications-and-interviews/generative-ai | B | fetched |
| 22 | Financial market CVs | Lancaster LUMS Careers, P. McCormick, 31 May 2024 | https://www.lancaster.ac.uk/lums/careers/blogs/financial-market-cvs | B | fetched |
| 23 | ATS: stop trying to beat the system | Univ. of Nottingham Careers, B. Dooley, 8 Sep 2026 | https://www.nottingham.ac.uk/careers/students/career-insights/ats-stop-trying-to-beat-the-system-and-focus-on-what-really-matters.aspx | B | fetched |
| 24 | What is a spring week, insight day or insight programme? | TARGETjobs, A. Lewis, 2 May 2025 | https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme | B | fetched |
| 25 | Applying to McKinsey: CVs, cover letters and interviews | TARGETjobs, J. Barrett, 19 May 2025 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/applying-mckinsey-company-cvs-cover-letters-and-interviews | B | fetched |
| 26 | Oliver Wyman interview questions and application process | TARGETjobs, J. Barrett, 13 May 2025 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/oliver-wyman-interview-questions-and-tips-application-process | B | fetched |
| 27 | Do A levels matter for jobs? | TARGETjobs, 2 May 2025 | https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/do-levels-matter-jobs | B− (internal contradictions) | fetched |
| 28 | Inside Knowledge: Careers in Banking & Financial Markets 2025/26 | eFinancialCareers (Imperial-hosted), Sep 2025 | https://www.imperial.ac.uk/media/imperial-college/administration-and-support-services/careers-service/public/resources/efinancialcareers-Careers-in-Banking-and-Financial-Markets-2526.pdf | C | PDF read (pp.22–26) |
| 29 | How to write a banking CV | eFinancialCareers, Z. Toulon, 17 Jun 2026 | https://www.efinancialcareers.com/news/the-absolutely-perfect-investment-banking-cv | C | fetched |
| 30 | Investment banks may hire record graduates in 2026 | eFinancialCareers, S. Butcher, 9 Feb 2026 | https://www.efinancialcareers.com/news/investment-banks-may-hire-record-graduates-in-2026-getting-a-job-could-be-harder-than-ever | C | fetched |
| 31 | What NOT to put on your banking CV | eFinancialCareers, Z. Toulon, 21 Nov 2022 | https://www.efinancialcareers.com/news/2022/11/what-not-to-put-banking-cv | C | fetched |
| 32 | Investment banking CV template | eFinancialCareers, Z. Toulon, 29 Sep 2023 | https://www.efinancialcareers.co.uk/news/2023/09/investment-banking-cv-template | C | fetched |
| 33 | Interviewing | Jane Street, live 2026 | https://www.janestreet.com/join-jane-street/interviewing/ | A | fetched |
| 34 | Recruitment process (APAC) | IMC Trading, live 2026 | https://www.imc.com/ap/careers/recruitment-process | A (APAC) | fetched |
| 35 | Market Abuse Regulation Art. 10 | legislation.gov.uk | https://www.legislation.gov.uk/eur/2014/596/article/10 | A | fetched |
| 36 | Equality Act 2010 ss.9, 15 | legislation.gov.uk | https://www.legislation.gov.uk/ukpga/2010/15/contents | A | known statute |
| 37 | Oliver Wyman US consultant posting (GPA, SAT/ACT) | via RippleMatch/Greenhouse | https://job-boards.greenhouse.io/ripplematchinterns/jobs/8040099002 | B (US) | search index only |
| 38 | BlackRock EMEA 2019 campus brochure ("students of the market") | BlackRock via LUISS | https://oldcontent.luiss.it/sites/www.luiss.it/files/BlackRock%20EMEA%202019%20Campus%20Programmes%20-%20Digital%20Brochure.pdf | C (old) | search index only |
| 39 | BlackRock EMEA early careers (old deep link) | BlackRock | https://careers.blackrock.com/early-careers/emea/ | n/a | dead (redirects to root) |
| 40 | PwC Guidance for Candidate Use of AI (US) | PwC US | https://www.pwc.com/us/en/careers/candidate-AI.html | B (US) | 403; search index only |
| 41 | EMEA Early Insight FAQ (legacy 2016) | Morgan Stanley | https://www.morganstanley.com/people-opportunities/emea-early-insight-faq | C (stale) | live (200) |
| 42 | The perfect graduate CV for investment banking (2015) | eFinancialCareers | https://www.efinancialcareers.com/news/graduate-guide/the-perfect-graduate-cv-for-investment-banking | C (stale) | live (200) |
