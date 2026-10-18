# Role Playbooks: Finance/Banking, Quant/Trading, Consulting (UK students)

Compiled: 2026-10-13. Status: research input for the Placed Role Playbooks feature. Not recruiting advice. Machine-readable version: `role-playbooks-finance-consulting.json` (same IDs).

## How to read this

- **Signals** (`PB-<ARCH>-Sxx`) are what UK early-careers recruiters screen for. Each signal links to the CV rules in `cv-rules-finance-consulting.md` (`FCQ-`, `FIN-`, `QNT-`, `CON-` IDs) where one exists. An empty rule list means the signal is about the *process* (tests, interviews), not the CV.
- **Actions** (`PB-<ARCH>-Pxx` projects, `Cxx` courses, `Exx` experiences) are concrete things a student can do. Each lists the signals it builds, canonical skills from `lib/skills/vocab.ts`, effort (`weekend` / `2-4 weeks` / `term`), the minimum year of study, and the evidence it leaves behind.
- **Evidence grades** use the A-D scale from the CV-rules docs, tightened for this file:
  - **A**: the employer's own guidance plus at least one independent corroborating source (another firm, ISE, Prospects, TARGETjobs).
  - **B**: at least 2 independent sources, at least one primary, but the corroboration is partial (e.g. a non-UK office page).
  - **C**: *convention*. Only one source states it.
  - **D**: synthesis with no source. None are used here.
- **Every quote is verbatim** from the page as fetched on 2026-10-13 and is at most 25 words. Each quote was string-matched against the fetched page text (re-checked in the 2026-10-13 verification pass). Square-bracket numbers point to the Sources list at the end.
- **Verified** means the URL was fetched on 2026-10-13 and found live, free or free-to-audit where marked, and open to UK students. Generic actions (e.g. "join your investment society") name no programme and have no URL, so they show `verified: null`.
- **Timings** appear only where the firm's own 2026/27 page states them. Otherwise none is given. Trackers such as the-trackr.com are a good way to *find* openings, but their dates are estimates.
- **No statistic** appears unless the source states it verbatim.


---

## Finance / Banking (`finance_banking`)

### Employer signals

| ID | Signal | Linked rules | Grade | Evidence (verbatim, accessed 2026-10-13) |
|---|---|---|---|---|
| PB-FIN-S01 | Spring weeks and insight programmes are the main early pipeline into summer internships. Attendance can lead to internship consideration or a fast-track, but firms rarely publish conversion rates. | FIN-04 | A | [1] "Participants may be considered for next steps linked to summer internship opportunities, depending on the pathway and programme process."<br>[2] "If you make a great impression, you're likely to be offered a place on their internship the following year"<br>[3] "Many graduate roles are filled by interns from Spring weeks."<br>[4] "Conversion rates vary enormously between firms and are rarely published, so treat any specific figure you read with suspicion." |
| PB-FIN-S02 | Grades matter: Prospects says banking employers usually look for at least a 2:1, and Barclays says it does not select purely on academic record but also on activities and work experience. Across all graduate employers, ISE reports the share requiring a 2:1 fell from 71% (2015/16) to 47% (2024/25). *Note: The ISE figure covers all graduate employers (not banking specifically) and compares 2015/16 with 2024/25.* | FCQ-04, FIN-02 | A | [5] "employers usually look for at least a 2:1 degree, strong academic results and evidence of commercial awareness, analytical ability and teamwork skills"<br>[6] "We don't select people purely on academic record, so tell us about your extra-curricular activities, work experience"<br>[7] "the share demanding a 2:1 degree has fallen from 71% to 47% over the same period." |
| PB-FIN-S03 | Commercial awareness: following markets, deals and the firm's business, then using that knowledge in interviews and scenario questions. | FIN-04 | A | [5] "commercial awareness and an understanding of financial markets, business trends and the wider economy"<br>[3] "Commercial awareness is important. Keep up with the news - this can be in relation to the firm, the sector or the industry(s)"<br>[8] "by whether you factor in commercial considerations when approaching scenario-based interview questions or exercises." |
| PB-FIN-S04 | Early screening relies on online tests (situational judgement, numerical/verbal reasoning, games) and video interviews. This is the process, not the CV, so prepare for it separately. | — | A | [3] "You may encounter tests such as Pymetrics (games), psychometric tests (situational judgement), and numerical and verbal reasoning assessments."<br>[9] "If you're selected to interview, your first step is a 30-minute video meeting."<br>[6] "When completing assessments online, read through the instructions carefully and complete all practise and example questions." |
| PB-FIN-S05 | Leadership, teamwork and judgement, shown through concrete examples (society roles, captaincy, team projects). | FIN-06 | A | [6] "Illustrate your answers with clear examples of how you've shown good judgment, innovation, teamwork, commitment and leadership."<br>[10] "What have you done, what are some of the activities you have been involved with, where have you shown leadership."<br>[5] "positions of responsibility, involvement in student societies or holiday work can also strengthen your applications, particularly if they show teamwork, leadership" |
| PB-FIN-S06 | Any job counts (retail, hospitality, tutoring) if you quantify what you achieved in it. | FIN-05, FCQ-08 | A | [10] "if you are in fast food, you can leverage those experiences and quantify them to make them impactful."<br>[11] "Let us know what you're passionate about and what you've accomplished, using measurable data when applicable." |
| PB-FIN-S07 | Tailored, error-free applications that use the job description's key words and name the division and role you want. | FCQ-05, FCQ-10 | A | [6] "Study the job description and pull-out key words, then ensure these are highlighted throughout your CV/Resume."<br>[3] "Articulate why you are applying to that specific division and that specific role."<br>[3] "Use correct spelling, punctuation, and grammar - this is important for the sector (think pitch-decks, research reports, presentations)" |
| PB-FIN-S08 | Numerical and financial-modelling ability. Prospects lists it as a core skill of the job. No bank source we fetched requires modelling from first- or second-year applicants. *Note: Convention: only one independent source states it. Modelling is taught on the job; treat it as a differentiator for penultimate-year IBD applicants, not a gate.* | FIN-07 | C | [5] "strong numerical, analytical and financial modelling skills" |

### Projects

**PB-FIN-P01: Stock pitch / investment thesis write-up**
- What: Pick a UK-listed company. Write a 2-page buy/sell thesis covering business model, 3 key drivers, valuation (multiples plus a simple DCF), risks and catalysts. Present it at your investment society or a pitch competition, then record the outcome and what you would change.
- Builds signals: PB-FIN-S03, PB-FIN-S05. Skills: Stock Pitch, Valuation, Equity Research, Commercial Awareness, Excel, PowerPoint.
- Effort: 2-4 weeks. Min year: 1. Evidence produced: PDF thesis + slide deck; a CV line built only from what actually happened, e.g. 'Pitched [company] ([BUY/SELL], [x]% target) to [audience]; [result, if any]'.
- URL: none (generic action; verified: null)
- Sources: [5] "commercial awareness and an understanding of financial markets, business trends and the wider economy"; [8] "by whether you factor in commercial considerations when approaching scenario-based interview questions or exercises."

**PB-FIN-P02: Three-statement + DCF model from a real annual report**
- What: Build a linked income statement, balance sheet and cash-flow forecast for one listed company from its annual report, then a DCF with a sensitivity table. Keep it simple enough to defend line by line, because interviewers probe anything on the CV (FCQ-11).
- Builds signals: PB-FIN-S08. Skills: Financial Modelling, DCF, Accounting, Excel, Valuation.
- Effort: 2-4 weeks. Min year: 1. Evidence produced: Excel model + 1-page summary of assumptions and value range; can be discussed in interviews.
- URL: none (generic action; verified: null)
- Sources: [5] "carry out financial modelling and develop tailored financial solutions for clients"; [12] "Financial Modeling DCF Modeling"

**PB-FIN-P03: Weekly markets / deal note**
- What: Every week, publish a 300-word note on one market move or UK deal: what happened, why, who wins or loses, and what you would watch next. Use the archive for 'why banking' answers and commercial-awareness questions.
- Builds signals: PB-FIN-S03. Skills: Commercial Awareness, Communication, M&A, Capital Markets.
- Effort: term. Min year: 1. Evidence produced: Archive of 8+ dated notes (blog, LinkedIn or society newsletter); CV line with readership if you have it.
- URL: none (generic action; verified: null)
- Sources: [3] "Commercial awareness is important. Keep up with the news - this can be in relation to the firm, the sector or the industry(s)"; [8] "a range of business magazines, including The Economist and the Financial Times"

