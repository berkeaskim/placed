# LinkedIn Profile Rules: Software Engineering (`software_eng`)

Scope: UK undergraduates and masters students (1st year to final year / MSc) using LinkedIn alongside applications for software engineering internships, industrial placements (year in industry), insight/discovery programmes and graduate schemes in 2026-27. Target employers: big tech (Google, Meta, Amazon, Microsoft), finance-tech engineering (Bloomberg, trading-firm developer roles, bank technology programmes), fintech scale-ups (Monzo, Revolut, Wise), data/defence platforms (Palantir) and startups.
Compiled: 2026-10-14. All URLs accessed 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.

---

## 0. How to read this document

Conventions follow `docs/research/cv-rules-finance-consulting.md` §0 and `cv-rules-tech-product.md`:

- **Check**: `RULE` (deterministic: regex, section parser, counts), `LLM` (one yes/no question with a pass and a fail example), `HYBRID` (code extracts, LLM grades).
- **Input** (which input can check the rule): `pdf_export` (LinkedIn "Save to PDF"), `screenshot` (user-supplied screenshots of profile sections), `self_report` (user answers a question or pastes text). We never scrape LinkedIn.
- **Severity**: `critical` (likely to sink the profile on its own for this sector), `major`, `minor`.
- **Evidence**: `A` employer guidance or consistent across several top-tier UK sources; `B` one top-tier source; `C` practitioner/trade press; `D` my synthesis, no source. Citation tags `[Lx]` point to §11.

**This file overrides or adds to the generic LinkedIn baseline** (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency). Where this file is silent, the baseline applies.

### Honest caveats up front

1. **No target employer publishes LinkedIn guidance for student engineers.** I looked for Google, Amazon, Bloomberg, Monzo, Revolut and Palantir guidance. The pages I could fetch talk about CVs, online assessments and interviews, never about LinkedIn profiles. Amazon's own "8 things recruiters say top candidates do" page does not mention LinkedIn at all [L13]. Revolut, Bloomberg and Bright Network pages returned 403. So every sector-specific LinkedIn rule below is at best grade B (a top-tier careers source or recruiter talk) and many are C/D.
2. **For this sector, LinkedIn is a secondary document.** Student SWE hiring at the big employers runs through an application portal, a CV, and usually an online coding assessment. LinkedIn is where a recruiter or interviewer *may* look after the CV, where some sourcing happens, and where students find alumni for referrals. GitHub and projects carry more weight than LinkedIn polish. The scorer should say this to the user.
3. **The "Save to PDF" export does not contain everything.** LinkedIn's help page confirms the feature exists, is desktop-only and English-only [L6], but does not document which sections are included. From observed exports (grade D, **must be validated on 5+ real exports before shipping**): the PDF contains name, headline, location, a Contact block (LinkedIn URL and any websites added in Contact info), Top Skills (3), Languages, Certifications, Honors-Awards, Publications, Summary (About), Experience and Education. It appears to **omit** photo, banner, Featured, Activity/posts, Recommendations, endorsement counts, and probably the Projects, Volunteering and Courses sections. Rules that depend on omitted sections are tagged `screenshot` or `self_report`.
4. **Several famous LinkedIn stats are vendor claims with no published method** (see §3.2). I don't use any of them as scoring rationale.
5. **US-centric material.** Most "LinkedIn for software engineers" content online is American (GPA, "new grad", "résumé"). I used it only where UK sources agree.

---

## 1. How much LinkedIn matters for software engineering

### 1.1 Summary verdict

**Medium.** LinkedIn matters less for student SWE roles than for consulting, banking or marketing, and less than GitHub and projects within SWE. It is rarely the screening document, but it is often the *second look*, a sourcing surface for smaller firms and recruitment agencies, and the main networking channel for referrals.

| Channel | Role of LinkedIn for student SWE | Evidence |
|---|---|---|
| **Screening** (deciding who passes) | Low. Big-tech and finance-tech student programmes screen on the application form, CV, transcript and online coding assessment. Monzo asks for written answers alongside the CV [L12]. Amazon's recruiter advice covers CV, assessment, Leadership Principles and interviews, with no mention of LinkedIn [L13]. | B (employer pages, inferred from silence) |
| **Second look** (after the CV) | Medium. Google recruiters tell students to put LinkedIn and GitHub in the CV contact line [L10], so a screener can click through. A profile that contradicts the CV, or is empty, costs credibility. | B |
| **Sourcing** (recruiter finds you) | Medium for scale-ups, startups and agencies; low for big-tech intern intake. A UK agency recruiter quoted by TARGETjobs says they are "often searching for people who fit the specification of what we're looking for" [L1]. LinkedIn's own data says only **8%** of UK recruiter searches filter solely on skills, one of the lowest shares measured [L7]. So degree, location and title fields still drive UK searches. | B |
| **Networking / referrals** | Medium-high. UK careers services push the LinkedIn alumni tool and personalised connection requests to reach engineers at target firms [L2][L19]. | A (consistent across careers services) |

### 1.2 Which firms say what

| Firm / source | What they say (relevant to LinkedIn) | Fetched? |
|---|---|---|
| Google recruiters (UofT workshop, Sep 2025) | CV contact line should carry "LinkedIn and GitHub"; projects should be uploaded to GitHub "which should be linked on your resume"; "Open-source contributions stand out" [L10]. | Yes (secondary report of a recruiter talk) |
| Monzo (engineering blog, Jan 2025) | Hires "for problem-solving ability over experience"; application has written questions on a technical challenge and why Monzo [L12]. Nothing on LinkedIn. | Yes |
| Amazon (About Amazon) | Well-structured, quantified CV; no LinkedIn mention [L13]. | Yes |
| Bloomberg (SWE intern posting, via Bright Network listing) | Programming in C, C++, Java or Python; data structures and algorithms; problem solving [L16]. | No (search excerpt only) |
| Palantir, Revolut, Meta | No primary guidance retrieved. Palantir advice found online came from third-party prep sites, which I excluded. | No |
| University of Birmingham Careers, IT & computing | "Join coding societies, take part in hackathons, or contribute to open-source projects." Connect with graduates on LinkedIn [L14]. | Yes |
| TARGETjobs (technical CV) | GitHub link with contact details; portfolio must have "up-to-date examples of your work"; hackathons and personal projects evidence passion [L11]. | Yes |

