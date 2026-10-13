# 02 — What makes a CV succeed with human recruiters (2020–2026 evidence)

Researcher 2 of 6 · research date 2026-10-13 · scope: empirical evidence on CV content, AI-written applications, recruiter attention/noise, and thin-experience student signals.
This file **adds to** `docs/research/cv-rules-general.md`, `cv-rules-tech-product.md`, `cv-rules-finance-consulting.md` and spec §6–§8. It does not repeat their rules. Where it contradicts or re-grades them, it says so in §5.

**Evidence grades:** **A** peer-reviewed / randomised field or lab experiment · **B** large institutional survey or strong working paper (NBER/IZA/SSRN/arXiv with credible design) · **C** practitioner/press, or a real dataset that is not peer-reviewed · **D** weak or commercial (vendor marketing studies, undisclosed methods).

**Headline caveat.** Most causal CV evidence comes from correspondence (audit) studies in the US and Belgium, from online freelance markets (Upwork, Freelancer.com), and from recruiter vignette experiments. UK-specific causal evidence on student CVs is still thin. Only one UK audit appears here (finding 9). Treat effect sizes as directional for UK students.

---

## 1. Numbered findings

### A. Writing quality and AI assistance

**F1. Better-written CVs get hired more, and employers are not worse off.**
Wiles, Munyikwa & Horton, "Algorithmic Writing Assistance on Jobseekers' Resumes Increases Hires", *Management Science* 71(12):10144–10164 (2025); NBER w30886.
- Design: field experiment on an online labour market, ~480k jobseekers. The treated group got algorithmic writing help (error correction, readability). This was pre-LLM, Grammarly-style.
- Result: treated jobseekers were **hired 8% more often, at ~10% higher wages**.
- Employers were **no less satisfied** with the hires.
- The authors read this as clearer writing helping employers *see* ability, rather than writing acting as a costly signal.
- URL: https://pubsonline.informs.org/doi/10.1287/mnsc.2024.04528 · https://www.nber.org/papers/w30886
- **Grade A.**

**F2. Spelling errors causally cut interview chances (re-confirmed; already in the general doc).**
Sterkens et al., *PLOS ONE* (Apr 2023).
- Sample: 445 recruiters, 1,335 CV ratings.
- Effect: **−7.3 pp** for a few errors and **−18.5 pp** for many.
- About half the penalty runs through perceived lower conscientiousness and mental ability.
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10075394/
- **Grade A.**

**F3. Since LLMs arrived, generic AI tailoring has lost its signal value. Employers now lean on verifiable history instead.**
Cui, Dias & Ye, "Signaling in the Age of AI: Evidence from Cover Letters", arXiv 2509.25054 (Sep 2025, rev. Nov 2025).
- Data: Freelancer.com, 5.5M applications, 106,714 jobs (Apr–Sep 2023).
- Access to the platform's AI cover-letter tool raised callbacks by **0.43 pp (+6% on a 7.0% base)**.
- But the link between how well a letter matched the job post and getting a callback **fell 51%**. Its link to offers fell **79%**.
- Employers shifted weight to **past work record** (+~5% correlation).
- **Over 75% of AI letters were sent within one minute, barely edited.**
- Applicants who spent more time **editing** the AI draft got more offers: +1 SD of editing time ≈ +0.31 pp offer probability, about half the mean offer rate.
- URL: https://arxiv.org/abs/2509.25054
- **Grade B.**

**F4. When writing becomes cheap, hiring becomes less meritocratic.**
Galdin & Silbert, "Making Talk Cheap: Generative AI and Labor Market Signaling", arXiv 2511.08785 (Nov 2025, Princeton/Dartmouth).
- Data: Freelancer.com, ~2.7M applications, 61k jobs, 2021–2024.
- Before LLMs, employers would trade **$25.67** of bid price for +1 SD of customisation. After LLMs, this fell to **$10.82 (−58%)**.
- Structural simulation: **top-quintile workers are hired 19% less often** and **bottom-quintile workers 14% more often**.
- URL: https://arxiv.org/abs/2511.08785
- **Grade B** (strong working paper; the quintile results come from a model counterfactual).

