# CV Scoring Rules: Tech, Data, Product, Marketing, Research (UK students)

Scope: Software Engineering (SWE), Data/Analytics/ML (DAT), Product Management/APM (PRD), Marketing/Growth (MKT), Research (RES) internships, placements and insight programmes for UK undergraduates.
Compiled: 2026-10-13. Status: research input for the Placed CV scorer. Not legal or recruiting advice.

---

## 0. How to read this document

**Check type**
- `RULE`: deterministic, implementable in code (regex, section parser, counts, keyword match).
- `LLM`: needs model judgement (quality of an outcome, relevance, coherence).
- `HYBRID`: code pre-filters or extracts, LLM grades.

**Severity**
- `critical`: likely to cause rejection at screen on its own.
- `major`: materially weakens the CV against peers.
- `minor`: polish; worth fixing but rarely decisive.

**Evidence strength**
- `A`: an employer's own guidance, or a consistent position across several top-tier UK careers sources.
- `B`: one top-tier source (TARGETjobs, Prospects, Gradcracker, Bright Network, a Russell Group careers service), or employer recruiters at a reported event.
- `C`: practitioner authority (e.g. McDowell) or an inference from industry data (Stack Overflow, GitHub Octoverse) used to set defaults.
- `D`: my own synthesis, with no direct source. Treat as a tunable default.

**Source key** (full list in section 9). Citation tags such as [S1] are used in the tables.

**Honest caveats up front**
1. Most big-tech "official" résumé advice is US-centric ("résumé", 1 page, GPA). UK careers services accept 2 pages. The rules below reconcile the two by sector.
2. Google's "how we hire" page no longer contains detailed résumé guidance; the page is now a navigation hub. The X-Y-Z formula comes from Laszlo Bock (Google's former SVP People Ops), 2014, re-stated by Google recruiters in 2018 and in a 2025 university workshop. It is authoritative but old.
3. I could not retrieve primary résumé guidance from Meta, Palantir, Revolut, Wise, Ocado, Arm or Spotify. Some pages were blocked; others don't exist as public résumé guides. Bloomberg evidence was limited to Glassdoor-type reports, so I excluded it. Monzo's careers blog does say what it values. Treat employer-specific claims beyond Google, Amazon, Microsoft and Monzo as unverified.
4. Several Bright Network and Gradcracker pages returned HTTP 403. Their claims below are taken from search-indexed excerpts of the original pages, so the evidence grade is capped at B.
5. "ATS rejects you automatically" is contested. University of Nottingham Careers (Sept 2026) explicitly says recruiters still make the key decisions. Score ATS readiness as parseability plus keyword alignment, not as "beat the bot".

---

## 1. Cross-sector baseline (applies to all five sectors unless overridden)

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| GEN-01 | Contact details first: name, phone, personal email, LinkedIn URL; GitHub/portfolio where relevant. No photo, date of birth, gender, ethnicity or marital status (UK convention). | RULE: detect a photo/image object, DOB patterns (`\b(DOB|date of birth)\b`, `\d{1,2}/\d{1,2}/(19|20)\d{2}` near the header), and gender/nationality fields. | major (photo/DOB); critical if no email or phone | A | [S3] TARGETjobs 2025; [S5] Prospects 2025 |
| GEN-02 | Single-column, text-based layout with standard headings (Education, Experience, Projects, Skills). Avoid tables and text boxes for core content, skill bars/circles, icons as labels, and headers/footers holding contact info. | RULE: PDF text-extraction sanity check (extracted text ≥ ~90% of the visible words), column detection, image count, heading match. | major | B | [S14] Nottingham Careers 2026; [S15] UK careers service CV guidance (skill bars "subjective and hard to interpret") |
| GEN-03 | Achievement-led bullets, not duty lists. Each experience bullet starts with an action verb and states an outcome. | HYBRID: RULE detects a leading verb and a number; LLM grades whether an outcome exists. | major | A | [S1] Bock/Google; [S4] Amazon 2023+; [S8] Bright Network |
| GEN-04 | Quantify wherever honest (%, £, users, time saved, ranking, dataset size). | RULE: share of bullets containing a digit, %, £/$ or a scale word ("users", "rows", "requests"). Target ≥ 40% of experience and project bullets (tunable, grade D threshold). | major | A | [S1]; [S4]; [S2] |
| GEN-05 | Tailoring: mirror the job advert's essential skills and wording. | RULE: keyword overlap with the job description (with the synonym bank applied); LLM checks that keywords are evidenced and not just listed. | major | A | [S3]; [S12] CIM 2023; [S14] |
| GEN-06 | Zero spelling or grammar errors. | RULE: spell-check with a tech-term allowlist; LLM for grammar. | critical in MKT; major elsewhere | A | [S3]; [S11] TARGETjobs Marketing 2025; [S8] |
| GEN-07 | No exaggeration. Every listed skill should be defensible at interview, and inconsistencies get spotted. | LLM: skills listed with no supporting evidence anywhere in the CV → flag "unevidenced". | major | B | [S3] |
| GEN-08 | Objectives and generic summaries add little. Allow at most a 2–3 line, role-specific profile. | RULE: profile length > 4 lines, or a buzzword density check ("passionate", "hard-working", "team player", "synergy"); LLM checks specificity. | minor | C | [S6] McDowell; [S7] Gradcracker (AI "buzz-word heavy") |
| GEN-09 | AI-written boilerplate reads as inauthentic. Use AI for structure, not content. | LLM: genericness score; RULE: high-frequency LLM clichés ("leveraged", "spearheaded" plus vague objects, "in today's fast-paced"). | minor/major | B | [S7] Gradcracker (employer quote) |
| GEN-10 | Reverse-chronological order within sections. | RULE: parse dates and check that they are descending. | minor | A | [S5]; [S11] |
| GEN-11 | Submit as PDF unless the employer asks otherwise. | RULE: file type. | minor | B | [S2] Google recruiters workshop 2025 |
| GEN-12 | Dates are consistent (e.g. "Sep 2024 – Jun 2025") and expected graduation is shown. | RULE: date-format consistency; detect "expected"/"anticipated" graduation. | minor (format); major (no graduation date for an internship applicant) | D | — |

