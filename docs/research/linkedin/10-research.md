# LinkedIn Scoring Rules: Research (archetype `research`)

Scope: UK undergraduates and masters students (1st year to final year / MSc) applying in 2026-27 for:
- PhD and funded doctoral places (DTPs, CDTs)
- university research assistant roles and summer research placements (UROP-style, Research Ready)
- industry research labs (Google DeepMind, Microsoft Research Cambridge and similar)
- think tanks and policy research (IFS, Resolution Foundation, Nuffield-type organisations, LSE-listed think tanks)
- government statistical and social research (ONS, GSS/GSR via the Civil Service)

Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.
Conventions follow `docs/research/cv-rules-finance-consulting.md` §0: check types `RULE` / `LLM` / `HYBRID`; severity `critical` / `major` / `minor`; evidence `A` / `B` / `C` / `D`. Citation tags [Sx] refer to §9. All URLs accessed 2026-10-14.

---

## 0. Honest caveats up front

1. **Evidence for this sector is thin.** No research employer I could check (DeepMind, Microsoft Research, the Cambridge Research Ready page) says anything about LinkedIn in its own selection guidance. Their pages talk about enrolment, publications, programming, and referees [S9][S10][S11]. Most of the LinkedIn advice for researchers comes from UK university careers and doctoral-education bodies:
   - Sheffield/YCEDE guide, hosted by UKCGE [S1][S2]
   - Imperial Careers and Imperial's Early Career Researcher Institute [S3][S4][S5]
   - Cambridge Careers Service [S6]
   - LSE Careers and TARGETjobs on think tanks [S7][S8]

   Much of that advice is written for **PhD students and early career researchers, not undergraduates**. I scale it down to the student level, and I mark that as D-level synthesis where I do.
2. **LinkedIn is a weak screening signal for this archetype.** For other archetypes it is a sourcing or screening channel; here it is mainly a networking and "look-up" surface.
   - PhD admissions run on formal application forms, research proposals or statements, transcripts, and academic references.
   - Civil Service roles, including ONS, use structured forms. The Civil Service committed to name-blind graduate applications in 2015 [S17, search snippet only, not fetched].
   - Industry labs screen CVs, publications and code [S9][S11].

   So the scorer should **down-weight the overall importance of LinkedIn for `research`** and say so in the UI (see §6).
3. **Academics use other profiles.** In a 2014 Nature survey, regular visits to ResearchGate ranked "second only to Google Scholar, and ahead of Facebook and LinkedIn" [S15]. This is old (2014), counts scientists across all career stages, and is not UK-specific. But it supports the main point: in this sector, a LinkedIn profile should **point to** scholarly identity (ORCID, Google Scholar, GitHub, arXiv/OSF), not replace it.
4. **The "photo = 21x more profile views" statistic is unverified.** It is widely attributed to LinkedIn's own 2017 product blog [S20]. That URL now redirects and I could not fetch it, and no methodology is published. Other sites quote "7x" for the same claim. Treat it as **LinkedIn marketing copy, not evidence**. Do not show it as a reason in the UI.
5. **The input is LinkedIn's "Save to PDF" export.** LinkedIn's help page confirms the feature exists, supports "only English characters", and is not available on the mobile app [S12]. Which sections appear in the export (for example Publications, Honors, Top Skills, Featured, Projects) is **my observation, not documented** (D). It must be verified against a real export before we ship (see §8). Rules that need Featured, banner, photo, recommendations or activity are tagged `screenshot` or `self_report`.
6. **Most guidance is UK; a few sources are not.** Several generic LinkedIn tips that turned up in search (Enago, careerflow, US university handouts) are US-centric or trade-press (C). I did not rely on them.

---

## 1. How much LinkedIn matters here

| Route | Sourcing (recruiters find you) | Screening (they check you) | Networking (you find them) | Notes |
|---|---|---|---|---|
| PhD / DTP / CDT | Very low | Low: some supervisors may look you up (unverified, C) | **Medium-High**: finding supervisors, current PhD students, labs | Admissions are form plus proposal plus references. Cambridge advises that employers "may check your online presence" in general [S6]. |
| University RA / summer research placements | Very low | Low | Medium | UROP-style schemes have you email supervisors directly (Imperial UROP page, search only). |
| Industry research labs (DeepMind, MSR) | Low-Medium: lab recruiters do use LinkedIn search (D, no firm statement found) | Medium: the profile should match the CV | Medium | Selection signals are enrolment, publications, Python, and scientific communication [S9][S11]. |
| Think tanks / policy research | Low | Low-Medium | **High**: LSE notes "Some jobs are not advertised or are filled internally" [S7] | LSE: LinkedIn "should be part of your overall job strategy" [S7]. TARGETjobs stresses networking and interpersonal skills [S8]. |
| ONS / Civil Service research and statistics | Very low | Very low: structured, name-blind forms | Low-Medium | The Civil Service Code's impartiality duties make political posting a risk once employed [S16]. |

