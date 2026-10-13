# Role Playbooks: Software, Data, Product, Marketing, Research (UK students)

Compiled 2026-10-13. Draft research input for Placed's role-playbook feature. Machine-readable twin: `role-playbooks-tech-product.json` (same content, same IDs).

## How to read this

- **Signals** are what UK early-careers recruiters say they screen for. Every signal has at least two sources (at least one an employer page or Prospects/targetjobs), unless it is graded **C** and labelled *convention*. Each citation includes a verbatim quote of 25 words or fewer, accessed 2026-10-13.
- **Grades** follow `cv-rules-tech-product.md`: **A** = employer guidance plus a top-tier UK careers source; **B** = two sources incl. a careers publisher or professional body (or employer content hosted by a publisher); **C** = single source, convention; **D** = our synthesis.
- **Rule IDs** (SWE-xx, DAT-xx, PRD-xx, MKT-xx, RES-xx, GEN-xx) link to the CV-scoring rules in `cv-rules-tech-product.md` and `cv-rules-general.md`.
- **Actions** are concrete things to do. *Projects* are our synthesis (grade D) and each links to the signal it builds evidence for; the quote under each project shows the source idea behind it. *Courses* and *experiences* are real, named and checked today: the URL loaded, the page states it is free (or the content was open without sign-in, marked *observed*), and nothing restricts it from UK students. Unverifiable items were deleted, not marked as assumed.
- **Effort**: weekend / 2-4 weeks / term. **Min year**: 1st / 2nd / penultimate / final / masters.
- **No timings** are given unless they come from a 2026/27-cycle page. Skills use canonical names from `lib/skills/vocab.ts`.
- **Honesty notes.** Certificates on their own are weak evidence. The value lies in the project you build with the skill. Forage simulations are listed as exploration because no source here shows recruiters weight them.

---

## Software engineering (`software_eng`)

### Employer signals

- **PB-SWE-S01** Builds things outside the syllabus and can show them: personal projects with an up-to-date portfolio or GitHub link. *Grade B (evidence (two careers publishers agree)); rules: SWE-03, SWE-07.*
  - [1] "You may already have some personal experience from working on your own projects, which could be of interest to potential employers."
  - [2] "If you include a link to a portfolio, make sure it includes up-to-date examples of your work."
- **PB-SWE-S02** Visible 'passion for technology': hackathons, tech events and self-started projects. *Grade B (evidence (two careers publishers agree)); rules: SWE-12.*
  - [2] "Recruiters have told targetjobs that they really want to see practical examples of candidates’ skills and demonstrations of candidates’ ‘passion for technology’"
  - [1] "Software engineers are typically passionate about what they do and may already have a portfolio or some examples to show to potential employers"
- **PB-SWE-S03** Can talk in depth about their own projects: technology choices, trade-offs and what they would change. *Grade A (evidence (employer + careers publisher)); rules: SWE-05, SWE-11.*
  - [3] "Be prepared to talk in depth about projects you’ve worked on recently. Your interviewer will want to hear about technology choices, trade-offs"
  - [2] "you need to be prepared to speak about anything on your CV at interview."
- **PB-SWE-S04** Collaboration and communication count as much as technical skill. *Grade A (evidence (employer + two careers publishers)); rules: SWE-14.*
  - [3] "the collaboration and project delivery skills we explore in this stage are just as important as technical excellence."
  - [2] "employers view behavioural competencies and ‘soft’ skills with equal importance."
  - [1] "the ability to communicate with clients, colleagues, and management to explain complex issues clearly and concisely"
- **PB-SWE-S05** Problem-solving ability is a core requirement; Monzo says it hires for problem-solving ability over experience. *Grade A (evidence (employer + careers publisher)); rules: none.*
  - [3] "In general, we hire for problem-solving ability over experience."
  - [1] "a logical, analytical and creative approach to problems and problem solving"
- **PB-SWE-S06** Skills are applied and self-driven, not just listed. *Grade B (evidence (employer recruiter quoted by careers publisher + careers publisher)); rules: SWE-11.*
  - [4] "Don’t just say, “I know programming languages x, y and z” – that doesn’t show passion and doesn’t stand out."
  - [1] "a motivated approach to your career and a willingness to further develop your skills and knowledge"
- **PB-SWE-S07** Relevant work experience (placements, insight programmes, internships) is viewed favourably and often feeds later hiring. *Grade B (evidence (two careers publishers agree)); rules: none.*
  - [1] "Relevant work experience is a good way of demonstrating a genuine interest in computing and is regarded favourably by employers."
  - [6] "Many employers run insight programmes, and especially spring weeks, with a view to hiring future interns and graduates."

### Projects

- **PB-SWE-P01 Build and ship a tool for a real group you belong to**: Find a manual process in a society, sports club or part-time job and replace it with a small web app that people actually use. Keep it running.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-SWE-S01, PB-SWE-S02, PB-SWE-S04 · Skills: TypeScript, React, Node.js, PostgreSQL, REST API, Git
  - Evidence it produces: Live link + public GitHub repo; README states the problem, stack, who uses it and one outcome (e.g. users, time saved), honestly measured.
  - Verified 2026-10-13: [5] "You could look at sports clubs, groups and societies you already belong to and see if they have any processes or databases you could improve"
- **PB-SWE-P02 Take a tutorial project and make it genuinely yours**: Extend a course or tutorial project with a feature the tutorial did not cover, then add automated tests and a CI pipeline.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-SWE-S01, PB-SWE-S06 · Skills: Python, FastAPI, Unit Testing, CI/CD, Docker, Git
  - Evidence it produces: Repo with passing CI; README section 'What I changed from the tutorial and why' (addresses SWE-17a: unextended tutorial clones).
  - Verified 2026-10-13: [4] "If you were self-taught, then yes! Or if you’ve used that skill to solve a problem, yes again!"
- **PB-SWE-P03 Write a design note for your best project**: One page covering the architecture, two alternatives you rejected and why, known limitations, and what you would do with more time. Rehearse explaining it in 3 minutes.
  - Effort: weekend · Min year: 1st · Signals: PB-SWE-S03 · Skills: System Design, Communication
  - Evidence it produces: DESIGN.md in the repo, linked from the README.
  - Verified 2026-10-13: [3] "you should expect to justify key decisions in your solution and describe what you’d have done differently with more time."
- **PB-SWE-P04 Implement and benchmark core data structures and algorithms**: Implement several classic structures (e.g. hash map, heap, graph search), test them, and benchmark them against the standard library on growing inputs.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-SWE-S05, PB-SWE-S06 · Skills: Algorithms, Python, C++, Unit Testing
  - Evidence it produces: Repo with tests and a README results table and chart; short write-up of what surprised you.
  - Verified 2026-10-13: [1] "a logical, analytical and creative approach to problems and problem solving"
- **PB-SWE-P05 Team build with real code review**: Build something with 2-3 peers using issues, branches, pull requests and reviews, with a short planning cadence. Each person owns a clear part.
  - Effort: term · Min year: 1st · Signals: PB-SWE-S04 · Skills: Git, Code Review, Agile, Teamwork
  - Evidence it produces: Public repo showing PR history and reviews; README lists who built what (SWE-05: your own contribution).
  - Verified 2026-10-13: [3] "the collaboration and project delivery skills we explore in this stage are just as important as technical excellence."

### Courses & certifications (free / free-to-audit)