**F5. LLM polish raises rated quality but not interview invitations. Recruiters cannot detect AI, yet they downgrade text they suspect is AI.**
Abbas Nejad, Musillo, Wicker & Zaccaria, "Labor market signals: The role of LLMs", CentER DP 2025-003, Tilburg (2025); AEA RCT registry 14784.
- Recruiters came from Philips, PwC, Rabobank and VodafoneZiggo.
- With ChatGPT, cover-letter quality went up: fewer errors, more formal tone, better generic intro and outro. **Interview invitations did not rise.**
- The parts recruiters value most, **personal motivation and clarity**, barely improved.
- Recruiters detected AI use **no better than chance**.
- When recruiters knew a strong letter was human-written, they rated it higher. Press coverage of the same team reports that **suspicion of ChatGPT use lowered ratings**.
- Gains went mainly to weaker applicants.
- URLs: https://research.tilburguniversity.edu/en/publications/labor-market-signals-the-role-of-large-language-models/ · https://www.socialscienceregistry.org/trials/14784 · https://universonline.nl/nieuws/2025/02/19/chatgpt-in-job-applications-is-using-ai-the-key-to-success-or-a-pitfall/
- **Grade B** (sample sizes not published in sources we could read).

**F6. Being *perceived* as AI-written damages evaluations of the person, not just the text.**
arXiv 2412.18647 (Dec 2024), pre-registered experiment, nationally representative US sample, N=644, college personal statements.
- **Linguistic style** ("AI-sounding" features) was the main detection cue.
- AI attribution lowered perceived quality, authenticity, competence, sociability, morality and expected success.
- International students were more likely to be suspected.
- URL: https://arxiv.org/abs/2412.18647
- **Grade B.**
- Adjacent: a disclosure study (arXiv 2510.24011, n=261) found that disclosing AI use erodes perceived competence and trustworthiness. **Grade B/C.**

**F7. LLM screeners prefer LLM-written CVs and are unstable on presentation.**
- Xu, Li & Jiang, arXiv 2509.00462 (Aug 2025; EAAMO/AIES 2025): LLMs prefer their own CVs over human-written ones **67–82%** of the time. Simulated shortlisting: **+23–60%** for the same-model applicant. URL: https://arxiv.org/abs/2509.00462. **Grade B.**
- arXiv 2609.16517 (Sep 2026): changes to presentation that keep competence fixed **flip 29.6–41.4% of pairwise LLM screening decisions**. URL: https://arxiv.org/abs/2609.16517. **Grade C** (preprint, small open models).
- Prompt-injection study (arXiv 2606.27287, ACL 2026): injected self-promotion helps only while it is rare and **collapses when widespread**. URL: https://arxiv.org/abs/2606.27287. **Grade B/C.**
- Relevance to UK students: ISE says employer AI use is still limited, but 62% of ISE employers expect to use AI in recruitment within 5 years (F13).

**F8. Unconstrained LLM CV-improvement pipelines fabricate almost always.**
arXiv 2608.26171 (Aug 2026), 180 runs.
- The baseline pipeline produced **≥1 unsupported claim in 96.7%** of outputs.
- Prompt guardrails cut fabrication density by 86%, but 50% of outputs still had one.
- A human checkpoint removed identity fabrications. Subtle qualifier inflation survived review about half the time.
- URL: https://arxiv.org/abs/2608.26171
- **Grade C** (small preprint), but it directly validates spec §7.3.

### B. CV content: what causally moves callbacks

