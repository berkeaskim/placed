# Role Playbooks: Finance, Quant and Consulting audit

**Overall grade: C+.** The research file is unusually careful. Every quote I re-checked matches its page, all 42 cited URLs return HTTP 200 (checked 2026-10-18), and the grading is mostly conservative. What users actually see is worse than the research, for three reasons:

1. **Expired eligibility is shown.** The shipped code has no upper year limit. Final-year and Master's students are shown first-year-only programmes (Jane Street FTTP, JPMorganChase Spring Insights) as their top three "Strengthen your profile" actions.
2. **Safeguards are dropped at build time.** `reviewBy` on dated guidance and the honest `signalValue` labels are removed by the build, so stale dates and low-value items show with no warning.
3. **Coverage is too narrow for the UK market.** It covers 3 archetypes and about 15 named employers. Asset management, Big 4/professional services, actuarial/insurance, corporate banking, placement years, off-cycle internships and every access/diversity programme are missing, even though the market doc says Big 4 is form-gated and the CV rules already score BMC and Big 4.

The ranker also rewards the cheapest, lowest-signal items (Forage, CFI) above the high-signal ones, and XP pays the same 40 points for a 90-minute course as for a term-long client project.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality | B | Quotes are verbatim and URLs live. Several A grades rest on one hedged employer line plus secondary sources (S01, S06, S07 consulting, QNT-S04). |
| Freshness | C | Undated "open now" text is baked into descriptions. Dated `reviewBy` is dropped, so "Bain ACI expected Nov 2026" still shows in March 2027 (simulated). Live 2026/27 programmes are missing: Jane Street FOCUS (closes 8 Nov 2026) and INSIGHT London, BlackRock Spring Insight (closes 4 Dec 2026), PwC spring programmes. |
| Coverage | D | No asset management, Big 4, actuarial, insurance, corporate banking, ER, wealth, tech/economic consulting. No placement year, off-cycle or boutique routes. No access programmes (SEO London, upReach, 10,000 Interns, GAIN, Elevate@BCG). No visa guidance. |
| Implementation fidelity | C- | No `maxYear` (actions.ts:27). Dated `reviewBy` stripped by zod (schema.ts:43-48). `signalValue`/`cost` dropped (build-playbooks.ts:21). The 4-year-course `note` is never rendered. Selective internships are offered as "gap closers". |
| Consistency | C | Contradicts the CV rules (BMC and CFA rewarded there, dropped here; Big 4 in CV rules, absent here; spring-week timing). The UI's "evidence D" badge contradicts the doc's "no D used". The market doc says MBB need a cover letter, but Bain London does not. |
| UX / copy | C | "Gap Closer" badge fires with no gap closed. "I've done this" on application-type programmes is ambiguous. "Effort: weekend" for multi-day London programmes and "term" for 10-week internships. Notes become tailoring facts with no type, which risks breaking BCG's Forage listing rule. |

## Findings

### 1. First-year-only programmes are recommended to finalists and Master's students
- **Severity**: P0 · **Type**: implementation / wrong
- **Where**: `lib/target/actions.ts:27` (`YEARS.indexOf(a.minYear) <= yi`); `lib/playbooks/schema.ts:25-41` (no `maxYear`); `lib/target/progress.ts:26-29` (`actionFor` has the same one-sided check). Affected: PB-QNT-E01 (FTTP), PB-FIN-E01 (JPMC Spring Insights), PB-FIN-E04 (Bridge), PB-CON-P02/E02 are fine.
- **Current**: Only `minYear` exists. Running `pickActions` on 2026-10-18 with no matched gaps gives the fallback for `final` and `masters`: finance `PB-FIN-P04, PB-FIN-E01, PB-FIN-E02`; quant `PB-QNT-E01, PB-QNT-C02, PB-QNT-C04`.
- **Evidence**:
  - Jane Street FTTP page (A, janestreet.com, accessed 2026-10-18): "a select group of first-year undergraduates". Jane Street programmes feed (A) restricts Bridge to students "who will graduate in 2029".
  - JPMorganChase Spring Insights (A, accessed 2026-10-18): "If you're planning to start your full-time career in two years' time".
  - TARGETjobs (B, 2 May 2025): spring weeks are "traditionally aimed at first-year students on three-year courses and second-year students on four-year courses."
- **Fix**:
  - Add `maxYear: z.enum(YEARS).optional()` to `Action`, and filter `YEARS.indexOf(a.minYear) <= yi && (!a.maxYear || yi <= YEARS.indexOf(a.maxYear))` in both `pickActions` and `actionFor`.
  - Better: add `eligibleYears: Year[]` plus a `gradYear?: number` constraint, because Bridge/BlackRock key on graduation year, not year of study.
  - Set FTTP `["1st"]`, Bridge `gradYear 2029`, JPMC Spring Insights `["1st","2nd"]` with the 4-year caveat.
  - Add a build check: every `type:"experience"` with a URL must declare eligibility.

### 2. `reviewBy` on dated guidance is silently stripped, so stale dates show indefinitely
- **Severity**: P0 · **Type**: implementation / stale
- **Where**: `docs/research/role-playbooks-finance-consulting.md:396` (`reviewBy: 2026-11-30` on the Bain ACI line); `lib/playbooks/schema.ts:43-48` (`DatedGuidance` has `expiresOn` only, and zod strips unknown keys); `lib/target/actions.ts:59-63`.
- **Current**: "Bain London ACI 2027 applications are expected to open in November 2026 (no date given)." Simulated for a 2nd-year on 2027-03-01, the line still shows, with no stale badge.
- **Evidence**: Bain London page (A, accessed 2026-10-18): "Applications for the 2027 ACI programme are expected to open in November 2026."
- **Fix**:
  - Add `reviewBy: Day.optional()` to `DatedGuidance`.
  - In `activeGuidance`, hide dated lines whose `reviewBy` is more than 30 days past. Between `reviewBy` and `reviewBy+30`, render them with the same "Dates may have changed — check the official page" badge.
  - Add a build failure for any dated line that has neither `expiresOn` nor `reviewBy`.

