# Tailoring playbooks: finance/banking, quant/trading, consulting (UK students)

Compiled 2026-10-14. These are the research notes behind `tailor-playbooks-finance-consulting.json`, which the "tailor my CV to this role" prompt injects. Scope: UK undergraduate spring weeks, insight programmes, and summer analyst or intern roles.

They build on `cv-rules-finance-consulting.md` (scoring rules, S-tags), `role-playbooks-finance-consulting.*` (signals and actions), `career-ops-extraction.md` §3 (tailoring rules) and `market-2026/05`/`02` (tailoring science, recruiter screening). They don't repeat scoring rules. They answer one question: **how does a recruiter for this role type read a CV, and how should an honest rewrite change to suit that reader?**

**Grades** (same scale as the existing docs):
- **A**: the employer's own guidance, or several top UK careers services agree.
- **B**: one top-tier UK source (TARGETjobs, Prospects, a Russell Group careers service).
- **C**: practitioner or trade press (eFinancialCareers and the consultants it quotes).
- **D**: our synthesis.

**Quotes** are verbatim from pages fetched on 2026-10-14, each 25 words or fewer. Every JSON quote was string-matched against the fetched text by script (curly quotes and dashes normalised). Tags [TFn] refer to §6.

---

## 0. The constraint that overrides everything below

The rewrite may only reorder, re-weight and re-word what the source CV already says. Four rules apply:

