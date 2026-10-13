import type { Archetype } from "@/lib/types";
import type { CvRule } from "../types";
import {
  T_S1, T_S2, T_S3, T_S4, T_S5, T_S6, T_S8_TECH, T_S8_INTERN, T_S11, T_S12, T_S14, T_S15, T_S16, T_S17, T_S19, T_S20,
  T_S21, T_S22, T_S23, T_S24, T_S25, T_S26, T_S27,
} from "./sources";

/**
 * Tech / data / product / marketing / research rules — docs/research/cv-rules-tech-product.md (§2–§7).
 * Grades are the doc's own A–D; where a doc gives two ("B/C/D", "C/D"), the first is used.
 * Rules citing snippet-only Bright Network [S8] or Strathclyde [S15] pages are downgraded one grade.
 * Year adjustments come from the §7 table.
 */
const SWE: Archetype[] = ["software_eng"];
const DAT: Archetype[] = ["data_analytics"];
const PRD: Archetype[] = ["product"];
const MKT: Archetype[] = ["marketing_growth"];
const RES: Archetype[] = ["research"];

export const TECH_RULES: CvRule[] = [
  // ---------- §2 Software engineering (SWE) ----------
  {
    id: "SWE-01", sectors: SWE, dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 1 }, severity: "major", evidence: "A",
    statement: "Keep internship CVs to one full page; a page-and-a-bit spillover reads as unedited.",
    llmGuidance: "1 page = ideal; 2 full pages = acceptable at UK firms; a ~1.3-page spillover = defect; 3+ pages = critical.",
    citations: [T_S2, T_S6, T_S3],
  },
  {
    id: "SWE-02", sectors: SWE, dimension: "relevance", check: "code", checker: "education_first", severity: "minor", evidence: "A",
    statement: "Put Education near the top, then Technical Skills and whichever of Experience or Projects is stronger.",
    llmGuidance: "Education within the first 2 sections passes. If the candidate has relevant internships, Experience should come before Projects; otherwise Projects first.",
    citations: [T_S2, T_S3, T_S5],
  },
  {
    id: "SWE-03", sectors: SWE, dimension: "relevance", check: "code", checker: "projects_count", severity: "major", evidence: "A",
    statement: "Include a Projects section with 2–4 projects — personal, coursework, hackathon or open source.",
    llmGuidance: "Zero projects and no tech experience is major. In 1st year, 1–2 projects (coursework counts) are enough.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [T_S5, T_S6, T_S2, T_S3],
  },
  {
    id: "SWE-04", sectors: SWE, dimension: "relevance", check: "code", checker: "project_stack", severity: "major", evidence: "A",
    statement: "Name the tech stack for each project, e.g. \"Python, FastAPI, PostgreSQL, Docker\".",
    citations: [T_S5, T_S3],
  },
  {
    id: "SWE-05", sectors: SWE, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "For each project, say your role and scope: solo or team, and what you personally built. For private or closed-source work, describe your contribution and its impact instead of linking code.",
    llmGuidance: "For each project, check the candidate's role (solo/team) and their own contribution are explicit. pass = all projects clear; partial = some; fail = none say what the candidate built.",
    citations: [T_S2, T_S5, T_S16],
  },
  {
    id: "SWE-06", sectors: SWE, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Give each project an outcome: users, performance, accuracy, a prize or ranking, deployment status, or \"used by X society\".",
    llmGuidance: "Look for a number or deployment word (deployed, live, released, App Store) per project and confirm it is an outcome, not a spec. pass = every project has an outcome; partial = some; fail = none.",
    citations: [T_S1, T_S2, T_S5],
  },
  {
    id: "SWE-07", sectors: SWE, dimension: "relevance", check: "code", checker: "github_link", severity: "major", evidence: "A",
    statement: "Add a GitHub link (profile or per-project repo), and/or a portfolio or live demo URL.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [T_S2, T_S3, T_S5],
  },
  {
    id: "SWE-08", sectors: SWE, dimension: "impact", check: "llm", severity: "major", evidence: "A",
    statement: "Write X-Y-Z bullets: \"Accomplished [X] as measured by [Y], by doing [Z]\". Most experience and project bullets should have an action and a measurable result.",
    llmGuidance: "Classify each bullet's X-Y-Z completeness (0–3 components: accomplishment, measure, method); a number + action verb + tech term together is a strong signal. pass = most bullets 3/3; partial = many 2/3; fail = mostly 0–1. In 1st year partial X-Y-Z (X+Z) is accepted.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [T_S1, T_S2],
  },
  {
    id: "SWE-09", sectors: SWE, dimension: "relevance", check: "code", checker: "skill_rating_glyphs", severity: "major", evidence: "B",
    statement: "Group skills by category (Languages / Frameworks & Libraries / Tools & Platforms / Databases / Cloud). Text labels like \"Proficient\" or \"Familiar\" are fine; bars, stars, percentages or \"8/10\" are not.",
    llmGuidance: "Bars/stars/ratings = major; ungrouped skills = minor.",
    citations: [T_S2, T_S5, T_S3, T_S15],
  },
  {
    id: "SWE-10", sectors: SWE, dimension: "relevance", check: "code", checker: "skills_count", severity: "minor", evidence: "B",
    statement: "Curate your skills list to roughly 8–20 relevant items, not 40 buzzwords. Drop Word and PowerPoint for software roles unless the advert asks for them.",
    citations: [T_S3],
  },
  {
    id: "SWE-11", sectors: SWE, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Back up your skills: each core language or framework should appear in at least one project or experience bullet.",
    llmGuidance: "Cross-reference the skills list against bullet text (after synonym normalisation). pass = core skills evidenced; partial = some unevidenced; fail = more than 50% of listed skills unevidenced.",
    citations: [T_S3, T_S16],
  },
  {
    id: "SWE-12", sectors: SWE, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Show your passion for technology: hackathons, tech societies, open source, competitions (ICPC, Advent of Code), personal projects, tutoring or TA work.",
    llmGuidance: "Look for hackathon, Devpost, HackLondon, IC Hack, Hack the Burgh, open source, ICPC, Kaggle and similar. Major in 1st year (the main differentiator); minor in penultimate year if the candidate already has an internship; minor in final year.",
    yearAdjust: { final: { severity: "minor" }, masters: { severity: "minor" } },
    citations: [T_S3, T_S8_INTERN, T_S8_TECH, T_S2],
  },
  {
    id: "SWE-13", sectors: SWE, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Mention engineering practice: Git, testing, CI, code review, Agile/Scrum.",
    llmGuidance: "Match practice keywords (Git, version control, unit testing/Jest/pytest, CI/CD, code review, Agile/Scrum). pass = 2+; partial = 1; fail = none.",
    citations: [T_S3, T_S5],
  },
  {
    id: "SWE-14", sectors: SWE, dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Show soft skills through tech context — teamwork on group projects, explaining trade-offs, working with stakeholders. Part-time non-tech jobs still count.",
    llmGuidance: "Look for teamwork, communication or stakeholder evidence attached to a concrete example (group project, trade-off explained, part-time job). pass = at least one evidenced example; fail = none or only claimed.",
    citations: [T_S3, T_S8_INTERN, T_S8_TECH, T_S16],
  },
  {
    id: "SWE-15", sectors: SWE, dimension: "uk", check: "code", checker: "uk_grades", severity: "major", evidence: "B",
    statement: "Your Education entry needs university, degree, expected graduation and grade (predicted or achieved 2:1/First, or year average %). Relevant modules are optional (one line); A-levels are fine for 1st and 2nd years.",
    citations: [T_S5, T_S2],
  },
  {
    id: "SWE-16", sectors: SWE, dimension: "clarity", check: "code", checker: "bullet_length", severity: "minor", evidence: "C",
    statement: "Keep bullets to one or two lines, and give each project no more than 2–4 bullets.",
    citations: [T_S6],
  },
  {
    id: "SWE-17", sectors: SWE, dimension: "clarity", check: "llm", severity: "minor", evidence: "C",
    statement: "Avoid red flags: tutorial clones (\"Netflix clone\") presented as original, unevidenced languages, dead GitHub links, \"Proficient in HTML\" as your headline skill, a university email only, \"references available on request\", or a colourful graphic-heavy template.",
    llmGuidance: "Check (a) tutorial clones with no extension, (b) languages with no evidence, (c) dead/private GitHub links, (d) HTML as the headline skill for a SWE role, (e) a .ac.uk email as the only email (minor), (f) 'references available on request', (g) more than 2 colours or graphic-heavy design. Severity ranges minor–major by item.",
    citations: [T_S2, T_S3, T_S15],
  },

  // ---------- §3 Data / analytics / ML (DAT) ----------
  {
    id: "DAT-01", sectors: DAT, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Make your Education carry weight: a quantitative degree and relevant modules (statistics, probability, linear algebra, ML, econometrics, databases). Length and order follow the software rules.",
    llmGuidance: "Classify the degree field and look for a relevant-modules line. pass = quantitative degree or relevant modules listed; fail = no quantitative evidence for a data-science role (major).",
    citations: [T_S19, T_S20],
  },
  {
    id: "DAT-02", sectors: DAT, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Make the core toolkit visible: SQL + Python (or R) + Excel or a BI tool for analyst roles; Python + statistics/ML libraries for data science.",
    llmGuidance: "Pick the sub-track from the target role title. Analyst: require SQL, Python/R and Excel/BI (missing SQL = major). Data scientist: require Python and stats/ML libraries. pass = full set; partial = one missing; fail = most missing.",
    citations: [T_S19, T_S20],
  },
  {
    id: "DAT-03", sectors: DAT, dimension: "relevance", check: "llm", severity: "major", evidence: "D",
    statement: "For each data project, state the dataset, its scale and its source (e.g. \"2.3M-row TfL journey dataset\", \"Kaggle\", \"NHS open data\").",
    llmGuidance: "Look for row/GB counts and source words (Kaggle, scraped, open data, API) per project. pass = all projects; partial = some; fail = none.",
    citations: [T_S5],
  },
  {
    id: "DAT-04", sectors: DAT, dimension: "impact", check: "llm", severity: "major", evidence: "D",
    statement: "For each project, state the method and an evaluation metric (accuracy, F1, AUC, RMSE, MAPE, uplift) against a baseline. \"99% accuracy\" with no baseline or context looks like leakage.",
    llmGuidance: "Find metric tokens and check a baseline or context accompanies them and the claim is plausible. pass = metric + baseline; partial = metric without baseline; fail = no metric, or an implausible unexplained claim.",
    citations: [],
  },
  {
    id: "DAT-05", sectors: DAT, dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Show the business or decision outcome — the \"so what\" (e.g. \"dashboard used weekly by 12 staff\"). Communicating with non-technical audiences is a repeatedly cited skill.",
    llmGuidance: "Check whether data work is tied to a decision or business outcome, or communicated to a non-technical audience. pass = clear outcome; partial = implied; fail = technical output only.",
    citations: [T_S19, T_S20, T_S4],
  },
  {
    id: "DAT-06", sectors: DAT, dimension: "relevance", check: "code", checker: "github_link", severity: "major", evidence: "B",
    statement: "Add a portfolio link: GitHub with notebooks, a Kaggle profile, Tableau Public, or a Streamlit / Hugging Face Spaces demo.",
    llmGuidance: "Major for data science/ML roles; minor for analyst roles.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [T_S3, T_S5],
  },
  {
    id: "DAT-07", sectors: DAT, dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Count competitions as achievements — Kaggle medals, datathons — and state your rank as a percentile (e.g. \"top 8% of 2,100 teams\").",
    llmGuidance: "Look for competition keywords plus a rank or percentile. pass = rank stated; partial = participation only; na = no competitions.",
    citations: [T_S3],
  },
  {
    id: "DAT-08", sectors: DAT, dimension: "relevance", check: "llm", severity: "minor", evidence: "A",
    statement: "Group your skills: Languages / Libraries (pandas, scikit-learn, PyTorch) / Data & BI tools (SQL, Power BI, Tableau) / Cloud & big data (BigQuery, Spark) / Statistics (A/B testing, regression).",
    llmGuidance: "Check for labelled skill groups (sub-headings or colon-prefixed lines) and no rating bars. pass = grouped; partial = one flat list.",
    citations: [T_S5, T_S3],
  },
  {
    id: "DAT-09", sectors: DAT, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Name your statistics rather than implying it: for data-science roles include at least one of hypothesis testing, regression, Bayesian methods, experimental design, A/B testing or time series.",
    llmGuidance: "Major for data-science roles, minor for analyst roles. pass = at least one named statistical method; fail = none.",
    citations: [T_S20, T_S19],
  },
  {
    id: "DAT-10", sectors: DAT, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "For ML roles, put research outputs (dissertation, poster, arXiv preprint, workshop paper) in a Publications/Research line, formatted as a citation.",
    llmGuidance: "Bonus only. Look for a publications section or citation patterns (arXiv IDs, venue names). pass = formatted citations; partial = mentioned but unformatted; na = none.",
    citations: [T_S21, T_S22],
  },
  {
    id: "DAT-11", sectors: DAT, dimension: "relevance", check: "llm", severity: "minor", evidence: "D",
    statement: "Avoid red flags: only MOOC certificates with no applied project, Excel as your only data skill for a data-science role, Titanic/Iris/MNIST as the headline project with no twist, unexplained metrics, or every ML algorithm listed in your skills.",
    llmGuidance: "Check each red flag (a) MOOC-only, (b) Excel-only for DS, (c) Titanic/Iris/MNIST headline project with no twist, (d) unexplained metrics, (e) exhaustive algorithm lists. Severity minor–major by item.",
    citations: [],
  },
  {
    id: "DAT-12", sectors: DAT, dimension: "relevance", check: "llm", severity: "minor", evidence: "C",
    statement: "GenAI skills (LLM APIs, RAG, prompt evaluation, fine-tuning) are a bonus, not a requirement — unless the advert asks for them.",
    llmGuidance: "Bonus only: pass if GenAI skills are evidenced, na if absent (unless the job description requires them).",
    citations: [T_S17],
  },

  // ---------- §4 Product management / APM (PRD) ----------
  {
    id: "PRD-01", sectors: PRD, dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 2 }, severity: "major", evidence: "B",
    statement: "Aim for one page (two at most), with Education first as a student.",
    citations: [T_S2, T_S3],
  },
  {
    id: "PRD-02", sectors: PRD, dimension: "impact", check: "llm", severity: "major", evidence: "C",
    statement: "Show end-to-end product ownership at least once: you spotted a user problem, researched it, prioritised, shipped and measured the result.",
    llmGuidance: "Detect the arc in bullets or projects: problem → users/research → action/prioritisation → launch → metric. pass = at least one full arc; partial = partial arc; fail = none.",
    citations: [T_S23],
  },
  {
    id: "PRD-03", sectors: PRD, dimension: "relevance", check: "llm", severity: "major", evidence: "D",
    statement: "Use product metrics correctly — DAU/MAU, retention, conversion, activation, NPS, churn, funnel — and attach them to real outcomes.",
    llmGuidance: "Find product-metric vocabulary and check each is attached to an outcome, not name-dropped. pass = used with outcomes; partial = mentioned without outcomes; fail = none.",
    citations: [],
  },
  {
    id: "PRD-04", sectors: PRD, dimension: "relevance", check: "llm", severity: "major", evidence: "D",
    statement: "Show user research: interviews, surveys (with the sample size), usability tests or personas.",
    llmGuidance: "Look for user-research keywords plus 'n = N' or 'interviewed N'. pass = research with sample size; partial = research without numbers; fail = none.",
    citations: [],
  },
  {
    id: "PRD-05", sectors: PRD, dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Show cross-functional collaboration: working with engineers, designers or marketing, or leading a team or society.",
    llmGuidance: "Look for concrete collaboration across functions or team leadership with the candidate's role. pass = clear example; fail = none.",
    citations: [T_S23, T_S4],
  },
  {
    id: "PRD-06", sectors: PRD, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Show technical literacy without overclaiming — SQL, basic Python, APIs, Figma, Jira. A shipped side project counts heavily, and you don't need a tech degree.",
    llmGuidance: "Match the PRD tools keyword bank. Never penalise a non-CS degree. pass = some technical literacy evidenced; partial = listed only; fail = none.",
    citations: [T_S23],
  },
  {
    id: "PRD-07", sectors: PRD, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Show commercial awareness: pricing, market sizing, competitor insight or revenue impact.",
    llmGuidance: "Look for pricing, market sizing (TAM/SAM/SOM), competitor analysis or revenue impact with specifics. pass = concrete example; partial = mentioned; fail = none.",
    citations: [T_S24],
  },
  {
    id: "PRD-08", sectors: PRD, dimension: "impact", check: "llm", severity: "minor", evidence: "D",
    statement: "Founder or builder signals rank highly: a start-up, a society app, hackathon product lead, a Product Hunt launch, or consulting-society case wins.",
    llmGuidance: "Bonus: pass if founder/builder signals are present (start-up, society app, hackathon product lead, Product Hunt launch, case wins), otherwise na. Can be major for APM-style roles.",
    citations: [],
  },
  {
    id: "PRD-09", sectors: PRD, dimension: "impact", check: "llm", severity: "major", evidence: "D",
    statement: "Avoid red flags: calling a solo course project \"product manager\", name-dropping frameworks (RICE, JTBD) with no application, no numbers anywhere, or responsibilities-only society roles.",
    llmGuidance: "Check (a) title inflation, (b) frameworks named without application, (c) no number anywhere, (d) 'Responsible for…' society roles. pass = none; partial = one; fail = two or more.",
    citations: [T_S1],
  },

  // ---------- §5 Marketing / growth (MKT) ----------
  {
    id: "MKT-01", sectors: MKT, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Marketing prioritises experience over academia: if you have relevant work, internships or campaigns, put them before or alongside Education.",
    llmGuidance: "If relevant marketing experience exists and Education comes first, return partial with a suggestion to swap; otherwise pass.",
    citations: [T_S11],
  },
  {
    id: "MKT-02", sectors: MKT, dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 2 }, severity: "major", evidence: "A",
    statement: "Keep it to 1–2 pages with snappy, skimmable bullets — clear and concise enough to read at a glance.",
    citations: [T_S11, T_S12],
  },
  {
    id: "MKT-03", sectors: MKT, dimension: "impact", check: "llm", severity: "critical", evidence: "A",
    statement: "Show campaign metrics — reach, engagement rate, follower growth, CTR, conversion, ROAS, sign-ups, ticket sales — ideally with a timeframe (\"in 2 weeks\").",
    llmGuidance: "Find metric tokens with numbers and check each is attributable to the candidate. Critical for growth/performance roles; major for brand/comms. pass = attributable metrics with timeframes; partial = metrics without timeframe or attribution; fail = none.",
    citations: [T_S11, T_S1],
  },
  {
    id: "MKT-04", sectors: MKT, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Link your portfolio or channels — LinkedIn, a blog, a portfolio site, society or brand accounts you ran, personal content — but only if they're active and up to date.",
    llmGuidance: "Detect URLs/handles for portfolio, blog or managed accounts. pass = at least one relevant link; fail = none. Recency can't be verified without fetching, so remind the user to check.",
    citations: [T_S11, T_S12],
  },
  {
    id: "MKT-05", sectors: MKT, dimension: "impact", check: "llm", severity: "major", evidence: "A",
    statement: "Self-initiated content counts as experience: your blog, social channels, charity volunteering or a society marketing role.",
    llmGuidance: "Credit blogs, social channels, charity volunteering and society marketing roles the same as paid experience. pass = present and described with outcomes; partial = present without outcomes; fail = no marketing activity at all.",
    citations: [T_S12],
  },
  {
    id: "MKT-06", sectors: MKT, dimension: "relevance", check: "code", checker: "outdated_tools", severity: "minor", evidence: "B",
    statement: "List current certifications (GA4, Google Ads, HubSpot, Meta Blueprint, CIM). Remove Universal Analytics — Google shut it down on 1 July 2024.",
    citations: [T_S12, T_S25],
  },
  {
    id: "MKT-07", sectors: MKT, dimension: "clarity", check: "code", checker: "spelling", severity: "critical", evidence: "A",
    statement: "Zero tolerance for typos: in marketing and PR the role is communication, so spelling and grammar errors are disqualifying.",
    llmGuidance: "Any genuine spelling or grammar error is critical in marketing.",
    citations: [T_S11, T_S3],
  },
  {
    id: "MKT-08", sectors: MKT, dimension: "ats", check: "llm", severity: "minor", evidence: "B",
    statement: "Creative designs are allowed in marketing, but keep a plain, parseable PDF version for large employers' online applications.",
    llmGuidance: "If images or columns are detected, give only a minor warning suggesting a 'two versions' strategy (creative + parseable). Never penalise design beyond minor.",
    citations: [T_S11, T_S14],
  },
  {
    id: "MKT-09", sectors: MKT, dimension: "relevance", check: "llm", severity: "major", evidence: "C",
    statement: "Show commercial and audience understanding: target audience, positioning, brand voice and any budget you handled (£).",
    llmGuidance: "Look for audience, positioning, brand voice or budget evidence. pass = concrete example; partial = mentioned; fail = none.",
    citations: [T_S12, T_S24],
  },
  {
    id: "MKT-10", sectors: MKT, dimension: "relevance", check: "llm", severity: "major", evidence: "C",
    statement: "For growth roles, show analytics and tools: GA4, Google Ads, Meta Ads Manager, SEO tools (Semrush/Ahrefs), email (Mailchimp/Klaviyo), CRM (HubSpot/Salesforce), Canva/Adobe, Excel.",
    llmGuidance: "Match the MKT tools keyword bank. Major for growth roles, minor for brand roles. pass = 3+ relevant tools; partial = 1–2; fail = none.",
    citations: [T_S12],
  },
  {
    id: "MKT-11", sectors: MKT, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Check the profiles you link don't contain anything unprofessional.",
    llmGuidance: "Not automatable — show as a checklist reminder, never as a score. Always return na.",
    citations: [T_S12],
  },
  {
    id: "MKT-12", sectors: MKT, dimension: "impact", check: "llm", severity: "minor", evidence: "D",
    statement: "Avoid red flags: \"social media savvy\" or \"creative\" with no evidence, follower counts with no timeframe or baseline, a personal Instagram as your portfolio, or a generic objective.",
    llmGuidance: "Check (a) unevidenced 'savvy/creative' claims, (b) follower numbers with no time word or baseline, (c) unrelated personal social accounts as portfolio, (d) generic objective. Severity minor–major by item.",
    citations: [],
  },

  // ---------- §6 Research (RES) ----------
  {
    id: "RES-01", sectors: RES, dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 2 }, severity: "major", evidence: "B",
    statement: "Keep a research CV to 1–2 pages as an undergraduate. Longer academic CVs only make sense with a real publication or teaching record.",
    citations: [T_S22, T_S3],
  },
  {
    id: "RES-02", sectors: RES, dimension: "relevance", check: "code", checker: "education_first", severity: "major", evidence: "A",
    statement: "Put Education first and in detail: grade or ranking, relevant modules with marks, dissertation or final-year project title and supervisor, prizes and scholarships.",
    llmGuidance: "Also check a dissertation/final-year project is named.",
    citations: [T_S22, T_S5],
  },
  {
    id: "RES-03", sectors: RES, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Add a Research Experience section, separate from work experience: project title, lab or group, supervisor, dates, research question, methods, your contribution and the output.",
    llmGuidance: "Detect a research-experience section and check each entry for title, lab/group, supervisor, dates, question, methods, own contribution, output. pass = most components; partial = section without key components; fail = no research section.",
    citations: [T_S22, T_S26],
  },
  {
    id: "RES-04", sectors: RES, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "List publications in one consistent citation style, newest first, with your name in bold. Separate peer-reviewed work from preprints and posters, and never list \"in preparation\" work as published.",
    llmGuidance: "Check citation format (authors, year, venue, DOI/arXiv), ordering and honest status labels ('submitted', 'under review'). 'In prep' listed under Publications is a misrepresentation (critical). na if no publications.",
    citations: [T_S22, T_S27],
  },
  {
    id: "RES-05", sectors: RES, dimension: "clarity", check: "llm", severity: "minor", evidence: "B",
    statement: "Order outputs: peer-reviewed work first, then preprints, then posters and presentations, then anything else.",
    llmGuidance: "Check the sub-heading order of outputs. pass = peer-reviewed → preprints → posters/talks → other; partial = mixed; na = no outputs.",
    citations: [T_S22],
  },
  {
    id: "RES-06", sectors: RES, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Group your methods and technical skills: lab techniques, statistical methods, software (Python, R, MATLAB, LaTeX), instruments, HPC.",
    llmGuidance: "Check for labelled skill groups covering methods and software. pass = grouped; partial = one flat list.",
    citations: [T_S22],
  },
  {
    id: "RES-07", sectors: RES, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Include conferences, posters, talks, reading groups, outreach, and any teaching or demonstrating.",
    llmGuidance: "Bonus: pass if any are present, otherwise na.",
    citations: [T_S22],
  },
  {
    id: "RES-08", sectors: RES, dimension: "uk", check: "llm", severity: "minor", evidence: "B",
    statement: "List awards, scholarships and funding, e.g. \"EPSRC Vacation Internship 2025\", Dean's List or a departmental prize.",
    llmGuidance: "Bonus: pass if awards/scholarships/funding are listed, otherwise na.",
    citations: [T_S26],
  },
  {
    id: "RES-09", sectors: RES, dimension: "uk", check: "llm", severity: "minor", evidence: "C",
    statement: "Academic placements often ask for 1–2 academic referees. Include names and contacts only if the scheme asks; otherwise leave them off.",
    llmGuidance: "Info prompt only: for academic research placements with no referee section, remind the user; never fail.",
    citations: [T_S22],
  },
  {
    id: "RES-10", sectors: RES, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "For industry ML research internships, show research-area keywords, top venues (NeurIPS, ICML, ICLR, ACL, CVPR), a strong language (Python/C++) and a GitHub with research code.",
    llmGuidance: "Industry ML research roles only (otherwise na). pass = research keywords + strong language + GitHub research code; partial = some; fail = none.",
    citations: [T_S21],
  },
  {
    id: "RES-11", sectors: RES, dimension: "relevance", check: "llm", severity: "major", evidence: "C",
    statement: "Avoid red flags: blog posts padded in as papers, no supervisor or lab named for a research project, vague \"assisted with research\", or a multi-page CV with no outputs.",
    llmGuidance: "Check (a) padded publications, (b) research projects with no supervisor/lab, (c) vague 'assisted with research', (d) multi-page CV with no outputs. pass = none; partial = one; fail = two or more.",
    citations: [T_S22],
  },
];