**F9. Making experience salient raises callbacks (UK audit).**
*Nature Human Behaviour* (Dec 2022), pre-registered **UK** audit, n=9,022 applications.
- Listing jobs by **number of years worked instead of date ranges** raised callbacks by **~8%** against CVs without gaps and **~15%** against CVs with gaps.
- Lab follow-ups (n=2,650) show the mechanism is the **salience of experience**, not novelty or ease of reading.
- URLs: https://ore.exeter.ac.uk/repository/handle/10871/131446 · https://business.columbia.edu/faculty/research/reducing-discrimination-against-job-seekers-and-without-employment-gaps
- **Grade A.**
- Lesson: layout choices that bring the strongest evidence to the top have a causal effect. This is the best real evidence behind "front-load what matters".

**F10. Internships causally raise interview invitations for new graduates.**
- Baert, Neyt, Siedler, Tobback & Verhaest, *Economics of Education Review* 83 (2021): Belgian correspondence experiment, 1,248 CVs. Internship experience gave **+12.6%** interview invitations. URL: https://www.iza.org/publications/dp/12183. **Grade A.**
- Nunley, Pugh, Romero & Seals, *Labour Economics* 38 (2016): US audit, 9,400 CVs, 2,000+ openings. Internship gave **+14%** interview requests; the business major gave no benefit. URL: https://cla.auburn.edu/econwp/Archives/2015/2015-09.pdf. **Grade A.**

**F11. In the largest new-graduate audit, GPA did nothing, while client-facing internships and programming/data skills helped.**
Braun, …, Nunley, Seals & Wang, arXiv 2604.01933 (Jul 2026).
- Design: 36,880 applications, 9,220 US new-grad job ads. Base callback ~15%.
- Within-ad randomised credentials:
  - **social/client-facing internship +1.1 pp**
  - **programming + data-analysis skills +1.0 pp**
  - **study abroad +0.8 pp**
  - **GPA, quantitative internships and a math minor: about zero**
- Credentials narrowed demographic gaps only in low-discretion jobs.
- URL: https://arxiv.org/abs/2604.01933
- **Grade B** (working paper, very large randomised design). Applications were sent in 2016–17.

**F12. GPA and grades are weak, inconsistent signals.**
- **Quadlin**, *American Sociological Review* (2018): 2,106 applications. GPA had **no effect for men**. Women with *moderate* GPAs were called back more than high-GPA women, and high-achieving men got ~2× the responses of equally high-achieving women. URL: https://gap.hks.harvard.edu/mark-womans-record-gender-and-academic-performance-hiring. **Grade A.**
- **Kessler, Low & Sullivan**, *AER* 109(11) (2019): incentivised resume rating with real employers at an elite US school. GPA and **prestigious internships** are valued. Women and minorities with a 4.0 were treated like white men with a 3.75 in STEM. URL: https://www.aeaweb.org/doi/10.1257/aer.20181714. **Grade A.**
- **Piopiunik, Schwerdt, Simon & Woessmann**, *European Economic Review* (2020): 579 German HR managers. Signals of cognitive skills, social skills and maturity all raised interview invitations; GPA mattered. URL: https://www.iza.org/publications/dp/11283. **Grade A.**
- **NACE Job Outlook 2025 (US)**: **fewer than 40% of employers screen by GPA**, for the third year running. About 90% seek evidence of problem-solving and about 80% teamwork. Internship experience is a key differentiator. URL: https://naceweb.org/job-market/trends-and-predictions/hiring-projections-level-off-for-the-college-class-of-2025. **Grade B.**
- **UK counterpoint**: ISE SRS 2024 has 48% of employers still requiring a 2:1. This is a *threshold*, not a "higher is better" gradient (already in the general doc).

