# Tailoring playbooks: Tech, Data, Product, Marketing/Growth, Research (UK students)

Compiled 2026-10-14. Companion to `tailor-playbooks-tech-product.json`, which holds the prompt-ready version.
What it is for: the "tailor my CV to this role" rewrite. It describes **how a recruiter for each role type reads a CV**, so the rewrite reorders, emphasises and re-words the student's **existing** content differently for each archetype.
Builds on: `cv-rules-tech-product.md` (S-ids), `role-playbooks-tech-product.json` (R-ids), `cv-rules-general.md` (G-19, G-20), `career-ops-extraction.md` §3 and `market-2026/05-tailoring-science.md` (F7–F10).

**Grades** (same scale as the existing docs): **A** = employer guidance plus a top-tier UK careers source, or several sources agree. **B** = one top-tier UK careers publisher, Russell Group careers service or professional body. **C** = a single practitioner, employer blog or recruitment-agency source. **D** = my synthesis.
**Quotes** are verbatim and at most 25 words. Every quote in the JSON was checked by script against the page text fetched on 2026-10-14.
**Access notes:** Bright Network and Gradcracker returned 403, and Oxford Careers blocked automated fetches, so none of them is cited. The Warwick tech-CV blog URL loaded an index page rather than the article, so it is excluded too.

---

## 0. Cross-cutting rules (apply to every archetype)

These limits sit **above** the archetype guidance. The archetype playbooks only choose *what to emphasise* inside them.

1. **Echo the advert's language, but only for things already present.** TARGETjobs: "When you write your CV, analyse the language the employer uses and echo it." [TP23, B]. In the same vein: "Recruiters will notice when you are speaking their language and matching the phrasing used in the job advert", with the caveat "be careful not to go overboard or use them where they don't make sense" [TP25, B]. LSE says the same: start the bullet with "communicated" if the employer wants communication skills [TP27, B]. → This is what the `reframes` lists do. Each one has an `onlyIf` guard.
2. **Put matching evidence first.** "make sure examples of these skills are at the top of the section" [TP1, B]. "Add the most relevant information first. Recruiters often scan through CVs quickly before deciding to read more thoroughly or reject" [TP28, B]. → `leadWith`.
3. **Never escalate authorship.** TARGETjobs (technical CV): "It is fine to say that you assisted with something or that you observed or gained exposure to such and such a process", and technical interviewers will probe anything on the CV [TP1, B]. Combined with the verb ladder in `05-tailoring-science.md` F9 (qualifier inflation is the failure human reviewers miss most; source grade B, arXiv). → Each archetype's `verbs.prefer` is a register, not a licence. A verb may replace the source verb only at the **same or a lower** authorship level.
4. **Own actions, not the team's.** "focusing specifically on your own actions (as opposed to talking in general terms about what a team did)" [TP1, B]. "Don't talk about 'we' or 'us'" [TP24, B]. A rewrite may turn "we built" into "built [component] in a 4-person team" only if the CV already says which component was theirs.
5. **The profile/summary is optional and must be specific.** TARGETjobs: "in many cases, a personal statement on a graduate CV is a waste of space" [TP22, B]. Prospects: keep it under 150 words and avoid bland statements [TP21, B]. Imperial Careers takes a more pro-profile line: "optional but should be included if you are applying for larger firms that may use AI in their recruitment processes. Make this short, evidenced based…" [TP20, B]. → Each `summaryFormula` asks for 1–2 evidenced lines, built only from facts already in the CV, with no adjectives like "hard-working" (LSE: avoid "Hard-working team player." [TP27]).
6. **Headings can be renamed to match the role.** "As a CV must be tailored to each opportunity, often headings and skills change to fit with what recruiters need to see" [TP20, B]. LSE suggests a "Research" heading when the employer asks for research [TP27, B]. → Renaming headings and regrouping entries are allowed tailoring moves. Inventing a section's content is not.
7. **Use active, past-tense verbs** ("Avoid weak verbs… I tried to…" [TP26, B]; "Avoid verbs such as 'did' and 'carried out'" [TP24, B]; Cambridge: avoid "-ing" duty phrases [TP16, B]). Keep honest weak verbs ("assisted", "contributed") when they are the truth (rule 3 wins).
8. **Time budget:** "as little as thirty seconds" [TP1, B]. LSE says "< 30 seconds" [TP27]. Cambridge says the CV must survive a "skim" read of perhaps 60 seconds [TP16]. This matches the ~30 s median in `02-recruiter-screening-evidence.md` F16. → The top third must carry the role-matching evidence.