**Implication for Placed:** the LinkedIn score for `software_eng` should mostly reward **evidence of building things** (projects, GitHub, stack, outcomes) being visible and consistent with the CV, and should not reward LinkedIn-native activity (posting, follower counts, endorsements).

---

## 2. What a strong student SWE profile looks like, section by section

### 2.1 Photo and banner

- **Photo**: baseline applies (clear, recent, face visible, professional-but-approachable; TARGETjobs warns against passport-style, holiday and night-out photos [L1]). No SWE override: casual dress is normal in tech, so don't penalise a hoodie or T-shirt. Input: `screenshot` only.
- **Banner**: optional. A plain banner is fine. A tech-relevant banner (own project screenshot, terminal, a city skyline) is a tiny plus at most. Never score below "neutral" for the default banner. Grade D.

### 2.2 Headline

Edinburgh says you have 200 characters [L3]. LinkedIn's current limit is widely reported as 220, but I couldn't confirm it on a LinkedIn help page, so the checker should read length off the export rather than hard-code a limit.

**Formula (grade B/D):** `[Year + degree] @ [University] | [specialism or stack, 2-4 terms] | [one proof point] | [target: role + season]`

The proof point is the SWE-specific part. It can be an internship, a shipped project with users, a hackathon place, or an open-source contribution. Bright Network advises dividing the headline with pipes and not wasting it on "Student at [University]" (search excerpt, [L17]).

**3 good examples** (illustrative, not real people):
1. `2nd-year CS @ UCL | Backend: Go, Python, PostgreSQL | Built a society ticketing app used by 1,200 students | Seeking Summer 2027 SWE internships`
2. `Penultimate-year MEng Computing @ Imperial | Systems & Rust | Open-source contributor (merged PRs to a data-frame library) | SWE internships 2027`
3. `MSc Computer Science @ Edinburgh (conversion from Physics) | Python, TypeScript, AWS | Ex-data engineering intern @ [fintech] | Graduate SWE roles 2027`

**3 bad examples:**
1. `Student at University College London`: no specialism, no target, no proof.
2. `Aspiring Software Engineer | Passionate about tech | Coding enthusiast | Future Googler 🚀`: adjectives, not evidence. "Future [Company]" reads as presumptuous.
3. `Full-Stack Developer | AI/ML Engineer | Blockchain Developer | Cloud Architect`: job titles the student has never held. Recruiters see it as title inflation, and the stack is too wide to believe.

### 2.3 About

- **Length**: up to 2,000 characters are available [L3]. For students, ~600-1,200 characters (3-5 short paragraphs) is enough. Grade D.
- **Structure (grade D, aligned with TARGETjobs "introduce yourself as if meeting someone at a networking event" and "mention projects you're proud of" [L1]):**
  1. One line: who you are and what you build ("2nd-year CS student at UCL who builds backend services and developer tools.").
  2. 1-2 projects or roles with stack and one number each.
  3. What you're learning or exploring now (e.g. distributed systems, compilers, ML infra), with a concrete sign (module, side project, reading group).
  4. Target: role type + timeframe + location ("Looking for 2027 SWE internships or a placement year in London.").
  5. Links: GitHub, portfolio, email.
- **SWE fail modes**: a wall of buzzwords ("passionate, driven, innovative"), a list of 25 technologies with no context, or an AI-generated paragraph that could describe anyone.

### 2.4 Experience

LinkedIn experience entries differ from CV bullets:
- **Same facts, more room.** The CV squeezes each role into 2-4 one-line bullets. LinkedIn can carry 2-5 bullets or a short paragraph per role, plus a "Skills" tag list on the entry. Keep the X-Y-Z shape ("did X, measured by Y, by doing Z", the Google formula already used in `cv-rules-tech-product.md` SWE-08).
- **First person, own contribution.** TARGETjobs advises "I" statements and context for each role [L1]. The agency recruiter quoted there asks for "responsibilities, achievements and results" [L1].
- **Name the stack in each tech entry.** Recruiter keyword search reads these fields. The Skills Signal report tells job seekers to "Be specific. Tie your skills to real experiences, such as projects, roles, or measurable accomplishments." [L7]
- **Keep non-tech jobs** (retail, hospitality, tutoring), but in 1-2 lines with one transferable outcome. TARGETjobs: include part-time, volunteering and leadership roles [L1].
- **Projects can live here** as entries titled e.g. "Software Engineer (personal project) · Self-employed" only if clearly labelled. Mislabelling a side project as employment is a red flag (see LI-SOFTWARE_ENG-03). The cleaner option is the Projects section. But because the Projects section probably does not appear in the PDF export (§0 caveat 3), Placed should ask the user to paste projects or upload a screenshot.

### 2.5 Projects and Featured

This is the most important SWE-specific part of the profile.
- **Projects section**: 2-4 projects, each with name, one-line purpose, stack, *your* role (solo or team of N), one outcome (users, latency, accuracy, prize, deployed), and a link to repo or demo.
- **Featured**: LinkedIn describes Featured as a place to "showcase samples of your work to people who view your LinkedIn profile", including "links to external websites, for example your personal blog or portfolio" [L4]. For SWE the best items are: (1) GitHub profile or a pinned repo with a good README, (2) a live demo or Devpost page, (3) a short technical write-up (post or article) about a project. A certificate image or a "I'm happy to announce" post is a weak Featured item.
- **GitHub hygiene** (not scorable from LinkedIn input; give as advice): 2-4 pinned repos with READMEs, no empty repos pinned, public. Grade C (practitioner consensus); TARGETjobs's "up-to-date examples" [L11] is the nearest top-tier source.

### 2.6 Skills