### 3. "Honest signal value" labels are dropped at build, so low-value items look as strong as real experience
- **Severity**: P1 · **Type**: implementation / copy
- **Where**: `scripts/build-playbooks.ts:21` (`DROP = ["hours","free","cost","signalValue",...]`). Affected: PB-FIN-C01, C02, E02; PB-QNT-C01–C04, E02; PB-CON-C01, C02, E02 (verified by diffing the research JSON against `data.json`).
- **Current**: The research says, for example, PB-QNT-C04 Zetamac "none on CV; test practice only" and PB-CON-E02 "low; follow BCG's listing rule". `data.json` has no such field, and only some descriptions repeat it.
- **Evidence**: Forage/BCG page (A, accessed 2026-10-18): "It is our policy that you do not list your completion of this program as work or internship experience on your CV".
- **Fix**:
  - Keep `signalValue` as an enum: `cv_high | cv_medium | cv_low | interview_prep | test_prep`.
  - Render it as a chip, and keep `cost` ("Free").
  - Use it in ranking (Finding 5) and in XP (Finding 7).

### 4. Selective internships are offered as ways to "close a skill gap"
- **Severity**: P1 · **Type**: implementation / wrong
- **Where**: `lib/target/actions.ts:26-34`. Affected: PB-QNT-E03 (skills include Machine Learning, Python, Probability); PB-FIN-E05 (Financial Modelling); PB-CON-E03 and E04 (Case Interviews); PB-QNT-E04.
- **Current**: Simulation: a Master's student with gaps Python and Probability gets `PB-QNT-E03 [Python, Probability]`, i.e. "do the Jane Street internship" to build Python. A finalist with a modelling gap gets PB-FIN-E05 (GS Summer Analyst).
- **Evidence**: Jane Street QT internship (A, accessed 2026-10-18): "A strong quantitative thinker (no specific degree or major is required)". ISE (B, 24 Nov 2025) reports internships draw 101 applications per hire, so these are outcomes, not training.
- **Fix**:
  - Split actions into `kind: "build"` (projects, courses, societies) and `kind: "opportunity"` (selective programmes). Only `build` items can be gap-closers.
  - Show `opportunity` items in a separate "Apply to" list that is filtered by eligibility and deadline.
  - Remove "Machine Learning" from PB-QNT-E03. That is a department name, not a skill the internship builds.