**Bottom line (D, built from the above):** for `research`, LinkedIn importance is **medium-low** overall. A clean, accurate profile that links to scholarly evidence is the goal. Optimising the profile for recruiter search matters less here than in software_eng or finance_banking. Networking value (supervisors, think-tank staff, alumni) is the main reason to invest.

**Firm statements:**
- **Google DeepMind (Student Researcher):** you "must be enrolled in a Bachelor's, Master's, or PhD program". You will be "considered for all relevant positions across Google's AI teams". No mention of LinkedIn [S9]. Google's postings (seen via search snippets only) prefer research community contributions such as publications, plus a general-purpose programming language.
- **Microsoft Research Cambridge (Machine Intelligence intern):**
  - Required: enrolled "in a PhD program in Machine Learning, Statistics, Computer Science"
  - Preferred: "Publications in relevant conferences (e.g. NeurIPS, ICML, ICLR)", Python, and "familiarity with Git and code reviews"
  - Source: a mirror of the posting [S11]. This is PhD-only, so for undergraduates it describes the **long-term target**, not a near-term role.
- **Google DeepMind Research Ready (Cambridge CST and other UK universities):**
  - Paid 8-week summer placement for undergraduates from under-represented backgrounds
  - Needs a referee
  - "those who have an interest in postgraduate study will benefit most" [S10]
  - Eligibility (via university pages, search only): penultimate or final year, UK home-fee status, socioeconomic criteria.
- **Cambridge Careers Service (PhD/postdoc CV book, 2016)** quotes a graduate recruiter: "Make sure your application matches your online presence. We will look you up on LinkedIn." The recruiter is from L'Oréal, so this is cross-sector, not research-specific [S6].
- **Imperial Careers:** "Networking is one the key skills PhD graduates tell us they wish they had learnt" [S4]. It tells 1st-year PhDs to get their "LinkedIn profile working for you" [S4].

---

## 2. What a strong student research profile looks like, section by section

### 2.1 Identity, photo, banner
- **Photo:** a clear, professional headshot [S1][S6]. Imperial: "You should be the only person in the photo" [S3]. A lab or conference photo is fine if you are clearly the subject. Not in the PDF export, so check it via screenshot.
- **Banner:** optional. The YCEDE/Sheffield guide suggests it "can visually represent your research field or highlight a key publication" [S1]. Score it as minor.
- **Custom URL** (linkedin.com/in/firstname-lastname): this is generic-baseline advice (D). Its research-specific value is consistency with the name on ORCID and Google Scholar, so supervisors can match records.
- **Name consistency** across LinkedIn, CV, ORCID and Google Scholar. ORCID exists to disambiguate researchers; it is "a unique, persistent identifier free of charge to researchers" [S14].

### 2.2 Headline
Formula (adapted from [S1] for students; B for the pattern, D for the student adaptation):
`[Degree + level + institution] | [research area or question] | [1-2 methods/tools] | [what you're seeking, optional]`

Imperial gives the headline "120 characters" (the current limit is longer; treat 120 as the visible-in-search target) and says it "should be fact based and avoid cliché phrases" [S3]. The YCEDE example "PhD Candidate in Neuroscience | Specialising in fMRI Data Analysis | Seeking Collaborative Research Opportunities" shows the area-plus-method pattern [S1].

**Good (student-level):**
1. `MSc Statistics, UCL | Causal inference for health data | R, Stan | Applying for PhDs 2027`
2. `Physics (MPhys) 3rd year, Durham | Summer researcher in exoplanet detection | Python, Bayesian modelling`
3. `Economics BSc, LSE | Interested in labour markets & inequality | Stata, survey data | Research intern, [think tank]`

**Bad:**
1. `Student at University of Manchester`: no area, no method, nothing to search on.
2. `Aspiring researcher | Passionate about science | Lifelong learner | Hardworking`: all cliché, no facts [S3].
3. `AI Researcher | ML Scientist | Published Author`: over-claims for an undergraduate with no peer-reviewed output. A supervisor will check Google Scholar and see nothing (D).

### 2.3 About
- **Length:** 100-250 words; Imperial suggests bullet points [S3]. For research, aim for 120-220 words in 3 short paragraphs (D).
- **Structure** (adapted from YCEDE: "concise narrative about your research journey", interests, technical and transferable skills, aspirations, quantified outputs [S1]):
  1. Research interest in one sentence: a question, not a topic list.
  2. Evidence: dissertation or project, placement, method, output (poster, preprint, talk, dataset, code), each concrete.
  3. Direction: what you're applying for (PhD in X, RA roles, policy research), plus links (ORCID, Google Scholar, GitHub, personal site).
