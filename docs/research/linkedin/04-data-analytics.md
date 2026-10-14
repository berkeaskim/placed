# LinkedIn Profile Rules: Data & Analytics (archetype `data_analytics`)

Scope: UK undergraduates and masters students (1st year to final year/MSc) targeting data analyst, data scientist, BI analyst, analytics consulting and insight roles. This covers internships, placements/years in industry, insight days and graduate schemes in the 2026-27 cycle. Example employers: Deloitte (data/AI), ONS and the Government Analysis Function, Ocado Technology, Sky, Lloyds Banking Group and other bank analytics teams, retail/insight firms.
Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.
Rule ID prefix: `LI-DATA_ANALYTICS-xx`.

---

## 0. Conventions and honest caveats

The conventions are the same as `docs/research/cv-rules-finance-consulting.md` §0.

- **Check**: `RULE` (deterministic), `LLM` (one yes/no question with a pass and a fail example), `HYBRID` (code extracts, LLM grades).
- **Input**: which user input can check the rule.
  - `pdf_export`: LinkedIn's "Save to PDF" résumé.
  - `screenshot`: a profile screenshot.
  - `self_report`: the user answers a question or pastes a field.
- **Severity**: critical / major / minor, as in the CV rules.
- **Evidence**:
  - A = the employer's own guidance, or consistent across several top-tier UK sources.
  - B = one top-tier source.
  - C = practitioner or trade press.
  - D = my synthesis.
- **Year keys**: these match `lib/types.ts`: `1st | 2nd | penultimate | final | masters`.

### What the PDF export does and does not contain (important for input tagging)
LinkedIn's help page confirms that Save to PDF exists. It is desktop-only, English-language profiles only, and capped at 200 downloads per month [S1]. The help page **does not list which sections are included**.

From observing typical exports (evidence D, verify against real uploads before shipping), the PDF usually includes:
- Contact block: profile URL, plus any websites you added to Contact Info.
- "Top Skills" (only about 3).
- Languages, Certifications, Honors-Awards.
- Summary (= About), Experience with descriptions, and Education.

It usually **excludes**:
- Photo, banner, Featured, Projects, the full Skills list, endorsements, Recommendations, Activity/posts, Open to Work status and connection count.

So every rule about Featured, the photo, posting or recommendations is `screenshot` or `self_report` only. **This matters more for data than for most sectors**, because the portfolio link (Featured) is the single most sector-specific signal.

### Caveats up front
1. **There is no direct employer evidence that UK data graduate schemes screen LinkedIn profiles.**
   - The employer pages I fetched describe the following and none of them mention LinkedIn, GitHub or portfolios:
     - Lloyds Data Science & AI scheme [S9]: a technical assessment, "Python coding experience, knowledge of SQL and the ability to use statistical modelling techniques as this will form a part of the assessments".
     - Sky Data & Analytics [S10]: "curious about data and enjoy solving puzzles", any discipline.
     - Ocado: a numerate background.
   - Civil Service analytical routes use name-blind sifts. The Civil Service committed to removing the name and "the university they attended" [S11]. A LinkedIn profile is irrelevant to the formal sift there.
   - **Conclusion:** for big graduate schemes, LinkedIn is a *sourcing and networking* asset plus a *portfolio hub*, not a screening gate. Placed should say this plainly in the UI.
2. **Where LinkedIn genuinely matters in data:**
   - **Sourcing**: LinkedIn says skills on the profile improve "likelihood to be found in others' searches" [S2]. Its Economic Graph research says workers who add skills "find jobs faster" [S3]. That is LinkedIn's own research, so there is a conflict of interest; grade B.
   - **Networking**: LSE Careers tells data students to research people in roles using the "LinkedIn alumni finder" [S5].
   - **Second look**: an interviewer or hiring manager clicks through to GitHub, Tableau Public or Kaggle. This is practitioner consensus (C), not employer-documented.
   - SMEs, start-ups, analytics consultancies and agency recruiters (e.g. GTI, quoted in TARGETjobs [S6]) lean on LinkedIn more than large schemes do.
3. **The portfolio matters more than the profile.**
   - LSE says a GitHub profile is "standard practice in the sector" [S5].
   - Prospects says to "build a small portfolio using open datasets" [S7] and that Kaggle-type competitions "can help you gain visibility and experience" [S8].
   - The LinkedIn profile's job is to **route a reader to that evidence in one click**.
4. **Photo statistics are inconsistent, even within LinkedIn's own pages.**
   - The LinkedIn Help "good profile" page says "up to 2X more profile views" [S2b].
   - A 2024 LinkedIn Talent Blog article says "14 times more likely to be viewed" [S12].
   - The widely repeated "21x more views / 9x more connection requests" has no primary source I could reach. The current LinkedIn photo help page contains no statistic [S2c].
   - **Treat 21x as an unverified myth.** If a number is shown in the UI, use LinkedIn's own conservative "up to 2X" and cite it.
5. **Open to Work "2x recruiter messages" / "40% more InMails"** (LinkedIn blog, Oct 2020) appeared only in search snippets. The blog URL now redirects and I could not verify it. The LinkedIn help page on Open to Work has no statistic [S13]. Treat it as unverified.
6. **Much of the "data analyst LinkedIn" advice online is US bootcamp marketing** (Ironhack, Noble Desktop, Coursera, Dataquest). I used it only to cross-check what is common practice (C at best) and never as a source for a number.
7. **The "recruiters skim GitHub for 90 seconds" and "3-5 projects is the sweet spot" figures** come from SEO blogs with no study behind them. Use them as UX heuristics (D), not facts.

