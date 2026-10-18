# CV Scoring Rules: Finance/Banking, Quant/Trading, Consulting (UK students)

Scope: Investment banking (IBD/M&A/ECM/DCM), markets (sales & trading, research), asset management (FIN-xx). Quantitative trading/research at prop firms, market makers and hedge funds (QNT-xx). Strategy/management consulting (MBB, Oliver Wyman etc.) and Big 4 advisory (CON-xx). Covers spring weeks, insight programmes, summer analyst/intern roles and off-cycles for UK undergraduates.
Compiled: 2026-10-13. Status: research input for the Placed CV scorer. Not recruiting advice.

---

## 0. How to read this document

This document uses the same conventions as `cv-rules-tech-product.md`, so the two can be merged.

**Check type**
- `RULE`: deterministic in code (regex, section parser, counts, keyword match).
- `LLM`: needs model judgement.
- `HYBRID`: code extracts or pre-filters, LLM grades.

**Severity**
- `critical`: likely to cause rejection at screen on its own.
- `major`: materially weakens the CV against peers.
- `minor`: polish.

**Evidence strength**
- `A`: the employer's own guidance, or a consistent position across several top-tier UK careers services.
- `B`: one top-tier source (TARGETjobs, Bright Network, a Russell Group careers service, ISE), or employer recruiters quoted in an employer-hosted transcript.
- `C`: practitioner or trade-press opinion (eFinancialCareers, CV consultants quoted in it, Mergers & Inquisitions/WSO). **Secondary.**
- `D`: my own synthesis, with no direct source. Treat as a tunable default.

Citation tags [Sx] refer to section 9.

**Inherited baseline.** The generic GEN-01 to GEN-12 rules in `cv-rules-tech-product.md` §1 still apply: contact block, no photo or DOB, single-column parseable layout, action-verb plus outcome bullets, quantification, tailoring, zero typos, no exaggeration, reverse-chronological order, PDF, date consistency. Below, I only **override severities** or add sector rules.

**Honest caveats up front**
1. **Firm-specific CV guidance is thin.** Most banks and MBB firms publish values and process pages, not CV rules. The strongest firm-level CV evidence I could verify:
   - Goldman Sachs recruiter transcript: one page, education first, no photo, interests section [S3]
   - Barclays hints and tips [S5]
   - IMC CV advice: don't list Word/Excel, rate proficiency against professionals [S15]
   - BCG UK: 2:1 minimum [S24]
   - Bain London university hiring: no cover letter, full grades; AI may be used only to check CV grammar and spelling [S23] (accessed 2026-10-18)
   - Jane Street: no GPA or degree requirement [S13][S14]
   - Optiver posting: penultimate-year STEM, games and competitive activities, Python a plus [S17]
   - Citadel Securities: Python/C++ core [S19]

   I could **not** retrieve CV guidance pages from J.P. Morgan (beyond generic "measurable data"), Morgan Stanley (its EMEA FAQ is a 2016 legacy page), HSBC, Citi, BlackRock (its transcript page redirected), McKinsey (its UK "what we look for" text came via search-indexed excerpts of mckinsey.com), Oliver Wyman, EY or KPMG. Treat claims about those firms as unverified.
2. **Big 4 often doesn't use a CV at first screen.** PwC UK uses an application form plus online assessment [S30]. PwC removed its 2:1 requirement; the press-release metadata dates this to 2022, so check the exact date before quoting it in the UI [S29]. Deloitte's form asks for GCSE/A-level/UCAS/degree details and offers contextual routes [S31]. For Big 4, Placed should score the CV, but should **tell the user the form and tests carry more weight**.
3. **"Six seconds per CV"** (Bright Network [S9]) is a widely repeated claim with no traceable primary study. Use it only as UX copy, never as a scoring rationale.
4. **ATS keyword matching is contested.** Cambridge says screens are "human or an applicant tracking system (ATS)" looking for "key criteria (grades, skills)" [S1][S2]. In eFC's 2026 article, one recruiter says many teams switch matching software off [S8]. Score ATS as parseability plus evidenced keyword coverage, not as keyword stuffing.
5. **Grade thresholds are shifting.** ISE 2025: only 47% of employers require a 2:1 (down from 71% in 2015/16), and 13% require specific A-level grades [S32]. **Front-office banking, MBB and BCG UK still signal 2:1 or above** [S24][S7][S8], and quant firms are mixed (Jane Street none [S13]; IMC cites a high average in some regions [S16]). Make grade rules sector-specific and soft (major), never auto-reject.
6. Much of the trade press is **US-centric** ("GPA", "résumé"). eFC's 2015 piece says London "may" accept 2 pages [S36]. Every 2023–2026 UK university source says one page for finance and consulting [S1][S2][S10][S11]. I follow the newer UK sources.

---

