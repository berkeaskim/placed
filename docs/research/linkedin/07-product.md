# LinkedIn Profile Rules: Product Management / APM (archetype `product`)

Scope: UK undergraduates and masters students (1st year to final year) who want product roles in 2026-27: APM / product internships (Google APM BS/MS Intern London), rotational programmes (Meta RPM), graduate product schemes (e.g. Capital One UK Graduate Product Manager), and product or product-adjacent roles at fintechs, scale-ups and start-ups (Monzo, Deliveroo, Skyscanner and others).
Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. This is not recruiting advice.
Rule IDs: `LI-PRODUCT-xx`. These rules override or add to the generic LinkedIn baseline (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency).

---

## 0. Conventions and honest caveats

Conventions follow `docs/research/cv-rules-finance-consulting.md` section 0.

- **Check**: `RULE` = deterministic (regex, section parser, counts, keyword match). `LLM` = model judgement, written so it can become one yes/no question with a pass example and a fail example. `HYBRID` = code extracts, then the LLM grades.
- **Input**: which input can check the rule. `pdf_export` = LinkedIn's "Save to PDF". `screenshot` = the user's screenshots of profile sections. `self_report` = the user answers a question in Placed. We never scrape LinkedIn.
- **Severity**: `critical` = likely to cost the candidate an opportunity on its own. `major` = clearly weaker than peers. `minor` = polish.
- **Evidence**: `A` = the employer's own guidance, or consistent across several top-tier UK careers sources. `B` = one top-tier source. `C` = practitioner or trade press. `D` = my synthesis, with no direct source.
- Citations `[Px]` are listed in section 10. All pages were accessed on 2026-10-14. Quotes are verbatim, 25 words or fewer, and come only from pages I actually fetched (text checked with curl, not just a summariser).

**Caveats, stated first**

