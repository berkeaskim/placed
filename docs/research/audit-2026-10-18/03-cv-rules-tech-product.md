# Tech, Product, Data & Quant CV Rules audit

**Overall grade: C.** Auditor 03, 2026-10-18.

1. The research doc is honest about its gaps, and most SWE advice points the right way: projects, stack, outcomes, X-Y-Z bullets, evidenced skills. The shipped code, though, hardens several North American conventions into penalties that UK sources don't support. The biggest are 1-page-only for SWE, GitHub as a "major" requirement, and a 2:1-centric grade checker that misreads Master's and international grades.
2. The code checkers behind the highest-weight SWE/DAT rules have measurable false-positive and false-negative paths. `github_link` passes on the word "portfolio" or "Socket.io" and fails Kaggle/Tableau/HF links. `uk_grades` passes a bare "A-levels" or "72%" module mark and fails "Distinction" or "GPA 3.8/4.0".
3. The LLM judge receives no job description, year of study or sub-track. Every conditional rule ("for DS roles", "for quant research or dev roles", "unless the advert asks") therefore asks the model to guess.
4. The same signal is scored two or three times. Skills-evidence is checked by SWE-11, EV-03 and GEN-07; uk_grades by G-32 and SWE-15; quantification by G-22 and GEN-04; rating glyphs by G-05 and SWE-09. 1st-years get contradictory thresholds on top of that.
5. AI-era coverage is thin. SWE has no AI-skills rule, though the best available evidence (a 1,725-recruiter UK/US/DE conjoint) shows AI skills raise SWE interview odds. DAT-12 rests on a mis-cited statistic. Product rules are mostly grade D, with no PM-scarcity caveat. Quant-dev candidates have no profile at all.

## Scorecard

| Dimension | Grade | Reason |
|---|---|---|
| Evidence quality | C | Core SWE rules cite one Canadian Google workshop recap (2025), McDowell (2015) and TARGETjobs. Several "A" grades rest on sources that actually say something softer (TARGETjobs: "one or two full pages", portfolio optional). PRD-02/03/04/08/09 and DAT-03/04/11 are D. |
| Freshness | B− | Most sources date from 2025–26. But the RSS data-scientist page is dated (Hadoop/Java/C#), the Strathclyde booklet URL is dead (HTTP 500), the 81% GPT stat is misapplied, and the ISE 2026 AI figures aren't reflected. |
| Coverage | C | Missing: AI-tool skills for SWE, project authorship in the AI era, a quant-dev profile, A-level Maths/Further Maths for quant, placement-year/industrial-placement handling, international/Master's grade formats, the 2nd-year-of-4 cohort, PM scarcity caveat. |
| Implementation fidelity | D | Checker regexes contradict their rule statements (SWE-15, SWE-09, SWE-10, DAT-06). Statements promise checks that never run (SWE-17 dead links/references/colours). The judge lacks the context its conditionals need. Rules are double-counted. Year adjustments are partly wrong (QNT-02 skipped for 1st years). |
| Consistency | C− | SWE-01 (1 page, 2 = partial fail) contradicts G-11 (2 pages), the myth M4 and TARGETjobs. G-22 vs GEN-04 give 1st years different thresholds. The checker's fix text asks finalists for A-levels while doc §7 says drop them. |
| UX / copy | C | Several statements overclaim ("'99% accuracy'… looks like leakage", "Founder signals rank highly" with no source). The "university email only" red flag can't be judged because emails are redacted before judging. |

## Findings

### 1. SWE-01 forces a US one-page norm on UK SWE CVs
- **Severity:** P0. **Type:** wrong / contradiction.
- **Where:** `lib/cv-rules/rules/tech.ts:23` (SWE-01, `maxPages: 1`, evidence A); `lib/cv-score/checkers.ts:84-89` (2 pages when max=1 → `partial`); doc `docs/research/cv-rules-tech-product.md:62`.
- **Current:** "Keep internship CVs to one full page". A 2-page CV scores `partial` on a major/A rule. The `llmGuidance` ("2 full pages = acceptable at UK firms") is never read, because this is a code rule.
- **Evidence:**
  - TARGETjobs technical CV guide (B, 26 Nov 2025, https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice): a CV "should be either one or two full pages long."
  - Prospects / Chester careers (B, May 2025, https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/how-to-write-a-cv): "We recommend CVs are no longer than two A4 pages."
  - The one-page evidence is North American. The Google recruiter workshop at U of Toronto (B−, secondary recap, 17 Sep 2025) says "Keep the resume to one page". Google's own student page reportedly says "Aim for one page" (search-indexed only; page is JS-rendered and couldn't be opened). Google's 2013 student blog allowed expansion for graduate degrees and papers.
  - The project's own myth M4 (`lib/cv-rules/myths.ts`) says "The UK norm is up to two A4 pages."
- **Fix:**
  - Set `params: { maxPages: 2 }` and evidence B.
  - Add a page-fill checker param `{ spilloverFailBelow: 0.5 }`: a last page under half full is `partial` with the fix "Either cut to one page or fill the second". 3+ pages is `fail` with severity critical.
  - Add a soft LLM/UI note: "US-headquartered firms (Google, Meta, Amazon, Jane Street) prefer one page for students."
  - Add `yearAdjust.masters` to allow 2 pages explicitly.

### 2. `uk_grades` misreads Master's and international grades
- **Severity:** P0. **Type:** implementation / fairness.
- **Where:** `lib/cv-score/checkers.ts:126-129`. Used by SWE-15 (`tech.ts:123`), G-32, QNT-12 and others.
- **Current:**
  - The regex passes on: `2:2`, any `\d{2}%` (e.g. one module mark "Econometrics (72%)"), the bare word "predicted", or "A-levels" with no grade at all.
  - It fails on: "Distinction"/"Merit" (UK MSc), "GPA 3.8/4.0", "CGPA 8.7/10", "1:1", "High Distinction", "Dean's List", "Honours".
  - The fix text always says "State your (predicted) degree classification and A-level/IB grades", including to finalists and Master's students.
  - The statement says pass requires "2:1 or above".