## 1. Cross-sector overrides for FIN / QNT / CON

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| FCQ-01 | **Strictly one page** for UK/US finance, consulting and quant student applications (2 pages only for PhD or experienced hires). | RULE: page count from the PDF; overflow of more than ~3 lines on page 2 still counts as 2 pages. | **critical** (FIN, CON); major (QNT) | A | [S1] Cambridge banking 2025–26; [S2] Cambridge consulting 2024; [S3] GS recruiters; [S10] Warwick; [S11] LSE |
| FCQ-02 | **Education is the first section** after contact details, for students. | RULE: section order, first heading ∈ {Education, Academic}. | major | A | [S3] GS ("Leading with your education"); [S7]/[S8] eFC 2025–26 ("students always have education listed first") |
| FCQ-03 | **No photo** (UK). In finance, GS recruiters add that a photo "takes up precious space". | RULE: embedded image in the header region. | major | A | [S1]; [S2]; [S3]; [S8] |
| FCQ-04 | **Grades stated explicitly**: degree classification or current average (e.g. "Year 1 average: 72% (First)"), class rank if known, high module marks. For students who don't have marks yet, a prediction marked with an asterisk is acceptable. | RULE: regex for `(First|2:1|2\.1|Upper Second|\d{2}%|predicted|expected)` inside Education. No degree grade or predicted grade gives a flag. | **critical** (FIN front office, MBB); major (QNT, Big 4) | A | [S1] ("specify your class standing and high module grades"); [S2] ("put in a prediction with an asterisk"); [S23] Bain; [S24] BCG |
| FCQ-05 | **Typos and formatting sloppiness are disqualifying** in these sectors. The outputs are client documents ("think pitch-decks, research reports"). | RULE: spell-check (UK English) plus formatting consistency (date formats, bullet styles, font sizes, alignment). LLM for grammar. | **critical** | A | [S1]; [S2]; [S3]; [S5] Barclays; [S11] LSE (employers "will simply discard CVs that contain any errors") |
| FCQ-06 | **Group skills into labelled clusters** (e.g. Technical / Languages / Leadership) so both ATS and humans can find them. | RULE: a Skills section exists with ≥ 2 labelled sub-lines. | minor | B | [S1]; [S2] |
| FCQ-07 | **ATS-safe layout**: sans-serif font (Arial, Calibri), consistent 10–12pt, no tables, text boxes, columns or graphics. | RULE: font detection, column/table detection, text-extraction ratio. | major | B/C | [S7] eFC guide (McLean); [S10] Warwick (tables, text boxes); [S8] |
| FCQ-08 | **Quantified, outcome-driven bullets** with your *personal* responsibility ("I", not "we"). | HYBRID: digit/£/% density (threshold in §7); LLM checks the outcome is attributable to the candidate. | major | A | [S1]; [S2] ("mention your exact personal responsibility"); [S25] TARGETjobs; [S6] JPMC ("measurable data") |
| FCQ-09 | **Specific extracurriculars**: frequency, level, results ("trains 4×/week, county 1st XV, captain"), not "enjoy sport". | LLM: specificity score for activities/interests. RULE: presence of numbers or rank words (captain, president, finalist, winner) in the Activities section. | major | A | [S2] (runner example); [S1]; [S3] |
| FCQ-10 | **Tailor to division and firm.** Use the job's own key words and values, and be explicit about division (IBD vs S&T vs AM). | HYBRID: keyword overlap with the JD after the synonym bank; LLM checks the CV doesn't read as generic or for the wrong division. | major | A | [S1]; [S2]; [S5]; [S9] |
| FCQ-11 | **Don't claim what you can't defend.** "Everything on there is fair game." Interviewers probe CV lines (quant especially). | LLM: listed skills with no supporting evidence lead to an "unevidenced" flag; also flag inflated proficiency levels. | major | A | [S5]; [S15] IMC; [S36] |
| FCQ-12 | **AI-generic language is a growing negative.** Recruiters report near-identical AI-written profiles. Substance beats polish. McKinsey permits AI polishing but not misrepresentation. | LLM: genericness score; RULE: cliché list (see GEN-09). | minor → major in CON | B/C | [S8] eFC 2026; [S21b] McKinsey interviewing page; [S32] ISE 2025 (rising misconduct) |

---

## 2. FINANCE / BANKING (FIN-xx)