---

## 1. How much LinkedIn matters for this sector

| Function | Importance | Evidence | Notes |
|---|---|---|---|
| **Screening** (does a recruiter look at it to decide on your application?) | **Low** for large graduate schemes; **medium** for SMEs, start-ups and analytics consultancies | B (absence across employer pages [S9][S10][S11]) / C | Large schemes run on forms, numerical/technical tests and assessment centres. Lloyds tests Python, SQL and stats directly [S9]. Civil Service sifts are name-blind [S11]. |
| **Sourcing** (recruiters finding you) | **Medium** | B [S2][S3][S6] | Agency and in-house recruiters search by skill keywords, degree, institution and location [S6]. TARGETjobs reports that completeness affects search priority [S6]. This is plausible but is LinkedIn-ecosystem lore; I could not confirm it in LinkedIn's own help. |
| **Networking / research** | **High** | A [S5][S14][S6] | LSE: use the alumni finder [S5]. Imperial: personalise connection notes and research alumni [S14]. Data teams are often reached through alumni at Deloitte, Sky, banks and ONS. |
| **Portfolio hub** | **High** (sector-specific) | A/B [S5][S7][S8] | GitHub is "standard practice" [S5]. A portfolio built from open datasets is recommended [S7]. Kaggle gives visibility [S8]. LinkedIn is where the links live. |
| **Posting / thought leadership** | **Low, near neutral** | D | No employer source rewards student posting in data. Occasional project write-ups are a mild positive. Hot takes and AI slop are a mild risk. |

**Overall: medium.** It is less critical than for marketing/growth or recruiter-led roles. It is more useful than in quant, because data hiring managers do click through to work samples.

### What named firms/sources say

| Firm / source | What they say | Mentions LinkedIn? |
|---|---|---|
| Lloyds Banking Group, Data Science & AI scheme [S9] | Python, SQL and statistical modelling, all assessed; no minimum degree class | No |
| Sky, Data & Analytics graduate programme [S10] | Curious, analytical, clear communicator; any discipline | No |
| Civil Service (GSS / analytical Fast Streams) [S11] | Name-blind; Success Profiles | No (formal sift ignores it) |
| Deloitte UK | Could not retrieve an official UK data-careers page. Third-party aggregators list Power BI/SQL/Python. Deloitte is in Google's certificate consortium [S16]. | Unverified |
| Ocado Technology | Search snippets mention a numerate/CS background and a rotation into Data. Official page not fetched. | Unverified |
| LSE Careers, data sector page [S5] | GitHub standard, SQL/Python/R, Tableau/Power BI, cloud, Coursera/edX/DataCamp certs, Kaggle, alumni finder | Yes (networking) |
| Prospects: data analyst [S7] / data scientist [S8] | Portfolio on open datasets; Kaggle/Topcoder; RSS and BCS professional routes; "use LinkedIn and careers fairs" for networking | Yes (networking, vacancies) |
| TARGETjobs, graduate LinkedIn guide, 2026 [S6] | Headline formula, 5-10 skills, list beginner coding skills, I-statements, modules and dissertation in Education | Yes (generic) |

---

## 2. What a strong data profile looks like, section by section

### 2.1 Headline (220 chars; roughly the first 60-70 show in search and comment cards. The limits come from third-party documentation, not verified in LinkedIn help: D/C)
Formula: **[Degree + University + year/stage] | [target role] | [2-4 concrete tools] | [one proof point]**. Put the target role and tools in the first ~70 characters, because those are the search keywords.

TARGETjobs' generic formula (studies + interests + what you're seeking) [S6] is consistent with this; the data twist is to name **tools**, not traits.

Good:
1. `Maths & Stats @ UCL (2nd yr) | Aspiring Data Analyst | SQL · Python (pandas) · Power BI | Seeking 2027 summer internship`
2. `MSc Business Analytics, Warwick | Data Scientist (grad 2027) | Python · scikit-learn · SQL · AWS | Kaggle Expert`
3. `Economics @ Manchester | Insight & Analytics placement 2027-28 | Excel · SQL · Tableau | Built NHS A&E wait-time dashboard`

Bad:
1. `Student at University of Leeds`: no role, no tools, invisible in skill search.
2. `Passionate data enthusiast | Aspiring | Hardworking | Lifelong learner 🚀`: all traits, no tools, no proof, emoji noise.
3. `Data Scientist | AI Expert | Machine Learning Engineer | Python Guru`: claims job titles the student has never held. Recruiters notice, and it contradicts the Education section (see §3, misrepresentation).

### 2.2 About (2,600 chars max; about 300 show before "see more")
- **Structure:**
  - **Hook line**: who you are + target role.
  - **What you analyse and with what**: tools in context.
  - **2-3 proof points**: a project or work result with a number and a link.
  - **What you're looking for and when**: an internship/placement/grad role and its start date.
  - **Contact line**.
- **Length:** 600-1,300 characters is enough for a student (D). TARGETjobs: introduce yourself as you would at a networking event and mention notable projects [S6]. LinkedIn: "one to two paragraphs or using bullet points" [S2b].
- **Data-specific:** name the **question → data → method → result** chain for at least one project. Prospects frames portfolio work exactly this way: "defined a question, cleaned the data, chose an analytical method and communicated the result" [S7].
- **Avoid:** "passionate about data", "data-driven", "turning data into insights" with nothing behind them, and buzzword chains. Imperial: "be genuine and truthful" [S14].