- **Evidence:**
  - Prospects (B, May 2025): include each qualification's "type, grade and dates".
  - Doc §7 (`cv-rules-tech-product.md:267`): "Degree classification; drop A-levels if space is tight" for final year.
  - International students are a large share of UK STEM/Master's cohorts and use GPA/percentage scales. Oxford Brookes issues a 4.0 GPA alongside the classification (https://www.brookes.ac.uk/students/your-studies/grade-point-average, B).
  - Equality Act 2010 s.19 indirect discrimination covers nationality (race) (A, https://www.legislation.gov.uk/ukpga/2010/15/contents). A grade checker that systematically fails foreign grade formats is a foreseeable indirect-discrimination risk.
- **Fix:** Rewrite as `degree_grade_present`.
  - Pass when the education entry for the current or most recent degree contains any of: `/\b(first|1st|2:1|2\.1|2:2|2\.2|third|upper second|lower second|distinction|merit|pass with (merit|distinction)|high distinction|honours|gpa\s*[:=]?\s*\d(\.\d+)?\s*\/\s*\d(\.\d+)?|cgpa\s*\d+(\.\d+)?\s*\/\s*10|\d{2}(\.\d)?\s*%\s*(average|overall|year|mean)|predicted|expected|on track for)\b/i`.
  - Scope it to the degree line, not any line.
  - Drop A-levels from the pass condition, and from the fix text for `final`/`masters`.
  - Change the statement to "State your degree grade, achieved or predicted, in your university's own format". Don't tie the pass to 2:1+; the "omit if below threshold" advice belongs in copy, not scoring.

### 3. `github_link` passes on bare words and misses data-portfolio hosts
- **Severity:** P0. **Type:** implementation.
- **Where:** `lib/cv-score/checkers.ts:131-133`; SWE-07 (`tech.ts:63`), DAT-06 (`tech.ts:184`).
- **Current:** `/(github\.com|gitlab\.com|\.dev\b|\.io\b|portfolio)/i` over the whole CV text.
  - **False passes:** "Portfolio Management Society", "investment portfolio", "Portfolio website (project)" with no URL, "Socket.IO" or "socket.io" in a stack line, "web.dev".
  - **False fails:** kaggle.com, public.tableau.com, huggingface.co, *.streamlit.app, observablehq, personal domains such as priyashah.co.uk. These are exactly the links DAT-06's statement asks for, and the doc's own regex (`cv-rules-tech-product.md:121`) included them.
- **Evidence:** DAT-06 statement: "GitHub with notebooks, a Kaggle profile, Tableau Public, or a Streamlit / Hugging Face Spaces demo." The PII layer already recognises kaggle/huggingface/behance (`lib/cv-score/pii.ts:36`).
- **Fix:**
  - Match only on `c.cv.links` plus URL-shaped tokens: `/\b(?:https?:\/\/)?(?:www\.)?(github\.com|gitlab\.com|bitbucket\.org|kaggle\.com|huggingface\.co|public\.tableau\.com|[a-z0-9-]+\.streamlit\.app|observablehq\.com|codeberg\.org|devpost\.com)\/[A-Za-z0-9_.-]+/i`.
  - Add a personal-domain fallback: a link whose host isn't linkedin.com.
  - Remove the bare `portfolio`, `.io` and `.dev` alternatives.
  - Make DAT-06 pass on any of these. Keep SWE-07 passing on any code host, devpost, or a personal domain.

### 4. SWE-07 makes a GitHub link a major requirement; UK sources treat it as optional
- **Severity:** P1. **Type:** unsupported / wrong (US import).
- **Where:** `tech.ts:63` (major, B; 1st-year minor); doc `:68` (graded A).
- **Current:** "Add a GitHub link… and/or a portfolio or live demo URL", scored major.
- **Evidence:**
  - TARGETjobs (B, Nov 2025) frames it as optional: you can add "a link to your LinkedIn profile and/or a link to an online portfolio". If you do, it must contain "up-to-date examples of your work".
  - Prospects' technical CV example (B, May 2025) contains no GitHub URL at all.
  - Only the Toronto Google recap calls GitHub "must-have".
  - Research on GitHub as a hiring signal is qualitative. Marlow & Dabbish, CSCW 2013 (A-, peer-reviewed interviews, https://www.cs.cmu.edu/~xia/resources/Documents/Marlow-cscw13.pdf): employers saw profile traces as "more reliable indicators… than information provided on a resume". The same work notes employers only check traces that are quick to verify.
  - No callback field experiment exists (searched; none found).
  - In 2025–26, practitioner reports (C) say some hiring managers discount GitHub for juniors because of AI-generated repos.
- **Fix:**
  - Severity minor for all years; evidence B.
  - Statement: "If you have public code or a live demo, link it in your header. An empty or stale profile is worse than none."
  - Add LLM guidance to SWE-05/06 so projects without links still pass when contribution and outcome are described. The Google recap itself says to describe private work instead.

### 5. The LLM judge gets none of the context its conditional rules depend on
- **Severity:** P1. **Type:** implementation.
- **Where:** `lib/ai/judgeCvRules.ts:44-56` sends only `llmGuidance` + examples + CV. `lib/cv-score/run.ts:66-71` passes no year, job description or sub-track.
- **Current:** Many rules branch on information the model doesn't have:
  - DAT-02 "for the sub-track… analyst… data scientist"
  - DAT-12 "unless the job description requires them"
  - QNT-03 "For quant research or dev roles… (For quant trading roles, answer yes…)"
  - QNT-11 "Not applicable for trading roles"
  - MKT-10 "For growth roles"
  - RES-09 "For academic research placements that ask for referees"
  - RES-10 "For industry ML research internships"
  - SWE-08's 1st-year leniency (doc §7 "partial XYZ (X+Z) accepted"), which exists only as a severity change, not as a judging instruction.
- **Evidence:** Code inspection. The cache key (`run.ts:55-58`) also omits year, so a year change re-uses stale LLM verdicts.
- **Fix:**
  - Add to `JudgeInput` an optional `context: { year: Year; subTrack?: "analyst"|"ds"|"mle"|"qt"|"qr"|"qdev"|"growth"|"brand"|"res_academic"|"res_industry"; jobDescription?: string }`.
  - Render it as a `<target>` block in `buildJudgePrompt`.
  - Include year and subTrack in the cache key (`RULES_VERSION` bump).
  - Until then, rewrite every conditional so it's answerable from the CV alone. For example, QNT-03 becomes "Does the CV list at least one programming language with an honest proficiency word?"

### 6. One signal is scored up to three times, distorting the weights
- **Severity:** P1. **Type:** implementation / contradiction.
- **Where:** `lib/cv-rules/index.ts:9-11` (`rulesFor` merges all lists, no dedupe); `lib/cv-score/aggregate.ts` sums each rule independently.
- **Current:** For `software_eng`:

  | Signal | Rules scoring it |
  |---|---|
  | Skills evidence | SWE-11 (llm, major B) + EV-03 (code, major B for SWE via `sectorAdjust`) + GEN-07 (llm, major B) |
  | Degree grade | G-32 + SWE-15 (both `uk_grades`, major B) |
  | Quantification | G-22 + GEN-04 (both `quantified_bullets`) |
  | Rating glyphs | G-05 + SWE-09 (both `skill_rating_glyphs`) |
  | Skills count | G-31 + SWE-10 (both `skills_count`) |
  | Page count | G-11 + SWE-01 (`page_count` with different maxima) |

  An unevidenced skills list loses roughly three major rules' worth of relevance credit. The relevance dimension carries 35% of the SWE score (`profiles.ts:14`).
- **Evidence:** Code inspection. Doc §1 says GEN rules are "the cross-sector baseline… unless overridden", which implies override, not stacking.
- **Fix:**
  - Add `supersedes?: string[]` to `CvRule`. In `rulesFor`, drop any rule superseded by a sector rule present for that sector.
  - Declare: SWE-01 supersedes G-11; SWE-15 supersedes G-32; SWE-09 supersedes G-05; SWE-10 supersedes G-31; EV-03 supersedes SWE-11 (keep the code version, since it's deterministic). GEN-04 and G-22 should become one rule.

### 7. G-22 and GEN-04 give 1st years contradictory quantification thresholds
- **Severity:** P1. **Type:** contradiction.
- **Where:** `lib/cv-rules/rules/general.ts:182` (G-22, threshold 0.4, no `yearAdjust`); `general.ts:332` (GEN-04, 0.2 in 1st year / 0.5 final).
- **Current:** A 1st-year with 30% quantified bullets passes GEN-04 and fails G-22 in the same report.
- **Evidence:** Doc §7 table (`cv-rules-tech-product.md:266`) sets ≥20% for 1st year.
- **Fix:** Delete G-22, or give it GEN-04's `yearAdjust`. See the dedupe in finding 6.

### 8. DAT-12 rests on a mis-applied statistic; SWE has no AI-skills rule
- **Severity:** P1. **Type:** unsupported / missing.
- **Where:** `tech.ts:231-237` (DAT-12, cites T_S17); doc `:127` ("[S17] (81% of developers use OpenAI GPT models)").
- **Current:** "GenAI skills… are a bonus, not a requirement". The evidence is a usage statistic.
- **Evidence:**
  - Stack Overflow 2025 (B, https://survey.stackoverflow.co/2025/technology) reports OpenAI GPT at 81.4% *among LLM users*. That's a developer-usage figure, not a hiring signal.
  - The hiring evidence is Stephany, Teutloff & Leone 2026 (A−, conjoint, 1,725 recruiters in UK/US/DE, occupations include software engineering, https://arxiv.org/abs/2601.13286): "AI skills significantly increase interview invitation probabilities by approximately 8 to 15 percentage points". Certificates add only "a moderate increase… compared with self declaration". It's stated-preference, not observed callbacks.
  - GitHub Octoverse 2025 (B, https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/): "80% of new developers on GitHub use Copilot in their first week."
  - PwC 2025 AI Jobs Barometer UK release (B): an 11% UK wage premium for jobs requiring AI skills. The 56% figure is global, not UK.
- **Fix:**
  - Re-cite DAT-12 to Stephany + PwC UK and keep it minor. Change its guidance to "pass if evidenced; not_applicable if absent".
  - Add a new SWE rule, SWE-AI-01 (see New rules).
  - Never require certificates. That's consistent with EV-03 and Stephany.

### 9. No rule covers project authorship in the AI era
- **Severity:** P1. **Type:** missing.
- **Where:** SWE-05/06/17 (`tech.ts:47-61,134`); no rule covers authorship.
- **Current:** Tutorial clones are flagged. AI-generated whole projects aren't considered.
- **Evidence:**
  - Employers now test authenticity at interview rather than on paper. Google is reinstating "at least one round of in-person interviews… to make sure the fundamentals are there" (Pichai, Lex Fridman podcast, Jun 2025, via HCAMag; B−). Amazon disqualifies candidates using unauthorised GenAI in interviews (Business Insider via ITPro, 2025; B).
  - ISE 2026 survey (Guardian, 14 Oct 2026, via Resultsense; B): 92% of employers report suspected or confirmed cheating, 66% in interviews. 64% accept AI somewhere in hiring, "mainly for CVs and cover letters".
  - Monzo (A, employer, 29 Jan 2025, https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo): "Be prepared to talk in depth about projects you've worked on recently."
- **Fix:** Add PRJ-AUTH-01 (see New rules). It's an LLM rule asking whether each headline project states a decision or trade-off the candidate made, or a problem they debugged. Copy: "Expect to be asked about it in a live interview."

### 10. QNT-02 skips competition results for 1st years, who most need them
- **Severity:** P1. **Type:** wrong.
- **Where:** `lib/cv-rules/rules/finance.ts:225-232` (QNT-02 `yearAdjust: { "1st": { skip: true } }`).
- **Current:** Olympiad and competition results aren't scored for 1st years.
- **Evidence:**
  - Olympiad results (UKMT/BMO/IMO) are earned at school. They're most salient precisely when a 1st-year has little else.
  - XTX Markets lists "Olympiad medals in any quantitative field or contest (Kaggle, hackathons, academic contests etc.)" as a desirable in a Junior QR posting (B, posting via search index; Yerevan role, https://xtxmarkets.com/career/junior-quantitative-researcher). XTX was principal sponsor of IMO 2024 (UK) and funds olympiad-medallist scholarships (https://about.xtxmarkets.com/news/2026-xtx-markets-commits-to-global-talent-fund/, B).
  - QNT-02's cited F_S36 is eFinancialCareers, 2015 (stale).
- **Fix:**
  - Remove the skip.
  - Use `yearAdjust: { "1st": { severity: "minor" } }`, and have the judge return `not_applicable` when no competitions are listed. Absence shouldn't fail anyone, since many strong candidates never did olympiads.
  - Statement: "If you have a competition result, state the level reached (e.g. BMO Round 1 Merit, Codeforces 1900)".

### 11. No profile exists for quant developer or quant researcher candidates
- **Severity:** P1. **Type:** missing.
- **Where:** `lib/types.ts:1-4` (one `quant_trading` archetype); `lib/ai/heuristics.ts:13-15`. A title like "Quantitative Developer" ties on "quant"/"developer" and ARCHETYPES order puts `software_eng` first.
- **Current:**
  - A quant-dev applicant either gets QNT rules, whose trading-oriented conditionals the judge can't resolve (finding 5), or SWE rules.
  - SWE rules give no credit for maths grades, competition ranks or C++ depth.
  - SWE-12 doesn't ask for a stated result for competitions.
- **Evidence:**
  - Jane Street (A, https://www.janestreet.com/join-jane-street/interviewing/): "We don't have a GPA or degree requirement"; "You don't need to know OCaml".
  - IMC (A, https://www.imc.com/ap/careers/recruitment-process): "compare yourself to professionals and not fellow students"; "don't include your Word and Excel skills".
  - XTX trading-dev page (A): "favourite languages are C++ and Python".
- **Fix:** Add a `subTrack` for `quant_trading`: `qt`, `qr` or `qdev`. Pick it from the target role title (`/developer|engineer|software/` → qdev; `/research/` → qr; else qt). For qdev, inherit SWE-04/05/06/08/11/13 plus QNT-02/03/04/06, and add QDEV-01 (see New rules).

### 12. SWE-15 statement pushes students below 2:1 to hide their grade, then fails them for it
- **Severity:** P1. **Type:** fairness / copy.
- **Where:** `tech.ts:123-127`; also G-32 `general.ts:256`.
- **Current:** "needs… a stated grade of 2:1 or above (or predicted 2:1…)". Implied: below that, don't state it. But a missing grade fails the major rule.
- **Evidence:**
  - ISE via Luminate (A/B, Oct 2025, https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards): "47% of employers specifying a 2:1 degree and 20% accepting a 2:2". That's down from 71% in 2015/16.
  - Jane Street has no GPA requirement.
- **Fix:**
  - Score "grade stated (any)" as pass.
  - Show a non-scored tip: "If you're below 2:1, check each employer's threshold. Many tech and quant employers set none. Leading with modules and projects is legitimate."
  - Never fail a CV for an honest 2:2.

### 13. The SWE-09 checker never tests the grouping half of its statement, and misses common rating formats
- **Severity:** P2. **Type:** implementation.
- **Where:** `checkers.ts:122-125`, `checkers.ts:54-64`; SWE-09 `tech.ts:79`.
- **Current:**
  - Only glyph runs (★●■…) and "n/10" near a skill fail.
  - Missed: "Python (90%)", "Java – 4/5", "Advanced 85%", and image-based bars. The last can't be seen in text; it should be inferred from a skills section with images and no text levels.
  - "Group skills by category" is never checked for SWE. DAT-08 checks it via the LLM.
- **Evidence:** The doc's own detection spec (`cv-rules-tech-product.md:70`) lists `\d+%` next to a skill. TARGETjobs: give "some detail as to your level of aptitude" in the experience section rather than a rating.
- **Fix:**
  - Extend `ratingOutOf10` to `/\b\d\s*\/\s*5\b|\b\d{2,3}\s*%/` within 30 characters after a skill token.
  - Add a cheap grouping check: the skills section has ≥2 labelled groups (`/^[A-Z][\w &\/]+:/m`). Ungrouped = `partial`.

### 14. SWE-10's checker drifts from its statement
- **Severity:** P2. **Type:** implementation.
- **Where:** `checkers.ts:138-141`; SWE-10 `tech.ts:85`.
- **Current:** The statement says 8–20 items and "Drop Word and PowerPoint". The checker passes 5–30 and never looks for MS Office.
- **Evidence:** IMC (A): "We assume everyone can work with Microsoft Office so don't include your Word and Excel skills." TARGETjobs (B): avoid anything "outdated", keep it non-exhaustive.
- **Fix:**
  - Pass 6–25; give `partial` above 25 or below 6. The numbers are tunable, grade D.
  - Add `/\b(microsoft (word|office|powerpoint)|ms office|word, excel)\b/i` within the skills section to produce `partial` with the fix "Drop Office tools for software roles unless the advert asks". Keep Excel for analyst sub-tracks.

### 15. `projects_count` penalises 5+ projects and a single 1st-year project
- **Severity:** P2. **Type:** implementation.
- **Where:** `checkers.ts:162-165`; SWE-03 `tech.ts:35-40`.
- **Current:** `n>=2 && n<=4` passes; 1 or 5+ projects get `partial`. In 1st year only the severity drops, though the statement says "1–2 projects (coursework counts) are enough".
- **Evidence:** Doc §7 (`:265`): 1st year "1–2 projects". The Google recap: "Personal, class, and relevant non-coding projects can all be included." Prospects' example shows 3.
- **Fix:**
  - Use `thresholdFor` with a minimum of 2, and 1 for `1st`.
  - Above 4, pass with an advisory, never a deduction. Length is policed by SWE-01.
  - Count an `experience` entry tagged software as satisfying the rule when projects = 0 and a tech internship exists. Doc: "Zero projects plus no tech experience → major".

### 16. SWE-17 promises checks that never run, and one of them can't run
- **Severity:** P2. **Type:** implementation / copy.
- **Where:** `tech.ts:134-140`; `lib/cv-score/pii.ts:25-31` (emails replaced before judging).
- **Current:** The statement lists dead GitHub links, "references available on request", a university email only, and a colourful template. The `llmGuidance` drops dead links and references. The judge sees only a placeholder email, so "university email only" can't be assessed. Nothing measures colours.
- **Evidence:** Code inspection. The Google recap: "Use a personal email… so recruiters can reach you after you lose access to your school account."
- **Fix:**
  - Move "university email only" to a code check on `parsed.email` before redaction (`/\.ac\.uk$/i` with no other email → minor `partial`).
  - Add `/references (available )?(up)?on request/i` to a code check.
  - Delete "dead GitHub links" and "graphic-heavy template" from the statement until they're implemented. Template issues are already covered by G-rules on layout.

### 17. DAT-02 makes the analyst "core trio" major on a source that calls tools a bonus
- **Severity:** P2. **Type:** unsupported.
- **Where:** `tech.ts:152-158`; doc `:117`; citations T_S19, T_S20.
- **Current:** "Make the core toolkit visible: SQL + Python (or R) + Excel or a BI tool". Major, B.
- **Evidence:**
  - TARGETjobs data hub (B, live 2026, https://targetjobs.co.uk/graduate-jobs/it/data): non-specialists are accepted with "strong numerical, analytical, and problem-solving skills". "Experience with tools like SQL, Python, R, or Excel is a bonus."
  - RSS page (B−, undated) names Java/C#/Hadoop, which is dated for graduate analyst roles.
- **Fix:**
  - Make it major only when a job description lists the tool (needs finding 5). Otherwise minor.
  - Replace T_S20 with a current source, or mark it "dated".
  - Statement: "Show the tools the advert asks for in a bullet, not just your skills list."

### 18. DAT-05 cites sources that don't mention communication
- **Severity:** P2. **Type:** unsupported.
- **Where:** `tech.ts:176-182`; doc `:120`.
- **Current:** "Communicating with non-technical audiences is a repeatedly cited skill" [S19][S20][S4].
- **Evidence:** On verification, the TARGETjobs data hub doesn't mention communication. The RSS page doesn't either. The Amazon page (A, https://www.aboutamazon.com/news/workplace/successful-amazon-job-candidates) is about "measurable data" and scope, not non-technical audiences.
- **Fix:** Keep the rule. It's sound practice, but downgrade to C. Drop the "repeatedly cited" claim. Cite Amazon only for "highlight measurable data".

### 19. DAT-01 is major for all data roles, though TARGETjobs accepts non-specialist degrees
- **Severity:** P2. **Type:** fairness / unsupported.
- **Where:** `tech.ts:144-150`.
- **Current:** Major. Fail example: "BA English with no quantitative modules".
- **Evidence:** TARGETjobs data hub (B): "some schemes accept graduates from non-specialist backgrounds" with strong numerical skills.
- **Fix:**
  - Guidance: "Does the CV show quantitative ability through a degree, modules, OR applied projects/experience with numbers?"
  - Severity minor for analyst and major for DS/ML via `subTrack`.

### 20. SWE-08 is graded A on a single 2014 Google formula
- **Severity:** P2. **Type:** stale / US import.
- **Where:** `tech.ts:69-77`; GEN-03; doc `:69`.
- **Current:** "Write X-Y-Z bullets", A, major.
- **Evidence:**
  - X-Y-Z is Bock 2014, restated in a 2018 CNBC video and the Toronto recap 2025 (B). It's a good heuristic but a single employer's convention.
  - UK careers services teach STAR/CAR. The National Careers Service (A, gov.uk, https://nationalcareers.service.gov.uk/careers-advice/interview-advice/the-star-method) says STAR can show experience "on a CV or application form".
  - Amazon asks for "measurable data" (A).
- **Fix:**
  - Rename to "Action + result bullets". Accept X-Y-Z, CAR or STAR-compressed forms. Evidence B.
  - Keep `allowPartial`.
  - Add the 1st-year leniency to the guidance text, not only to severity.

### 21. DAT-04 overclaims in its copy
- **Severity:** P2. **Type:** copy.
- **Where:** `tech.ts:168-174`.
- **Current:** "\"99% accuracy\" with no baseline or context looks like leakage." Evidence D, no citation, major.
- **Evidence:** This is standard ML-evaluation practice, but no CV-specific source. Accusing a student of leakage is harsh UX when the cause may be a balanced toy dataset.
- **Fix:**
  - Copy: "Give the metric context: a baseline, the class balance, or a held-out test set. A bare '99% accuracy' invites questions."
  - Severity minor until a source is found.

### 22. Product rules are mostly grade D, scored major, with no scarcity caveat
- **Severity:** P2. **Type:** unsupported / missing.
- **Where:** `tech.ts:246-308`; doc `:154`; `lib/cv-rules/profiles.ts:32-37` (no `product` caveat).
- **Current:**
  - PRD-02 (C), PRD-03 (D), PRD-04 (D) and PRD-09 (D) are major.
  - PRD-08 "Founder or builder signals rank highly" has no source.
  - Students rarely have DAU/MAU, retention or n= user research, so absence fails three majors.
- **Evidence:**
  - The Capital One graduate PM account (B, TARGETjobs, undated, https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one) stresses "teamwork, analytical thinking, communication" and says "a tech background is not necessary". It doesn't mention product metrics vocabulary.
  - The doc itself says "UK entry-level PM roles are scarce". Google APM/Meta RPM London intake is unverified in 2026 searches (aggregators conflict).
- **Fix:**
  - Merge PRD-03 and PRD-04 into one "evidence of user/metric thinking (any of: a metric attached to an outcome, user research with n)" rule, minor.
  - PRD-08 becomes `not_applicable` when absent and loses "rank highly".
  - Add `SECTOR_CAVEATS.product`: "Graduate PM schemes are few in the UK; most entry routes are analyst, operations or tech-consulting roles. Apply to adjacent roles too."

### 23. The judge prompt omits the rule statement
- **Severity:** P2. **Type:** implementation.
- **Where:** `judgeCvRules.ts:46-49`.
- **Current:** Only `llmGuidance` is sent. Where it narrows the statement, users see one standard and are judged on another:
  - SWE-12's guidance accepts "personal project" as a passion signal, so any SWE CV with a project passes. The rule then gives a 1st-year no differentiation.
  - SWE-11's ">half" threshold isn't in its statement.
- **Fix:**
  - Audit each statement/guidance pair so the guidance encodes the statement's full pass condition.
  - For SWE-12, require something beyond the coursework and projects already credited by SWE-03: a hackathon, society, open source, competition with a result, or TA/tutoring.

### 24. Year adjustments ignore the "2nd" year value
- **Severity:** P2. **Type:** implementation / missing.
- **Where:** `lib/types.ts:18` (`YEARS` includes "2nd"); no tech rule has a `yearAdjust["2nd"]`.
- **Current:** A 2nd-year on a 4-year MEng/MSci (insight/STEP-equivalent per doc §7 `:260`) gets full penultimate severity on SWE-03/07/08 and DAT-06.
- **Evidence:** Doc §7 says insight schemes target "second years on 4-year courses". Google's 2025 EMEA STEP listing required "1st year… if enrolled on a 3 year Bachelors… or 2nd year… 4 year" (via search index, B−). As of Oct 2026, STEP's page reportedly redirects; the 2026–27 status is unverified.
- **Fix:** Add an `effectiveYear()` helper that maps `2nd` + `courseLength: 4` to the `1st` adjustments. If course length is unknown, treat `2nd` like `1st` for minor-ising rules only.

### 25. The 3+ page critical escalation and SWE-15's date check aren't implemented
- **Severity:** P2. **Type:** implementation.
- **Where:** `checkers.ts:84-89` (fail stays at rule severity); doc `:62` ("3+ pages critical"); doc `:76` ("degree + date + grade present").
- **Fix:**
  - Allow checkers to return a severity override (`Out.severity?`). `page_count` returns critical at ≥ `max+2`.
  - Extend `degree_grade_present` (finding 2) to require an end or expected date on the degree entry. Otherwise `partial`, with the fix "Add your expected graduation (e.g. Expected Jun 2027)".

### 26. `project_stack` fails legitimate non-code projects
- **Severity:** P3. **Type:** implementation.
- **Where:** `checkers.ts:166-172`.
- **Current:** A project counts as stack-free if no vocabulary term appears. Hardware, robotics or research projects, or tools missing from the vocabulary (Copilot, Cursor and Socket.IO aren't in `lib/skills/vocab.ts`), fail.
- **Evidence:** The Google recap: "relevant non-coding projects can all be included."
- **Fix:**
  - Return `not_applicable` for projects tagged non-software by the parser.
  - Add AI dev tools (GitHub Copilot, Cursor, Claude Code, ChatGPT API) to the vocabulary under an `ai_tools` group.

### 27. One citation URL is dead and four are unverifiable
- **Severity:** P2. **Type:** stale.
- **Where:** `lib/cv-rules/rules/sources.ts:60` (T_S15 Strathclyde, HTTP 500 on 2026-10-18); T_S7_CAREER, T_S8_TECH, T_S8_INTERN (403).
- **Current:** SWE-09 and SWE-17 cite T_S15 for the skill-bar claim. The doc admits it "didn't verify which document contains the exact… line".
- **Fix:**
  - Replace T_S15 with TARGETjobs ("some detail as to your level of aptitude" in experience) plus IMC (compare to professionals).
  - Mark the 403 sources "(unverified)" in their titles, as already done for Bright Network. Add a CI link-check script over `sources.ts` that is report-only.

### 28. The doc misstates the Monzo source
- **Severity:** P3. **Type:** wrong citation detail.
- **Where:** doc `:311`. SWE-05/11/14 cite T_S16.
- **Current:** "(no degree requirement; deep discussion of projects…)".
- **Evidence:** The page (29 Jan 2025) doesn't mention degrees. It's aimed at experienced mobile engineers and says "we hire for problem-solving ability over experience."
- **Fix:** Correct the description. Note it's an experienced-hire mobile page, usable only for "be ready to discuss projects in depth".

### 29. The myth M9 and the AU/GEN-09 copy are stale against ISE October 2026
- **Severity:** P2. **Type:** stale / contradiction (cross-area).
- **Where:** `lib/cv-rules/myths.ts` (M9 "ISE reports employer AI use in hiring is currently minimal"); GEN-09 (`general.ts:366`).
- **Evidence:**
  - Wonkhe's analysis of the ISE 2026 Student Recruitment Survey (B, 14 Oct 2026, https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs; 155 employers): first filtering stages "are generally now powered by the same tools for 68 per cent and up of employers". The figure is reported second-hand and the primary report wasn't seen.
  - 64% accept candidate AI use, mainly for CVs (Resultsense/Guardian).
  - ISE June 2026 (https://ise.org.uk/knowledge/insights/569/…): 46% of students used AI to write a CV or cover letter.
  - Prospects (May 2025): AI use is fine "as long as you use AI tools sensibly", including drafting.
- **Fix:**
  - Update M9: "Many large UK employers now use AI tools at first filtering (ISE 2026: majority), but decisions at interview and assessment stages remain human-led."
  - Soften GEN-09 from "Use AI for structure, not content" to "AI drafting is widely accepted; make every claim specific, true and defensible at interview." Experian's structure-only position is one employer's view (Gradcracker, B, search-indexed).

### 30. Competitive-programming guidance lacks an evidence note
- **Severity:** P3. **Type:** unsupported.
- **Where:** doc `:90` ("LeetCode (weak signal)"); SWE-12.
- **Evidence:** Norvig's widely quoted claim that contest winners perform worse at Google was retracted: "after gathering more data, the correlation went away" (Codeforces reproduction, C, https://codeforces.com/blog/entry/17302). There's no evidence either way for LeetCode counts on CVs.
- **Fix:**
  - Treat ICPC/UKIEPC/Codeforces/olympiads with a stated result as a positive signal, minor.
  - Add guidance: "a raw 'LeetCode: 400 problems' line is neither credited nor penalised." Mark it grade D.

### 31. The 2:1-centric copy contradicts the never-score-brand guard
- **Severity:** P3. **Type:** copy.
- **Where:** SWE-15/G-32 guidance ("Never give extra credit for a higher grade") vs the doc's "grade (… 2:1/First, or year average %)".
- **Fix:** Keep the guard. Make all grade copy format-neutral (finding 2).

### 32. A UK-specific gap: placement years and industrial placements
- **Severity:** P2. **Type:** missing.
- **Where:** No tech rule mentions sandwich placements. EV-01 is generic.
- **Evidence:** TARGETjobs placements list (B, 13 Jul 2026, T_S30). Internship experience raised interview invitations by 12.6% in a randomised field experiment (Baert et al., IZA DP 12183, A, https://www.iza.org/publications/dp/12183; Belgian setting).
- **Fix:** In SWE-02's guidance: "A completed industrial placement is the strongest experience entry. Put it above Projects and show its duration (e.g. 12 months)." Credit "placement" titles in `experience_present`.

## New rules / signals to add

**SWE-AI-01: AI-assisted engineering shown as practice, not as a buzzword**
- Severity: minor. Evidence: B (Stephany et al. 2026; Octoverse 2025; ISE 2026). Check: LLM.
- Text: "If you use AI coding tools (Copilot, Cursor, Claude Code, LLM APIs), show them inside a project with what you checked or changed. Listing 'ChatGPT' alone adds little."
- Pass: "Built a RAG search over module notes (OpenAI API, pgvector); wrote 40 eval questions, accuracy 62%→81%". Also "Used Copilot for boilerplate; wrote and reviewed tests myself".
- Fail: "Skills: ChatGPT, prompt engineering", with no bullet using them.
- `not_applicable` when no AI tools are mentioned. Never fails for absence.

**PRJ-AUTH-01: Project authorship is defensible**
- Severity: minor. Evidence: B/C (Monzo 2025; Google in-person rounds 2025; Amazon AI policy 2025; ISE 2026 misconduct). Check: LLM, `allowPartial`.
- Text: "For your main project, say one decision you made, a trade-off, or a bug you fixed. Interviewers will ask, often live and without AI."
- Pass: "Chose SQLite over Postgres for offline use; profiled and cut cold start from 3s to 0.8s". Partial: a decision without its reason.
- Fail: "Built a full-stack e-commerce app with React, Node, MongoDB" and nothing more.

**DEG-01 (replaces the `uk_grades` checker): degree grade present, in any format**
- Severity: major. Evidence: B (Prospects 2025; ISE 2025). Check: code.
- Pass: per the finding 2 regex, scoped to the current degree entry, plus an end or expected date.
- `partial`: grade present but no date, or date present but no grade.
- Fail: neither.

**QDEV-01: Systems depth for quant-dev and low-latency roles**
- Severity: minor. Evidence: B (XTX trading-dev page; IMC calibration advice). Check: LLM, applies when `subTrack=qdev`.
- Text: "Show one piece of performance-aware or systems work (C++/Rust/Java), with a measured result such as latency, throughput or memory."
- Pass: "Lock-free order book in C++20; p99 insert 180ns on 1M orders".
- Fail: "C++ (advanced)" with no project.

**QNT-13: School maths attainment for quant (UK)**
- Severity: minor. Evidence: D (UK convention; not verified against employer forms). Check: LLM.
- Text: "For quant roles, 1st and 2nd years can list A-level/IB Maths and Further Maths grades and any STEP/MAT/olympiad results."
- `not_applicable` for final years and Master's students.
- Ship only after verifying against at least one UK quant application form (see Open questions).

**PRD-10: Adjacent-route signal (copy-only, not scored)**
- For product applicants, show the caveat in finding 22 and suggest analyst, operations and tech-consulting targets.

## Rules to delete or downgrade

| Rule | Action | Reason |
|---|---|---|
| SWE-01 | maxPages 1→2; A→B | TARGETjobs and Prospects both allow 2 pages; the 1-page sources are North American (finding 1) |
| SWE-07 | major→minor; doc A→B | UK sources call portfolio links optional; no causal evidence (finding 4) |
| SWE-11 | Delete (superseded by EV-03 code) | Triple-counting (finding 6) |
| G-22 | Delete or merge into GEN-04 | Duplicate with conflicting year thresholds (finding 7) |
| SWE-15 | Merge into DEG-01 / G-32 | Duplicate `uk_grades`; fairness (findings 2, 12) |
| SWE-08 | A→B; accept CAR/STAR forms | Single-employer 2014 convention (finding 20) |
| DAT-02 | major→minor unless the JD names the tool | Source says tools are "a bonus" (finding 17) |
| DAT-04 | major→minor; soften copy | D evidence; accusatory copy (finding 21) |
| DAT-05 | B→C | Citations don't support the communication claim (finding 18) |
| PRD-03 + PRD-04 | Merge; major→minor | D evidence; penalises absence for students (finding 22) |
| PRD-08 | Bonus-only; remove "rank highly" | No source |
| QNT-02 | Remove the 1st-year skip | Wrong direction (finding 10) |
| SWE-17 | Strip unimplemented clauses | Promises checks that don't run (finding 16) |
| T_S15 | Replace citation | Dead URL (finding 27) |

## Open questions
- Google's own student resume page (careers.google.com/stories/applying-to-google) is JS-rendered and couldn't be opened. Its "Aim for one page" wording is from search indexing only.
- Bright Network, Gradcracker, UCL Careers, Imperial Careers (404), the Oxford quant page and the Citadel QR process page all returned 403/404 from this environment. Their claims stay unverified here.
- Couldn't verify:
  - whether Google STEP, Google APM and Meta RPM recruit in London for 2026–27 (aggregators conflict; STEP's page reportedly redirects);
  - any UK quant firm's application form asking for A-level or STEP grades;
  - any primary CV guidance from Meta, Palantir, Stripe, Revolut, Wise, DeepMind (beyond eligibility), Two Sigma, G-Research or Optiver (only job postings found).
- No field experiment varies a GitHub link on student CVs. The direction of SWE-07 is plausible but not causal.
- I couldn't verify the claim that requiring public GitHub activity disadvantages students with less free time (working students, carers) or under-represented groups. The web-search budget ran out before I could pull OSS diversity survey data. It's worth checking before keeping SWE-07 at any severity.
- The ISE 2026 "68% use AI at first filtering" figure is second-hand (Wonkhe). Confirm it against the ISE report PDF.

## Sources

**A: employers, government, peer-reviewed, randomised**
1. Jane Street, "Interviewing" (live 2026). https://www.janestreet.com/join-jane-street/interviewing/
2. IMC Trading, "Recruitment process: CV advice" (live 2026). https://www.imc.com/ap/careers/recruitment-process
3. XTX Markets, careers / trading-development page (live 2026). https://xtxmarkets.com/career/junior-quantitative-researcher
4. Monzo, "Preparing for mobile interviews at Monzo" (29 Jan 2025). https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo
5. About Amazon, "8 things Amazon recruiters say top job candidates do" (undated). https://www.aboutamazon.com/news/workplace/successful-amazon-job-candidates
6. Google DeepMind, "Student Researcher Program" (live 2026). https://deepmind.google/careers/internships/
7. National Careers Service (GOV.UK), "The STAR method". https://nationalcareers.service.gov.uk/careers-advice/interview-advice/the-star-method
8. Equality Act 2010. https://www.legislation.gov.uk/ukpga/2010/15/contents
9. Baert et al., IZA DP 12183 (2019/2021), internships field experiment. https://www.iza.org/publications/dp/12183
10. Marlow & Dabbish, "Activity traces and signals in software developer recruitment and hiring", CSCW 2013. https://www.cs.cmu.edu/~xia/resources/Documents/Marlow-cscw13.pdf
11. Stephany, Teutloff & Leone, AI skills conjoint (arXiv 2601.13286, v2 Mar 2026; preprint, A−). https://arxiv.org/abs/2601.13286
12. ISE / Prospects Luminate, Isherwood, "Early careers recruitment in 2025" (Oct 2025). https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards
13. ISE, "Students use AI to compete yet oppose AI assessment" (4 Jun 2026). https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment

**B: careers publishers, universities, large-sample industry data, established outlets**
14. TARGETjobs, "Tips for a graduate technical CV" (26 Nov 2025). https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice
15. Prospects, "Technical CV example" (May 2025). https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/example-cvs/technical-cv-example
16. Prospects, "How to write a CV" (May 2025). https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/how-to-write-a-cv
17. TARGETjobs, "Data science & analytics graduate jobs 2026" (FAQ). https://targetjobs.co.uk/graduate-jobs/it/data
18. TARGETjobs, Capital One Graduate PM account (undated). https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one
19. U of Toronto DCS Ambassadors, "Google Resume Workshop" recap (17 Sep 2025). https://www.teach.cs.toronto.edu/ambassadors/blog/2025-events/google_resume_workshop
20. Google Careers, "Students: Applying to Google" (search-indexed only). https://careers.google.com/stories/applying-to-google
21. Stack Overflow Developer Survey 2025, Technology. https://survey.stackoverflow.co/2025/technology
22. Stack Overflow Developer Survey 2025, AI. https://survey.stackoverflow.co/2025/ai
23. GitHub Octoverse 2025 (28 Oct 2025). https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/
24. PwC 2025 Global AI Jobs Barometer (global release; UK 11% premium per UK release). https://www.pwc.com/gx/en/services/ai/ai-jobs-barometer.html
25. interviewing.io / Learning Collider, "Are recruiters better than a coin flip at judging resumes?" (2024). https://interviewing.io/blog/are-recruiters-better-than-a-coin-flip-at-judging-resumes
26. Wonkhe, ISE 2026 Student Recruitment Survey analysis (14 Oct 2026). https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs
27. Resultsense summary of the Guardian / ISE 2026 misconduct findings (14 Oct 2026). https://www.resultsense.com/news/2026-10-14-ise-graduate-ai-interview-misconduct/
28. University of Liverpool Careers, "Using AI in job applications" (undated). https://www.liverpool.ac.uk/careers/students/using-ai-in-job-applications-and-recruitment/
29. Gradcracker / Experian, "CV application" (search-indexed; 403). https://www.gradcracker.com/hub/872/experian/additional-content/1782/cv-application
30. XTX Markets, Global Talent Fund release (2026). https://about.xtxmarkets.com/news/2026-xtx-markets-commits-to-global-talent-fund/
31. Oxford Brookes, "Grade Point Average". https://www.brookes.ac.uk/students/your-studies/grade-point-average
32. ITPro, "Amazon bans AI tools during job interviews" (2025). https://itpro.com/business/careers-and-training/amazon-bans-ai-tools-during-job-interviews
33. HCAMag, "Google opts for in-person interviews amid surge in AI-aided candidates" (2025). https://www.hcamag.com/us/specialization/hr-technology/google-opts-for-in-person-interviews-amid-surge-in-ai-aided-candidates/545926
34. Royal Statistical Society, "Types of job: Data scientist" (undated; dated content, B−). https://rss.org.uk/jobs-careers/career-development/types-of-job/data-scientist/
35. TARGETjobs, IT placements list (13 Jul 2026). https://targetjobs.co.uk/careers-advice/information-technology/which-it-and-technology-employers-offer-summer-internships-or-industrial-placements

**C: practitioner and corroboration only**
36. Codeforces blog (Norvig retraction quote). https://codeforces.com/blog/entry/17302
37. Erik Bernhardsson, "Norvig's claim that programming competitions correlate negatively…" (2015). https://erikbern.com/2015/04/07/norvigs-claim-that-programming-competitions-correlate-negatively-with-being-good-on-the-job
38. SlateGit, "AI-generated GitHub projects: recruiters suspicious" (2026; vendor blog). https://slategit.com/blog/ai-generated-github-projects-recruiters-suspicious-2026
39. HackerRank 2018 Developer Skills / Tech Recruiting reports (via ITPro / i-Programmer summaries). https://itprotoday.com/it-management/developers-show-your-github-project-to-attract-job-offers

**Dead or unverifiable cited sources**
- T_S15 Strathclyde CV booklet: HTTP 500.
- T_S7 Gradcracker: 403.
- T_S8 Bright Network: 403.
- UCL Careers CVs: 403.
- Imperial Careers CVs: 404.