1. **No product employer I could find says anything public about how it reads LinkedIn profiles.** Google's London APM intern posting asks for "an updated CV or resume and a current unofficial or official transcript" [P1], and the page does not mention LinkedIn. Monzo's PM hiring post talks about the application, not LinkedIn [P4]. Capital One's graduate PM profile talks about skills, not LinkedIn [P5]. So the **employer evidence (grade A) is about what product employers value**. Turning that into LinkedIn rules is mostly my synthesis (grade D), plus general LinkedIn guidance from TARGETjobs [P7] and LinkedIn Help [P8].
2. **Entry-level PM roles are rare in the UK.** Prospects: "It's extremely unusual for an employer to recruit a product manager without at least two years of relevant experience" [P6]. Most students who want product will also apply for product analyst, business analyst, tech consulting and rotational graduate schemes. The profile should be findable under those searches too (LI-PRODUCT-17).
3. **Programme locations change from year to year.** The Google APM *intern* role for Summer 2027 is in London [P1]. The 2026-start APM *graduate* role I could verify lists only US locations [P2]. The Meta RPM posting I fetched (a VC job-board mirror) does not show locations [P3]. I could not confirm a 2026-27 London RPM intake, and I found no current dedicated graduate APM scheme at Monzo, Deliveroo or Skyscanner. Monzo's open roles page lists experienced roles [P4b]. Skyscanner's graduate programme (2023 intake) rotated graduates through areas that included "Product Development" [P12]. Treat firm names as examples, not as live vacancies.
4. **Much PM career content is US-centric** (US APM programmes, Lenny's Newsletter, Exponent, Leland). I used it only as background and cite none of it as evidence. The single practitioner source I cite [P13] is grade C.
5. **Popular LinkedIn statistics are LinkedIn's own marketing claims.** They are correlational, and they disagree with each other (see section 3). None of them is used as a scoring rationale.
6. **What the PDF export contains (please verify).** From exports I have seen (grade D), "Save to PDF" includes: name, headline, location, contact/LinkedIn URL, **Top Skills (only 3)**, Languages, Certifications, Honors-Awards, Publications, Summary (About), Experience (with descriptions) and Education. It **does not include** the photo, banner, Featured, Activity/posts, the full skills list, endorsements, or (I believe) Recommendations and Projects. **The team should confirm this against a fresh export before shipping.** Any rule about Featured, posts, photo or banner is tagged `screenshot` / `self_report`.

---

## 1. How much LinkedIn matters for product (sourcing vs screening vs networking)

**Overall: medium.** LinkedIn matters less than the CV and the interviews at the formal screen. It matters more than in banking for being found, getting referrals, and showing that you build things.

| Channel | Importance for student PM roles | Evidence |
|---|---|---|
| **Screening** (does a recruiter read your LinkedIn when deciding on your application?) | **Low to medium.** Structured programmes screen on the CV, transcript and form. Google asks for a CV and a transcript and nothing else [P1]. Monzo's hiring team "will review your application" [P4]. Skyscanner graduates applied with a "CV and Cover Letter" [P12]. A recruiter *may* click the profile link on your CV. If they do, the profile needs to match the CV and back it up. | A (on process) / D (on clicking the link) |
| **Sourcing** (recruiters searching for you) | **Medium.** TARGETjobs quotes a recruiter: "What we're doing on LinkedIn is often searching for people who fit the specification" (degree, experience, location) [P7]. Google says "our recruiters might reach out if we find a different potential match for your skills, interests, and experience" [P1], but that refers to the applicant pool, not LinkedIn. Start-ups and scale-ups hire many junior product people through founders' networks and inbound messages (D, anecdotal). | B / D |
| **Networking and referrals** | **Medium to high.** Prospects says "Networking and speculative applications might also help", and that employers want "your ideas for the development of their products" [P6]. Monzo runs a "Generalist pipeline" for speculative applications [P4]. Teardowns and shipped projects posted on LinkedIn give you something to talk about in a cold message. | B / D |
| **Proof of work** (Featured, projects, writing) | **Medium.** It is the one place outside the CV where a student can *show* a shipped product, a teardown or a demo. Google's minimum qualifications ask for "entrepreneurial efforts" and "technical presentations" [P1], both of which are easier to evidence with links. | A (what they value) / D (LinkedIn as the venue) |

What firms say (only what I could verify):
- **Google (APM BS/MS Intern 2027, London)** [P1]: needs a CV plus transcript, and says "Please include your expected graduation date (month and year) and availability for the internship on your resume." Its minimum qualifications include TA or internship experience in a technical field, "preparing and delivering technical presentations", and "leading entrepreneurial efforts or outreach within organizations". It prefers "Experience applying AI/ML concepts to build products or features through relevant internships, capstone project, or other academic work." It does not mention LinkedIn.
- **Meta RPM** [P3]: "We encourage candidates who have non-traditional career paths to apply". It requires "Experience breaking down large-scale data sets and making decisions based on data". It does not mention LinkedIn.
- **Monzo (PM hiring, experienced roles)** [P4]: "make sure to include what products you've worked on, and the impact of those products. We love to see quantifiable results". It also says: "There isn't 'one type' of Product Manager we hire for".
- **Capital One UK (Graduate PM, via TARGETjobs)** [P5]: "a tech background is not necessary for success". The graduate lists communication, analytical skills and teamwork as the key skills.
- **TARGETjobs (UK, 2026)** [P7]: complete profiles are "given priority in recruiters' searches". It says the profile "should not be tailored to a specific role at a specific employer", and that recruiters "don't pay [endorsements] much attention".

---

## 2. What a strong student product profile looks like, section by section

### 2.1 Photo and banner (screenshot only)
- **Photo:** a clear, friendly, head-and-shoulders photo. TARGETjobs: "Aim for approachable, relaxed and friendly", and avoid passport-style or night-out photos [P7]. LinkedIn Help says a photo "increases the credibility of your profile" [P8]. There is nothing product-specific here, so this is baseline.
- **Banner:** optional. A product-flavoured banner is a small bonus: a screenshot of your app, a simple "what I build" strip, or a university or hackathon photo. TARGETjobs suggests "a photo of a project that you were involved in" [P7]. Don't score it beyond `minor`.

### 2.2 Headline (pdf_export)
**Formula (D, building on TARGETjobs's "current role or where and what you are studying, what you're interested in and what you're hoping to find" [P7]):**
`[Year/degree @ university] | [product focus or role target] | [one proof point: shipped thing + number, or product internship] | [what you're seeking + when]`
Use real role keywords that recruiters type: Associate Product Manager, Product Manager Intern, Product Analyst. Keep the key part within the first ~70 characters, because headlines are truncated in search and comment views (D, observed).

**Good**
1. `Economics @ UCL '27 | Product & growth | Built a society booking app used by 400+ students | Seeking APM / product internships, Summer 2027`
2. `CS @ Imperial '27 | Product + data | Shipped a Chrome extension (1.2k weekly users) · SQL · A/B testing | Product Manager Intern 2027`
3. `MSc Business Analytics @ LSE | Product Analyst intern @ fintech | User research, SQL, Figma | Graduate APM & Product Analyst roles 2027`

**Bad**
1. `Aspiring Product Manager | Passionate about tech | Innovator | Problem solver`. Every word is a self-assessment with no proof and no university. It reads as generic.
2. `Founder & CEO @ StudyBuddy`. This is a solo project with no users. Title inflation like this is what interviewers probe (see LI-PRODUCT-02).
3. `Student at University of Manchester`. This is LinkedIn's default. It has no role keyword, so the profile won't show up in a search for "product".

### 2.3 About (pdf_export, as "Summary")
- **Length:** 2 short paragraphs, plus an optional 3-5 line "What I've built" list. Roughly 80-200 words. LinkedIn Help: "Ideally, you should limit the text to one or two paragraphs" [P8]. Over ~300 words counts as `minor` (D).
- **Structure (D):**
  1. A first line that works as the hook (it shows before "see more"): the product focus plus your best proof.
  2. How you work as a builder: users you talked to, what you shipped, the metric you watched.
  3. Skills that are evidenced elsewhere on the profile: SQL, Figma, experimentation, AI tools.
  4. What you're looking for, and when: "Product / APM internships for Summer 2027, London".
- Avoid "passionate", "visionary", "results-driven", and framework lists with nothing applied (RICE, JTBD, AARRR).

### 2.4 Experience (pdf_export)
**How it differs from CV bullets (B + D):** TARGETjobs says to give context, use "I" not "we", and talk about "responsibilities, achievements and results" [P7]. Unlike the CV, LinkedIn has no one-page limit and should be a growing record [P7]. For product specifically:
- Give each role a **one-line context sentence** (what the product or team was, who its users were), then **2-4 outcome bullets**. You may add a short "Decision I owned" line. That line is the thing a CV doesn't have room for.
- **Projects count as experience.** Add a shipped side project, hackathon or society product as an Experience entry ("Builder, [Project name]", self-employed or "Personal project"). That way it appears in the PDF export and in recruiter search. Never title it "Product Manager" or "CEO" unless other people worked under you and the product had users (LI-PRODUCT-02).
- Part-time and non-tech jobs belong too (TARGETjobs [P7]). Reframe them around customers and process ("Noticed 30% of click-and-collect complaints came from one step; proposed a fix the manager adopted").

### 2.5 Featured (screenshot / self_report)
The most product-specific section, and not in the PDF export. Strong items:
1. **A live product link** (app, website, Chrome extension, no-code tool) with a one-line description and a usage number.
2. **A product teardown or improvement proposal** (a LinkedIn article, PDF or Notion page): core flow, competitor comparison, a prioritised set of changes, and the metric each change should move.
3. **A demo video or pitch deck** from a hackathon or society. This is evidence of "technical presentations" [P1].
2-4 items, newest and strongest first. Weak items: certificates, generic "my journey" posts, reshared company content.

### 2.6 Skills (pdf_export shows only Top 3; full list via screenshot)
TARGETjobs suggests "between five and ten key skills" and warns against listing every skill [P7]. LinkedIn says people with at least five skills get "up to 17x more profile views" [P9]. That is a 2016 claim by LinkedIn itself and is correlational. **Pin your 3 strongest product skills as Top Skills.** Those 3 are the only skills that appear in the PDF.

**Top 10 for product (my ranking, D, grounded in the employer qualification lists [P1][P3][P4][P5]):**

| # | Skill | Table-stakes or differentiator | Why |
|---|---|---|---|
| 1 | Product Management | table-stakes (keyword) | Recruiter search term |
| 2 | User Research | table-stakes | Prospects: knowing your users [P6] |
| 3 | Data Analysis | table-stakes | Meta: "decisions based on data" [P3]; Capital One analytical skills [P5] |
| 4 | SQL | **differentiator** for students | Lets you pull your own data; few non-CS students show it |
| 5 | A/B Testing / Experimentation | **differentiator** | Monzo lists growth experiments and A/B testing [P4] |
| 6 | Figma / Wireframing | differentiator (medium) | Shows you can prototype without engineers |
| 7 | Stakeholder Management / Cross-functional Collaboration | table-stakes | Google, Capital One [P1][P5] |
| 8 | Product Analytics (Amplitude, Mixpanel, GA4) | differentiator | Tool-level evidence of metrics work |
| 9 | AI / LLM product prototyping | **differentiator, rising** | Google lists applying AI/ML to build products as preferred [P1] |
| 10 | Agile / Scrum, Jira | table-stakes (low signal) | Common in postings; weak unless used in a team project |

Python and APIs are a bonus, especially for technical PM roles. "Microsoft Office", "Leadership", "Teamwork" and "Problem Solving" as stand-alone skills are noise.

### 2.7 Certifications (pdf_export)
- **No product employer I checked asks for any product certification** [P1][P3][P4][P5]. Grade D: certifications are neutral at best.
- **Worth listing (minor bonus):** short technical courses that back up a claimed skill, such as a SQL course, an analytics certificate, or an AI/ML course you used in a project. Keep it to 2-3.
- **Noise:** stacks of LinkedIn Learning badges, "Product Management Fundamentals"-type certificates with no applied project, and paid "PM bootcamp" certificates with no project to show for them. Flag when certificates are more than 5 and there are no projects (LI-PRODUCT-15b).

### 2.8 Education (pdf_export)
- Degree, university, **expected graduation month and year**. Google asks for this on the CV [P1], and the internship requires "penultimate/final year" [P1].
- Grade or current average **if 2:1/First or above**. TARGETjobs recommends module and dissertation detail "including scores" [P7].
- **2-4 relevant modules**: HCI/UX, statistics or econometrics, ML, databases, microeconomics, marketing, entrepreneurship.
- **A non-CS degree is fine.** Meta and Capital One say so explicitly [P3][P5]. Google's degree list is technical but includes "or a related technical field" [P1] (see LI-PRODUCT-14).

### 2.9 Activities and societies
List them in Experience (preferred, because Experience appears in the export) or in Education's "Activities and societies". The strongest signals: tech/product/entrepreneurship society **committee** roles that shipped something (app, event platform, newsletter with an open-rate number), Enactus, hackathon "product lead", and running a small business. Prospects: "starting a business, even on a very small scale" [P6]; Google: "leading entrepreneurial efforts" [P1].

### 2.10 Recommendations (screenshot / self_report)
Optional. One recommendation from a hackathon teammate, start-up founder, internship manager or society president that describes **a product decision you made** is a minor bonus. TARGETjobs: recommendations from friends "are unlikely to hold much water" [P7]. Not scored by count.

### 2.11 Activity and posting norms (screenshot / self_report)
**Neutral-to-positive, never required.** No product employer I checked expects students to post (D). Posting teardowns, build logs ("shipped v2, here's what the retention data said") or event reflections with a real insight is a **small positive**: it shows product thinking and gives you a reason to message people. TARGETjobs says activity "will also show recruiters that you have a genuine interest in their sector" [P7].
**Risky:** engagement-bait, ranting about employers or rejections, AI-generic "10 lessons" posts, and sharp criticism of products made by companies you're applying to. Score posting only as a minor bonus. Score unprofessional content as a minor or major flag. **Never penalise a candidate for not posting.**

---

## 3. Sector red flags and myths

**Red flags (D unless noted)**
1. **Title inflation:** "Product Manager", "Founder & CEO" or "Head of Product" for a solo course project or a 3-person society. Interviews probe it, and it makes the rest of the profile less believable.
2. **Framework soup:** RICE, MoSCoW, JTBD, AARRR, North Star listed in the About or skills with no example of using them (mirrors PRD-09b in the CV rules).
3. **"Aspiring PM" with zero artefacts:** no project, no teardown, no customer-facing role. The claimed interest has nothing behind it.
4. **Responsibility-only descriptions** ("Responsible for social media"). TARGETjobs: "Don't waffle on about your day" [P7].
5. **LinkedIn contradicts the CV:** different titles, dates, user numbers or project names.
6. **Dead links in Featured:** a product link that 404s, or a demo that no longer loads. This is very bad for a "builder" claim.
7. **Only wanting big-tech APM:** a headline that names only "Google APM" can exclude you from product-analyst and scale-up searches (Prospects on adjacent routes [P6]).

**Myths and unverified statistics**
- **"Profiles with photos get 21x more views."** This was LinkedIn's own claim, reported in 2017 [P10]. LinkedIn Help **now** says members with a photo "receive up to 2X more profile views" [P8]. The figures conflict, no methodology has been published, and the result is correlational. **Treat it as unverified. Never show it as fact.**
- **"5+ skills means 17x more profile views."** This is a 2016 LinkedIn claim [P9]. It is correlational and a decade old, so use it as UX colour at most.
- **"You need a CS degree for product."** Capital One [P5] and Meta [P3] say otherwise. Google's APM list is technical but allows "related technical field" [P1].
- **"PM certifications get you hired."** No employer I checked mentions them (D).
- **"You must post daily to get noticed."** There is no employer evidence. Posting is optional (D).
- **"Tailor your LinkedIn to each application."** TARGETjobs says the profile "should not be tailored to a specific role at a specific employer" [P7]. Make it product-focused but not employer-specific.
- **"The green #OpenToWork frame hurts you."** This is a common opinion with no evidence either way. For students it is fine. Recruiters-only visibility is a neutral default (D).

---

## 4. Differences by year

| Year | Realistic target | What "good" looks like on LinkedIn | Scoring adjustments |
|---|---|---|---|
| **1st year** | Insight events, hackathons, society roles, first side project | A clean profile, a headline that names product interest, one project or society role with an outcome, a 5-10 skill list. Featured is optional. | Proof-of-work rules (03, 04, 06) drop to **minor**. "Interested in product" in the headline is acceptable. No penalty for no internship. |
| **2nd year / penultimate** | **Peak year:** Google APM intern (penultimate/final [P1]), product internships, start-up summer roles, placement years | At least one shipped artefact with a number. A product arc in at least one entry. SQL or analytics evidence. Expected graduation date. Headline says what you're seeking and when. | Base severities apply. LI-PRODUCT-13 (education detail) becomes **major**. |
| **Final year** | Graduate PM schemes (e.g. Capital One), RPM/APM where open, product analyst / BA / tech consulting | Internship or placement outcomes up top. Keywords cover adjacent titles. A recommendation from an internship manager is a bonus. | Proof-of-work (03, 04) and LI-PRODUCT-17 (adjacent framing) go **up one level**. |
| **Masters (1-year)** | Graduate schemes and APM/RPM, often straight away | The undergrad story plus the masters' analytics/AI modules. Any pre-masters work experience is framed in product terms. | Same as final year. The AI/ML bonus (07) is weighted higher for analytics/CS masters. |

---

## 5. Rule set: LI-PRODUCT-xx

No rule is `critical`. The formal product screen runs on the CV, the transcript and the interviews (section 1), so a LinkedIn gap on its own is unlikely to cost an offer. The exception is a direct contradiction with the CV (LI-PRODUCT-15), which is raised to critical.

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-PRODUCT-01 | **Headline names a product target plus one proof point.** It contains a role keyword (product / APM / product analyst) **and** either a shipped thing, a product internship or a concrete skill. It is not only "Student at X" and not only adjectives. LLM question: *"Does the headline say what product role they want AND give at least one concrete proof (a project, internship or skill)?"* Pass: `Econ @ UCL '27 \| Built booking app used by 400+ students \| Seeking APM internships 2027`. Fail: `Aspiring PM \| Passionate about tech \| Innovator`. | HYBRID: RULE role-keyword regex; LLM checks for proof | pdf_export | major | 1st yr: role keyword alone passes (minor) | B (TARGETjobs headline + "mention a specific job title" practice) / D | [P7] |
| LI-PRODUCT-02 | **No title inflation.** "Product Manager", "Founder/CEO" or "Head of Product" is used only when other people worked on it and there is evidence of real users, customers or a team. LLM question: *"Is any PM/founder/CEO title backed by evidence of other team members AND real users?"* Pass: `Co-founder, StudyBuddy (3-person team, 400 users)`. Fail: `CEO & Founder, MyApp`, where the description shows a solo coursework prototype. | LLM | pdf_export | major | all years | D (mirrors PRD-09a) | [P14] |
| LI-PRODUCT-03 | **At least one shipped artefact is visible**: a live product, prototype, extension or no-code tool, shown in Featured or as an Experience/Project entry, with a link or usage evidence. LLM question: *"Is there at least one thing the candidate built that a user could try, with evidence it was used or tested?"* Pass: an Experience entry "Builder, Commute Buddy (personal project): Chrome extension, 1.2k weekly users", or a Featured link. Fail: only courses and society memberships. | HYBRID: RULE finds URLs and build verbs in Experience; screenshot or self_report covers Featured | pdf_export, screenshot, self_report | major | 1st yr: minor; final/masters: major (stays major; it is the main differentiator) | A (what employers value: entrepreneurial efforts, starting a business) / D (LinkedIn venue) | [P1] [P6] [P13] |
| LI-PRODUCT-04 | **At least one entry tells a product story**: user problem, then evidence (research/data), then a decision you made, then what shipped, then a metric. LLM question: *"Does at least one entry name a user problem, the candidate's decision, and a measured result?"* Pass: "Interviewed 12 members; found sign-ups dropped at payment step; I cut the form from 9 to 4 fields; sign-up completion rose from 41% to 63%." Fail: "Worked on the society app. Responsible for features." | LLM | pdf_export | major | 1st yr: minor; final: major | B (Monzo: products worked on + impact) / D | [P4] [P14] |
| LI-PRODUCT-05 | **Quantified outcomes in Experience.** At least 2 entries, or at least 40% of description bullets, contain a number tied to an outcome (users, %, £, time, n interviewed). | RULE: digit/%/£ density in Experience descriptions; LLM confirms the number is an outcome, not a date | pdf_export | major | 1st yr: at least 1 entry | A (Monzo "quantifiable results"; TARGETjobs "achievements and results") | [P4] [P7] |
| LI-PRODUCT-06 | **Data literacy is evidenced, not just listed.** SQL / analytics / A-B testing appears in skills **and** in at least one entry where it was used. LLM question: *"Is a data skill (SQL, analytics, experiments) shown being used in an entry?"* Pass: "Wrote SQL against 18k orders to find repeat-purchase drop-off". Fail: "SQL" appears only in Skills. | HYBRID: RULE keyword in skills or description; LLM checks usage | pdf_export, screenshot | major | 1st yr: minor | A (Meta "decisions based on data"; Google data analysis; Monzo A/B testing; Capital One analytical skills) | [P1] [P3] [P4] [P5] |
| LI-PRODUCT-07 | **Technical and AI fluency signal.** At least one entry shows working with engineers, or building with code, APIs or AI/LLM tools. This is not required for non-technical PM paths. LLM question: *"Does any entry show the candidate building with or alongside technology (code, APIs, AI tools, engineers)?"* Pass: "Prototyped an LLM study-notes summariser with the OpenAI API; tested with 20 students". Fail: no technical contact anywhere. | LLM | pdf_export | minor (major if the user targets Google/Meta-style APM) | masters in CS/analytics: major | B (Google preferred qualification: AI/ML; programming) | [P1] |
| LI-PRODUCT-08 | **Cross-functional leadership or entrepreneurial evidence.** At least one entry shows coordinating people with different skills (builders, designers, sponsors) or leading an initiative. LLM question: *"Did the candidate lead or coordinate people with different roles toward an outcome?"* Pass: "Led a 5-person team (2 devs, 1 designer) to ship the society's ticketing site; 1,100 tickets sold". Fail: "Member of Tech Society". | LLM | pdf_export | major | 1st yr: minor | A (Google minimum qualification; Capital One teamwork; Meta collaboration) | [P1] [P3] [P5] |
| LI-PRODUCT-09 | **Communication proof**: Featured or an Experience entry includes a presentation, demo video, pitch, or written teardown or proposal. LLM question: *"Is there a link or entry showing the candidate presenting or writing about a product?"* Pass: a Featured "Teardown: why Monzo's savings pots onboarding works (PDF)". Fail: nothing beyond bullets. | HYBRID | screenshot, self_report, pdf_export (Publications) | minor | penultimate+: minor (bonus only) | B (Google: "technical presentations"; Capital One: communication) / D | [P1] [P5] |
| LI-PRODUCT-10 | **Skills section is focused.** At least 5 and no more than ~30 skills. The 3 pinned Top Skills are product-relevant (from the keyword bank). No stand-alone filler ("Microsoft Office", "Hard-working"). | RULE: Top-3 skills from the PDF against the keyword bank; count via screenshot | pdf_export (Top 3), screenshot (full list) | minor | all | B (TARGETjobs 5-10 key skills) / C (LinkedIn 17x claim, 2016, correlational) | [P7] [P9] |
| LI-PRODUCT-11 | **Frameworks are applied, not name-dropped.** Each framework named (RICE, MoSCoW, JTBD, AARRR, North Star) is attached to a specific use somewhere on the profile. LLM question: *"Is every product framework mentioned tied to a concrete example?"* Pass: "Prioritised 14 feature requests with RICE; shipped the top 3". Fail: About lists "RICE, JTBD, AARRR, OKRs" with no example. | HYBRID: RULE finds framework terms; LLM checks application | pdf_export | minor | all | D (mirrors PRD-09b) | [P14] |
| LI-PRODUCT-12 | **About opens with product focus and proof, and ends with a target.** 1-2 short paragraphs (about 80-200 words). The first sentence names the product interest and the best proof. The last line states the role and timing sought. LLM question: *"Do the first two lines of the About state a product focus with proof, and does it end with what they're seeking and when?"* Pass: "I build small products for real users: my society booking app has 400+ users… Looking for product internships for Summer 2027 in London." Fail: "I am a passionate, driven student who loves technology and innovation…" | HYBRID: RULE word count; LLM for structure | pdf_export | minor | 1st yr: "seeking" line optional | B (LinkedIn Help: one or two paragraphs; TARGETjobs) / D | [P7] [P8] |
| LI-PRODUCT-13 | **Education is complete for product screens.** Degree, university, expected graduation **month and year**, grade or average if 2:1+, and 2-4 relevant modules (HCI, statistics, ML, economics, entrepreneurship). | RULE: parse the Education block for date, grade and module keywords | pdf_export | minor; **major** in penultimate year | penultimate: major | B (Google asks for expected graduation date on the CV; TARGETjobs: modules, scores) | [P1] [P7] |
| LI-PRODUCT-14 | **Scoring guard: a non-technical degree is not penalised.** Suppress any baseline "degree relevance" deduction for the product archetype. Treat technical modules as a bonus, not a requirement. | RULE (scorer config) | n/a | n/a (guard) | all | A (Capital One, Meta explicit; Monzo "no one type") | [P3] [P4] [P5] |
| LI-PRODUCT-15 | **Consistent with the CV, and no unbacked credentials.** (a) Titles, dates, employers and project metrics match the CV the user uploaded to Placed. (b) The number of certifications is not larger than the number of projects. More than 5 certificates and no project gets a flag. | HYBRID: RULE diff against the parsed CV; LLM for semantic mismatch | pdf_export plus the Placed CV | major; **critical** if a claim contradicts the CV (different title, inflated metric) | all | D (baseline CV-consistency; interviews probe both documents) | [P14] |
| LI-PRODUCT-16 | **Findable for product searches.** Location is set to a UK city. Open to Work (recruiters-only is fine) lists product titles: Associate Product Manager, Product Manager Intern, Product Analyst. | RULE: location in the PDF; self_report for Open to Work | pdf_export (location), self_report | minor | 1st yr: n/a | B (TARGETjobs: recruiters filter by location) | [P7] |
| LI-PRODUCT-17 | **Adjacent-role keyword coverage.** The headline, About or skills also contain at least 1 adjacent search term (product analyst, business analyst, growth, technology consulting, operations), so the profile surfaces beyond the rare "APM" searches. | RULE: keyword match | pdf_export | minor; major in final year / masters | final/masters: major | B (Prospects: entry PM hiring is rare; overlap roles) | [P6] |
| LI-PRODUCT-18 | **Posting is a bonus, never a requirement. Unprofessional posts are a flag.** If the user shares posts: a teardown or build log with a real insight is +; criticism of target employers, engagement-bait or ranting about rejections is −. LLM question: *"Do the shared posts show product thinking without unprofessional content?"* Pass: "Shipped v2 of my extension; D7 retention went 18%→26% after removing sign-up". Fail: "Rejected by Google again 🙃 recruiters don't know talent". | LLM | screenshot, self_report | minor | all; absent posts = neutral | B (TARGETjobs: activity shows sector interest) / D | [P7] |

---

## 6. Scoring weights (product vs baseline)

The baseline column is my assumption of the generic LinkedIn baseline. Align it with whatever the baseline file finally uses, and keep the deltas.

| Dimension | Baseline (assumed) | Product | Δ | Rationale |
|---|---|---|---|---|
| Identity and photo (name, photo, location, URL) | 8 | 5 | −3 | No product-specific value; photo isn't in the PDF export |
| Headline | 12 | 12 | 0 | Search keyword plus first impression (LI-PRODUCT-01) |
| About | 10 | 10 | 0 | A writing sample for a communication-heavy role |
| Experience (incl. projects as entries) | 25 | 27 | +2 | Product story and quantified outcomes are the core signal [P4] |
| Featured / proof of work | 8 | 16 | **+8** | The one place to *show* shipped products, teardowns and demos [P1][P6] |
| Skills | 10 | 8 | −2 | Search matters, but endorsements are ignored [P7] |
| Education | 7 | 5 | −2 | Non-tech degree accepted [P3][P5]; detail still matters in penultimate year |
| Recommendations | 5 | 3 | −2 | Low signal for students [P7] |
| Activity / posting | 5 | 4 | −1 | Optional bonus; never required |
| CV consistency | 10 | 10 | 0 | Contradictions are the only near-critical risk |
| **Total** | **100** | **100** | | |

The scorer can only fully see Featured through a screenshot or self_report. If the user gives only the PDF, reweight: move Featured's 16 points into Experience (projects entered as experience) and leave a "unscored: add a screenshot of Featured" prompt.

---

## 7. Keyword bank (recruiter search terms and synonyms)

**Role titles (headline, Open to Work):** Associate Product Manager · APM · Product Manager Intern · Product Management Intern · Graduate Product Manager · Rotational Product Manager / RPM · Product Analyst · Technical Product Manager · Product Owner · Growth Analyst · Business Analyst · Product Operations

**Core product skills:** product management · product discovery ← customer discovery, user interviews · user research ← UX research, usability testing, surveys · prioritisation ← prioritization, RICE, MoSCoW · roadmap ← roadmapping · product requirements ← PRD, user stories, acceptance criteria · MVP ← prototype, minimum viable product · go-to-market ← GTM, launch · product strategy · competitive analysis ← market research, teardown · market sizing ← TAM/SAM/SOM

**Data and metrics:** SQL · data analysis · product analytics ← Amplitude, Mixpanel, GA4, Looker · A/B testing ← experimentation, split testing · KPIs ← OKRs, North Star metric · retention ← churn, cohort analysis · conversion ← funnel, activation · DAU/MAU · NPS · Excel / Google Sheets (only with analysis)

**Build and tools:** Figma ← wireframes, mockups, prototyping · Jira ← Linear, Confluence, Trello, Notion · Agile ← Scrum, sprint planning, backlog · APIs · Python · no-code ← Bubble, Glide, Airtable, Zapier, Webflow · AI / LLM ← generative AI, prompt engineering, OpenAI API, AI prototyping

**Collaboration:** stakeholder management · cross-functional collaboration · presentation · communication

**Builder signals (LLM context, not search):** shipped · launched · built · users · waitlist · beta testers · hackathon · Product Hunt · Enactus · founder (only with team and users)

---

## 8. Worked example: weak 2nd-year profile, then the improved version

**Candidate:** "Aisha", BSc Economics, UCL, 2nd year (penultimate, graduating June 2027). She is targeting Google APM Intern London, scale-up product internships and product analyst roles for Summer 2027. Facts (the same in both versions): she built a room-booking web app for the Economics Society with one CS friend using Bubble, and it now has ~420 users. She works part-time at a Sainsbury's Local. She did a short SQL course. She ran user interviews for the app.

### 8.1 Weak version (what the PDF export would show)

> **Headline:** Aspiring Product Manager | Passionate about Tech & Innovation | Problem Solver
> **Location:** —
> **Top Skills:** Microsoft Office · Leadership · Teamwork
> **Certifications:** Product Management Fundamentals (LinkedIn Learning) · Agile Foundations (LinkedIn Learning) · Design Thinking (LinkedIn Learning) · Intro to SQL · Excel Essentials · Leadership 101
> **Summary:** I am a highly motivated and passionate second-year Economics student at UCL with a strong interest in technology and product management. I am a results-driven team player with excellent communication skills. I am familiar with frameworks such as RICE, JTBD, AARRR and OKRs and I am eager to apply them in a fast-paced environment. I love solving problems and creating value for users.
> **Experience:**
> - *Founder & CEO*, RoomBook (Sep 2025 – Present): Founded a start-up. Responsible for product, strategy and growth.
> - *Sales Assistant*, Sainsbury's (2024 – Present): Customer service. Working the till. Stocking shelves.
> **Education:** UCL, BSc Economics, 2024 – 2027.
> **Featured / Activity (screenshot):** empty. One reshared post: "So excited to be learning about product!"

**Scored against the rules:**
- 01 fail: no proof point, no university.
- 02 fail: "Founder & CEO" of a two-person society tool.
- 03 partial: the app exists but there is no link or users.
- 04 fail: no product story.
- 05 fail: zero numbers.
- 06 fail: SQL appears only as a certificate.
- 08 weak.
- 10 fail: Top 3 are filler.
- 11 fail: framework soup.
- 12 fail: generic About, no target.
- 13 fail: no graduation month, no grade, no modules.
- 15b flag: 6 certificates against 0 projects shown.
- 16 fail: no location.
- 17 fail: no adjacent keywords.

**Indicative product score: ~32/100.**

### 8.2 Improved version

> **Headline:** Economics @ UCL '27 | Built a society room-booking app used by 420+ students | SQL · user research · Figma | Seeking product / APM internships, Summer 2027
> **Location:** London, England, United Kingdom
> **Top Skills:** User Research · SQL · Product Management
> **Certifications:** SQL for Data Analysis (course name as issued)
> **Summary:**
> I like building small products for real users. With one CS friend, I built RoomBook, a room-booking app for UCL's Economics Society. It now has 420+ users and cut double-bookings from roughly weekly to none in a term.
>
> I start with users (I interviewed 14 society members before we built anything), prototype in Figma, ship with no-code tools, and check the data with SQL. I'm also learning to prototype with AI tools.
>
> Looking for product manager / APM and product analyst internships for Summer 2027 in London.
>
> **Experience:**
> - *Co-builder & product lead*, RoomBook (UCL Economics Society booking app), Sep 2025 – Present
>   Context: Society members booked study rooms through a shared spreadsheet that kept getting double-booked.
>   - Interviewed 14 members and found the main pain was not knowing what was free in real time. I chose a live calendar view over a waitlist feature.
>   - Designed the flows in Figma and built the app in Bubble with a CS co-founder. Launched in 5 weeks.
>   - Grew to 420+ users (about 60% of the society). Double-bookings went from ~1/week to 0 over Term 2.
>   - Wrote SQL queries on booking exports and found 35% of bookings were cancelled late. Added a reminder email that cut late cancellations to 18%.
>   - Link: roombook.example (live)
> - *Customer Assistant*, Sainsbury's Local, Oct 2024 – Present (part-time)
>   - Serve ~150 customers per shift. Noticed click-and-collect queries clustered at one handover step and suggested a labelled shelf, which the store manager adopted.
> **Education:** University College London, BSc Economics, Sep 2024 – Jun 2027 (expected). Year 1 average: 68% (2:1). Modules: Statistics & Econometrics, Microeconomics, Behavioural Economics, Introduction to Programming (Python).
> **Featured (screenshot):**
> 1. RoomBook (live link + 60-second demo video)
> 2. "Teardown: what Citymapper's onboarding gets right and the 3 changes I'd test" (PDF, with wireframes and a metric per change)
> 3. Slides: RoomBook launch pitch to the society committee
> **Activity (optional):** one post per month, for example "RoomBook v2: removing sign-up for viewing raised weekly active users from 140 to 210. What I'd do differently…"

**What changed and why:**
- Headline: role keyword, proof, skills and target (01, 16).
- The title changed from "Founder & CEO" to "Co-builder & product lead" (02).
- RoomBook is now a full product story with numbers (03, 04, 05).
- SQL is shown being used, not just certified (06).
- The frameworks were dropped and the certificates pruned (11, 15b).
- The About now opens with proof and closes with a target and timing (12).
- Education has the graduation month, grade and modules (13).
- "Product analyst" was added for adjacent searches (17).
- Featured now holds a live product, a teardown and a pitch (03, 09).
- The part-time job is reframed around customers and process (05, 08).

**Indicative product score: ~82/100.** The remaining gaps are no formal internship yet and no recommendation, both of which are normal for a 2nd year.

---

## 9. Implementation notes for the scorer (D)

- Score in two passes. Pass 1 uses the **PDF-only** rules (01, 02, 04-08, 10-17). Pass 2 adds the screenshot/self_report rules (03 Featured, 09, 16 Open to Work, 18). When pass 2 is missing, show "Featured not checked" rather than a zero.
- LI-PRODUCT-14 is a config guard. Turn off any baseline "degree relevance" penalty for `product`.
- Reuse the CV-side PRD keyword bank (`cv-rules-tech-product.md` §4.2) so CV and LinkedIn feedback use the same vocabulary.
- Don't show any LinkedIn "Nx more views" figures as fact (section 3).

---

## 10. Sources (all accessed 2026-10-14)

- **[P1]** Google, "Associate Product Manager BS/MS Intern, 2027", Google Careers (London, UK), 2026. https://www.google.com/about/careers/applications/jobs/results/103464941339452102. Verbatim quotes used: "an updated CV or resume and a current unofficial or official transcript in English"; "Please include your expected graduation date (month and year) and availability for the internship on your resume"; "our recruiters might reach out if we find a different potential match for your skills, interests, and experience"; "Experience applying AI/ML concepts to build products or features through relevant internships, capstone project, or other academic work"; "leading entrepreneurial efforts or outreach within organizations". No mention of LinkedIn on the page.
- **[P2]** Google, "Associate Product Manager, University Graduate, 2026 Start" (mirror on AnitaB.org job board), 2025/26. https://jobs.anitab.org/companies/google-24698/jobs/58853379-associate-product-manager-university-graduate-2026-start. Lists US locations only. This is a mirror, not google.com.
- **[P3]** Meta, "Rotational Product Manager (RPM)" (mirror on the Accel job board), n.d. (observed 2026). https://jobs.accel.com/companies/facebook-2-07d2eb1b-d3ad-4084-93df-74a124ac9233/jobs/56890087-rotational-product-manager-rpm. Quotes: "We encourage candidates who have non-traditional career paths to apply"; "Experience breaking down large-scale data sets and making decisions based on data". The posting's location was not shown. US-centric programme.
- **[P4]** Monzo, "Product Management at Monzo: the interview process", Monzo blog, 2022. https://monzo.com/blog/2022/10/04/product-management-at-monzo-the-interview-process. Quotes: "make sure to include what products you've worked on, and the impact of those products"; "We love to see quantifiable results that show the impact you've made in your role"; "There isn't 'one type' of Product Manager we hire for". Describes experienced-PM hiring.
- **[P4b]** Monzo, "Current openings at Monzo", Greenhouse job board, observed 2026. https://job-boards.greenhouse.io/monzo/jobs/8173733. No graduate PM role was visible.
- **[P5]** targetjobs (employer profile), "What it's really like working as a Graduate Product Manager at Capital One", n.d. (c. 2024). https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one. Quote: "a tech background is not necessary for success". Lists communication, analytical skills and teamwork as key.
- **[P6]** Prospects, "Product manager" job profile, May 2026. https://www.prospects.ac.uk/job-profiles/product-manager. Quotes: "It's extremely unusual for an employer to recruit a product manager without at least two years of relevant experience"; "Networking and speculative applications might also help"; "starting a business, even on a very small scale". Covers product management broadly (including consumer goods), not only tech.
- **[P7]** targetjobs editorial team, "The graduate's guide to creating the perfect LinkedIn profile", targetjobs, 11 Aug 2026. https://targetjobs.co.uk/careers-advice/networking/449493-the-graduates-guide-to-creating-the-perfect-linkedin-profile. Quotes: "What we're doing on LinkedIn is often searching for people who fit the specification of what we're looking for" (Simon Katchay, GTI); profile "should not be tailored to a specific role at a specific employer"; "Aim for approachable, relaxed and friendly"; "Don't waffle on about your day"; "between five and ten key skills"; recommendations from friends "are unlikely to hold much water". It also cites the Cibyl 2021 figure that 79% of students use LinkedIn for careers.
- **[P8]** LinkedIn Help, "Create a good LinkedIn profile", n.d. (page updated 2026). https://www.linkedin.com/help/linkedin/answer/a554351. Quotes: a good photo "increases the credibility of your profile"; "Members with a profile photo on LinkedIn receive up to 2X more profile views"; "Ideally, you should limit the text to one or two paragraphs".
- **[P9]** LinkedIn Newsroom, "Rethinking LinkedIn endorsements so members always look their best", 2016. https://news.linkedin.com/2016/rethinking-linkedin-endorsements-so-members-always-look-their-best. Quote: "people with at least five skills listed on their LinkedIn profile receive up to 17x more profile views". Self-reported and correlational.
- **[P10]** Press and Journal, "Get more views on your LinkedIn page by using a profile picture", 22 Mar 2017. https://www.pressandjournal.co.uk/fp/news/1202209/get-views-linkedin-page-using-profile-picture/. Reports LinkedIn's "up to 21x more profile views" claim. Contradicted by [P8]'s current "2X". Treat as unverified.
- **[P11]** UCL, "Career Essentials: LinkedIn – sourcing opportunities and raising your profile" (event listing), 2026. https://www.ucl.ac.uk/study/events/2026/oct/career-essentials-linkedin-sourcing-opportunities-and-raising-your-profile. Seen in search results only, not fetched, so no quote. It shows that UCL Careers treats LinkedIn as a sourcing channel.
- **[P12]** University of Edinburgh Careers Service blog, "Careers Informed" interview with a Skyscanner graduate, c. 2024. https://blogs.ed.ac.uk/careersinformed/?p=6083. Quote: "I sent off my CV and Cover Letter and I was selected to complete an online programming assessment." The rotations included Product Development (engineering graduate programme, 2023 intake).
- **[P13]** The Product Folks, "How to use Product Management Side Projects to get jobs and internships", n.d. https://theproductfolks.com/product-management-blog/how-to-use-product-management-side-projects-to-get-jobs-and-internships. Practitioner (grade C), not UK. Advises showing side projects on LinkedIn and in a portfolio.
- **[P14]** Placed internal, `docs/research/cv-rules-tech-product.md` §4 (PRD-01 to PRD-09, keyword bank). It is cited for consistency between CV and LinkedIn rules and is not external evidence.

**Searched for, not found (evidence gaps):** a UK careers-service sector page specific to product management (none found at Cambridge, Imperial or LSE in search); any product employer's public statement about reading LinkedIn profiles; current London RPM or graduate APM intakes; dedicated graduate PM schemes at Monzo, Deliveroo or Skyscanner; a primary study, with methodology, of LinkedIn photo or skills effects. Firecrawl was unavailable (402) and the session's web-search budget ran out mid-research, so Bright Network's LinkedIn page (403) and Lenny's Newsletter / Mind the Product were not checked.