### 2.3 Experience
- **How it differs from CV bullets:**
  - Write in first person ("I built…"), which TARGETjobs recommends [S6].
  - Use 2-4 bullets per role.
  - Context can be slightly fuller, but outcomes still need numbers.
  - Each role gets the **Skills** tags LinkedIn lets you attach (D: a feature, not evidenced).
- **Non-data jobs** (retail, hospitality, tutoring) should surface any data or quant angle, e.g. "Reconciled weekly stock counts in Excel; flagged £1.2k variance". Do not invent analysis that didn't happen.
- **Projects can count.** Use the Projects section, or a self-employed "Independent data projects" entry if the student has no relevant experience. Each needs a **link** (GitHub/Tableau Public/Kaggle notebook).
- TARGETjobs quotes recruiter Simon Katchay (GTI): "Talk about your responsibilities, achievements and results" [S6].

### 2.4 Featured (screenshot / self_report only)
**The highest-leverage section for this sector.** LinkedIn describes Featured as giving "quick access to your work portfolio" [S2b]. Ideal set:
1. **GitHub** repo or profile with a README explaining the question and result. LSE calls GitHub "standard practice" [S5].
2. **One dashboard**: Tableau Public / Power BI publish-to-web / Looker Studio. Tableau Public also has a "Hire Me" flag searchable by hiring managers (vendor claim, C).
3. **One write-up**: a Medium/Substack post, LinkedIn article or PDF of a 1-page findings memo, which shows communication. Prospects and Sky both stress explaining findings to non-technical audiences [S7][S10].
4. Optional: a Kaggle notebook or competition placement.

Order: best work first. Two to four items. Never feature a certificate badge as the *only* item.

### 2.5 Skills: top 10 for data_analytics

| # | Skill | Tier | Why |
|---|---|---|---|
| 1 | SQL | **Table-stakes** | Prospects: SQL is core [S7]; Lloyds assesses it [S9]; LSE names SQL as the primary query language [S5] |
| 2 | Python (pandas/NumPy) | Table-stakes for DS, near table-stakes for DA | [S5][S8][S9] |
| 3 | Microsoft Excel (advanced: pivot tables, lookups, Power Query) | Table-stakes for DA/BI/consulting | [S7] |
| 4 | Data visualisation: Power BI **or** Tableau | Table-stakes for DA/BI | [S5][S7] |
| 5 | Statistics / statistical modelling (regression, hypothesis testing) | Table-stakes for DS; differentiator for DA | [S9] |
| 6 | Data cleaning / data wrangling | Table-stakes (state it explicitly; recruiters search it) | [S7] |
| 7 | R | Differentiator (strong for ONS/GSS, pharma, academia-adjacent) | [S5][S8] |
| 8 | Machine learning (scikit-learn) | Differentiator for DA; table-stakes for DS | [S5][S8] |
| 9 | Cloud data platform (BigQuery/GCP, AWS, Azure, Snowflake, Databricks) | Differentiator | [S5]; Lloyds trains on GCP [S9] |
| 10 | Data storytelling / stakeholder communication | Differentiator that is often under-listed | [S7][S10] |

Also acceptable: Git, dbt, Looker, A/B testing, Spark, GIS.
- TARGETjobs suggests listing 5-10 key skills and including beginner-level ones: "Even if you're not an expert in a skill (such as a coding language), it's worth putting on your profile" [S6]. That conflicts slightly with the CV rule against claiming what you can't defend (FCQ-11).
- **Resolution:** list it, but every skill in the top 5 must be evidenced somewhere on the profile (Experience, Projects or Featured).
- Only the top ~3 skills reach the PDF export, so **pin SQL/Python/visualisation as Top Skills**.

### 2.6 Certifications: worth listing vs noise

| Worth listing | Notes |
|---|---|
| Microsoft PL-300 Power BI Data Analyst Associate | Proctored, vendor-recognised. Strong for BI/consulting. (C) |
| Google Data Analytics Professional Certificate | Covers "sheets, SQL, R. and Tableau" [S15]. UK consortium members include BBC, BT, Deloitte and John Lewis, who agreed to "consider" holders (2022) [S16]. Useful for 1st/2nd years and career-changers; weak signal for MSc students. |
| Tableau Desktop Specialist / Certified Data Analyst | Moderate (C) |
| AWS Cloud Practitioner / AWS or Azure data certs (e.g. Azure DP-900) | Differentiator for data engineering-leaning roles (C) |
| Databricks / Snowflake fundamentals | Niche, positive for analytics engineering (D) |
| RSS Data Analyst professional status / BCS | Prospects names these professional routes [S7]. Rare for students; strong signal if held. |

**Noise:**
- Generic "Introduction to Data Science" MOOCs, LinkedIn Learning completion badges, Udemy courses under 10 hours.
- More than about 6 certifications listed: this reads as collecting rather than doing (D).
- Expired or unverifiable certifications.
- Certifications in tools never used in any project.

LSE treats Coursera/edX/DataCamp as legitimate learning [S5]. The rule is not "certs are bad" but "a cert without a project is weak."

### 2.7 Education
- List the degree, university and expected graduation year. Give the **grade if 2:1 or above**, or a year average (e.g. "Year 1: 68%"). This mirrors CV rule FCQ-04, softened: Lloyds has no minimum class [S9] and Sky accepts any discipline [S10].
- **List 3-6 quantitative modules** (Statistics, Econometrics, Machine Learning, Databases, Operational Research). Name the dissertation topic if it is data-heavy. TARGETjobs recommends modules and dissertation details for differentiation [S6].
- A-levels: optional on LinkedIn (D). Maths/Further Maths is a minor plus.

