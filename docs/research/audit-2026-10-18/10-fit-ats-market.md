# Job-fit scoring, requirement matching, ATS claims and the market-2026 evidence base: audit

Auditor 10 of 10 · 2026-10-18 · Scope: `lib/scoring/` (fit, requirements, coverage, dates), `lib/ai/tagJob.ts`, `lib/ai/explainMatch.ts`, `lib/ai/heuristics.ts`, `lib/skills/`, `lib/ingest/filter.ts` (sponsorship and employment-type detectors the fit score depends on), `docs/research/market-2026/00–06`, `docs/research/career-ops-extraction.md`, spec §5.

**Executive verdict: grade C+.**
1. The requirement-explanation layer (two-pass importance, inferred cap, verified quotes, must-haves headline, findability bands) is well designed and matches how Workday HiredScore, Greenhouse and Ashby now grade candidates. That part earns a B+.
2. The **fit score that ranks the feed is weaker (D+)**. Deadline proximity carries as much weight as skill match. Unmet must-haves never gate. Degree class, graduation-year windows, seniority and degree subject are not modelled. The visa gate wrongly blocks international students from vacation internships and placements, which UK Student-visa rules allow.
3. Year eligibility is modelled as "1st/2nd/penultimate/final/masters". Employers gate on **graduation year**. The heuristic used when AI is off maps "graduating in 2028" to final-year, which is wrong for 2027 summer internships, and the spring-week default admits penultimate-year students.
4. The market-2026 evidence base mostly holds up. 17 of the 30 key numbers I re-checked are verified. But it is **already stale**: the ISE Student Recruitment Report 2026 (14 Oct 2026) replaces the headline 140→141, "graduate hiring −8%"→"+4%", "45% no AI guidance"→"18%", "49% allow AI"→"up to 64%". There are also 6 misquotes or misattributions and several grade inconsistencies between reports.
5. Nothing in the docs claims a magic ATS pass mark, and the "75% auto-rejected" myth is correctly debunked. The residual ATS risk is in copy and gating logic, not in the claims.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality (market-2026) | B− | Most A/B citations are real and say roughly what is claimed. Several 2026 single-author or small-sample preprints are graded B in one report and C in another. |
| Freshness | C | ISE SRS 2026, the Graduate-route cut to 18 months (Jan 2027) and the newest ONS vacancies are all missing. Several AI-policy figures are a year out of date. |
| Coverage (fit logic) | D | No degree-class, graduation-year window, seniority, degree-subject, language or test-stage signals. Visa is modelled as a boolean. |
| Implementation fidelity (spec → code) | B− | Code matches spec §5, but spec §5 itself drifted from the career-ops source (coverage 0.30→0.25, eligibility weight replaced by a deadline weight). |
| Internal consistency | C | Wiles sample size and wage effect, Takano grade, Kristal date and preprint grades all differ across 02/05/06. Posting-age penalty contradicts career-ops' 365-day internship rule. |
| Fairness | D | The visa gate plus "Not recommended" labels plus lower XP for applying (`APPLY_XP`) together push international students away from roles they can legally do. |
| UX / copy | B | Must-haves headline, never-100% and findability hints are good. Gap "how to close" copy overclaims ("a weekend is enough") and is nonsensical for non-skill requirements. |

---

## Findings

### P0: wrong or harmful, fix now

**1. The visa gate blocks Student-visa holders from internships, spring weeks and placements they are legally allowed to do.**
- **Severity:** P0 · **Type:** wrong / fairness
- **Where:**
  - `lib/scoring/fit.ts:77-79`
  - `lib/ai/prompts.ts:20` (sponsors_visa: "no" if "must already have right to work")
  - `lib/ingest/filter.ts:107` (NO_SPONSOR)
  - `app/onboarding/page.tsx:67` ("I'll need visa sponsorship")