**F13. UK employer context 2025–26: record volumes and AI anxiety.**
- **ISE Student Recruitment Survey 2025** (155 employers, 1.8M applications): **140 applications per vacancy** (historic high; 290 in retail/FMCG). **79%** are redesigning processes because of AI. **61%** saw undisclosed AI use in interviews. **48%** worry AI misrepresents graduates' ability. **49%** are fine with candidates using AI. **45%** have given no AI guidance. URL: https://ise.org.uk/knowledge/insights/498/5_trends_you_need_to_know_from_ises_recruitment_survey_2025/. **Grade B.**
- **CIPD Resourcing & Talent Planning 2026** (published 22 Sep 2026): **27%** of recruiting organisations report "excessive" generative-AI use by candidates. **35%** try to monitor it, and **75% of those have rejected candidates for AI use**. URL: https://www.cipd.org/uk/knowledge/reports/resourcing-surveys. **Grade B.**
- **Greenhouse AI in Hiring 2025** (n≈4,100 seekers and recruiters in US/UK/IE/DE): **41%** of US seekers admit trying prompt injection; 28% used AI to fake work samples; 32% claimed AI skills they lack. URL: https://www.greenhouse.com/uk/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair. **Grade C** (vendor survey, large n).

**F14. Skills signals: AI skills help a lot in recruiter experiments; "skills-based hiring" barely changes real hiring.**
- **Stephany, Teutloff & Leone**, arXiv 2601.13286 (Jan 2026): paired conjoint with **1,725 recruiters in the UK, US and DE**. Listing AI skills raised interview invitation probability **+8–15 pp** (software engineering, office, design). Certificates added **only modestly** over self-declared skill. The effect was weaker for creative roles. URL: https://arxiv.org/abs/2601.13286. **Grade B.**
- **HBS + Burning Glass Institute (2024)**: degree requirements were removed from ~4× more postings, yet hiring of non-graduates rose only ~3.5%, or **fewer than 1 in 700 hires**. URL: https://burningglassinstitute.org/research/skills-based-hiring-2024. **Grade B.**
- Takeaway: a skills list helps when it is evidenced and in demand. Employer "skills-first" rhetoric outruns practice.

**F15. Volunteering and extracurriculars help, but class-coded hobbies carry bias.**
- **Baert & Vujić**, *Economics Letters* 203 (2021): Belgian field experiment. Volunteers were **+7.3 pp** more likely to get a positive reaction. URL: https://ideas.repec.org/a/eee/ecolet/v203y2021ics0165176521001312.html. **Grade A.**
- **Rivera & Tilcsik**, *ASR* 81(6) (2016): audit of 316 US law-firm offices. Upper-class signals (e.g. **sailing vs track**, classical music) boosted **men only**. Higher-class women faced a "commitment penalty". URL: https://www.kellogg.northwestern.edu/faculty/research/detail/2016/class-advantage-commitment-penalty-the-interplay-of-social-class. **Grade A.**
- arXiv 2603.05189 (2026): 18 LLMs inferred ethnicity and gender from **languages, hobbies and volunteering** on anonymised CVs and scored those groups differently. **Grade B/C.**

### C. Recruiter attention, noise, and junior candidates

**F16. Time on a CV is closer to ~30 seconds than "6 seconds". The 6-second figure is a weak commercial study.**
- **Ladders eye-tracking**:
  - 2012: 30 recruiters over 10 weeks, "6 seconds".
  - 2018: "7.4 seconds", with no published sample or protocol.
  - About 80% of time went to name, current and previous titles/companies, dates and education.
  - URL: https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf. **Grade D** (vendor, unpublished method, not peer-reviewed).
- **interviewing.io (2024)**: 76 recruiters, ~2,200 judgements. **Median 31 seconds per résumé.** Taking more than 45 seconds was linked to **34% better accuracy**. URL: https://interviewing.io/blog/are-recruiters-better-than-a-coin-flip-at-judging-resumes. **Grade C.**
- **Osanami Törngren et al.**, *Frontiers in Sociology* (Mar 2024): eye-tracking of 40 Swedish recruiters in finance and retail; 10 CVs in 5 minutes, about 30 s each. Longer dwell time did **not** predict a higher rating. URL: https://www.frontiersin.org/journals/sociology/articles/10.3389/fsoc.2024.1222850/full. **Grade A** (small n).
- Honest summary: the first screen is short, roughly 30 s at median, and attention concentrates on titles, organisations, dates and education. The exact "6 s" is not established.