- **Tone:** plain, first person, academic-but-accessible. Avoid hype words ("revolutionary", "groundbreaking", "thought leader"). YCEDE says "Translate complex ideas into accessible language" [S1]. Think tanks especially value communication to non-specialists [S7][S8].

### 2.4 Experience bullets (how they differ from CV bullets)
- CV bullets are compressed, action-verb-first, and quantified. LinkedIn entries can be **1-3 short sentences of narrative plus 2-4 bullets**. They are read by people browsing, not by an ATS (D).
- For research, each entry should state **question → method → output**. YCEDE: "describe your specific research projects, methodologies, and impactful findings" [S1].
- Report contribution honestly. The Cambridge book: "highlight where you are the lead author", and in alphabetical-author fields "make sure your contribution to the publication doesn't get lost" [S6]. For students: "I built the data-cleaning pipeline and ran the robustness checks", not "co-authored a study".
- Count research placements, UROPs, lab work, dissertation projects, and RA work for a lecturer as Experience. Imperial confirms Experience can include internships, part-time jobs, freelance work, or volunteering [S3].

### 2.5 Publications / Projects / Featured
- YCEDE: link "publications, pre-prints, and conference presentations (using the dedicated 'Publications' and 'Projects' sections)" [S1]. LinkedIn's own section list includes Publications, Projects, Honors & awards, Courses, and Test scores (from a search snippet of LinkedIn Help [S19]; not fetched).
- **Featured:** "highlight your most impactful publications, significant presentations, or media coverage" [S1]. For a student: dissertation abstract (PDF), poster PDF, a GitHub repo, a blog post explaining your project, a competition write-up.
- **Rule of honesty (D):** list only real outputs. "In preparation" or "submitted" must be labelled as such. A coursework essay is not a publication. Put it in Projects.
- **Scholarly IDs:** link ORCID and Google Scholar in Contact info or About. ORCID's own guidance is to link LinkedIn and Google Scholar profiles under ORCID "Websites" (via university library guides, search snippets). A Google Scholar profile appears in Scholar search only if it is public and "needs to have a verified email address at your university" [S13]. Most undergraduates won't have a Scholar profile, and that's fine. ORCID is free and quick at any stage [S14].

### 2.6 Skills (top 10 for `research`)
Imperial: up to 50 skills can be listed [S3]. YCEDE: list "specific software, lab techniques, statistical analysis" plus transferable skills [S1]. The ranking below is D, triangulated from [S1][S8][S11] and the IFS/Prospects search snippets.

| # | Skill | Type |
|---|---|---|
| 1 | Python (NumPy/pandas; PyTorch for ML labs) | table-stakes (STEM / industry labs) |
| 2 | R and/or Stata | table-stakes (social science / policy / ONS) |
| 3 | Statistical analysis / econometrics / experimental design | table-stakes |
| 4 | Literature review / systematic review | table-stakes |
| 5 | Scientific writing / research communication | table-stakes [S11][S8] |
| 6 | Data analysis with real datasets (survey, admin, lab) | table-stakes |
| 7 | A field-specific method (e.g. causal inference, Bayesian modelling, qualitative interviewing/NVivo, a named lab technique, fMRI) | **differentiator** |
| 8 | Git / reproducible workflows (version control, notebooks, LaTeX) | differentiator [S11] |
| 9 | Presenting research (poster, talk) | differentiator |
| 10 | Policy writing / briefing for non-specialists (think tanks) | differentiator [S7][S8] |

Noise for this archetype: "Microsoft Office", "Teamwork", "Leadership" with no evidence, and long lists of unrelated tools. The baseline already handles skills that are listed but unevidenced.

### 2.7 Certifications
- **Worth listing:**
  - Research methods courses with assessment (e.g. ONS/GSS data science training if done)
  - Data science or ML MOOCs only when linked to a project
  - Research integrity or ethics training (e.g. human-subjects/GDPR training for RA work)
  - Coding bootcamps done for a research placement

  (D: no source ranks these for research.)
- **Noise:** generic "LinkedIn Learning: Time Management", badge stacks, and any certificate standing in for a degree-level skill the transcript already shows.
- For research, **Honors & awards outrank certifications**: prizes, scholarships, bursaries, UROP funding, best-poster awards, Research Ready selection. The Cambridge example CVs show poster prizes and funding listed prominently [S6].

### 2.8 Education
- State the degree, institution, years, and **grade or average to date if strong** (First / 2:1 / %). Research admissions and IFS-type employers are grade-sensitive. IFS asks for an "extremely good degree in economics" (search snippet of IFS page, not fetched [S18]). The finance doc covers UK grade conventions in FCQ-04.
- **Dissertation title and supervisor** (if final year) and **3-5 relevant advanced modules** belong here for research. This is unusual for other archetypes; it is D, but consistent with academic CV practice in [S6].
- Masters: put the MSc first; give the thesis topic.

