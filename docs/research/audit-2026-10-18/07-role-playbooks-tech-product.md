# Role playbooks (tech, product, data, quant dev, marketing, research) audit

**Overall grade: C.** The sourcing method is careful: all 49 cited URLs return HTTP 200 as of 2026-10-18, quotes are verbatim, and the build fails loudly on bad data. The content, though, describes a 2022-era, AI-free market.
1. The SWE playbook never mentions the stage that actually filters UK tech applicants: online coding assessments and DSA interviews. It also has no AI-assisted-engineering signal, even though employers now test exactly that (Canva, Meta) or police it (Google, Anthropic, Monzo).
2. There are **zero dated items** for any of the five tech/product archetypes, although 2027 summer internships at Google, Monzo and Capital One close between September and November 2026. A penultimate-year student opening Target Role today gets no warning that the window is closing.
3. The shipped matcher only surfaces actions whose `skills` overlap JD gaps. 54 of 79 SWE vocab skills, including Java, AWS, Machine Learning and LLM, have no action, so the most common gaps fall through to generic fallbacks.
4. Missing entirely: visa/right-to-work warnings (Monzo and Google interns cannot be sponsored), UK placement-year timing, named UK graduate PM schemes, and roles such as ML/AI engineer, data engineer, SRE/DevOps, security, UX and hardware. The "quant dev" (SWE at trading firms) persona does not exist.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality | B- | Verbatim, live, mostly Prospects/targetjobs (B). Several A grades rest on an experienced-hire Monzo mobile guide, and MKT-S03 rests on a 2018 CNBC piece. |
| Freshness (2026–27 cycle) | D | No AI-era signals, no 2026/27 dates, a 2023 CIM regional post, and the hard-coded `seasons/2027` MLH URL already lists no UK events in its 2027 section. |
| Coverage (roles, segments) | D | 5 archetypes. No ML/AI eng, data eng, SRE, security, UX, hardware, quant dev or tech consulting. No international-student or placement-year guidance. |
| Implementation fidelity | C | Doc and `data.json` are in sync (all 70 action IDs match). But skill-overlap matching cannot surface most actions for the gaps the market shows, and the `minYear` filter hides penultimate actions from 3-year 2nd-years. |
| Internal consistency | C | "2nd year = insight year on four-year courses" conflates sandwich and integrated-master's students. CV rules flag LeetCode/AI tool use, but the playbooks are silent. |
| UX / copy | C+ | Honest D/C labels are good. Effort chips mislead ("weekend" for a spring-week application). XP is flat at 40 whether an action takes a weekend or a term. |

## Findings

### 1. SWE playbook omits the online coding assessment / DSA interview: the actual gate for UK tech internships
- **Severity**: P0 · **Type**: missing
- **Where**: `docs/research/role-playbooks-tech-product.md:21-42` (PB-SWE-S01…S07); `role-playbooks-tech-product.json:577-728`
- **Current**: The signals are portfolio, passion, project depth, collaboration, problem solving, applied skills and work experience. No signal says "pass a timed coding assessment / algorithmic interview". DSA appears only as a learning project (PB-SWE-P04) and an OCW course (C04, "signal value on a CV low").
- **Evidence**:
  - (A, employer) Monzo, *Associate Software Engineer – Intern, Summer 2027*, Greenhouse, accessed 2026-10-18, https://job-boards.greenhouse.io/monzo/jobs/8156261. Stage 2 is an exercise "to demonstrate programming and problem-solving skills" before final interviews.
  - (A, employer) Google, *Software Engineering, SRE BS/MS Intern, 2027* (London), via gradireland, accessed 2026-10-18, https://gradireland.com/jobs/software-engineering-site-reliability-engineering-bsms-intern-2027-239937. The minimum qualifications ask for "experience with data structures or algorithms" and say "Currently enrolled in your penultimate year".
  - (B) The CV-rules research (`cv-rules-tech-product.md:90`) already lists LeetCode as a "weak signal" on the CV. That is about the CV, and is consistent with interview preparation being a separate action.
- **Fix**: Add signal `PB-SWE-S08`: "Most tech internships screen with a timed online coding assessment, then live problem-solving interviews; fluency in core data structures and algorithms is tested, not read off the CV." Grade A (Monzo + Google postings). Add action `PB-SWE-E07` "Assessment practice block" (type experience, effort "2-4 weeks", minYear 1st, skills Algorithms, Data Structures, Python/Java). Make C04/P04 link to it. State plainly that this is preparation, not a CV line.

### 2. No AI-era engineering signal: what candidates must show and avoid in AI-assisted and AI-banned interviews
- **Severity**: P0 · **Type**: missing / stale
- **Where**: All SWE/DAT/PRD signals; `role-playbooks-tech-product.md:21-127`. Not one signal, action or year line mentions LLMs, AI coding tools or AI policies.
- **Current**: Silent.
- **Evidence**:
  - (A, employer) Canva Engineering, "Yes, you can use AI in our interviews", 11 Jun 2025, https://canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews. Canva evaluates "Can they identify and fix issues in AI-generated code?"
  - (A, employer) Anthropic, *Candidate AI guidance*, updated 10 Jul 2025, https://www.anthropic.com/candidate-ai-guidance. Live interviews: "This is all you–no AI assistance unless we indicate otherwise."
  - (A, employer) Monzo, "The ultimate guide on using AI to ace an interview at Monzo", 30 Jul 2024, https://monzo.com/blog/the-ultimate-guide-on-using-ai-to-ace-an-interview-at-monzo. It says "please do not use AI live in the interview" and "Refine, not replace."
  - (C, press) Business Insider/TechRadar, 2025: Meta is piloting coding interviews "in which candidates have access to an AI assistant". https://www.techradar.com/pro/meta-is-going-to-let-candidates-use-ai-in-job-interviews
  - (C, press) CXO Digital Pulse, 2025: Google is reinstating at least one in-person round over AI cheating. https://www.cxodigitalpulse.com/google-reinstates-in-person-job-interviews-amid-rising-ai-cheating-concerns/
  - (B) Stack Overflow Developer Survey 2025: 84% of developers use or plan to use AI tools, and 46% distrust their accuracy. https://survey.stackoverflow.co/2025/ai