**F17. Recruiters are noisy, and they weight pedigree over skill.**
interviewing.io (2024), the same 76 recruiters and ~2,200 judgements:
- Recruiters predicted interview outcomes correctly only **55%** of the time.
- **Two recruiters agree on the same CV 64% of the time.** Their probability estimates differ by **41 pp** on average.
- Candidates rated 0–5% likely to pass actually passed 47% of the time.
- **Top-company (FAANG) experience raised selection by ~35%**. Rejections were driven by "no top firm" or "no top school", although recruiters *said* "missing skill".
- Simple ML models beat recruiters.
- URL: as F16. **Grade C** (real outcome data, not peer-reviewed, US tech only).

**F18. For junior candidates, résumés carry the least information.**
Aka, Palikot, Ansari & Yazdani, arXiv 2507.08029 (Jul 2025, rev. Aug 2026). Two field experiments on a recruitment platform.
- Shortlisting with AI-interview reports raised final-interview pass rates by **17.5–20 pp**.
- Adding interview ratings to CV features raised AUC by **0.18 for juniors vs 0.08 for non-juniors**.
- URL: https://arxiv.org/abs/2507.08029
- **Grade B.**
- Implication: student CVs are thin signals. Recruiters fall back on pedigree (F17), on work history (F3), and increasingly on tests and interviews (F13).

### D. Thin-experience signals: projects, GitHub, hackathons, part-time work

**F19. Evidence on GitHub, projects and hackathons is qualitative only.**
- **Marlow & Dabbish**, CSCW 2013 (interviews): employers saw GitHub activity traces as **more reliable than résumé claims**, because work is visible and hard to fake. URL: https://www.cs.cmu.edu/~xia/resources/Documents/Marlow-cscw13.pdf. **Grade A (qualitative, dated).**
- arXiv 2510.25180 (Oct 2025): hiring-manager interviews plus 650 students. Managers want **initiative and sustained engagement**, shown through open-source contributions. Causal effect on hiring not tested. **Grade B/C.**
- Hackathon "get hired" claims online come from MLH and hackathon platforms. **Grade D.**
- We found **no correspondence experiment** that randomises GitHub links, projects or hackathons on student CVs. Flag this as a gap.
- Closest causal proxies:
  - programming/data skills +1.0 pp (F11)
  - AI skills +8–15 pp (F14)
  - verifiable work history weighted more after LLMs (F3)

**F20. Part-time and "ordinary" work counts, especially customer-facing work.**
- Client-facing internships were the most rewarded internship type (F11).
- NACE and ISE employers prioritise problem-solving, teamwork and communication evidence (F12).
- Volunteering raises callbacks (F15).
- **Grade A/B combined.**
- Implication: a bar or retail job described with responsibility and outcome is a real signal, not filler.

---

## 2. Table — CV feature → measured effect → strength