### 2.9 Activities / societies
Relevant: academic societies, journal clubs, student research journals (editor or reviewer), departmental seminars attended or organised, outreach and science communication, hackathons, Kaggle or data competitions, Model UN/debating (think tanks). Imperial ECRI notes that a LinkedIn search (e.g. "algorithm") reveals the range of jobs and organisations [S5]. Use the same terms in your own profile.

### 2.10 Recommendations
YCEDE: "Actively ask supervisors, collaborators, and mentors for recommendations that speak to your research abilities" [S1]. Imperial: recommendations "act as validation" [S3]. For students, a recommendation from a placement supervisor or dissertation supervisor carries real weight. It mirrors the academic reference that PhD applications require [S10]. Score this as minor (nice-to-have): a recommendation is not a reference, and selectors use formal references.

### 2.11 Activity / posting norms
- **Neutral to mildly positive.** YCEDE encourages sharing research updates, conference attendance, and accessible explanations [S1]. That is PGR/ECR advice. For an undergraduate, a few posts (poster presented, summer project write-up, reflections on a talk) are a plus. Posting is **not expected**, and no posting is not a fail (D).
- **Risks:**
  - Overstating results ("we discovered", "proved") about student work.
  - Sharing unpublished lab data or confidential findings without the PI's permission (D, research-integrity norm).
  - Partisan political content for ONS/Civil Service-bound students. The Civil Service Code requires employees not to "allow your personal political views to determine any advice you give or your actions" [S16]. That binds people once employed, but visible partisanship can undercut credibility for impartial roles (D).
  - Think tanks are mission-aligned; TARGETjobs says check "the values of the think tank align with your own" [S8]. Expressing aligned views can be fine, but it narrows your options across the political spectrum (D).
  - "Engagement-bait" or AI-generated hype posts (C/D).

---

## 3. Sector-specific red flags and myths

**Red flags**
1. Titles that over-claim: "Researcher", "Scientist", or "Published author" with no output or role to back them up.
2. A Publications section filled with coursework essays, Medium posts presented as papers, or "papers" with no venue, date or link.
3. A co-authored output with no statement of the student's contribution [S6].
4. A profile that contradicts the CV or application (dates, grades, titles). Recruiters look you up [S6].
5. No research-relevant evidence at all (project, dissertation, placement, method) for a final-year or MSc student targeting PhDs.
6. Methods named in skills but nowhere in experience or projects. A supervisor will ask about them at interview.
7. Posting unpublished data or confidential lab material.
8. Hype tone ("revolutionising AI") or partisan posting for impartial-sector targets.

**Myths**
- *"Supervisors read your LinkedIn to decide PhD admissions."* Unverified. Admissions use formal applications and references; at most, the profile is looked up (C at best).
- *"You need a Google Scholar profile as an undergraduate."* No. A Scholar profile only appears in search with a verified university email [S13], and undergraduates rarely have indexed outputs. ORCID is the low-cost identity step [S14].
- *"Profiles with photos get 21x more views."* No public methodology; it is LinkedIn marketing, quoted inconsistently as 7x or 21x [S20]. Mark it unverified.
- *"Posting daily builds your research brand."* That is ECR-level advice [S1]. It is not expected of undergraduates and doesn't count in admissions.
- *"Endorsements prove skills."* Endorsements are peer votes [S3]. Selectors look at evidence and references.

---

## 4. Differences by year

| Year | What "good" looks like | Scorer behaviour |
|---|---|---|
| **1st year** | Basic complete profile: photo, a headline naming degree plus interest area, a short About (60-120 words OK), Education with relevant modules, societies, any part-time work. Research evidence is optional. | Skip the research-output rules (LI-RESEARCH-06, -07). Downgrade headline-specificity to minor. Encourage ORCID only if they have any output; otherwise skip. |
| **Penultimate (2nd year / 3rd of 4)** | Interest area plus method in the headline. At least one research-type item: UROP, summer placement application, a substantive coursework or independent project with method and write-up. Skills include the core tool (Python/R/Stata). The Research Ready / UROP window applies [S10]. | Full rule set, but outputs (posters or preprints) are a bonus, not required. |
| **Final year / MSc** | Dissertation topic and supervisor in Education. Projects or Featured hold the dissertation abstract or poster. Clear direction ("Applying for PhDs in X, 2027"). ORCID linked if any output exists. Recommendation from a supervisor if possible. | Full rule set. Missing research evidence is **major**. Missing direction is **major**. |

---

## 5. Sector rule set (overrides or additions to the generic baseline)