- **Current:** `student.needsVisa && job.sponsorsVisa === "no"` → gate failed, score capped at 2.5, label "Not recommended", applied XP 10 instead of 50 (`lib/gamify/core.ts:40`). The gate fires for every employment type.
- **Evidence:**
  - UKCISA (A-equivalent; UK's official adviser body for international students), "Student work" page, viewed 2026-10-18, https://www.ukcisa.org.uk/student-advice/working/student-work/. Full-time work is allowed outside term time, "including during vacations". Placements that are an assessed part of the course can be full-time. A permanent full-time job is not allowed during term time.
  - An "international student" ticking "I'll need visa sponsorship" therefore does **not** need sponsorship for a summer internship, spring week or course placement. They need it only for a permanent or graduate role, and even then the Graduate route covers the first 24 months, or **18 months for applications from 1 Jan 2027** (Home Office Statement of Changes 14 Oct 2025, via UKCISA / PIE News, https://thepienews.com/shorter-graduate-route-from-january-2027-uk-govt-confirms/; B).
  - "Must already have the right to work in the UK" is satisfied by a Student visa holder for a vacation internship.
- **Fix:**
  1. Replace the boolean with `workAuth: "uk_rtw" | "student_visa" | "graduate_visa" | "needs_sponsorship"`. Onboarding copy: "Which best describes you? British/Irish/settled · On a Student visa · On a Graduate visa · Need a work visa for any UK job".
  2. Change the gate to:
     ```ts
     const needsSponsorHere =
       student.workAuth === "needs_sponsorship" ||
       (student.workAuth === "student_visa" && (job.employmentType === "graduate" || job.employmentType === "permanent")) ||
       (student.workAuth === "graduate_visa" && job.employmentType === "permanent" /* soft flag only, see #12 */);
     if (needsSponsorHere && job.sponsorsVisa === "no") gate visa failed;
     ```
  3. In `SYSTEM_TAG_JOB`, split "no sponsorship" from "must have right to work": add a field `rtw_wording: "no_sponsorship" | "rtw_required" | "none"`. Only `no_sponsorship` maps to `sponsors_visa: "no"`.
  4. Fix NO_SPONSOR so that "no sponsorship required" doesn't match: add the negative lookahead `(?!\s+(is\s+)?(required|needed))`.

**2. The heuristic year parser misreads graduation-year windows, and it is the live path whenever AI is off.**
- **Severity:** P0 · **Type:** wrong
- **Where:** `lib/ai/heuristics.ts:45-55` (`yearsFrom`). It is used by `tagJob` fallback and by ingest (`lib/ingest/run.ts:6`). AI-off is a first-class mode in the local-first build.
- **Current:**
  - `/final[- ]year|graduating in 202[6-8]|recent graduate/` → `["final","masters"]`
  - `/penultimate/` → `["penultimate","2nd"]`
  - spring/insight default → `["1st","2nd"]`
- **Evidence:** Employers state eligibility by **graduation year**, and the year depends on the programme:
  - JPMorganChase "2027 Spring Insights" listings say "a student expecting to graduate in 2029". These are aggregator copies of employer text (Bright Network / Evenbreak listings, Oct 2026; B/C).
  - JPM Private Bank events tie the 2027 Summer Internship to graduating Dec 2027–Jun 2028.
  - Goldman Sachs spring programmes are for first-years on three-year courses and second-years on four-year courses (goldmansachs.com "Get Set for GS Spring Insight", B; Bright Network GS Divisional Spring Programme, B).
  - So "graduating in 2028" on a 2027 **summer internship** means penultimate year, not final. The regex also stops working after 2028 (hard-coded `202[6-8]`) and never matches "expect(ing) to graduate in 2029".
  - The spring default admits "2nd". A 2nd-year on a 3-year course is penultimate and ineligible for most spring weeks.
- **Fix:** Model eligibility as a graduation-year window, not a year label.
  - Add `gradYearMin`/`gradYearMax` to `JobForScoring`. Parse with `/(graduat\w*|expect\w* to graduate|finish\w* (your )?(degree|studies))[^.]{0,40}?(20\d\d)(\s*(?:-|–|to|and|or)\s*(20\d\d))?/i`.
  - Defaults when nothing is stated, with P = the programme year:
    - spring week/insight: grad year = P+2
    - summer internship: grad year = P+1
    - placement: grad year = P+2 (4-year sandwich degree)
    - graduate scheme: grad year ≤ start year, and ≥ start year − 3
  - Store `student.gradYear` (onboarding asks it directly; `yearGuess` stays as a hint).
  - Gate: `job.gradYearMin <= student.gradYear <= job.gradYearMax`.
  - Change the `SYSTEM_TAG_JOB` rule to "year_eligibility: copy any graduation-year window as grad_year_min/max".

**3. "Not recommended" label and lower XP on gated jobs amplify any gate error.**
- **Severity:** P0 (follows from #1 and #2) · **Type:** fairness / copy
- **Where:** `lib/scoring/fit.ts:25-30,94-95`; `lib/gamify/core.ts:40` (`APPLY_XP`: Strong/Good 50, Stretch 25, Not recommended 10); `components/fit-badge.tsx:11`
- **Current:** Every gate failure caps the score at 2.5, so the job reads "Not recommended", the score is hidden, and applying earns 10 XP.
- **Evidence:**
  - The gates rest on LLM or regex extraction (sponsorship, years, location), which is error-prone by construction (findings 1, 2, 11).
  - career-ops' own rule: "Silence is absence of signal, not a refusal", and an overstated gap "makes a student skip a role they should have applied to" (`docs/research/career-ops-extraction.md:58-63,66-71`).
  - DSIT *Responsible AI in Recruitment* (25 Mar 2024; A) asks for contestability and redress.
- **Fix:**
  - Rename the gated state "Check eligibility" and show the quoted JD sentence that triggered it plus a "This is wrong" override (per job, stored).
  - Stop scaling XP by fit label. Give a flat APPLY_XP, or reward *preparation* (tailored CV verified, form answers drafted) instead. Rewarding "fit" rewards the scorer's guesses.

**4. Deadline proximity weighs as much as skill match (0.25 each), and "no published deadline" is penalised.**
- **Severity:** P0 · **Type:** implementation / wrong
- **Where:** `lib/scoring/fit.ts:6,54-64`; spec `docs/superpowers/specs/2026-10-13-placed-design.md:123,129`
- **Current:** `accessibility` (weight 0.25) gives a deadline in 4–30 days 4.5, more than 30 days 4.0, no valid date 3.5, ≤3 days 3.0. Coverage (0.25) maps 0–100% to 1–5.
- **Worked example:** Top archetype, London, deadline in 20 days, **zero** skills matched gives 0.35·5 + 0.25·1 + 0.15·5 + 0.25·4.5 = **3.9 "Stretch"**. An adjacent-archetype job with **100%** skills and no published deadline gives 0.35·3 + 0.25·5 + 0.15·5 + 0.25·3.5 = **3.9**. Skill fit and a date the student can't influence tie.
- **Evidence:**
  - `lib/scoring/dates.ts:30-31`: about 90% of Greenhouse/Lever/Ashby postings publish no closing date.
  - ISE SRS 2026 (14 Oct 2026; B): employers are "closing campaigns early" and shortening windows (https://ise.org.uk/knowledge/insights/615/graduate_jobs_stabilise_but_ai_use_disrupts_recruitment).
  - So an unknown date means "apply early", not "worse fit".
  - career-ops' triage formula, which spec §5 claims to adapt, has no deadline term at all. Its weights are archetype .35, comp .25, location .25, CV match .15 (`career-ops-extraction.md:35-41`).
- **Fix:** Take deadline out of fit. New `Global = 0.40·archetype + 0.40·requirementFit + 0.20·location`, then the must-have cap (#5). Use `urgency` (days to deadline, rolling flag, posted age) only as a **sort key and a chip** ("Closes in 5 days", "Rolling: apply early"). Keep `firstYearFriendly` as a chip and filter, not a score bump.

### P1: important

**5. Unmet must-haves never cap the fit score, unlike the ATSs the docs cite.**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/scoring/fit.ts:87`; `lib/scoring/coverage.ts:101-102`
- **Current:** Coverage is a weighted mean (must = 2, nice = 1). A candidate missing 3 of 3 must-haves but matching 6 nice-to-haves gets weighted coverage 6/12 = 0.5, so a coverage sub-score of 3.0.
- **Evidence:**
  - Workday HiredScore Spotlight release notes, 5 Aug 2026 (A, vendor docs), https://doc.workday.com/hiredscore/en-us/workday-hiredscore/hiredscore-release-notes/2026/august/wednesday--5th-august.html: "Basic qualifications determine whether a candidate is graded A/B or C/D." Preferred qualifications only order within a band.
  - `docs/research/market-2026/03-ats-ai-screening.md` §4.1.2 already recommends this. The ranking ignores it.
- **Fix:**
  - `requirementFit = mustTotal ? 1 + 4·(mustMet + 0.5·mustPartial)/mustTotal : (coverage null ? 3 : 1 + 4·weighted)`.
  - Cap the label at "Stretch" when any `stated` must-have (not inferred) is Missing.
  - Use nice-to-have coverage only as a tie-breaker (±0.2).

**6. No degree-classification signal, though about half of large employers still set a 2:1 floor.**
- **Severity:** P1 · **Type:** missing
- **Where:** `lib/scoring/fit.ts` (absent); `lib/ai/schemas.ts` TagJobOutput (no field)
- **Evidence:**
  - Prospects Luminate / ISE SRS 2025 (B), https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards: 47% of employers specify a 2:1 and 20% accept a 2:2. The share has plateaued since 2022/23 and fell from 71% in 2015/16.
  - The docs themselves say the 2:1 is a threshold, not a gradient (`02-recruiter-screening-evidence.md` §4.4).
- **Fix:**
  - Add `min_degree_class: "first" | "2:1" | "2:2" | "none_stated"` and `contextual_offers: boolean` to tagJob.
  - Add `student.predictedClass` (optional, "prefer not to say" allowed).
  - Make it a **soft flag**, not a gate ("Asks for a 2:1; you predicted a 2:2. Check for contextual or mitigating-circumstances routes"). Predicted grades change, and many firms use contextual recruitment.

**7. No seniority or "years of experience" knockout.**
- **Severity:** P1 · **Type:** missing
- **Where:** `lib/scoring/fit.ts`; `lib/ai/prompts.ts:15-25`
- **Current:** A "Junior Software Engineer (2+ years' commercial experience)" posting that passes the title filter can be "Good fit" for a first-year.
- **Evidence:**
  - Greenhouse Talent Matching extracts "years of experience" as a first-class field (Greenhouse Support FAQ, cited in 03 F2; A).
  - SAP/SmartRecruiters "rejection screening questions" auto-reject on number and date answers (https://learning.sap.com/courses/smartrecruiters-for-sap-successfactors-academy/creating-rejection-screening-questions; A).
- **Fix:** Add `min_years_experience: number | null` (stated only) to tagJob. Gate when it is ≥ 1 and the student is not a graduate, with reason "Asks for N+ years' experience". Also add `/\b(\d+)\+?\s*years?'?\s+(of\s+)?(commercial|professional|industry|relevant)\s+experience/i` to the heuristic.

**8. Employment-type gate: final-years and masters students are blocked from permanent graduate-entry roles.**
- **Severity:** P1 · **Type:** wrong
- **Where:** `lib/scoring/fit.ts:73-75`
- **Current:** `employmentType === "permanent"` → gate failed for everyone, including `final` and `masters`.
- **Evidence:**
  - Final-year students apply in autumn for roles starting after graduation. That is the whole graduate-scheme cycle, and ISE counts these hires (31,577 hires, ISE SRS 2026; B).
  - The career-ops rule this came from (`career-ops-extraction.md:87`) is about students *still enrolled* during the role.
  - UKCISA: the restriction is a permanent job **during term time**. A start after the course ends is not covered (A).
- **Fix:** Gate permanent roles only when `student.gradYear > startYear` (start date known) or when the student is not final/masters. Otherwise pass, and show the chip "Starts after you graduate?".

**9. The posting-age penalty contradicts the internship cycle and the career-ops source.**
- **Severity:** P1 · **Type:** contradiction
- **Where:** `lib/scoring/fit.ts:61` (−0.5 accessibility after 60 days), `:82` (soft flag −0.5 global after 90 days)
- **Current:** A summer-2027 internship posted in July is double-penalised by October.
- **Evidence:**
  - `career-ops-extraction.md:392`: `max_posting_age_days: 365` for internships, because "summer-2027 requisitions posted Jun–Aug stay open into Dec".
  - The legitimacy tiers in the same doc treat age as a *legitimacy* signal, kept separate from the score (`:75`).
  - JPM 2027 Spring Insights listings show a 1 Nov 2026 close for programmes opened in the summer (aggregators; C).
- **Fix:**
  - Delete both age penalties for `internship | spring_week | insight | placement | graduate`.
  - For `other`, keep a "Posted N days ago" chip with no score effect.
  - Use liveness (apply URL still resolves) rather than age.

**10. Soft-skill requirements produce systematic false gaps (and false matches).**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/skills/vocab.ts:186-202` (Communication, Leadership, Teamwork); `lib/skills/extract.ts:100-108,172-179`
- **Current:**
  - A JD "excellent teamwork and communication skills" extracts `Teamwork` and `Communication` as must-haves.
  - On the CV, `Teamwork` matches only the word "teamwork" or "cross-functional". "Worked in a team of 4 to…" is a gap.
  - `Leadership` matches only "team leadership" or "led a team". "President, Finance Society" and "Captain" are gaps.
  - Meanwhile a CV that merely lists "Communication skills" in Skills scores `existing`. That contradicts the code comment "Soft skills need demonstrated behaviour, not only a self-description".
- **Evidence:**
  - These are the most common requirements in UK graduate JDs.
  - ISE says the shortfalls employers see are behavioural: self-awareness 54%, resilience 46% (ISE Top-10 stats 2025, 8 Dec 2025; B; https://ise.org.uk/knowledge/insights/513/ise_top_10_stats_of_2025_you_need_to_know/).
  - NACE: about 80% of employers seek teamwork evidence (cited in 02 F12; B).
- **Fix:**
  - Treat soft skills as **non-keyword requirements**: exclude {Communication, Teamwork, Leadership, Problem Solving, Stakeholder Management} from `computeCoverage` and leave them to `explainMatch` (LLM, quote-verified) or mark them "Partial (judge yourself)" in the heuristic.
  - If they stay in coverage, add behaviour patterns, e.g. Teamwork: `/\b(team of \d+|with (a|my) team|collaborat\w+|co-?(led|organised|founded))\b/i`; Leadership: `/\b(president|captain|chair|head of|founder|led|managed \d+)\b/i`.
  - Ignore Skills-list self-descriptions for soft skills.

**11. No skill implication or hierarchy, so false gaps for obvious matches.**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/skills/extract.ts:98` (`IMPLIED_PARENTS` = JavaScript, React only)
- **Current:** JD "SQL", CV "PostgreSQL" → gap. JD "Python", CV "pandas, NumPy, PyTorch" with no "Python" token → gap. JD "Machine Learning", CV "scikit-learn" → gap.
- **Evidence:**
  - The vendors the docs cite moved to LLM per-criterion judgement precisely because exact-term matching misses equivalents. Oleeo contrasts itself with "exact-match phrasing" (03 F4).
  - Workday's LLM evaluates qualifications "individually" against the parsed resume (A, URL above).
- **Fix:** Add `implies` to `SkillEntry` and expand the CV-side set before matching (never the JD side):
  - PostgreSQL/MySQL/SQLite/BigQuery/Snowflake → SQL
  - Pandas/NumPy/Scikit-learn/PyTorch/TensorFlow → Python
  - Scikit-learn/PyTorch/TensorFlow → Machine Learning
  - Next.js/React Native → React
  - Express.js → Node.js
  - Spring Boot → Java
  - Django/Flask/FastAPI → Python
  - Power BI/Tableau → "Data Visualisation"
  - Credit implied matches as `supportedByResume` (0.75), not `existing`.

**12. The Graduate route's 18-month change is absent from all docs and logic.**
- **Severity:** P1 · **Type:** stale / missing
- **Where:** `docs/research/market-2026/*` (no mention); `lib/scoring/fit.ts`
- **Evidence:** Bachelor's and master's Graduate-route applications made on or after 1 Jan 2027 get 18 months instead of 2 years; PhD stays at 3 years (Statement of Changes, 14 Oct 2025; UKCISA and PIE News summaries, B). This directly affects 2026–27 finalists applying to 2027 graduate schemes.
- **Fix:**
  - Add a knowledge card for international finalists.
  - For `graduate_visa` / `student_visa` students on `graduate` roles with `sponsorsVisa === "unknown"`, show the soft flag "Ask whether they sponsor after the Graduate visa (18 months from Jan 2027)".
  - Never gate on it.

**13. Non-skill requirements fall through the explanation as "partial / blocking" with nonsensical fixes.**
- **Severity:** P1 · **Type:** copy / implementation
- **Where:** `lib/ai/heuristics.ts:176-196`; `lib/ai/explainMatch.ts:122-127`
- **Current:**
  - A tagJob requirement like "Right to work in the UK" or "On track for a 2:1" (skill = null) becomes `match: "partial"`, `blocking: true`.
  - Its fix is "Look for a society role, module or job that shows this, and describe it on your CV in your own words."
  - Skill gaps get "Do a small project with ${skill} (a weekend is enough)", even for CFA, Bloomberg, German or Financial Modelling.
- **Evidence:**
  - DMCC Act 2024 and CMA guidance on misleading claims (cited in 06 C16; A).
  - "Not shown in your CV yet" is the honest version, and `MISSING_GAP_HOW_TO_CLOSE` already exists at `explainMatch.ts:95`.
- **Fix:**
  - Classify non-skill requirements at tagJob time (`kind: "skill" | "eligibility" | "degree" | "experience" | "behaviour" | "language"`).
  - Route `eligibility | degree | language` to the eligibility panel, not the gap list.
  - Heuristic skill gaps: "Not shown in your CV. If you've used {skill}, add a line that shows it; if not, a small project, module or course can close it." Drop "a weekend is enough".

**14. "2nd" vs "penultimate" is ambiguous in the Year enum, and `yearGuess` assumes 3-year degrees.**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/types.ts:18`; `lib/ai/prompts.ts:34` ("graduating 2029 → 1st, 2028 → 2nd, 2027 → final")
- **Current:**
  - A 4-year MEng student graduating 2029 is mapped "1st", but is in 2nd year.
  - A 3-year student graduating 2028 is mapped "2nd", but is penultimate.
  - A spring default of ["1st","2nd"] then shows spring weeks to the penultimate student.
  - There is no "graduated" value, so 2024–26 graduates (eligible for most graduate schemes, which accept 0–3 years post-degree) can't be represented.
- **Evidence:** GS spring eligibility is defined by course length (B, above). JPM uses graduation year (B/C, above).
- **Fix:** Covered by #2. Store `gradYear` + `courseYears` + `onPlacementYear`, and derive the display label.

**15. Heuristic tagJob makes every "Requirements" skill a must-have (`high`).**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/ai/heuristics.ts:70`; `lib/ai/explainMatch.ts:26`
- **Current:** "Experience with any of: Python, Java, C++, Go, Rust" becomes 5 separate `high` must-haves (no anyOf in the heuristic). The headline reads "Must-haves met: 1/5" for a student who meets the requirement.
- **Fix:**
  - In the heuristic, detect alternative lists (`/\b(any of|one of|or|such as|e\.g\.|for example)\b/i` on the line) and emit one anyOf group.
  - Treat "such as / e.g." lists as `preferred`.
  - Cap heuristic `high` at the first 5 must-section skills, and mark the rest `meaningful`.

**16. Coverage credits mentions in "interests" as 0.75 evidence.**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/scoring/coverage.ts:64` (`otherText` includes `cv.interests`); `:14` (supportedByResume = 0.75)
- **Current:** "Interests: following AI, chess, Python meetups" earns three-quarters credit for a must-have Python requirement.
- **Evidence:** 02 F14 / Stephany et al. 2026 (verified, below): self-declared skills help, but recruiters reward evidenced skills. The docs' own EV-03 rule asks skills to appear in a project or experience bullet.
- **Fix:** Split `otherText` into `education` (module names, credit 0.75) and `interests/summary` (credit 0.25).

**17. Location gate: "Europe" and multi-country postings are hard-gated for London-only students.**
- **Severity:** P1 · **Type:** implementation
- **Where:** `lib/scoring/fit.ts:41-52,76`
- **Current:** A "London or Dublin" posting is fine (best segment wins). "EMEA (UK eligible)" or "Europe" with London preference → 2 → gated.
- **Evidence:** career-ops: "hybrid outside your country scores 3.0, not 1.0", and "don't penalize missing data" (`career-ops-extraction.md:44,389`).
- **Fix:**
  - `region === "europe" && /\b(uk|united kingdom|london|emea)\b/i.test(jdText)` → 3.5.
  - Gate only when the location is explicitly non-UK and the student did not pick "europe".

### P1: evidence base (market-2026)

**18. The market docs are a release behind: ISE Student Recruitment Report 2026 (14 Oct 2026) supersedes the 2025 headline figures.**
- **Severity:** P1 · **Type:** stale
- **Where:**
  - `00-synthesis.md:10` ("about 140 applications")
  - `01:29,70,108-113,267`
  - `02:120`
  - `03:96-100`
- **Evidence:** ISE, "Graduate jobs stabilise, but AI use disrupts recruitment", 14 Oct 2026 (B), https://ise.org.uk/knowledge/insights/615/graduate_jobs_stabilise_but_ai_use_disrupts_recruitment. Sample: 155 employers, more than 1.7M applications, 31,577 hires, 2025/26 cycle.
  - **141** applications per graduate vacancy (London 172; financial and professional services 158; apprenticeships 96).
  - Graduate hiring **+4%** (after −8%). Forecast **+7%** for 2026/27. 45% increased intake, 15% held, 40% cut.
  - **92%** suspected or confirmed misconduct (85% in 2025, 78% in 2024).
  - **16%** currently use AI in recruitment, 29% plan to within a year, 52% don't plan to.
  - **82%** give AI guidance (55% in 2025). **Up to 64%** accept candidate AI use (46% last year), usually for CVs and applications, not tests or interviews.
  - **77%** reviewing or redesigning.
  - Volume tactics include "automated eligibility screening", shorter windows and "limiting roles or programmes per candidate".
  - Quote (Claire Tyler): "Be yourself. Employers don't expect candidates to be perfectly polished."
- **Fix:**
  - Replace the synthesis line with "About 141 applications per graduate vacancy (ISE 2026) and 101 per internship hire (ISE 2025)".
  - Add a §A0 "2026 update" to 01.
  - Change myth MK3 to "64% accept AI for CVs/applications; tests and interviews are where it's banned".
  - Delete "45% give no guidance" (now 18%).

**19. Six misquotes or misattributions in the market docs.**
- **Severity:** P1 · **Type:** wrong
- **Where and fix:**
  - (a) `00-synthesis.md:10` says "the payoff fell 51% … (Cui 2025)". What fell 51% is the **correlation between letter–job textual alignment and callbacks**, not a payoff or premium. That correlation fell 79% for offers. Source: Cui, Dias & Ye, arXiv 2509.25054 v2, 12 Nov 2025 (B, verified; https://arxiv.org/abs/2509.25054). Fix: "the link between how closely a letter matched the post and getting a callback fell 51%".
  - (b) `02:120` says "61% saw undisclosed AI use in interviews". ISE says 61% **cite it as the most common form** of misconduct (ISE insight 498, 22 Oct 2025; B). Fix the wording.
  - (c) `03:97` says "ISE SRS 2025 found 28% of employers use some AI (up from 9% in 2022)". The 28% is from **ISE SRS 2023**, published Nov 2023 (ISE insight 180 "Employers using AI to recruit … triples"; B). The 2026 figure is **16%** "currently use AI" (ISE 2026). Fix the citation and replace the number.
  - (d) `01:74` reads ISE's "+16% / +27%" as application increases from a different employer base. They are the **applications-per-hire ratio** changes for matched employers (87→101; 97→123) (ISE insight 508, 24 Nov 2025; B). Fix the note.
  - (e) `01:54` lists "20% applied for 100+ jobs" under the HESA 2023/24 cohort. THE attributes it to **Jisc's early-careers survey of 5,000 recent graduates**, not HESA (THE, 4 Jun 2026; https://www.timeshighereducation.com/news/drop-graduate-employment-cooling-not-collapse; C relaying B). Move it under F6.
  - (f) `05:16` says "~195k new jobseekers … 8.4% higher hourly wages (95% CI 3–13%)", while `02:18-19` says "~480k … ~10% higher wages". NBER and the published *Management Science* abstract say "nearly half a million jobseekers" and "hired 8% more often". 8.4% is the earlier draft's wage figure; the published abstract reports 10%. Fix: use "≈480k jobseekers; +8% hires; +10% wages (published version)" in both.

**20. Grades for the same preprint differ between reports, and some key preprints are weaker than graded.**
- **Severity:** P1 · **Type:** contradiction
- **Where:** `02:74,78-84` vs `05:48,53-58,79`
- **Current and evidence:**
  - Takano arXiv 2608.26171 (source of "97% fabrication" and "54.5%") is graded **C** in 02 and **B** in 05. Verified: single author, v1 22 Jul 2026, v2 16 Sep 2026, 180 runs over 10 *synthetic* CVs × 2 JDs. 96.7% is the baseline at-least-one-unsupported-claim rate. 54.5% is the **removal rate at human review for qualifier drops and plausible new claims combined**, not qualifier drops alone.
  - arXiv 2609.16517 (29.6–41.4% flips) is C in 02 and B in 05. Verified: two authors, under review, six small open models (Llama-3.1-8B, Mistral-7B).
  - arXiv 2603.05189 is used in 06 F17 as general evidence. Verified: it is **Singapore-context** (4 ethnicities common there), 18 LLMs, 4,100 variants. 06 omits the context.
- **Fix:**
  - Grade all three **C** (single small preprint).
  - Keep "97%" out of UI copy. Say "a 2026 preprint found almost every unguarded run added an unsupported claim".
  - Rephrase 05 F9: "about half of subtle qualifier drops and plausible additions survived human review".
  - Add "(Singapore context)" to 06 F17.

**21. The key UK layout evidence (Kristal et al.) is about experienced workers, not students.**
- **Severity:** P1 · **Type:** unsupported (transfer)
- **Where:** `02:88-94` (dated Dec 2022), `05:30` (dated Feb 2023); used as "the best real evidence behind front-load what matters"
- **Evidence:** The study tested applicants with **5 and 15 years** of total experience and gaps of about 2.5 years. Online Dec 2022, print Feb 2023 (Exeter/HKS summaries; https://ore.exeter.ac.uk/repository/handle/10871/131446; A).
- **Fix:** Add the caveat "tested on mid-career profiles; transfer to student CVs is untested". Use one date consistently ("*Nat Hum Behav* 2023, online Dec 2022").

**22. 03 F4 quotes an Oleeo claim the vendor page no longer makes.**
- **Severity:** P1 · **Type:** stale
- **Where:** `03-ats-ai-screening.md:42,219`
- **Current:** "without anyone being automatically filtered out".
- **Evidence:** oleeo.com/products/ai-candidate-screening, viewed 2026-10-18, now says the tool "Scores and ranks candidates to automatically generate a ready-to-review, prioritised shortlist" (A, vendor). The "no auto-filtering" line is gone.
- **Fix:** Replace the quote. Downgrade Oleeo's "Auto-reject on CV?" cell from "No" to "Not documented; auto-generates shortlists". Use this in myth N1: "ranking can work as rejection" (consistent with ICO).

**23. Deloitte "one application per intake year" is not on the cited page.**
- **Severity:** P2 · **Type:** unsupported
- **Where:** `01:144`, and implication 4 at `01:244` ("high-stakes gate")
- **Evidence:** The cited Deloitte UK integrity-guidance page (viewed 2026-10-18; B) covers AI rules only: AI is prohibited in the Immersive Online Assessment, Job Simulation and interviews, and breach means removal from the process. It has no application-limit rule. PwC's page returned 403 in this pass, so PwC's version is also unverified.
- **Fix:** Mark both ⚠ until the FAQ URLs are quoted. Cite ISE 2026's "limiting roles or programmes per candidate" as the general trend.

**24. The ICO "Recruitment rewired" details are partly unverifiable.**
- **Severity:** P2 · **Type:** unsupported
- **Where:** `03:78-85`
- **Evidence:** The ICO page (A) confirms more than 30 employers, evidence from Mar 2025 to Jan 2026, and "many employers engaging in automated recruitment are likely relying on solely automated decisions". It does **not** show the "wrote to 16 organisations" figure or a March 2026 date.
- **Fix:** Keep the quote. Mark "16 organisations" and "March 2026" ⚠ unless the report PDF is cited.

### P2: improvements

**25. No assessment-stage model, though tests are where most UK knockouts happen.**
- **Severity:** P2 · **Type:** missing
- **Where:** fit and explain (absent); `01 F10` (funnel table proposed but not built)
- **Evidence:**
  - ISE insight 505 (12 Nov 2025; B): fully automated scoring is used for numerical reasoning (57% of employers), situational judgement (53%) and verbal reasoning (49%). Hybrid: strengths tests 42%, job simulations 33%. AI-only: game-based 15%.
  - ISE 2026: 10% of game-based assessments fully AI-driven; "automated eligibility screening" rising.
  - Vendors students will meet:
    - Cappfinity is used by EY, Accenture, Linklaters, Sky, TfL, NHS and Shell (GraduatesFirst, modified 18 Aug 2026; C). Untimed tests still record "the time taken".
    - Arctic Shores runs task-based behaviour assessment and claims to be "future-proofed against ChatGPT" (vendor; C).
    - Harver absorbed pymetrics games (Harver press release, 11 Aug 2022; B).
    - Deloitte runs an immersive online assessment and job simulation with AI banned (B).
- **Fix:** Add `employer_process` seed data: `{tests: ["Cappfinity numerical","SJT"], video: "HireVue|Cappfinity Snapshot|none", ai_policy_url, limit_per_cycle}`. Show it on the job page as "How you'll be screened". Make it a prep quest, not a score input.

**26. Degree-subject and language requirements are ignored.**
- **Severity:** P2 · **Type:** missing
- **Where:** `lib/skills/vocab.ts` (no subjects or languages), although the profile already stores `course` (`app/onboarding/actions.ts`)
- **Evidence:** JPM "Engineer & Innovate": "we welcome applicants from computer science or related courses" (B/C). GS: "your discipline or degree is not important" (B).
- **Fix:**
  - tagJob `degree_subjects: string[] | "any"` and `languages: {lang, level}[]`.
  - Compare against `profile.course` with a small subject-family map (CS ⊃ Software Eng, Maths, Physics; "STEM" = …).
  - Soft flag only.

**27. Findability thresholds and the stuffing rule are uncalibrated.**
- **Severity:** P2 · **Type:** unsupported
- **Where:** `lib/scoring/requirements.ts:75,95-97`
- **Current:** 0.75 / 0.5 / 0.25 bands. Stuffing warns only when coverage > 0.85 **and** one term appears ≥ 8 times.
- **Evidence:**
  - 03 F17: no vendor publishes a threshold (Jobscan's 75% is commercial).
  - The competitor teardown (04 §455) recommended a saturation cap around 80% and a repetition warning at about 5×.
  - 8 repeats on a one-page student CV is extreme. Real stuffing shows at 4–5.
- **Fix:**
  - Set `STUFFING_REPEAT_MIN = 5`.
  - Drop the 0.85 coverage precondition (repetition is stuffing at any coverage).
  - Add tooltip copy at every band: "No ATS publishes a pass mark".

**28. Archetype weight (0.35) depends on an unvalidated keyword classifier in AI-off mode.**
- **Severity:** P2 · **Type:** implementation
- **Where:** `lib/ai/heuristics.ts:12-33`
- **Current:**
  - `product` matches the bare word "product", so "product of a team effort" counts.
  - `finance_banking` matches "markets" and "finance".
  - `research` matches "research".
  - Title hits weigh 3×.
  - A CV with "researched" bullets becomes "research".
  - Top archetype gets 5 versus 1.5 for a mismatch, the largest single swing in the score.
- **Fix:**
  - Drop bare `product`, `research`, `data` and `markets`. Require phrases ("product manager", "research assistant", "data analyst").
  - Let the student confirm or reorder archetypes in onboarding, and use the confirmed order.
  - Reduce the mismatch floor from 1.5 to 2.5 so that skill fit can outweigh a label.

**29. Spec §5 cites a personal anecdote as the basis for a hard gate.**
- **Severity:** P2 · **Type:** unsupported
- **Where:** `docs/superpowers/specs/2026-10-13-placed-design.md:114` ("17 of 19 of Berke's past rejections died here")
- **Fix:** Replace it with UKCISA/term-time logic and graduation-year logic (#2, #8). Keep the anecdote as motivation only.

**30. The synthesis status line is stale.**
- **Severity:** P3 · **Type:** stale
- **Where:** `00-synthesis.md:4` ("CV Score and tailoring modules … are not built yet")
- **Fix:** Update to say they are built (`lib/cv-score`, `lib/verify` exist), and link to where each recommendation landed or didn't.

**31. Cohort-clash soft flag hits placement-year students.**
- **Severity:** P3 · **Type:** implementation
- **Where:** `lib/scoring/fit.ts:83`
- **Current:** A "Winter" or term-time cohort is −0.5 for everyone.
- **Evidence:** UKCISA: course placements may be full-time in term time (A). Home students on a sandwich year are also free in term.
- **Fix:** Skip the flag when `student.onPlacementYear` or `job.employmentType === "placement"`.

---

## Re-verification table: numbers in market-2026

Status key: VERIFIED (primary opened, matches) · MISQUOTED (primary says something different) · OUTDATED (newer primary figure) · UNVERIFIABLE (primary not reachable, or not found in this pass).

| # | Claim (doc:line) | Status | Correct figure / note · source |
|---|---|---|---|
| 1 | 140 applications per graduate vacancy (00:10; 01:70) | VERIFIED for 2025 → **OUTDATED** | 2025: 140, highest since 1991. 2026: **141** (London 172, FPS 158). ISE 498/513 (2025); ISE 615 (14 Oct 2026) |
| 2 | 101 per internship, 123 per placement (01:72) | VERIFIED | Ratios rose 16% / 27% for matched employers. 4,979 interns, 1,763 placement students. ISE 508 |
| 3 | Internship applications +34%, placements +17% (01:72) | VERIFIED | 52 / 41 employers with comparable data. ISE 508 |
| 4 | "+16%/+27% applications from a different base" (01:74) | MISQUOTED | These are ratio changes, not application changes. ISE 508/513 |
| 5 | Graduate hiring −8% 2024/25, forecast −7% (01:29) | VERIFIED → **OUTDATED** | 2025/26 actual **+4%**, forecast 2026/27 **+7%**. ISE 615 |
| 6 | Grad:apprentice ratio 1.8:1, forecast 1.6:1 (01:29) | VERIFIED | ISE 513 |
| 7 | 42% cut / 25% flat / 33% increased (01:29) | PARTLY VERIFIED → OUTDATED | 42% cut confirmed. 25/33 not on the ISE page. 2026: 40% cut, 15% held, 45% increased (ISE 615) |
| 8 | 79% redesigning or reviewing (01:109) | VERIFIED → OUTDATED | 2026: 77%. ISE 615 |
| 9 | 10% ban AI, 49–50% allow, 45% no guidance (01:110-112) | VERIFIED (2025; 505 says 46% allow) → **OUTDATED** | 2026: up to **64%** accept AI; **82%** give guidance. ISE 615 |
| 10 | 85% suspected cheating; frequent 7→15%; 61% interviews (01:115-117) | VERIFIED → OUTDATED | 2026: **92%** suspected or confirmed. ISE 615 |
| 11 | "61% saw undisclosed AI use in interviews" (02:120) | MISQUOTED | It is the most common form of misconduct, cited by 61%. ISE 498 |
| 12 | 28% of employers use AI, up from 9% in 2022, "ISE SRS 2025" (03:97) | MISQUOTED / OUTDATED | That is ISE SRS **2023**. 2026: **16%** currently use AI. ISE 180; ISE 615 |
| 13 | Fully automated tests: numerical 57%, SJT 53%, verbal 49%, game 15% (01:127-131) | VERIFIED | ISE 505 |
| 14 | 48% worry graduates misrepresent with AI (02:120; 03:98) | VERIFIED | 52% for school leavers. ISE 513 |
| 15 | 67% (ISE Development Survey 2026) worry about misrepresentation (01:121) | UNVERIFIABLE (not re-opened) | ISE 565, not fetched in this pass |
| 16 | 2:1 required by ~47–48% (01:212; 02:117) | VERIFIED | 47% specify 2:1, 20% accept 2:2. Prospects Luminate (ISE 2025) |
| 17 | High Fliers −6.4% / −14.6% / −5.1%, −24.5% since 2022, −0.5% forecast (01:32) | VERIFIED | highfliers.co.uk, page dated 19 Mar 2026 |
| 18 | IB 2,365 planned vs 2,069 hired (01:34) | VERIFIED (press relaying B) | eFinancialCareers; also "students make 22 applications on average" |
| 19 | Big 4 intake cuts (KPMG −29% etc.) (01:36) | UNVERIFIABLE | Primary (Times / City AM) not reached. Web-search budget exhausted |
| 20 | Indeed: grad postings −7% YoY, lowest since 2020; postings 32% below Feb 2020; AI in 9.4%; ~50% of data/analytics (01:42) | VERIFIED (primary) | Hiring Lab UK mid-year report, 3 Aug 2026 (data/analytics 48.8%). Upgrade to B |
| 21 | Indeed −33% YoY mid-June 2025; Adzuna −32% (01:41,45) | UNVERIFIABLE | Press only (C ⚠). Keep out of UI |
| 22 | HESA 2022/23: 59% full-time employment (01:49) | VERIFIED | 88% in work or study, 6% unemployed. HESA, 17 Jul 2025 |
| 23 | 2023/24: 81% work, 7% unemployed, £30k (01:52-53) | VERIFIED | THE, 4 Jun 2026 (HESA data) |
| 24 | "20% applied for 100+ jobs" attributed to HESA (01:54) | MISQUOTED (attribution) | Jisc early-careers survey of 5,000 recent graduates |
| 25 | Prospects/Jisc: 100+ apps 8%→13%; 66% vs 40% AI; 44%; 38%; 27% vs 12% (01:83-87) | VERIFIED | Luminate, Jun 2026, n≈5,000. 44% is graduates (35% overall) |
| 26 | Bright Network 2026/27: 53% use AI; 25% would anyway; employers rank experience last (01:89,179) | VERIFIED (landing page) | Full instrument gated |
| 27 | Wiles 2025: +8% hires (00:12; 02:19; 05:16) | VERIFIED | NBER w30886 / Mgmt Sci 71(12) |
| 28 | Wiles sample ~480k vs ~195k; wages 10% vs 8.4% (02:18; 05:16) | 480k / 10% VERIFIED; **195k MISQUOTED / UNVERIFIABLE** | "Nearly half a million"; 8.4% is the draft-version wage figure |
| 29 | Cui 2025: 51% (00:10; 02:37) | VERIFIED number; **MISQUOTED framing in 00** | Alignment–callback correlation −51%, offers −79% (78.57%). +0.43 pp ITT on a 7.02% base. >75% of letters finalised within a minute |
| 30 | Galdin & Silbert: top quintile −19%, bottom +14% (01:96; 02:48) | VERIFIED | arXiv 2511.08785 (structural counterfactual) |
| 31 | Galdin & Silbert "$25.67 → $10.82 (−58%)" (02:47) | UNVERIFIABLE | Not in the abstract. The abstract says the premium "disappears", which conflicts with "−58%" |
| 32 | Xu et al.: 67–82% self-preference; +23–60% shortlist (00:14; 02:73; 03:166) | VERIFIED | arXiv 2509.00462 v4 (6 Jun 2026); non-archival at EAAMO/AIES 2025 |
| 33 | "97% fabrication", "50% with strict prompt", "47% bait", "54.5%" (00:15-16; 05:53-61) | VERIFIED (96.7%, 54.5%) with caveats | 54.5% covers qualifier drops **and** plausible claims. 50% and 47% not re-checked. 10 synthetic CVs, single author → grade C |
| 34 | CIPD 2026: 75% (00:11; 02:121) | VERIFIED, base matters | 35% monitor; 75% **of those** have rejected (≈26% of all employers). 27% report "excessive" use. CIPD, 22 Sep 2026 |
| 35 | Braun et al.: social internship +1.1 pp, programming/data +1.0, study abroad +0.8, GPA ≈0 (02:104-107) | VERIFIED | Table 4. "GPA" means *GPA listed* (+0.1 n.s.), not GPA level. Applications 2016–17 |
| 36 | Stephany et al.: AI skills +8–15 pp; 1,725 recruiters UK/US/DE (02:125) | VERIFIED | arXiv 2601.13286 v2 |
| 37 | Presentation flips 29.6–41.4% (02:74; 05:79) | VERIFIED | arXiv 2609.16517; small open models; under review → C |
| 38 | arXiv 2603.05189: 18 LLMs infer demographics from languages/hobbies; explanations amplify bias (02:132; 06:71,115) | VERIFIED, context missing | Singapore context; 4,100 variants; EMNLP 2026 submission |
| 39 | Kristal et al.: +8% / +15% callbacks, n = 9,022 UK (02:88-91; 05:30) | VERIFIED; scope caveat | Mid-career applicants (5 / 15 years' experience) |
| 40 | Workday HiredScore LLM per-qualification grading (03:17-22) | VERIFIED | Opt-in; preview/production 7 Aug 2026 |
| 41 | Oleeo "without anyone being automatically filtered out" (03:42) | **OUTDATED** | Page now: "automatically generate a … prioritised shortlist" |
| 42 | ICO Recruitment rewired: >30 employers, "solely automated decisions" (03:79-81) | VERIFIED (core); "16 organisations" UNVERIFIABLE | ico.org.uk |
| 43 | Deloitte UK: AI banned in assessments/interviews (01:144) | VERIFIED | Integrity-guidance page. "One application per year" not on that page → UNVERIFIABLE |
| 44 | PwC process and AI policy (01:143) | UNVERIFIABLE (403 this pass) | — |
| 45 | "75% of CVs rejected by ATS is a myth" (00:13) | VERIFIED as a sound conclusion | No primary source exists; vendors document ranking, not auto-reject (Workday, Greenhouse) |
| 46 | "67% of UK hiring managers say AI applications slowed hiring" (04:351) | UNVERIFIABLE | Press [3P]; not in my scope to chase |

Totals across the 46 rows: 27 verified (some with scope caveats), 7 outdated, 6 misquoted or misattributed, 8 unverifiable (several rows carry two statuses).

---

## How real UK employers knock candidates out (2026) vs what Placed models

| Knockout mechanism | Evidence | Placed today | Needed |
|---|---|---|---|
| Graduation-year window | JPM "expecting to graduate in 2029" (B/C); GS 3-year vs 4-year (B) | Year label; broken regex (#2) | `gradYear` window gate |
| Right to work / sponsorship | SAP rejection questions (A); UKCISA vacation rule (A) | Boolean, over-gates (#1) | `workAuth` × employment type |
| Degree class (2:1) | 47% of ISE employers (B) | None (#6) | Soft flag + contextual note |
| Experience years / seniority | Greenhouse extracts years (A) | None (#7) | Gate when ≥1 year stated |
| Automated eligibility screening, limit per candidate, early close | ISE 2026 (B) | None | Chips + "apply early" urgency |
| Online tests (numerical / SJT / verbal fully automated 49–57%; Cappfinity; Arctic Shores; Watson Glaser for law) | ISE 505 (B); GraduatesFirst (C); vendor pages | None | `employer_process` prep card (#25) |
| AI misuse in tests and interviews → removal | Deloitte UK (B); ISE 2026: 92% suspected misconduct | None | Integrity card per employer |
| LLM per-criterion CV grading (basic quals decide band) | Workday Aug 2026 (A) | Weighted mean (#5) | Must-have-first `requirementFit` |

---

## New rules / signals to add

| ID | Text / definition | Severity | Pass / fail anchors | Sources |
|---|---|---|---|---|
| FIT-ELIG-GRADYEAR | Job's graduation-year window must contain `student.gradYear`. Defaults: spring/insight P+2, internship P+1, placement P+2, graduate ≤ start ≤ grad+3 | Gate | Pass: JPM Spring 2027 + gradYear 2029. Fail: same + gradYear 2028 | JPM listings; GS spring page |
| FIT-ELIG-WORKAUTH | Sponsorship gate applies only when the student needs sponsorship *for this employment type* (see #1) | Gate | Pass: Student visa + summer internship + "no sponsorship". Fail: needs_sponsorship + grad scheme + "we do not sponsor" | UKCISA; Statement of Changes 14 Oct 2025 |
| FIT-ELIG-EXPYEARS | Stated "N+ years' experience" with N ≥ 1 for non-graduates | Gate | Fail: "2+ years commercial experience" for a 2nd-year | Greenhouse Talent Matching FAQ; SAP screening questions |
| FIT-MUST-CAP | Any `stated` must-have Missing → label ≤ "Stretch". requirementFit from must-haves only | Cap | "Must-haves met 2/3, 1 stated missing" → Stretch | Workday HiredScore Aug 2026 |
| FIT-SOFT-DEGREE | `min_degree_class` vs `predictedClass` → soft flag with contextual-offer note | Soft flag | Flag: asks 2:1, predicted 2:2 | Prospects Luminate (ISE 2025) |
| FIT-SOFT-SUBJECT | `degree_subjects` vs `profile.course` family | Soft flag | Flag: "CS or related" with a History course | JPM Engineer & Innovate listing |
| FIT-URGENCY | Deadline/rolling/opensOn → sort key and chip only, never fit | Sort | — | ISE 2026 (early closes); dates.ts:30 |
| SKILL-IMPLIES | CV-side implication map (PostgreSQL→SQL, pandas→Python…) credited 0.75 | Matching | JD "SQL" + CV "PostgreSQL" → supportedByResume | 03 F1–F4 (per-criterion graders) |
| SKILL-SOFT-OUT | Soft skills leave keyword coverage and are judged by explainMatch with a quote | Matching | "Teamwork" must be evidenced by a quoted bullet | ISE 513; NACE |
| PROC-CARD | Per-employer screening card: tests, video, AI policy URL, per-cycle limit | Info | Deloitte: "AI banned in Immersive Online Assessment" | Deloitte integrity page; ISE 505/615 |

## Rules to delete or downgrade

- **Delete** both posting-age penalties for early-careers types (`fit.ts:61,82`). They contradict career-ops' 365-day rule (#9).
- **Delete** deadline from the fit score (#4). Move it to urgency.
- **Delete** fit-label-scaled `APPLY_XP` (#3).
- **Downgrade** the permanent-role gate to "only if enrolled during the role" (#8).
- **Downgrade** `firstYearFriendly` from a +0.5 score bump to a filter or chip.
- **Downgrade** evidence grades to C for Takano 2608.26171, Chen & Xiao 2609.16517 and Tan et al. 2603.05189, consistently across 02/05/06 (#20).
- **Remove from UI copy:** "97%", "75% (CIPD)" without its base, "140" (use 141 with year), any C/⚠ number (Big 4 cuts, Indeed −33%, Adzuna −32%).

## Open questions

1. The ISE 2026 internship and placement ratios aren't in the summary article. The full report PDF is needed to update the 101/123 figures.
2. The ISE Development Survey 2026 "67%" figure was not re-opened.
3. The Big 4 intake numbers (Times / City AM primary) weren't reached. **The web-search budget for this session was exhausted** before I could chase them, Galdin & Silbert's "$25.67→$10.82", or the Tilburg CentER DP sample sizes.
4. PwC's application-limit and AI pages returned 403. The JPM and Bright Network listings were read via aggregator snippets only (C). Fetch the employer pages directly before seeding eligibility data.
5. Takano's "50% with strict prompt" and "47% bait" were not checked line by line in the paper body.
6. Whether a Student-visa holder may accept a full-time *fixed-term* summer internship that overlaps the start of term is an edge case. UKCISA says term-time limits then apply. The product should say "check your term dates".
7. No source gave a UK-specific estimate of how often "no sponsorship" postings actually reject Student-visa interns. Employer practice varies, so the fix is a flag plus a quote, not a pass guarantee.

## Sources

**A: regulator / official / peer-reviewed / vendor docs**
1. UKCISA, Student work (Student route conditions), viewed 2026-10-18. https://www.ukcisa.org.uk/student-advice/working/student-work/
2. GOV.UK, Student visa: work. https://www.gov.uk/student-visa/work
3. Workday HiredScore release notes, 5 Aug 2026. https://doc.workday.com/hiredscore/en-us/workday-hiredscore/hiredscore-release-notes/2026/august/wednesday--5th-august.html
4. ICO, Recruitment rewired (evidence Mar 2025–Jan 2026). https://ico.org.uk/about-the-ico/what-we-do/recruitment-rewired/
5. ONS, Vacancies and jobs in the UK: September 2026 (702k Jun–Aug 2026, lowest since Feb–Apr 2021; −4.9% YoY). https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/jobsandvacanciesintheuk/september2026
6. HESA Graduate Outcomes 2022/23, 17 Jul 2025. https://www.graduateoutcomes.ac.uk/news-and-blogs/88-of-202223-graduates-in-work-or-further-study-according-to-new-hesa-official-statistics
7. Wiles, Munyikwa & Horton, NBER w30886 / *Management Science* 71(12) 2025. https://www.nber.org/papers/w30886 ; https://arxiv.org/abs/2301.08083
8. Kristal et al., *Nature Human Behaviour* (online Dec 2022). https://ore.exeter.ac.uk/repository/handle/10871/131446
9. SAP Learning, SmartRecruiters rejection screening questions. https://learning.sap.com/courses/smartrecruiters-for-sap-successfactors-academy/creating-rejection-screening-questions
10. DSIT, Responsible AI in Recruitment, 25 Mar 2024. https://www.gov.uk/government/publications/responsible-ai-in-recruitment-guide/responsible-ai-in-recruitment

**B: institutional surveys, employer pages, working papers**
11. ISE, Graduate jobs stabilise, but AI use disrupts recruitment (Student Recruitment Report 2026), 14 Oct 2026. https://ise.org.uk/knowledge/insights/615/graduate_jobs_stabilise_but_ai_use_disrupts_recruitment
12. ISE, 5 trends from ISE's Recruitment Survey 2025, 22 Oct 2025. https://ise.org.uk/knowledge/insights/498/5_trends_you_need_to_know_from_ises_recruitment_survey_2025/
13. ISE, Top 10 stats of 2025, 8 Dec 2025. https://ise.org.uk/knowledge/insights/513/ise_top_10_stats_of_2025_you_need_to_know/
14. ISE, 5 internship and placement trends to watch in 2026, 24 Nov 2025. https://ise.org.uk/knowledge/insights/508/5_internship_and_placement_trends_to_watch_in_2026/
15. ISE, How are employers using AI in early careers recruitment, 12 Nov 2025. https://ise.org.uk/knowledge/insights/505/how_are_employers_using_ai_in_early_careers_recruitment
16. ISE, The application explosion, 28 Apr 2026. https://ise.org.uk/knowledge/insights/552/the_application_explosion_key_insights_for_employers/
17. ISE, Employers using AI to recruit graduates and apprentices triples (SRS 2023). https://ise.org.uk/knowledge/insights/180/employers_using_ai_to_recruit_graduates_and_apprentices_triples/
18. High Fliers, The Graduate Market in 2026. https://www.highfliers.co.uk/publication-the-graduate-market-report
19. Indeed Hiring Lab UK, 2026 Mid-Year UK Jobs & Hiring Trends Report, 3 Aug 2026. https://hiringlab.indeed.com/uk/blog/2026/08/03/mid-year-uk-jobs-hiring-trends-report/
20. CIPD, Resourcing and Talent Planning 2026, 22 Sep 2026. https://www.cipd.org/uk/knowledge/reports/resourcing-surveys/
21. Prospects Luminate (Jisc), 1 in 5 graduates apply for more than 100 jobs, Jun 2026. https://luminate.prospects.ac.uk/1-in-5-graduates-apply-for-more-than-100-jobs
22. Prospects Luminate, Early careers recruitment in 2025: integrity, inclusion, entry standards. https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards
23. Bright Network, What do graduates want? 2026/27. https://employers.brightnetwork.co.uk/research/what-do-graduates-want-2025-26-duplicate/
24. Deloitte UK, Early careers integrity guidance. https://www.deloitte.com/uk/en/careers/early-careers/integrity-guidance.html
25. Goldman Sachs, Get Set for GS Spring Insight. https://www.goldmansachs.com/careers/students/programs/emea/get-set-for-gs-spring-insight-programme.html
26. Cui, Dias & Ye, arXiv 2509.25054 v2 (12 Nov 2025). https://arxiv.org/abs/2509.25054 ; https://arxiv.org/html/2509.25054v2
27. Galdin & Silbert, arXiv 2511.08785 (11 Nov 2025). https://arxiv.org/abs/2511.08785
28. Xu, Li & Jiang, arXiv 2509.00462 v4 (6 Jun 2026). https://arxiv.org/abs/2509.00462
29. Braun et al., arXiv 2604.01933 v2 (23 Jul 2026). https://arxiv.org/abs/2604.01933
30. Stephany, Teutloff & Leone, arXiv 2601.13286 v2 (4 Mar 2026). https://arxiv.org/abs/2601.13286
31. Harver, Harver acquires pymetrics, 11 Aug 2022. https://harver.com/?p=36917
32. Home Office Statement of Changes 14 Oct 2025 (Graduate route 18 months), via PIE News. https://thepienews.com/shorter-graduate-route-from-january-2027-uk-govt-confirms/
33. Times Higher Education, "Drop in graduate employment a cooling, not collapse", 4 Jun 2026. https://www.timeshighereducation.com/news/drop-graduate-employment-cooling-not-collapse
34. eFinancialCareers on High Fliers IB hiring 2026. https://www.efinancialcareers.com/news/investment-banks-may-hire-record-graduates-in-2026-getting-a-job-could-be-harder-than-ever

**C: preprints graded down, practitioner, aggregators, vendor marketing**
35. Takano, arXiv 2608.26171 v2 (16 Sep 2026). https://arxiv.org/abs/2608.26171
36. Chen & Xiao, arXiv 2609.16517 (15 Sep 2026). https://arxiv.org/abs/2609.16517
37. Tan et al., arXiv 2603.05189 v3 (27 Aug 2026). https://arxiv.org/abs/2603.05189
38. Oleeo, AI candidate screening (vendor). https://www.oleeo.com/products/ai-candidate-screening
39. Arctic Shores homepage (vendor claims). https://www.arcticshores.com/
40. GraduatesFirst, Cappfinity tests 2026/27 (modified 18 Aug 2026). https://www.graduatesfirst.com/aptitude-tests-publishers/cappfinity
41. Bright Network / Evenbreak / jobs24 listings, JPMorganChase 2027 Spring Insights (graduate 2029; close 1 Nov 2026). https://www.brightnetwork.co.uk/graduate-jobs/jp-morgan/2027-spring-insights-influence-execute-at-jpmorganchase-london