**PB-FIN-P04: M&A deal teardown**
- What: Take one recently announced UK deal. In 2 pages cover the strategic rationale, the implied valuation multiple versus peers, how it was financed, and whether you would have advised the target to accept.
- Builds signals: PB-FIN-S03, PB-FIN-S08. Skills: M&A, Valuation, Commercial Awareness, Due Diligence.
- Effort: weekend. Min year: 1. Evidence produced: 2-page teardown; reusable as an interview 'deal you followed' answer.
- URL: none (generic action; verified: null)
- Sources: [12] "Advise your client, WorldWide Brewing Co., on a suitable M&A target to expand their operations in Asia as a junior Investment Banker."; [5] "commercial awareness and an understanding of financial markets, business trends and the wider economy"


### Courses and certifications (free / free-to-audit)

**PB-FIN-C01: MIT OpenCourseWare 15.401 Finance Theory I**
- What: Free lecture videos, notes and problem sets (Andrew Lo) covering present value, fixed income, equities, options, portfolio theory and CAPM. Signal value: builds technical-interview knowledge, but not a CV credential by itself.
- Builds signals: PB-FIN-S08. Skills: Valuation, Fixed Income, Derivatives, Portfolio Management.
- Effort: term. Min year: 1. Evidence produced: Completed problem sets; ability to answer valuation and markets questions.
- URL: https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: low on CV, medium for interviews
- Sources: [13] "This course introduces the core theory of modern financial economics and financial management, with a focus on capital markets and investments."; [13] "Freely sharing knowledge with learners and educators around the world."

**PB-FIN-C02: Corporate Finance Institute: Careers in Finance**
- What: A free 1h30 self-paced course mapping finance careers. Use it to choose a division (IBD vs markets vs asset management) before you tailor applications. Its CV signal is very low, so don't list it as a credential.
- Builds signals: PB-FIN-S07. Skills: Commercial Awareness.
- Effort: weekend. Min year: 1. Evidence produced: A clear division choice to state in applications (FCQ-10).
- URL: https://corporatefinanceinstitute.com/course/careers-in-finance/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: very low
- Sources: [14] "Enroll For Free"


### Experiences

**PB-FIN-E01: JPMorganChase Spring Insights**
- What: A spring insight programme with five pathways (technology, banking, markets, asset and wealth management, operations). Participants may be considered for summer-internship next steps.
- Builds signals: PB-FIN-S01, PB-FIN-S04. Skills: Commercial Awareness, Communication, Teamwork.
- Effort: weekend. Min year: 1. Evidence produced: Insight programme line on the CV; possible route into internship consideration.
- URL: https://www.jpmorganchase.com/careers/explore-opportunities/programs/spring-insights (verified: true, accessed 2026-10-13)
- How to find: Firm programmes page. The page gives no 2026/27 dates; use a tracker (the-trackr.com UK Finance) to spot when it opens.
- Sources: [1] "If you're planning to start your full-time career in two years' time, Spring Insights gives you the chance to take a closer look"; [1] "Participants may be considered for next steps linked to summer internship opportunities, depending on the pathway and programme process."

**PB-FIN-E02: Forage: JPMorganChase Investment Banking job simulation**
- What: A free, self-paced virtual simulation (3-4 hours): pick M&A targets for a client and build a DCF. Gives a certificate of completion. Low signal on its own; most useful for motivation answers and a first look at the work.
- Builds signals: PB-FIN-S01, PB-FIN-S08. Skills: M&A, DCF, Financial Modelling, Communication.
- Effort: weekend. Min year: 1. Evidence produced: Forage certificate (list under extracurriculars/courses, not work experience).
- URL: https://www.theforage.com/simulations/jpmorgan/investment-banking-hkyd (verified: true, accessed 2026-10-13, free)
- Honest signal value: low
- Sources: [12] "Complete work that simulates life on the job. 3-4 hours and self-paced."; [12] "No applications, self paced and can participate from anywhere in the world"

**PB-FIN-E03: Investment / finance society: committee role and pitch competitions**
- What: Join your university's investment or finance society. Aim for a committee or analyst-team role, and enter its stock-pitch or trading competitions. This is generic advice, not a named programme.
- Builds signals: PB-FIN-S05, PB-FIN-S03. Skills: Leadership, Teamwork, Stock Pitch, Commercial Awareness.
- Effort: term. Min year: 1. Evidence produced: Committee title + quantified outcome (events run, members, competition placing).
- URL: none (generic action; verified: null)
- How to find: Your students' union society directory.
- Sources: [5] "positions of responsibility, involvement in student societies or holiday work can also strengthen your applications, particularly if they show teamwork, leadership"; [3] "See what societies in this space are offering in terms of alumni and recruiter talks."

**PB-FIN-E04: Jane Street Bridge (London): Institutional Sales and Trading / Strategy and Product**
- What: An interactive inside look at Jane Street's Institutional Sales and Trading or Strategy and Product work. The London session is open to first- and second-year students who will graduate in 2029 (first years on 3-year degrees, second years on 4-year degrees). The programme page calls it daylong, while the London session in the data feed runs 1-3 April 2027.
- Builds signals: PB-FIN-S01. Skills: Sales and Trading, Commercial Awareness, Communication.
- Effort: weekend. Min year: 1. Evidence produced: Insight programme line on the CV.
- URL: https://www.janestreet.com/join-jane-street/programs-and-events/ (verified: true, accessed 2026-10-13)
- Timing: London session 1-3 April 2027; apply by 3 January 2027, 23:59 GMT (Jane Street programmes data, accessed 2026-10-13). **expiresOn: 2027-01-03**
- How to find: Jane Street Programs and Events page, Bridge, London.
- Sources: [15] "is open to first and second year students who will graduate in 2029. The deadline to apply is Sunday, January 3rd, 2027 at 11:59pm GMT."; [16] "Take an inside look at our Strategy and Product or Institutional Sales and Trading in this interactive, daylong program for first- and second-year university students."

**PB-FIN-E05: Goldman Sachs 2027 Summer Analyst Programme (EMEA)**
- What: A 9-10 week summer internship for penultimate- or final-year Bachelor's/Master's students. Applications are open and reviewed on a rolling basis.
- Builds signals: PB-FIN-S01, PB-FIN-S04. Skills: Financial Modelling, Teamwork, Communication.
- Effort: term. Min year: 2. Evidence produced: Summer internship; the main route to a graduate offer.
- URL: https://www.goldmansachs.com/careers/students/programs-and-internships/emea/summer-analyst-programme (verified: true, accessed 2026-10-13)
- Timing: Applications open now, reviewed on a rolling basis (firm page, accessed 2026-10-13). No closing date published.
- How to find: Goldman Sachs Students page, 2027 Summer Internships.
- Sources: [17] "The Summer Analyst role is for candidates currently pursuing a Bachelors or Masters university degree and in their penultimate or final year of study."; [17] "We review applications on a rolling basis and encourage you to apply as soon as you are ready."

### Year guidance

- **year1**: Apply to spring weeks/insight programmes (JPMorganChase Spring Insights targets students starting full-time work in two years; Jane Street Bridge London, for students graduating in 2029, closes 3 Jan 2027), join the investment society, and start a stock pitch or weekly markets note.
- **year2_penultimate**: Apply for summer analyst internships (GS 2027 EMEA is open now, reviewed on a rolling basis). Go in with one finished model or pitch, a committee role, and practice for online tests and video interviews.
- **final**: If you have no internship offer, apply to programmes that admit final-year students (GS Summer Analyst eligibility includes final year) and to graduate roles. Lead with quantified experience of any kind.
- **postgrad**: Master's students can apply to the GS Summer Analyst Programme if they are in the penultimate or final year of study. Check each firm's eligibility page.
- **note**: For 4-year courses, shift each line by one year (spring weeks are for the second year of a four-year degree).
- **Dated (auto-expire)**:
  - [year1] Jane Street Bridge London (1-3 April 2027) closes 3 Jan 2027, 23:59 GMT; open to students graduating in 2029. (expiresOn: 2027-01-03)