- LinkedIn allows many skills and lets you pin top skills. The PDF export shows **Top Skills** (3) in the sidebar (observed, grade D).
- TARGETjobs: highlight 5-10 key skills, not exhaustive lists; and "Even if you're not an expert in a skill (such as a coding language), it's worth putting on your profile." [L1] I reconcile this with the no-exaggeration rule as follows. Listing is fine, but each listed language should be backed by an entry somewhere on the profile, and the pinned top 3 should be skills you would be happy to be interviewed on.
- LinkedIn's data: average skills listed rose from 5 (2019) to 9 (2024), and adding 10 skills is associated with a one-month shorter employment gap [L7]. That finding is correlational and comes from the general workforce, not students. It supports "list a decent number", not "list 50".

**Top 10 skills for student SWE profiles:**

| # | Skill | Tier | Why |
|---|---|---|---|
| 1 | Python | Table-stakes | Named in Bloomberg-type postings [L16]; most common student language |
| 2 | Java **or** C++ (at least one) | Table-stakes | Bloomberg lists C, C++, Java, Python [L16]; big-tech interviews accept these |
| 3 | Data structures & algorithms | Table-stakes | Core of every coding assessment [L16] |
| 4 | Git / GitHub | Table-stakes | Expected, and links the profile to the evidence [L10][L11] |
| 5 | SQL | Table-stakes | Common across backend and fintech roles (Stack Overflow 2025: 59% of devs use SQL [L18]) |
| 6 | JavaScript / TypeScript (+ React or Node.js) | Common | TypeScript #1 on GitHub by contributors in 2025 [L18] |
| 7 | Linux / Bash | Common | Day-to-day engineering environment |
| 8 | Docker | Differentiator for students | 71% of professional devs use it [L18]; less common on student profiles |
| 9 | Cloud (AWS / GCP / Azure) | Differentiator | Shows deployment, not just coursework |
| 10 | Testing + CI/CD (pytest/JUnit, GitHub Actions) | Differentiator | Signals engineering practice beyond "it runs" |