- **No new facts.** No new numbers, skills, tools, employers or titles.
- **No authorship escalation.** A verb can only move sideways or down this ladder: `familiar < used/assisted/supported/contributed < built/developed/implemented < led/managed/founded`. Qualifiers survive ("helped", "team of 4", "coursework", "shadowed"). This matches the `authorshipEscalation` and `qualifierDrop` checks in `05-tailoring-science.md`.
- **Equivalent terms only.** A `reframe` (CV phrase to the role's standard term) is legitimate only when its `onlyIf` condition is visibly met by the original line. Otherwise leave the line alone.
- **Exact names.** Firm, team and programme names are reproduced exactly (see FIN pitfall on "Industrials").

The sector sources support this directly:
- Cambridge consulting guide: list skills *"as long as you actually do have them"* [TF2].
- Banking: *"You didn't originate or execute the deal, so don't feel that you need to claim that you did"* [TF9].
- LSE: employers can revoke an interview or offer if you misrepresent [TF30].
- Barclays: *"Avoid clichés or claims you can't prove."* [TF14].

---

## 1. Cross-archetype findings (new relative to the existing docs)

### 1.1 Profile/summary: skip by default for all three (conflicting evidence, majority says skip)

| Position | Source | Grade |
|---|---|---|
| Skip. *"in many cases, a personal statement on a graduate CV is a waste of space."* Graduate statements sound alike; a careers adviser saw fewer than ten good ones in four years | TARGETjobs [TF4] | B |
| Skip. *"For new graduates or postgraduates, career profiles are not necessary as this content is addressed in your cover letter."* | LSE Careers [TF30] | A (Russell Group careers service) |
| Skip. Some recruiters suggest removing "objectives" sections because the cover letter covers them | eFC keywords article [TF13] | C |
| The TARGETjobs graduate IB CV template has no profile: it goes straight from contact details to Education | TARGETjobs template [TF5] | B |
| **Keep**: *"If you're a student, the executive summary is important."* (Roy Cohen, a US coach) | eFC 2026 [TF8] | C |
| **Keep, for ATS**: profile "optional but should be included if you are applying for larger firms that may use AI" | Imperial Careers [TF31] | B |

**Decision (D):** `summaryFormula` starts with `skip:` for all three archetypes. If the student's CV already has a profile, the rewrite compresses it rather than deleting it, because deletion is the student's call:
- FIN: at most 2 lines.
- QNT: 1 line.
- CON: 2 lines.

The compressed profile holds facts only, already in the CV, with no adjectives. Of the "keep" sources, one is a US practitioner and the other is about ATS completeness rather than recruiter reading, so they don't outweigh the UK student-specific advice. Exceptions where a profile makes sense: applying with no cover letter or form, such as Bain London [TF29], IMC [TF19] or Jane Street [TF22]. That is a product decision, not something the evidence settles.

### 1.2 Employers' AI policies matter for a tailoring tool

- **Bain London**: *"We'd ask that you only use AI, such as Chat GPT, to check grammar and spelling in your CV."* [TF29] (A; read via a 2026 web.archive.org snapshot).
- **Oxford Careers' 2025 employer survey**: only 15% of recruiters allow or encourage AI in applications, and half said no [TF33] (B).
- `cv-rules-finance-consulting.md` S21b records McKinsey as allowing AI polishing but not misrepresentation. I could not re-fetch it today.
- **Product implication (D):** show a firm-policy notice on tailoring. At minimum, warn for Bain. Keep tailoring to reordering and same-level rewording so the result stays the student's own text.

### 1.3 What tailoring looks like to the people who read these CVs

- **Moves, not new content.** eFC/McLean's "light re-wording": *"bringing certain achievements higher up the page, highlighting different areas of expertise, aligning your language more closely with the role"* [TF8] (C). This matches the UK salience audit in `05-tailoring-science.md` F4: the same facts made more visible.
- **Mirror the employer's words.**
  - Barclays: *"Study the job description and pull-out key words, then ensure these are highlighted throughout your CV/Resume."* [TF14] (A).
  - TARGETjobs on Morgan Stanley: group experiences by the skills the description asks for [TF6] (B).
  - TARGETjobs leadership guide: write "built strong relationships" rather than "worked in a team" when that is what the employer asks for [TF26] (B). This is valid only if the source line shows relationship-building; that is exactly what `onlyIf` enforces.
- **Use the sector's own term.** *"Every sector of every industry has its own lingo, and you have to sound fluent by using it in the right way"* [TF13] (C). This is the basis for `reframes`.
- **Substance beats polish now.** *"Recruiters are looking for differentiated evidence, context and results, not just well-written 'polished' statements."* [TF8] (C). It matches the decaying signal value of AI tailoring in `05` F2–F3.
- **First-screen attention** goes to titles, organisations, dates and education, at roughly 30 seconds; in the eye-tracking study, longer reading did not lead to higher ratings [TF35] (A, small n; carried over from `02` F16). `recruiterScan` is ordered on that basis.

---

## 2. finance_banking (IBD, markets, AM spring weeks and summer analyst roles)

**How the reader reads.**
- **Grades first.** Cambridge: screens look for *"key criteria (grades, skills)"* [TF1] (A). eFC/McLean: qualifications are *"one of the first filters"* [TF8] (C). TARGETjobs: banks and consultancies *"use A-level grades as an initial screening tool"* [TF7] (B).
- **Then experience.** Goldman recruiters: *"Leading with your education… followed by any relevant experiences via internships"* [TF3] (A).
- **Tailor towards banking's competencies:** quant skills, modelling, number crunching, Excel, and attention to detail [TF10] (C).

**Lead with.**
- Class standing and high module grades [TF1] (A).
- Any job, quantified: *"you can leverage those experiences and quantify them to make them impactful"* [TF3] (A).
- Measurable data [TF15] (A).

**Honest-scope framing is the house style.**
- The TARGETjobs IB template writes intern deal work as *"Assisted more senior team members with the execution of deals"* [TF5] (B).
- eFC: interns didn't originate or execute the deal, and banks know what interns do [TF9] (C).
- This is the strongest sector evidence that an LLM must not escalate "assisted" to "executed".

**Verb register.**
- **Avoid** superlatives ("The banks can see through superlatives and adjectives" [TF9], C), and clichés such as "dynamic", "team-player" and "innovative" [TF12] (C).
- **Avoid** LLM vocabulary ("meticulous", "robust", "delve"), which eFC reports Bloomberg flagging [TF11] (C).
- **Prefer** concrete analytic and outcome verbs. The selection is D, drawn from the LSE verb lists [TF30].

**Pitfalls.**
- Changing team names: eFC reports CVs turning "Industrials" into "Industrial Group" [TF11] (C).
- Overstated languages: "If it's not good enough for you to hold a client meeting in, it's not good enough to go on the CV." [TF9] (C).

**Competency themes.**
- Barclays: "judgment, innovation, teamwork, commitment and leadership" [TF14] (A).
- Prospects trader profile: analytical and numerical ability, decision-making, resilience, teamwork, *"a strong interest in financial markets"* [TF16] (B).

**Section order.** Follows the TARGETjobs IB template [TF5] (B) and education-first [TF3][TF8]:
Education (with A levels and modules with marks) → finance experience (internships, spring programme, insight days) → other work → positions of responsibility → skills (languages, IT) and interests.

**Grade mix.** The grade-first scan and the honest-scope rule are well sourced (A/B). Verb dos and don'ts lean on eFC (C). The reframes are D: each is a standard finance term paired with a guard I wrote.

---

## 3. quant_trading (QT/QR interns at prop firms, market makers, bank strats)

**How the reader reads.**
- **Maths depth.** Oxford: *"Fluency in probability, statistics, linear algebra, optimisation and stochastic processes is essential."* [TF18] (A).
- **The degree is not a gate.** Jane Street: *"no specific degree or major is required"* [TF21] (A). IMC APAC sets a Distinction-average floor [TF20] (B).
- **Competitions and games.** Optiver: *"Interested in strategic games and/or competitive activities"* [TF23] (A). Oxford: olympiads, Kaggle, firm trading competitions [TF18].
- **Projects are interview material.** Citadel Securities interviewers ask about "school projects" [TF24] (A). Oxford: back-tests, paper replications, event studies [TF18] (A).

**What reads as inflated.**
- IMC: *"If we read “very good” in C++, you'll be setting a high bar for yourself."* [TF19] (A).
- IMC: don't list Word or Excel [TF19] (A).
- Oxford: show *"depth in at least one"* language [TF18] (A).
- Finance jargon adds nothing: Jane Street *"won't test you on knowledge of finance or economics"* [TF22] (A).
- Oxford still wants candidates able to *"link your technical work to trading and investment decisions"* [TF18] (A). That link is allowed only where the source line already makes it.

**Verbs.** Measurement and method verbs (back-tested, simulated, estimated, benchmarked, reproduced) beat impact rhetoric. The trader cliché *"Able to work well in a high-pressured, fast-paced environment"* [TF12] (C) is a named avoid. Selection: D.

**Competency themes.**
- Accuracy and testing: unit testing, version control and documentation [TF18] (A).
- Curiosity and learning: "how you think and learn" [TF21] (A).
- Collaboration, and interests outside work [TF20] (B).

**Section order (D).** Education → Competitions & Awards → Projects → Experience → Technical Skills → Interests. It follows from Oxford's emphasis on competitions and projects [TF18] and the existing QNT rules. No firm publishes an order.

**Summary: skip (D).** No source recommends a quant profile, and IMC wants *"clear, concise resumes"* [TF19] (A).

**Grade mix.** The best-sourced of the three: firm pages and Oxford, mostly A. The weak spots are the section order and the reframes (D).

---

## 4. consulting (MBB, tier-2 strategy, Big 4 advisory)

**How the reader reads.**
- **Academics.** BCG UK: *"predicted at least a 2:1 degree or equivalent"*, plus excellence outside academics [TF28] (A).
- **Initiative, leadership, teamwork.** Bain London: strong academics and *"a record of initiative, leadership, and teamwork"* [TF29] (A).
- **Impact over duties.** McKinsey via TARGETjobs: *"why your work mattered"*, and evidence of *"impact, leadership, entrepreneurship, problem solving"* [TF25] (B).
- **Plain English.** Limit *"specialist descriptions and technical jargon"* [TF25] (B).

**Lead with.**
- **The student's own part.** Cambridge: *"mention your exact personal responsibility… quantify your outcomes"*, and interviewers want *"exactly what your part"* was [TF2] (A).
- **No "we".** TARGETjobs: *"Don't talk about 'we' or 'us'"* [TF26] (B).
- **Results, not titles.** Give more space to activities with the strongest results, not the grandest titles [TF26] (B).
- **The problem-solving arc.** *"focus on your contribution, not that of others"* [TF27] (B).
- **Template example.** The TARGETjobs template gives a model "proposed → implemented" bullet: *"Proposed the introduction of a mentoring scheme… Both ideas were implemented."* [TF5] (B).

**Banking vs consulting.**
- Consulting puts *"more emphasis on critical thinking and the ability to present, influence and persuade"* [TF10] (C).
- So consulting tailoring promotes stakeholder contact, presenting and persuading.
- Banking tailoring promotes modelling, Excel and detail.

**Verbs.**
- **Avoid** "did" and "carried out"; use stronger verbs [TF26] (B). This is valid only at the same authorship level, for example "carried out" to "conducted" or "coordinated". Not to "led".
- **Avoid** consulting buzzwords (synergies, holistic, value-add, MECE on a CV). This is D, following the plain-English rule [TF25] and the AI-sameness evidence [TF8][TF33].

**Section order.**
- Cambridge suggests consulting headings: "Leadership/Project Management", "Research", "Employment", "Extra-curriculars" [TF2] (A).
- LSE: put a "Consultancy work" section on the first page [TF30] (A).

**Pitfalls.**
- Bain London's AI-only-for-grammar policy [TF29] (A).
- Unevidenced soft skills in the skills line: Imperial says transferable skills "need evidence attached" [TF31] (B).

**Competency themes.**
- TARGETjobs 12 skills [TF27] (B).
- Prospects: conveying complex data clearly, analytical skills, commercial awareness [TF17] (B).
- BCG: quantitative problem solving and attention to detail [TF28] (A).
- Cambridge case criteria: structuring, numeracy, judgement, synthesis [TF2] (A).

**Big 4 note** (from the existing doc, not re-researched): Big 4 screens rely mainly on forms and tests (PwC, Deloitte), so a CV tailored for them matters less. Use the same playbook.

**Grade mix.** Well sourced on what is read (A/B: BCG, Bain, Cambridge, TARGETjobs). The reframes are D.

---

## 5. Archetype contrast: same student line, three rewrites (illustrative, D)

Source line (invented example): "Society treasurer. Helped organise the annual careers fair (40 firms, 600 attendees); proposed moving sign-ups online, which the committee adopted."

| Archetype | What moves up | Rewrite (no new facts) |
|---|---|---|
| finance_banking | Scale, money and detail; responsibility | "Treasurer. Helped organise annual careers fair (40 firms, 600 attendees); proposed online sign-ups, adopted by committee." (kept "helped") |
| consulting | Initiative and adoption first | "Proposed moving fair sign-ups online; adopted by committee. Helped organise annual careers fair (40 firms, 600 attendees)." |
| quant_trading | Usually demoted below Competitions/Projects | Same text, placed lower; no quant reframe applies |

---

## 6. Sources

All accessed 2026-10-14. Live-site fetches used curl; [W] means read via a web.archive.org 2026 snapshot because the live site blocked automated fetching.

| ID | Source | Publisher | Old tag | Grade |
|---|---|---|---|---|
| TF1 | [Banking & Financial Markets Short Guide 2025–26 (PDF)](https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf) | Cambridge Careers | S1 | A |
| TF2 | [Management & Strategy Consulting Quick Guide 2024 (PDF)](https://www.careers.cam.ac.uk/files/management_strategy_consulting_-_quick_guide_to_recruitment_2024.pdf) | Cambridge Careers | S2 | A |
| TF3 | [Resume Advice transcript (PDF)](https://www.goldmansachs.com/careers/materials/Resume-Advice-Transcript.pdf) | Goldman Sachs | S3 | A |
| TF4 | [Are personal statements a waste of space on graduate CVs?](https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/are-personal-statements-waste-space-graduate-cvs) | TARGETjobs | new | B |
| TF5 | [Graduate investment banking CV template (PDF)](https://targetjobs.co.uk/static/4af3322cc30d737ffda3e04aba50bd41/Graduate%20investment%20banking%20CV%20template.pdf) | TARGETjobs | new | B |
| TF6 | [Morgan Stanley cover letter and CV advice](https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/morgan-stanley-cover-letter-and-cv-advice-telling-your-story) | TARGETjobs | new | B |
| TF7 | [Do A levels matter for jobs?](https://targetjobs.co.uk/careers-advice/accountancy-banking-and-finance/graduate-jobs-investment-banking-and-investment-management-do-levels-matter) | TARGETjobs | new | B |
| TF8 | [How to write a banking CV (2026)](https://www.efinancialcareers.com/news/the-absolutely-perfect-investment-banking-cv) | eFinancialCareers | S8 | C |
| TF9 | [What NOT to include in your banking CV (2022)](https://www.efinancialcareers.com/news/2022/11/what-not-to-put-banking-cv) | eFinancialCareers | new | C |
| TF10 | [Banking vs consulting CVs (2018)](https://www.efinancialcareers.com/news/2018/01/banking-vs-consulting-cvs) | eFinancialCareers | new | C |
| TF11 | [Goldman Sachs & hedge funds will not hire you with these words](https://www.efinancialcareers.co.uk/news/chat-gpt-write-cv-finance) | eFinancialCareers | new | C |
| TF12 | [CV cliches you must avoid… (2015)](https://www.efinancialcareers.co.uk/news/2015/12/cv-advice-banking) | eFinancialCareers | new | C (old) |
| TF13 | [Keywords to include in your banking resume](https://www.efinancialcareers.co.uk/news/finance/keywords-banking-resume-and-cover-letter) | eFinancialCareers | new | C |
| TF14 | [Hints and tips](https://search.jobs.barclays/hints-and-tips) | Barclays | S5 | A |
| TF15 | [How we hire](https://www.jpmorganchase.com/careers/how-we-hire) | JPMorganChase | S6 | A |
| TF16 | [Financial trader job profile](https://www.prospects.ac.uk/job-profiles/financial-trader) | Prospects | new | B |
| TF17 | [Management consultant job profile](https://www.prospects.ac.uk/job-profiles/management-consultant) | Prospects | new | B |
| TF18 | [Quantitative finance sector guide](https://www.ox.ac.uk/careers/careers-guidance/explore-careers/sectors-and-occupations/quantitative-finance) [W] | Oxford Careers | S12 | A |
| TF19 | [Recruitment process (APAC)](https://www.imc.com/ap/careers/recruitment-process) | IMC Trading | S15 | A |
| TF20 | [How to prepare for an interview at IMC](https://www.imc.com/ap/articles/how-to-prepare-for-an-interview-at-imc) | IMC Trading | S16 | B (APAC) |
| TF21 | [Quantitative Trader Internship, London](https://www.janestreet.com/join-jane-street/position/8474407002/) | Jane Street | S14 | A |
| TF22 | [Interviewing](https://www.janestreet.com/join-jane-street/interviewing/) | Jane Street | S13 | A |
| TF23 | [Quantitative Trading Internship 2027, Amsterdam](https://www.optiver.com/join-us/jobs/trading/amsterdam/quantitative-trading-internship-2027-start/) | Optiver | S17 | A |
| TF24 | [Campus QR interview process](https://www.citadelsecurities.com/careers/career-perspectives/our-quantitative-research-interview-process/) [W] | Citadel Securities | S19 | A |
| TF25 | [Applying to McKinsey: CVs, cover letters, interviews](https://targetjobs.co.uk/careers-advice/business-consulting-and-management/applying-mckinsey-company-cvs-cover-letters-and-interviews) | TARGETjobs | S22 | B |
| TF26 | [Leadership experience on your graduate management CV](https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-big-your-leadership-experience-your-graduate-management-cv) | TARGETjobs | S25 | B |
| TF27 | [Skills graduate management consultants need](https://targetjobs.co.uk/careers-advice/business-consulting-and-management/top-consulting-skills) | TARGETjobs | S26 | B |
| TF28 | [Associate jobs: United Kingdom](https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs) | BCG | S24 | A |
| TF29 | [Bain London University Hiring + FAQ](https://www.bain.com/careers/recruiting/london-recruiting/) [W] | Bain & Company | S23 | A |
| TF30 | [Guide to CVs, cover letters and application forms (PDF)](https://info.lse.ac.uk/current-students/careers/Assets/Documents/application-and-cv-brochure.pdf) | LSE Careers | S11-brochure | A |
| TF31 | [CVs and resumes](https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/cv/) | Imperial Careers | new | B |
| TF32 | [CVs](https://warwick.ac.uk/services/careers/applications/cvs/) | Warwick Careers | S10 | A |
| TF33 | [Use of AI in Job Applications and Assessments](https://www.careers.ox.ac.uk/node/4589371) [W] | Oxford Careers | new | B |
| TF34 | [How the highest paid interns write their CVs (2023)](https://www.efinancialcareers.co.uk/news/2023/08/jane-street-intern-cv-advice) | eFinancialCareers | new | C (dev-leaning) |
| TF35 | [Eye-tracking of finance/retail recruiters (Frontiers in Sociology 2024)](https://www.frontiersin.org/journals/sociology/articles/10.3389/fsoc.2024.1222850/full) | Frontiers | `02` F16 | A (small n; not re-fetched) |

## 7. Gaps and caveats

- **Blocked sources.** Bright Network's IB and consulting CV pages and the McKinsey interviewing page were blocked or empty, so nothing from them is used. Prospects' investment-banker profile URL returned 404; the trader and consultant profiles stand in.
- **Reframes are synthesis.** Most `reframes` rows are D: standard sector vocabulary plus guards I wrote. The sources support the principle (use the sector's lingo [TF13], mirror the employer's language [TF14][TF26]) but give no per-term mapping. Evaluate them with the `tailor-eval` fixtures before trusting them.
- **Undated pages.** Several firm pages are undated; IMC's pages are its APAC versions. Bain London's AI policy was read from a 2026 snapshot, so re-check it before quoting it in the UI.
- **Section order for quant has no published source.** Some quant CVs put Experience above Projects when the experience is a quant internship. The rewrite should keep the student's order in that case.
- **Profile conflict is unresolved** (§1.1). The `skip:` default is the majority UK view, not a consensus.