| CV feature | Measured effect | Source | Strength |
|---|---|---|---|
| Spelling/grammar errors | −7.3 pp (few) / −18.5 pp (many) interview probability | Sterkens 2023 (F2) | **A** |
| Writing clarity/polish (algorithmic assistance) | +8% hires, +10% wages; no employer dissatisfaction | Wiles et al. 2025 (F1) | **A** |
| Internship experience | +12.6% (BE) / +14% (US) interview invitations | Baert 2021; Nunley 2016 (F10) | **A** |
| Client-facing internship vs quantitative internship | +1.1 pp vs ≈0 (base ~15%) | Braun et al. 2026 (F11) | **B** |
| Programming + data skills | +1.0 pp | Braun et al. 2026 (F11) | **B** |
| AI skills listed | +8–15 pp interview invitation (UK/US/DE recruiters); certificate adds little over self-declared | Stephany et al. 2026 (F14) | **B** |
| Volunteering | +7.3 pp positive reaction | Baert & Vujić 2021 (F15) | **A** |
| Study abroad | +0.8 pp | Braun et al. 2026 (F11) | **B** |
| GPA / grade level | ≈0 in large audit; gendered non-linear effects; valued in elite-employer rating and German HR experiment | Braun 2026; Quadlin 2018; Kessler 2019; Piopiunik 2020 (F11–12) | **A/B, mixed** |
| Prestigious employer/school | ~35% higher recruiter selection; pedigree drives rejections | interviewing.io 2024 (F17); Kessler 2019 | **C / A** |
| Experience made salient (years vs dates) | +8% / +15% callbacks (UK) | *Nat Hum Behav* 2022 (F9) | **A** |
| Upper-class hobbies | Boost for men only; penalty for women | Rivera & Tilcsik 2016 (F15) | **A** |
| AI-tailored cover letter (generic) | Small callback gain (+6%) but tailoring signal −51% (callbacks) / −79% (offers) | Cui et al. 2025 (F3) | **B** |
| Editing the AI draft (vs sending raw) | +1 SD editing time ≈ +0.31 pp offer (~half of mean) | Cui et al. 2025 (F3) | **B** |
| LLM-polished cover letter | Higher rated quality, **no** interview gain | Tilburg 2025 (F5) | **B** |
| Being suspected of AI | Lower quality, authenticity and competence ratings | Tilburg 2025; arXiv 2412.18647 (F5–6) | **B** |
| Same-LLM-written CV under LLM screener | +23–60% shortlist (simulated) | Xu et al. 2025 (F7) | **B** |
| GitHub / projects / hackathons | No causal estimate; employers trust visible work traces | Marlow & Dabbish 2013; arXiv 2510.25180 (F19) | **A-qual / C** |
| Length 2 pages vs 1 | "2.3× more likely hired" | ResumeGo 2018 | **D** (vendor, US, undisclosed realism) |

---

## 3. Myths vs evidence

(Myths already in `cv-rules-general.md` §3 are only re-graded here, not repeated.)

| Myth | Verdict | Evidence |
|---|---|---|
| "Recruiters spend 6 seconds on a CV" (general doc M2) | **Re-grade D.** Better estimate: ~30 s median first screen. Dwell is not linked to rating. | Ladders 2012/2018 (D); interviewing.io 2024 (C); Frontiers 2024 (A) — F16 |
| "Using AI to write your CV will get you rejected" | **Overstated.** Writing assistance raised hires (+8%). Recruiters can't detect AI above chance. The penalty applies when AI use is *suspected* or *disclosed*, and 75% of the 35% of UK employers who monitor say they have rejected someone for it. | F1, F5, F6, F13 |
| "AI-polished applications get more interviews" | **Mostly false for generic polish.** Quality rises, invitations don't (Tilburg). On Freelancer, gains were small and the signal collapsed. Gains come from *edited*, specific content. | F3, F4, F5 |
| "Tailoring = mirroring JD keywords" | **Weakening.** Text-to-post alignment predicts callbacks 51% less after LLMs. Employers shift to verifiable history. | F3, F4 |
| "Grades are the main screen" | **Not in the US data. In the UK, a 2:1 threshold for about half of large employers.** GPA ≈0 in the largest audit; under 40% of NACE employers screen by GPA. | F11, F12; ISE 2024 |
| "A skills section is what matters now (skills-based hiring)" | **Partly.** Evidenced, in-demand skills (programming/data, AI) help. Skills-first hiring changed under 1 in 700 hires. | F11, F14 |
| "Recruiters reliably spot the best CV" | **False.** 55% accuracy, 64% pairwise agreement; pedigree dominates. | F17 |
| "Certificates beat self-declared skills" | **Weakly true.** Certificates add only moderately over a declared AI skill. Evidence through projects matters more. | F14 |
| "Hidden prompt injection beats AI screeners" | **False at scale**, and dishonest. Gains collapse when common; 41% of US seekers say they've tried it. | F7, F13 |
| "Hackathons/GitHub get you hired" | **Unproven causally.** Plausible (visible work traces) but no experiment. Hackathon-platform data is D. | F19 |
| "Two pages beat one page" | **D-grade only (ResumeGo).** Keep the UK convention (1–2 pages; 1 for most students). | ResumeGo 2018 |