The baseline (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency) still applies; these rules add to it or override it for `research`.

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-RESEARCH-01 | **Headline names a research area and at least one method or tool**, not only "Student at X". *LLM Q:* "Does the headline name a specific research area/question AND at least one method, tool or technique?" Pass: `MSc Statistics, UCL \| Causal inference for health data \| R, Stan`. Fail: `Student at University of Manchester`. | HYBRID (regex for degree/institution-only headline; LLM for area plus method) | pdf_export | major | Y1: minor | B | [S1][S3] |
| LI-RESEARCH-02 | **No over-claiming titles.** Headline or Experience titles like "Researcher", "Scientist", "Research Scientist", "Published Author" must be backed by a matching role or output. *LLM Q:* "Is every research-type title backed by a listed role or output that justifies it?" Pass: "Summer Research Intern, Dept of Physics, Durham (8 wks)". Fail: headline "AI Researcher" with no research role or output anywhere. | HYBRID (keyword list → LLM cross-check against Experience/Publications) | pdf_export | **critical** | all years | D (integrity norm; [S6] on accurate contribution) | [S6] |
| LI-RESEARCH-03 | **About states a research interest as a question or problem, plus evidence, plus direction** (3 elements, 100-250 words). *LLM Q:* "Does the About contain (a) a specific research interest, (b) at least one concrete piece of evidence (project/method/output), and (c) a stated direction (e.g. PhD in X / RA roles)?" Pass: "I'm interested in why wage growth stalled after 2008… In my dissertation I used Labour Force Survey microdata in Stata to… I'm applying for economics PhDs and policy research roles." Fail: "Passionate, curious student who loves learning and research." | LLM (plus RULE word count) | pdf_export | major | Y1: minor, (c) optional | B | [S1][S3] |
| LI-RESEARCH-04 | **Experience entries describe question → method → finding/output** for research roles. *LLM Q:* "For each research-type entry, are the method used and the output/finding both stated?" Pass: "Built a Python pipeline to clean 40k survey responses; ran fixed-effects regressions; findings presented in lab meeting." Fail: "Assisted with research in the lab." | LLM | pdf_export | major | Y1: skip if no research entries | B | [S1] |
| LI-RESEARCH-05 | **Individual contribution is explicit** on any co-authored or team research. *LLM Q:* "Does each co-authored output or team project state what the student personally did?" Pass: "Co-author (3rd of 5): built the simulation and wrote the methods section." Fail: "Co-authored a paper on protein folding." | LLM | pdf_export | major | all | B | [S6] |
| LI-RESEARCH-06 | **Publications section is honest and well-formed**: each item has a venue/type, date, status (published / preprint / submitted / in prep) and a link or DOI where one exists. Coursework is not listed as a publication. *LLM Q:* "Is every Publications item a genuine research output with venue/type, date and status, and none of them coursework?" Pass: "Poster: 'X', UCL Undergraduate Research Conference, Jun 2026". Fail: "Essay on Keynesian economics, 2025". | HYBRID (RULE: fields present; LLM: genuine output vs coursework) | pdf_export | major (critical if fabricated or mislabelled) | Y1: not_applicable if section empty | B | [S1][S6] |
| LI-RESEARCH-07 | **At least one research-evidence item** (dissertation, UROP or placement, independent project with method, poster, preprint, competition write-up) appears in Experience, Projects, Publications or Featured. | HYBRID (RULE section scan; LLM classifies "research-type") | pdf_export (Projects/Featured may need screenshot) | major (final/MSc), minor (penultimate) | Y1: skip | D | [S1][S10] |
| LI-RESEARCH-08 | **Scholarly identity is linked**: ORCID iD and/or Google Scholar / GitHub / personal site in Contact info or About, if the student has any output or code. | RULE (regex `orcid.org/\d{4}-`, `scholar.google`, `github.com`) | pdf_export (About/contact), self_report | minor (major if the student has outputs but no link) | Y1: skip | B | [S1][S13][S14] |
| LI-RESEARCH-09 | **Education includes research-relevant detail**: grade or average to date (if 2:1/First or equivalent), dissertation title and supervisor (final/MSc), 3-5 relevant advanced modules. | HYBRID | pdf_export | major (final/MSc), minor (others) | Y1: modules only | D (consistent with [S6] academic CV practice) | [S6][S18] |
| LI-RESEARCH-10 | **Skills include the core analysis tool for the target subfield** (Python, R or Stata) plus at least one named method, and these appear in Experience or Projects too. *LLM Q:* "Is at least one listed core tool/method also evidenced in an Experience or Projects entry?" Pass: Skills "Stata, Panel data" + experience "fixed-effects regressions in Stata". Fail: Skills "Python, Machine Learning, Deep Learning", nothing in experience. | HYBRID | pdf_export (Top Skills only, 3 shown) + self_report for the full list | major | Y1: minor | B | [S1][S11] |
| LI-RESEARCH-11 | **Communication evidence**: at least one item shows research communicated (poster, talk, blog explainer, policy brief, outreach, teaching or tutoring). | LLM | pdf_export, screenshot (Featured) | minor (major for think-tank targets) | Y1: skip | B | [S7][S8][S11] |
| LI-RESEARCH-12 | **Tone is academic-accessible, not hype**: no "revolutionary/groundbreaking/thought leader", no overstated findings. *LLM Q:* "Is the About/Experience free of hype language and overstated claims about results?" Pass: "Found a modest association (r=0.3) between…". Fail: "Discovered a groundbreaking link that changes how we think about…". | HYBRID (lexicon + LLM) | pdf_export | minor | all | D | [S1][S3] |
| LI-RESEARCH-13 | **Featured holds a research artefact** (poster PDF, dissertation abstract, repo, explainer) rather than generic certificates or reposts. | LLM | screenshot | minor | Y1: skip | B | [S1] |
| LI-RESEARCH-14 | **Recommendation from an academic or placement supervisor** present (final/MSc). | RULE (count) + LLM (relationship) | screenshot, self_report | minor | Y1/penultimate: skip | B | [S1][S3] |
| LI-RESEARCH-15 | **No confidential or unpublished data and no partisan content** in visible posts for students targeting ONS/Civil Service or impartial research. Self-declared (we cannot read activity). | LLM on user-pasted posts | self_report, screenshot | major if found for ONS/GSR targets; minor otherwise | all | A for Civil Service impartiality ([S16]); D for the data-confidentiality norm | [S16][S8] |
| LI-RESEARCH-16 | **Profile matches the CV/application**: titles, dates, grades and output statuses are consistent (cross-check with the Placed CV). | HYBRID (diff of extracted fields; LLM for semantic mismatch) | pdf_export | **critical** if grade/title mismatch; major otherwise | all | B | [S6] |
| LI-RESEARCH-17 | **Direction signal** (final/MSc): headline or About says what the student is seeking (PhD area / RA / policy research), without the "Open to Work" frame being the only signal. | LLM | pdf_export | major (final/MSc); minor (penultimate) | Y1: skip | B | [S1] |