### 5. The ranker puts the cheapest, lowest-signal actions first
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/target/actions.ts:18-19` (`rank`: covers, then effort ascending, then type project<experience<course).
- **Current**: The consulting fallback for every year is `PB-CON-P03, PB-CON-E02 (Forage), PB-CON-C01`. 180DC (PB-CON-E01) and leading a measurable improvement (P04), the items Bain and McKinsey actually ask for, never reach the top 3.
- **Evidence**:
  - Bain London (A): "Plus, a record of initiative, leadership, and teamwork."
  - BCG UK (A, accessed 2026-10-18): "evidence of excellence in areas outside of academics".
  - BCG says the Forage simulation must not be listed as experience.
- **Fix**: Rank by `covers.length`, then `signalStrength` (`cv_high` 3 … `test_prep` 0), then effort, then id. Cap course/test-prep items at 1 of the top 3.

### 6. Year model: 2nd-years on 4-year degrees get penultimate advice, and the 4-year note is never shown
- **Severity**: P1 · **Type**: implementation / wrong
- **Where**: `scripts/build-playbooks.ts:18` (`year2_penultimate: ["2nd","penultimate"]`); `lib/target/view.ts:35` (year defaults to `"2nd"`); `lib/playbooks/schema.ts:55` `note` is not rendered by `app/(app)/profile/target/page.tsx:199-203`.
- **Current**: A 2nd-year on a 4-year MEng/MSci (the spring-week year) sees "Apply for summer analyst internships… BCG London runs 1-24 Jan 2027". Students with no year set are treated as 2nd-years.
- **Evidence**:
  - TARGETjobs (B) as in Finding 1.
  - Trackr (C, 9 Sep 2026): spring weeks are "designed for students in the first year of a three-year degree or the second year of a four-year degree".
- **Fix**:
  - Add `courseLength: 3|4|5` to the profile, and derive `yearsToGraduation` and graduation year. Key guidance on "years to graduation" (2 = spring-week year, 1 = penultimate, 0 = final), not on the year label.
  - Until then, render `pb.note` under "For your year" whenever year is `2nd` or `penultimate`.
  - Default an unknown year to *no* year-specific guidance, plus a prompt to set it.

### 7. XP pays the same for a 90-minute course as for a term-long project, with no evidence required
- **Severity**: P1 · **Type**: implementation / fairness
- **Where**: `lib/gamify/core.ts:55` (`playbook_done` → 40 XP, cap 3/day); `lib/target/progress.ts:60-71` (a 10-character note suffices).
- **Current**: Marking CFI "Careers in Finance" (1h30) or Zetamac done earns the same 40 XP as running a 180DC client project.
- **Evidence**: The research's own labels: CFI "very low", Zetamac "none on CV". ISE (B) shows the market rewards demonstrated behaviour, not volume.
- **Fix**: Make XP effort- and signal-weighted: `weekend` 15, `2-4 weeks` 40, `term` 80. Interview/test-prep items get 10. Add +10 when an https evidence link is supplied. No XP for `opportunity` items until the user logs "attended" or "offer".

### 8. The "Gap Closer" badge overclaims
- **Severity**: P2 · **Type**: copy / implementation
- **Where**: `lib/gamify/core.ts:22,80`.
- **Current**: "Closed your first skill gap from a Role Playbook" is awarded on any `playbook_done`, including fallback and top-up actions with `covers: []`.
- **Evidence**: `pickActions` returns fallback items with empty `covers` (actions.ts:34).
- **Fix**: Pass `covers.length > 0` in the event and award `gap_closer` only then. Otherwise use a new badge, "First step" ("Finished your first Role Playbook step").

### 9. Completion notes become untyped tailoring facts, which risks breaching BCG's Forage rule
- **Severity**: P2 · **Type**: implementation / fairness
- **Where**: `lib/target/progress.ts:97-99` (the note goes into `confirmedFacts` with `source: "user-stated"`); consumed by `lib/verify/tailoring.ts:185-190` and `lib/cover-letter/draft.ts:138`.
- **Current**: A note like "Completed BCG strategy consulting simulation, built market-entry recommendation" becomes a corpus fact with no type. It can then support an Experience-section bullet or a cover-letter claim.
- **Evidence**: BCG/Forage (A) listing policy, quoted in Finding 3. LinkedIn rules already flag "a Forage simulation listed as employment" (`lib/linkedin-rules/rules.json:2173`).
- **Fix**:
  - Store `kind` (`course|simulation|project|programme`) and `action_id` on the fact.
  - The tailor may place `simulation`/`course` facts only under Courses/Activities. Verification rejects them as Experience evidence.
  - Add to PB-CON-E02 evidence: "List as 'BCG Strategy Consulting Job Simulation (Forage), [month year]' under Courses."

### 10. Live, cheap, high-value 2026/27 quant programmes are missing (one closes 8 Nov 2026)
- **Severity**: P1 · **Type**: missing / stale
- **Where**: quant playbook, `docs/research/role-playbooks-finance-consulting.md:226-274`.
- **Current**: Only FTTP and Bridge are listed from Jane Street.
- **Evidence**: Jane Street programmes feed (A, `programs-endpoint.json`, accessed 2026-10-18):
  - FOCUS London: dates "January 13th - January 16th, 2027", deadline "Sunday, November 8th, 2026 at 11:59pm GMT". The FOCUS page: "you must be a first-year college/university student who has experienced barriers".
  - INSIGHT London: "April 5th - April 10th, 2027", deadline 3 Jan 2027, categories Trading and Research / SWE / Strategy and Product. The INSIGHT page: "we invite women, transgender, and/or gender-expansive individuals"; travel, meals and housing covered.
- **Fix**:
  - Add PB-QNT-E06 "Jane Street FOCUS (London)": first year, `expiresOn 2026-11-08`, "for first-year students who have faced barriers to STEM opportunities (e.g. first-generation, financial need, under-resourced school); travel and housing covered".
  - Add PB-QNT-E07 "Jane Street INSIGHT (London)": `expiresOn 2027-01-03`.
  - Add both to `yearGuidanceDated` for 1st year.

### 11. No access or diversity programmes at all: the playbook favours students with connections
- **Severity**: P1 · **Type**: missing / fairness
- **Where**: all three playbooks. Doc lines 413-429 list gaps but never mention access programmes.
- **Current**: The advice is generic: "join the investment society", "attend firm events", "run 15-20 live cases with a partner".
- **Evidence**:
  - Sutton Trust, *Unpaid and Underpaid Internships* (A/B, Jan 2025): "Just 1 in 10 internships was found through an open advertisement"; the working-class/middle-class access gap widened "from 12 percentage points to 20".
  - SEO London (B, accessed 2026-10-18): "955 participants went on to secure competitive summer internships, vacation schemes and graduate roles" (2024-25).
  - 10,000 Interns Foundation (B): "more than 10,000 paid internship opportunities were created across 35+ sectors".
  - GAIN (B): "Women and non-binary students: your investment career starts here", plus free programmes.
  - BCG UK (A): "Elevate@BCG, BCG London's socioeconomic diversity network, invites students from socioeconomically disadvantaged backgrounds".
  - PwC Advancing Social Mobility Programme 2027 (B, TARGETjobs listing): "three-day paid programme which will be run in Spring 2027".
  - TARGETjobs (B): some insight programmes are "geared towards student cohorts of any year who are underrepresented".
- **Fix**:
  - Add a cross-archetype "Access programmes" block of `opportunity` items, each with its eligibility text verbatim: SEO London, upReach (eligibility not verified, see Open questions), 10,000 Black Interns, GAIN (investment management), Jane Street FOCUS/INSIGHT, Elevate@BCG, PwC Advancing Social Mobility / Black Talent in Business / Women in Business.
  - Show the whole block to everyone, with the copy "Check eligibility yourself."
  - **Never infer or store ethnicity, gender or class.** These are UK GDPR special-category data (ICO), and positive-action programmes are lawful under Equality Act 2010 s.158. Self-selection keeps the product out of processing them.
  - Exclude Sutton Trust Pathways (it is for Year 12-13 school pupils; Sutton Trust page, accessed 2026-10-18).

### 12. Asset management is missing, though it has live programmes now
- **Severity**: P1 · **Type**: missing
- **Where**: finance playbook (`finance_banking` covers IBD/markets only in practice). The CV rules scope (`cv-rules-finance-consulting.md:3`) includes asset management.
- **Current**: No AM signal or action. JPMC is the only spring insight.
- **Evidence**:
  - BlackRock 2027 Spring Insight Event EMEA (A, careers.blackrock.com, accessed 2026-10-18): "students of all academic backgrounds who will graduate with an undergraduate or master's degree in 2029"; "Deadlines: Friday 4th December 2026"; "If you withdraw your application, you cannot submit another application for this programme this year."
  - GAIN (B) offers a free investment management course.
- **Fix**:
  - Add PB-FIN-E06 BlackRock Spring Insight (`gradYear 2029`, `expiresOn 2026-12-04`).
  - Add a signal PB-FIN-S09: "AM/research recruiters look for an investment view you can defend". Back it with the existing stock-pitch project, and grade it B only after one AM firm page is quoted.
  - Long-term, add `sectorVariant` (IBD / S&T / AM / corporate banking / wealth / ER), as the CV-rules doc proposes (`cv-rules-finance-consulting.md:261`).

### 13. Big 4 and professional services are absent, though they are the largest UK graduate recruiters and use a different process
- **Severity**: P1 · **Type**: missing / contradiction
- **Where**: consulting playbook (MBB only). Contrast `docs/research/market-2026/01-early-careers-market.md:143-145,153` and `cv-rules-finance-consulting.md:44,171`.
- **Current**: Every consulting action assumes a CV plus case interviews.
- **Evidence**:
  - Market doc (B, citing pwc.co.uk modified 3 Sep 2026): PwC runs form → online assessment → video interview → assessment centre, "One application per intake year".
  - Deloitte UK integrity guidance: AI is "prohibited" in assessments.
  - Big 4 intakes were cut (market doc F1, C via press).
  - PwC spring 2027 programmes exist (TARGETjobs, B).
- **Fix**:
  - Add a `professional_services` archetype, or a consulting variant `B4`, with these signals:
    - "Form + tests carry the screen; CV adds little" (B).
    - "One application per firm per year: don't apply until your test prep is done" (B).
    - "AI banned in assessments/interviews" (B).
  - Add actions: practise the firm's assessment type, a PwC/Deloitte/KPMG/EY spring programme (`opportunity`), and ICAEW/ACCA awareness for audit/tax.
  - Until it ships, add one consulting dated/evergreen line: "Big 4 consulting/deals: applications are form-and-test-led and most allow one application a year, so prepare tests first."
  - PwC's own page returned 403 to my fetch. Re-verify before shipping.

### 14. Actuarial, insurance, corporate banking, ER, wealth, tech and economic consulting are not routed anywhere
- **Severity**: P2 · **Type**: missing
- **Where**: `lib/types.ts:1-4` (8 archetypes).
- **Current**: A student targeting actuarial work falls into `finance_banking` or `quant_trading` and gets IB/trading advice.
- **Evidence**: Prospects actuary profile (B, accessed 2026-10-18): "Employers typically look for a 2:1 or above, ideally in a numerate subject"; entrants join the IFoA exam route. IFoA (A) runs a "Your First Actuarial Role" hub. These are different signals: exams, IFoA student membership.
- **Fix**:
  - Short term: add an `others` guidance line to `finance_banking`: "Actuarial/insurance: different route (IFoA exams, actuarial placements). See Prospects 'Actuary' and IFoA 'Your First Actuarial Role'."
  - Medium term: add `sectorVariant` values `actuarial`, `insurance`, `corporate_banking`, `wealth`, `equity_research`, and consulting variants `strategy | tech | economic | B4`.

### 15. No placement-year (12-month), off-cycle or boutique routes
- **Severity**: P1 · **Type**: missing
- **Where**: year guidance, doc lines 131-137, 266-272, 386-392.
- **Current**: Final-year guidance is "apply to programmes that admit final-year students… and to graduate roles". There is no placement-year track.
- **Evidence**:
  - Cambridge Careers, *Banking & Financial Markets Short Guide 2025-26* (B, extracted 2026-10-18): "Keep applying throughout the year, with Lent being key for off-cycle or experienced roles"; "Boutique firms and fintechs hire less formally".
  - ISE (B, 24 Nov 2025, via market doc): 123 applications per placement hire.
- **Fix**:
  - Add a `placement` year option, or a `placementYear: boolean` that maps to "apply in penultimate autumn for 12-month industrial placements".
  - Add finalist/Master's guidance: "No internship? Off-cycle internships (often advertised Jan-Mar), boutique and mid-market advisory firms (recruit year-round, less formally), and graduate schemes at retail/corporate banks that recruit later in the cycle."

### 16. International students get no visa or right-to-work guidance; the Graduate visa shrinks for 2027 applicants
- **Severity**: P1 · **Type**: missing / fairness
- **Where**: all `final`/`masters` guidance.
- **Current**: Nothing.
- **Evidence**:
  - GOV.UK Graduate visa (A, accessed 2026-10-18): "2 years if you apply on or before 31 December 2026; 18 months if you apply on or after 1 January 2027".
  - Cambridge banking guide (B): "Apply to offices where you are proficient in the business language and have rights to work".
  - The Optiver posting (A) is Amsterdam-based.
- **Fix**: Add to `final` and `masters` in all three playbooks: "International students: the Graduate visa lasts 18 months if you apply from 1 Jan 2027 (2 years before). Check each firm's sponsorship stance before applying. Optiver's internship here is in Amsterdam."

### 17. Penultimate-year finance guidance ignores that the 2027 summer cycle is largely closing now
- **Severity**: P1 · **Type**: stale / wrong
- **Where**: doc line 134; PB-FIN-E05 (`timing` appended into description at build, `build-playbooks.ts:61`).
- **Current**: "Apply for summer analyst internships (GS 2027 EMEA is open now, reviewed on a rolling basis)."
- **Evidence**:
  - GS (A, accessed 2026-10-18): "We review applications on a rolling basis and encourage you to apply as soon as you are ready."
  - Cambridge (B): penultimate "Busiest internship applications cycle" runs Jun-Aug to Nov; "Timing: Start early, ideally in the summer."
  - BCG (A) is the counter-example: "All decisions are made after the deadline, so you are not at a disadvantage if you apply later in the application window."
- **Fix**: Replace with: "Banks open summer 2027 internships from about June to September and most review on a rolling basis (GS says so), so by late October apply immediately and expect places to fill. Consulting differs: BCG London decides after its deadline, so a polished application late in the window is fine." Remove "open now" from the description, because relative time words must never be frozen into data.

### 18. First-year finance guidance misses the cycle and the wider spring-week set
- **Severity**: P2 · **Type**: stale / missing
- **Where**: doc line 133.
- **Current**: Names only JPMC Spring Insights and Jane Street Bridge.
- **Evidence**:
  - Trackr (C, 9 Sep 2026): the cycle runs "from June through to the following April. Investment banks dominate October and November, consulting and trading firms cluster in January and February".
  - BlackRock (A): closes 4 Dec 2026.
  - Jane Street (A): FOCUS closes 8 Nov 2026.
- **Fix**: "Spring-week applications run Jun-Apr. Banks mostly Oct-Nov, trading and consulting Jan-Feb. Many review on a rolling basis, so apply in the first fortnight a programme opens. Use a tracker to find openings (its dates are estimates)." Then the dated lines.

### 19. Spring-week timing contradicts the CV-rules doc
- **Severity**: P2 · **Type**: contradiction
- **Where**: `docs/research/cv-rules-finance-consulting.md:243` ("Banks recruit for them from about September to October of first year") vs the evidence in Finding 18.
- **Current**: The two docs give different windows.
- **Evidence**: As in Finding 18. BlackRock (A) is open until 4 Dec 2026, and Jane Street Bridge, FTTP and INSIGHT until 3 Jan 2027.
- **Fix**: Make both docs say "June to April, peaking Oct-Nov for banks and Jan for trading/consulting".

### 20. Bloomberg Market Concepts was dropped from the playbook but is rewarded by the CV rules, which is an access bias
- **Severity**: P1 · **Type**: contradiction / fairness
- **Where**: doc line 417 (BMC dropped); `cv-rules-finance-consulting.md:83,97` (FIN-07 counts BMC as a signal and lists it in the keyword bank).
- **Current**: The CV score rewards BMC, but the playbook never tells students how to get it free, or warns them not to pay.
- **Evidence**:
  - University of Manchester Library FAQ (B, accessed 2026-10-18): "As a University of Manchester student, you can complete the course and get certification for free"; it must be taken on a terminal, "otherwise you will be charged $149 for BMC."
  - UCL Library (B): "Bloomberg Data Terminals aren't available in UCL Libraries".
- **Fix**:
  - Add PB-FIN-C03 "Bloomberg Market Concepts (only if your university gives free terminal access)": evidence "Bloomberg certificate", `signalValue cv_low`, `howToFind` "Check your library's Bloomberg page; don't pay $149".
  - In FIN-07, BMC must not count as a gap when it is absent. Treat it as bonus only, so students at universities without terminals (e.g. UCL libraries) are not penalised.

### 21. "Spring weeks are the main early pipeline" overstates the evidence for grade A
- **Severity**: P2 · **Type**: unsupported
- **Where**: doc line 28, PB-FIN-S01.
- **Current**: "Spring weeks and insight programmes are the main early pipeline into summer internships." Graded A.
- **Evidence**:
  - JPMC (A) is hedged: "Participants may be considered for next steps".
  - TARGETjobs (B) says "likely".
  - Trackr (C) explicitly says conversion is "rarely published".
  - No employer states "main pipeline". Cambridge (B) says "Many graduate roles are filled by interns from Spring weeks", which is about graduate roles, not the summer pipeline.
- **Fix**: Text: "Spring weeks and insight programmes can lead to a summer-internship fast-track or offer at some firms, but conversion rates are rarely published." Keep grade A for "can lead to"; drop "main".

### 22. PB-FIN-S06 "Any job counts" is graded A, but its JPMC quote does not address part-time jobs
- **Severity**: P3 · **Type**: unsupported
- **Where**: doc line 33.
- **Current**: A, from the GS recruiter transcript plus JPMC's "using measurable data when applicable".
- **Evidence**: JPMC How we hire (A, accessed 2026-10-18) only says resumes should use "measurable data when applicable". Barclays (A) is the better corroboration: "tell us about your extra-curricular activities, work experience".
- **Fix**: Swap the JPMC quote for the Barclays quote. Grade A stands with GS plus Barclays.

### 23. Consulting S07 is graded A on a 2024 guide's hedge
- **Severity**: P2 · **Type**: unsupported / stale
- **Where**: doc line 291, PB-CON-S07. The Cambridge consulting guide is the 2024 edition (doc line 535).
- **Current**: Graded A, including "firms will likely keep a record of who attended".
- **Evidence**: Only Cambridge (B, 2024) states the record-keeping. BCG (A) shows events exist; its 2026 events (24 Sep–15 Oct) are already past.
- **Fix**: Grade B. Move the record-keeping clause into `note`. Add a reviewBy on any event-based advice tied to the Sep-Oct season.

### 24. QNT-S04 "puzzles" is graded A from a puzzle page that is not hiring guidance
- **Severity**: P3 · **Type**: unsupported
- **Where**: doc line 153.
- **Current**: A, from Optiver ("Interested in strategic games") plus the Jane Street puzzles page.
- **Evidence**: The puzzles page is content marketing, not selection criteria. Cambridge (B) is the independent corroboration: "Cognitive interviews… use a variety of games, brainteasers and puzzles".
- **Fix**: Replace the puzzles-page quote with the Cambridge quote, and keep A.

### 25. Quant-research and quant-dev needs are folded into a trading playbook that calls programming "a plus"
- **Severity**: P2 · **Type**: missing / wrong-by-omission
- **Where**: doc line 154, PB-QNT-S05; archetype `quant_trading`.
- **Current**: "Programming (usually Python) is a plus for trading roles but not a requirement."
- **Evidence**: The S05 sources support this only for trader roles. Cambridge (B) lists "timed coding tests" for technical roles. Jane Street's SEE categories (A feed) split "Quantitative Trading & Research" from SWE.
- **Fix**: Scope the signal text to "trader roles". Add PB-QNT-S08: "Quant research/dev roles test coding and statistics directly". Grade it C until a QR firm page is quoted. Link the existing backtest project (P01) as its main action.

### 26. Assessment integrity rules (AI banned in tests) are absent from the process signals
- **Severity**: P2 · **Type**: missing
- **Where**: PB-FIN-S04, PB-QNT-S03, PB-CON-S03.
- **Current**: The signals say to prepare for tests, with no rules attached.
- **Evidence**:
  - Bain London FAQ (A, accessed 2026-10-18, via WebFetch): AI use is not permitted in the online assessment.
  - Deloitte UK (B via market doc): AI "prohibited" in assessments.
  - PwC (B via market doc) checks for "indicators of third-party or AI-assisted support".
- **Fix**: Add one sentence to each process signal: "Firms including Bain and the Big 4 ban AI help in online tests and interviews. Practise unaided."

### 27. Several cross-doc copy contradictions
- **Severity**: P2 · **Type**: contradiction / copy
- **Where**:
  - (a) `components/target/action-card.tsx:41` badges every project "Our suggestion · evidence D", but doc line 13 says "D: none are used here" and projects carry cited sources.
  - (b) `market-2026/01-early-careers-market.md:151` says MBB use "CV (+ cover letter for MBB)".
  - (c) CV rules FIN-11 reward CFA Level I, but the playbook never mentions it.
- **Evidence**: (b) Bain London (A): "You will not need to submit a cover letter if applying for the Associate Consultant role in the London office." Jane Street (A): "Do I need a cover letter? Nope!"
- **Fix**:
  - (a) Badge text: "Our suggestion (built from cited employer guidance)".
  - (b) Change the market doc to "cover letter varies by firm/office (Bain London: none)", and make the cover-letter feature say so for Bain London.
  - (c) Add a note to PB-FIN-S08: "CFA Level I is a minor bonus for AM/research and never a substitute for grades (C)". No action, because the exam fee is a cost barrier.

### 28. Effort labels are wrong for experiences; the "I've done this" CTA is ambiguous
- **Severity**: P2 · **Type**: copy
- **Where**: data effort fields (e.g. PB-FIN-E01 "weekend", PB-QNT-E01 "weekend" for 21-25 Mar, PB-FIN-E05 "term" for a 9-10 week summer internship); `components/target/action-card.tsx:64`.
- **Current**: Multi-day programmes in London are labelled "weekend". The CTA is "I've done this".
- **Evidence**: Jane Street feed (A): FTTP runs Sun-Thu, 21-25 March 2027. GS (A): "nine to ten week summer internship". BlackRock (A): a week-long event.
- **Fix**:
  - For `opportunity` items, replace effort with "Application: ~2-6 h; programme: N days, in London (travel covered: yes/no/unknown)".
  - CTA states: "Applied", "Attended", "Got an offer". Award XP on "Attended".

### 29. The "2:1" signal omits ISE's plateau caveat and gives no route for students below 2:1
- **Severity**: P3 · **Type**: copy / fairness
- **Where**: PB-FIN-S02, PB-CON-S01.
- **Current**: The ISE fall from 71% to 47% is quoted. The "plateauing" clause and contextual recruitment are not.
- **Evidence**: Prospects Luminate/ISE (B, accessed 2026-10-18): "ISE data from the last three years suggests that this trend may be plateauing". The CV rules note Deloitte "offers contextual routes" (`cv-rules-finance-consulting.md:44`).
- **Fix**: Add: "If you're below a 2:1 or had mitigating circumstances, look for firms that use contextual recruitment or have no grade bar (Jane Street states none). Declare extenuating circumstances where the form allows."

### 30. Tests do not guard time-bound or eligibility data
- **Severity**: P2 · **Type**: implementation
- **Where**: `tests/playbooks/build.test.ts`.
- **Current**: The tests check sources, skills and year-guidance presence only.
- **Fix**: Add tests that:
  1. Every `experience` with a URL has `expiresOn`, `reviewBy` or `evergreen: true`.
  2. No description contains "open now", "currently", "this year" or "next month".
  3. `yearGuidanceDated` keeps `reviewBy` after normalise.
  4. `pickActions(..., "final")` never returns an action whose `eligibleYears` excludes final.
  5. The built `signalValue` exists for every course/simulation.

### 31. MIT 15.401 is the 2008 edition
- **Severity**: P3 · **Type**: stale
- **Where**: PB-FIN-C01.
- **Current**: "15.401 Finance Theory I (Fall 2008)".
- **Evidence**: The URL is live (HTTP 200, 2026-10-18). I did not check for a newer edition (search budget exhausted).
- **Fix**: Keep it. Add `reviewBy: 2027-06-30` to check for a newer OCW edition.

## New rules / signals to add

| ID | Text | Severity / grade | Pass / fail anchors | Sources |
|---|---|---|---|---|
| PB-ALL-S01 (cross-archetype) | Access programmes exist for under-represented and low-income students and often include paid places or fast-tracks; check eligibility yourself. | Signal, B | Pass: the playbook shows ≥5 verified access programmes to all users. Fail: inferred demographics or no list. | SEO London; 10,000 Interns Foundation; GAIN; Jane Street FOCUS/INSIGHT; Elevate@BCG; PwC ASM (TARGETjobs); Sutton Trust 2025 |
| PB-FIN-S09 | Rolling review: at most banks, applying early in the window raises your odds; consulting (BCG London) decides after the deadline. | Signal, A | Pass: guidance names the review mode per firm. Fail: "apply early" given for BCG, or "no rush" for GS. | GS summer analyst page; BCG UK page; Cambridge banking guide |
| PB-B4-S01 | Big 4: form + tests drive the screen, one application per firm per year, AI banned in assessments. | Signal, B | Pass: B4 users see "prepare tests before applying". | Market doc rows (PwC/Deloitte pages), re-verify PwC |
| PB-ALL-S02 | Assessments are unaided: AI use is banned in online tests at Bain and the Big 4. | Signal, A | Pass: appears on every process signal. | Bain London FAQ; Deloitte UK integrity page |
| PB-ALL-S03 | International students: Graduate visa is 18 months from 1 Jan 2027; check sponsorship. | Guidance, A | Pass: shown to final/masters. | GOV.UK Graduate visa |
| PB-QNT-E06 | Jane Street FOCUS London, first-years facing barriers, 13-16 Jan 2027, apply by 8 Nov 2026. | Opportunity | `eligibleYears ["1st"]`, `expiresOn 2026-11-08` | Jane Street feed + FOCUS page |
| PB-QNT-E07 | Jane Street INSIGHT London, 5-10 Apr 2027, apply by 3 Jan 2027. | Opportunity | `expiresOn 2027-01-03` | Jane Street feed + INSIGHT page |
| PB-FIN-E06 | BlackRock 2027 Spring Insight EMEA (London/Edinburgh), grads of 2029, apply by 4 Dec 2026; one application per programme per year. | Opportunity | `gradYear 2029`, `expiresOn 2026-12-04` | careers.blackrock.com req 12223 |
| PB-CON-E06 | Elevate@BCG / Women@BCG / Pride@BCG London insight days (Sep-Oct each year). | Opportunity, seasonal | `reviewBy 2027-08-31` (2026 dates passed) | BCG UK page |
| PB-FIN-C03 | Bloomberg Market Concepts, only via your university's terminal; never pay. | Course, `cv_low` | Shown only with the conditional copy. | Manchester Library FAQ; UCL Library FAQ |
| Guidance `placement` | 12-month industrial placement track (apply penultimate autumn). | Guidance | — | ISE 2025 (123 applications per placement hire); Cambridge |

## Rules to delete or downgrade

- **PB-FIN-S01**: drop "main pipeline" (Finding 21).
- **PB-CON-S07**: A → B (Finding 23).
- **PB-FIN-S06 / PB-QNT-S04**: keep A but swap the weak quotes (Findings 22, 24).
- **PB-CON-E02 / PB-FIN-E02 (Forage)**: demote below society, project and access items in ranking. Never a gap-closer for "Financial Modelling" or "Data Visualisation". Their own pages say "No grades / No assessments".
- **PB-FIN-C02 CFI Careers in Finance**: demote to an "orientation" chip, not an action eligible for XP. Its signal is "very low" by the doc's own label.
- **PB-QNT-C04 Zetamac / PB-CON-C02 Bain assessment hub**: move to a "Test prep" panel with no XP and no gap coverage.
- **PB-QNT-E03 / PB-FIN-E05 / PB-CON-E03 / PB-CON-E04 / PB-QNT-E04**: reclassify as `opportunity` (Finding 4).

## Open questions

- **Pymetrics.** Is it still used by UK banks in 2026/27? Cambridge 2025-26 still names it (PB-FIN-S04), but I could not verify the current status of the brand after the Harver acquisition. My web-search budget ran out.
- **McKinsey.** mckinsey.com timed out or was blocked for Solve, interviewing and student pages. The consulting playbook has no McKinsey Solve signal. Third-party prep sites (C only) describe Solve as a game-based screen before interviews. Verify at the firm before adding.
- **GS spring programmes.** Do the EMEA spring programmes run for 2027? The firm pages I guessed return 404. Bright Network and Rate My Placement list "Divisional Spring Programme" and "Get Set for GS Spring Insight" (C).
- **upReach eligibility.** The page is live, but the eligibility section is script-rendered and I did not read it.
- **CFA Institute Research Challenge (UK) and the OC&C Strategy Challenge.** I found no confirmed 2026/27 UK editions. Do not add them until verified.
- **PwC.** pwc.co.uk returns 403. The PwC facts come from the market doc (accessed 2026-09/10) and TARGETjobs listings.
- **Spring-week pay and travel cover.** Whether firms other than Jane Street (stated) and PwC ("paid") pay or cover travel is unverified, so the fairness copy should say "check".
- **FT access.** Do UK universities give free FT access (relevant to PB-FIN-P03's FT dependency)? Not checked.

## Sources

Grades: A = primary employer/government/peer-reviewed; B = careers service, ISE/Prospects, established outlet, charity's own data; C = practitioner, tracker, prep site.

1. Jane Street, programmes data feed — https://www.janestreet.com/jobs/programs-endpoint.json — A (accessed 2026-10-18)
2. Jane Street, FOCUS — https://www.janestreet.com/join-jane-street/programs-and-events/focus/ — A
3. Jane Street, INSIGHT — https://www.janestreet.com/join-jane-street/programs-and-events/insight/ — A
4. Jane Street, FTTP — https://www.janestreet.com/join-jane-street/programs-and-events/fttp/ — A
5. Jane Street, Interviewing — https://www.janestreet.com/join-jane-street/interviewing/ — A
6. Jane Street, QT Internship London — https://www.janestreet.com/join-jane-street/position/8474407002/ — A
7. Goldman Sachs, 2027 Summer Analyst Programme EMEA — https://www.goldmansachs.com/careers/students/programs-and-internships/emea/summer-analyst-programme — A
8. Goldman Sachs, Students — https://www.goldmansachs.com/careers/students — A
9. JPMorganChase, Spring Insights — https://www.jpmorganchase.com/careers/explore-opportunities/programs/spring-insights — A
10. JPMorganChase, How we hire — https://www.jpmorganchase.com/careers/how-we-hire — A
11. Barclays, Hints and tips — https://search.jobs.barclays/hints-and-tips — A
12. BlackRock, 2027 Spring Insight Event EMEA — https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752 — A
13. BCG, UK Associate jobs / early careers FAQ and events — https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs — A
14. Bain & Company, London University Hiring — https://www.bain.com/careers/recruiting/london-recruiting/ — A
15. Optiver, QT Internship 2027 Amsterdam — https://www.optiver.com/join-us/jobs/trading/amsterdam/quantitative-trading-internship-2027-start/ — A
16. IMC, Prosperity 4 — https://prosperity.imc.com/ — A
17. Forage/BCG, Strategy Consulting simulation — https://www.theforage.com/simulations/bcg/strategy-consulting-jk76 — A
18. Forage/JPMorganChase, Investment Banking simulation — https://www.theforage.com/simulations/jpmorgan/investment-banking-hkyd — A
19. GOV.UK, Graduate visa — https://www.gov.uk/graduate-visa — A
20. legislation.gov.uk, Equality Act 2010 s.158 — https://www.legislation.gov.uk/ukpga/2010/15/section/158 — A
21. ICO, What is special category data — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/ — A
22. IFoA, Become an actuary — https://www.actuaries.org.uk/become-actuary — A
23. Prospects Luminate/ISE, Early careers recruitment in 2025 — https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards — B
24. ISE, 5 internship and placement trends to watch in 2026 (24 Nov 2025) — https://ise.org.uk/knowledge/insights/508/5_internship_and_placement_trends_to_watch_in_2026/ — B
25. Prospects, Corporate investment banker — https://www.prospects.ac.uk/job-profiles/corporate-investment-banker — B
26. Prospects, Actuary — https://www.prospects.ac.uk/job-profiles/actuary — B
27. University of Cambridge Careers, Banking & Financial Markets Short Guide 2025-26 (PDF) — https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf — B
28. TARGETjobs, What is a spring week… (2 May 2025) — https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme — B
29. TARGETjobs, PwC Advancing Social Mobility Programme 2027 — https://targetjobs.co.uk/jobs/advancing-social-mobility-programme-2027-248569 — B
30. Sutton Trust, Unpaid and Underpaid Internships (Jan 2025) — https://www.suttontrust.com/our-research/unpaid-and-underpaid-internships/ — B (polling by Public First/YouGov)
31. SEO London, home/impact 2024-25 — https://www.seo-london.org/ — B
32. 10,000 Interns Foundation — https://10000internsfoundation.com/ — B
33. GAIN UK — https://www.gainuk.org/ — B
34. Sutton Trust Pathways to Banking & Finance (school pupils) — https://pathwaysprogrammes.suttontrust.com/career-pathways/banking-finance — B
35. University of Manchester Library, BMC FAQ — https://manchester-uk.libanswers.com/teaching-and-learning/faq/254146 — B
36. UCL Library, How can I access Bloomberg data? — https://library-help.ucl.ac.uk/faq/242426 — B
37. 180 Degrees Consulting, Find a branch — https://www.180dc.org/find-a-branch — B
38. Trackr, Spring Week Timeline 2027 (9 Sep 2026) — https://the-trackr.com/blog/spring-week-timeline-2027-when-uk-finance-firms-open-applications/ — C (dates are estimates by its own statement)
39. upReach, Students — https://upreach.org.uk/students/ — B (live; eligibility not read)
40. Rare Recruitment — https://www.rarerecruitment.co.uk/ — B (live; no programme detail on page)
41. Prep sites on McKinsey Solve (strategycase.com, roadtooffer.com, myconsultingcoach.com) — C (corroboration only; not used for any rule)
42. Internal: `docs/research/market-2026/01-early-careers-market.md`, `docs/research/cv-rules-finance-consulting.md`, `lib/linkedin-rules/rules.json`, plus code paths cited above, read 2026-10-18.

Method note: all 42 URLs cited in the research doc were re-requested on 2026-10-18 and returned HTTP 200. Key quotes were re-matched for Jane Street, GS, JPMC, Barclays, BCG, Bain (WebFetch), Optiver, Forage, Prospects and ISE. The picker behaviour in Findings 1, 2, 4 and 5 was confirmed by running `pickActions` and `activeGuidance` from the shipped `data.json` in a throwaway script (no app, DB or repo files touched).