---

## 4. What predicts success for juniors (synthesis)

1. **Verifiable experience** (internships, especially client-facing; part-time; volunteering) has the most consistent causal callback effects (A).
2. **Error-free, clear writing** has a large causal effect and is cheap to fix (A).
3. **Evidenced technical and AI skills** help modestly to substantially (B).
4. **Grades** work as a threshold gate in the UK, not as a gradient (A/B mixed).
5. **Pedigree** (employer and school brand) drives recruiter judgement, which is noisy (C). Students can't change it, so Placed must not reward or punish it in the score.
6. **Generic, LLM-produced customisation** is now low-signal or negative (B). Specific, edited, verifiable detail is what still separates candidates.

---

## 5. Implications for Placed CV scoring & tailoring

### 5.1 Re-weighting existing rules and dimensions

| Change | From → To | Why (finding) |
|---|---|---|
| **Clarity & polish** dimension weight | 20 → **25** | Strongest causal evidence of any CV feature: errors (F2, A) and clarity raising hires (F1, A). Keep the G-25 gate (3+ errors → cap 50). |
| **Impact & evidence** weight | 30 → **25** | Quantification is consensus-only (no causal CV study found). Keep it as the top coaching lever, but don't let it outweigh clarity. |
| **Relevance** weight | 20 → **25**, and **redefine** | Score *specific, verifiable* fit (named experience that matches the JD), not keyword echo. Alignment-as-signal collapsed (F3, F4). |
| **ATS readiness** weight | 20 → **15** | Mechanistic only, and auto-rejection is rare (general doc M1). Parse-safety stays as a gate (image-only PDF). |
| **UK conventions** weight | 10 (keep) | Binary checks. |
| Quantification-share rule (G-22 / GEN-04, "≥40% bullets with a number") | evidence A → **C** | No experiment tests quantification itself. Keep the coaching, lower the evidence factor (0.6). |
| Grade rule | Reward "**states grade if ≥2:1/predicted 2:1**" only; **never reward a higher GPA/first beyond the threshold** | F11–12: no gradient effect; gendered non-linearity (Quadlin). |
| Prestige | **Never score** employer or university brand | F17, F15: pedigree bias; fairness guardrail (general doc §J). |
| Interests/hobbies | **Minor**, and **don't reward class-coded hobbies** (sailing, polo, etc.) | F15 (Rivera & Tilcsik): biased signal; LLMs infer demographics from hobbies. |
| SWE-07 GitHub, SWE-12 hackathons | Keep **major/minor**, but evidence **A → B/C** | F19: no causal estimate. Reward a *working, specific* link or project over mere presence. |

### 5.2 New scoring rules (suggested IDs)

- **EV-01 Experience present and salient (code + LLM, major, A).** At least one internship, part-time, volunteering or society-role entry. Duration is visible, and the entry sits in the top half of page 1 when it is the strongest asset. Basis: F9, F10, F15, F20.
  - Quest: "Add your part-time job: it counts" for students with zero entries.
- **EV-02 Client-facing / teamwork evidence (LLM, minor, B).** At least one bullet shows dealing with customers, stakeholders or a team, with an outcome. Basis: F11 (social internships +1.1 pp), F12 (NACE 80–90% seek teamwork and problem-solving).
- **EV-03 Evidenced in-demand skills (code, major for tech/data, B).** Programming, data or AI tools in the skills list must also appear in a project or experience bullet (extends SWE-11 to all sectors). Basis: F11, F14.
  - Do **not** require certificates (F14: small added value).