---

## 2. SOFTWARE ENGINEERING (SWE-xx)

### 2.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| SWE-01 | **Length: 1 page for internships and placements** (strong preference at US-HQ big tech; UK firms accept 2 full pages). Score 1 page as ideal, 2 full pages as acceptable, a 1.3-page "spillover" as a defect, and 3+ pages as a fail. | RULE: page count plus fill ratio of the last page. | major (3+ pages critical) | A (1 page: Google recruiters, McDowell; 1–2 pages: TARGETjobs) | [S2]; [S6]; [S3] |
| SWE-02 | **Section order for students: Education near the top**, then Technical Skills and either Experience or Projects (whichever is stronger first). Google recruiters advise putting Education first. TARGETjobs says no fixed order beyond contact info first, so prioritise what proves capability. | RULE: section index (Education within the first 2 sections → pass). LLM: if the candidate has relevant internships, Experience before Projects; otherwise Projects before Experience. | minor | A | [S2]; [S3]; [S5] |
| SWE-03 | **A Projects section exists, with 2–4 projects** (personal, coursework, hackathon or open source). | RULE: detect the section; count 2–4. Zero projects plus no tech experience → major. | major | A | [S5] Prospects (2–3); [S6] (3–4); [S2]; [S3] |
| SWE-04 | **Each project states its tech stack**, e.g. "Python, FastAPI, PostgreSQL, Docker". | RULE: ≥ 1 keyword-bank term per project entry. | major | A | [S5]; [S3] |
| SWE-05 | **Each project states the candidate's role and scope**: solo or team, what *they* built. For private or closed-source work, describe contributions and impact instead of linking code. | LLM | major | B | [S2]; [S5]; Monzo [S16] |
| SWE-06 | **Each project has an outcome**: users, performance, accuracy, prize or ranking, deployment status, or "used by X society". | HYBRID: RULE finds a number or deployment word ("deployed", "live", "released", "App Store"); LLM confirms it is an outcome and not a spec. | major | A | [S1]; [S2]; [S5] |
| SWE-07 | **GitHub link present** (profile or per-project repo), and/or a portfolio or live demo URL. | RULE: regex `github\.com/[A-Za-z0-9-]+`, `gitlab.com`, or a personal domain. (Optional enhancement: fetch the profile to check it is public and non-empty. Out of scope for an MVP.) | major | A | [S2]; [S3]; [S5] |
| SWE-08 | **X-Y-Z bullets**: "Accomplished [X] as measured by [Y], by doing [Z]". Aim for most experience and project bullets to contain an action (Z) and a measurable result (Y). | HYBRID: RULE detects a number + action verb + tech term in the same bullet; LLM classifies XYZ completeness (0–3 components). | major | A (dated: 2014, re-stated 2018 and 2025) | [S1]; [S2] |
| SWE-09 | **Skills grouped by category**: Languages / Frameworks & Libraries / Tools & Platforms / Databases / Cloud. Order by proficiency or relevance. Text proficiency labels ("Proficient / Familiar") are acceptable, as Google recruiters suggested them in 2025. Graphical bars, stars, percentages or "8/10" are not. | RULE: detect sub-headings or colon-prefixed groups; detect images or bar glyphs (`★`, `●●●○○`, `\d+/10`, `\d+%` next to a skill). | major (bars); minor (ungrouped) | A | [S2]; [S5]; [S3]; [S15] |
| SWE-10 | **Skills list is curated, not exhaustive.** Roughly 8–20 relevant items, not 40 buzzwords. Remove generic office tools (Word, PowerPoint) for SWE roles unless the advert asks for them. | RULE: count the skills tokens; flag > 30, and flag MS Office in SWE mode. | minor | B | [S3] ("relevant to the job, not exhaustive") |
| SWE-11 | **Skills are evidenced**: each core language or framework appears in at least one project or experience bullet. | RULE: cross-reference the skills list against bullet text (after synonym normalisation). Unevidenced share > 50% → flag. | major | B | [S3] (exaggeration risk); [S16] Monzo (deep project discussion at interview) |
| SWE-12 | **"Passion for technology" evidence**: hackathons, tech societies, open source, competitions (e.g. ICPC, UKIEPC, Advent of Code rankings), personal projects, tutoring or TA work. | RULE: keyword detection (hackathon, Devpost, HackLondon, IC Hack, Hack the Burgh, open source, ICPC, Kaggle). | major for 1st years; minor for penultimate years with internships | A | [S3]; [S8]; [S2] |
| SWE-13 | **Version control and engineering practice**: Git, testing, CI, code review, Agile/Scrum. | RULE: keyword bank. | minor | B | [S3]; [S5] |
| SWE-14 | **Soft skills evidenced through tech context** (teamwork on group projects, explaining trade-offs, stakeholders). Part-time non-tech jobs still count. | LLM | minor | A | [S3]; [S8]; [S16] |
| SWE-15 | **Education entry**: university, degree, expected graduation, grade (predicted or achieved 2:1/First, or year average %). Relevant modules are optional (≤ 1 line). A-levels are acceptable for 1st/2nd years in the UK, but GCSE detail is minimal. | RULE: degree + date + grade present. | major (no grade/date) | B (UK grade norms: D inference) | [S5]; [S2] (Google: post-secondary focus, drop high school; adjust for the UK, where A-levels remain common for early-years students) |
| SWE-16 | **Bullet length 1–2 lines**; projects no more than 2–4 bullets each. | RULE: line wrap or characters per bullet (> ~220 chars → flag). | minor | C | [S6] |
| SWE-17 | **Red flags**: (a) tutorial clones presented as original ("To-do app", "Netflix clone") with no extension; (b) a skills list containing languages with no evidence; (c) dead or private GitHub links; (d) "Proficient in HTML" as the headline skill for a SWE role; (e) university email only; (f) "references available on request" eating space; (g) more than 2 colours or a graphic-heavy template. | (a) LLM; (b) RULE (SWE-11); (c) RULE (optional link fetch); (d) RULE; (e) RULE (`\.ac\.uk$` as the only email: minor, since Google recruiters suggest a personal email); (f) RULE; (g) RULE (colour count from the PDF). | minor–major | B/C/D | [S2]; [S3]; [S15] |