### 2.8 Activities and societies
Data Science Society, Women in Data, hackathons (e.g. a university datathon), Kaggle teams, Code First Girls, student consultancy projects with data deliverables. Committee roles with numbers ("ran 6 Python workshops for 120 members") beat membership lists (D, consistent with FCQ-09).

### 2.9 Recommendations
Nice-to-have. A recommendation from a placement manager or project supervisor that names a concrete analysis is a mild plus. TARGETjobs says recruiters value recommendations and give endorsements "minimal" attention [S6]. **Do not penalise students with zero recommendations** (severity: minor, and skipped for 1st/2nd year).

### 2.10 Activity / posting norms
- **Neutral, with a mild positive** for occasional (about monthly) posts that share a finished project with a chart and one insight. Event attendance posts are neutral.
- **Risks**:
  - AI-generated "10 Python tricks" posts.
  - Engagement-bait.
  - Sharing confidential employer data or screenshots from an internship. This is a real risk in analytics: client and customer data are sensitive.
  - Political arguments (Imperial advises avoiding controversial discussions [S14]).
- No source shows that students who don't post are penalised (D).

### 2.11 Photo and banner
- **Photo**:
  - Clear head-and-shoulders, approachable, not passport-style or a party photo [S6]. LinkedIn: a photo "increases the credibility of your profile" [S2c].
  - Use LinkedIn's "up to 2X" figure [S2b]; do not use 21x (see §0).
  - Note the tension with the UK CV no-photo norm: a LinkedIn photo is expected, while a CV photo is not.
- **Banner**: the default blue is fine (minor). A good data-specific banner is a clean screenshot of the student's own dashboard or chart, or university branding. Avoid stock "binary code" or "matrix" images (D).

---

## 3. Sector-specific red flags and myths

**Red flags**
1. **Inflated titles.** "Data Scientist" or "ML Engineer" in the headline or Experience for coursework. It contradicts Education and fails the interviewer's click-through (LLM check).
2. **Skill lists with no evidence.** 30+ skills (TensorFlow, Spark, Hadoop, Kubernetes) with no project using them. Interviewers probe this (FCQ-11 logic).
3. **Tutorial-dataset portfolio only** (Titanic, Iris, MNIST, house prices) presented as original work. Practitioners widely report these read as course completion (C).
4. **Broken or private links**: a GitHub repo set to private, a 404 Tableau link, or a repo with no README.
5. **Certificate stacking.** Eight or more MOOCs with no Experience or Projects.
6. **Confidentiality breach.** Featured or posts show internal dashboards or customer data from an internship employer.
7. **CV ↔ LinkedIn mismatch** on dates, titles or grades. This is especially visible to data people.
8. **"Open to Work" frame**: no reliable evidence either way. The helpful stats are unverified (§0) and the stigma claims are anecdotal (C). Recommend the **recruiters-only** setting, which LinkedIn offers [S13] and which gets the sourcing benefit without the frame.

**Myths**
- "21x more views with a photo." Unverified; LinkedIn's own pages say 2X or 14x (§0).
- "Recruiters look at your Kaggle rank." No UK employer source. Kaggle helps with *visibility and experience* [S8], but no employer I found states a tier threshold. Only a top-tier result (Expert+ or a medal) is worth a headline mention.
- "A Google certificate gets you hired." The consortium members only agreed to *consider* holders [S16]. Big schemes test skills directly [S9].
- "You must post to be noticed." Not supported for data roles (D).
- "Endorsements matter." TARGETjobs reports minimal recruiter attention [S6].
- "Tailor LinkedIn to each application." TARGETjobs advises against per-role tailoring of LinkedIn [S6]. Tailor the *archetype* (data), not the employer.

---

## 4. Differences by year

| Year | Realistic goal | What to emphasise | What is fine to be missing |
|---|---|---|---|
| **1st** | Insight days, first-year programmes, societies | Headline with degree + "aspiring data analyst" + 1-2 tools. Education with modules. One starter project (even a guided one, labelled honestly). Society memberships. | Experience in data, recommendations, Featured beyond one item, certifications beyond one |
| **2nd / penultimate** (main internship and placement year) | Summer internships, years in industry | 2-3 original projects linked in Featured. Top skills pinned. Quantified Experience. One cert if it fills a gap (e.g. PL-300, or Google DA for non-STEM). About section with an availability date. | Recommendations (nice-to-have), posting |
| **Final** | Grad schemes, return offers | Internship outcomes with numbers. Any placement recommendation. Dissertation if data-heavy. Headline states the grad start year. | Posting |
| **Masters (1-year MSc)** | Grad schemes on a compressed timeline, often via sourcing | MSc programme + modules + dissertation/thesis topic in the headline and About. Prior experience reframed. A portfolio is near-mandatory because the CV history may be non-data. Beginner certs (Google DA) can **look junior**; downweight them. | Undergraduate societies |

---