- **AU-01 Generic-LLM phrasing density (hybrid, minor→major, B).** Count AI-cliché tokens ("leveraged", "spearheaded", "passionate about", "dynamic", "fast-paced environment", "results-driven", "proven track record", em-dash strings, triplet lists) per 100 words. Flag above a threshold. Basis: F5, F6 (style is the main detection cue; suspicion lowers competence ratings). This extends the `forbiddenPhrases` list in spec §7.3.
- **AU-02 Specificity score (LLM, major, B).** Share of bullets with at least one concrete, checkable anchor: a named tool, dataset, organisation, number, date or link. Generic bullets that could appear on any CV fail. Basis: F3 (specific, edited content and verifiable history keep their value), F4, F5.
- **AU-03 Read-time test (code, minor, C/A).** Name, latest role or organisation, dates, education and the strongest experience are all extractable from the top third of page 1. Copy should say "roughly a 30-second first screen", **not** "6 seconds". Basis: F16.

### 5.3 Tailoring (`tailorCV`, spec §7–§8)

1. **Optimise for specificity, not JD-echo.** Keyword coverage (45% → 81%) is still a useful demo metric, but it is no longer evidence of quality. Show a **Specificity before → after** metric next to it (AU-02). In the "what we tailored for" list, prefer rephrasings that surface *existing, verifiable* experience (the 🔁 items) over vocabulary injection. Basis: F3, F4.
2. **Make the student edit.** Never offer a one-click "send" of the raw AI version. Require the student to accept or edit each changed bullet. Optionally award XP for edits, e.g. a "Made it yours" badge, which fits the gamification. Basis: F3 (editing time predicts offers; 75% of AI letters sent unedited within 1 minute).
3. **Keep and publicise `verifyTailoring()` blocking.** Unconstrained LLM tailoring fabricates in ~97% of runs. Guardrails alone leave 50%, and a human checkpoint is needed (F8). The spec's deterministic checks plus the "Confirm this number" dialog match this evidence. Add a **qualifier-drop check** ("helped build" → "built", "assisted" → "led"), because reviewers miss this about half the time. It already partly exists as `authorshipEscalation`; extend it to adverbs and qualifiers.
4. **Write in the student's voice.** Feed 2–3 of the student's own original bullets as style anchors and run AU-01 on the output. Output must not read as stock LLM prose, because suspicion carries a penalty (F5, F6, F13: CIPD 75% of monitoring employers have rejected for AI use).
5. **No adversarial ATS tricks.** No hidden text and no prompt injection. They fail at scale (F7), are dishonest, and UK employers actively monitor for them (F13). This reinforces general doc M5.
6. **Don't promise LLM-screener wins.** LLM screeners flip 30–41% of decisions on presentation alone and favour their own model's text (F7). Product copy should not claim "beats AI screening".

### 5.4 Product copy and UX

- Show the score as **guidance**. Human screening is close to a coin flip on prediction (F17), and for juniors the CV is the least informative signal (F18). Suggested line: "Recruiters disagree on about 1 in 3 CVs — we help you remove the avoidable reasons for a no."
- Use a **myth card**: "6 seconds? The best data says ~30 seconds — and they look at titles, organisations, dates and education first."
- For thin-experience students, route them into **experience-building quests** (part-time, volunteering, society role, a project with a live link) rather than more polishing. The causal gains from experience (F10, F15) exceed any formatting gain.

---

## 6. Gaps and uncertainty

1. No randomised study isolates **quantified bullets**, **projects/GitHub** or **hackathons** on student CVs. These remain consensus or qualitative.
2. Freelancer and Upwork findings (F1, F3, F4) come from freelance gig markets, not graduate schemes. Their mechanisms (signal dilution, reliance on history) plausibly transfer, but the effect sizes may not.
3. The Tilburg study's sample sizes were not visible in the accessible sources. Re-check CentER DP 2025-003 before quoting numbers.
4. The authors of the *Nature Human Behaviour* 2022 UK audit are not named here because the PMC page was CAPTCHA-blocked. Cite it by journal and DOI-linked repository.
5. Braun et al. (F11) applications date from 2016–17, before LLMs. They are a pre-AI baseline for credential returns.
6. UK-specific causal evidence on degree class (2:1 vs first) for callbacks: none found. A 2010 regression-discontinuity study (IZA DP 4836) found degree class had little causal effect on first destinations at a post-92 university. **Grade B, dated.**