### 2.2 SWE keyword bank (canonical ← synonyms)

Weight: core languages and frameworks matter more than tools. Normalise case and punctuation (`c++`, `cpp`). Watch for false positives: "Go" (the verb) and "R" (single letter). Only match these inside the skills section or next to other tech tokens.

- **Languages:** JavaScript ← JS, ECMAScript, ES6 · TypeScript ← TS · Python ← py, Python3 · Java · C++ ← cpp, CPP · C# ← csharp, C sharp, .NET (context) · C · Go ← Golang · Rust · Kotlin · Swift · SQL ← T-SQL, PL/SQL, PostgreSQL (also a DB) · Bash ← shell, shell scripting, zsh · HTML/CSS ← HTML5, CSS3 · Scala · Haskell · OCaml (for quant/Jane Street-type roles) · MATLAB
- **Frameworks and libraries:** React ← React.js, ReactJS · Next.js ← NextJS · Node.js ← Node, NodeJS · Express ← Express.js · Angular · Vue ← Vue.js · Django · Flask · FastAPI · Spring ← Spring Boot · .NET ← ASP.NET, ASP.NET Core · React Native · Flutter · SwiftUI · Jetpack Compose
- **Data stores:** PostgreSQL ← Postgres · MySQL · SQLite · MongoDB ← Mongo · Redis · DynamoDB · Firebase ← Firestore · Supabase · Elasticsearch
- **Cloud and DevOps:** AWS ← Amazon Web Services, EC2, S3, Lambda · GCP ← Google Cloud, Google Cloud Platform · Azure ← Microsoft Azure · Docker ← containers, containerisation · Kubernetes ← K8s · Terraform ← IaC · CI/CD ← GitHub Actions, GitLab CI, Jenkins, CircleCI · Linux ← Unix, Ubuntu · Vercel · Nginx
- **Practice:** Git ← GitHub, GitLab, version control · unit testing ← Jest, pytest, JUnit, TDD · REST ← RESTful, REST API · GraphQL · microservices · distributed systems · Agile ← Scrum, Kanban, sprints · code review · system design · data structures and algorithms ← DSA
- **AI-assisted engineering (2025–26 signal):** LLM ← large language model · OpenAI API · Anthropic/Claude API · RAG ← retrieval-augmented generation · LangChain · vector database ← Pinecone, pgvector
- **Passion signals:** hackathon ← hack, Devpost, MLH, HackLondon, IC Hack, Hack the Burgh, DurHack, OxfordHack · open source ← OSS, pull request, contributor · ICPC ← UKIEPC, competitive programming, Codeforces, LeetCode (weak signal) · Google Summer of Code ← GSoC

Data-driven defaults (grade C): the Stack Overflow 2025 survey's most-used languages are JavaScript 66%, HTML/CSS 62%, SQL 59%, Python 58%, Bash 49% and TypeScript 44%. Its most-used tools are Docker 71%, AWS 43% and Kubernetes 29%; PostgreSQL leads databases at 56% [S17]. GitHub Octoverse 2025 has TypeScript as the #1 language on GitHub by monthly contributors, ahead of Python [S18]. Use these to set the "high-demand" tier of the bank. Don't use them to penalise niche-but-relevant stacks.

### 2.3 SWE weighting vs generic rubric

Generic baseline (assumed): ATS 20 / Impact 25 / Clarity 20 / Relevance 20 / UK conventions 15.

| Dimension | SWE weight | Δ | Rationale |
|---|---|---|---|
| ATS readiness | 20 | 0 | Big tech uses ATS plus keyword search (Workday, Greenhouse). Parseability matters, but keyword-stuffing doesn't help. [S14] |
| Impact | 25 | 0 | X-Y-Z and quantified project outcomes [S1][S4] |
| Clarity | 15 | −5 | Recruiters skim in 15–30 s [S6][S3]; partly captured by length and bullet rules |
| Relevance | 30 | +10 | Projects, stack and GitHub evidence are the primary signal for students [S2][S3][S5]. Includes SWE-03–07, 11 and 12 |
| UK conventions | 10 | −5 | Matters (no photo/DOB) but rarely decisive in tech |

---

## 3. DATA / ANALYTICS / DATA SCIENCE / ML (DAT-xx)

Sub-tracks: **Analyst** (SQL/Excel/BI, business insight), **Data Scientist** (stats, ML, Python), **ML Engineer** (SWE rules plus ML). The scorer should pick the sub-track from the target role title.