## 5. Sector rule set (overrides / additions to the generic LinkedIn baseline)

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-DATA_ANALYTICS-01 | **Headline names a data target role or function** (data analyst/scientist, BI, analytics, insight, data engineering) or a quantitative degree **and** at least 2 concrete tools (SQL, Python, R, Excel, Power BI, Tableau, etc.). | HYBRID: regex for the role lexicon + tool lexicon in the headline; LLM if ambiguous. Q: "Does the headline state a data-related target role/degree AND at least two named tools?" Pass: `Stats @ UCL \| Aspiring Data Analyst \| SQL · Python · Power BI`. Fail: `Student at UCL \| Hardworking and passionate`. | pdf_export (headline appears under the name), screenshot | major | 1st: minor (1 tool ok) | B/D | [S6]; [S2] |
| LI-DATA_ANALYTICS-02 | **Headline does not claim job titles the user hasn't held** (e.g. "Data Scientist" with no data role in Experience). "Aspiring", "Student" or "Incoming X Intern at Y" are fine. | HYBRID: extract titles from the headline and compare with Experience titles; LLM confirms. Q: "Does the headline present the person as holding a data job title not supported by their Experience section?" Pass: `Incoming Data Analyst Intern @ Sky (Summer 2027)` with a matching offer. Fail: `Data Scientist \| ML Engineer` when Experience shows only a retail job. | pdf_export | major | all years | C/D | [S14] ("genuine and truthful"); FCQ-11 logic |
| LI-DATA_ANALYTICS-03 | **SQL is listed as a skill** and appears in the top 3-5 pinned skills for DA/BI targets. | RULE: "SQL" (or a dialect: PostgreSQL, MySQL, T-SQL, BigQuery) in Top Skills / Skills / About. | pdf_export (Top Skills), screenshot (full list) | major | 1st: minor | A | [S5]; [S7]; [S9] |
| LI-DATA_ANALYTICS-04 | **At least one of Python or R is listed**, and at least one visualisation/BI tool (Power BI, Tableau, Looker, Excel charts) is listed. | RULE: lexicon match across Skills/About/Experience. | pdf_export, screenshot | major | 1st: minor | A | [S5]; [S7]; [S8] |
| LI-DATA_ANALYTICS-05 | **Top skills are evidenced**: each of the top 5 skills appears in at least one Experience, Project or About description that shows it in use. | HYBRID: for each top skill, search the description text; LLM judges usage vs a bare mention. Q: "For each of the top 5 skills, is there a sentence showing the user applied it to a task?" Pass: Skills "SQL" + a project bullet "Wrote SQL joins across 3 ONS tables…". Fail: Skills "TensorFlow, Spark, Hadoop" with no description mentioning any of them. | pdf_export | major | 1st: minor | B/C | [S6]; FCQ-11 |
| LI-DATA_ANALYTICS-06 | **Skills list is focused**: 8-30 skills, and less than about a third are non-data generic traits ("Teamwork", "Microsoft Word"). | RULE: count + generic-skill blacklist. | screenshot, self_report (full list not in the PDF) | minor | none | C/D | [S6] (5-10 key skills) |
| LI-DATA_ANALYTICS-07 | **Portfolio link present and reachable**: at least one link to GitHub, Tableau Public, Kaggle, Power BI web, Observable/Streamlit or a personal site, in Featured, Contact Info websites, About or Projects. | RULE: URL regex for known hosts in the PDF contact block/About; for Featured, a screenshot or a pasted URL; optional HTTP 200 check of the user-supplied URL (not LinkedIn). | pdf_export (Contact websites, About), screenshot (Featured), self_report | **critical** (penultimate, final, masters); major (2nd); minor (1st) | see severity | A | [S5] ("standard practice in the sector"); [S7]; [S8]; [S2b] |
| LI-DATA_ANALYTICS-08 | **At least one project follows question → data → method → result**, with a number or decision in the result. | LLM. Q: "Is there a project description that states the question asked, the data used, the method applied and a concrete result?" Pass: "Asked whether A&E waits rose after 2022; merged NHS England monthly data (3.2m rows) in SQL; regression; waits rose 14% in winter months; dashboard on Tableau Public." Fail: "Data analysis project using Python and pandas." | pdf_export (About/Experience/Projects text where present), self_report | major | 1st: minor | A | [S7]; [S10] |
| LI-DATA_ANALYTICS-09 | **Portfolio isn't only tutorial datasets.** Featured or project work is not solely Titanic/Iris/MNIST/Boston-housing-style datasets. | HYBRID: lexicon of tutorial datasets; LLM confirms if all projects match. Q: "Are all listed projects based on standard tutorial datasets with no original question?" Pass: a project on TfL bike-hire data asking about weather effects. Fail: "Titanic survival prediction", "Iris classification" only. | pdf_export, screenshot, self_report | minor (1st, 2nd); major (final, masters) | as stated | C | Practitioner consensus (bootcamp/blog sources, §0.6) |
| LI-DATA_ANALYTICS-10 | **Communication evidence exists**: at least one item (Featured write-up, About sentence, Experience bullet) shows presenting or explaining findings to non-technical people. | LLM. Q: "Does the profile show the user communicating data findings to a non-technical audience?" Pass: "Presented churn findings to 4 store managers; recommendation adopted." Fail: only technical tool lists. | pdf_export, screenshot | major | 1st: minor | A | [S7] ("data storytelling"); [S10] ("make complex ideas simple") |
| LI-DATA_ANALYTICS-11 | **Education lists quantitative modules and/or a data-heavy dissertation**, plus a grade/average if 2:1+ or equivalent. | HYBRID: regex for module lexicon (statistics, econometrics, machine learning, database, probability, operational research) + grade regex; LLM for non-UK systems. | pdf_export | major (non-quant degree); minor (quant degree) | 1st: minor | B | [S6]; [S9] (no minimum class; so not critical) |
| LI-DATA_ANALYTICS-12 | **Certifications are signal, not noise**: at most about 6 listed; if more than 3, at least one is a proctored/vendor cert (PL-300, Tableau, AWS/Azure/GCP) or tied to a project; none expired. | RULE: count + recognised-cert lexicon + expiry date parse. | pdf_export (Certifications), screenshot | minor | masters: Google DA alone does not count as a differentiator | C | [S15]; [S16]; [S5] |
| LI-DATA_ANALYTICS-13 | **Non-data jobs show a data/quant angle where truthful**: for retail/hospitality/tutoring roles, at least one bullet mentions a number, a tool or a process improvement. | LLM. Q: "For non-data roles, does at least one bullet show numeracy, a tool or a measurable improvement?" Pass: "Tracked weekly waste in Excel; cut over-ordering 10%." Fail: "Served customers and handled the till." | pdf_export | minor | 1st, 2nd: minor; final/masters: skip if relevant data experience exists | B/D | [S6] (responsibilities, achievements, results) |
| LI-DATA_ANALYTICS-14 | **No confidential data exposed**: Featured items, posts and screenshots don't show employer/client dashboards, customer records or internal metrics. | LLM on a screenshot. Q: "Does any visible item appear to show internal company data or customer information?" Pass: a dashboard built on public ONS data. Fail: a screenshot titled "Q3 internal sales dashboard - [Employer]". | screenshot | **critical** when triggered | all years | D (professional norm; GDPR context) | none (synthesis) |
| LI-DATA_ANALYTICS-15 | **About section (if present) is specific**: names a target role, 2+ tools in context, and at least one result; at most 2 clichés from the bank ("passionate about data", "data-driven", "turning data into insights", "lifelong learner"). | HYBRID: cliché regex + LLM. Q: "Does the About section give a target role, tools used in context and at least one concrete result?" Pass: see §8 improved About. Fail: "Passionate, data-driven student eager to turn data into actionable insights." | pdf_export (Summary) | major (penultimate+); minor (1st) | as stated | B | [S6]; [S2b]; [S14] |
| LI-DATA_ANALYTICS-16 | **Networking footprint for target employers**: the user reports at least 5 connections at, or alumni in, target data teams, or has joined the university's data society/alumni groups. | self_report (Placed asks). Not scored from the PDF. | self_report | minor (advice only; weight 0 in the score, shown as a tip) | 1st: tip only | A | [S5]; [S14] |
| LI-DATA_ANALYTICS-17 | **Open to Work is set to recruiters-only** (if the user is job-seeking) rather than absent or framed. | self_report. Advice only. | self_report, screenshot (frame visible) | minor (tip, no penalty for the public frame) | none | B (feature) / unverified (stats) | [S13] |
| LI-DATA_ANALYTICS-18 | **Posting is optional; if posts exist they share real work** and contain no AI-generic "tips" content. | LLM on pasted or screenshot posts. Q: "Are recent posts about the user's own projects/learning rather than generic tips or engagement bait?" Pass: "I mapped London bike-hire demand vs rainfall; 3 takeaways + link." Fail: "🚀 10 Python tricks every data analyst MUST know 👇". | screenshot, self_report | minor | none; never penalise zero posts | D | none |