Baseline overrides for `research`:
- **Activity/posting** baseline: if the baseline penalises "no posts in 90 days", set it to `not_applicable` for research (D; supported by §2.11).
- **Skills count**: do not reward >20 skills; reward evidenced core tools instead (LI-RESEARCH-10).
- **Recruiter-search keyword density**: down-weight (see §6). Sourcing via LinkedIn is weak here.
- **Certifications**: lower weight than Honors & awards. Scholarships, prizes and research funding outrank MOOCs (D).

---

## 6. Scoring weights suggestion (relative to baseline = 1.0)

| Dimension | Weight | Why |
|---|---|---|
| Identity & photo | 0.8 | Needed, but not a differentiator; the 21x claim is unverified. |
| Headline | 1.0 | Same as baseline, but scored on area plus method, not recruiter keywords. |
| About | 1.2 | The research narrative is the main place to show thinking [S1]. |
| Experience | 1.3 | Method-and-output evidence is the core signal [S1][S6]. |
| Publications / Projects / Featured (research evidence) | 1.5 | Sector-defining; mirrors employer criteria [S9][S11]. |
| Skills | 0.9 | Core tool required; breadth less valuable. |
| Education | 1.3 | Grades, dissertation and modules matter more than in most archetypes [S18][S6]. |
| Recommendations | 0.7 | Formal references are what selectors use. |
| Activity/posting | 0.4 | Not expected of undergraduates; risk-only checks. |
| CV consistency | 1.2 | Integrity is especially valued in research. |

**UI note:** show a banner on the `research` score: *"For PhDs and research roles, LinkedIn is mostly for networking and look-ups. Your application, research statement and references carry far more weight."* This is honest framing per §1.

---

## 7. Keyword bank (terms to include where true)

- **Roles:** research assistant, research intern, summer research placement, UROP, student researcher, research economist, social researcher, statistician, data scientist (research), PhD applicant, MRes, DTP, CDT.
- **Methods (general):** literature review, systematic review, meta-analysis, experimental design, hypothesis testing, regression, causal inference, difference-in-differences, instrumental variables, panel data, time series, Bayesian inference, Monte Carlo simulation, survey design, qualitative interviewing, thematic analysis, mixed methods.
- **ML / industry labs:** PyTorch, JAX, TensorFlow, reinforcement learning, LLMs, diffusion models, optimisation, evaluation, reproducibility, NeurIPS/ICML/ICLR (only if real) [S11].
- **Tools:** Python, R, Stata, MATLAB, SQL, LaTeX, Git, Jupyter, NVivo, SPSS, HPC/cluster, Linux.
- **Data:** Labour Force Survey, Understanding Society, UK Data Service, ONS microdata, census, administrative data, open data.
- **Communication:** poster presentation, conference talk, policy brief, research summary, science communication, outreach, technical writing.
- **Identity/outputs:** ORCID, Google Scholar, preprint, arXiv, OSF, bioRxiv, SSRN, DOI, dataset, open-source.
- **Policy / think tank:** policy analysis, public policy, evidence review, briefing, stakeholder engagement, impact evaluation, fiscal policy, labour economics, social mobility.