- **PB-SWE-C01 [CS50x (Harvard OpenCourseWare)](https://cs50.harvard.edu/x/)**: Broad CS foundation (C, Python, SQL, web) ending in a final project. Signal value: the certificate on its own is low; the final project is what counts as evidence.
  - Effort: term · Min year: 1st · Signals: PB-SWE-S06 · Skills: C, Python, SQL, Algorithms · Hours: not stated in hours; 'eleven weeks of material' · Cost: free (OCW)
  - Evidence it produces: Final project repo
  - Verified 2026-10-13: [22] "Even if you are not a student at Harvard, you are welcome to “take” this course for free via this OpenCourseWare"
- **PB-SWE-C02 [The Missing Semester of Your CS Education (MIT)](https://missing.csail.mit.edu/)**: Shell, editors, Git and tooling. Signal value low, learning only: it shows up indirectly as cleaner repos and workflow.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-SWE-S06 · Skills: Linux, Git · Hours: not stated · Cost: open lecture notes, no sign-in or payment (observed)
  - Evidence it produces: none directly
  - Verified 2026-10-13: [23] "there’s one critical subject that’s rarely covered, and is instead left to students to figure out"
- **PB-SWE-C03 [Full Stack Open (University of Helsinki)](https://fullstackopen.com/en/)**: Modern JavaScript web development: React front ends with Node.js REST back ends, plus TypeScript and GraphQL parts. Signal value comes from the apps you build with it.
  - Effort: term · Min year: 1st · Signals: PB-SWE-S01 · Skills: JavaScript, React, Node.js, REST API, TypeScript, GraphQL · Hours: not stated · Cost: free; CC BY-NC-SA material
  - Evidence it produces: Deployed exercise apps / a capstone repo
  - Verified 2026-10-13: [24] "The main focus is on building single page applications with ReactJS that use REST APIs built with Node.js."
- **PB-SWE-C04 [MIT 6.006 Introduction to Algorithms (OCW)](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/)**: University-level algorithms and data structures with problem sets. Learning value for technical interviews; signal value on a CV low.
  - Effort: term · Min year: 1st · Signals: PB-SWE-S05 · Skills: Algorithms · Hours: not stated · Cost: free (OCW)
  - Evidence it produces: none directly; supports PB-SWE-P04
  - Verified 2026-10-13: [25] "Freely sharing knowledge with learners and educators around the world."

### Experiences

- **PB-SWE-E01 [Hackathons (MLH season listings)](https://www.mlh.com/seasons/2027/events)**: Attend a hackathon, ship a demo with a team, then polish it afterwards so it can sit in your Projects section. Filter the MLH list by Europe/UK.
  - Effort: weekend · Min year: 1st · Signals: PB-SWE-S02, PB-SWE-S04 · Skills: Hackathon, Teamwork
  - How to find: MLH 2027 season events page, region filter 'Europe/UK'; also your university's tech society.
  - Evidence it produces: Devpost/GitHub link to what you built; your role stated
  - Verified 2026-10-13: [40] "Filter events This Month Next Month Diversity Focused Region North America Europe/UK Asia Pacific"; [2] "hackathons, events and personal projects can provide just that."
- **PB-SWE-E02 [UKIEPC (ICPC subregional contest)](https://ukiepc.info/)**: Team programming contest hosted at UK and Ireland universities. Good for algorithmic problem solving and teamwork.
  - Effort: weekend · Min year: 1st · Signals: PB-SWE-S05, PB-SWE-S02 · Skills: Competitive Programming, Algorithms
  - How to find: ukiepc.info and its Discord; ask your department or competitive-programming society whether it hosts a site.
  - Evidence it produces: Team placing (rank) on the CV
  - Verified 2026-10-13: [44] "suitable for programmers at all skill levels, from beginner to expert, as the problem set always has both very easy and very difficult problems."
- **PB-SWE-E03 [Google Summer of Code](https://summerofcode.withgoogle.com/)**: Mentored 12+ week open-source project. Start by contributing small fixes to a participating organisation before applying. No dates given here: check the site for the 2027 timeline.
  - Effort: term · Min year: 1st · Signals: PB-SWE-S01, PB-SWE-S04 · Skills: Open Source, Google Summer of Code, Git
  - How to find: summerofcode.withgoogle.com; eligibility in the rules page (18+, student or open-source beginner, eligible to work where you live).
  - Evidence it produces: Merged pull requests + final project report link
  - Verified 2026-10-13: [41] "GSoC Contributors work with an open source organization on a 12+ week programming project under the guidance of mentors."; [42] "be a student or a beginner to open source software development."
- **PB-SWE-E04 [Outreachy (paid remote open-source internship; eligibility restricted)](https://www.outreachy.org/)**: Remote open-source internships for people who face under-representation or discrimination in tech where they live. Check eligibility before investing time. No 2027 dates given here.
  - Effort: term · Min year: 1st · Signals: PB-SWE-S01, PB-SWE-S07 · Skills: Open Source, Git
  - How to find: outreachy.org applicant guide; join the mailing list for round announcements.
  - Evidence it produces: Merged contributions + internship on CV
  - Verified 2026-10-13: [43] "Outreachy provides internships to anyone from any background who faces underrepresentation, systemic bias, or discrimination in the technical industry where they are living."
- **PB-SWE-E05 [Insight days / spring weeks at tech employers](https://targetjobs.co.uk/s/jobs/insight-programme)**: Short employer programmes, mostly in person, that can lead to fast-tracked internship routes.
  - Effort: weekend · Min year: 1st · Signals: PB-SWE-S07 · Skills: Commercial Awareness
  - How to find: targetjobs insight-programme search; employer graduate sites. Many are aimed at first years (or second years on four-year courses).
  - Evidence it produces: Programme listed under Experience with one takeaway
  - Verified 2026-10-13: [6] "so many spring weeks and insight programmes are offered to first years (or second years on four-year courses)"; [47] "Insight programme opportunities"
- **PB-SWE-E06 [Forage virtual job simulation](https://www.theforage.com/)**: Free, self-paced employer-designed task sets. Convention: no source here shows recruiters weight these; use them to explore roles, not as a CV centrepiece.
  - Effort: weekend · Min year: 1st · Signals: PB-SWE-S07 · Skills: n/a
  - How to find: theforage.com, search for your target function; skip if no relevant simulation exists.
  - Evidence it produces: Completion certificate (low signal)
  - Verified 2026-10-13: [46] "Explore careers and prepare for the job with hundreds of free job simulations designed by the world's top employers."

### Year guidance

- **1st**: Ship 1-2 small projects with a README and GitHub link, go to a hackathon, apply to insight/spring programmes (many are aimed at first years).
- **2nd**: On four-year courses this is the main insight-programme year; otherwise treat as penultimate.
- **penultimate**: Apply for summer internships/placements; have 2-4 projects with stack and outcome, and a design note you can talk through.
- **final**: Graduate applications; lead with internship or strongest project, add final-year project, keep GitHub current.
- **masters**: Same as final year; make the dissertation/project a headline item with results.

*Synthesis (grade D), aligned with cv-rules-tech-product.md section 7; first-year insight targeting cites R6.*

---

## Data & analytics (`data_analytics`)

### Employer signals

- **PB-DAT-S01** Core tools are visible: SQL, plus Python or R where the role calls for it (expected for data science), and a visualisation tool such as Power BI or Tableau for analyst roles. *Grade B (evidence (careers publisher + professional body; RSS page looks dated)); rules: DAT-02, DAT-08.*
  - [7] "programming or query skills in SQL and, for some roles, Python or R"
  - [7] "data visualisation skills using tools such as Power BI or Tableau"
  - [9] "Employers are looking for specialised knowledge and an in-depth understanding of programming languages used in big data such as Java, C# and Python"
- **PB-DAT-S02** A small portfolio on open data that shows the whole loop: question, cleaning, method, result. *Grade B (evidence (two careers publishers)); rules: DAT-03, DAT-06.*
  - [7] "build a small portfolio using open datasets. Show how you defined a question, cleaned the data, chose an analytical method and communicated the result."
  - [2] "a link to an online portfolio, such as your own website or a GitHub profile"
- **PB-DAT-S03** Explains findings clearly to non-specialist audiences. *Grade B (evidence (two careers publishers)); rules: DAT-05.*
  - [7] "communication and data storytelling skills to explain findings to different audiences"
  - [5] "practise explaining technical things to people with little or no technical knowledge"
- **PB-DAT-S04** Quantitative grounding: numerate degree or demonstrable statistics. *Grade B (evidence (professional body + careers publisher)); rules: DAT-01, DAT-09.*
  - [9] "Data scientists typically have a background in mathematics, statistics or other numerate subjects such as computer science or engineering"
  - [7] "analytical and numerical ability to interpret large datasets and test conclusions"
- **PB-DAT-S05** Data and tech competitions (e.g. Kaggle) are a recommended way to gain experience, visibility and skills. *Grade B (evidence (two careers publishers)); rules: DAT-07.*
  - [8] "Online data science competitions (e.g. Kaggle, Topcoder) can help you gain visibility and experience."
  - [5] "tech-related competitions that give university students the chance to do just that, as well as developing other technical and soft skills such as teamwork"
- **PB-DAT-S06** Real-organisation data work, including volunteering for a charity, community group or society, is a recommended way to build experience. *Grade B (evidence (two careers publishers)); rules: DAT-05.*
  - [7] "You could also volunteer for a charity or community group that needs help organising, analysing or presenting data."
  - [5] "see if they have any processes or databases you could improve"

### Projects

- **PB-DAT-P01 Question-led analysis of a public UK dataset**: Pick one concrete question, use a public open dataset, document cleaning decisions, choose a method, and end with a recommendation and its limitations.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-DAT-S01, PB-DAT-S02, PB-DAT-S03 · Skills: SQL, Python, Pandas, Data Visualisation, Jupyter
  - Evidence it produces: GitHub repo + README in four parts (question, cleaning, method, result) with one key chart; states dataset source and size (DAT-03).
  - Verified 2026-10-13: [7] "Show how you defined a question, cleaned the data, chose an analytical method and communicated the result."
- **PB-DAT-P02 Dashboard for a society or charity**: Turn a society's or charity's spreadsheets (members, events, donations) into a dashboard they can use for a real decision.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-DAT-S03, PB-DAT-S06 · Skills: Excel, Power BI, Tableau, Data Visualisation
  - Evidence it produces: Published dashboard link or screenshots + one paragraph on what it was used for, if anything (DAT-05 'so what'); do not claim an impact you did not observe.
  - Verified 2026-10-13: [7] "You could also volunteer for a charity or community group that needs help organising, analysing or presenting data."
- **PB-DAT-P03 Kaggle 'Getting Started' competition with an honest baseline**: Enter a Getting Started competition, report a simple baseline first, then your improved model and what drove the gain. Use it to learn; do not make Titanic-type data your headline project (DAT-11c).
  - Effort: weekend · Min year: 1st · Signals: PB-DAT-S05, PB-DAT-S04 · Skills: Python, Scikit-learn, Feature Engineering, Cross-validation, Kaggle
  - Evidence it produces: Public notebook with baseline vs final metric and leaderboard position.
  - Verified 2026-10-13: [45] "Competitions with approachable ML fundamentals."
- **PB-DAT-P04 Hypothesis-test or regression write-up**: Answer a question with a stated hypothesis, an appropriate test or regression, assumptions checked, and an effect size in plain English.
  - Effort: 2-4 weeks · Min year: 2nd · Signals: PB-DAT-S04, PB-DAT-S03 · Skills: Statistics, Hypothesis Testing, Regression, R
  - Evidence it produces: 2-page PDF report + code repo.
  - Verified 2026-10-13: [7] "analytical and numerical ability to interpret large datasets and test conclusions"
- **PB-DAT-P05 SQL question bank on a real schema**: Load a public dataset into PostgreSQL, write a set of business questions and answer each with a query (joins, aggregates, window functions).
  - Effort: weekend · Min year: 1st · Signals: PB-DAT-S01 · Skills: SQL, PostgreSQL
  - Evidence it produces: Repo with schema, queries and a results table per question.
  - Verified 2026-10-13: [7] "programming or query skills in SQL and, for some roles, Python or R"

### Courses & certifications (free / free-to-audit)

- **PB-DAT-C01 [Kaggle Learn](https://www.kaggle.com/learn)**: Short hands-on micro-courses (Python, pandas, SQL, ML basics) with certificates. Learning value high; certificate signal value low on its own.
  - Effort: weekend · Min year: 1st · Signals: PB-DAT-S01 · Skills: Python, Pandas, SQL, Machine Learning · Hours: 'a few hours' per course (provider) · Cost: no cost; certificates available
  - Evidence it produces: Certificates; better: a project using the skill
  - Verified 2026-10-13: [26] "The courses are provided at no cost to you, and you can now earn certificates."
- **PB-DAT-C02 [SQLBolt](https://sqlbolt.com/)**: Interactive in-browser SQL lessons from SELECT to joins and aggregates. Learning only.
  - Effort: weekend · Min year: 1st · Signals: PB-DAT-S01 · Skills: SQL · Hours: not stated · Cost: open, no sign-in (observed)
  - Evidence it produces: none directly; supports PB-DAT-P05
  - Verified 2026-10-13: [27] "a series of interactive lessons and exercises designed to help you quickly learn SQL right in your browser."
- **PB-DAT-C03 [An Introduction to Statistical Learning (free book + labs, R or Python)](https://www.statlearning.com/)**: Standard statistical-learning text with chapter labs. Learning value high for DS roles; cite projects, not the book.
  - Effort: term · Min year: 2nd · Signals: PB-DAT-S04 · Skills: Statistics, Regression, Machine Learning, Python, R · Hours: not stated · Cost: free PDF download (verified: ISLP link served a PDF)
  - Evidence it produces: Lab notebooks in a repo
  - Verified 2026-10-13: [28] "An Introduction to Statistical Learning provides a broad and less technical treatment of key topics in statistical learning."
- **PB-DAT-C04 [Practical Deep Learning for Coders (fast.ai)](https://course.fast.ai/)**: Applied deep learning for people who can already code. For ML-leaning roles only.
  - Effort: 2-4 weeks · Min year: 2nd · Signals: PB-DAT-S01 · Skills: Deep Learning, PyTorch, Machine Learning · Hours: 9 lessons of about 90 minutes each (provider) · Cost: free
  - Evidence it produces: A deployed model demo
  - Verified 2026-10-13: [29] "A free course designed for people with some coding experience"; [29] "There are 9 lessons, and each lesson is around 90 minutes long."

### Experiences

- **PB-DAT-E01 [Kaggle competitions](https://www.kaggle.com/competitions)**: Start with Getting Started or Playground competitions; report rank as a percentile once you place meaningfully (DAT-07).
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-DAT-S05 · Skills: Kaggle, Machine Learning
  - How to find: kaggle.com/competitions; filter Getting Started / Playground.
  - Evidence it produces: Profile link + rank
  - Verified 2026-10-13: [45] "The world's most important AI problems, open to anyone."; [8] "Online data science competitions (e.g. Kaggle, Topcoder) can help you gain visibility and experience."
- **PB-DAT-E02 Data volunteering for a charity or community group**: Offer to organise, analyse or present a charity's data; agree one deliverable and a deadline.
  - Effort: term · Min year: 1st · Signals: PB-DAT-S06, PB-DAT-S03 · Skills: Excel, Data Visualisation, Communication
  - How to find: Your university volunteering centre or students' union; approach local charities directly.
  - Evidence it produces: Experience entry with the deliverable and who used it
  - Verified 2026-10-13: [7] "You could also volunteer for a charity or community group that needs help organising, analysing or presenting data."; [5] "If your university has a volunteering centre, they may be aware of initiatives you could investigate."
- **PB-DAT-E03 [Hackathons / datathons (MLH listings)](https://www.mlh.com/seasons/2027/events)**: Team events; pick ones with a data or AI track and finish with a working demo.
  - Effort: weekend · Min year: 1st · Signals: PB-DAT-S03 · Skills: Hackathon, Datathon, Teamwork
  - How to find: MLH 2027 season list, region 'Europe/UK'; university data-science society.
  - Evidence it produces: Demo link + your role
  - Verified 2026-10-13: [40] "Filter events This Month Next Month Diversity Focused Region North America Europe/UK Asia Pacific"
- **PB-DAT-E04 [Insight days / spring weeks (data and tech employers)](https://targetjobs.co.uk/s/jobs/insight-programme)**: Short employer programmes; useful for first years to get an early foot in the door.
  - Effort: weekend · Min year: 1st · Signals: n/a · Skills: Commercial Awareness
  - How to find: targetjobs insight-programme search; employer graduate sites.
  - Evidence it produces: Experience entry
  - Verified 2026-10-13: [6] "so many spring weeks and insight programmes are offered to first years (or second years on four-year courses)"; [47] "Insight programme opportunities"
- **PB-DAT-E05 [Forage virtual job simulation](https://www.theforage.com/)**: Free self-paced employer tasks. Convention: low CV signal; use to test interest in analytics work.
  - Effort: weekend · Min year: 1st · Signals: n/a · Skills: n/a
  - How to find: theforage.com, search 'data'; skip if nothing relevant.
  - Evidence it produces: Certificate (low signal)
  - Verified 2026-10-13: [46] "Explore careers and prepare for the job with hundreds of free job simulations designed by the world's top employers."

### Year guidance

- **1st**: Learn SQL + Python basics, publish one question-led analysis, try a Kaggle Getting Started competition, apply to insight programmes.
- **2nd**: On four-year courses: insight year plus a statistics write-up; otherwise treat as penultimate.
- **penultimate**: Apply for analytics internships/placements; 2-3 portfolio projects with dataset, method, metric and a 'so what'.
- **final**: Graduate applications; foreground any internship and the dissertation if it is quantitative.
- **masters**: Lead with the MSc project (data, method, result); show statistics explicitly for DS roles.

*Synthesis (grade D), aligned with cv-rules-tech-product.md sections 3 and 7.*

---

## Product management (`product`)

> **Caveat.** Entry-level PM hiring is rare; graduate PM schemes exist but many people enter via adjacent roles. [10] "It's extremely unusual for an employer to recruit a product manager without at least two years of relevant experience." [10] "look for work in areas which have a lot of overlap with product management, such as programming, sales and account management, marketing"

### Employer signals

- **PB-PRD-S01** Communicates clearly and aligns stakeholders around a plan. *Grade B (evidence (employer content hosted by a careers publisher + careers publisher)); rules: PRD-05.*
  - [11] "Communication skills, which are crucial and enable us to articulate our vision and strategies to other stakeholders"
  - [10] "a very strong and clear communicator, comfortable working with a variety of stakeholders"
- **PB-PRD-S02** Backs decisions with data and market research. *Grade B (evidence (employer content hosted by a careers publisher + careers publisher)); rules: PRD-03, PRD-07.*
  - [11] "Analytical skills, because they help us interpret data effectively, make better informed decisions and refine strategies where needed"
  - [10] "able to support your decisions with market research and thorough data analysis"
- **PB-PRD-S03** Understands users and their needs, and links them to business goals. *Grade B (evidence (employer content hosted by a careers publisher + careers publisher)); rules: PRD-02, PRD-04.*
  - [11] "My job entails recognising what a customer needs and the business objectives that a product or feature will fulfil."
  - [10] "very knowledgeable about your product's users and industry"
- **PB-PRD-S04** Works well across functions (engineering, design, business). *Grade B (evidence (employer content hosted by a careers publisher + careers publisher)); rules: PRD-05.*
  - [11] "Teamwork, as we often work with people with different skillsets and perspectives"
  - [10] "a good collaborator, leader, and diplomat, as you'll be working in-depth with different business functions"
- **PB-PRD-S05** Has taken positions of responsibility and led projects (society, competitions, charity, small business). *Grade B (evidence (employer content hosted by a careers publisher + careers publisher)); rules: PRD-08.*
  - [10] "You could lead a university society, take part in business competitions and challenges, become a trustee for a charity"
  - [11] "Focus on building strong foundations such as teamwork, analytical thinking, communication, problem solving, adaptability and leadership skills."
- **PB-PRD-S06** A technical background can help for some PM roles but is not required for all. *Grade B (evidence (one employer + careers publisher)); rules: PRD-06.*
  - [11] "a tech background is not necessary for success – neither are you disadvantaged if you don’t have one."
  - [10] "For some roles, a technical or engineering background may be helpful."

### Projects

- **PB-PRD-P01 Discovery sprint on a real problem**: Interview a handful of target users about one problem, synthesise patterns, and write a one-page problem statement with the evidence behind it.
  - Effort: weekend · Min year: 1st · Signals: PB-PRD-S03, PB-PRD-S01 · Skills: User Research, Market Research, Communication
  - Evidence it produces: Write-up: interview guide, anonymised insights, problem statement, how many people you spoke to (PRD-04).
  - Verified 2026-10-13: [10] "very knowledgeable about your product's users and industry"
- **PB-PRD-P02 Ship an MVP and measure one metric**: Build the smallest version that tests your discovery insight (no-code is fine), define one success metric up front, and review it after a few weeks.
  - Effort: term · Min year: 1st · Signals: PB-PRD-S02, PB-PRD-S03 · Skills: MVP, KPIs, Product Analytics, Figma
  - Evidence it produces: Live link + post-launch review: metric, result, what you'd change (PRD-02 arc).
  - Verified 2026-10-13: [10] "starting a business, even on a very small scale, will show employers that you're responsible, hardworking, and knowledgeable about commerce."
- **PB-PRD-P03 Product teardown and improvement proposal**: Pick an app you use, map its core flow, compare two competitors, and propose a prioritised set of changes with the metric each should move.
  - Effort: weekend · Min year: 1st · Signals: PB-PRD-S02, PB-PRD-S01 · Skills: Product Management, Prioritisation, Market Research, Figma
  - Evidence it produces: Published write-up or PDF with wireframes and a prioritised list.
  - Verified 2026-10-13: [10] "able to analyse complex data and look for trends in the market and users' opinions and behaviour"
- **PB-PRD-P04 Run a cross-functional mini-team for a society product**: Coordinate builders and designers to deliver something a society needs, with a simple roadmap, regular check-ins and a retrospective.
  - Effort: term · Min year: 2nd · Signals: PB-PRD-S04, PB-PRD-S05 · Skills: Agile, Jira, Stakeholder Management, Leadership, Teamwork
  - Evidence it produces: Roadmap, retro notes, adoption numbers if you have them; CV bullet stating your role without title inflation (PRD-09a).
  - Verified 2026-10-13: [10] "ask to lead on important projects during an internship, part-time job, or voluntary position"
- **PB-PRD-P05 Funnel analysis with recommendations**: Using your MVP's data or a public dataset, build a simple funnel, find the biggest drop-off and propose a test.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-PRD-S02 · Skills: SQL, Funnel Analysis, Metrics, Data Visualisation
  - Evidence it produces: Short report with funnel chart and a proposed experiment.
  - Verified 2026-10-13: [11] "Analytical skills, because they help us interpret data effectively, make better informed decisions and refine strategies where needed"

### Courses & certifications (free / free-to-audit)

- **PB-PRD-C01 [SQLBolt](https://sqlbolt.com/)**: Interactive SQL basics so you can pull your own product data. Learning only.
  - Effort: weekend · Min year: 1st · Signals: PB-PRD-S02, PB-PRD-S06 · Skills: SQL · Hours: not stated · Cost: open, no sign-in (observed)
  - Evidence it produces: Supports PB-PRD-P05
  - Verified 2026-10-13: [27] "a series of interactive lessons and exercises designed to help you quickly learn SQL right in your browser."
- **PB-PRD-C02 [Kaggle Learn (Python / SQL / data visualisation micro-courses)](https://www.kaggle.com/learn)**: Short hands-on data courses. Signal value low; useful for analytical credibility.
  - Effort: weekend · Min year: 1st · Signals: PB-PRD-S02 · Skills: SQL, Python, Data Visualisation · Hours: 'a few hours' per course (provider) · Cost: no cost; certificates available
  - Evidence it produces: Certificates (low signal)
  - Verified 2026-10-13: [26] "The courses are provided at no cost to you, and you can now earn certificates."
- **PB-PRD-C03 [CS50x (optional technical literacy)](https://cs50.harvard.edu/x/)**: For non-CS students who want to talk credibly with engineers. Optional: a Capital One graduate PM writes that a tech background is not necessary for success there.
  - Effort: term · Min year: 1st · Signals: PB-PRD-S06 · Skills: Python, SQL · Hours: 'eleven weeks of material' · Cost: free (OCW)
  - Evidence it produces: Final project
  - Verified 2026-10-13: [22] "Even if you are not a student at Harvard, you are welcome to “take” this course for free via this OpenCourseWare"

### Experiences

- **PB-PRD-E01 Lead a university society or a society project**: Take a committee role and own one measurable initiative end to end.
  - Effort: term · Min year: 1st · Signals: PB-PRD-S05, PB-PRD-S01 · Skills: Leadership, Stakeholder Management
  - How to find: Students' union society elections; volunteer for a project lead role mid-year.
  - Evidence it produces: Experience entry with an outcome
  - Verified 2026-10-13: [10] "You could lead a university society, take part in business competitions and challenges, become a trustee for a charity"
- **PB-PRD-E02 [Enactus (student social-enterprise projects)](https://www.enactusuki.org/)**: University students run student-led social enterprises: a source of user, product and leadership evidence.
  - Effort: term · Min year: 1st · Signals: PB-PRD-S05, PB-PRD-S03 · Skills: Leadership, Teamwork, Market Research
  - How to find: Check whether your university has an Enactus society; enactusuki.org.
  - Evidence it produces: Project role + outcome
  - Verified 2026-10-13: [48] "By linking academic learning with student-led social enterprises, we give university students the platform to manage teams, launch ventures, and tackle local issues."
- **PB-PRD-E03 [Hackathon as product lead (MLH listings)](https://www.mlh.com/seasons/2027/events)**: Own the problem framing, scope and demo story for a hackathon team; write up the decisions afterwards.
  - Effort: weekend · Min year: 1st · Signals: PB-PRD-S04, PB-PRD-S01 · Skills: Hackathon, Prioritisation, Teamwork
  - How to find: MLH 2027 season list, region 'Europe/UK'.
  - Evidence it produces: Demo link + your role
  - Verified 2026-10-13: [40] "Filter events This Month Next Month Diversity Focused Region North America Europe/UK Asia Pacific"
- **PB-PRD-E04 Internships in adjacent functions**: Business analysis, marketing, project management or engineering internships are realistic stepping stones into PM.
  - Effort: term · Min year: penultimate · Signals: PB-PRD-S04 · Skills: Stakeholder Management, Communication
  - How to find: Search internships in the adjacent function on university job boards and targetjobs.
  - Evidence it produces: Experience entry framed around users, data and delivery
  - Verified 2026-10-13: [10] "look for work in areas which have a lot of overlap with product management, such as programming, sales and account management, marketing"
- **PB-PRD-E05 [Insight days / spring weeks](https://targetjobs.co.uk/s/jobs/insight-programme)**: Early exposure to firms with graduate PM or rotational schemes.
  - Effort: weekend · Min year: 1st · Signals: n/a · Skills: Commercial Awareness
  - How to find: targetjobs insight-programme search; employer graduate sites.
  - Evidence it produces: Experience entry
  - Verified 2026-10-13: [6] "so many spring weeks and insight programmes are offered to first years (or second years on four-year courses)"; [47] "Insight programme opportunities"

### Year guidance

- **1st**: Take a society role, run a discovery sprint, apply to insight programmes.
- **2nd**: On four-year courses: ship an MVP and lead a society project; otherwise treat as penultimate.
- **penultimate**: Apply to graduate-PM-feeding internships and to adjacent-function internships; have one shipped product with a metric.
- **final**: Apply to graduate PM schemes and adjacent roles in parallel (see caveat).
- **masters**: Same as final; frame any prior work around users, data and delivery.

*Synthesis (grade D); the dual-track advice follows the Prospects caveat (R10).*

---

## Marketing & growth (`marketing_growth`)

### Employer signals

- **PB-MKT-S01** Practical marketing experience matters more than academics. *Grade B (evidence (careers publisher + professional body)); rules: MKT-01.*
  - [12] "The marketing and media sectors both tend to prioritise experience over academia when it comes to hiring."
  - [13] "Having real-world experience will help your CV to stand out."
- **PB-MKT-S02** Self-made experience counts: a blog, a social account, charity volunteering, a strong online profile. *Grade B (evidence (professional body + careers publisher)); rules: MKT-05.*
  - [13] "This could include starting your own blog or social account for an interest, or volunteering part-time for a local charity to showcase your skills."
  - [14] "a strong personal online profile, such as a blog, website or connections and interactions on various social media platforms"
- **PB-MKT-S03** Shows measurable results, not just activities. *Grade B (evidence (careers publisher + Google recruiter guidance reported by CNBC)); rules: MKT-03.*
  - [12] "Here the recruiter has a piece to read that immediately explains a measurable achievement."
  - [49] "Accomplished X, as measured by Y, by doing Z."
- **PB-MKT-S04** Analytical and numerate, especially in reading campaign results. *Grade B (evidence (two careers publishers + employer voice hosted by a careers publisher)); rules: MKT-10.*
  - [17] "Numeracy is important especially in analysing the results of a digital marketing campaign."
  - [15] "analytical and strategic thinking"
  - [16] "That understanding comes from measurable data, so you have to be analytical."
- **PB-MKT-S05** Flawless written communication. *Grade B (evidence (two careers publishers)); rules: MKT-07.*
  - [12] "your spelling, grammar and punctuation needs to be up to scratch."
  - [14] "excellent written communication skills"
- **PB-MKT-S06** Active, up-to-date and clean online presence. *Grade B (evidence (careers publisher + professional body)); rules: MKT-04, MKT-11.*
  - [12] "as long as you use them regularly and they’re up to date."
  - [13] "make sure your social media accounts are clean!"
- **PB-MKT-S07** Genuine, researched interest in the employer and sector. *Grade B (evidence (employer voice hosted by targetjobs + Prospects + targetjobs)); rules: none.*
  - [16] "we’re not looking for marketing experts but people who are genuinely interested in working here."
  - [14] "research the companies thoroughly and take care with your application"
  - [17] "One of the main pre-requisites for the job is enthusiasm"

### Projects

- **PB-MKT-P01 Run a society's channel or event campaign for a term**: Own one channel or campaign, set a baseline and a goal, post on a schedule, and report results with a timeframe.
  - Effort: term · Min year: 1st · Signals: PB-MKT-S01, PB-MKT-S03 · Skills: Social Media, Content Marketing, Canva, Marketing Analytics
  - Evidence it produces: One-page case study: goal, baseline, actions, result with timeframe (avoids MKT-12b).
  - Verified 2026-10-13: [17] "graduates who can demonstrate relevant work experience, such as working to promote a university event via the internet"
- **PB-MKT-P02 Start a niche blog, newsletter or social account**: Pick a topic you can sustain, publish on a fixed cadence for a term, and track what grows engagement.
  - Effort: term · Min year: 1st · Signals: PB-MKT-S02, PB-MKT-S06 · Skills: Content Marketing, SEO, Email Marketing
  - Evidence it produces: Live link on the CV + a short growth log.
  - Verified 2026-10-13: [12] "Even if you keep a blog, put that on your CV as it shows your extracurricular passion."
- **PB-MKT-P03 Analyse the Google Analytics demo account**: Use Google's demo account to find one acquisition or conversion problem and propose fixes.
  - Effort: weekend · Min year: 1st · Signals: PB-MKT-S04, PB-MKT-S03 · Skills: Google Analytics, Funnel Analysis, Marketing Analytics, PowerPoint
  - Evidence it produces: 5-slide PDF: finding, evidence chart, recommendation, how you'd measure it.
  - Verified 2026-10-13: [32] "The Analytics demo account is a fully functional Analytics account that any Google user can access."
- **PB-MKT-P04 Volunteer marketing for a local charity**: Deliver one concrete asset or campaign (posters, press release, social plan) for a charity, and record what happened.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-MKT-S01, PB-MKT-S02 · Skills: Content Marketing, Public Relations, Canva
  - Evidence it produces: Published outputs + case study.
  - Verified 2026-10-13: [13] "whether that’s designing posters for an event, writing press releases, or something completely different."
- **PB-MKT-P05 Brand teardown and campaign proposal for a target employer**: Research a brand beyond its careers site: audience, positioning, channels, competitors. Propose one campaign with KPIs.
  - Effort: weekend · Min year: 1st · Signals: PB-MKT-S07, PB-MKT-S04 · Skills: Market Research, Brand Strategy, Communication
  - Evidence it produces: Short deck or article; good material for interviews.
  - Verified 2026-10-13: [16] "Do your research beyond the careers website."

### Courses & certifications (free / free-to-audit)

- **PB-MKT-C01 [HubSpot Academy: Inbound Marketing Certification](https://academy.hubspot.com/courses/inbound-marketing)**: Inbound methodology, customer segmentation, content for the buyer's journey, marketing attribution and experimentation, automation. Bonus signal for marketing CVs (MKT-06).
  - Effort: weekend · Min year: 1st · Signals: n/a · Skills: Content Marketing, A/B Testing, Marketing Analytics · Hours: 4 hr 53 min, 9 lessons (provider) · Cost: free certification course
  - Evidence it produces: Certificate
  - Verified 2026-10-13: [30] "FREE Certification Course"
- **PB-MKT-C02 [Google Analytics Academy on Skillshop](https://support.google.com/analytics/answer/11828307?hl=en)**: Google's free GA courses. Pair with PB-MKT-P03. Make sure anything you list is current GA4, not the retired Universal Analytics (MKT-06).
  - Effort: weekend · Min year: 1st · Signals: PB-MKT-S04 · Skills: Google Analytics, Marketing Analytics · Hours: not stated · Cost: free
  - Evidence it produces: Skillshop certificate
  - Verified 2026-10-13: [32] "Analytics Academy on Skillshop offers free, online courses about Google Analytics and other Google Ads tools."; [31] "Access free online training to develop skills for Google workplace tools. Learn at your own pace and get Google product certified along the way."
- **PB-MKT-C03 [Google Ads training on Skillshop](https://skillshop.withgoogle.com/googleads/)**: Free Google Ads e-learning with certification. Most relevant to growth/performance roles.
  - Effort: weekend · Min year: 1st · Signals: PB-MKT-S04 · Skills: SEM, CTR, CPA, ROAS · Hours: not stated · Cost: free
  - Evidence it produces: Certificate
  - Verified 2026-10-13: [33] "Free Google Ads training for every kind of advertiser"
- **PB-MKT-C04 [Semrush Academy](https://www.semrush.com/academy/)**: Free SEO and content courses. Learning value; signal value modest.
  - Effort: weekend · Min year: 1st · Signals: n/a · Skills: SEO, Content Marketing, Semrush · Hours: not stated · Cost: free (provider)
  - Evidence it produces: Certificate
  - Verified 2026-10-13: [34] "Learn Marketing for Free with Online Courses from Semrush Academy"

### Experiences

- **PB-MKT-E01 Society marketing or comms role**: Run promotion for a society or university event; the most accessible first marketing experience.
  - Effort: term · Min year: 1st · Signals: PB-MKT-S01, PB-MKT-S03 · Skills: Social Media, Content Marketing
  - How to find: Students' union society committees; volunteer for an event's promotion.
  - Evidence it produces: Experience entry with results
  - Verified 2026-10-13: [17] "graduates who can demonstrate relevant work experience, such as working to promote a university event via the internet"
- **PB-MKT-E02 Charity marketing volunteering**: Part-time marketing help for a local charity.
  - Effort: term · Min year: 1st · Signals: PB-MKT-S02, PB-MKT-S01 · Skills: Content Marketing, Public Relations
  - How to find: University volunteering centre; approach local charities.
  - Evidence it produces: Experience entry + published outputs
  - Verified 2026-10-13: [13] "volunteering part-time for a local charity to showcase your skills."; [17] "Work experience could also be gained in the PR or marketing department of a voluntary organisation."
- **PB-MKT-E03 [Enactus (marketing role in a student social enterprise)](https://www.enactusuki.org/)**: Take the marketing lead on an Enactus project.
  - Effort: term · Min year: 1st · Signals: PB-MKT-S01 · Skills: Marketing Analytics, Teamwork
  - How to find: Your university's Enactus society; enactusuki.org.
  - Evidence it produces: Project role + outcome
  - Verified 2026-10-13: [48] "By linking academic learning with student-led social enterprises, we give university students the platform to manage teams, launch ventures, and tackle local issues."
- **PB-MKT-E04 [Insight days / spring weeks](https://targetjobs.co.uk/s/jobs/insight-programme)**: Early exposure to marketing graduate schemes.
  - Effort: weekend · Min year: 1st · Signals: PB-MKT-S07 · Skills: Commercial Awareness
  - How to find: targetjobs insight-programme search; employer graduate sites.
  - Evidence it produces: Experience entry
  - Verified 2026-10-13: [6] "so many spring weeks and insight programmes are offered to first years (or second years on four-year courses)"; [47] "Insight programme opportunities"
- **PB-MKT-E05 [Forage virtual job simulation](https://www.theforage.com/)**: Free, self-paced employer tasks. Convention: low CV signal; good for testing interest.
  - Effort: weekend · Min year: 1st · Signals: PB-MKT-S07 · Skills: n/a
  - How to find: theforage.com, search 'marketing'.
  - Evidence it produces: Certificate (low signal)
  - Verified 2026-10-13: [46] "Explore careers and prepare for the job with hundreds of free job simulations designed by the world's top employers."

### Year guidance

- **1st**: Get a society comms role or start your own channel; take one free certification; apply to insight programmes.
- **2nd**: On four-year courses: build a results-based case study; otherwise treat as penultimate.
- **penultimate**: Apply for marketing internships; lead with experience and 2 case studies with measurable results.
- **final**: Graduate schemes; experience-first CV (MKT-01), zero typos (MKT-07), current links.
- **masters**: Same as final; turn the dissertation into a consumer-insight story if relevant.

*Synthesis (grade D), aligned with cv-rules-tech-product.md section 5.*

---

## Research (`research`)

### Employer signals

- **PB-RES-S01** Has hands-on research experience before applying (summer placements, work in a university research group). *Grade B (evidence (careers publisher + funder)); rules: RES-03.*
  - [18] "Some scientific organisations offer research-based summer placements for undergraduate students and you may also be able to get work experience in a university research department."
  - [20] "The purpose of the awards is to give experience of research to undergraduates with research potential"
- **PB-RES-S02** Strong academic record (often a 2:1 or First trajectory). *Grade B (evidence (careers publisher + funder); physical sciences/maths context); rules: RES-02.*
  - [18] "you'll need a good honours degree, usually a 2:1 or above in a related science subject."
  - [20] "Students will normally be expected to be on track for a first class degree in order to be considered."
- **PB-RES-S03** Approaches academics proactively about projects. *Grade B (evidence (careers publisher + university scheme)); rules: RES-03.*
  - [18] "You can also get in touch with potential academic supervisors to ask for work shadowing opportunities."
  - [19] "approach individual members of staff whose research they are interested in to discuss any possible ideas or opportunities."
- **PB-RES-S04** Can communicate research in writing and presentations. *Grade B (evidence (careers publisher + careers service, PhD-focused)); rules: RES-04, RES-07.*
  - [18] "communication and presentation skills, for writing reports and papers for publication and to present your research at conferences"
  - [21] "Conferences you have attended, and those at which you were an invited speaker"
- **PB-RES-S05** Technical research skills, including research tools and programming. *Grade B (evidence (careers service, PhD-focused + careers publisher)); rules: RES-06.*
  - [21] "Technical skills, including research tools and programming languages"
  - [18] "technical and scientific skills"

### Projects

- **PB-RES-P01 Focused literature review**: Pick a narrow question in a field you'd like to research, read and summarise the key papers, and end with an open question you could test.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-RES-S04, PB-RES-S03 · Skills: Literature Review, Academic Writing, LaTeX
  - Evidence it produces: 3-5 page PDF to send with an email to a potential supervisor.
  - Verified 2026-10-13: [18] "You can also get in touch with potential academic supervisors to ask for work shadowing opportunities."
- **PB-RES-P02 Reproduce a published result**: Choose a paper with public data or code, reproduce one figure or table, and document what matched and what didn't.
  - Effort: term · Min year: 2nd · Signals: PB-RES-S05, PB-RES-S01 · Skills: Python, R, Statistics, Git
  - Evidence it produces: Repo + short report; cite the paper correctly (RES-04).
  - Verified 2026-10-13: [21] "Technical skills, including research tools and programming languages"
- **PB-RES-P03 Research poster from coursework or a project**: Turn a strong piece of project work into a poster and present it at a departmental or society event.
  - Effort: 2-4 weeks · Min year: penultimate · Signals: PB-RES-S04 · Skills: Poster Presentation, Communication
  - Evidence it produces: Poster PDF + listing under Presentations (RES-07).
  - Verified 2026-10-13: [18] "communication and presentation skills, for writing reports and papers for publication and to present your research at conferences"
- **PB-RES-P04 Small original study**: Design a small study or experiment with a clear hypothesis, collect data (follow your department's ethics process where needed), analyse and write up.
  - Effort: term · Min year: 2nd · Signals: PB-RES-S01, PB-RES-S05 · Skills: Experimental Design, Hypothesis Testing, R
  - Evidence it produces: Write-up in paper format; never list it as 'published' unless it is (RES-04).
  - Verified 2026-10-13: [18] "research and analytical skills and a logical approach to problem solving"
- **PB-RES-P05 Make one analysis fully reproducible**: Put a coursework analysis under version control with an environment file, a README and a one-command run.
  - Effort: weekend · Min year: 1st · Signals: PB-RES-S05 · Skills: Git, Python, Linux
  - Evidence it produces: Public repo that runs from a clean checkout.
  - Verified 2026-10-13: [37] "Welcome to The Turing Way handbook to reproducible, ethical and collaborative data science."

### Courses & certifications (free / free-to-audit)

- **PB-RES-C01 [Software Carpentry lessons (Unix shell, Git, Python or R)](https://software-carpentry.org/lessons/)**: Core research-computing skills. Learning value high; no CV signal by itself.
  - Effort: 2-4 weeks · Min year: 1st · Signals: PB-RES-S05 · Skills: Linux, Git, Python, R · Hours: not stated · Cost: open lessons, CC-BY 4.0
  - Evidence it produces: Supports PB-RES-P05
  - Verified 2026-10-13: [35] "Instructors teach our three core topics: the Unix shell, version control with Git, and a programming language (Python or R)."; [36] "Materials licensed under CC-BY 4.0 by the authors"
- **PB-RES-C02 [The Turing Way (reproducible, ethical, collaborative research handbook)](https://book.the-turing-way.org/)**: Guide to reproducible research practice. Learning only.
  - Effort: weekend · Min year: 1st · Signals: PB-RES-S05 · Skills: Git · Hours: not stated · Cost: free, CC-BY
  - Evidence it produces: none directly
  - Verified 2026-10-13: [37] "Everything here is available for free under a CC-BY licence."
- **PB-RES-C03 [Learn LaTeX in 30 minutes (Overleaf)](https://www.overleaf.com/learn/latex/Learn_LaTeX_in_30_minutes)**: Intro to LaTeX for reports, posters and papers. Learning only.
  - Effort: weekend · Min year: 1st · Signals: PB-RES-S04 · Skills: LaTeX · Hours: about 30 minutes (title) · Cost: free tutorial
  - Evidence it produces: Your write-ups typeset in LaTeX
  - Verified 2026-10-13: [38] "This introductory tutorial does not assume any prior experience of"
- **PB-RES-C04 [An Introduction to Statistical Learning (free book + labs)](https://www.statlearning.com/)**: Statistical-learning methods with R or Python labs; useful for quantitative research.
  - Effort: term · Min year: 2nd · Signals: PB-RES-S05 · Skills: Statistics, Regression, Machine Learning · Hours: not stated · Cost: free PDF download (verified)
  - Evidence it produces: Lab notebooks
  - Verified 2026-10-13: [28] "An Introduction to Statistical Learning provides a broad and less technical treatment of key topics in statistical learning."
- **PB-RES-C05 [MIT 18.06 Linear Algebra (OCW)](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/)**: Foundational maths for quantitative and ML research. Learning only.
  - Effort: term · Min year: 1st · Signals: PB-RES-S05 · Skills: Linear Algebra · Hours: not stated · Cost: free (OCW)
  - Evidence it produces: none directly
  - Verified 2026-10-13: [39] "Freely sharing knowledge with learners and educators around the world."

### Experiences

- **PB-RES-E01 Summer research project with a member of staff (UROP-style)**: Email academics whose work interests you with a short note and your literature review; ask about summer projects and departmental funding. Imperial's UROP is one example of a structured scheme; check what your own university runs.
  - Effort: term · Min year: 1st · Signals: PB-RES-S01, PB-RES-S03 · Skills: Research Assistant
  - How to find: Staff research pages in your department; your department's undergraduate research/funding page.
  - Evidence it produces: Research Experience entry: project, supervisor, methods, your contribution, output (RES-03)
  - Verified 2026-10-13: [19] "UROP is a research opportunities programme available to continuing students to participate in real research and appreciate the environment."; [18] "research-based summer placements for undergraduate students"
- **PB-RES-E02 [LMS Undergraduate Research Bursary (maths/statistics only)](https://www.lms.ac.uk/grants/undergraduate-research-bursaries/applications)**: Funded 6-8 week (full-time) summer maths research project. The supervisor applies on your behalf; 2027 round deadline 1 February 2027 (from the 2027 page).
  - Effort: term · Min year: penultimate · Signals: PB-RES-S01, PB-RES-S02 · Skills: Research Assistant, Probability, Linear Algebra
  - How to find: Ask a maths/stats academic at your UK university to apply with you; read the 2027 conditions on the LMS page.
  - Evidence it produces: Award + project on CV (RES-08)
  - Verified 2026-10-13: [20] "students must have completed (the equivalent of) at least two full academic years of an undergraduate degree in mathematics/statistics"; [20] "Application deadline: 1 February 2027"
- **PB-RES-E03 Industry placement year or vacation work in a research setting**: A placement year or vacation role in an R&D team builds the lab and technical experience research employers look for.
  - Effort: term · Min year: 2nd · Signals: PB-RES-S01, PB-RES-S05 · Skills: Research Assistant, Lab Techniques
  - How to find: Your department's placement office; R&D employers' placement schemes.
  - Evidence it produces: Experience entry with methods and outputs
  - Verified 2026-10-13: [18] "This experience can be achieved through a placement year in industry during your degree or vacation work."
- **PB-RES-E04 [Outreachy (research tracks exist; eligibility restricted)](https://www.outreachy.org/)**: Paid remote open-source internships; some projects are research. Check eligibility first. No 2027 dates given here.
  - Effort: term · Min year: 1st · Signals: PB-RES-S05 · Skills: Open Source
  - How to find: outreachy.org applicant guide.
  - Evidence it produces: Internship on CV
  - Verified 2026-10-13: [43] "Outreachy internship projects may include programming, research, user experience, documentation, graphical design, data science, marketing"

### Year guidance

- **1st**: Protect your grades; make one analysis reproducible; write a short literature review; start conversations with academics.
- **2nd**: Seek a summer research project (UROP-style) or vacation work; reproduce a published result.
- **penultimate**: Apply for funded summer research (e.g. LMS bursary for maths/stats); present a poster if possible.
- **final**: Make the dissertation your headline research experience; line up academic referees.
- **masters**: Research project + any posters/preprints, cited honestly (RES-04); apply for PhD or research roles.

*Synthesis (grade D), aligned with cv-rules-tech-product.md section 6; LMS eligibility from R20.*

---

## Sources

All accessed 2026-10-13. 'Check' says how we confirmed the page is live and contains the quoted text.

1. Prospects (Jisc), "Software engineer (job profile)". https://www.prospects.ac.uk/job-profiles/software-engineer. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R1)
2. targetjobs, "Tips for a graduate technical CV: template and advice", 26 Nov 2025. https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R2)
3. Monzo (employer blog), "Preparing for Mobile Interviews at Monzo", 29 Jan 2025. https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo. Kind: employer. Check: curl HTTP 200 + quote matched in page text. (JSON id R3)
4. targetjobs, "How to show your passion for technology in your IT graduate application (quotes IBM hiring team lead)". https://targetjobs.co.uk/careers-advice/information-technology/how-show-your-passion-technology-your-it-graduate-application. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text (old /career-sectors/... URL 301-redirects here; URL updated 2026-10-13). (JSON id R4)
5. targetjobs, "Extracurricular activities that will develop your IT skills". https://targetjobs.co.uk/careers-advice/information-technology/extracurricular-activities-will-develop-your-it-skills. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R5)
6. targetjobs, "What is a spring week, insight day or insight programme?". https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R6)
7. Prospects (Jisc), "Data analyst (job profile)". https://www.prospects.ac.uk/job-profiles/data-analyst. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R7)
8. Prospects (Jisc), "Data scientist (job profile)". https://www.prospects.ac.uk/job-profiles/data-scientist. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R8)
9. Royal Statistical Society, "Types of job: Data Scientist", undated; content looks dated (Hadoop, C#). https://rss.org.uk/jobs-careers/career-development/types-of-job/data-scientist/. Kind: professional-body. Check: curl HTTP 200 + quote matched in page text. (JSON id R9)
10. Prospects (Jisc), "Product manager (job profile)". https://www.prospects.ac.uk/job-profiles/product-manager. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R10)
11. targetjobs (Capital One graduate profile), "What it's really like working as a Graduate Product Manager at Capital One". https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one. Kind: employer. Check: curl HTTP 200 + quote matched in page text. (JSON id R11)
12. targetjobs, "Writing a CV for graduate advertising, marketing and PR jobs". https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/writing-cv-graduate-advertising-marketing-and-pr-jobs. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R12)
13. CIM Scotland (Chartered Institute of Marketing), "Help to get your first job in marketing", 2023. https://regions.cim.co.uk/scotland/home/news/2023/help-to-get-your-first-job-in-marketing. Kind: professional-body. Check: curl HTTP 200 + quote matched in page text. (JSON id R13)
14. Prospects (Jisc), "Digital marketer (job profile)". https://www.prospects.ac.uk/job-profiles/digital-marketer. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R14)
15. Prospects (Jisc), "Marketing executive (job profile)". https://www.prospects.ac.uk/job-profiles/marketing-executive. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R15)
16. targetjobs / L'Oréal, "How to get a job at L'Oréal (L'Oréal graduate; advertising feature)". https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/how-get-job-loreal. Kind: employer. Check: curl HTTP 200 + quote matched in page text. (JSON id R16)
17. targetjobs, "Digital marketing: graduate area of work". https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/digital-marketing-graduate-area-work. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R17)
18. Prospects (Jisc), "Research scientist (physical sciences) (job profile)". https://www.prospects.ac.uk/job-profiles/research-scientist-physical-sciences. Kind: careers-publisher. Check: curl HTTP 200 + quote matched in page text. (JSON id R18)
19. Imperial College London, Dept of Aeronautics, "Undergraduate Research Opportunities Programme (UROP)". https://www.imperial.ac.uk/aeronautics/study/ug/current-students/undergraduate-research-opportunities-programme-urop/. Kind: employer. Check: curl HTTP 200 + quote matched in page text. (JSON id R19)
20. London Mathematical Society, "Undergraduate Research Bursaries 2027". https://www.lms.ac.uk/grants/undergraduate-research-bursaries/applications. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R20)
21. University of Cambridge Careers Service, "CVs and cover letters for PhDs and postdocs (CV book, PDF)". https://www.careers.cam.ac.uk/files/phdpostdoccvbook.pdf. Kind: careers-publisher. Check: curl HTTP 200 + PDF text extracted (pypdf) + quote matched. (JSON id R21)
22. Harvard University, "CS50x: Introduction to Computer Science (OpenCourseWare)". https://cs50.harvard.edu/x/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R30)
23. MIT CSAIL, "The Missing Semester of Your CS Education". https://missing.csail.mit.edu/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R31)
24. University of Helsinki, "Full Stack Open". https://fullstackopen.com/en/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R32)
25. MIT OpenCourseWare, "6.006 Introduction to Algorithms (Spring 2020)". https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R33)
26. Kaggle, "Kaggle Learn". https://www.kaggle.com/learn. Kind: provider. Check: JS page: quote confirmed via firecrawl directQuote (re-verified 2026-10-13). (JSON id R34)
27. SQLBolt, "SQLBolt". https://sqlbolt.com/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R35)
28. James, Witten, Hastie, Tibshirani (statlearning.com), "An Introduction to Statistical Learning (ISLR / ISLP)". https://www.statlearning.com/. Kind: provider. Check: curl HTTP 200 + quote matched; ISLP PDF download link resolved to a 20 MB PDF. (JSON id R36)
29. fast.ai, "Practical Deep Learning for Coders". https://course.fast.ai/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R37)
30. HubSpot Academy, "Inbound Marketing Certification". https://academy.hubspot.com/courses/inbound-marketing. Kind: provider. Check: JS page: quote, '9 Lessons' and '4 hr 53 min' confirmed via in-browser innerText (re-verified 2026-10-13). (JSON id R40)
31. Google, "Skillshop (home)". https://skillshop.withgoogle.com/. Kind: provider. Check: firecrawl scrape: page meta description; curl HTTP 200. (JSON id R41)
32. Google Analytics Help, "Google Analytics account training guide and support". https://support.google.com/analytics/answer/11828307?hl=en. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R42)
33. Google, "Free Google Ads training (Skillshop)". https://skillshop.withgoogle.com/googleads/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R43)
34. Semrush, "Semrush Academy". https://www.semrush.com/academy/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R44)
35. The Carpentries, "Software Carpentry lessons". https://software-carpentry.org/lessons/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R45)
36. The Carpentries, "Version Control with Git (Software Carpentry lesson)". https://swcarpentry.github.io/git-novice/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R46)
37. The Turing Way community (supported by The Alan Turing Institute), "The Turing Way". https://book.the-turing-way.org/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R47)
38. Overleaf, "Learn LaTeX in 30 minutes". https://www.overleaf.com/learn/latex/Learn_LaTeX_in_30_minutes. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R48)
39. MIT OpenCourseWare, "18.06 Linear Algebra (Spring 2010)". https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/. Kind: provider. Check: curl HTTP 200 + quote matched in page text. (JSON id R49)
40. Major League Hacking (MLH), "2027 Season events". https://www.mlh.com/seasons/2027/events. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R50)
41. Google, "Google Summer of Code (home)". https://summerofcode.withgoogle.com/. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R51)
42. Google, "Google Summer of Code rules". https://summerofcode.withgoogle.com/rules. Kind: programme. Check: JS page: quote confirmed via firecrawl directQuote (re-verified 2026-10-13). (JSON id R52)
43. Software Freedom Conservancy, "Outreachy". https://www.outreachy.org/. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R53)
44. UKIEPC, "UKIEPC (UK & Ireland Programming Contest)". https://ukiepc.info/. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R54)
45. Kaggle, "Kaggle Competitions". https://www.kaggle.com/competitions. Kind: programme. Check: JS page: both quotes confirmed via in-browser innerText (re-verified 2026-10-13). (JSON id R55)
46. Forage, "Forage job simulations". https://www.theforage.com/. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R56)
47. targetjobs, "Insight programme opportunities (search)". https://targetjobs.co.uk/s/jobs/insight-programme. Kind: programme. Check: curl HTTP 200 + quote matched in page text. (JSON id R57)
48. Enactus UK & Ireland, "Enactus UK & Ireland". https://www.enactusuki.org/. Kind: programme. Check: curl HTTP 200 + quote matched in page text (enactusuk.org redirects here; URL updated 2026-10-13). (JSON id R58)
49. CNBC (reporting Google recruiter guidance), "Google recruiters share the 3-part formula for stronger resumes", 16 Aug 2018. https://www.cnbc.com/2018/08/16/google-recruiters-share-the-3-part-formula-for-stronger-resumes.html. Kind: employer. Check: curl HTTP 200 + quote matched in page text (added by verifier 2026-10-13). (JSON id R59)

## Gaps and deletions

Deleted because they could not be fully verified today:
- Google STEP (the programme URL now redirects to the Google Careers home).
- Google DeepMind Student Researcher Program (live for 2026-27, but the page does not say UK locations are available).
- Bright Network Internship Experience UK (the page shows the June 2026 edition, and does not say it is free).
- L'Oréal Brandstorm (the current edition shows as 'TBD').
- Coursera courses (UVA Digital PM, Google UX foundations, Understanding Research Methods): the pages say 'Enroll for free' but do not confirm a free audit.
- Meta Blueprint, Microsoft Learn Power BI, Google ML Crash Course, Amplitude Academy, Atlassian Agile Coach, Scrum Guide: no explicit free or eligibility statement captured, or low value.
- MLH Fellowship: live, but UK eligibility is not stated.

Other gaps:
- No ISE source is used. The ISE homepage carries no role-specific screening claims, and no ISE report was fetched this session.
- No Gradcracker source is used: the pages returned 403.
- PRD and MKT employer voices come via targetjobs-hosted graduate profiles (Capital One; L'Oréal, which is an advertising feature), not the firms' own careers sites.
- RES signals lean on physical-sciences/maths sources (Prospects, LMS) and a PhD-focused Cambridge guide. Life-science-specific schemes were not verified.
- Forage: the homepage confirms free simulations, but the per-function simulations were not enumerated.
- For GSoC, Outreachy and UKIEPC, 2027 dates are not given because no 2026/27 cycle page with dates was confirmed (Outreachy lists only the May and December 2026 rounds).

## Verification log (2026-10-13)

An independent adversarial pass re-fetched every cited URL (curl; JS-rendered pages Kaggle Learn, Kaggle Competitions, GSoC rules and HubSpot Academy were checked via firecrawl or in-browser page text), string-matched every quote, and checked claim support, source independence, programme status, minYear, skill names (`lib/skills/vocab.ts`) and rule IDs. All 32 original signals and 70 actions were reviewed. All quotes were found on their pages. Every skill name and rule ID (including sub-items such as SWE-17a, DAT-11c, PRD-09a, MKT-12b) exists.

**FAIL (deleted)**
- PB-MKT-S08 "Online courses can help you stand out": single source (a 2023 CIM Scotland regional news post) and no second independent source found on the cited pages, so it breaks the ≥2-source rule for signals. Removed, along with its references from PB-MKT-C01, C02, C03 and C04. Those courses stay because they are verified free, but C01 and C04 now link to no signal.

**REWORD (applied)**
- PB-SWE-S05: the claim "matters more than prior experience" rested only on Monzo, since the Prospects quote just lists problem solving as a skill. Now reads: "Problem-solving ability is a core requirement; Monzo says it hires for problem-solving ability over experience."
- PB-SWE-E05 howToFind and SWE 1st-year guidance: changed "Mostly / most are aimed at first years" to "Many are aimed at first years". The source says "so many", not "most".
- PB-DAT-S01: Prospects says Python or R is needed "for some roles". The claim now says "SQL, plus Python or R where the role calls for it (expected for data science), and a visualisation tool ... for analyst roles".
- PB-DAT-S03: the second source (targetjobs, on soft skills in general) did not support "explains findings to non-specialists". Replaced it with targetjobs R5: "practise explaining technical things to people with little or no technical knowledge".
- PB-DAT-S05: was grade C with a single source. Added targetjobs R5 (tech competitions develop skills) as an independent second source, regraded to B, and reworded it as "a recommended way to gain experience, visibility and skills".
- PB-DAT-S06: was grade C with a single source. Added targetjobs R5 (improve a society's processes or databases), regraded to B, and reworded it as "a recommended way to build experience" rather than "counts as experience".
- PB-DAT-P02: removed the promised outcome. The dashboard is now one "they can use for a real decision", and the evidence asks what it was used for, "if anything".
- PB-PRD-S01 to S05: regraded A to B. The employer voice is a Capital One graduate profile hosted by targetjobs, which counts as "employer content via a publisher" (grade B) under the grade scale, not the employer's own guidance.
- PB-PRD-S06: "Technical literacy helps" overreached Prospects ("for some roles ... may be helpful"). Now reads: "A technical background can help for some PM roles but is not required for all."
- PB-PRD-P04: the evidence now says "adoption numbers if you have them", so it does not promise an outcome.
- PB-PRD-C03: "Capital One says" became "a Capital One graduate PM writes". The quote is one employee's view in a profile, not company policy.
- PB-PRD-E02 and PB-MKT-E03 (Enactus): the old quotes did not support "university teams run social-enterprise projects". Replaced with the page's own sentence on student-led social enterprises. URL updated to enactusuki.org, because enactusuk.org redirects there.
- PB-MKT-S01, S02, S04, S05: regraded A to B. None has the employer's own guidance; the L'Oréal voice is a targetjobs-hosted feature.
- PB-MKT-S03: its two sources were both targetjobs (R12 and the targetjobs/L'Oréal feature), so they were not independent, and the L'Oréal quote ("driven by data") did not support "measurable results". Replaced it with Google recruiter guidance reported by CNBC (new source R59: "Accomplished X, as measured by Y, by doing Z.").
- PB-MKT-S07: both sources were targetjobs pages, so they were not independent. Added Prospects R14 ("research the companies thoroughly and take care with your application").
- PB-MKT-C01 (HubSpot): the description listed "personas, A/B tests" and the skill "CRM", which the curriculum does not show. Now matches the published curriculum (customer segmentation, buyer's-journey content, attribution and experimentation, automation), and CRM is removed from skills.
- PB-RES-S01 to S03: regraded A to B. The sources are Prospects plus a funder (LMS) or a university scheme page, not employer hiring guidance.
- PB-RES-P05: the cited quote (a CC-BY licence line) did not support the project idea. Replaced with The Turing Way's statement that it is a handbook to reproducible data science.
- PB-RES-C02 (The Turing Way): removed the skill "Academic Writing", which is not what the handbook teaches. Skills are now Git only.
- Source housekeeping: the R4 URL was updated to its redirect target. The JS-page check notes for R34, R40, R52 and R55 were updated.

**Notes (PASS, but worth knowing)**
- UKIEPC 2026 is on 17 October 2026 (4 days after this check). The item gives no dates, so it stays valid.
- CIM Scotland (R13) is a 2023 article and the RSS data-scientist page (R9) looks dated. Their quoted advice is general and is still backed by a second source.
- Outreachy is confirmed paid ($7,000 stipend) on its homepage.