---

## Quant / Trading (`quant_trading`)

### Employer signals

| ID | Signal | Linked rules | Grade | Evidence (verbatim, accessed 2026-10-13) |
|---|---|---|---|---|
| PB-QNT-S01 | Strong quantitative reasoning matters more than finance knowledge or a particular degree. Jane Street says it won't test finance or economics, and IMC says you don't need a wealth of financial knowledge. *Note: The IMC quote comes from an APAC page.* | QNT-01, QNT-08 | A | [18] "We won't test you on knowledge of finance or economics."<br>[19] "A strong quantitative thinker (no specific degree or major is required)"<br>[20] "Possess exceptional quantitative and logical reasoning skills"<br>[21] "You don't need a wealth of financial knowledge to join IMC; we're looking for candidates with a passion for solving quantitative problems" |
| PB-QNT-S02 | Intuition for probability, expected value and market-making. This is the core interview content. *Note: The Optiver quote describes what interns are taught, not an entry requirement.* | QNT-06, QNT-07 | A | [18] "Many of the core concepts you may encounter in our interviews are covered in this pdf."<br>[22] "Having an intuitive understanding of these things is an important part of our day-to-day jobs"<br>[20] "Deep dive into trading fundamentals, from probability, market structure and strategy to the technology used to make decisions in fast-moving markets" |
| PB-QNT-S03 | Online assessments are an early screen: Optiver sends them to applicants selected for the next round (applicants confirm they can take the assessment within 7 days), and IMC says it always starts with one. Practise before applying. *Note: Grade B because the IMC corroboration is an APAC page.* | QNT-07 | B | [20] "If your application is selected to proceed to the next round, you will be required to complete online assessments."<br>[20] "By submitting your application you are confirming that you will be able to take the assessment within 7 days."<br>[21] "We always kick off with an online assessment to ensure that only suitable candidates are invited to interview." |
| PB-QNT-S04 | Interest in strategic games, puzzles and competitive activities. | QNT-02 | A | [20] "Interested in strategic games and/or competitive activities"<br>[23] "Prime among the skills necessary to stay successful, then, is creative problem solving, or puzzling." |
| PB-QNT-S05 | Programming (usually Python) is a plus for trading roles but not a requirement (Optiver, Jane Street). On Optiver's trading internship, interns implement strategies in Python and run them against historical data. | QNT-03, QNT-05 | A | [20] "Experience in programming or scripting in Python is a plus"<br>[19] "General programming experience is a plus, but knowing a particular programming language is not required."<br>[24] "Implement your strategy in Python and run it against historical market data." |
| PB-QNT-S06 | Collaboration and clear communication. Interviews are run as joint problem-solving. | QNT-10 | A | [18] "We focus on collaborative problem solving during the interview"<br>[19] "A clear and effective verbal and written communicator"<br>[21] "how well you work with everyone you meet in the interviews." |
| PB-QNT-S07 | A concise CV with honestly calibrated skill levels: rate yourself against professionals, not classmates. *Note: Convention: one firm (IMC, APAC page) states it. No second independent source fetched.* | QNT-04, QNT-09, FCQ-11 | C | [25] "For interns and graduates, if you include a level of proficiency, compare yourself to professionals and not fellow students."<br>[25] "We like clear, concise resumes." |

### Projects

**PB-QNT-P01: Backtest a simple systematic strategy, honestly**
- What: Choose one testable hypothesis (e.g. short-term mean reversion in an index ETF). Clean the data, backtest in Python with transaction costs, keep a held-out period, and report Sharpe, drawdown and what failed. Follow the same frame / validate / backtest / present loop Optiver describes.
- Builds signals: PB-QNT-S05, PB-QNT-S02. Skills: Python, Pandas, NumPy, Backtesting, Statistics, Sharpe Ratio, Git.
- Effort: 2-4 weeks. Min year: 1. Evidence produced: Public GitHub repo + README with out-of-sample results (including negative ones).
- URL: none (generic action; verified: null)
- Sources: [24] "Define a clear, testable hypothesis."; [24] "Learn what holds up out of sample, what breaks and why."

**PB-QNT-P02: Market-making simulator**
- What: Simulate a limit order book with noise traders and one informed trader. Write a market maker that quotes around a fair value, manages inventory, and shows adverse selection in its PnL. Write up what changed when you widened or skewed quotes.
- Builds signals: PB-QNT-S02, PB-QNT-S05. Skills: Market Making, Order Book, Python, Probability, PnL, Monte Carlo.
- Effort: 2-4 weeks. Min year: 2. Evidence produced: Repo + short write-up with PnL/inventory plots; strong talking point in trading interviews.
- URL: none (generic action; verified: null)
- Sources: [19] "You'll analyse market data to develop a tradable fair value and implement a trading strategy in Python."; [22] "Making Markets Adverse Selection"

**PB-QNT-P03: Puzzle and probability log**
- What: Work through Jane Street's puzzle page (a new puzzle every month or two) and the Probability & Markets guide. Write a clear solution for each problem you crack (expected value, conditional probability, betting/market questions). Do this every week across a term.
- Builds signals: PB-QNT-S04, PB-QNT-S02. Skills: Probability, Problem Solving, Mental Maths.
- Effort: term. Min year: 1. Evidence produced: Solutions notebook; mention any accepted puzzle submissions. Mainly builds interview readiness.
- URL: https://www.janestreet.com/puzzles/ (verified: true, accessed 2026-10-13, free)
- Sources: [23] "Every month or two, we'll post a new puzzle to this page."; [23] "Prime among the skills necessary to stay successful, then, is creative problem solving, or puzzling."

**PB-QNT-P04: Monte Carlo option pricer vs Black-Scholes**
- What: Price European options by Monte Carlo and compare against the closed form. Show convergence, add a variance-reduction trick, then extend to one path-dependent payoff. This is a foundation project: interns are taught options theory, so it is not an entry requirement.
- Builds signals: PB-QNT-S02. Skills: Monte Carlo, Black-Scholes, Derivatives, Python, NumPy, Stochastic Processes.
- Effort: 2-4 weeks. Min year: 2. Evidence produced: Repo + notebook with convergence plots.
- URL: none (generic action; verified: null)
- Sources: [24] "starting with an options theory course led by our education team of former traders and researchers."; [26] "The purpose of the class is to expose undergraduate and graduate students to the mathematical concepts and techniques used in the financial industry."


### Courses and certifications (free / free-to-audit)

**PB-QNT-C01: MIT OpenCourseWare 18.05 Introduction to Probability and Statistics**
- What: Free full course (readings, problem sets with solutions, exams) covering combinatorics, random variables, Bayesian inference, hypothesis testing and regression. Medium signal: it gives you the probability fluency firms test. Cite the work you did, not the course.
- Builds signals: PB-QNT-S02. Skills: Probability, Statistics, Hypothesis Testing, Bayesian, R.
- Effort: term. Min year: 1. Evidence produced: Completed problem sets; probability interview readiness.
- URL: https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: medium for interviews, low on CV
- Sources: [27] "Topics include basic combinatorics, random variables, probability distributions, Bayesian inference, hypothesis testing, confidence intervals, and linear regression."; [27] "which is free to use."

**PB-QNT-C02: Jane Street Probability & Markets guide (PDF)**
- What: Jane Street's own 13-page primer: randomness, counting, expected value, conditional probability, making markets, adverse selection. Jane Street says it covers many core concepts in its interviews.
- Builds signals: PB-QNT-S02. Skills: Probability, Market Making.
- Effort: weekend. Min year: 1. Evidence produced: Interview readiness (not a CV item).
- URL: https://www.janestreet.com/static/pdfs/trading-interview.pdf (verified: true, accessed 2026-10-13, free)
- Honest signal value: high for interview prep
- Sources: [18] "Many of the core concepts you may encounter in our interviews are covered in this pdf."; [22] "The goal of this document is to present an introduction to probability and markets in what we hope is a fairly intuitive and accessible way."