- **Fix**: Add signal `PB-SWE-S09` (grade A): "Employers split on AI in interviews. Some (Canva, Meta pilot) test how you direct and correct AI tools; others (Anthropic, Monzo, Google's in-person round) ban live AI use. You must be able to code unaided and to review AI output critically." Add action `PB-SWE-P06` "AI-assisted build with a review log": ship a small tool built with an AI assistant, keep a `AI_LOG.md` of suggestions you rejected and the bugs you caught, and add tests that would have caught them. Add a one-line copy rule on every interview-related action: "Check each employer's AI policy. Default to no AI in live interviews and assessments."

### 3. Zero dated guidance for any tech/product archetype while the 2027 internship windows close now
- **Severity**: P0 · **Type**: missing / implementation
- **Where**: `lib/playbooks/data.json`: `yearGuidanceDated` is empty for software_eng, data_analytics, product, marketing_growth and research (finance/consulting/quant have 1–6). The doc's own rule at `role-playbooks-tech-product.md:12` reads "No timings … unless they come from a 2026/27-cycle page."
- **Current**: The penultimate line is "Apply for summer internships/placements" with no date.
- **Evidence** (2026/27-cycle pages exist):
  - (A) Google SRE/SWE intern 2027, London: "Apply by: 19/10/2026" (gradireland listing above).
  - (A) Monzo SWE intern and Data intern 2027: "1st November 2026", offers rolling. https://job-boards.greenhouse.io/monzo/jobs/8232726
  - (B) Capital One technology internship (June 2027 start) closed 6 Sep 2026, rolling (targetjobs listing, https://targetjobs.co.uk/jobs/technology-summer-internship-237339).
  - (B) JPMorganChase 2027 Spring Insights: Engineer & Innovate (London) is for students graduating 2029, one Spring Insights application only (Bright Network, https://www.brightnetwork.co.uk/graduate-jobs/jp-morgan/2027-spring-insights-engineer-innovate-at-jpmorganchase-london).
- **Fix**: Add `yearGuidanceDated` entries with `expiresOn` and `ref`, re-checked monthly by extending `scripts/check-programmes.ts` to cover playbook URLs:
  - `{year:"penultimate", text:"Big-tech and fintech 2027 summer internships close Sep–Nov 2026 and many offer on a rolling basis (e.g. Monzo 1 Nov 2026). Apply in September–October.", expiresOn:"2026-11-30"}`
  - `{year:"1st", text:"Bank technology spring insights for 2029 graduates open Oct–Dec; most allow one application per firm.", expiresOn:"2027-01-31"}`
  - At minimum, add an undated evergreen line to penultimate: "Tech internship applications open in August–September; apply by October. Rolling offers mean late applicants compete for fewer places."

### 4. The skill-overlap matcher cannot recommend anything for the most common market gaps
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/target/actions.ts:22-49` (`pickActions` matches `action.skills` against JD gap skills); `lib/target/view.ts:59-60`
- **Current**: Actions are only "matched" when an action skill equals a gap skill. My check of `lib/skills/vocab.ts` against `data.json`:
  - software_eng: 54/79 vocab skills have no action (Java, Go, C#, Kotlin, AWS/GCP/Azure, Kubernetes, Distributed Systems, Machine Learning, LLM, RAG …)
  - data_analytics: 54/76 (A/B Testing, Time Series, Causal Inference, Looker, dbt, Airflow, Spark, LLM …)
  - marketing_growth: 23/43 (Excel, SQL, CRM, Paid Social, Growth Marketing, CRO, Metrics …)
  - research: 39/55 (PyTorch, Deep Learning, NLP, HPC …)

  A rough tally of `seed/jobs.json` shows Java in ~21/54 SWE postings and Machine Learning in ~11/54, both with no action. Marketing postings ask for Metrics/Excel/CRM, none matched.
- **Evidence**: code inspection; seed data (internal, approximate regex tally).
- **Fix**: (a) Add generic "learn-by-building" actions parameterised by skill family, e.g. `PB-SWE-P07` "Port one of your projects' backends to the language this employer uses (Java/Go/C#)" with skills [Java, Go, C#, Kotlin], and `PB-SWE-P08` "Deploy a project on a cloud free tier with IaC" with skills [AWS, GCP, Azure, Docker, Terraform]. (b) Add the AI/ML actions from finding 2 and the new-roles section. (c) In `pickActions`, when a gap has no matching action, show it explicitly as "No playbook step yet for X — pick a project that uses it", rather than silently falling back. (d) Add a CI check that reports, per archetype, the top-20 demanded skills in `seed/jobs.json` with zero actions.

### 5. `minYear` filtering hides penultimate-year actions from 3-year-degree second-years
- **Severity**: P1 · **Type**: implementation / contradiction
- **Where**: `lib/target/actions.ts:27` (`YEARS.indexOf(a.minYear) <= yi`); `lib/target/progress.ts:26-29`; onboarding labels "2nd year" and "Penultimate" as separate choices (`app/onboarding/page.tsx:14`); `lib/ai/heuristics.ts:48` treats "penultimate" as {penultimate, 2nd}.
- **Current**: A 3-year BSc student in year 2 who picks "2nd year" (the natural choice) never sees PB-PRD-E04 (adjacent internships, minYear penultimate) or PB-RES-E02 (LMS bursary). Yet the year guidance tells them to "treat as penultimate". `targetFor` also defaults unknown users to "2nd" (`lib/target/view.ts:35`).
- **Evidence**: code inspection. Job eligibility heuristics already treat 2nd ≈ penultimate, so the codebase contradicts itself.
- **Fix**: Store course length (3/4/5 years) and whether the course has a placement year at onboarding, and derive `penultimate` from it. Until then, treat `2nd` as satisfying `minYear: "penultimate"` in `pickActions`/`actionFor`, the same mapping as `heuristics.ts`.

### 6. "2nd year on four-year courses = main insight-programme year" conflates sandwich-year and integrated-master's students
- **Severity**: P1 · **Type**: wrong
- **Where**: `role-playbooks-tech-product.md:122` (SWE 2nd), `:228` (DAT), `:331` (PRD), `:441` (MKT); `role-playbooks-tech-product.json:1150,1690,2198,2749`
- **Current**: "On four-year courses this is the main insight-programme year; otherwise treat as penultimate."
- **Evidence**:
  - (B, university) Aberystwyth Dept of Computer Science, *Student Industrial Year Guide*: the placement search "starts near the beginning of the second year of study. Some large employers recruit early and positions may be filled before Christmas." https://impacs-inter.dcs.aber.ac.uk/images/editor-content/Documentation/Industrial_Year/student_industrial_year_guide.pdf
  - (A, gov) GSS Sandwich Year Placements 2027 (targetjobs) and GORS sandwich scheme guidance (GOV.UK, https://www.gov.uk/guidance/government-operational-research-service-sandwich-student-scheme) both recruit in year 2.
  - (B) targetjobs R6 (already cited): spring weeks are for "first years (or second years on four-year courses)". That fits MEng/MSci students, not sandwich students.
- **Fix**: Split the 2nd-year guidance in two:
  - **Placement-year (sandwich) course**: "This autumn is your main application season: 12-month placements open in September and big employers fill by Christmas–February."
  - **4-year integrated master's**: "Spring weeks/insight programmes are often still open to you; also try a first summer internship."
  - Otherwise (3-year course): treat as penultimate.

### 7. No right-to-work / visa warning, although named UK tech internships exclude sponsored students
- **Severity**: P1 · **Type**: missing / fairness
- **Where**: All five archetypes; no field for sponsorship on actions. The jobs table has `sponsors_visa` (seed schema), but playbooks never use it.
- **Current**: Silent.
- **Evidence**:
  - (A) Monzo 2027 intern: "you must hold the right to work in the UK through the full duration of this internship" and no sponsorship for a permanent role (Greenhouse 8156261).
  - (A) Google 2027 intern, per the posting summary: "will not be eligible for immigration sponsorship" (search summary of Google listing; I confirmed the location and penultimate requirement from gradireland but did not open the sponsorship line myself).
  - (A, gov) CyberFirst bursary requires British citizenship (NCSC, https://www.ncsc.gov.uk/files/CF-593722-Candidate-Brochure-2025%20v2.pdf; search summary).
- **Fix**: Add optional `eligibility: { rightToWork?: "uk-unrestricted" | "sponsorship-possible"; nationality?: string }` to the Action schema, with a UI chip. Add to every year guidance for international students: "Student-visa holders can usually intern in vacations, but many firms will not sponsor a graduate visa. Filter for sponsors early, and treat GSoC, Kaggle, open source and research as visa-neutral evidence." Coordinate with the jobs `sponsors_visa` field.

### 8. Several A grades rest on an experienced-hire Monzo mobile guide applied to graduates
- **Severity**: P1 · **Type**: unsupported
- **Where**: PB-SWE-S03 (`json:620`), S04 (`:642`), S05 (`:668`); source R3 (`json:57`)
- **Current**: S03, S04 and S05 are graded A, with Monzo's "Preparing for Mobile Interviews at Monzo" as the employer source.
- **Evidence**: (A) The page (accessed 2026-10-18) lists only Android Engineer and Senior Android/iOS roles. It describes a 4-hour take-home or pair-coding stage and a mobile systems-design round. Monzo's actual intern process (Greenhouse 8156261) is application → programming exercise → interviews. Guidance for experienced mobile hires does not support graduate screening claims at grade A.
- **Fix**: Regrade S03/S04/S05 to B. Replace R3 with intern-specific employer text: the Monzo 2027 intern posting ("reviewing colleagues' code, and working with product managers, designers and data analysts" supports S04), Canva's interview blog for S03 (explain choices and trade-offs), and Jane Street's SWE intern posting ("more interested in how candidates think and learn") for S05.

### 9. Product playbook names no UK graduate PM schemes and overstates rarity
- **Severity**: P1 · **Type**: missing / stale
- **Where**: `role-playbooks-tech-product.md:239` (caveat), `:317-326` (E04, E05)
- **Current**: "It's extremely unusual for an employer to recruit a product manager without at least two years…". The experiences are generic: society roles, Enactus, hackathons, adjacent internships.
- **Evidence** (2027-intake graduate product schemes open now):
  - (B) Tesco *Technology – Product Management Graduate Scheme*, start 6 Sep 2027, £40,000, London/Welwyn (targetjobs, https://targetjobs.co.uk/jobs/technology-product-management-graduate-scheme-245101).
  - (B) Lloyds Banking Group *Product and Partnerships Graduate Scheme 2027* (Bright Network).
  - (A) Revolut *Graduate Programme 2027: Product Owner (Technical/UX)*, London office, 12 months, open to 2025–2027 graduates (revolut.com careers; 403 to my fetcher, details via search summary).
  - (B) TfL *Product Management Graduate* (tfl.gov.uk; 2025 intake shown, 2:2 minimum).
- **Fix**: Keep the Prospects caveat but add: "…yet a growing number of UK graduate schemes hire into product directly (retail, banking, fintech, transport)." Add `PB-PRD-E06` "Graduate product schemes" with `howToFind`: "Search targetjobs/Bright Network for 'product management graduate scheme'; examples in 2026/27: Tesco Technology, Lloyds Product & Partnerships, Revolut Product Owner graduate, TfL." Set minYear final, reviewBy 2027-03-01, and add a dated final-year line.

### 10. "Quant dev" persona is not served by any playbook
- **Severity**: P1 · **Type**: missing
- **Where**: `lib/types.ts:1-4` (ARCHETYPES); quant_trading playbook (in the finance doc) is trader-centric (PB-QNT-S05: "Programming … is a plus … not a requirement").
- **Current**: A CS student targeting SWE roles at Jane Street, Optiver, G-Research or IMC sees either the trading playbook (programming optional) or the generic SWE playbook (no trading-firm programmes).
- **Evidence**:
  - (A) G-Research *Software Engineering Internship*, London, 28 Jun – 17 Sep 2027 (Gradcracker, https://www.gradcracker.com/hub/347/g-research/work-placement-internship/83830/software-engineering-internship).
  - (A) Jane Street SWE internship: OCaml taught on the job; "more interested in how candidates think and learn" (Gradcracker, https://www.gradcracker.com/hub/820/jane-street/work-placement-internship/82347/software-engineer-internship-june-september).
  - (A) IMC Launchpad: "first- or second-year university students" interested in SWE and quant trading. The cited page is APAC (`/ap/`), https://www.imc.com/ap/careers/students-graduates/programs. The finance-quant playbook also cites IMC `/ap/` pages for UK students; I am flagging this for the role-finance auditor.
- **Fix**: Add a `quant_dev` sub-track inside software_eng (no new archetype needed): signals "low-latency/systems fundamentals (C++, Linux, networking)" and "functional programming curiosity is welcome but taught". Actions: "Build a toy matching engine in C++ with latency benchmarks"; "G-Research/Jane Street/Optiver SWE internships (penultimate; rolling)"; Jane Street FTTP, which already exists in quant_trading and is explicitly a "Trading & Technology" programme, so cross-link it.

### 11. Outreachy is presented as open to UK students in any round; it is restricted to the May–August cohort
- **Severity**: P1 · **Type**: wrong
- **Where**: PB-SWE-E04 (`md:103-107`, `json:1070`), PB-RES-E04 (`md:533-537`, `json:3227`)
- **Current**: "Remote open-source internships … Check eligibility before investing time. No 2027 dates given here." Effort "term", minYear 1st.
- **Evidence**: (A) Outreachy Applicant Guide, accessed 2026-10-18, https://www.outreachy.org/docs/applicant/:
  - "Outreachy interns work 30 hours per week."
  - "University students must have 42 consecutive days free from school and exams during the internship period."
  - Northern Hemisphere students may only apply to the May–August cohort.
  - "Students who plan on taking a school term off to pursue an internship are not eligible."

  (A) Outreachy blog, 6 Feb 2026: the May 2026 cohort ran "with reduced funding and activities". https://www.outreachy.org/blog/2026-02-06/may-2026-call-for-mentoring-organizations/
- **Fix**: Description: "UK university students can only apply to the May–August cohort (applications usually open in January–February), must have 42 consecutive exam-free days, and work 30 h/week. Cohorts are currently smaller because of funding." Set effort "term" with note "summer, full-time" and reviewBy 2027-02-01.

### 12. GSoC entry lacks the AI-proposal rule and the one-prior-participation limit
- **Severity**: P2 · **Type**: stale
- **Where**: PB-SWE-E03 (`md:98-102`, `json:1037`)
- **Current**: Eligibility is "18+, student or open-source beginner, eligible to work where you live".
- **Evidence**:
  - (A) Google, GSoC FAQ, accessed 2026-10-18, https://developers.google.com/open-source/gsoc/faq: using AI to write a proposal "could lead to automatic rejection", "Always check an organization's specific AI policy", and contributors may be accepted "no more than once before". The 2026 contributor window was 16–31 March (timeline page).
  - (A) VideoLAN's 2026 GSoC AI policy rejects AI-generated communications (vlc-devel, Mar 2026, https://mailman.videolan.org/pipermail/vlc-devel/2026-March/143864.html).
- **Fix**: Append: "Proposals must be your own work. Many organisations reject AI-written proposals. Applications run for about two weeks in mid–late March; start contributing in January–February." Add `yearGuidanceDated` with expiresOn 2027-04-01 once Google publishes the 2027 timeline.

### 13. MLH links are hard-coded to `seasons/2027`, whose 2027 section already lists no UK/Europe events
- **Severity**: P2 · **Type**: stale / implementation
- **Where**: PB-SWE-E01, PB-DAT-E03, PB-PRD-E03 (`url: https://www.mlh.com/seasons/2027/events`); R50 (`json:464`)
- **Current**: "Filter the MLH list by Europe/UK."
- **Evidence**: (B) MLH page, accessed 2026-10-18. The UK events (OxHack 24–25 Oct, HackTheBurgh 7–8 Nov, DurHack 14–15 Nov) sit under "2026 upcoming". The page states none of the 2027 listings are in the UK/Europe. Many UK university hackathons (IC Hack, HackLondon, Hack the Burgh) run on MLH but are season-dependent.
- **Fix**: Use the season-agnostic `https://www.mlh.com/events` (or compute the season URL) and add `reviewBy` each August. Add howToFind: "Also check your SU's tech society. IC Hack, HackLondon, DurHack and OxHack usually run October–March."

### 14. MLH Fellowship deleted as "UK eligibility not stated". It is a live, paid, remote alternative that should be re-checked, not dropped
- **Severity**: P2 · **Type**: missing
- **Where**: `md:614` (Gaps and deletions)
- **Evidence**: (B) fellowship.mlh.com, accessed 2026-10-18: applications open "for our upcoming start dates", 12 weeks, remote, with "an educational stipend". (C) An aggregator reports a country exclusion list that does not include the UK (opportunitiesnexus.com, unverified).
- **Fix**: Re-add as `PB-SWE-E08` with `verified: null` and howToFind "check the FAQ for your country before applying", or keep it deleted but list it in Open questions. The deletion was correct under the verification rule; the gap is not re-checking it.

### 15. Google STEP correctly deleted, but there is no first-year tech replacement in the SWE playbook
- **Severity**: P2 · **Type**: missing
- **Where**: `md:608`; PB-SWE-E05 (generic targetjobs search)
- **Evidence**:
  - (C) Extern guide, 16 Oct 2026: the STEP page redirects to Careers home and no STEP posting exists; the last confirmed cycle was Summer 2025 EMEA (https://www.extern.com/post/google-step-program-guide). I agree with the deletion.
  - (B) Current first-year tech options: JPMorganChase 2027 Spring Insights: Engineer & Innovate (2029 graduates); IMC Launchpad (1st/2nd years; EMEA page not verified); Jane Street FTTP (in quant_trading, deadline 3 Jan 2027). Optiver FutureFocus is Amsterdam-based.
- **Fix**: Add a first-year line: "Big-tech first-year internships (e.g. Google STEP) have largely gone. Bank technology spring insights (one application per bank) and trading-firm discovery programmes are the main first-year routes." Cross-link PB-QNT-E01 for CS first-years.

### 16. "Build and ship a tool for a real group" is sound; "take a tutorial project and make it yours" is a near-zero signal in 2026 as written
- **Severity**: P2 · **Type**: stale
- **Where**: PB-SWE-P02 (`md:50-53`), PB-SWE-P01 (`md:46-49`)
- **Current**: P02: "Extend a course or tutorial project with a feature the tutorial did not cover, then add tests and CI." Effort 2-4 weeks.
- **Evidence**:
  - (A, working paper) Galdin & Silbert 2025, *Making Talk Cheap*: once LLMs made customisation cheap, the premium for it disappeared. https://arxiv.org/abs/2511.08785. The same logic applies to boilerplate code artefacts.
  - (B, market doc F7 synthesis) What separates candidates is "information AI cannot cheaply fake". (A) Canva's interviews probe "what they'd improve with more time".
  - P01 has real users, which AI cannot fake cheaply, so it remains a strong signal.
- **Fix**: Reframe P02 as "Tutorial → your own problem": the extension must solve a problem you or a named group have. Require a short "what I'd change" note and a live demo. Mark it explicitly as a stepping stone to P01, not a headline project. In P01 evidence, ask for one verifiable usage fact (users, sessions, issues filed by others).

### 17. Effort chips mislead: "weekend" for insight programmes and Forage, flat chips for application-heavy items
- **Severity**: P2 · **Type**: copy
- **Where**: PB-SWE-E05, PB-DAT-E04, PB-PRD-E05, PB-MKT-E04 (effort "weekend"); `components/target/action-card.tsx` renders `action.effort` verbatim.
- **Current**: Spring week/insight shown as "weekend".
- **Evidence**: (B) Spring-insight funnels include online tests and video interviews over several weeks; JPM restricts students to one Spring Insights application (Bright Network listing). Unilever UFLP stage 2 is "portrait personality test plus an online assessment" (Unilever careers via targetjobs).
- **Fix**: Separate `effort` (time doing it) from `applicationEffort`, or set these to "2-4 weeks" with the description "Applications (tests + video interview) take several weeks; the programme itself is 1–5 days."

### 18. XP and the "Gap Closer" badge reward any action equally, including fallbacks that close no gap
- **Severity**: P2 · **Type**: implementation / copy
- **Where**: `lib/gamify/core.ts:55` (playbook_done = 40 XP, cap 3/day), `:80` (gap_closer on any playbook_done), `:22` (badge text "Closed your first skill gap from a Role Playbook")
- **Current**: A 30-minute Overleaf tutorial and a term-long GSoC project both earn 40 XP. Completing a fallback/top-up action (`covers: []`) awards "Gap Closer".
- **Evidence**: code. Gamification should reward the signal, not the click: the playbook's own honesty note (`md:13`) says certificates are weak evidence.
- **Fix**: XP by effort: weekend 20, 2-4 weeks 40, term 80, and +20 when `evidence_url` is supplied. Award `gap_closer` only when the completed action's `covers` was non-empty at completion time (pass `covers` into `completeAction`).

### 19. Completing a course can promote a skill into tailoring evidence, contradicting the "certificates are weak" stance
- **Severity**: P2 · **Type**: contradiction / implementation
- **Where**: `lib/target/progress.ts:90-113` (note → `confirmedFacts`); `lib/target/strengthen.ts:79-81,106-110`
- **Current**: A note like "Finished Kaggle Learn Python and SQL" becomes a user-stated fact. `confirmedSkills` then extracts Python and SQL, and Strengthen says "You told us you've used Python, so tailoring can use it now."
- **Evidence**: The playbook says "Certificates on their own are weak evidence" (`md:13`). CV rule EV-xx requires tools named in bullets to be backed by a project, with no certificates needed (`lib/cv-rules/rules/amendments.ts:33`).
- **Fix**: For `type: "course"` completions, store the fact with `source: "course-completed"`. In `confirmedSkills`, exclude those facts or require a linked project. Change the toast to: "Saved. Add a project that uses it so tailoring can cite it."

### 20. Data playbook lacks AI/LLM signals although about half of UK data postings mention AI
- **Severity**: P1 · **Type**: missing
- **Where**: PB-DAT-S01…S06 (`json:1162-1297`)
- **Evidence**:
  - (C relaying B) Indeed via Workplace Journal, 3 Aug 2026: AI is mentioned in "nearly 50%" of data/analytics postings (already in market doc F13).
  - (B) PwC UK 2025 AI Jobs Barometer: UK roles requiring AI skills carry an 11% wage premium (UK press release, via search). Global figure 56%.
  - (B) Monzo 2027 Data intern: "graduating in 2028" STEM with programming exposure.
- **Fix**: Add `PB-DAT-S07` (grade B): "Data roles increasingly expect applied AI: using LLM tools in analysis and knowing when not to trust them (evaluation, leakage, hallucination)." Add action `PB-DAT-P06` "Evaluate an LLM on a real labelling task": baseline classifier vs LLM, cost and error analysis. Skills LLM, Python, Evaluation (add to vocab). Keep it minor for analyst roles, per market-doc implication 6.

### 21. Microsoft/Amazon/Bloomberg-type big-tech internships are missing as named, penultimate-year actions
- **Severity**: P2 · **Type**: missing
- **Where**: SWE experiences (`md:86-117`) have no named employer internships, only programmes.
- **Evidence**:
  - (B) Amazon *2027 Software Dev Engineer Intern* on Gradcracker (https://www.gradcracker.com/hub/956/amazon/work-placement-internship/84230/2027-software-dev-engineer-intern).
  - (B) Microsoft MSAI SWE intern London, 12 weeks from July 2027 (Jointaro aggregator; not verified on Microsoft careers).
  - (B) Bloomberg runs penultimate-year SWE internships in London (Higherin reviews; 2027 London posting not found).
  - Note: Microsoft Explore is US-only; there is no UK equivalent that I could verify.
- **Fix**: Do not hard-code firms (they churn). Add `PB-SWE-E09` "Penultimate-year SWE internships at large tech and fintech firms", with howToFind "Gradcracker / Bright Network / targetjobs 'software engineering internship 2027'; examples this cycle: Google, Monzo, G-Research, Amazon, Jane Street", plus a dated line (finding 3). Note "Rate My Placement is now Higherin" in any copy that cites it (Higherin banner, higherin.com).

### 22. Research playbook: no life-science vacation studentships, and the membership precondition is unknown to users
- **Severity**: P2 · **Type**: missing
- **Where**: `md:516-537`; `md:620` admits the gap.
- **Evidence**:
  - (A) Microbiology Society *Harry Smith Vacation Studentships*: 2027 round opens 10 Dec 2026 and closes 10 Feb 2027. Applicants must have been members for at least a year (https://microbiologysociety.org/grants-prizes/all-grants/vacation-studentships.html; via search summary).
  - (A) Biochemical Society *Summer Vacation Studentships*: "First year and final year students are not eligible"; 2026 deadline 6 April (https://biochemistry.org/grants-and-awards/grants-and-bursaries/summer-vacation-studentships/).
- **Fix**: Add `PB-RES-E05` "Learned-society vacation studentships (biosciences)" with minYear 1st and the description "Join the society in first year: some (Microbiology Society) require 12 months' membership before you can apply." Add a 1st-year research line: "If you are in biosciences, join the Microbiology/Biochemical Society now."

### 23. Data playbook omits UK government analytical placements, the largest structured data-placement route
- **Severity**: P2 · **Type**: missing
- **Where**: data_analytics experiences (`md:197-223`)
- **Evidence**: (A, gov) GOV.UK *GORS sandwich student scheme* (https://www.gov.uk/guidance/government-operational-research-service-sandwich-student-scheme); GSS Sandwich Year Placements 2027 and GES Sandwich Student Placement 2027-28 (targetjobs listings). GES requires penultimate-year economics students on track for a 2:1.
- **Fix**: Add `PB-DAT-E06` "Government analytical placements (GSS/GORS/GES)" with minYear 2nd, effort term, and "Civil Service nationality rules apply". Add a sandwich-year line (finding 6).

### 24. Marketing evidence base is thin and dated (2023 CIM Scotland, 2018 CNBC/Google), and has no AI-tools or FMCG-scheme content
- **Severity**: P2 · **Type**: stale / missing
- **Where**: R13 (`json:167`), R59 (`json:563`); PB-MKT-S03 (`json:2252`)
- **Current**: S03 "Shows measurable results" cites Google recruiters via CNBC, 2018 (US, general resumes).
- **Evidence**:
  - (B) Unilever UFLP UK: online form, then "portrait personality test plus an online assessment", one function only (Unilever careers / targetjobs, https://targetjobs.co.uk/jobs/unilever-future-leadership-programme-customer-development-uk-190680).
  - L'Oréal Brandstorm: the 2026 edition ran (Greek City Times, 27 Jan 2026). No 2027 dates found, so the deletion stands.
- **Fix**: Replace R59 with a UK marketing source on measurable results (e.g. Prospects *marketing executive* "analytical skills", already cited as R15). Add `PB-MKT-E06` "FMCG marketing graduate schemes (Unilever, L'Oréal, P&G, Mars)" with "Expect online psychometric/game-based tests; one application per function". Add signal `PB-MKT-S08` (convention C until sourced): "Fluency with AI content and analytics tools, with your own judgement visible".

### 25. Kaggle "Getting Started" (Titanic-type) work has two separate actions; the duplication inflates its importance
- **Severity**: P3 · **Type**: copy
- **Where**: PB-DAT-P03 (`md:165-168`) and PB-DAT-E01 (`md:199-203`)
- **Evidence**: Prospects R8 "can help you gain visibility" is grade B but weak. The CV rules themselves penalise Titanic headline projects (DAT-11c).
- **Fix**: Merge into one action: "Kaggle: start with Playground, aim for a top-25% finish in an active competition before listing it." Drop the separate "Getting Started" project.

### 26. HubSpot and Semrush courses link to no signal yet are shown in fallbacks
- **Severity**: P3 · **Type**: implementation
- **Where**: PB-MKT-C01, PB-MKT-C04 (`signals: []` after MKT-S08 was deleted, `md:629`)
- **Evidence**: `pickActions` fallback requires `signals.length > 0`, so these only surface by skill match (Content Marketing/SEO). That is acceptable, but they carry no "why".
- **Fix**: Either link them to PB-MKT-S04 (analytics) or delete C04 (Semrush, vendor academy, "signal value modest").

### 27. RSS data-scientist source is dated ("Hadoop, C#") and still used as a grade-B leg
- **Severity**: P3 · **Type**: stale
- **Where**: R9; PB-DAT-S01 (`json:1162`), PB-DAT-S04
- **Evidence**: Self-flagged at `md:563`. Prospects data scientist (R8) covers the same claim.
- **Fix**: Replace R9 with Prospects R8 or a current employer posting (e.g. Monzo Data intern: STEM degree "with programming exposure").

### 28. Year guidance for final year and master's ignores the Graduate route and timing of graduate schemes
- **Severity**: P2 · **Type**: missing
- **Where**: `md:124-125`, `:230-231`, `:333-334`, `:443-444`, `:544-545`
- **Current**: "Graduate applications; lead with internship…"
- **Evidence**: (B) Revolut Graduate Programme 2027 listings were published Aug–Sep 2026; Tesco PM scheme start 6 Sep 2027 (targetjobs). Graduate schemes open in autumn of final year, and a one-year MSc student has about four weeks of term before the main deadlines.
- **Fix**: final: "Graduate schemes open Sept–Nov; many close by December or fill on a rolling basis." masters: "On a 1-year MSc, apply in your first 6–8 weeks; your undergraduate CV plus the MSc modules are what employers see." International: "The Graduate visa lets you work after your degree without sponsorship, but many schemes still ask about long-term sponsorship. Check before investing."

### 29. Signal grades are displayed, but A vs B share one green style and "Evidence A" overclaims for publisher-hosted employer voices
- **Severity**: P3 · **Type**: copy
- **Where**: `components/target/signal-card.tsx:3-8`
- **Fix**: Show "Employer + careers service (A)" vs "Careers service (B)". The distinction matters after the regrades in finding 8.

### 30. No guidance on AI-misuse risk in assessments, despite employers' stated focus on it
- **Severity**: P1 · **Type**: missing
- **Where**: All year guidance.
- **Evidence**:
  - (B) Wonkhe, 14 Oct 2026, summarising ISE Student Recruitment Survey 2026: 66% of employers identified unauthorised AI use in interviews, and the priority is "AI-resilient recruitment" (https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs). I could not open the ISE primary.
  - (B) Prospects Luminate (ISE), Oct 2025: 61% cite undisclosed AI use during interviews as the most common misconduct (market doc F8).
- **Fix**: Add a cross-archetype `yearGuidance` suffix for penultimate/final: "Never use AI live in tests or interviews unless the employer says so. Employers report catching it, and one application per year is common."

## New rules / signals to add

| ID | Archetype | Text | Grade | Pass anchor | Fail anchor | Sources |
|---|---|---|---|---|---|---|
| PB-SWE-S08 | software_eng | Timed online coding assessments and live DSA problem-solving are the main screen for tech internships. | A | Student has a practice log or competition rank; P04/C04 done | No DSA preparation evident by penultimate year | Monzo Greenhouse 8156261; Google intern 2027 (gradireland) |
| PB-SWE-S09 | software_eng | Employers split on AI in interviews: be able to code unaided and to review and correct AI output; follow each firm's AI policy. | A | Project with AI_LOG / review notes; can explain rejected AI suggestions | AI-generated repo with no explanation of choices | Canva 2025; Anthropic 2025; Monzo 2024 |
| PB-SWE-S10 | software_eng (quant-dev track) | Trading-firm SWE roles value systems fundamentals (C++/Linux/latency) and learning speed; the language is taught. | B | Systems project with benchmarks | Only web CRUD projects | G-Research SWE intern; Jane Street SWE intern |
| PB-DAT-S07 | data_analytics | Applied AI in analysis, with evaluation (baselines, error analysis, when not to trust LLM output). | B | Project comparing LLM vs baseline with metrics | "Used ChatGPT" with no evaluation | Indeed/Workplace Journal 2026; PwC UK 2025 |
| PB-ALL-V01 (copy rule) | all | Right-to-work chip on any action/programme with a nationality or no-sponsorship rule. | A | Chip shown | Unflagged | Monzo; Google; NCSC CyberFirst |
| PB-SWE-E07 | software_eng | Assessment practice block: 2–4 weeks of timed DSA practice in your interview language; record a rubric of mistakes. | D (action) | — | — | Links S08 |
| PB-SWE-P06 | software_eng | AI-assisted build with review log + tests that catch AI bugs. | D (action) | — | — | Links S09 |
| PB-SEC-* (new sub-track) | software_eng | Security: CyberFirst bursary (British citizens; 2026 intake closed 17 Nov 2025), CTFs (e.g. university CTF teams), TryHackMe-style labs as learning only. | B | CTF placings, writeups | Certificates only | NCSC CyberFirst brochure 2025 |
| PB-DAT-E06 | data_analytics | GSS/GORS/GES government analytical placements (sandwich year). | A | — | — | GOV.UK GORS; targetjobs GSS/GES 2027 |
| PB-RES-E05 | research | Learned-society vacation studentships (Microbiology Society: 10 Dec 2026 – 10 Feb 2027, 1-yr membership; Biochemical Society: middle years only). | A | — | — | Society pages |
| PB-PRD-E06 | product | UK graduate product schemes (Tesco, Lloyds, Revolut PO grad, TfL). | B | — | — | targetjobs; Revolut careers |

**Roles to add as sub-tracks**, each with at least 3 signals and 5 actions, sourced to the same standard:
- ML/AI engineer, where LinkedIn's *Jobs on the Rise* had AI engineer at #1 in the UK in 2025 (secondary reports)
- data engineering (dbt/Airflow/Spark are in vocab but have no actions)
- SRE/DevOps (Google's 2027 EMEA intern is an SRE/SWE hybrid)
- security (CyberFirst)
- UX/design (Revolut "Product Owner (UX)" graduate role; Figma is in vocab)
- hardware/embedded (Gradcracker sector)
- tech consulting (Big 4/Accenture technology graduate schemes, form-gated per market doc F10)

## Rules to delete or downgrade

- **PB-SWE-S03/S04/S05: A → B** (finding 8). The employer source is an experienced-hire mobile guide.
- **PB-SWE-P02: downgrade** from a standalone project to a stepping stone into P01 (finding 16).
- **PB-DAT-P03: merge** into PB-DAT-E01 (finding 25).
- **PB-MKT-C04 (Semrush): delete** or link to a signal. It is vendor training with no signal.
- **PB-SWE-E06 / PB-DAT-E05 / PB-MKT-E05 (Forage): keep but never surface in fallback.** Its own evidence says "low signal", yet it appears in fallback ranking because it is weekend-effort and signal-linked (SWE-E06 links S07). Set `signals: []` or add a rank penalty.
- **R9 (RSS) and R13 (CIM Scotland 2023): replace** with current sources (findings 24, 27).
- **R59 (CNBC 2018): replace** with a UK marketing-specific source.

## Open questions

- Google intern sponsorship wording: the search summary quoted "will not be eligible for immigration sponsorship", but my direct fetch of google.com was truncated. Verify on the Google careers page before adding the chip.
- IMC's EMEA equivalent of Launchpad: only the APAC page was found. Optiver FutureFocus 2027 is Amsterdam-based, and UK eligibility for 2027 is not confirmed.
- MLH Fellowship UK eligibility: only an aggregator's country list was found.
- ISE Student Recruitment Survey 2026 primary: only Wonkhe's summary (14 Oct 2026) was available. The "68% use AI tools in first filtering stages" figure came via a summariser and needs checking on ise.org.uk before any product copy uses it.
- Microsoft and Amazon 2027 UK SWE intern postings: seen only on aggregators/Gradcracker, not on employer career sites.
- Revolut graduate pages returned 403 to the fetcher; details are from search summaries.
- Whether Meta's AI-enabled coding interview applies to UK new-grad loops: reports are press-only.
- No peer-reviewed evidence was found that GitHub profiles, hackathons or Kaggle ranks causally raise hiring odds. Current B grades rest on careers-publisher advice, which is fine for "recommended", not for "employers weight".

## Sources

Grade A (employer / official / peer-reviewed or working paper)
1. Monzo, Associate Software Engineer – Intern (Summer 2027), Greenhouse, accessed 2026-10-18. https://job-boards.greenhouse.io/monzo/jobs/8156261
2. Monzo, Associate Data Scientist – Intern (2027), Greenhouse, accessed 2026-10-18. https://job-boards.greenhouse.io/monzo/jobs/8232726
3. Monzo, "The ultimate guide on using AI to ace an interview at Monzo", 30 Jul 2024. https://monzo.com/blog/the-ultimate-guide-on-using-ai-to-ace-an-interview-at-monzo
4. Monzo, "Preparing for Mobile Interviews at Monzo", 29 Jan 2025 (re-read 2026-10-18). https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo
5. Canva Engineering, "Yes, you can use AI in our interviews", 11 Jun 2025. https://canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews
6. Anthropic, Candidate AI guidance, updated 10 Jul 2025. https://www.anthropic.com/candidate-ai-guidance
7. Google, Software Engineering, SRE BS/MS Intern 2027 (via gradireland), accessed 2026-10-18. https://gradireland.com/jobs/software-engineering-site-reliability-engineering-bsms-intern-2027-239937
8. Google, GSoC FAQ (eligibility, AI guidance), accessed 2026-10-18. https://developers.google.com/open-source/gsoc/faq
9. Google, GSoC timeline. https://developers.google.com/open-source/gsoc/timeline
10. Outreachy, Applicant Guide, accessed 2026-10-18. https://www.outreachy.org/docs/applicant/
11. Outreachy, "Call for May 2026 mentoring communities", 6 Feb 2026. https://www.outreachy.org/blog/2026-02-06/may-2026-call-for-mentoring-organizations/
12. GOV.UK, Government Operational Research Service sandwich student scheme. https://www.gov.uk/guidance/government-operational-research-service-sandwich-student-scheme
13. NCSC, CyberFirst candidate brochure 2025. https://www.ncsc.gov.uk/files/CF-593722-Candidate-Brochure-2025%20v2.pdf
14. Microbiology Society, Harry Smith Vacation Studentships. https://microbiologysociety.org/grants-prizes/all-grants/vacation-studentships.html
15. Biochemical Society, Summer Vacation Studentships. https://biochemistry.org/grants-and-awards/grants-and-bursaries/summer-vacation-studentships/
16. G-Research, Software Engineering Internship 2027 (Gradcracker). https://www.gradcracker.com/hub/347/g-research/work-placement-internship/83830/software-engineering-internship
17. Jane Street, Software Engineer Internship (Gradcracker). https://www.gradcracker.com/hub/820/jane-street/work-placement-internship/82347/software-engineer-internship-june-september
18. IMC, Programs – APAC (Launchpad). https://www.imc.com/ap/careers/students-graduates/programs
19. Revolut, Graduate Programme 2027: Product Owner (Technical) (403 to fetcher; via search). https://www.revolut.com/careers/position/554c4b14-c988-4c35-bd06-702acf4f36f7
20. Galdin & Silbert, *Making Talk Cheap*, arXiv 2511.08785, Nov 2025. https://arxiv.org/abs/2511.08785
21. Brynjolfsson, Chandar & Chen, *Canaries in the Coal Mine?*, Stanford Digital Economy Lab. https://digitaleconomy.stanford.edu/publications/canaries-in-the-coal-mine/
22. Unilever, Future Leadership Programme UK (careers / targetjobs). https://targetjobs.co.uk/jobs/unilever-future-leadership-programme-customer-development-uk-190680

Grade B (large-sample surveys, careers services/publishers, universities)
23. Stack Overflow Developer Survey 2025 – AI. https://survey.stackoverflow.co/2025/ai
24. Wonkhe (summarising ISE SRS 2026), 14 Oct 2026. https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs
25. Microsoft/LinkedIn Work Trend Index 2024 (71% leaders would hire less-experienced candidate with AI skills). https://news.microsoft.com/en-xm/2024/07/01/microsofts-2024-work-trend-index-report-showcases-increased-appetite-for-ai-at-work-highlights-opportunity-for-leaders-to-transform-enthusiasm-into-productivity-gains/
26. PwC, 2025 Global AI Jobs Barometer. https://www.pwc.com/gx/en/services/ai/ai-jobs-barometer.html
27. Aberystwyth University CS, Student Industrial Year Guide. https://impacs-inter.dcs.aber.ac.uk/images/editor-content/Documentation/Industrial_Year/student_industrial_year_guide.pdf
28. targetjobs, Technology – Product Management Graduate Scheme (Tesco). https://targetjobs.co.uk/jobs/technology-product-management-graduate-scheme-245101
29. targetjobs, Technology Summer Internship (Capital One). https://targetjobs.co.uk/jobs/technology-summer-internship-237339
30. targetjobs, GSS Sandwich Year Placements 2027. https://targetjobs.co.uk/jobs/gss-sandwich-year-placements-2027-252695
31. Bright Network, JPMorganChase 2027 Spring Insights: Engineer & Innovate. https://www.brightnetwork.co.uk/graduate-jobs/jp-morgan/2027-spring-insights-engineer-innovate-at-jpmorganchase-london
32. Bright Network, Lloyds Product and Partnerships Graduate Scheme 2027. https://www.brightnetwork.co.uk/graduate-jobs/lloyds-banking-group/product-and-partnerships-graduate-scheme-2027
33. Gradcracker, Amazon 2027 Software Dev Engineer Intern. https://www.gradcracker.com/hub/956/amazon/work-placement-internship/84230/2027-software-dev-engineer-intern
34. MLH, 2027 season events page (accessed 2026-10-18). https://www.mlh.com/seasons/2027/events
35. MLH Fellowship home. https://fellowship.mlh.com/
36. DataKind UK, Volunteer (18+, UK, needs data skills; no internships). https://www.datakind.org.uk/volunteer
37. Higherin (formerly RateMyPlacement) review banner. https://higherin.com/review/83245/bloomberg/software-engineering-intern

Grade C (press, aggregators, practitioner; corroboration only)
38. TechRadar, "Meta says it will let candidates use AI in some job interviews", 2025. https://www.techradar.com/pro/meta-is-going-to-let-candidates-use-ai-in-job-interviews
39. CXO Digital Pulse, "Google reinstates in-person job interviews amid rising AI cheating concerns", 2025. https://www.cxodigitalpulse.com/google-reinstates-in-person-job-interviews-amid-rising-ai-cheating-concerns/
40. The Register, "Canva to job candidates: Thou shalt use AI during interviews", 11 Jun 2025. https://www.theregister.com/2025/06/11/canva_coding_assistant_job_interviews/
41. Extern, Google STEP program guide, 16 Oct 2026. https://www.extern.com/post/google-step-program-guide
42. VideoLAN AI policy for GSoC participants, vlc-devel, Mar 2026. https://mailman.videolan.org/pipermail/vlc-devel/2026-March/143864.html
43. Opportunities Nexus, MLH Fellowship 2026 (country list, unverified). https://opportunitiesnexus.com/mlh-fellowship-2026/
44. Jointaro, Microsoft MSAI SWE intern London July 2027 (aggregator). https://www.jointaro.com/jobs/microsoft/software-engineer-internship-opportunities-87467605
45. Greek City Times, L'Oréal Brandstorm 2026 launch, 27 Jan 2026. https://greekcitytimes.com/2026/01/27/loreal-launches-global-brandstorm-innovation-challenge

All 49 source URLs in `role-playbooks-tech-product.json` (R1–R59) returned HTTP 200 on 2026-10-18, checked with curl -L.