### 3.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| DAT-01 | Length and order as SWE-01/02. Education carries more weight: quantitative degree, relevant modules (statistics, probability, linear algebra, ML, econometrics, databases). | RULE: degree-field classifier; relevant-modules line present. | major (no quant evidence for a DS role) | B | [S19] TARGETjobs Data 2026; [S20] RSS (undated) |
| DAT-02 | **Core trio is visible: SQL + Python (or R) + Excel/BI tool** for analyst roles; **Python + stats/ML libraries** for DS. | RULE: keyword presence by sub-track. A missing SQL for an analyst role → major. | major | B | [S19]; [S20] |
| DAT-03 | **Each data project states the dataset, its scale and the source**, e.g. "2.3M-row TfL journey dataset", "Kaggle", "scraped", "NHS open data". | HYBRID: RULE finds row or GB counts and source words; LLM confirms. | major | D (consistent with [S5] and Prospects project guidance) | [S5] |
| DAT-04 | **Each project states the method and the evaluation metric**: models plus a metric (accuracy, F1, AUC, RMSE, MAPE, uplift) and a baseline comparison. "Built a model with 99% accuracy" without a baseline or context is a red flag (likely leakage or imbalance). | HYBRID: RULE finds a metric token; LLM checks that a baseline or context exists and that the claim is plausible. | major | D (my synthesis of standard ML evaluation practice; no CV-specific source found) | — |
| DAT-05 | **Business or decision outcome** (the "so what"): e.g. "insight adopted by society committee; cut event costs 18%" or "dashboard used weekly by 12 staff". Communication with non-technical audiences is a repeatedly cited skill. | LLM | major | B | [S19]; [S20]; [S4] |
| DAT-06 | **Portfolio link**: GitHub with notebooks, Kaggle profile, Tableau Public, Streamlit/Hugging Face Spaces demo. | RULE: regex for github.com, kaggle.com, public.tableau.com, huggingface.co, *.streamlit.app. | major (DS/ML); minor (analyst) | B | [S3]; [S5] |
| DAT-07 | **Competitions** (Kaggle medals or rankings, datathons, Citadel/Correlation One datathons, university datathons) count as achievements. State the rank as a percentile (e.g. "top 8% of 2,100 teams"). | RULE: keyword plus rank or percentile regex. | minor/major | B | [S3] (hackathons and competitions as passion evidence) |
| DAT-08 | **Skills grouped**: Languages / Libraries (pandas, NumPy, scikit-learn, PyTorch) / Data & BI tools (SQL dialects, Power BI, Tableau, Looker) / Cloud & big data (BigQuery, Spark, Databricks, Snowflake) / Statistics (A/B testing, regression, hypothesis testing). | RULE as SWE-09 | minor | A | [S5]; [S3] |
| DAT-09 | **Statistics is named, not implied.** For DS roles, at least one of: hypothesis testing, regression, Bayesian, experimental design, A/B testing, time series. | RULE: keyword | major (DS); minor (analyst) | B | [S20]; [S19] |
| DAT-10 | **Research outputs** (dissertation, poster, arXiv preprint, workshop paper) go in a "Publications/Research" line for ML roles, formatted as a citation. | RULE: detect a publications section or citation pattern (`arXiv:\d{4}\.\d{4,5}`, venue names). | minor (bonus) | B for PhD-level research roles; C for undergraduates | [S21] DeepMind/Google SRP; [S22] Cambridge |
| DAT-11 | **Red flags**: (a) only MOOC certificates and no applied project; (b) "Excel" as the only data skill for a DS role; (c) the Titanic, Iris or MNIST dataset as the headline project with no twist; (d) unexplained metrics; (e) listing every ML algorithm in the skills section. | (a,b,e) RULE; (c) RULE keyword plus LLM; (d) LLM | minor–major | D | — |
| DAT-12 | **GenAI literacy (2025–26)**: LLM APIs, RAG, prompt evaluation, fine-tuning (LoRA). Treat as a bonus only, never a requirement, unless the advert asks for it. | RULE: keyword | minor | C | [S17] (81% of developers use OpenAI GPT models) |

### 3.2 DAT keyword bank

- **Languages:** Python · R ← RStudio, tidyverse, ggplot2 · SQL ← MySQL, PostgreSQL, T-SQL, BigQuery SQL, SparkSQL · Scala · Julia · MATLAB · SAS · Stata (economics) · VBA ← Excel macros
- **Libraries:** pandas · NumPy · SciPy · scikit-learn ← sklearn · PyTorch ← torch · TensorFlow ← TF, Keras · XGBoost ← LightGBM, CatBoost, gradient boosting · statsmodels · Hugging Face ← transformers · spaCy ← NLTK · Matplotlib ← seaborn, Plotly · Polars
- **ML/AI concepts:** machine learning ← ML · deep learning ← DL, neural networks, NN · natural language processing ← NLP · computer vision ← CV (context, to avoid clashing with "CV" meaning résumé) · large language models ← LLM, GenAI, generative AI · reinforcement learning ← RL · RAG · fine-tuning ← LoRA, PEFT · feature engineering · cross-validation · MLOps ← MLflow, model deployment
- **Stats:** A/B testing ← experimentation, split testing, controlled experiments · hypothesis testing ← t-test, chi-squared, p-value · regression ← linear regression, logistic regression · Bayesian · time series ← forecasting, ARIMA, Prophet · causal inference ← difference-in-differences, DiD
- **BI and tools:** Excel ← spreadsheets, pivot tables, XLOOKUP, Power Query · Power BI ← DAX · Tableau ← Tableau Public · Looker ← Looker Studio, Google Data Studio · dbt · Airflow · Spark ← PySpark · Databricks · Snowflake · BigQuery · Jupyter ← notebooks · Git
- **Signals:** Kaggle ← Kaggle Expert, Kaggle medal · datathon · dissertation ← final-year project, FYP · arXiv · NeurIPS/ICML/ICLR (research roles)

### 3.3 DAT weighting

| Dimension | DAT weight | Δ | Rationale |
|---|---|---|---|
| ATS | 20 | 0 | Tool-heavy adverts make keyword alignment important |
| Impact | 25 | 0 | Metric plus business outcome (DAT-04/05) |
| Clarity | 15 | −5 | — |
| Relevance | 30 | +10 | Quant education plus applied projects plus portfolio |
| UK conventions | 10 | −5 | — |

Sub-track tweak: for **Analyst**, move 5 points from Relevance to Impact, since business outcomes matter more than model sophistication. For **ML Engineer**, apply the SWE rules plus DAT-04/06/10.

---

## 4. PRODUCT MANAGEMENT / APM (PRD-xx)