**PB-QNT-C03: MIT OpenCourseWare 18.S096 Topics in Mathematics with Applications in Finance**
- What: Free lectures pairing maths (linear algebra, probability, stochastic processes, time series) with finance applications; MIT says industry professionals give the application lectures. Suits second years who already have the probability basics.
- Builds signals: PB-QNT-S01, PB-QNT-S02. Skills: Linear Algebra, Stochastic Processes, Time Series.
- Effort: term. Min year: 2. Evidence produced: Lecture notes + problem sets; supports QR-leaning projects.
- URL: https://ocw.mit.edu/courses/18-s096-topics-in-mathematics-with-applications-in-finance-fall-2013/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: low on CV, medium for QR interviews
- Sources: [26] "Mathematics lectures are mixed with lectures illustrating the corresponding application in the financial industry."; [26] "Freely sharing knowledge with learners and educators around the world."

**PB-QNT-C04: Zetamac Arithmetic Game (speed drill)**
- What: A 2-minute timed arithmetic drill you can use in the browser without an account. No trading firm endorses it. It is only practice for timed numerical assessments.
- Builds signals: PB-QNT-S03. Skills: Mental Maths.
- Effort: weekend. Min year: 1. Evidence produced: Personal score trend (not a CV item).
- URL: https://arithmetic.zetamac.com/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: none on CV; test practice only
- Sources: [28] "The Arithmetic Game is a fast-paced speed drill where you are given two minutes to solve as many arithmetic problems as you can."


### Experiences

**PB-QNT-E01: Jane Street FTTP (London)**
- What: A multi-day programme for first-year undergraduates (aimed at students planning maths, physics, computer science or other STEM majors): classes plus a team mock-trading game. No finance knowledge needed. Travel, meals and housing are covered.
- Builds signals: PB-QNT-S01, PB-QNT-S04. Skills: Probability, Market Making, Teamwork.
- Effort: weekend. Min year: 1. Evidence produced: Insight programme line on the CV; early contact with the firm.
- URL: https://www.janestreet.com/join-jane-street/programs-and-events/fttp/ (verified: true, accessed 2026-10-13)
- Timing: London session 21-25 March 2027; apply by 3 January 2027, 23:59 GMT (Jane Street programmes data, accessed 2026-10-13). **expiresOn: 2027-01-03**
- How to find: Jane Street Programs and Events page, FTTP, London.
- Sources: [29] "a select group of first-year undergraduates will learn more about Jane Street's innovative trading and technology models"; [15] "Please confirm you are available Sunday, March 21st - Thursday, March 25th, 2027." (FTTP London availability_label); [15] "Sunday, January 3rd, 2027 at 11:59pm GMT" (FTTP London formatted_deadline)

**PB-QNT-E02: IMC Prosperity (online trading challenge)**
- What: IMC's team trading challenge for university students (up to 5 per team): algorithmic and manual trading rounds in Python on a simulated market. Prize eligibility includes EMEA residents. Prosperity 4 has finished and the site has not announced the next edition.
- Builds signals: PB-QNT-S04, PB-QNT-S05. Skills: Python, Market Making, Order Book, Backtesting, Teamwork.
- Effort: 2-4 weeks. Min year: 1. Evidence produced: Leaderboard rank / percentile and a repo of your algorithm.
- URL: https://prosperity.imc.com/ (verified: true, accessed 2026-10-13, free)
- Timing: Next edition not announced on the site as of 2026-10-13 (Prosperity 4 finished).
- Sources: [30] "Prosperity 4 is IMC's online trading challenge designed for university students."; [30] "Eligibility for prizes, and recognition is limited to participants resident in EMEA, North America, South America, India, Australia, or Hong Kong"

**PB-QNT-E03: Jane Street Quantitative Trader Internship (London)**
- What: A June-September internship with mentors, classes and mock trading. Jane Street says there is no GPA or degree requirement and it hires students of all tenures. Applications are reviewed on a rolling basis.
- Builds signals: PB-QNT-S01, PB-QNT-S06. Skills: Probability, Statistics, Python, Machine Learning.
- Effort: term. Min year: 1. Evidence produced: Internship; the main route to a return offer.
- URL: https://www.janestreet.com/join-jane-street/position/8474407002/ (verified: true, accessed 2026-10-13)
- Timing: Rolling; no deadline (firm FAQ, accessed 2026-10-13).
- Sources: [18] "We don't have a GPA or degree requirement, and we hire students of all tenures from many different universities and concentrations."; [18] "We don't typically have one; our applications are reviewed on a rolling basis."

**PB-QNT-E04: Optiver Quantitative Trading Internship (Amsterdam, 2027 start)**
- What: A ten-week internship for penultimate-year STEM students graduating in 2028. If selected for the next round you take online assessments, and applicants confirm they can take the assessment within 7 days. Return offers can be for Amsterdam or London. It is Amsterdam-based, so check work eligibility.
- Builds signals: PB-QNT-S01, PB-QNT-S03, PB-QNT-S04. Skills: Probability, Python, Market Making, Derivatives.
- Effort: term. Min year: 2. Evidence produced: Internship; return offer route.
- URL: https://www.optiver.com/join-us/jobs/trading/amsterdam/quantitative-trading-internship-2027-start/ (verified: true, accessed 2026-10-13)
- Sources: [20] "Penultimate-year student in a STEM field, with the ability to work full-time upon graduation in 2028"; [20] "you could receive an offer to join our firm full-time in Amsterdam or London after your studies."

**PB-QNT-E05: University trading / quant / maths society**
- What: Join a society that runs mock-trading, estimation or puzzle sessions and team competitions, and aim for a role running one. This is generic advice, not a named programme.
- Builds signals: PB-QNT-S04, PB-QNT-S06. Skills: Mental Maths, Probability, Teamwork, Leadership.
- Effort: term. Min year: 1. Evidence produced: Society role + competition placings.
- URL: none (generic action; verified: null)
- How to find: Students' union society directory.
- Sources: [20] "Interested in strategic games and/or competitive activities"; [21] "Candidates who stand out are not only passionate about the industry and the role, but also have keen interests outside of their work and studies."

### Year guidance

- **year1**: Work through the Jane Street Probability & Markets guide and MIT 18.05. Apply to Jane Street FTTP London (first-year undergraduates, STEM focus) by 3 Jan 2027. Start one small Python backtest, and enter IMC Prosperity when the next edition opens.
- **year2_penultimate**: Apply for penultimate-year trading internships (e.g. the Optiver posting asks for penultimate-year STEM). Practise online assessments before applying, and bring one finished project (market-making sim or honest backtest).
- **final**: Apply to graduate trading and research roles. Jane Street reviews applications on a rolling basis and hires students of all tenures. Put competition results and projects ahead of finance jargon.
- **postgrad**: Master's/PhD students: Jane Street states no degree requirement. Research-leaning roles reward projects with rigorous evaluation (QNT-05).
- **note**: For 4-year courses, shift each line by one year.
- **Dated (auto-expire)**:
  - [year1] Jane Street FTTP London (21-25 March 2027) closes 3 Jan 2027, 23:59 GMT. (expiresOn: 2027-01-03)


---

## Consulting (`consulting`)

### Employer signals