---

## 1. Software engineering (`software_eng`) — well sourced (A/B)

**What is read first.** The skills block (are the advert's languages visible, grouped and current: "don't feel obliged to include anything that isn't relevant or might be outdated" [TP1]). Then projects and experience: what *you* built, in which stack, and whether it shipped. Recruiters "really want to see practical examples of candidates' skills and demonstrations of candidates' 'passion for technology'" [TP1, A with TP3]. An IT recruiter adds: "candidates that have a side project always grab my attention" [TP3, C]. Soft skills count "with equal importance" but must appear inside technical work [TP1, B]. "A CV that reads like a long list of programming languages is unlikely to engage a recruiter" [TP3, C].

**Lead with.** The bullet that already uses the advert's stack. Shipped or used artefacts. Existing numbers in X-Y-Z form ("Accomplished X, as measured by Y, by doing Z." [TP4, B]; TARGETjobs: "including specific numbers can be helpful" [TP1]). The component the student owned.

**Profile.** One or two lines, or none. TARGETjobs says a statement repeats the cover letter, so include "a one- or two-line statement" only when there is no cover letter or motivation question [TP1, B]. Prospects' own technical example is a short targeted statement (specialism + graduation year + target role) [TP2, B].

**Verb register.** Engineering verbs (TARGETjobs engineering lists "designed, developed, devised, analysed, optimised, solved" [TP30, B]). Avoid hype verbs (spearheaded, revolutionised, architected for a student project). That list is D.

**Reframes (D, each guarded).** "put the app online" → "deployed to [platform]" only with a named platform or live link. "worked in sprints" → "Agile (Scrum)" only if sprints are described. "used GitHub" → "pull requests and code review" only if reviews are described. Full list in the JSON.

**Section order.** Education (with relevant modules; Prospects lists them before IT skills [TP2, B]) → Technical Skills (TARGETjobs puts skills right under contact details [TP1]) → Projects/Experience (whichever is stronger) → Achievements → Interests. Consistent with SWE-02 in `cv-rules-tech-product.md`.

## 2. Data / analytics (`data_analytics`) — well sourced on content (B), synthesis on reframes

**What is read first.** Prospects' data-analyst profile gives the clearest tailoring template of any source found: "Show how you defined a question, cleaned the data, chose an analytical method and communicated the result." [TP6, B]. The core skill list is "programming or query skills in SQL and, for some roles, Python or R", plus "data visualisation skills using tools such as Power BI or Tableau" and "stakeholder and problem-solving skills to turn business questions into useful analysis" [TP6, B]. For data science, Prospects stresses communicating "to both technical and non-technical audiences" and "machine learning and statistical techniques" [TP7, B]. The RSS confirms a numerate degree background [TP8, B; RSS content looks dated].

**Lead with.** The question, then dataset and scale, then method and metric, then who used the result. Order each bullet as question → method → result, which follows TP6's four-step arc.

**Profile.** Quant degree + tools already evidenced + one question-to-result project. Pick analyst vs data-science framing from the advert title (sub-track logic as in DAT rules).

**Reframes.** "explained results to the team" → "communicated findings to non-technical stakeholders" uses TP7's standard phrasing (B), only if the audience really was non-specialist. "compared two versions" → "A/B test" **only** with a randomised split or control and a measured metric. Otherwise keep "comparison" (D; this is the data archetype's most likely over-claim).