Other differentiators by sub-track: Go or Rust (systems, fintech backends), Kotlin/Swift (mobile, e.g. Monzo's mobile team), distributed systems, system design, and C++ low-latency work (trading-firm developer roles).

**Noise skills for SWE** (don't pin, fine to omit): Microsoft Word/PowerPoint/Excel (unless the target role asks), "Computer literacy", "Social media", "HTML" as the *headline* skill for a SWE role, and long lists of soft skills ("Teamwork", "Leadership") without evidence elsewhere.

### 2.7 Certifications

- **Worth listing (minor plus):** cloud provider certifications with an exam, e.g. AWS Certified Cloud Practitioner / Developer Associate, Microsoft Azure Fundamentals (AZ-900), Google Cloud Associate. They show initiative for students with little experience. Grade C/D.
- **Neutral:** one or two substantial MOOCs that fill a real gap (e.g. a Stanford/Coursera algorithms course for a conversion-MSc student).
- **Noise:** stacks of short completion certificates (Udemy, LinkedIn Learning "Intro to Python", HackerRank badges, Sololearn), especially when they replace projects. Grade D. The CV equivalent (SWE-11 "skills are evidenced") applies.

### 2.8 Education

- Degree, university, dates including **expected graduation**, and grade if strong (First/2:1 or a year average such as "Year 1: 71%"). TARGETjobs recommends specific modules and dissertation details/scores [L1].
- SWE-specific: list 3-6 relevant modules (Algorithms, Operating Systems, Databases, Distributed Systems, Compilers, Machine Learning, Software Engineering group project) and the **final-year/group project title with stack**.
- A-levels: optional on LinkedIn (more relevant for 1st years). Grade B/D.

### 2.9 Activities and societies

High value for 1st and 2nd years: tech society roles (e.g. a university's computing or hackathon society), hackathon participation and placings, competitive programming (ICPC/UKIEPC, Advent of Code), open-source contributions, coding tutoring/TA work, Google/Meta/Bloomberg-run student events. Birmingham Careers [L14] and Google recruiters [L10] both name hackathons and open source. State the role and result ("Organiser, 300-person hackathon", "3rd of 60 teams"), not just membership.

### 2.10 Recommendations

- TARGETjobs: recruiters "will take notice of this section" [L1]. For students, one recommendation from an internship manager, a hackathon/project lead, a TA or a supervisor is a plus. Zero is normal and should not be penalised for 1st/2nd years. Grade B.
- **Endorsements**: "Recruiters don't pay this much attention" [L1]. Don't score them.
- Input: `screenshot` / `self_report` (not in the PDF export).

### 2.11 Activity and posting norms

- **Posting is not expected for SWE students.** No sector source says engineers are judged on LinkedIn posting. Score zero posts as neutral.
- TARGETjobs says activity can "show recruiters that you have a genuine interest in their sector" [L1]. In SWE the useful forms are technical: a project write-up, a hackathon recap that says what you built and what you learned, sharing a merged PR. Small plus.
- **Risky**: engagement-bait ("Agree?"), "I'm thrilled to announce I solved my 500th LeetCode problem" style posts, reposting AI hype without your own view, or arguing about employers' interview processes. Light penalty only if visible in what the user supplies. Grade C/D.

### 2.12 Contact info, custom URL and Open to Work

- **Custom URL** (`linkedin.com/in/firstname-lastname`): baseline (TARGETjobs recommends customising [L1]).
- **Contact info → Websites**: add GitHub and portfolio here. This is what makes them appear in the PDF export's Contact block (observed, grade D) and is the SWE equivalent of the CV contact line [L10].
- **Open to Work**: LinkedIn offers "Recruiters only" or "All LinkedIn members" (with the #OpenToWork photo frame), and warns "we can't guarantee complete privacy" from recruiters at your current company [L5]. For students, recruiters-only is the safe default. The public frame is not proven to hurt, but there is no evidence it helps either. Don't score it, just advise.

---

## 3. Red flags and myths

### 3.1 Sector red flags

| Red flag | Why it hurts | Grade |
|---|---|---|
| Job titles never held ("Software Engineer" at "Self-employed", "Founder & CTO" of a weekend project, "AI Engineer") | Reads as inflation; contradicts the CV; interviewers probe | D (consistent with GEN-07 "no exaggeration") |
| GitHub link missing, dead, private, or pointing to an empty profile | The profile's main SWE evidence is missing | B [L10][L11] |
| 30+ skills with no project or role using them | Unevidenced; interview risk | B [L7] (tie skills to experiences) |
| Tutorial clones as headline projects ("Netflix clone", "To-do app") with no extension | Signals following, not building | C |
| Headline or About stuffed with company names ("Future Googler", "Targeting Google/Meta/Amazon") | Presumptuous; not evidence | D |
| LinkedIn and CV disagree on dates, titles, grades or projects | Credibility loss on the second look | A (general truthfulness [L2]) |
| AI-generated About with no specifics | Generic; increasingly recognised | C |
| Many certificates, no projects | Course completion ≠ building | D |

### 3.2 Myths and unverified stats

| Claim | Status |
|---|---|
| "Profiles with a photo get 21x more views" (often with "36x more messages, 9x more connection requests") | **Vendor claim, method unpublished.** Reported as LinkedIn's own figure in March 2017 [L15]. I couldn't reach the original LinkedIn page. It is correlational: people without photos also tend to have thinner profiles overall. Fine for UX copy ("LinkedIn says..."), never as a scoring rationale. |
| "Listing your field of study gets you 11x more views" | Repeated by careers blogs; **no primary source found**. Treat as unverified. |
| "Recruiters check GitHub for every student" | **Unverified.** Google recruiters *recommend* linking GitHub [L10], but no source measures how often screeners click. Some recruiters can't evaluate code at all. GitHub matters most at interview, when engineers discuss your projects (Monzo walks through a recent complex project [L12]). |
| "Green contribution squares matter" | **No top-tier source.** Practitioner consensus is that pinned repos and READMEs matter more than streaks. Don't score streaks. |
| "You need to post on LinkedIn to get a tech job" | **No evidence for SWE.** Posting is optional (see §2.11). |
| "Skills-based hiring means degrees don't matter in UK tech" | **Overstated for the UK.** Only 8% of UK recruiter searches filter solely on skills [L7]. Degree and university are still common search filters. |
| "Endorsements boost your ranking with recruiters" | TARGETjobs: recruiters pay little attention [L1]. A peer-reviewed study found skills and endorsements had a negligible relationship with assessors' ratings [L9]. |

**Peer-reviewed anchor.** Roulin & Levashina (Personnel Psychology) found trained assessors could use LinkedIn profiles to infer *visible* skills (leadership, communication, planning) and cognitive ability, but not less visible traits. Profile length, photo and number of connections related to assessments. Listed skills, endorsements and group memberships had negligible impact. They recommend "structured itemized LinkedIn assessment instead of relying on global judgments" [L9]. That last point supports Placed's rule-by-rule approach. The study is not specific to SWE or to UK students.

---

## 4. Differences by year

| Year | What "good" looks like | Scorer adjustments |
|---|---|---|
| **1st year (UG)** | Headline with degree + interest + target (insight programmes, first-year schemes such as Google/Microsoft/Bloomberg first-year events). 1-2 projects (coursework is fine). Societies and hackathons carry the profile. Part-time jobs kept. No recommendations expected. | Projects: ≥1 required (not 2). Activities: **major**. Experience: minor. Recommendations: skip. Grade in Education: optional (A-levels acceptable). |
| **2nd year / penultimate** (the key internship year) | 2-4 projects with stack + outcome + links. Any tech experience (internship, placement, freelance, research assistant) described X-Y-Z. GitHub in Contact info and Featured. Top 3 skills are languages/tech. Year-1 grade shown if ≥ 2:1. | Projects ≥2: **major** (critical if no tech experience and no projects). Headline target season required. Skills evidenced: major. |
| **Placement-year student / final year (UG)** | At least one tech experience entry (internship or placement) with outcomes. If converting an internship, say so ("Returning SWE intern" or "Graduate offer accepted" only if true). Final-year project listed. A recommendation from the internship manager is a plus. | Experience with ≥1 quantified tech outcome: **major**. Recommendations: minor bonus. Activities: minor. |
| **MSc (incl. conversion)** | Lead with the MSc and prior degree; frame previous experience (physics, finance, maths) as an asset with a transferable skill (numerical computing, data). Dissertation/project with stack. Short timeline, so speed matters: graduate schemes open in early autumn. | Don't penalise little tech history. Require ≥1 substantial project (dissertation or MSc group project counts). Headline should state "MSc" + target. |

Year adjustments are grade D (synthesis from [L1][L10][L14] and the CV rule set's year logic).

---

## 5. Recruiter and employer quotes

Only from pages I fetched. All ≤ 25 words.

- Agency recruiter (Simon Katchay, GTI Recruiting Solutions) in TARGETjobs: "often searching for people who fit the specification of what we're looking for" [L1].
- TARGETjobs: "Recruiters don't pay this much attention, so don't go out of your way to seek endorsements." [L1]
- TARGETjobs: "Even if you're not an expert in a skill (such as a coding language), it's worth putting on your profile." [L1]
- Google recruiters (UofT workshop report): "Open-source contributions stand out, so make sure to contribute to open-source projects where you can" [L10]
- Monzo Engineering: hires "for problem-solving ability over experience" [L12]
- University of Birmingham Careers: "Join coding societies, take part in hackathons, or contribute to open-source projects." [L14]
- LinkedIn (Skills Signal): "Be specific. Tie your skills to real experiences, such as projects, roles, or measurable accomplishments." [L7]
- Imperial Careers: always add a note to connection requests, explaining "who you are, how you found them" [L2]

No primary quote about LinkedIn from Google, Meta, Amazon, Bloomberg, Revolut, Monzo or Palantir could be found or fetched. That gap is real, not a search failure to hide.

---

## 6. Sector rule set: LI-SOFTWARE_ENG-xx

These override or extend the generic LinkedIn baseline. "Year adjust" uses: Y1 = 1st year UG, PEN = penultimate year, FIN = final year UG, MSC = masters.

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-SOFTWARE_ENG-01 | **GitHub or portfolio link visible** in Contact info (websites), Featured or About. | RULE: regex `github\.com/[A-Za-z0-9-]+`, `gitlab\.com/`, personal domain, `devpost\.com/`, `*.vercel.app` etc. in the export's Contact block or Summary. If absent from the PDF, ask (self_report) whether it is in Featured. | pdf_export, screenshot, self_report | major | Y1: minor | B | [L10]; [L11]; [L4] |
| LI-SOFTWARE_ENG-02 | **Headline = degree/year/uni + specialism or stack + target.** Contains ≥ 1 tech term from the keyword bank and a target (role type and/or season), and is not just "Student at X". | HYBRID: RULE checks the tech-term and target-pattern (`intern|internship|placement|graduate|SWE|software engineer(ing)? (role|intern)|20\d\d`) and rejects `^student at`. LLM question: "Does the headline tell a recruiter what this student builds and what role they want?" Pass: "2nd-year CS @ UCL \| Go, Python, PostgreSQL \| Seeking 2027 SWE internships". Fail: "Student at UCL". | pdf_export | major | — | B | [L1]; [L3]; [L17] |
| LI-SOFTWARE_ENG-03 | **No title inflation.** Headline and Experience titles don't claim a professional title (Software Engineer, Full-Stack Developer, AI/ML Engineer, CTO, Founder) that isn't backed by a matching, real Experience entry. Personal projects are labelled as projects. | HYBRID: RULE finds title words in headline and entries; LLM question: "Is every professional job title on this profile backed by a real role (employer, dates, description), rather than a personal or course project?" Pass: "Software Engineering Intern · Monzo · Jun-Sep 2026". Fail: headline "Full-Stack Developer" with only a to-do-app project. | pdf_export | major | — | D | (consistent with GEN-07) |
| LI-SOFTWARE_ENG-04 | **≥ 2 technical projects visible** (Projects section, Experience entries or Featured), each with stack, own role, one outcome and a link. | HYBRID: count project entries; LLM grades each: "Does this project say what was built, with what stack, by whom, and with what result?" Pass: "Built a Flask + PostgreSQL ticketing app for the CompSoc; 1,200 users, 4,000 tickets sold; solo; repo link". Fail: "Website project using HTML". | self_report, screenshot (Projects section is probably not in the PDF); pdf_export when projects are in Experience/Summary | major; **critical** when there is no tech experience and no projects | Y1: ≥ 1 project, major; MSC: dissertation counts | B | [L10]; [L11]; [L14] |
| LI-SOFTWARE_ENG-05 | **Featured holds ≥ 1 technical artefact** (repo, live demo, Devpost, technical write-up), not only certificates or announcement posts. | LLM on screenshot: "Does Featured contain at least one item that shows code or a working product?" Pass: pinned GitHub repo with README + live demo link. Fail: only a LinkedIn Learning certificate image. | screenshot, self_report | minor | PEN/FIN: minor; Y1: skip if no projects yet | B/D | [L4]; [L1] |
| LI-SOFTWARE_ENG-06 | **Top 3 (pinned) skills are technical and relevant** (languages, frameworks, CS fundamentals), not office tools or generic soft skills. | RULE: Top Skills from the export vs. keyword bank; fail if any of the 3 is in the noise list (Microsoft Office, Word, Excel*, PowerPoint, Communication, Teamwork, Leadership, Social Media). *Excel allowed for fintech data roles only. | pdf_export | major | Y1: minor | B/D | [L1]; [L7] |
| LI-SOFTWARE_ENG-07 | **Listed languages and frameworks are evidenced.** Each technical skill in Top Skills (and any the user pastes) appears in at least one Experience, Project or Education description. | HYBRID: cross-reference after synonym normalisation (keyword bank §8). Unevidenced share > 50% → fail; 25-50% → partial. | pdf_export (+ self_report for the full skills list) | major | — | B | [L7]; [L1] |
| LI-SOFTWARE_ENG-08 | **Tech Experience entries use X-Y-Z content**: action, stack and a measurable or concrete result, in first person. Not blank, not a duty list. | HYBRID: RULE detects description present + ≥ 1 number or result word + ≥ 1 tech term; LLM question: "Does this entry say what the student personally built or changed, with what tools, and what happened as a result?" Pass: "Cut API p95 latency from 800ms to 220ms by adding Redis caching (Python, FastAPI)". Fail: "Worked on the backend team. Attended stand-ups." | pdf_export | major | Y1: minor (few tech roles expected) | B | [L1]; Google X-Y-Z via `cv-rules-tech-product.md` SWE-08 |
| LI-SOFTWARE_ENG-09 | **Non-tech roles kept, but short**: 1-2 lines with one transferable outcome. Not deleted, not padded to tech length. | HYBRID: RULE flags non-tech roles > ~600 chars; LLM checks one outcome. | pdf_export | minor | Y1/PEN: minor; FIN/MSC: skip | B | [L1] |
| LI-SOFTWARE_ENG-10 | **About is specific**: names what you build, ≥ 1 project or role with a number, a target role and timeframe, and links. ~600-1,200 characters. | HYBRID: RULE length band + number present + link present; LLM question: "Could this About section only describe this student (specific projects, stack, target), rather than any CS student?" Pass: "I build backend services... my CompSoc ticketing app served 1,200 students... looking for 2027 SWE internships in London." Fail: "Passionate, driven CS student eager to leverage cutting-edge technologies." | pdf_export | major | — | C/D | [L1]; [L3] |
| LI-SOFTWARE_ENG-11 | **Education carries SWE signal**: expected graduation date, grade if ≥ 2:1 or year average, 3-6 relevant modules and/or the group or final-year project with stack. | RULE: date present; grade regex (`First|2:1|2\.1|\d{2}%`); module keywords (Algorithms, Operating Systems, Databases, Distributed, Compilers, Machine Learning, Software Engineering). | pdf_export | minor | Y1: grade optional; MSC: dissertation title expected | B | [L1] |
| LI-SOFTWARE_ENG-12 | **Tech activities are named with role or result**: hackathons, tech societies, competitive programming, open source, TA/tutoring. | HYBRID: RULE keyword (hackathon, Devpost, ICPC, UKIEPC, Advent of Code, open source, pull request, CompSoc, TA) in Experience/Summary/Honors; LLM checks role or result ("organiser", "3rd of 60", "merged PR"), not just "member". | pdf_export, self_report | major (Y1, PEN without internship); minor otherwise | Y1: major; FIN/MSC: minor | B | [L14]; [L10] |
| LI-SOFTWARE_ENG-13 | **Certifications are signal, not noise**: cloud vendor exams count as a small plus; > 3 short MOOC/completion certificates with no projects is flagged as noise. | RULE: classify the export's Certifications list (vendor exam vs completion certificate); flag if completion certs > 3 and projects < 2. | pdf_export | minor | — | D | — |
| LI-SOFTWARE_ENG-14 | **Competitive programming / LeetCode is stated as a verifiable result**, if at all (contest rank, rating, ICPC regional placing), not as a problem count in the headline. | HYBRID: RULE detects `leetcode|codeforces|hackerrank` and problem-count patterns (`\d{3,} (problems|questions)`); LLM checks it is a result, not a grind count. Pass: "UKIEPC 2025: 14th of 90 teams". Fail: headline "Solved 600+ LeetCode problems". | pdf_export | minor | — | D | — |
| LI-SOFTWARE_ENG-15 | **Consistent with the CV**: same employers, titles, dates (± 1 month), grade and GitHub URL; no project on one that contradicts the other. | RULE: cross-document diff against the user's Placed CV (entity match on employer, title, dates, URL). LLM for semantic contradictions. | pdf_export (+ CV already in Placed) | major (contradictions on grades or titles: critical) | — | A | [L2]; [L10] |
| LI-SOFTWARE_ENG-16 | **Activity is neutral-to-technical**: no posting is fine; technical write-ups are a small plus; engagement-bait or unprofessional posts are a small minus. | LLM on supplied screenshots only: "Do the visible posts show the student's own technical work or learning, rather than engagement-bait or hype?" Never fail a profile for having no posts. | screenshot | minor | — | C/D | [L1] |
| LI-SOFTWARE_ENG-17 | **Open to Work set to recruiters-only** (advice, not scored). Warn if the public frame is on while the user lists a current internship. | self_report: "Is Open to Work on? Recruiters only or everyone?" Info message only. | self_report, screenshot | minor (info) | — | B (privacy caveat) / D (perception) | [L5] |

### Baseline overrides

| Baseline area | SWE override |
|---|---|
| Endorsements | Don't score (weight 0) [L1][L9]. |
| Recommendations | Y1/PEN: no penalty for zero. FIN/MSC: one relevant recommendation = small bonus. |
| Activity/posting | Lower weight than baseline; zero posts = neutral. |
| Photo | Keep baseline, but no penalty for casual tech dress. |
| Skills count | Prefer 8-20 relevant skills; don't reward > 30. |
| Featured | Raise importance: technical artefact > certificate/announcement. |

---

## 7. Scoring weights suggestion (software_eng)

The baseline weights are set in the generic baseline doc. If it doesn't fix them, I assume a flat starting point and show the SWE deltas. All grade D (synthesis from §1). Calibrate on real profiles.

| Dimension | Assumed baseline | SWE weight | Delta | Rationale |
|---|---|---|---|---|
| Identity (photo, name, URL, location, contact) | 10 | 8 | −2 | Needed, but not a differentiator in tech |
| Headline | 15 | 15 | 0 | Drives search and first impression [L1] |
| About | 15 | 10 | −5 | Read less than evidence; specificity still matters |
| Experience | 20 | 20 | 0 | X-Y-Z tech entries are core |
| **Projects + Featured (evidence of building)** | 10 | **22** | **+12** | Main SWE signal [L10][L11][L14] |
| Skills | 10 | 12 | +2 | Keyword search plus evidenced stack [L7] |
| Recommendations | 5 | 3 | −2 | Rare for students; small bonus |
| Activity | 10 | 3 | −7 | Posting not expected in SWE |
| CV consistency | 5 | 7 | +2 | The second look happens after the CV [L10] |
| **Total** | 100 | 100 | | |

Education and activities/societies feed into Experience/Projects or a baseline Education dimension. If the baseline has a separate Education dimension, take 5 points from About for it.

---

## 8. Keyword bank (software_eng)

Canonical term ← synonyms (normalise before matching). Reuse and extend `cv-rules-tech-product.md` §2 bank. Demand tiers lean on Stack Overflow 2025 and GitHub Octoverse 2025 [L18] (grade C).

- **Languages:** Python · Java · C++ ← cpp · C · C# ← csharp, .NET · JavaScript ← JS · TypeScript ← TS · Go ← Golang · Rust · Kotlin · Swift · Scala · SQL · Bash ← shell scripting · Haskell/OCaml (signal for some trading-firm developer roles)
- **Frameworks/libraries:** React ← React.js · Node.js ← Node · Next.js · Express · Django · Flask · FastAPI · Spring ← Spring Boot · .NET · Angular · Vue · React Native · Flutter · gRPC · GraphQL
- **Data/storage:** PostgreSQL ← Postgres · MySQL · SQLite · MongoDB · Redis · Kafka · Elasticsearch · DynamoDB
- **Infra/cloud:** AWS ← Amazon Web Services, EC2, S3, Lambda · GCP ← Google Cloud · Azure · Docker ← containers · Kubernetes ← K8s · Terraform ← IaC · Linux ← Unix, Ubuntu · CI/CD ← GitHub Actions, GitLab CI, Jenkins · Vercel · Nginx
- **Practice:** Git ← GitHub, GitLab, version control · unit testing ← pytest, JUnit, Jest, TDD · code review · Agile ← Scrum, sprints · REST ← RESTful API · microservices · system design · observability ← monitoring, logging, Prometheus, Grafana
- **CS fundamentals:** data structures and algorithms ← DSA · operating systems · concurrency ← multithreading · distributed systems · networking ← TCP/IP · compilers · databases · object-oriented programming ← OOP · functional programming
- **Proof terms:** hackathon · Devpost · open source ← open-source contribution, merged PR, pull request · ICPC · UKIEPC · Advent of Code · Kaggle · deployed ← live, in production, App Store, Play Store · users · latency · throughput · uptime
- **Role/target terms (UK):** software engineering intern ← SWE intern, software developer intern · industrial placement ← placement year, year in industry, sandwich year · graduate software engineer ← graduate developer, technology graduate programme · spring/insight programme ← discovery programme, first-year programme · backend · frontend · full-stack · mobile · infrastructure ← platform, SRE, DevOps · fintech
- **Noise list (don't reward):** Microsoft Office · Word · PowerPoint · computer literacy · social media · "passionate" · "tech enthusiast" · "coding ninja/rockstar" · "Future [Company]"

---

## 9. Worked example: weak 2nd-year profile → improved

Fictional student: Aisha, 2nd-year BSc Computer Science at a Russell Group university, Year 1 average 68%. One part-time retail job, two projects, a hackathon, no internship yet. Target: Summer 2027 SWE internships in London.

### 9.1 Before (as it would appear in the PDF export)

- **Headline:** `Student at University of Manchester`
- **Contact:** linkedin.com/in/aisha-k-3b82a1190 (no websites)
- **Top Skills:** Microsoft Excel · Teamwork · Communication
- **Certifications:** Python for Everybody (Coursera) · Intro to SQL (LinkedIn Learning) · HTML Essentials (Sololearn) · JavaScript Basics (HackerRank)
- **Summary:** "Hardworking and passionate computer science student with a keen interest in technology and innovation. I am a fast learner and team player looking for opportunities to grow."
- **Experience:** Sales Assistant, Boots, Sep 2025-present. "Responsible for customer service, stock replenishment, working the till and helping customers find products in a busy store environment while maintaining high standards."
- **Education:** University of Manchester, BSc Computer Science, 2025-2028. (No grade, no modules.)
- **Not visible in PDF:** a Projects section with "Weather app" (no description) and "Website"; no Featured.

**Score walk-through (SWE rules):**
- 01 GitHub link: **fail** (major).
- 02 Headline: **fail** (major).
- 04 Projects: **fail** (2 entries, no stack, outcome or link; critical because there's no tech experience).
- 06 Top skills: **fail** (all noise).
- 07 Skills evidenced: N/A for noise skills; no languages listed.
- 08 Tech experience X-Y-Z: N/A (no tech roles).
- 09 Non-tech role short with outcome: **fail** (long duty list).
- 10 About specific: **fail**.
- 11 Education: **partial** (no grade or modules).
- 12 Tech activities: **fail** (hackathon not mentioned anywhere).
- 13 Certifications: **flag** (4 completion certs, < 2 described projects).

Rough SWE score: ~30/100.

### 9.2 After

- **Headline:** `2nd-year CS @ University of Manchester | Python, TypeScript, PostgreSQL | Built a study-room booking app used by 900 students | Seeking Summer 2027 SWE internships`
- **Contact → Websites:** github.com/aishak · aishak.dev
- **Top Skills (pinned):** Python · TypeScript · PostgreSQL
- **Other skills:** React, Node.js, Flask, Git, Docker, SQL, Data Structures & Algorithms, Linux, pytest
- **Summary:**
  > I'm a second-year Computer Science student at Manchester who likes building small, useful web services and making them fast.
  >
  > Last term I built RoomFinder, a study-room booking app (React, Flask, PostgreSQL, Docker) that 900 students used in exam season; I cut page load from 3.1s to 0.9s by adding server-side caching. At [Hackathon name] 2026 my team of 4 placed 2nd of 38 with a bus-delay predictor built on TfL open data.
  >
  > Right now I'm learning about distributed systems (COMP module + a Raft implementation in Go on my GitHub).
  >
  > I'm looking for software engineering internships in London for summer 2027. Code: github.com/aishak · Email: aisha.k.dev@gmail.com
- **Projects** (also copied as two lines into Summary so they survive the PDF export):
  - *RoomFinder*: solo. React + Flask + PostgreSQL, Dockerised, deployed on Render. 900 users, 2,300 bookings in 6 weeks; p95 page load 3.1s → 0.9s via caching. Link to repo + live demo.
  - *TfL Delay Predictor* (hackathon, team of 4): built the Python data pipeline and a scikit-learn model (MAE 2.4 min); 2nd of 38 teams. Devpost link.
- **Featured:** RoomFinder repo (README with screenshots) · Devpost page · a short post "What I learned scaling RoomFinder to 900 users"
- **Experience:** Sales Assistant, Boots, Sep 2025-present: "Handled 100+ customers per shift on weekends; trained 3 new starters on the till system." (2 lines)
- **Activities (in Experience or Honors):** Hackathon 2nd place (Mar 2026); CompSoc events volunteer.
- **Education:** University of Manchester, BSc Computer Science, expected Jun 2028. Year 1 average: 68% (2:1). Modules: Algorithms and Data Structures, Databases, Software Engineering (team project: Java Android app).
- **Certifications:** trimmed to none, or one AWS Cloud Practitioner if earned.

**What changed and why:** headline formula (rule 02); GitHub/portfolio in Contact (01); projects with stack, role, outcome and link, mirrored in Summary because the Projects section is probably missing from the export (04, §0 caveat 3); technical top skills, each evidenced in a project (06, 07); specific About (10); retail job cut to two lines with numbers (09); grade and modules (11); hackathon placed and visible (12); certificate noise removed (13).

Rough SWE score: ~80/100. The remaining gap is no tech experience yet and no recommendation, both normal for the year.

---

## 10. Implementation notes for Placed

1. **Validate the PDF export coverage first.** Export 5+ real profiles (different section mixes) and record which sections appear. If Projects/Volunteering are absent (as I expect), the UI should ask the student to paste them or upload a screenshot before scoring LI-SOFTWARE_ENG-04/05.
2. **Cross-document checks are the cheapest high-value rules.** LI-SOFTWARE_ENG-15 can reuse the parsed CV already stored in Placed.
3. **Don't fetch GitHub** in the MVP. Just check a link exists. Fetching (public, non-empty, README present) is a later enhancement and needs rate-limit and privacy thought.
4. **Tell the user what LinkedIn is for in SWE** (UI copy): "For software roles your CV, coding test and GitHub decide most outcomes. LinkedIn is the second look and your route to alumni referrals. Make it consistent and make your projects easy to find."
5. All LLM rules above are phrased as one yes/no question with a pass and a fail example, matching the `llmGuidance` / `passExample` / `failExample` fields in `lib/cv-rules/types.ts`.

---

## 11. Sources

All accessed 2026-10-14. "Fetched" means I read the page; "excerpt" means I saw only a search-result summary and did not quote it.

- **[L1]** targetjobs editorial team, "The graduate's guide to creating the perfect LinkedIn profile", targetjobs (GTI), 11 Aug 2026. http://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile. Fetched. Quotes recruiter Simon Katchay (GTI Recruiting Solutions) and Joanne Eaton (University of Hertfordshire). Cites Cibyl UK Graduate Survey 2021 (79% of 67,688 students use LinkedIn for careers).
- **[L2]** Noemie Oster, "Maximise your LinkedIn profile", Imperial College London Careers Service, 15 Mar 2024. https://imperial.ac.uk/news/252093/maximise-your-linkedin-profile. Fetched.
- **[L3]** University of Edinburgh Business School, "LinkedIn" (student development page), undated. https://development.business-school.ed.ac.uk/linkedin/. Fetched. Headline 200 characters, About 2,000 characters.
- **[L4]** LinkedIn Help, "Featured section" (answer 111587), LinkedIn, current as of 2026. https://www.linkedin.com/help/linkedin/answer/111587. Fetched.
- **[L5]** LinkedIn Help, "Let recruiters know you're open to work" (answer a507508), LinkedIn, current as of 2026. https://www.linkedin.com/help/linkedin/answer/a507508. Fetched.
- **[L6]** LinkedIn Help, "Save a profile as a PDF" (answer a541960), LinkedIn, current as of 2026. https://www.linkedin.com/help/linkedin/answer/a541960. Fetched. Doesn't list included sections.
- **[L7]** LinkedIn Economic Graph, "The Skills Signal: Unlocking opportunity in a changing labor market", LinkedIn (with OECD Centre for Skills), June 2025. https://economicgraph.linkedin.com/content/dam/me/business/en-us/talent-solutions/resources/pdfs/the-skills-signal-report-2025.pdf. Fetched (PDF text extracted). UK 8% skills-only search share; average skills on profiles 5→9 (2019-2024); 10 skills ↔ one-month shorter employment gap (correlational, general workforce).
- **[L8]** LinkedIn Talent Solutions, "The Future of Recruiting 2023". Excerpt only, via trade press (recruiters 25% more likely to search by skills than three years earlier). Not fetched; not used in rules.
- **[L9]** Roulin, N. & Levashina, J., "LinkedIn as a new selection method: Psychometric properties and assessment approach", *Personnel Psychology* 72(2), 2019 (online 2018). Summary fetched from Kent State University news: https://www.kent.edu/business/news/kent-state-researcher-studies-linkedin-employee-selection-tool. DOI (10.1111/peps.12296) is from memory: verify before citing in UI.
- **[L10]** UofT Teaching Labs Ambassadors, "Google Resume Workshop" (report of a talk by Google recruiters), University of Toronto, 17 Sep 2025. https://www.teach.cs.toronto.edu/ambassadors/blog/2025-events/google_resume_workshop. Fetched. Secondary report; North American audience.
- **[L11]** targetjobs editorial team, "Tips for a graduate technical CV: template and advice", targetjobs, 26 Nov 2025. https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice. Fetched.
- **[L12]** Jamie McDonald, "Preparing for mobile interviews at Monzo", Monzo blog, 29 Jan 2025. https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo. Fetched.
- **[L13]** Brittany Bunch, "8 things Amazon recruiters say top job candidates do", About Amazon, undated (c. 2023-24). https://aboutamazon.com/news/workplace/successful-amazon-job-candidates. Fetched; no LinkedIn mention.
- **[L14]** University of Birmingham Careers Network, "IT & computing sector" (sector insights), undated. https://intranet.birmingham.ac.uk/student/careers/sector-insights/it-computing.aspx. Fetched.
- **[L15]** Search Engine Journal, "LinkedIn adds profile picture filters" (reports LinkedIn's 21x views / 36x messages / 9x connection-request figures), 15 Mar 2017. https://www.searchenginejournal.com/linkedin-profile-picture-filters/190137/. Fetched. Trade press reporting a vendor claim; the original LinkedIn page returned an error.
- **[L16]** Bloomberg, "Software Engineer Intern" listing (London), via Bright Network / RateMyPlacement, 2024 cycle. https://www.brightnetwork.co.uk/graduate-jobs/bloomberg/2024-software-engineer-intern. Excerpt only (403/redirect). Grade B−.
- **[L17]** Bright Network, "How to build a CV and LinkedIn profile for the tech industry", Bright Network, undated. https://brightnetwork.co.uk/graduate-career-advice/stem-advice/building-cv-linkedin-tech. Excerpt only (403): pipes in headline; avoid "Student at [University]". Not quoted.
- **[L18]** Stack Overflow, "2025 Developer Survey: Technology", 2025, https://survey.stackoverflow.co/2025/technology; GitHub, "Octoverse 2025", GitHub Blog, 28 Oct 2025, https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/. Figures reused from `cv-rules-tech-product.md` [S17][S18]; not re-fetched today. Grade C for student relevance.
- **[L19]** Bright Network, "LinkedIn for students and graduates", undated. https://www.brightnetwork.co.uk/graduate-career-advice/key-career-skills/how-stand-out-graduate/linkedin-for-students-graduates/. Excerpt only (403): alumni tool, personalised connection notes.

---

## 12. Evidence gaps

- No primary LinkedIn-profile guidance from any target SWE employer (Google, Meta, Amazon, Bloomberg, Monzo, Revolut, Palantir). Bloomberg, Revolut and Bright Network pages were blocked (403).
- What LinkedIn's "Save to PDF" includes is undocumented by LinkedIn. My section list is observed behaviour (grade D) and must be tested.
- No data on how often student SWE screeners open LinkedIn or GitHub links.
- No UK source on whether the public #OpenToWork frame helps or hurts students.
- The headline character limit (200 per Edinburgh vs 220 widely reported) is unconfirmed on a LinkedIn page.
- The 21x photo stat's original LinkedIn page is unreachable; the method was never published.
- The scoring weights are synthesis and need calibration against real outcomes.
- The web-search budget ran out mid-research, so Gradcracker, Prospects and ISE pages on LinkedIn for tech weren't checked.