| ID | Signal | Linked rules | Grade | Evidence (verbatim, accessed 2026-10-13) |
|---|---|---|---|---|
| PB-CON-S01 | Strong academics: BCG London asks for at least a 2:1 or equivalent (predicted, for interns), Prospects says a 2:1 is usually needed, and Bain London asks for strong academics. | CON-01, FCQ-04 | A | [31] "We look for candidates with a strong academic background (at least a 2:1 degree or equivalent)"<br>[32] "You'll usually need a 2:1 degree or equivalent, particularly for graduate training schemes."<br>[33] "Successful candidates bring strong academics, analytical & numerical and communication skills." |
| PB-CON-S02 | Case interviews decide offers: structuring, numeracy, judgement and synthesis under discussion. | CON-03 | A | [31] "The interview stage includes case-based discussions with senior members of our London consulting team"<br>[33] "Interviews during both rounds consist of case interviews, so please consider beginning to practice early"<br>[34] "You are usually assessed on 5 core elements of a case: structuring, numeracy, judgements and insights, creativity, synthesis and case leadership." |
| PB-CON-S03 | At BCG London and Bain London, an online numerical/logical assessment follows the application and comes before any interview. | — | A | [31] "we'll invite you to complete a short numerical assessment, which forms part of your application."<br>[33] "The assessment evaluates skills that are core to success in the Associate Consultant role, including numerical aptitude, logical reasoning, and behavioural preferences." |
| PB-CON-S04 | Leadership, initiative and impact: what changed because of you, outside academics too. | CON-02, CON-04, CON-05 | A | [33] "Plus, a record of initiative, leadership, and teamwork."<br>[35] "The firm is looking for evidence of impact, leadership, entrepreneurship, problem solving and an overall orientation towards achievement."<br>[31] "evidence of excellence in areas outside of academics - whether that's through extracurricular activities, leadership roles, or other achievements." |
| PB-CON-S05 | Bain London takes any discipline and Prospects says consultancy is open to any degree (some firms prefer numerical ones), but you must show you are comfortable analysing quantitative and qualitative data. | CON-08 | A | [33] "We welcome Bachelor's, Master's (non-MBA), and PhD students from any discipline or university."<br>[36] "they will want to know that you are comfortable analysing quantitative and qualitative data."<br>[32] "Management consultancy is open to graduates from any degree discipline, but a numerical or analytical degree is preferred by some firms." |
| PB-CON-S06 | The penultimate-year internship is a direct route to graduate offers: BCG London evaluates interns for a full-time offer at the end, and Bain London runs an Associate Consultant Intern programme for penultimate-year students. | — | A | [31] "you will be evaluated for an offer for a full-time graduate role at the end of the programme."<br>[33] "Bain London now offers the Associate Consultant Intern (ACI) programme for students in their penultimate year of study." |
| PB-CON-S07 | Commercial awareness and firm knowledge, built partly by attending firm events (Cambridge Careers notes that firms will likely keep a record of who attended). | CON-12 | A | [37] "Commercial awareness is an understanding of how economic factors affect businesses and the sectors they work with."<br>[34] "they will have a record you attended too and likely use this to contact you about future opportunities."<br>[31] "BCG hosts a wide range of events in September and October, both virtual and in person, on campus and in our offices." |
| PB-CON-S08 | Society leadership and extracurricular projects are common evidence of these skills. *Note: The 27% figure is from a TARGETjobs survey article dated 21 Jun 2023, quoted verbatim. It describes applicants, not what firms require.* | CON-07, CON-02 | B | [36] "The survey indicates that 27% of final-year students interested in consulting employers have held a leadership position in a student society"<br>[32] "extra-curricular activities such as club membership, team sports or work for a student society or community project." |

### Projects

**PB-CON-P01: Pro-bono consulting project for a charity, social enterprise or society**
- What: Scope one real problem with a client (e.g. falling volunteer sign-ups). Gather data (survey, interviews), structure the issue, recommend 2-3 actions, then follow up on what was adopted and what changed.
- Builds signals: PB-CON-S04, PB-CON-S05, PB-CON-S08. Skills: Problem Solving, Market Research, Stakeholder Management, PowerPoint, Excel, Communication.
- Effort: term. Min year: 1. Evidence produced: Client deck + what the client adopted and any measured change (report it as it is, including no change); CV bullet in problem → analysis → recommendation → result form (CON-03).
- URL: none (generic action; verified: null)
- Sources: [38] "Our university branches offer opportunities for students to work with non-profits and social enterprises, making a tangible impact in their communities."; [35] "McKinsey is interested in 'why your work mattered' and the changes you brought about."

**PB-CON-P02: Case practice log**
- What: Run 15-20 live cases with a partner, starting with Bain's free practice cases. After each one, log your structure, maths errors and synthesis. Track improvement on the five dimensions Cambridge lists.
- Builds signals: PB-CON-S02. Skills: Case Interviews, Problem Solving, Mental Maths, Communication.
- Effort: 2-4 weeks. Min year: 1. Evidence produced: Case log (interview readiness; not a CV line).
- URL: none (generic action; verified: null)
- Sources: [39] "We're not looking for a single right answer; we're looking for how you think, structure problems, and build on ideas as the conversation evolves."; [34] "You are usually assessed on 5 core elements of a case: structuring, numeracy, judgements and insights, creativity, synthesis and case leadership."

**PB-CON-P03: Industry deep-dive with market sizing**
- What: Write a 6-8 slide deck on one UK sector: a market-size estimate (top-down and bottom-up), key players, one trend and what it means for a client. Then present it to a society or a peer group.
- Builds signals: PB-CON-S07, PB-CON-S05. Skills: Market Research, Commercial Awareness, PowerPoint, Excel, Communication.
- Effort: weekend. Min year: 1. Evidence produced: Slide deck; source for 'what's a challenge facing our clients' interview answers.
- URL: none (generic action; verified: null)
- Sources: [37] "Commercial awareness is an understanding of how economic factors affect businesses and the sectors they work with."; [32] "conduct research and data collection to understand the client's operations and to discover potential problems"

**PB-CON-P04: Lead a measurable improvement where you already are**
- What: In a society, team or part-time job, take ownership of one metric (attendance, revenue, sign-ups). Diagnose it with data, run a fix, and report the before and after honestly, even if the metric did not move. Bain asks for a record of initiative, leadership and teamwork; TARGETjobs says McKinsey looks for evidence of impact.
- Builds signals: PB-CON-S04, PB-CON-S08. Skills: Leadership, Problem Solving, Excel, Stakeholder Management.
- Effort: term. Min year: 1. Evidence produced: CV bullet with your real before/after numbers (e.g. 'Raised attendance from [x]% to [y]% by…'); a strong story for fit interviews.
- URL: none (generic action; verified: null)
- Sources: [33] "Plus, a record of initiative, leadership, and teamwork."; [35] "The firm is looking for evidence of impact, leadership, entrepreneurship, problem solving and an overall orientation towards achievement."


### Courses and certifications (free / free-to-audit)

**PB-CON-C01: Bain case interview preparation hub**
- What: Free Bain-designed material: what a case interview is, practice cases (Coffee Shop Co., FashionCo.) and interview tips. High prep value; not a CV item.
- Builds signals: PB-CON-S02. Skills: Case Interviews, Problem Solving.
- Effort: weekend. Min year: 1. Evidence produced: Interview readiness.
- URL: https://www.bain.com/careers/hiring-process/case-interview/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: high for interview prep; none on CV
- Sources: [39] "This is your one-stop resource for case interview preparation."; [39] "You'll find Bain-designed materials, sample cases, practical tips, and trusted external resources"

**PB-CON-C02: Bain digital assessment hub**
- What: Bain's FAQ on its online assessments (Sova or Test Gorilla, about 30-40 minutes). Use it to prepare for the numerical/logical screen before you apply.
- Builds signals: PB-CON-S03. Skills: Mental Maths, Problem Solving.
- Effort: weekend. Min year: 1. Evidence produced: Test readiness.
- URL: https://www.bain.com/careers/hiring-process/digital-assessment/ (verified: true, accessed 2026-10-13, free)
- Honest signal value: test prep only
- Sources: [40] "you will receive an email after submitting the application detailing whether you are required to complete Sova or Test Gorilla."; [40] "The assessment takes approximately 30-40 minutes."


### Experiences

**PB-CON-E01: 180 Degrees Consulting (university branch)**
- What: A student consultancy for non-profits and social enterprises, with UK branches including UCL, LSE, Imperial and King's College London. Join as a consultant, then aim to become a project lead.
- Builds signals: PB-CON-S04, PB-CON-S08. Skills: Problem Solving, Stakeholder Management, Market Research, Leadership, Teamwork.
- Effort: term. Min year: 1. Evidence produced: Client project with deliverable + outcome; later a project-lead title.
- URL: https://www.180dc.org/find-a-branch (verified: true, accessed 2026-10-13)
- How to find: 180DC 'Find a branch' map; branch recruitment is run by each university branch.
- Sources: [38] "The world's largest university-based consultancy for non-profits and socially-conscious organisations"; [41] "University College London"