Context caveat (important): **UK entry-level PM roles are scarce.** Most UK PM hires are experienced. Graduate routes exist (e.g. Capital One UK Graduate Product Manager; some big-tech and fintech APM-style or rotational programmes; Google's APM programme is primarily US-based). Many student "PM" applicants should also target business analyst, operations or technology consulting roles. The evidence base here is thinner than for SWE (grade B/C/D at best). I found no UK careers-service guide specific to PM CVs.

### 4.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| PRD-01 | Length: 1 page preferred, 2 pages max. Education first for students. | RULE | major | B | [S2]; [S3] |
| PRD-02 | **Show product ownership end-to-end**: identified a user problem → researched → prioritised → shipped → measured. At least one bullet or project with that arc. | LLM (arc detection: problem, users, action, launch, metric) | major | C | [S23] Capital One/TARGETjobs 2023 (analytical, communication, stakeholder skills); synthesis D |
| PRD-03 | **Product metrics vocabulary used correctly**: DAU/MAU, retention, conversion, activation, NPS, churn, funnel, engagement, CSAT. | RULE: keyword; LLM checks the metric is attached to an outcome. | major | D | — |
| PRD-04 | **User research evidence**: interviews, surveys (with n), usability tests, personas. | RULE: keywords plus `n\s?=\s?\d+` or "interviewed \d+". | major | D | — |
| PRD-05 | **Stakeholder and cross-functional collaboration**: worked with engineers, designers, marketing; led a team or society. | LLM | major | B | [S23]; [S4] (Amazon: emergent leadership) |
| PRD-06 | **Technical literacy without overclaiming**: SQL, basic Python, APIs, Figma, Jira; a shipped side project counts heavily. A tech degree is *not* required (Capital One explicit). | RULE: keyword; no penalty for a non-CS degree. | minor | B | [S23] |
| PRD-07 | **Commercial awareness**: pricing, market sizing, competitor insight, revenue impact. | LLM | major | B | [S24] TARGETjobs top skills |
| PRD-08 | **Founder or builder signals** (start-ups, society apps, hackathon "product lead", Product Hunt launch, consulting society case wins) rank highly. | RULE: keyword | minor/major | D | — |
| PRD-09 | Red flags: (a) "product manager" title inflation for a solo course project; (b) frameworks name-dropped (RICE, Jobs-to-be-Done, AARRR) with no application; (c) no number anywhere; (d) responsibilities-only society roles ("Responsible for social media"). | (a,b,d) LLM; (c) RULE | major | D | [S1] (responsibility vs accomplishment) |

### 4.2 PRD keyword bank
product roadmap ← roadmapping · prioritisation ← prioritization, RICE, MoSCoW · user research ← customer discovery, user interviews, usability testing, UX research · A/B testing ← experimentation · KPIs ← OKRs, north star metric · MVP ← minimum viable product, prototype · go-to-market ← GTM, launch · product requirements ← PRD (document), user stories, acceptance criteria · Agile ← Scrum, sprint planning, backlog · Jira ← Linear, Confluence, Trello · Figma ← wireframes, mockups, prototyping · SQL ← Amplitude, Mixpanel, Google Analytics/GA4 (product analytics) · stakeholder management ← cross-functional · market sizing ← TAM/SAM/SOM · retention ← churn, cohort analysis · conversion ← funnel, activation · DAU/MAU ← daily active users, monthly active users · NPS ← net promoter score

### 4.3 PRD weighting

| Dimension | PRD weight | Δ | Rationale |
|---|---|---|---|
| ATS | 15 | −5 | Smaller pool, more human screening; vocabulary varies |
| Impact | 30 | +5 | PM is judged on outcomes |
| Clarity | 25 | +5 | Communication is a core PM skill, and the CV is the writing sample [S4][S23] |
| Relevance | 20 | 0 | Transferable evidence is accepted; a non-tech degree is fine |
| UK conventions | 10 | −5 | — |

---

## 5. MARKETING / GROWTH (MKT-xx)

### 5.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| MKT-01 | **Experience leads**: the sector "prioritises experience over academia". Put work experience, internships and campaigns before or alongside Education, even for students who have relevant experience. | RULE: section order. If relevant experience exists and Education is first, suggest swapping (minor). | minor | B | [S11] TARGETjobs Marketing 2025 |
| MKT-02 | 1–2 pages; snappy, skimmable bullets; "clear… concise, so it can be read at a glimpse". | RULE: length; bullet length | major | A | [S11]; [S12] CIM 2023 |
| MKT-03 | **Campaign metrics**: reach, impressions, engagement rate, follower growth, CTR, conversion, CPA/CPC, ROAS, sign-ups, open rate, ticket sales; ideally with a timeframe ("in 2 weeks"). | HYBRID: RULE finds a metric token plus a number; LLM checks it is attributable to the candidate. | critical for growth/performance roles; major for brand/comms | A | [S11]; [S1] |
| MKT-04 | **Portfolio or channel links**: LinkedIn, a blog, a portfolio site, society or brand accounts managed, and personal content (TikTok/Instagram/YouTube), *only if active and up to date*. | RULE: URL detection; LLM or manual check for recency (not automatable without fetching). | major | A | [S11]; [S12] |
| MKT-05 | **Self-initiated content counts as experience**: blogs, social channels, volunteering for charities, society marketing roles. | LLM: credit these the same way as paid experience. | major (for 1st years) | A | [S12] CIM |
| MKT-06 | **Certifications**: Google Analytics 4 (Skillshop), Google Ads, HubSpot, Meta Blueprint, CIM qualifications/Marketing Club. Flag "Google Analytics (Universal Analytics)" or "Google Analytics IQ" as outdated: UA was shut down on 1 July 2024. | RULE: keyword; outdated-certification detection. | minor (bonus); minor (outdated flag) | B | [S12]; [S25] Google Analytics Help |
| MKT-07 | **Zero tolerance for typos.** In marketing and PR, spelling and grammar errors are disqualifying because the role *is* communication. | RULE spell-check plus LLM grammar; severity raised to critical. | critical | A | [S11]; [S3] |
| MKT-08 | **Creativity is allowed but must stay parseable.** TARGETjobs permits creative formats (infographic or timeline CVs) for marketing. For large-employer online applications, keep a parseable PDF version. Suggest a "two versions" strategy instead of penalising design outright. | RULE: if images/columns are detected in MKT mode → minor warning only (vs major in SWE). | minor | B (tension between [S11] and [S14]/[S15]; my resolution is D) | [S11]; [S14] |
| MKT-09 | **Commercial and audience understanding**: target audience, positioning, brand voice, budget handled (£). | LLM | major | C | [S12]; [S24] |
| MKT-10 | **Analytics and tools literacy for growth roles**: GA4, Google Ads, Meta Ads Manager, SEO tools (Semrush/Ahrefs), email (Mailchimp/Klaviyo), CRM (HubSpot/Salesforce), Canva/Adobe, Excel. | RULE: keyword | major (growth); minor (brand) | C | [S12] |
| MKT-11 | **Online presence hygiene**: listed profiles must not contain unprofessional content. | Not automatable. Show as a checklist reminder, not a score. | info | B | [S12] |
| MKT-12 | Red flags: (a) "social media savvy"/"creative" with no evidence; (b) follower counts with no timeframe or baseline; (c) listing personal Instagram as a portfolio when it is not marketing-related; (d) generic objective statements. | (a,d) LLM; (b) RULE (number without a time word or baseline); (c) LLM | minor–major | D | — |

### 5.2 MKT keyword bank
digital marketing ← online marketing · social media marketing ← SMM, social media management, community management · content marketing ← content creation, copywriting, blogging · SEO ← search engine optimisation/optimization, keyword research, on-page SEO · SEM ← PPC, paid search, Google Ads, AdWords (legacy term) · paid social ← Meta Ads, Facebook Ads, TikTok Ads, LinkedIn Ads · Google Analytics 4 ← GA4, Google Analytics · email marketing ← Mailchimp, Klaviyo, newsletters · CRM ← HubSpot, Salesforce · marketing analytics ← attribution, campaign reporting, dashboards · growth marketing ← growth hacking, user acquisition, UA (context!), lifecycle marketing, CRO, conversion rate optimisation · brand ← brand strategy, positioning, brand awareness · PR ← press releases, media relations · influencer marketing ← creator partnerships · market research ← consumer insight, surveys, focus groups · KPIs: CTR ← click-through rate · CPA/CPC/CPM · ROAS ← return on ad spend · ROI · engagement rate · conversion rate · CAC/LTV · open rate · tools: Canva · Adobe Creative Suite ← Photoshop, Illustrator, Premiere Pro · Figma · Hootsuite/Buffer/Later · Semrush/Ahrefs · CIM ← Chartered Institute of Marketing, CIM Certificate

### 5.3 MKT weighting

| Dimension | MKT weight | Δ | Rationale |
|---|---|---|---|
| ATS | 15 | −5 | Creative formats are tolerated; agencies screen manually more often |
| Impact | 30 | +5 | Campaign metrics are the core signal [S11] |
| Clarity | 25 | +5 | Writing quality *is* job evidence; typos are critical [S11] |
| Relevance | 20 | 0 | Self-initiated content counts [S12] |
| UK conventions | 10 | −5 | — |

---

## 6. RESEARCH (RES-xx)

Two very different targets:
- **(a) Undergraduate research placements** (UROP, EPSRC vacation internships/bursaries, Nuffield/Wellcome summer studentships, departmental summer research). Applications usually go directly to a supervisor with a short CV and statement. EPSRC internships typically take place in the summer before final year.
- **(b) Industry research internships** (Google DeepMind/Google Student Researcher, Microsoft Research, Meta FAIR). Enrolment in a BSc/MSc/PhD is required; publications are strongly weighted at PhD level.

Undergraduates should *not* send a full multi-page academic CV. Use a 1–2 page "research CV" hybrid. Full academic CV conventions (Cambridge, Imperial) apply mostly to PhD and postdoc applicants. Evidence below is adapted downward. Grade B/C.

### 6.1 Rules

| ID | Rule | Check | Severity | Evidence | Citations |
|---|---|---|---|---|---|
| RES-01 | **Length: 1–2 pages for undergraduates.** Academic-length CVs (3+ pages) are only appropriate with a substantial publication or teaching record. | RULE: page count vs number of publications detected. | major | B | [S22] Cambridge PhD/postdoc CV guide; [S3] |
| RES-02 | **Education first, in detail**: grade or ranking, relevant modules with marks, dissertation/final-year project title and supervisor, prizes and scholarships. | RULE: Education is section 1; dissertation keyword present. | major | A | [S22]; [S5] |
| RES-03 | **A Research Experience section**, separate from Work Experience: project title, lab/group, supervisor, dates, research question, methods, *your* contribution, output. | HYBRID: RULE detects the section; LLM checks the components. | major | B | [S22]; Imperial UROP [S26] |
| RES-04 | **Publications in a consistent citation style**, reverse chronological, with the candidate's name **bolded**. Separate peer-reviewed work from preprints, posters and talks. Never list "in preparation" work as published. Mark "submitted"/"under review" honestly. | RULE: citation regex (authors, year, venue, DOI/arXiv); detect bold-name usage (where the PDF allows); flag "in prep" inside a "Publications" heading. | major (misrepresentation is critical) | A (for academic CVs) | [S22]; [S27] Harvard GSAS CV guide 2025 (US, used for corroboration only) |
| RES-05 | **Peer-reviewed work first**, then preprints, then posters/presentations, then other outputs. | RULE: sub-heading order. | minor | B | [S22] |
| RES-06 | **Methods and technical skills grouped**: lab techniques, statistical methods, software (Python/R/MATLAB/LaTeX), instruments, HPC. | RULE as SWE-09 | minor | B | [S22] |
| RES-07 | **Conferences, posters, talks, reading groups, outreach, and teaching or demonstrating.** | RULE: keyword | minor (bonus) | B | [S22] |
| RES-08 | **Awards, scholarships and funding** (e.g. "EPSRC Vacation Internship 2025", "Dean's List", departmental prize). | RULE: keyword | minor (bonus) | B | [S26]; [S28] EPSRC/Imperial |
| RES-09 | **Referees**: academic placements often require 1–2 academic referees. Include names and contacts if the scheme asks, otherwise omit. | RULE: if the target type is RES-a and no referee section → info prompt only | minor | C | [S22] |
| RES-10 | **For industry ML research internships**: research area keywords, top venues (NeurIPS, ICML, ICLR, ACL, CVPR), a strong programming language (Python/C++), and a GitHub with research code. | RULE: keyword plus link | major | B | [S21] Google/DeepMind Student Researcher |
| RES-11 | Red flags: (a) padded publications (blogs listed as papers); (b) no supervisor or lab named for a research project; (c) vague "assisted with research"; (d) a multi-page CV with no outputs. | (a,b) RULE + LLM; (c) LLM; (d) RULE | major | C/D | [S22] |

### 6.2 RES keyword bank
research assistant ← RA, research intern, summer research student, UROP, vacation internship, vacation bursary, summer studentship · dissertation ← thesis, final-year project, FYP, capstone, MSci project · publication ← paper, preprint, arXiv, journal article, conference paper, proceedings, workshop paper · poster ← poster presentation · literature review ← systematic review · methodology ← experimental design, data collection · statistical analysis ← R, SPSS, Stata, regression, mixed-effects · LaTeX ← Overleaf · MATLAB · Python ← NumPy, SciPy · HPC ← cluster, SLURM · lab techniques (domain-specific: PCR, microscopy, wet lab, cell culture) · peer review · supervisor ← PI, principal investigator · venues: NeurIPS, ICML, ICLR, ACL, EMNLP, CVPR, AAAI, Nature, Science, PRL, IEEE, ACM · funding: EPSRC, UKRI, Wellcome, Nuffield, Royal Society

### 6.3 RES weighting

| Dimension | RES weight | Δ | Rationale |
|---|---|---|---|
| ATS | 10 | −10 | Mostly human (supervisor) screening for UROP-type schemes. Industry research still uses ATS, so raise to 15 for RES-b |
| Impact | 20 | −5 | Outputs matter, but "impact" means research contribution rather than business metrics |
| Clarity | 20 | 0 | — |
| Relevance | 35 | +15 | Academic record, research experience and methods fit with the lab |
| UK conventions | 15 | 0 | Academic conventions (citation style, referees) |

---

## 7. Year-of-study adjustments

UK structure: insight/spring programmes target **first years on 3-year courses (second years on 4-year courses)** [S29]. Summer internships of 8–12 weeks are typically for **penultimate-year** students. **Placement years** of 11–12 months sit inside sandwich degrees [S30]. Google STEP-style first/second-year internships exist (STEP targets 1st/2nd-year undergraduates; its availability in the UK varies by year and is **unverified for 2026–27**, so don't hard-code it).

| Rule area | 1st year (insight / spring / STEP-type / UROP-intro) | 2nd year of 3 (penultimate: summer internship, placement) | Final year / Master's (grad roles, research) |
|---|---|---|---|
| Expected work experience | None required. Part-time, volunteering and societies are fully credited [S3][S8] | 1+ relevant experience *or* 2+ substantial projects expected | Prior internship expected for top schemes |
| Projects (SWE/DAT) | 1–2 projects (coursework counts). Hackathon attendance alone is credited | 2–4 projects with stack plus outcome (SWE-03–06 full severity) | Same, plus dissertation/FYP |
| Quantification threshold (GEN-04) | ≥ 20% of bullets | ≥ 40% | ≥ 50% |
| Education detail | A-levels/IB grades + predicted or 1st-term university results acceptable | First-year average/2:1 or First; A-levels are optional but common | Degree classification; drop A-levels if space is tight |
| GitHub/portfolio (SWE-07, DAT-06) | minor if missing | major if missing | major |
| "Passion" signals (SWE-12) | **major**: main differentiator | major → minor if internship present | minor |
| Length | 1 page strongly preferred (not enough content for 2) | 1 page (tech) / up to 2 (MKT, RES) | 1–2 pages |
| X-Y-Z rigour (SWE-08) | Encourage; partial XYZ (X+Z) accepted | Full severity | Full severity |
| Research (RES) | Show curiosity: modules, reading groups, outreach; UROP pitch to a supervisor | Summer research (EPSRC internships are usually before final year) | Dissertation, posters, preprints |
| Application format note | Many insight schemes use online forms and tests rather than CVs [S29], so CV score matters less. Show this in the UI | CV is central | CV is central |

Implementation hint: let `yearOfStudy` and `courseLength` (3/4/5 years, placement Y/N) set a severity multiplier: 1st year `major→minor` for SWE-07/SWE-03 count; penultimate year uses the defaults.

---

## 8. Consolidated weighting table (sum = 100)

| Sector | ATS | Impact | Clarity | Relevance | UK conv. |
|---|---|---|---|---|---|
| Generic baseline (assumed) | 20 | 25 | 20 | 20 | 15 |
| SWE | 20 | 25 | 15 | 30 | 10 |
| DAT (DS/ML) | 20 | 25 | 15 | 30 | 10 |
| DAT (Analyst) | 20 | 30 | 15 | 25 | 10 |
| PRD | 15 | 30 | 25 | 20 | 10 |
| MKT | 15 | 30 | 25 | 20 | 10 |
| RES (academic placement) | 10 | 20 | 20 | 35 | 15 |
| RES (industry research) | 15 | 20 | 20 | 35 | 10 |

All weights are **grade D (synthesis)**. They are derived from what each sector's sources emphasise, not from a published rubric. Calibrate them against real outcomes if Placed collects any.

---

## 9. Sources

Grade A/B primary or near-primary sources:
- **[S1]** Laszlo Bock, "My Personal Formula for a Winning Resume", LinkedIn Pulse, 2014. Re-stated in: "Google recruiters share the 3-part formula for stronger resumes", CNBC, 2018. https://www.cnbc.com/2018/08/16/google-recruiters-share-the-3-part-formula-for-stronger-resumes.html. Also mirrored in an Inc.com piece hosted by UT Austin Law: https://law.utexas.edu/wp-content/uploads/sites/44/2020/09/Google-Recruiters-Say-Using-the-X-Y-Z-Formula-on-Your-Resume-Will-Improve-Your-Odds-of-Getting-Hired-at-Google-_-Inc.com_.pdf
- **[S2]** "Google Resume Workshop" (Google recruiters at University of Toronto CS), UofT Teaching Labs Ambassadors blog, 2025. https://www.teach.cs.toronto.edu/ambassadors/blog/2025-events/google_resume_workshop (1 page, PDF, Education first, LinkedIn+GitHub, XYZ, text proficiency levels, projects on GitHub, personal email.) *Secondary report of a recruiter talk.*
- **[S3]** targetjobs editorial team, "Tips for a graduate technical CV: template and advice", targetjobs, updated 26 Nov 2025. https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice
- **[S4]** Brittany Bunch, "8 things Amazon recruiters say top job candidates do", About Amazon (Workplace), n.d. (circa 2023–24; date not shown). https://aboutamazon.com/news/workplace/successful-amazon-job-candidates
- **[S5]** Prospects Editor, "Technical CV example", Prospects (Jisc), May 2025. https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/example-cvs/technical-cv-example
- **[S6]** Gayle Laakmann McDowell, *Cracking the Coding Interview* (6th ed., CareerCup, 2015), résumé chapter, and *The Google Résumé* (Wiley, 2011). Talk slides: https://www.slideshare.net/slideshow/cracking-the-coding-interview-master-slide-deck/30274970. **Practitioner authority; dated.**
- **[S7]** Gradcracker Career Centre, "CV and cover letters" (employer advice incl. Experian on AI-generated content). https://www.gradcracker.com/career-centre/career-coach/2/cv-and-cover-letters and https://www.gradcracker.com/hub/872/experian/additional-content/1782/cv-application. *Pages returned 403; claims taken from search-indexed excerpts.*
- **[S8]** Bright Network, "Top 5 tips for writing a great CV for technology applications" and "5 tips to write an internship-worthy CV". https://brightnetwork.co.uk/career-path-guides/technology-it-software-development/top-5-tips-writing-great-cv-technology-applications and https://www.brightnetwork.co.uk/employer-advice/5-tips-to-write-an-internship-worthy-cv. *403; excerpts only.*
- **[S11]** targetjobs editorial team, "Writing a CV for graduate advertising, marketing and PR jobs", targetjobs, 8 Jul 2025. https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/writing-cv-graduate-advertising-marketing-and-pr-jobs
- **[S12]** CIM Scotland, "Help to get your first job in marketing", Chartered Institute of Marketing, 2023. https://regions.cim.co.uk/scotland/home/news/2023/help-to-get-your-first-job-in-marketing
- **[S14]** Bernadette Dooley, "ATS: stop trying to beat the system and focus on what really matters", University of Nottingham Careers and Employability Service, 8 Sep 2026. https://www.nottingham.ac.uk/careers/students/career-insights/ats-stop-trying-to-beat-the-system-and-focus-on-what-really-matters.aspx
- **[S15]** UK university careers CV guidance on skill bars and graphics (e.g. University of Strathclyde Careers CV booklet: https://careers.strath.ac.uk/Portals/63/Documents/CV%20booklet%202020_a_web.pdf; LSHTM careers resource). *Quoted via search excerpt; I didn't verify which document contains the exact "skills bars… subjective" line. Grade B−.*
- **[S16]** Monzo, "Preparing for mobile interviews at Monzo", Monzo blog. https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo (no degree requirement; deep discussion of projects, trade-offs and collaboration.)
- **[S17]** Stack Overflow, "2025 Developer Survey: Technology", 2025. https://survey.stackoverflow.co/2025/technology
- **[S18]** GitHub, "Octoverse: A new developer joins GitHub every second as AI leads TypeScript to #1", GitHub Blog, 28 Oct 2025. https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/
- **[S19]** targetjobs, "Data science & analytics graduate jobs & schemes 2026". https://targetjobs.co.uk/graduate-jobs/it/data. *Listing hub; skills claims are partly drawn from search excerpts.*
- **[S20]** Royal Statistical Society, "Types of job: Data scientist", RSS careers, undated. https://rss.org.uk/jobs-careers/career-development/types-of-job/data-scientist/. *Professional body; content appears dated (Hadoop, Java, C#).*
- **[S21]** Google DeepMind, "Student Researcher Program", 2026. https://deepmind.google/careers/internships/ (BSc/MSc/PhD enrolment; 12–24 weeks; applicants considered across Google AI teams.) *Publication-weighting claims come from job-listing aggregators: grade B−.*
- **[S22]** University of Cambridge Careers Service, "CVs and cover letters for PhDs and postdocs" (CV book). https://www.careers.cam.ac.uk/files/phdpostdoccvbook.pdf. *PhD/postdoc focus; adapted for undergraduates.*
- **[S23]** targetjobs, "What it's really like working as a Graduate Product Manager at Capital One", 2023. https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one
- **[S24]** targetjobs, "The top 10 skills that'll get you a job when you graduate". https://targetjobs.co.uk/careers-advice/skills-for-getting-a-job/what-are-top-10-skills-thatll-get-you-job-when-you-graduate
- **[S25]** Google Analytics Help, "[UA→GA4] Universal Analytics is going away" (UA services turned off from 1 July 2024), last updated 16 Jul 2025. https://support.google.com/analytics/answer/11583528
- **[S26]** Imperial College London, Dept of Aeronautics, "Undergraduate Research Opportunities Programme (UROP)". https://www.imperial.ac.uk/aeronautics/study/ug/current-students/undergraduate-research-opportunities-programme-urop/
- **[S27]** Harvard FAS Mignone Center, "GSAS CVs and Cover Letters", 2025. https://cdn-careerservices.fas.harvard.edu/wp-content/uploads/sites/161/2025/08/gsas-cvs-and-cover-letters-2025.pdf. *US; corroboration only.*
- **[S28]** EPSRC Vacation Internships (via university DTP pages, e.g. Imperial UROP awards above). Timing claim (summer before final year) from search excerpts; verify on the host university page.
- **[S29]** targetjobs, "What is a spring week, insight day or insight programme?". https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme
- **[S30]** targetjobs, "Which IT and technology employers offer summer internships or industrial placements?", updated 13 Jul 2026. https://targetjobs.co.uk/careers-advice/information-technology/which-it-and-technology-employers-offer-summer-internships-or-industrial-placements

### Known gaps (to research next if time allows)
- No verified primary résumé guidance from Meta, Palantir, Revolut, Wise, Ocado, Arm, Spotify or Bloomberg. Search results were Glassdoor or aggregator content, which I excluded.
- No UK careers-service guide specific to PM CVs. PRD rules are mostly grade C/D.
- The Google STEP UK/EMEA intake for 2026–27 is unverified.
- Prospects' academic CV page returned 404, and the Imperial academic CV PDF moved. RES leans on Cambridge's guide.
- Sector weightings are synthesis. Validate with recruiter feedback or outcome data.