---

## 8. Worked example: weak 2nd-year profile → improved

**Student:** Aisha, 2nd-year BSc Economics at a Russell Group university. She did a term-time project replicating a labour economics paper in Stata, and she is applying for a summer research placement and an IFS-type internship.

### Before (weak), as it would appear in a PDF export
- **Headline:** `Economics Student | Hardworking | Passionate About Making a Difference`
- **About:** "I am a motivated and passionate economics student who loves research and learning new things. I am a great team player with excellent communication skills. Feel free to connect!"
- **Experience:** "Sales Assistant, Boots (2024-present). Served customers. Worked on tills." Nothing else.
- **Education:** "BSc Economics, University of Bristol, 2024-2027"
- **Skills (top 3 shown):** Microsoft Office, Teamwork, Leadership
- **Publications:** "The Effects of Minimum Wage, 2025": a coursework essay.
- No links. No Featured.

**Rule hits:**

| Rule | Result |
|---|---|
| LI-RESEARCH-01 | fail (major) |
| LI-RESEARCH-03 | fail (major) |
| LI-RESEARCH-06 | fail: coursework listed as a publication (major) |
| LI-RESEARCH-07 | fail (minor at penultimate) |
| LI-RESEARCH-09 | fail: no grade or modules (minor) |
| LI-RESEARCH-10 | fail (major) |
| LI-RESEARCH-12 | partial (cliché) |

Indicative score: ~35/100.

### After (improved)
- **Headline:** `Economics BSc (2nd yr), Bristol | Labour markets & minimum wage policy | Stata, R | Seeking summer research placements 2027`
- **About (≈150 words):**
  "I'm interested in how minimum wage changes affect hours and job quality for young workers in the UK.
  This year I replicated a published difference-in-differences study using Labour Force Survey data in Stata, then extended it to 2016-2024 and tested robustness to different control groups. I wrote up the results as a 2,500-word report and presented them at our department's undergraduate research seminar.
  Alongside my degree I work part-time in retail, which gave me a first-hand view of how scheduling changes after wage rises.
  I'm looking for summer research placements in labour or public economics, and I plan to apply for a master's and then a PhD. Code: github.com/aisha-econ · ORCID: 0000-000X-XXXX-XXXX"
- **Experience:**
  - *Independent research project (supervised), Dept of Economics, Bristol, Jan-May 2026*: "Replicated and extended a minimum-wage DiD study with LFS microdata (n≈180k) in Stata. Ran event-study and placebo tests. Presented to 30 staff and students; report on GitHub."
  - *Sales Assistant, Boots, 2024-present*: "Handled ~100 transactions per shift; trained 3 new starters on the till system."
- **Projects:** the replication (linked). **Publications:** removed. The essay moves to Projects only if it is substantive.
- **Education:** "BSc Economics, Bristol, 2024-2027. Year 1 average: 71% (First). Modules: Econometrics I-II, Labour Economics, Microeconomic Theory, Statistics."
- **Skills:** Stata, R, Econometrics, Difference-in-differences, Literature review, Research writing, Python (basic), LaTeX.
- **Featured:** seminar slides PDF, GitHub repo.
- **Societies:** Economics Society (research seminar committee).

**Rule hits after:**
- LI-RESEARCH-01, -03, -04, -06, -07, -09, -10 and -11 pass.
- -08 passes (ORCID optional at this stage, but present).
- -12 passes.
- -14 is skipped (penultimate).

Indicative score: ~80/100. The remaining gap is a supervisor recommendation and a stronger output, such as a poster at a conference.

---

## 9. Citations (all accessed 2026-10-14)