**PB-CON-E02: Forage: BCG Strategy Consulting job simulation**
- What: A free, self-paced simulation (4-5 hours) of a client strategy problem, with BCG sample answers. BCG asks participants not to list it as work or internship experience.
- Builds signals: PB-CON-S02, PB-CON-S05. Skills: Problem Solving, Market Research, Data Visualisation.
- Effort: weekend. Min year: 1. Evidence produced: Certificate; list under courses/extracurriculars only.
- URL: https://www.theforage.com/simulations/bcg/strategy-consulting-jk76 (verified: true, accessed 2026-10-13, free)
- Honest signal value: low; follow BCG's listing rule
- Sources: [42] "Complete work that simulates life on the job. 4-5 hours and self-paced."; [42] "It is our policy that you do not list your completion of this program as work or internship experience on your CV"

**PB-CON-E03: BCG London summer internship (penultimate year)**
- What: An eight-week July-August internship, fully integrated into a case team. Interns are evaluated for a full-time offer at the end. Applications go through an online form and CV, then a numerical assessment, CV review and case interviews.
- Builds signals: PB-CON-S06, PB-CON-S03, PB-CON-S02. Skills: Case Interviews, Problem Solving, Communication.
- Effort: term. Min year: 2. Evidence produced: Internship; the main route to a graduate offer.
- URL: https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs (verified: true, accessed 2026-10-13)
- Timing: Applications 1-24 January 2027 (BCG UK page, accessed 2026-10-13).
- Sources: [31] "BCG London offers a summer internship programme for penultimate year students."; [31] "Applications will open on 1 January 2027 and close on 24 January 2027."

**PB-CON-E04: Bain London Associate Consultant Intern (ACI)**
- What: Bain London's internship for penultimate-year students. Interviews are case-based.
- Builds signals: PB-CON-S06, PB-CON-S02. Skills: Case Interviews, Problem Solving.
- Effort: term. Min year: 2. Evidence produced: Internship; route to an Associate Consultant offer.
- URL: https://www.bain.com/careers/recruiting/london-recruiting/ (verified: true, accessed 2026-10-13)
- Timing: Expected to open November 2026 (Bain London page, accessed 2026-10-13).
- Sources: [33] "Bain London now offers the Associate Consultant Intern (ACI) programme for students in their penultimate year of study."; [33] "Applications for the 2027 ACI programme are expected to open in November 2026."

**PB-CON-E05: University consulting society and case competitions**
- What: Join a consulting society, practise cases in its groups, and enter case competitions as a team. Aim for a committee role. This is generic advice, not a named programme.
- Builds signals: PB-CON-S08, PB-CON-S02. Skills: Case Interviews, Leadership, Teamwork, Communication.
- Effort: term. Min year: 1. Evidence produced: Committee title; competition placing with the deliverable described.
- URL: none (generic action; verified: null)
- How to find: Students' union society directory.
- Sources: [36] "consider getting actively involved in the running of a student society if you can."; [32] "extra-curricular activities such as club membership, team sports or work for a student society or community project."

### Year guidance

- **year1**: Join 180DC or a consulting society, take on one leadership task with a measurable result, attend firm events (BCG London lists its events on its UK careers page), and start casual case practice with Bain's free cases.
- **year2_penultimate**: Apply for internships: Bain London ACI is expected to open Nov 2026; BCG London runs 1-24 Jan 2027. Prepare the numerical online test first, then do structured case practice (15-20 cases).
- **final**: Apply for Associate/Associate Consultant roles; check each firm's page from early autumn for its window. Lead the CV with quantified leadership and problem-solving.
- **postgrad**: Bain London accepts Master's (non-MBA) and PhD students from any discipline. BCG routes PhD and medical-degree holders to Senior Associate.
- **note**: For 4-year courses, shift each line by one year.
- **Dated (auto-expire)**:
  - [final] Bain London Associate Consultant applications close 15 Oct 2026, 23:59 BST (online assessment due by midday 20 Oct 2026, BST). Open to final-year students or those with under two years' industry experience since graduating. (expiresOn: 2026-10-15)
  - [final] BCG London Associate applications are open 9 Sep-18 Oct 2026. (expiresOn: 2026-10-18)
  - [year2_penultimate] Bain London ACI 2027 applications are expected to open in November 2026 (no date given). (reviewBy: 2026-11-30)
  - [year2_penultimate] BCG London summer internship applications open 1 Jan 2027 and close 24 Jan 2027. (expiresOn: 2027-01-24)


---

## Supporting quotes for dated claims in year guidance

- [31] "Applications will open on 9 September 2026 and close on 18 October 2026"
- [33] "Applications for the Associate Consultant role in the London office are now open and will close on October 15th 23:59 BST"
- [31] "If you have a PhD or Medical Degree, the process is the same however you will be considered for a Senior Associate position."
- [33] "Please ensure that all sections of the online assessment are completed by midday, 20th October (BST)."
- [33] "If you are currently in your final year of study or if you have less than two years of experience in industry since graduation, you would be considered for the Associate Consultant role."
- [31] "Applications will open on 1 January 2027 and close on 24 January 2027."

---

## Gaps and items deliberately left out

Each item below was dropped under the "fewer items over any doubtful one" rule:

- **Bloomberg Market Concepts (BMC)**: the Bloomberg certificate page fetched fine, but it does not say the course is free. Universities say it is free only on a campus Terminal, and that is not on Bloomberg's page. Dropped.
- **McKinsey.org Forward**: free, but UK availability was not confirmed (the UK location page returns 404). Eligibility also needs prior or imminent work experience. Dropped.
- **Coursera "Financial Markets" (Yale/Shiller)**: the page does not confirm a free audit option for this course. Dropped.
- **CFI Excel / 3-statement / valuation courses**: these show only "Free Preview" lessons, not full free access. Only "Careers in Finance" is free. Dropped.
- **CFA Institute Research Challenge**: the page is live, but UK participation could not be confirmed from a fetched page. Dropped.
- **IMC International Mathematics Competition for University Students**: live, but its cost could not be confirmed. Dropped.
- **Goldman Sachs EMEA spring programme**: the programme page could not be found (the guessed URL returns 404, and the programmes list is rendered by script). Dropped. GS Summer Analyst is included instead.
- **McKinsey careers pages** (mckinsey.com) timed out or refused connections, so McKinsey criteria appear only via TARGETjobs [quoted]. BCG London Insight Programme and McKinsey insight programmes appear on the-trackr only, not on firm pages we could fetch, so they are not named.
- **Jane Street SEE (London)** is open only to students at universities in Austria, Belgium, Denmark, Germany, the Netherlands, Norway, Sweden or Switzerland, so it is excluded for UK students.
- **Oxford Careers quant page and Citadel Securities QR process page** returned 403, so their claims in the CV-rules doc (mental-maths tests, reproducing papers) are not re-used here.
- **IMC pages are APAC-region.** They are used only as corroboration, and the affected grades are lowered (PB-QNT-S03 B, PB-QNT-S07 C).
- **Spring-week timings.** Apart from Jane Street (data feed), BCG and Bain, no firm 2026/27 cycle page gave dates. JPMorganChase Spring Insights has no dates on its page. the-trackr's dates are labelled by Trackr itself as estimates from last cycle.
- **Consulting courses.** Only two free courses are firm-verified (Bain hubs). BCG London's free virtual sessions were dropped in verification because the last listed one runs on 15 Oct 2026. No free, verifiable consulting certificate with a CV signal was found.


---

## Sources

All accessed 2026-10-13. "Primary" means a firm careers page, ISE, Prospects or TARGETjobs.