### 2.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| FIN-01 | **Banking-style template**: Education, Experience, Leadership/Activities, Skills & Interests (or "Additional"). Dense, one column, bold firm and role, right-aligned dates and location. | RULE: heading set and order; dates right-aligned on the same line as role (parse layout). | major | B/C | [S3]; [S9] Bright Network template; [S7] |
| FIN-02 | **Academic signal**: 2:1/First (or on track for one); A-levels/IB with grades listed (in the UK, A-levels are customary for undergrads). eFC cites 216 UCAS points (A\*A\*A\*A, *sic*: that is 3A\*+A) as helpful, but banks don't stipulate it. | RULE: classification/percentage ≥ 60 or predicted 2:1+; A-level line present with grades. LLM only if the grading system is non-UK. | major (no grades: critical, via FCQ-04) | A (2:1) / C (UCAS figure) | [S7] p.23; [S8]; [S9]; [S35] MS legacy FAQ ("strong A-Level results") |
| FIN-03 | **Academic distinctions**: scholarships, prizes, rank ("Top 5% of cohort"), Dean's list. | RULE: keyword detection (`scholarship|prize|award|top \d+%|ranked`). | minor (bonus) | C | [S36]; [S1] |
| FIN-04 | **Demonstrated commitment to finance**: finance/investment society role (ideally committee), spring week/insight days, virtual work experience (e.g. Forage job simulations; never "virtual internship"), stock-pitch/trading competitions, personal portfolio, reading (FT/Economist) evidenced by an action. | HYBRID: RULE keyword hits from the FIN keyword bank in Activities/Experience; LLM judges depth (member vs committee vs organiser). | major (penultimate); minor (1st year) | B | [S9] (society committee, flagship event); [S7]; [S1] ("Attend Events") |
| FIN-05 | **Any work experience counts if commercialised**: retail, hospitality and tutoring framed with numbers (revenue, customers, targets). | LLM: is a non-finance job framed with a commercial outcome? | major | A | [S3] GS ("Any experience is really good experience… quantify them"); [S5]; [S36] |
| FIN-06 | **Leadership and teamwork evidence**: positions of responsibility, captaincy, society exec, team projects. | RULE: leadership lexicon (president, captain, founder, head, led, chair, treasurer); LLM checks scope. | major | A | [S3] ("where have you shown leadership"); [S5] (judgement, teamwork, commitment, leadership) |
| FIN-07 | **Technical skills line**: Excel (modelling, pivot tables, VBA), PowerPoint, financial modelling/valuation (DCF, comps, LBO), Bloomberg/Capital IQ/FactSet; Python/SQL increasingly valued (markets, AM). Courses such as BIWS, WSP and the Bloomberg Market Concepts certificate are a bonus only, never a fail or a gap: BMC costs $149 without a university terminal, and not every university has one (audit 2026-10-18 06#20). | RULE: keyword bank match; flag proficiency adjectives without evidence. | major (IBD/AM: modelling or Excel absent); minor (spring week) | B/C | [S7]; [S8] ("Excel", "Python", "modelling"); course names (BIWS/WSP/BMC): D |
| FIN-08 | **Interests section is expected and read**: brief, specific, conversation-starting (e.g. "Marathon (3:24, London 2025)", "Chess, ECF 1650"). Generic interests ("reading, travelling, socialising") are a negative. | RULE: presence of an Interests line; generic-term list. LLM: specificity. | minor (missing); minor (generic) | A (presence) / C (specificity) | [S3] GS ("The interests part is a great opportunity…"); [S2]; [S8] |
| FIN-09 | **Languages** with level (CEFR or "native/fluent/professional"), especially for EMEA desks and coverage. | RULE: language + level pattern. | minor | D | — (common practice; no primary source found) |
| FIN-10 | **Professional summary/objective**: for students, optional. eFC (2026) recommends a short keyword-rich summary, while UK university and GS templates omit it. **Allow ≤ 2 lines; never penalise absence.** | RULE: profile > 3 lines → minor flag. | minor | C (conflicting) | [S8] vs [S1][S3] |
| FIN-11 | **Passed Level I of the CFA Program** is a positive signal, especially for AM/research. Never a substitute for grades. Use CFA Institute's wording, not the "CFA Level I" form it forbids (audit 2026-10-18, 08#10). | RULE: passed Level I of the CFA Program → bonus. | minor (bonus) | C | [S8] (McLean, Cohen); [S36] |
| FIN-12 | **Red flags**: wrong firm name (cover letter/profile); mismatch between stated division interest and the CV; unexplained gaps; overlong bullets (> 2 lines); high-school content on a penultimate-year CV, unless notable. | RULE: firm-name mismatch vs target job; bullet line count; GCSE detail on penultimate CVs. LLM: division consistency. | critical (wrong firm); minor (others) | A/B | [S36]; [S2] (no paragraph on GCSE/A-level choices) |
| FIN-13 | **Asset management flavour**: evidence of investment thinking (stock pitch with thesis and outcome, investment club, portfolio with a disciplined process), curiosity about markets. BlackRock emphasises being a "student of the markets". | LLM: does the CV show investment reasoning, not just "interest in markets"? | major (AM only) | B/C | BlackRock EMEA early careers (search-indexed only, unverified) [S37] |
| FIN-14 | **Markets/S&T flavour**: numeracy, quick decision-making and communication evidence (trading competitions, mental maths, debate, sales roles), plus macro awareness. | LLM + keyword bank. | major (S&T only) | D/B | [S1] (cognitive/trading-scenario tests for quant-ish roles) |

### 2.2 FIN keyword bank (canonical ← synonyms)

- **Financial modelling** ← financial model, 3-statement model, three statement, DCF, discounted cash flow, LBO, leveraged buyout, comps, comparable companies, precedent transactions, valuation, sum-of-the-parts, merger model, accretion/dilution
- **Excel** ← MS Excel, spreadsheets, pivot tables, VLOOKUP/XLOOKUP, INDEX-MATCH, VBA, macros, Power Query
- **PowerPoint** ← pitch book, pitchbook, deck, slides, presentations
- **Data/terminals** ← Bloomberg, Bloomberg Market Concepts, BMC, Capital IQ, CapIQ, FactSet, Refinitiv, LSEG Workspace, Eikon, PitchBook, Dealogic
- **Markets** ← equities, fixed income, rates, FX, foreign exchange, credit, commodities, derivatives, options, futures, macro, sales and trading, S&T, market making
- **Corporate finance** ← M&A, mergers and acquisitions, ECM, DCM, IPO, leveraged finance, restructuring, capital markets, due diligence
- **Investment process** ← stock pitch, investment thesis, equity research, portfolio management, asset allocation, ESG integration, fund
- **Programming (markets/AM)** ← Python, pandas, SQL, R, VBA
- **Commercial awareness** ← FT, Financial Times, The Economist, market commentary, newsletter, deal analysis
- **Soft skills (evidenced only)** ← attention to detail, client service, teamwork, leadership, resilience, work ethic, integrity, judgement

### 2.3 FIN weighting vs generic rubric

Generic baseline (shared with the tech doc): ATS 20 / Impact 25 / Clarity 20 / Relevance 20 / UK conventions 15.

| Dimension | FIN weight | Δ | Rationale |
|---|---|---|---|
| ATS readiness | 15 | −5 | Parseability matters for high-volume portals, but grades and experience decide [S1][S8] |
| Impact | 25 | 0 | Quantified outcomes [S1][S3][S6] |
| Clarity | 20 | 0 | Dense one-page, zero-typo norm is decisive (FCQ-05 is critical) [S1][S3] |
| Relevance | 20 | 0 | Commitment and division fit [S9][S1] |
| UK conventions | 20 | +5 | 1 page, education first, grades/A-levels, no photo, banking template: the most conventions-heavy sector [S1][S3][S7] |

---

## 3. QUANT / TRADING (QNT-xx)

Applies to quant trader, quant researcher and trading interns at prop firms (Jane Street, Optiver, IMC, SIG, Flow Traders, Citadel Securities, HRT) and bank quant/strats roles. The quant-developer variant should borrow SWE rules from the tech doc.

### 3.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| QNT-01 | **Quantitative academic signal**: STEM degree (maths, statistics, CS, physics, engineering) or strong quantitative modules with marks. Jane Street states "no specific degree or major is required", so treat this as strong evidence of quant ability rather than a gate. | RULE: degree subject ∈ STEM list, OR ≥ 2 quant modules with marks. LLM for non-STEM with quant evidence. | major (not critical) | A | [S12] Oxford 2026; [S17] Optiver ("Penultimate-year student in a STEM field"); [S14] Jane Street |
| QNT-02 | **Competition results**: maths olympiads (UKMT BMO/IMO, Putnam), physics/informatics olympiads, Kaggle, firm-hosted trading competitions (e.g. Optiver/IMC Prosperity-style), estimation/poker/chess ratings. Results or rankings stated. | RULE: competition lexicon plus rank/medal/percentile pattern. | major (bonus if present; absence is not penalised for 1st years) | A | [S12] ("Competitions… Maths Olympiads"); [S17] ("Interested in strategic games and/or competitive activities"); [S36] (IMO) |
| QNT-03 | **Programming languages listed honestly**: Python is near-universal; C++ for performance and dev-leaning roles; Java/OCaml/Rust are bonuses. Jane Street and Optiver treat programming as "a plus" for trading; Citadel's core languages are Python and C++. | RULE: language list present; if the role is QR/QD, require ≥ 1 of {Python, C++}. | major (QR/QD); minor (QT) | A | [S12]; [S14]; [S17]; [S19] |
| QNT-04 | **Don't list Word/Excel** (assumed). If you give proficiency levels, calibrate against professionals ("very good C++" sets a high bar). | RULE: flag "Microsoft Word/Office" in the skills line; flag strong adjectives (expert, advanced, very good) without supporting projects. | minor | A | [S15] IMC (verbatim CV advice) |
| QNT-05 | **Projects with results**: back-tests, paper replications, event studies, execution or ML models, with metrics (Sharpe, hit rate, RMSE, latency) and repo/write-up links. | HYBRID: RULE detects a project section plus a metric term or GitHub URL; LLM judges rigour (out-of-sample, honest results). | major (QR); minor→major (QT penultimate) | A | [S12] ("Reproducing academic papers, building back-tests… Sharing code"); [S19] (school projects discussed) |
| QNT-06 | **Mathematical foundations evidenced**: probability, statistics, linear algebra, optimisation, stochastic processes (modules or projects). | RULE: keyword bank match in Education/Projects. | major | A | [S12]; [S7] p.79 |
| QNT-07 | **Mental maths/numerical speed** is tested, not CV-scored. A CV can signal it via competition results, trading-society practice or games. **Do not invent a CV rule** that penalises absence. | LLM: optional positive signal only. | minor (bonus) | B | [S1] (cognitive interviews, estimation, probability); [S12] ("Many firms test mental maths… in timed conditions"); [S20] Flow Traders ("Excellent mental math") |
| QNT-08 | **Finance knowledge is NOT required**. Don't penalise its absence. Over-indexing on finance jargon with no quant evidence is a weak profile. | LLM: if the finance keyword density is high and quant evidence is low, give "re-balance" advice. | minor | A | [S13] Jane Street ("We won't test you on knowledge of finance or economics"); [S14]; [S16] |
| QNT-09 | **Concise and relevant**. IMC: "clear, concise resumes"; extra detail goes in a separate document. No cover letter needed at IMC and Jane Street. | RULE: 1 page; flag cover-letter-style paragraphs inside the CV. | major | A | [S15]; [S13] |
| QNT-10 | **Collaboration and communication evidence**: firms repeatedly emphasise humility, teamwork, communication (tutoring, TA roles, team competitions). | LLM. | minor | A | [S13]; [S14]; [S16]; [S19] |
| QNT-11 | **Engineering practices** (for QR/QD): testing, version control (Git), documentation. | RULE: keyword detection (Git, unit tests, CI). | minor | B | [S12] ("unit testing, version control and clear documentation") |
| QNT-12 | **Grade signal**: Jane Street has no GPA requirement, and IMC cites a high average in its regional guidance. A top mark (First or ≥ 70%) and rank are strong positives. Missing grades are a **major** flag via FCQ-04, not critical. | RULE (as FCQ-04). | major | B (mixed) | [S13]; [S16]; [S1] |

### 3.2 QNT keyword bank

- **Probability/statistics** ← probability, stochastic processes, Markov chains, martingales, Bayesian, hypothesis testing, regression, time series, ARIMA, Monte Carlo, statistical inference, expected value
- **Maths** ← linear algebra, optimisation/optimization, convex optimisation, calculus, numerical methods, PDEs, stochastic calculus, Itô
- **Programming** ← Python, NumPy, pandas, SciPy, scikit-learn, PyTorch, C++ (C++17/20), Java, OCaml, Rust, Haskell, KDB+/q, SQL, MATLAB, R
- **CS fundamentals** ← data structures, algorithms, complexity, LeetCode, HackerRank, competitive programming, Codeforces rating
- **Trading** ← market making, options, Black-Scholes, Greeks, volatility, order book, market microstructure, execution, arbitrage, back-test/backtesting, alpha, signal, Sharpe ratio, PnL/P&L
- **ML** ← machine learning, classification, regression, model validation, cross-validation, feature engineering, overfitting
- **Competitions/games** ← UKMT, BMO, IMO, EGMO, Putnam, olympiad, Kaggle, trading competition, Prosperity, poker, chess (ELO/ECF/FIDE), bridge, estimation challenge, Fermi
- **Engineering hygiene** ← Git, GitHub, unit testing, pytest, CI, Linux, low latency, FPGA (hardware roles)

### 3.3 QNT weighting

| Dimension | QNT weight | Δ | Rationale |
|---|---|---|---|
| ATS readiness | 10 | −10 | Portals are used, but screening is test-heavy (online assessments within 7 days at Optiver) [S17][S1] |
| Impact | 20 | −5 | Project results matter, but "business impact" framing matters less than rigour |
| Clarity | 20 | 0 | Concise, honest proficiency levels [S15] |
| Relevance | 40 | +20 | Quant academics, competitions, programming and projects are the core signal [S12][S17][S19] |
| UK conventions | 10 | −5 | 1 page and no photo still apply; A-levels are less emphasised than STEM marks or competitions |

---

## 4. CONSULTING (CON-xx)

Covers MBB/tier-2 strategy (McKinsey, BCG, Bain, Oliver Wyman, L.E.K., Kearney) and Big 4 consulting/advisory (Deloitte, PwC, EY, KPMG). Where they diverge, the variants are marked **[MBB]** and **[B4]**.

### 4.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| CON-01 | **Strong academics, stated clearly**. BCG UK states "at least a 2:1 degree or equivalent". Bain asks for "as much detail as possible about your qualifications and grades". McKinsey "requires an excellent academic record". [B4]: PwC dropped its 2:1 requirement, and Deloitte collects GCSE/A-level/UCAS via the form. | RULE: as FCQ-04. [MBB] no grades or a sub-2:1 average gives a critical flag; [B4] major. | critical [MBB] / major [B4] | A | [S24] BCG UK; [S23] Bain London; [S22] TARGETjobs/McKinsey 2025; [S29] PwC; [S31] Deloitte |
| CON-02 | **Leadership with scope and outcome**: positions of responsibility, founding or growing something, leading a team through a challenge. Use "I" not "we". Strong verbs ("deputised", "trained", "organised"), not "did"/"carried out". | HYBRID: leadership lexicon plus "we"-ratio and weak-verb detection (RULE); LLM grades scope (team size, budget, change achieved). | **critical** [MBB]; major [B4] | A | [S22] ("evidence of impact, leadership, entrepreneurship, problem solving"); [S23] ("record of initiative, leadership, and teamwork"); [S24]; [S25] TARGETjobs 2023 |
| CON-03 | **Structured problem-solving evidence**: bullets that show a problem → analysis → recommendation → result arc (e.g. "Diagnosed 18% drop-off by segmenting 2k survey responses; recommended X; adopted, +12% retention"). | LLM: classify each bullet for a problem-solving arc (0–3 elements present). RULE: analytic verbs (analysed, diagnosed, modelled, prioritised, recommended). | major | A | [S21] McKinsey ("strong intellectual abilities and rigor, as well as a practical sense of what works"); [S24] BCG ("quantitative problem-solving"); [S2] (case assessment: structuring, numeracy, judgement, synthesis) |
| CON-04 | **Quantified impact everywhere**: "why your work mattered" and the change you brought about. | RULE: quant density threshold (higher than generic, §7). LLM: outcome vs activity. | **critical** [MBB]; major [B4] | A | [S22] ("why your work mattered"); [S2] ("quantify your outcomes"); [S23] |
| CON-05 | **Entrepreneurial drive / initiative**: started a society, venture, project or fundraiser; went beyond the brief. | LLM; RULE: lexicon (founded, launched, initiated, built, pitched, raised £). | major | A | [S21] (entrepreneurial drive); [S22]; [S23] ("initiative") |
| CON-06 | **Consulting-friendly headings** such as "Leadership/Project Management", "Research", "Employment", "Extra-curriculars". Group related experience (e.g. a "Consulting experience" section first). | RULE: heading detection; accept these as valid headings in the parser. | minor | B | [S2] Cambridge; [S11]-LSE brochure p.17 |
| CON-07 | **Case competitions, consulting societies and pro-bono consulting** (e.g. 180 Degrees Consulting, university consulting groups) with results or deliverables. Firm-run case challenges count. | RULE: keyword bank; LLM checks a deliverable or outcome is stated. | major (penultimate); minor (1st year) | B | [S27] TARGETjobs (societies; 27% of consulting-interested finalists held a society leadership post); [S26]; [S2] (CaseCoach) |
| CON-08 | **Analytical comfort for non-STEM**: humanities students should surface quantitative/qualitative analysis (data handling, source analysis, Excel/SQL, statistics module). | LLM: if the degree is non-quant, look for ≥ 1 analytical evidence bullet. | major | B | [S27] ("comfortable analysing quantitative and qualitative data") |
| CON-09 | **Plain-English clarity**: no jargon-heavy technical descriptions. A generalist partner must understand every line. | LLM: jargon/readability score; RULE: average bullet length ≤ ~25 words, ≤ 2 lines. | major | B | [S22] ("limit any specialist descriptions and technical jargon") |
| CON-10 | **Specific, evidenced extracurriculars and interests** (frequency, level, results; travel quantified). | LLM specificity (see FCQ-09). | minor | A | [S2] |
| CON-11 | **Skills line**: Excel, PowerPoint, data tools (SQL/Python/Tableau/Power BI, valued at [B4] tech consulting), languages. | RULE: keyword bank. | minor | B | [S28] Bright Network ("hard skills (like Excel knowledge)"); [S2] |
| CON-12 | **Firm/role motivation consistency**: CV signals (events attended, relevant electives) align with consulting. Recruiters say many applications fail on weak firm knowledge. This mostly lives in the cover letter or form, but the CV should not contradict it. | LLM (low weight on CV). | minor | B | [S27]; [S2] (attend firm events; "they will have a record you attended") |
| CON-13 | **Red flags**: generic or AI-sounding profile; "we"-only bullets; responsibilities with no results; typos; 2 pages; wrong-firm references; long paragraphs. | RULE + LLM composite (FCQ-05, FCQ-12, CON-02, CON-04). | critical (typos, 2 pages, wrong firm); major (others) | A | [S1][S2][S25][S8] |

### 4.2 CON keyword bank

- **Problem solving** ← problem-solving, structured thinking, hypothesis-driven, MECE, issue tree, root-cause analysis, prioritised, diagnosed, framework, synthesis, recommendation
- **Analysis** ← analysed/analyzed, quantitative analysis, data analysis, market sizing, financial analysis, benchmarking, survey analysis, regression, Excel modelling, SQL, Tableau, Power BI, Python
- **Communication** ← presented, pitched, stakeholder management, client-facing, report, deck, PowerPoint, workshop, facilitated
- **Leadership** ← led, president, chair, captain, founder, co-founded, head of, managed a team of N, mentored, deputised, trained
- **Impact verbs** ← increased, reduced, saved, grew, launched, delivered, improved, raised £, secured, implemented
- **Consulting experience** ← case competition, case study, pro bono consulting, 180 Degrees Consulting, consulting society, strategy project, CaseCoach (prep, low weight), insight day, spring insight
- **Commercial awareness** ← market trends, competitive landscape, business model, growth strategy, M&A, digital transformation, ESG, AI adoption
- **Big 4 specifics [B4]** ← risk advisory, deal advisory, transaction services, tech consulting, audit (if applicable), ACA/ACCA (rare for students), digital, cyber

### 4.3 CON weighting

| Dimension | CON weight | Δ | Rationale |
|---|---|---|---|
| ATS readiness | 15 | −5 | Forms and online tests dominate early screens, especially [B4] [S30][S23] |
| Impact | 35 | +10 | "Why your work mattered", quantified outcomes, leadership and entrepreneurial drive [S21][S22][S23] |
| Clarity | 20 | 0 | Plain English, one page, zero typos [S2][S22] |
| Relevance | 15 | −5 | Firms take any degree and value "experience from anywhere" [S2][S23]. Relevance here means problem-solving evidence, not sector experience |
| UK conventions | 15 | 0 | 1 page, grades, no photo [S2][S24] |

For [B4], shift 5 points from Impact to ATS (Impact 30 / ATS 20), because form-based screening and keyword matching to competencies matter more [S30][S31]. This is a grade D adjustment.

---

## 5. Consolidated weighting table (sum = 100)

| Sector | ATS | Impact | Clarity | Relevance | UK conv. |
|---|---|---|---|---|---|
| Generic baseline (shared) | 20 | 25 | 20 | 20 | 15 |
| FIN: IBD / M&A | 15 | 25 | 20 | 20 | 20 |
| FIN: Markets (S&T) | 15 | 25 | 20 | 25 | 15 |
| FIN: Asset management | 15 | 25 | 20 | 25 | 15 |
| QNT: Trader | 10 | 20 | 20 | 40 | 10 |
| QNT: Researcher/Dev | 10 | 20 | 15 | 45 | 10 |
| CON: MBB/strategy | 15 | 35 | 20 | 15 | 15 |
| CON: Big 4 advisory | 20 | 30 | 20 | 15 | 15 |

All weights are **grade D (synthesis)** from what each sector's sources emphasise. No firm publishes a weighted rubric. Calibrate against real outcomes if Placed collects any.

---

## 6. Severity overrides relative to the GEN rules

| GEN rule | FIN | QNT | CON |
|---|---|---|---|
| GEN-06 typos | critical | major | critical |
| Length > 1 page (FCQ-01) | critical | major | critical |
| GEN-08 summary/objective | minor (allow ≤ 2 lines) | minor (discourage) | minor (discourage; LLM genericness counts more) |
| GEN-09 AI-generic | minor | minor | major |
| GEN-04 quantification | major | major (metrics of models) | critical [MBB] |
| Missing grades (FCQ-04) | critical | major | critical [MBB] / major [B4] |

---

## 7. Year-of-study adjustments

UK structure:
- **Spring weeks/insight programmes** recruit by graduation year: mostly first years on 3-year courses and second years on 4-year courses [S33]. Applications open in about September–December of that year (some close early, most by December) [S7 p.12], and they feed second-year summer internship offers [S7 p.14][S1]. (Aligned with the role playbook, audit 2026-10-18 06#19.)
- **Summer analyst/intern** programmes are for penultimate-year students: GS EMEA [S34], Optiver QT intern [S17]. (Bain London's university hiring is not a penultimate-year programme; see [S23] for eligibility.) Some US-office deadlines open as early as December or January, about 18 months ahead [S7 p.13].
- Many graduate roles are filled from interns [S1][S2], so the penultimate CV is the high-stakes one.

| Rule area | 1st year (spring week / insight / first-year programmes) | Penultimate (summer analyst / internship) | Final year / Master's (grad, off-cycle) |
|---|---|---|---|
| Grades | A-levels/IB with grades are **primary**. University marks so far, or "predicted 2:1/First*". Missing degree marks is acceptable if A-levels are shown [S2][S7] | 1st-year average/% is **required**; 2:1+ expected for FIN/MBB [S24][S7] | Degree classification or current average; A-levels optional if space is tight [S2] |
| Experience expected | None in finance. Part-time jobs, volunteering, school leadership and societies are fully credited [S3][S33] | ≥ 1 of: spring week/insight, internship, finance/consulting society role, competition result. Absence is **major** (FIN/CON) [S9][S7] | Prior internship expected for top schemes; absence is major |
| Commitment signals (FIN-04, CON-07) | minor. Joining societies and attending events is enough | major. Committee role, competition or case-comp outcome expected | major |
| Technical skills (FIN-07, QNT-03) | minor. Excel basics, any programming | major for IBD (modelling/Excel), QR/QD (Python/C++) | major |
| Quant projects (QNT-05) | minor (coursework or a small project is enough) | major for QR, minor→major for QT | major |
| Quantification threshold (bullets with numbers) | ≥ 25% (FIN/QNT), ≥ 30% (CON) | ≥ 40% (FIN/QNT), ≥ 50% (CON) | ≥ 50% / ≥ 60% |
| High-school content | Allowed: school prizes, head student, olympiads | Trim to notable items (olympiad medals, head student) [S2][S12] | Mostly drop, except olympiads |
| Leadership (CON-02, FIN-06) | School/early-university leadership credited | University-level leadership expected for MBB (critical) | Same |
| Length | 1 page (strict) | 1 page (strict) | 1 page (2 only for PhD) [S2] |
| Application format note | Many insight schemes use **forms and tests** rather than CVs, and [B4] insight and contextual schemes use forms [S31][S33]. The UI should flag that CV weight is lower | CV central for banks, MBB, quant | CV central |

Implementation hint:
- Drive the rules from `yearOfStudy`, `courseLength`, `programmeType ∈ {spring, insight, summer, offcycle, grad}` and `sectorVariant ∈ {IBD, S&T, AM, QT, QR, MBB, B4}`.
- Apply a severity step-down (critical→major, major→minor) for first-year spring/insight applications on FIN-04, FIN-07, QNT-05, CON-07.
- FCQ-01 (length) and FCQ-05 (typos) **never step down**.

---

## 8. Detection notes for implementers (grade D)

- **UK grade parser**: First / 1st / 2:1 / 2.1 / Upper Second / 2:2 / percentages (≥70 First, 60–69 2:1); "predicted"/"expected"/"on track for"; A-level grade strings `A\*|A|B…` with subjects; IB `\d{2}/45`; UCAS points. Normalise international GPAs via an LLM step.
- **Leadership lexicon** and "**we**-ratio" (count of "we/our" vs "I/led" in bullets). Above 0.5 triggers a CON-02 warning.
- **Wrong-firm detector**: any named target firm in the profile or objective differs from the job's employer, leading to FIN-12 critical.
- **Generic-interest list**: reading, travelling, socialising, music, films, sports, gym (without specifics). Trigger FIN-08/CON-10 only if no number, level or named activity follows.
- **IMC rule (QNT-04)**: `Microsoft (Word|Office)|MS Word` in the skills section of a QNT CV gives a minor flag.

---

## 9. Sources

Accessed 2026-10-13 unless stated. "Undated" means the page shows no date and I verified it was live.

| Tag | Title | Publisher | Year | URL | Grade |
|---|---|---|---|---|---|
| S1 | Banking & Financial Markets: Short Guide to Recruitment 2025–2026 (PDF) | University of Cambridge Careers Service | 2025 | https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf | A |
| S2 | Management & Strategy Consulting: Quick Guide to Recruitment (PDF) | University of Cambridge Careers Service | 2024 | https://www.careers.cam.ac.uk/files/management_strategy_consulting_-_quick_guide_to_recruitment_2024.pdf | A |
| S3 | Resume Advice: recruiter video transcript (PDF) | Goldman Sachs | undated (live 2026) | https://www.goldmansachs.com/careers/materials/Resume-Advice-Transcript.pdf | A/B |
| S4 | Students: Prepare (process: HireVue, HackerRank for engineering, Superday) | Goldman Sachs | live 2026 | https://www.goldmansachs.com/careers/students/prepare | A |
| S5 | Hints and tips | Barclays | undated | https://search.jobs.barclays/hints-and-tips | A |
| S6 | How we hire | JPMorganChase | live 2026 | https://www.jpmorganchase.com/careers/how-we-hire | A |
| S7 | Inside Knowledge: Careers in Banking and Financial Markets 2025/2026 (PDF; pp.12–14, 22–24, 79–87) | eFinancialCareers (hosted by Imperial College Careers Service) | 2025 | https://www.imperial.ac.uk/media/imperial-college/administration-and-support-services/careers-service/public/resources/efinancialcareers-Careers-in-Banking-and-Financial-Markets-2526.pdf | B/C |
| S8 | How to write a banking CV (Zeno Toulon; quotes from V. McLean, R. Cohen, M. Craven) | eFinancialCareers | 17 Jun 2026 | https://www.efinancialcareers.com/news/the-absolutely-perfect-investment-banking-cv | C |
| S9 | Make your CV stand out for Investment Banking | Bright Network | undated (template 2017) | https://www.brightnetwork.co.uk/career-path-guides/investment-banking/cv-stand-out-investment-banking/ | B |
| S10 | CVs | University of Warwick Careers | undated (live 2026) | https://warwick.ac.uk/services/careers/applications/cvs/ | A |
| S11 | CVs | LSE Careers | undated (live 2026) | https://info.lse.ac.uk/current-students/careers/information-and-resources/application-process/cvs | A |
| S11-LSE brochure | A guide to CVs, cover letters and application forms (PDF, p.17) | LSE Careers | undated | https://info.lse.ac.uk/current-students/careers/Assets/Documents/application-and-cv-brochure.pdf | B |
| S12 | Quantitative finance | University of Oxford Careers Service | 2026 | https://www.ox.ac.uk/careers/careers-guidance/explore-careers/sectors-and-occupations/quantitative-finance | A |
| S13 | Interviewing | Jane Street | live 2026 | https://www.janestreet.com/join-jane-street/interviewing/ | A |
| S14 | Quantitative Trader Internship, London | Jane Street | 2026 posting | https://www.janestreet.com/join-jane-street/position/8474407002/ | A |
| S15 | Recruitment Process (APAC): CV advice | IMC Trading | live 2026 | https://www.imc.com/ap/careers/recruitment-process | A (APAC page; assumed to apply in EU) |
| S16 | How to prepare for an interview at IMC | IMC Trading | undated | https://www.imc.com/ap/articles/how-to-prepare-for-an-interview-at-imc | A/B |
| S17 | Quantitative Trading Internship (2027 Start), Amsterdam | Optiver | 2026 posting | https://www.optiver.com/join-us/jobs/trading/amsterdam/quantitative-trading-internship-2027-start/ | A |
| S18 | Trading Internship Program (programme content; skills listed are what you *learn*, not requirements) | Optiver | live 2026 | https://www.optiver.com/join-us/students/internships/trading/ | B |
| S19 | Our Campus Quantitative Research Interview Process | Citadel Securities | Nov 2024 (mod. Sep 2026) | https://www.citadelsecurities.com/careers/career-perspectives/our-quantitative-research-interview-process/ | A |
| S20 | Quantitative Trading Intern Summer 2027 (New York, US posting) | Flow Traders | 2026 | https://www.flowtraders.com/careers/job-description/8047166 | B (US) |
| S21 | Undergraduate / students pages: personal impact, entrepreneurial drive, inclusive leadership, problem solving | McKinsey & Company | live 2026 | https://www.mckinsey.com/careers/students | B (text from search-indexed excerpts; page render had no extractable text) |
| S21b | Interviewing at McKinsey (AI may polish, not misrepresent) | McKinsey & Company | live 2026 | https://www.mckinsey.com/careers/interviewing | A |
| S22 | Applying to McKinsey & Company: CVs, cover letters and interviews (Jacky Barrett) | TARGETjobs | 19 May 2025 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/applying-mckinsey-company-cvs-cover-letters-and-interviews | B |
| S23 | Bain London: Associate Consultant / university hiring | Bain & Company | live 2026 | https://www.bain.com/careers/recruiting/london-recruiting/ | A |
| S24 | Associate Jobs: United Kingdom | BCG | live 2026 | https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs | A |
| S25 | How to big up your leadership experience on your graduate management CV (Abigail Lewis) | TARGETjobs | 21 Jun 2023 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-big-your-leadership-experience-your-graduate-management-cv | B |
| S26 | 12 skills that consulting recruiters want in graduates (Olivia Rowland) | TARGETjobs | 21 May 2025 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/top-consulting-skills | B |
| S27 | How hard is it to get into consulting… (Abigail Lewis; cites the targetjobs survey) | TARGETjobs | 21 Jun 2023 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-hard-is-it-to-get-into-consulting | B |
| S28 | Consulting CV Template | Bright Network | undated | https://www.brightnetwork.co.uk/career-path-guides/consulting/consulting-cv-template/ | B |
| S29 | PwC removes 2:1 criteria for undergraduate and graduate roles | PwC UK (press release) | metadata 2022 (verify) | https://www.pwc.co.uk/press-room/press-releases/corporate-news/pwc-removes-2-1-criteria-for-undergraduate-and-graduate-roles-to.html | A |
| S30 | Assessment and selection process (Early Careers) | PwC UK | Jul 2026 | https://www.pwc.co.uk/careers/early-careers/applying/assessment-selection-process.html | A |
| S31 | Early Careers Application | Deloitte UK | live 2026 | https://www.deloitte.com/uk/en/careers/early-careers/early-careers-application.html | A |
| S32 | Early careers recruitment in 2025: integrity, inclusion, entry standards (Stephen Isherwood, ISE; ISE Student Recruitment Survey 2025) | Prospects Luminate / Institute of Student Employers | Oct 2025 | https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards | A |
| S33 | What is a spring week, insight day or insight programme? (Abigail Lewis) | TARGETjobs | 2 May 2025 | https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme | B |
| S34 | 2027 Summer Analyst Programme (EMEA): penultimate or final year | Goldman Sachs | 2026 | https://www.goldmansachs.com/careers/students/programs-and-internships/emea/summer-analyst-programme | A (eligibility via search excerpt) |
| S35 | EMEA Early Insight FAQ (legacy, last modified 2016) | Morgan Stanley | 2016 | https://www.morganstanley.com/people-opportunities/emea-early-insight-faq | C (stale) |
| S36 | The perfect graduate CV for investment banking (Sarah Butcher) | eFinancialCareers | 2015 | https://www.efinancialcareers.com/news/graduate-guide/the-perfect-graduate-cv-for-investment-banking | C (old, secondary) |
| S37 | BlackRock EMEA early careers / FAQs ("student of the markets") | BlackRock | live 2026 | https://careers.blackrock.com/early-careers/emea/ | C (search excerpt only; transcript page redirected) |

### Known gaps (to research next if time allows)
- Primary CV guidance from J.P. Morgan, Morgan Stanley (current), HSBC, Citi, Oliver Wyman, EY and KPMG UK. None retrieved.
- Whether UK bank portals (Oracle/Workday/Avature) actually run keyword auto-rejection. No primary evidence either way.
- Mergers & Inquisitions banking template: the page returned 404, so no M&I claims are used. WSO wasn't consulted, by design (secondary).
- Imperial and UCL sector-specific finance CV pages were not individually verified. The Imperial-hosted eFC guide was used instead.
- Firm-hosted trading competitions (names and timing change yearly). Treat the keyword list as a seed, not ground truth.