**Pitfalls (D, aligned with DAT-04/DAT-11).** Accuracy with no baseline. Tool lists with no project. "Insights" with no decision attached.

## 3. Product (`product`) — thinnest evidence base (B on what PMs do, C/D on CV craft)

**Caveat.** "It's extremely unusual for an employer to recruit a product manager without at least two years of relevant experience." [TP9, B]. Graduate PM/APM schemes (e.g. Capital One UK) exist, but there is no UK careers-service guide specific to PM CVs (same gap as `cv-rules-tech-product.md` §9). The guidance below is inferred from what UK sources say PMs *do*.

**What is read first.** Users and feedback: PMs "collect and analyse user feedback to identify product requirements and priorities" [TP9, B]. Capital One: "recognising what a customer needs and the business objectives that a product or feature will fulfil" [TP10, B]. Decisions backed by "market research and thorough data analysis" [TP9]. Cross-functional stakeholders: "product designers, developers, and analysts, as well as marketing, sales…" [TP9, A with TP10]. Ownership: Prospects recommends positions of responsibility, leading a society and business competitions as the route in [TP9, B].

**Lead with.** The user problem → the prioritisation decision → the outcome metric (Capital One's graduate PM role centres on "customer conversion rates" [TP10, C]) → the stakeholders → the launch.

**Tech not required.** "a tech background is not necessary for success" [TP10, C]. So never inflate technical authorship to look like a PM. "Built the app" stays "worked with the developer who built it" unless the student built it.

**Writing.** Amazon wants CVs that "use straightforward language, highlight measurable data" [TP5, C, US employer]. The CV doubles as a PM writing sample (D).

**Reframes and pitfalls.** Mostly D: "asked people" → "gathered user feedback (n=…)". "decided what to build first" → "prioritised features against [criterion]" only if a real choice is described. Never self-title "Product Manager" or "Founder" for a course project (PRD-09a).

## 4. Marketing / growth (`marketing_growth`) — well sourced for brand/comms (A/B), weaker for growth specifics

**What is read first.** Experience before academia: "The marketing and media sectors both tend to prioritise experience over academia when it comes to hiring." [TP11, B]. Skimmability: "snappy, concise and accurate" [TP11] and "can be read at a glimpse" [TP12, CIM, B] (A together). A measurable result: TARGETjobs' good example "immediately explains a measurable achievement" [TP11, B]. Writing accuracy is part of the job: "your spelling, grammar and punctuation needs to be up to scratch" [TP11, B]. Visible proof: "visible proof of your ability" [TP14, B]. Link channels "as long as you use them regularly" [TP11].

**Growth tilt.** Nottingham Careers: "Digital marketing is highly data-driven, allowing marketers to measure performance and continuously improve campaigns", with growth marketer named as an emerging role [TP15, B]. Prospects lists Google Analytics, Google Ads and Mailchimp as standard tools [TP13, B]. KPI vocabulary (CTR, engagement rate, CPA) comes from an employer guest post [TP31, C]. For growth adverts, move the metric and the tool to the front of the bullet.

**Self-made experience counts.** CIM: "you can create your own marketing experience… starting your own blog or social account" [TP12, B]. So a personal or society channel can lead the Experience section.

**Profile.** Optional and two lines at most. TARGETjobs' marketing CV page itself points to the "waste of space" article [TP11, TP22].

**Reframes.** "ran the society Instagram" → "managed the society's Instagram channel". "got more followers" → "grew followers from X to Y in [period]" **only** if both numbers and the period exist. "tried two posters" → "A/B tested" only with a compared metric. The guards are D. The vocabulary is B/C.

## 5. Research (`research`) — well sourced for academic conventions (B), adapted down from PhD guidance

**What is read first.** Supervisors read the academic record and research experience. Cambridge Careers: "Research experience - not the title of your project, but its focus and key outcomes" [TP16, B]. Technical skills are "techniques, instruments, and programming languages… giving prominence to those most relevant" [TP16, B]. Imperial UROP: supervisors often look simply for "a student's innate enthusiasm for research and motivation to knuckle down and work hard" [TP18, B], and ask "What skills can you offer the host research group?" [TP18]. RHUL: explain "why you are interested in the project and why you feel you are qualified" [TP19, B].

**Lead with.** Question/focus → methods → your contribution (Cambridge's model line: "Working in a team of 3 researchers, my role was to…" [TP16]) → output.

**Profile.** Replace the sales-pitch profile with a one-line "Research interests" statement. With no prior research, Imperial suggests "a brief statement of fact regarding your degree" [TP17, B].

**Headings.** "you may want to use Research Experience as a title" and "parts of your degree are the most relevant experience" [TP20, B; also TP27] (A). So a dissertation or lab module can move from Education into Research Experience.

**Reframes.** Cambridge explicitly recommends translating institution jargon into general terms ("Part II" → "final year") [TP16, B]. That is a legitimate reformulation template. "paper we're writing" → "manuscript in preparation", never listed under Publications (RES-04). "helped a PhD student" keeps "assisted" (rule 3).

**Referee.** Imperial: "highlight at least one referee… familiar with you academically" when applying outside your own department [TP17, B].

---

## 6. What is synthesis (D), and caveats

- **All `onlyIf` guards** are D. They are my operationalisation of the no-fabrication rule (career-ops §3.2; `05-tailoring-science.md` F8–F9), not something a careers source states.
- **`verbs.avoid` lists** are D, apart from the generic weak-verb advice [TP24, TP26] and the "assisted is fine" principle [TP1]. No UK source publishes a role-specific "inflated verbs" list.
- **`competencyThemes`** are D labels. They are drawn from the Prospects skills lists [TP6, TP7, TP9, TP13] and existing keyword banks. Only emit one when a bullet evidences it (career-ops §3.2: never turn a gap into a competency tag).
- **Product** is the least evidenced archetype. Treat the whole block as a tunable default.
- **Profile guidance conflicts across UK sources** (TARGETjobs: usually a waste of space; Imperial: include one for AI-screened large firms; Prospects: under 150 words). The formulas resolve this as "1–2 evidenced lines or none" (D).
- Two sources are employer pages that are not UK-specific (Amazon TP5; Google via CNBC TP4). They are used only for writing clarity and the X-Y-Z bullet form, both already in the existing docs.
- The Reading careers-blog posts (TP3, TP31) are guest posts by a recruitment agency and by an employer, so they are graded C.

## 7. Sources (all accessed 2026-10-14)

| ID | Source | Same as |
|---|---|---|
| TP1 | targetjobs, Tips for a graduate technical CV — https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice | R2 / S3 |
| TP2 | Prospects, Technical CV example — https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/example-cvs/technical-cv-example | S5 |
| TP3 | University of Reading Careers Blog (Venturi Group guest post), Top 3 things recruiters look for in a CS CV — https://blogs.reading.ac.uk/careers/top-3-things-in-a-computer-science-cv/ | new |
| TP4 | CNBC, Google recruiters' 3-part formula — https://www.cnbc.com/2018/08/16/google-recruiters-share-the-3-part-formula-for-stronger-resumes.html | R59 / S1 |
| TP5 | About Amazon, 8 things Amazon recruiters say top candidates do — https://www.aboutamazon.com/news/workplace/successful-amazon-job-candidates | S4 |
| TP6 | Prospects, Data analyst job profile — https://www.prospects.ac.uk/job-profiles/data-analyst | R7 |
| TP7 | Prospects, Data scientist job profile — https://www.prospects.ac.uk/job-profiles/data-scientist | R8 |
| TP8 | Royal Statistical Society, Types of job: Data Scientist — https://rss.org.uk/jobs-careers/career-development/types-of-job/data-scientist/ | R9 / S20 |
| TP9 | Prospects, Product manager job profile — https://www.prospects.ac.uk/job-profiles/product-manager | R10 |
| TP10 | targetjobs, Graduate Product Manager at Capital One — https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one | R11 / S23 |
| TP11 | targetjobs, Writing a CV for graduate advertising, marketing and PR jobs — https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/writing-cv-graduate-advertising-marketing-and-pr-jobs | R12 / S11 |
| TP12 | CIM Scotland, Help to get your first job in marketing — https://regions.cim.co.uk/scotland/home/news/2023/help-to-get-your-first-job-in-marketing | R13 / S12 |
| TP13 | Prospects, Digital marketer job profile — https://www.prospects.ac.uk/job-profiles/digital-marketer | R14 |
| TP14 | Prospects, Marketing internships — https://www.prospects.ac.uk/jobs-and-work-experience/job-sectors/marketing-advertising-and-pr/marketing-internships/ | new |
| TP15 | University of Nottingham Careers, Marketing and digital marketing — https://www.nottingham.ac.uk/careers/students/graduatejobs/career-paths/ampr/marketing.aspx | new |
| TP16 | University of Cambridge Careers Service, CVs and cover letters for PhDs and postdocs (PDF) — https://www.careers.cam.ac.uk/files/phdpostdoccvbook.pdf | R21 / S22 |
| TP17 | Imperial UROP, How to actually apply — https://www.imperial.ac.uk/urop/how-to-get-involved/how-to-apply/ | new |
| TP18 | Imperial UROP, Things to consider before approaching a member of staff — https://www.imperial.ac.uk/urop/how-to-get-involved/things-to-consider/ | new |
| TP19 | Royal Holloway CS, UROP: How to Apply — https://urop.cs.rhul.ac.uk/how-to-apply | new |
| TP20 | Imperial College Careers, CVs and resumes — https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/cv/ | new |
| TP21 | Prospects, Writing a personal statement for your CV — https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/writing-a-personal-statement-for-your-cv | (cited in cv-rules-general G-19) |
| TP22 | targetjobs, Are personal statements a waste of space on graduate CVs? — https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/are-personal-statements-waste-space-graduate-cvs | (G-19) |
| TP23 | targetjobs, The 6-step guide to perfecting your graduate CV — https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/6-step-guide-perfecting-your-graduate-cv | new |
| TP24 | targetjobs, How to big up your leadership experience on your graduate management CV — https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-big-your-leadership-experience-your-graduate-management-cv | new |
| TP25 | targetjobs, Writing tips for graduates — https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/writing-tips-graduates-how-communicate-recruiters | new |
| TP26 | University of Nottingham Careers, Action verbs — https://www.nottingham.ac.uk/careers/students/applications/cvs/action-verbs.aspx | new |
| TP27 | LSE Careers blog, Writing a CV that works — https://blogs.lse.ac.uk/careers/2020/01/27/writing-a-cv-that-works-top-tips-for-marketing-yourself/ | new |
| TP28 | Newcastle University Careers, How to write a student CV — https://www.ncl.ac.uk/careers/making-applications/applications/cvs/ | new |
| TP29 | University of Edinburgh Careers, Improving your CV — https://careers.ed.ac.uk/cvs-and-applications/improving-your-cv | new |
| TP30 | targetjobs, How to write the perfect engineering CV — https://targetjobs.co.uk/careers-advice/engineering/cvs-and-covering-letters-convince-engineering-recruiters-youre-perfect-their-graduate-job | new |
| TP31 | University of Reading Careers Blog (SME Loans guest post), Top 5 tips for a role in digital marketing — https://blogs.reading.ac.uk/careers/5-tips-for-role-in-digital-marketing/ | new |