| # | Title | Publisher | URL | Primary |
|---|---|---|---|---|
| 1 | Spring Insights | JPMorganChase | https://www.jpmorganchase.com/careers/explore-opportunities/programs/spring-insights | yes |
| 2 | What is a spring week, insight day or insight programme? (Abigail Lewis, 2 May 2025) | TARGETjobs | https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme | yes |
| 3 | Banking & Financial Markets: Short Guide to Recruitment 2025-2026 (PDF) | University of Cambridge Careers Service | https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf | no |
| 4 | Spring Week Timeline 2027: When UK Finance Firms Open Applications (9 Sep 2026) | Trackr (the-trackr.com) | https://the-trackr.com/blog/spring-week-timeline-2027-when-uk-finance-firms-open-applications/ | no |
| 5 | Job profile: Corporate investment banker | Prospects | https://www.prospects.ac.uk/job-profiles/corporate-investment-banker | yes |
| 6 | Hints and tips | Barclays | https://search.jobs.barclays/hints-and-tips | yes |
| 7 | Early careers recruitment in 2025: integrity, inclusion, entry standards (ISE Student Recruitment Survey 2025) | Prospects Luminate / Institute of Student Employers | https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards | yes |
| 8 | What is commercial awareness? | TARGETjobs | https://targetjobs.co.uk/careers-advice/skills-for-getting-a-job/what-commercial-awareness | yes |
| 9 | Students | Goldman Sachs | https://www.goldmansachs.com/careers/students | yes |
| 10 | Resume Advice: recruiter video transcript (PDF) | Goldman Sachs | https://www.goldmansachs.com/careers/materials/Resume-Advice-Transcript.pdf | yes |
| 11 | How we hire | JPMorganChase | https://www.jpmorganchase.com/careers/how-we-hire | yes |
| 12 | Investment Banking job simulation | Forage / JPMorganChase | https://www.theforage.com/simulations/jpmorgan/investment-banking-hkyd | yes |
| 13 | 15.401 Finance Theory I (Fall 2008) | MIT OpenCourseWare | https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/ | yes |
| 14 | Careers in Finance (free course) | Corporate Finance Institute | https://corporatefinanceinstitute.com/course/careers-in-finance/ | yes |
| 15 | Programs data feed behind the Programs and Events page (London sessions) | Jane Street | https://www.janestreet.com/jobs/programs-endpoint.json | yes |
| 16 | Programs and Events | Jane Street | https://www.janestreet.com/join-jane-street/programs-and-events/ | yes |
| 17 | 2027 Summer Analyst Programme (EMEA) | Goldman Sachs | https://www.goldmansachs.com/careers/students/programs-and-internships/emea/summer-analyst-programme | yes |
| 18 | Interviewing | Jane Street | https://www.janestreet.com/join-jane-street/interviewing/ | yes |
| 19 | Quantitative Trader Internship, London (June-September) | Jane Street | https://www.janestreet.com/join-jane-street/position/8474407002/ | yes |
| 20 | Quantitative Trading Internship (2027 Start), Amsterdam | Optiver | https://www.optiver.com/join-us/jobs/trading/amsterdam/quantitative-trading-internship-2027-start/ | yes |
| 21 | How to prepare for an interview at IMC (APAC campus recruiter interview) | IMC Trading | https://www.imc.com/ap/articles/how-to-prepare-for-an-interview-at-imc | yes |
| 22 | Probability & Markets guide (PDF) | Jane Street | https://www.janestreet.com/static/pdfs/trading-interview.pdf | yes |
| 23 | Puzzles | Jane Street | https://www.janestreet.com/puzzles/ | yes |
| 24 | Trading Internship Program | Optiver | https://www.optiver.com/join-us/students/internships/trading/ | yes |
| 25 | Recruitment process (APAC careers page) | IMC Trading | https://www.imc.com/ap/careers/recruitment-process | yes |
| 26 | 18.S096 Topics in Mathematics with Applications in Finance (Fall 2013) | MIT OpenCourseWare | https://ocw.mit.edu/courses/18-s096-topics-in-mathematics-with-applications-in-finance-fall-2013/ | yes |
| 27 | 18.05 Introduction to Probability and Statistics (Spring 2022) | MIT OpenCourseWare | https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/ | yes |
| 28 | Arithmetic Game (online speed drill) | Zetamac | https://arithmetic.zetamac.com/ | no |
| 29 | FTTP programme page | Jane Street | https://www.janestreet.com/join-jane-street/programs-and-events/fttp/ | yes |
| 30 | IMC Prosperity 4 | IMC Trading | https://prosperity.imc.com/ | yes |
| 31 | Associate Jobs: United Kingdom (early careers FAQ, internships, campus events) | BCG | https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs | yes |
| 32 | Job profile: Management consultant | Prospects | https://www.prospects.ac.uk/job-profiles/management-consultant | yes |
| 33 | Bain London University Hiring | Bain & Company | https://www.bain.com/careers/recruiting/london-recruiting/ | yes |
| 34 | Management & Strategy Consulting: Quick Guide to Recruitment 2024 (PDF) | University of Cambridge Careers Service | https://www.careers.cam.ac.uk/files/management_strategy_consulting_-_quick_guide_to_recruitment_2024.pdf | no |
| 35 | Applying to McKinsey & Company: CVs, cover letters and interviews | TARGETjobs | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/applying-mckinsey-company-cvs-cover-letters-and-interviews | yes |
| 36 | How hard is it to get into consulting? (Abigail Lewis, 21 Jun 2023) | TARGETjobs | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-hard-is-it-to-get-into-consulting | yes |
| 37 | 12 skills that consulting recruiters want in graduates (Olivia Rowland, 21 May 2025) | TARGETjobs | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/top-consulting-skills | yes |
| 38 | 180 Degrees Consulting home page | 180 Degrees Consulting | https://www.180dc.org/ | yes |
| 39 | Case interview preparation | Bain & Company | https://www.bain.com/careers/hiring-process/case-interview/ | yes |
| 40 | Digital assessment hub | Bain & Company | https://www.bain.com/careers/hiring-process/digital-assessment/ | yes |
| 41 | Find a branch (UK branches listed incl. UCL, LSE, Imperial, King's College London) | 180 Degrees Consulting | https://www.180dc.org/find-a-branch | yes |
| 42 | Strategy Consulting Job Simulation | Forage / BCG | https://www.theforage.com/simulations/bcg/strategy-consulting-jk76 | yes |

---

## Verification log (2026-10-13)

Adversarial pass over all 59 signals/actions plus year guidance. Every cited URL was re-fetched (curl; Bain pages via a reader proxy and WebFetch because bain.com returns 403 to curl) and every quote was string-matched against the page text after normalising curly quotes and dashes. All 46 skill names are canonical entries in `lib/skills/vocab.ts`, and all 30 rule IDs exist in `cv-rules-finance-consulting.md`.

Result: 38 PASS, 20 REWORD, 1 FAIL.

**FAIL (deleted)**
- PB-CON-C03 (BCG London virtual sessions): every CV-building session listed had already passed, and the last two sessions (case prep 14 Oct, tips 15 Oct 2026) end before the app ships. Advertising it would point students at closed events. Deleted from both files; no other item referenced it.

**REWORD**
- PB-FIN-S02: "banks say" generalised one bank (Barclays). The ISE 71%→47% figure (all graduate employers, 2015/16 to 2024/25) cuts against "2:1 is the usual bar" if left unqualified. Text now attributes each claim and gives the ISE years.
- PB-FIN-S03: ruleIds trimmed to FIN-04. FIN-13 (asset-management flavour) and FIN-14 (S&T flavour) are not commercial-awareness rules.
- PB-FIN-P01: the example CV line had invented specifics ("60-member", "2nd of 12 teams"), which could encourage copying made-up numbers. Replaced with placeholders and "only from what actually happened".
- PB-FIN-E04 (Jane Street Bridge London): "first and second years" overreached. The feed restricts it to students who "will graduate in 2029", so a second year on a 3-year degree is not eligible. Eligibility added; expiresOn 2027-01-03.
- PB-QNT-S01: "Firms say they won't test finance" generalised Jane Street's statement. Now attributed to Jane Street, with IMC's weaker wording quoted separately.
- PB-QNT-S03: "Timed" and "straight after you apply" were not supported. Optiver sends assessments only to applicants selected for the next round, and neither page says "timed". Reworded.
- PB-QNT-S05: "central to the research-style project work interns do" generalised one Optiver page. Now scoped to Optiver.
- PB-QNT-P03: "monthly puzzle" changed to match the page: "Every month or two".
- PB-QNT-C03 (MIT 18.S096): "optimisation" is not a lecture topic on the course calendar; replaced with time series (Time Series Analysis I-III), and the Optimisation skill tag was removed. "Taught by practitioners" changed to MIT's own wording: industry professionals give the application lectures.
- PB-QNT-E01 (Jane Street FTTP): the second quote was a composite of several JSON fields, not verbatim. Replaced with two verbatim field values (availability_label, formatted_deadline). Added the STEM focus stated on the page; expiresOn 2027-01-03.
- PB-QNT-E04 (Optiver): "Online assessments follow within 7 days of being selected" misstated the page, which says applicants confirm they can take the assessment within 7 days. Corrected, and graduation year 2028 added. reviewBy 2026-12-31 (no closing date published).
- PB-QNT yearGuidance year1/year2: FTTP eligibility added; "timed" removed.
- PB-CON-S01: "the stated bar at strategy firms" generalised. Bain says only "strong academics", so the claim is now attributed per firm (BCG: at least a 2:1, predicted for interns).
- PB-CON-S03: scoped to BCG London and Bain London (both firm pages).
- PB-CON-S05: "Firms take any degree" now attributed to Bain and Prospects, including Prospects' caveat that some firms prefer numerical degrees.
- PB-CON-S06: "main pipeline" softened to "a direct route" (the sources show the route, not its share). ruleIds CON-07 removed, because that rule covers case competitions and societies, not internships.
- PB-CON-S07: "(firms keep records)" was stated as fact from a single non-primary 2024 guide. Now attributed to Cambridge Careers, using its own hedge ("likely").
- PB-CON-S08: note now dates the TARGETjobs 27% survey article (21 Jun 2023). The claim drawn from it (that it describes applicants, not requirements) is fair.
- PB-CON-P01: "measurable outcome" promised a result. Now "what the client adopted and any measured change (report it as it is, including no change)".
- PB-CON-P04: "the bullet MBB screens look for" overgeneralised from Bain plus one TARGETjobs McKinsey article, and the example used invented figures. Now attributed, with placeholders and "honestly, even if the metric did not move".
- PB-CON-E02: the quote contained markdown `**not**`; the page text reads "do not list". Fixed.
- PB-CON yearGuidance year1/final: removed the stale "BCG London runs them Sept-Oct" and the "act now" dates for Bain (closes 15 Oct 2026) and BCG (closes 18 Oct 2026) from the evergreen text, and moved them to dated lines with expiresOn.

**Statistics check**
- ISE: "the share demanding a 2:1 degree has fallen from 71% to 47% over the same period" is verbatim. "The same period" is 2015/2016 to 2024/2025, and the base is all ISE member employers. Fair only when labelled as all employers; now labelled.
- TARGETjobs: "27% of final-year students interested in consulting employers have held a leadership position in a student society" is verbatim (article dated 21 Jun 2023). Fair as a description of applicants; it is not used as a requirement.

**Date-sensitive items (the app must auto-hide them)**
| Item | Field | Date |
|---|---|---|
| Consulting final: Bain London Associate Consultant applications close 23:59 BST | expiresOn | 2026-10-15 |
| Consulting final: BCG London Associate window 9 Sep-18 Oct 2026 | expiresOn | 2026-10-18 |
| PB-CON-E04 Bain London ACI "expected to open in November 2026" | reviewBy | 2026-11-30 |
| PB-FIN-E04 Jane Street Bridge London (apply by 23:59 GMT) | expiresOn | 2027-01-03 |
| PB-QNT-E01 Jane Street FTTP London (apply by 23:59 GMT) | expiresOn | 2027-01-03 |
| PB-CON-E03 BCG London summer internship (window 1-24 Jan 2027) | expiresOn | 2027-01-24 |
| PB-FIN-E05 GS 2027 Summer Analyst (rolling, no closing date) | reviewBy | 2026-12-31 |
| PB-QNT-E04 Optiver 2027 internship (no closing date) | reviewBy | 2026-12-31 |
| PB-QNT-E02 IMC Prosperity (next edition not announced) | reviewBy | 2026-12-31 |

Residual caveats (PASS, but worth knowing): the Cambridge consulting guide is the 2024 edition; IMC pages are APAC (grades already lowered); the Bain FAQ text (ACI, assessment deadline, eligibility) sits in collapsed accordions and was confirmed with WebFetch rather than a raw-text match.


## Changes from the 2026-10-18 audit (fix/playbook-content)

All new quotes were re-fetched at the primary source on 2026-10-18; the JSON carries each URL, access date and verbatim quote. Findings refer to `docs/research/audit-2026-10-18/06-role-playbooks-finance-consulting.md`.

- **`kind` and `signalValue` on every action (06#3, 06#4).** Selective programmes (GS Summer Analyst, Jane Street QT internship, BCG/Bain internships, spring weeks) are `opportunity` items: listed under "Programmes to apply to", never as a way to build a skill. Forage simulations are flagged `simulation` and never become tailoring evidence (BCG's listing rule, 06#9).
- **Graduation-year eligibility (06#1, 06#6):** JPMorganChase Spring Insights, Jane Street Bridge, BlackRock Spring Insight and PwC Advancing Social Mobility carry `eligibleGradYears: [2029]`; their dated lines carry `gradYears`. Year guidance keys "2nd" and "penultimate" separately; the four-year note shows only while a student's stage is ambiguous.
- **Access programmes (06#11):** a `shared` block (PB-ALL-E01…E08) copied into the relevant archetypes at build: SEO London, upReach, 10,000 Black Interns (closes 1 Nov 2026), GAIN, PwC Advancing Social Mobility (closes 31 Oct 2026), Elevate@BCG, Rare Recruitment, Jane Street INSIGHT London (closes 3 Jan 2027). Each quotes its eligibility; the copy says "Check eligibility yourself" and Placed stores no demographic data. Sutton Trust Pathways is excluded (school pupils).
- **New signals:** PB-FIN-S09 (asset managers look for curiosity about markets; Schroders, BlackRock; B), PB-FIN-S10 (rolling review at banks vs BCG deciding after the deadline; GS, BCG, Cambridge; A), PB-QNT-S08 (quant research/dev test coding and statistics; Cambridge; C), PB-CON-S09 (Big 4: forms and tests, one application per intake year at PwC, AI banned at Deloitte; B — PwC quote from an archived copy of its own FAQ because the live site returns 403).
- **Assessment integrity (06#26):** PB-FIN-S04, PB-QNT-S03 and PB-CON-S03 now say tests and live interviews are unaided (Bain London FAQ, Deloitte UK integrity guidance, ISE 2026).
- **New actions:** PB-FIN-C03 Bloomberg Market Concepts only with free terminal access (Manchester Library: free on a terminal, otherwise $149; UCL Library: no terminals) (06#20), PB-CON-P05 practise the firm's assessment type (test prep), PB-CON-E06 Big 4 spring/insight programmes, PB-QNT-P05 C++ rewrite and benchmark, PB-QNT-P06 honest ML forecasting experiment.
- **Text and grade fixes:** FIN-S01 drops "main pipeline" (06#21); FIN-S06 swaps the JPMC quote for Barclays (06#22); CON-S07 A → B with the record-keeping clause moved to the note (06#23); QNT-S04 quotes Cambridge instead of the puzzles page (06#24); QNT-S05 scoped to trader roles (06#25); FIN-S08 note on Level I of the CFA Program (06#27c); FIN-S02/CON-S01 add ISE's plateau caveat and a route for students below a 2:1 (06#29); FIN-C01 reviewBy 2027-06-30 (only OCW edition, checked) (06#31); GS Summer Analyst and BlackRock copy no longer freeze "open now"/"this year" (06#17); PB-QNT-E03 drops "Machine Learning" as a skill.
- **Year guidance:** first-year spring-week cycle (June–April; banks Oct–Nov, trading and consulting Jan–Feb) (06#18), penultimate rolling-review copy (06#17), placement-year route, final-year off-cycle and boutique routes (Cambridge: Lent is key for off-cycle; boutiques hire less formally) (06#15), an actuarial/insurance pointer (06#14), and Big 4 notes in consulting (06#13).
- **Build checks (06#30):** linked experiences need `expiresOn`, `reviewBy` or `evergreen`; descriptions and guidance may not contain frozen relative time words; tests fail when a reviewBy is more than 30 days overdue.
- **Handoffs (not owned here):** `docs/research/cv-rules-finance-consulting.md:243` spring-week timing (06#19) and FIN-07 treating BMC as bonus only (06#20); `docs/research/market-2026/01-early-careers-market.md:151` "cover letter for MBB" should say it varies by office (Bain London: none) (06#27b).