**Baseline overrides (vs the generic LinkedIn baseline)**

| Baseline dimension | Override for data_analytics |
|---|---|
| Featured | Raise from minor to **critical/major by year** (via -07) |
| Skills | Raise; the specific must-haves are SQL + Python/R + BI (via -03/-04/-05) |
| Recommendations | Lower; minor, skipped for 1st/2nd year |
| Activity / posting | Lower; weight is minimal, only negative signals count |
| Photo / banner | Keep the baseline (photo minor-major; banner minor) |
| CV consistency | Keep the baseline; titles and skills consistency is emphasised via -02/-05 |

---

## 6. Scoring weights suggestion (sum = 100)

| Dimension | Baseline (assumed) | data_analytics | Rationale |
|---|---|---|---|
| Identity (photo, name, URL, location) | 10 | 8 | Expected but not differentiating |
| Headline | 15 | 15 | Search keywords live here [S6] |
| About | 15 | 12 | Useful, but the portfolio carries more proof |
| Experience | 20 | 18 | Includes Projects for students |
| Skills | 10 | 15 | Skill search is LinkedIn's sourcing mechanism [S2][S3]; table-stakes tools are well defined |
| Featured / portfolio | 10 | **20** | The sector-specific signal [S5][S7][S8] |
| Recommendations | 5 | 3 | Low recruiter weight [S6] |
| Activity | 5 | 2 | No evidence that it helps; only negative signals count |
| CV consistency | 10 | 7 | Applies when the CV is uploaded |

Note: if the user supplies only `pdf_export`, Featured can't be checked. **Do not score it as 0.** Mark it `not_applicable`, renormalise, and prompt the user to paste their portfolio URL (self_report). With the PDF alone, the -07 check can still pass via Contact websites/About links.

---

## 7. Keyword bank (recruiter search terms)