- **[S1]** Akram, A. *LinkedIn Top Tips for Postgraduate and Early Career Researchers*. University of Sheffield / Yorkshire Consortium for Equity in Doctoral Education (YCEDE), 2025. https://ycede.ac.uk/wp-content/uploads/2025/07/linkedin-top-tips-for-postgraduate-and-early-career-researchers.pdf. Fetched; quotes verbatim.
- **[S2]** *LinkedIn Top Tips for Postgraduate and Early Career Researchers* (resource page). UK Council for Graduate Education, 2025. https://ukcge.ac.uk/resources/resource-library/linkedin-top-tips-for-postgraduate-and-early-career-researchers. Fetched.
- **[S3]** *LinkedIn*. Imperial College London Careers Service, n.d. (live 2026). https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/linkedin/. Fetched.
- **[S4]** *Career planning: PhD*. Imperial College London Careers Service, n.d. https://www.imperial.ac.uk/admin-services/careers/plan-your-career/career-planning/phd/. Fetched.
- **[S5]** *Making connections*. Imperial College London, Early Career Researcher Institute, n.d. https://www.imperial.ac.uk/early-career-researcher-institute/careers-and-transitions/careers-beyond-academia/reflection-and-research/research/make-connections/. Fetched. Its LinkedIn tipsheet PDF is behind Imperial SSO and was not read.
- **[S6]** *CVs and Cover Letters for PhDs and Postdocs*. University of Cambridge Careers Service, 2016 (file dated 2018). https://www.careers.cam.ac.uk/files/phdpostdoccvbook.pdf. Fetched. Contains the L'Oréal recruiter quote, the "highlight where you are the lead author" guidance, and example CVs.
- **[S7]** *Think tanks*. LSE Careers, n.d. https://info.lse.ac.uk/current-students/careers/information-and-resources/type-of-organisation/think-tanks. Fetched.
- **[S8]** *Jobs with think tanks*. TARGETjobs, 2023 (25 Jan 2023). https://targetjobs.co.uk/careers-advice/public-services-and-administration/jobs-think-tanks. Fetched.
- **[S9]** *Student Researcher Program*. Google DeepMind, n.d. https://deepmind.google/careers/internships/. Fetched. No LinkedIn or selection-criteria text on the page.
- **[S10]** *Google DeepMind Research Ready Programme*. Department of Computer Science and Technology, University of Cambridge, 2026. https://www.cst.cam.ac.uk/node/11411971. Fetched. Eligibility details came from other universities' pages via search only (Exeter, Liverpool, Cardiff Met).
- **[S11]** *Research Intern – Machine Intelligence (Cambridge)*. Microsoft Research posting, mirrored on flexa.careers, 2025-26. https://flexa.careers/jobs/microsoft-cambridge-machine-intelligence-intern-673750a16f9e1e8574b452ca. Fetched from the mirror, not microsoft.com. Verify on careers.microsoft.com.
- **[S12]** *Save a profile as a PDF*. LinkedIn Help, n.d. https://www.linkedin.com/help/linkedin/answer/a541960. Fetched.
- **[S13]** *Google Scholar Citations: help*. Google, n.d. https://scholar.google.com/intl/en/scholar/citations.html. Fetched.
- **[S14]** *What is ORCID?* ORCID, n.d. https://info.orcid.org/what-is-orcid/. Fetched.
- **[S15]** Van Noorden, R. *Online collaboration: Scientists and the social network*. Nature (news feature), 2014. https://www.nature.com/news/onlinecollaboration-scientistsand-the-social-network-1.15711. Fetched. No LinkedIn-specific statistics beyond the ranking sentence.
- **[S16]** *The Civil Service Code*. Cabinet Office, GOV.UK, 2015 (current). https://www.gov.uk/government/publications/civil-service-code/the-civil-service-code. Fetched.
- **[S17]** *Name blind recruitment: a commitment to diversity*. Civil Service Blog, GOV.UK, 2015. https://civilservice.blog.gov.uk/2015/11/05/name-blind-recruitment-a-commitment-to-diversity/. **Search snippet only, not fetched. No quotes.**
- **[S18]** *Research economists*. Institute for Fiscal Studies, n.d. https://ifs.org.uk/research-economists. **Returned HTTP 403; content from search snippet only. No verbatim quote.**
- **[S19]** *Add sections to your profile*. LinkedIn Help, n.d. (section list: Publications, Projects, Honors & awards, Courses, Test scores…). **Search snippet only; exact URL not confirmed.**
- **[S20]** *LinkedIn Profile Photo Tips: Introducing Photo Filters and Editing*. LinkedIn Blog, 2017. https://blog.linkedin.com/2017/march/14/linkedin-profile-photo-tips-introducing-photo-filters-and-editing. **Redirects to linkedin.com/blog/member; not fetched.** This is the claimed origin of "21x more profile views", with no methodology published. Treat as unverified.

## 10. Open evidence gaps (to verify before shipping)
1. Exactly which sections the LinkedIn "Save to PDF" export includes: Publications, Projects, Honors, Featured, full Skills list vs "Top Skills", and contact links. This decides each rule's input tag. Test with 3 real exports.
2. No research employer statement on how (or whether) they use LinkedIn for sourcing or screening. Ideally interview a DeepMind/MSR university-relations recruiter, an IFS/Resolution Foundation hiring manager, and an ONS GSS recruiter.
3. No evidence on whether PhD supervisors in UK departments look at applicants' LinkedIn. Worth a short survey of UCL supervisors.
4. IFS page (403) and the Civil Service name-blind blog were not fetched. Re-fetch before quoting them in the UI.
5. Imperial's ECRI LinkedIn tipsheet is behind SSO. It may add researcher-specific rules.