- **Roles**: data analyst, data scientist, business intelligence (BI) analyst, insight analyst, analytics consultant, product analyst, commercial analyst, marketing analyst, data engineer, analytics engineer, research analyst, statistician, operational research (OR) analyst.
- **Query & languages**: SQL, PostgreSQL, MySQL, T-SQL, BigQuery, Python, pandas, NumPy, R, tidyverse, VBA, DAX, M/Power Query.
- **BI / visualisation**: Power BI, Tableau, Looker, Looker Studio, Qlik, Excel (pivot tables, XLOOKUP, Power Query), matplotlib, seaborn, Plotly, Streamlit.
- **Stats / ML**: regression, hypothesis testing, A/B testing, experimentation, forecasting, time series, clustering, classification, scikit-learn, XGBoost, NLP, causal inference, econometrics.
- **Data / cloud**: ETL, data cleaning, data wrangling, data modelling, dbt, Snowflake, Databricks, Spark, Airflow, AWS, Azure, GCP, Git, Jupyter.
- **Business**: KPI, dashboard, stakeholder management, data storytelling, customer segmentation, churn, pricing analytics, commercial insight, GDPR/data governance.
- **UK public-sector**: GSS, ONS, RAP (reproducible analytical pipelines), official statistics, Analysis Function.
- **Proof terms**: Kaggle (Expert/medal), datathon, hackathon, GitHub, Tableau Public, dissertation.

Synonym groups for matching: {Power BI, PowerBI, MS Power BI}; {Excel, Microsoft Excel, spreadsheets}; {ML, machine learning}; {stats, statistics, statistical modelling}.

---

## 8. Worked example: weak 2nd-year profile → improved

**Persona:** Aisha, 2nd-year BSc Economics, University of Birmingham, targeting summer 2027 data/insight internships. She works part-time at a supermarket, is a member of the Economics Society, did one Kaggle Titanic notebook and has the Google Data Analytics certificate.

### Before (scores roughly 38/100 on data_analytics weights)
- **Headline:** `Economics student at University of Birmingham | Passionate about data 📊`
- **About:** "Hardworking and motivated economics student with a passion for data. I love turning data into actionable insights and am eager to learn. Looking for opportunities."
- **Experience:** Customer Assistant, Tesco (2024-present): "Served customers. Stocked shelves. Worked as part of a team."
- **Education:** BSc Economics, University of Birmingham, 2024-2027.
- **Skills:** Teamwork, Communication, Microsoft Word, Leadership, Data Analysis.
- **Certifications:** Google Data Analytics; LinkedIn Learning "Excel Essentials"; LinkedIn Learning "Intro to Python"; Udemy "Data Science A-Z".
- **Featured:** empty. **Projects:** "Titanic survival prediction".

Rules failed:
- -01: no tools in the headline.
- -03/-04: no SQL, Python or BI tool listed.
- -05: "Data Analysis" is unevidenced.
- -06: mostly generic skills.
- -07: no portfolio link (major for 2nd year).
- -08: no question→result project.
- -09: tutorial dataset only (minor for 2nd year).
- -10: no communication evidence.
- -11: no modules or grade.
- -13: the retail job has no numbers.
- -15: About is all clichés.

### After (scores roughly 78/100)
- **Headline:** `Economics @ University of Birmingham (2nd yr) | Aspiring Data/Insight Analyst | SQL · Python · Power BI | Seeking Summer 2027 internship`
- **About:**
  > Second-year Economics student at Birmingham looking for a summer 2027 data or insight analyst internship.
  > I use SQL and Python (pandas) to clean and analyse public data, and Power BI to present it.
  > - **UK rail punctuality vs weather (2025):** joined ORR punctuality data with Met Office daily rainfall (1.1m rows) in SQL; regression showed each 10mm of rain cut on-time arrivals by about 2.3 points. Dashboard and code are linked in Featured.
  > - **At Tesco:** built an Excel tracker for weekly bakery waste that my manager now uses; waste fell about 10% over 8 weeks.
  > Modules: Econometrics (72%), Statistics, Data Analysis in R. Year 1 average 67%.
  > Happy to chat: aisha.k@... / GitHub link below.
- **Experience:** Customer Assistant, Tesco (2024-present):
  - "Built an Excel tracker for daily bakery waste; my weekly summary to the section manager informed order quantities, cutting waste about 10% over 8 weeks."
  - "Trained 3 new starters on stock rotation."
- **Projects:** "UK rail punctuality vs weather" (SQL, Python, Power BI; link). "Titanic" is removed, or kept as a minor item labelled "Kaggle learning notebook".
- **Education:** BSc Economics, University of Birmingham, 2024-2027. Year 1: 67% (2:1). Modules: Econometrics, Statistics, Data Analysis in R. Economics Society: ran a 2-session Excel-for-economists workshop (40 attendees).
- **Skills (pinned top 3):** SQL, Python (pandas), Power BI. Also: Excel (pivot tables, XLOOKUP), R, Regression analysis, Data cleaning, Data visualisation, Data storytelling, Git.
- **Certifications:** Google Data Analytics Professional Certificate (2025). The three short LinkedIn Learning/Udemy badges are removed (noise).
- **Featured:**
  1. GitHub repo with a README (question, data, method, result).
  2. Power BI public dashboard.
  3. A one-page PDF findings memo for a non-technical reader.
- **Photo:** clear head-and-shoulders. **Banner:** a screenshot of her rail dashboard. **Open to Work:** recruiters-only.

Remaining gaps (why not 90+):
- No data-specific work experience yet (normal for a 2nd year).
- No recommendation (not penalised).
- One original project; a second one, ideally with a stakeholder angle, would strengthen -08/-10.

---

## 9. Citations (all accessed 2026-10-14)

- [S1] "Save a profile as a PDF" (help answer a541960). LinkedIn Help. n.d. https://www.linkedin.com/help/linkedin/answer/a541960
- [S2] "Skills on your profile" (help answer a564064). LinkedIn Help. n.d. https://www.linkedin.com/help/linkedin/answer/a564064. Quote: "A relevant list of skills on your profile helps others to understand your strengths and improves your likelihood to be found in others' searches."
- [S2b] "Create a good LinkedIn profile" (help answer a554351). LinkedIn Help. n.d. https://www.linkedin.com/help/linkedin/answer/a554351. Quotes: members with photos receive "up to 2X more profile views"; Featured offers "quick access to your work portfolio".
- [S2c] "Add, change, edit, or delete your LinkedIn profile photo" (a541850). LinkedIn Help. n.d. https://www.linkedin.com/help/linkedin/answer/a541850. Quote: "Adding a profile photo increases the credibility of your profile". No view statistic on the page.
- [S3] "Skills-based resources" (Economic Graph research hub). LinkedIn Economic Graph. 2025. https://economicgraph.linkedin.com/research/skills-based-resources. Quote: "Workers who add skills to their profiles – especially disruptive tech and people skills – find jobs faster." (LinkedIn's own research, a conflict of interest.)
- [S5] "Careers in data". LSE Careers. n.d. (current). https://info.lse.ac.uk/current-students/careers/information-and-resources/employment-sectors/data. Quotes: "setting up a GitHub profile (which is standard practice in the sector)"; "use the LSE LinkedIn alumni finder to do this".
- [S6] "The graduate's guide to creating the perfect LinkedIn profile". TARGETjobs (editorial team; quotes Simon Katchay, GTI Recruiting Solutions). 2026 (updated 11 Aug 2026). https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile. Quotes: "Even if you're not an expert in a skill (such as a coding language), it's worth putting on your profile."; "Talk about your responsibilities, achievements and results."
- [S7] "Data analyst job profile". Prospects (Jisc). 2026. https://www.prospects.ac.uk/job-profiles/data-analyst. Quote: "build a small portfolio using open datasets. Show how you defined a question, cleaned the data, chose an analytical method and communicated the result."
- [S8] "Data scientist job profile". Prospects (Jisc). 2025. https://www.prospects.ac.uk/job-profiles/data-scientist. Quote: "Online data science competitions (e.g. Kaggle, Topcoder) can help you gain visibility and experience."
- [S9] "Data Science and AI Graduate Scheme". Lloyds Banking Group. 2025-26. https://www.lloydsbankinggrouptalent.com/our-opportunities/graduates/data-science-and-ai-graduate-scheme/. Quote: "Python coding experience, knowledge of SQL and the ability to use statistical modelling techniques as this will form a part of the assessments."
- [S10] "Data & Analytics graduate programme". Sky Early Careers. 2026. https://careers.sky.com/earlycareers/graduates/data/data-and-analytics. Quote: "You're curious about data and enjoy solving puzzles."
- [S11] "Name-blind recruitment" (John Manzoni). Civil Service blog, GOV.UK. 2015. https://civilservice.blog.gov.uk/2015/11/05/name-blind-recruitment. The candidate's name and "the university they attended" are removed. (Old source; current practice per department may vary.)
- [S12] "10 Tips for Taking a Professional LinkedIn Profile Photo". LinkedIn Talent Blog. 2024. https://www.linkedin.com/business/talent/blog/product-tips/tips-for-taking-professional-linkedin-profile-pictures. Quote: "just having a picture makes your profile 14 times more likely to be viewed by others."
- [S13] "Let recruiters know you're open to work" (a507508). LinkedIn Help. n.d. https://www.linkedin.com/help/linkedin/answer/a507508. Gives the visibility options (all members + frame / recruiters only). No statistic.
- [S14] "Maximise your LinkedIn profile!" (Noemie Oster). Imperial College London. 2024. https://www.imperial.ac.uk/news/252093/maximise-your-linkedin-profile/. Quote: "Write in concise, action-orientated statements and be genuine and truthful".
- [S15] "Google Career Certificate in Data Analytics". Grow with Google UK. 2026. https://grow.google/intl/uk/google-career-certificates/data-analytics/. Quote: "Master tools like sheets, SQL, R. and Tableau."
- [S16] UK businesses and tech talent (Google Career Certificates employer consortium). Google (The Keyword blog). 2022. https://blog.google/company-news/inside-google/around-the-globe/google-europe/united-kingdom/uk-businesses-and-tech-talent/. Members include BBC, BT, Deloitte and John Lewis; they will "consider" certificate holders.

**Unverified / not cited as fact:**
- "21x more profile views with a photo".
- Open to Work "2x recruiter messages / 40% more InMails" (LinkedIn blog 2020, URL now redirects).
- "Recruiters skim GitHub for 90 seconds".
- Headline 220 / About 2,600 character limits (third-party docs, consistent with the product but not confirmed on a LinkedIn help page in this session).
- Deloitte UK and Ocado data-role requirements (official pages not retrieved).

## 10. Evidence gaps
- No UK data employer states that LinkedIn is used in screening; the "medium" importance rests on LinkedIn's own sourcing claims plus careers-service networking advice.
- The contents of the PDF export are not documented by LinkedIn; the input tags assume observed behaviour and need validating on 5-10 real exports.
- No primary data on whether hiring managers click portfolio links, or how Kaggle tiers are valued in the UK.
- I could not fetch Deloitte UK, Ocado, ONS or Gradcracker sector pages (web-search budget exhausted, some 403s), and Bright Network's LinkedIn guide was 403.
- Certification value is mostly C-grade; only the Google consortium (2022) is employer-linked, and it commits only to "consider".
