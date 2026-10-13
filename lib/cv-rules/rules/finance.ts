import type { Archetype } from "@/lib/types";
import type { CvRule } from "../types";
import {
  F_S1, F_S2, F_S3, F_S5, F_S6, F_S7, F_S7_UCAS, F_S8, F_S9, F_S10, F_S11, F_S11_BROCHURE, F_S12, F_S13, F_S14, F_S15,
  F_S16, F_S17, F_S19, F_S20, F_S21, F_S21B, F_S22, F_S23, F_S24, F_S25, F_S26, F_S27, F_S28, F_S29, F_S31, F_S32,
  F_S35, F_S36, F_S37,
} from "./sources";

/**
 * Finance / quant / consulting rules — docs/research/cv-rules-finance-consulting.md (§1–§4, year table §7).
 * Grades are the doc's own A–D; where a doc gives two ("B/C"), the first is used.
 * Severities that differ by sub-sector (e.g. "critical (FIN, CON); major (QNT)") use the first value;
 * the variant is kept in llmGuidance.
 */
const FCQ: Archetype[] = ["finance_banking", "quant_trading", "consulting"];
const FIN: Archetype[] = ["finance_banking"];
const QNT: Archetype[] = ["quant_trading"];
const CON: Archetype[] = ["consulting"];

export const FINANCE_RULES: CvRule[] = [
  // ---------- §1 Cross-sector overrides (FCQ) ----------
  {
    id: "FCQ-01", sectors: FCQ, dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 1 }, severity: "critical", evidence: "A", sectorAdjust: { quant_trading: { severity: "major" } },
    statement: "Keep it to exactly one page for finance, consulting and quant applications — two pages are only for PhDs or experienced hires.",
    llmGuidance: "Critical for finance and consulting, major for quant. Never stepped down by year of study.",
    citations: [F_S1, F_S2, F_S3, F_S10, F_S11],
  },
  {
    id: "FCQ-02", sectors: FCQ, dimension: "uk", check: "code", checker: "education_first", severity: "major", evidence: "A",
    statement: "Put Education first, straight after your contact details — students in these sectors always lead with it.",
    citations: [F_S3, F_S7, F_S8],
  },
  {
    id: "FCQ-03", sectors: FCQ, dimension: "uk", check: "code", checker: "uk_personal_details", severity: "major", evidence: "A",
    statement: "Don't add a photo. It isn't UK practice, and Goldman Sachs recruiters say it just takes up precious space.",
    citations: [F_S1, F_S2, F_S3, F_S8],
  },
  {
    id: "FCQ-04", sectors: FCQ, dimension: "uk", check: "code", checker: "uk_grades", severity: "critical", evidence: "A", sectorAdjust: { quant_trading: { severity: "major" } },
    statement: "State your grades explicitly: degree classification or current average (e.g. \"Year 1 average: 72% (First)\"), class rank if you know it, and strong module marks. If you don't have marks yet, give a prediction marked with an asterisk.",
    llmGuidance: "Critical for front-office finance and MBB consulting; major for quant and Big 4.",
    citations: [F_S1, F_S2, F_S23, F_S24],
  },
  {
    id: "FCQ-05", sectors: FCQ, dimension: "clarity", check: "code", checker: "spelling", severity: "critical", evidence: "A",
    statement: "Have zero typos and no sloppy formatting. These jobs produce client documents, and some employers simply discard CVs that contain any errors.",
    llmGuidance: "UK English spell-check plus formatting consistency (date formats, bullet styles, font sizes, alignment). Never stepped down by year of study.",
    citations: [F_S1, F_S2, F_S3, F_S5, F_S11],
  },
  {
    id: "FCQ-06", sectors: FCQ, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Group your skills into labelled lines (e.g. Technical / Languages / Leadership) so both ATS and recruiters can find them.",
    llmGuidance: "Check that a Skills section exists with at least 2 labelled sub-lines. pass = 2+ labelled groups; partial = one undifferentiated list; fail = no skills section.",
    citations: [F_S1, F_S2],
  },
  {
    id: "FCQ-07", sectors: FCQ, dimension: "ats", check: "llm", severity: "major", evidence: "B",
    statement: "Use an ATS-safe layout: a sans-serif font like Arial or Calibri at a consistent 10–12pt, and no tables, text boxes, columns or graphics.",
    llmGuidance: "Look for signs of tables, text boxes, columns or graphics in the extracted text (interleaved lines, cell fragments, missing blocks) and, if available, font and size metadata. pass = clean single-column text; partial = one issue; fail = table/column layout for core content.",
    citations: [F_S7, F_S10, F_S8],
  },
  {
    id: "FCQ-08", sectors: FCQ, dimension: "impact", check: "code", checker: "quantified_bullets", params: { threshold: 0.4 }, severity: "major", evidence: "A",
    statement: "Write quantified, outcome-driven bullets that show your personal responsibility — say what you did (\"I\"), not what the team did (\"we\").",
    llmGuidance: "Thresholds (finance/quant): 25% of bullets with numbers in 1st year, 40% penultimate, 50% final year/Master's. Also check the outcome is attributable to the candidate.",
    yearAdjust: { "1st": { threshold: 0.25 }, final: { threshold: 0.5 }, masters: { threshold: 0.5 } },
    citations: [F_S1, F_S2, F_S25, F_S6],
  },
  {
    id: "FCQ-09", sectors: FCQ, dimension: "impact", check: "llm", severity: "major", evidence: "A",
    statement: "Make extracurriculars specific, with frequency, level and results (\"trains 4×/week, county 1st XV, captain\"), not \"enjoy sport\".",
    llmGuidance: "Score the specificity of activities and interests: look for numbers or rank words (captain, president, finalist, winner) in the Activities section. pass = specific with level/results; partial = some specifics; fail = generic ('enjoy sport').",
    citations: [F_S2, F_S1, F_S3],
  },
  {
    id: "FCQ-10", sectors: FCQ, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Tailor your CV to the division and the firm: use the job's own key words and values, and be explicit about which division you're targeting (e.g. IBD vs S&T vs AM).",
    llmGuidance: "Measure keyword overlap with the job description after synonyms, then judge whether the CV reads as generic or aimed at the wrong division. pass = clearly tailored; partial = generic; fail = aimed at a different division or firm.",
    citations: [F_S1, F_S2, F_S5, F_S9],
  },
  {
    id: "FCQ-11", sectors: FCQ, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Don't claim anything you can't defend — everything on your CV is fair game in interviews, especially in quant.",
    llmGuidance: "Flag listed skills with no supporting evidence anywhere in the CV as 'unevidenced', and flag inflated proficiency levels ('expert', 'advanced') without projects behind them. pass = all defensible; partial = a few unevidenced; fail = many.",
    citations: [F_S5, F_S15, F_S36],
  },
  {
    id: "FCQ-12", sectors: FCQ, dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Avoid AI-generic wording — recruiters see near-identical AI-written profiles. Substance beats polish; AI can help you polish, but not misrepresent.",
    llmGuidance: "Score genericness and flag AI clichés (see GEN-09). Minor in finance and quant; major in consulting.",
    citations: [F_S8, F_S21B, F_S32],
  },

  // ---------- §2 Finance / banking (FIN) ----------
  {
    id: "FIN-01", sectors: FIN, dimension: "uk", check: "llm", severity: "major", evidence: "B",
    statement: "Use a banking-style template: Education, Experience, Leadership/Activities, Skills & Interests. Keep it dense and one column, with firm and role in bold and dates and location right-aligned.",
    llmGuidance: "Check the heading set and order (Education → Experience → Leadership/Activities → Skills & Interests or 'Additional') and that dates sit on the same line as the role. pass = banking template; partial = right sections, unusual order or layout; fail = a different structure.",
    citations: [F_S3, F_S9, F_S7],
  },
  {
    id: "FIN-02", sectors: FIN, dimension: "uk", check: "code", checker: "uk_grades", severity: "major", evidence: "B",
    statement: "Show a strong academic record: a 2:1 or First (or on track for one), and your A-levels or IB with grades.",
    llmGuidance: "Pass when the classification/percentage is ≥ 60 or a predicted 2:1+, and an A-level/IB line with grades is present. Use judgement only for non-UK grading systems. No grades at all is critical via FCQ-04.",
    citations: [F_S7_UCAS, F_S8, F_S9, F_S35],
  },
  {
    id: "FIN-03", sectors: FIN, dimension: "uk", check: "llm", severity: "minor", evidence: "C",
    statement: "List academic distinctions like scholarships, prizes, Dean's list or a cohort rank (\"Top 5% of cohort\") — they're a bonus.",
    llmGuidance: "Look for scholarship, prize, award, 'top N%', 'ranked'. Bonus only: pass if present, na if absent (never fail).",
    citations: [F_S36, F_S1],
  },
  {
    id: "FIN-04", sectors: FIN, dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Show real commitment to finance: a society role, spring week, competition, or a portfolio you can talk about.",
    llmGuidance: "Look in Activities/Experience for finance society roles (member vs committee vs organiser), spring weeks/insight days, virtual internships, stock-pitch or trading competitions, a personal portfolio. pass = committee-level or competition/insight evidence; partial = membership only; fail = none.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [F_S9, F_S7, F_S1],
  },
  {
    id: "FIN-05", sectors: FIN, dimension: "impact", check: "llm", severity: "major", evidence: "A",
    statement: "Any work experience counts if you show its commercial side: frame retail, hospitality or tutoring with numbers like revenue, customers or targets.",
    llmGuidance: "For non-finance jobs, check whether bullets are framed with a commercial outcome (revenue, customers served, targets hit, numbers). pass = commercial framing with numbers; partial = some; fail = duty lists only.",
    citations: [F_S3, F_S5, F_S36],
  },
  {
    id: "FIN-06", sectors: FIN, dimension: "impact", check: "code", checker: "leadership_lexicon", severity: "major", evidence: "A",
    statement: "Show leadership and teamwork: positions of responsibility, captaincy, a society exec role or team projects.",
    llmGuidance: "Also judge the scope of the leadership role (team size, responsibility, what changed).",
    citations: [F_S3, F_S5],
  },
  {
    id: "FIN-07", sectors: FIN, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Include a technical skills line: Excel (modelling, pivot tables, VBA), PowerPoint, financial modelling or valuation (DCF, comps, LBO), Bloomberg/Capital IQ/FactSet, and Python/SQL for markets or asset management.",
    llmGuidance: "Match the FIN keyword bank (financial modelling, Excel, PowerPoint, Bloomberg/CapIQ/FactSet, Python/SQL; courses such as BIWS, WSP or the Bloomberg Market Concepts certificate count). Flag proficiency adjectives without evidence. Major for IBD/AM when modelling or Excel is absent; minor for spring-week applications.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [F_S7, F_S8],
  },
  {
    id: "FIN-08", sectors: FIN, dimension: "impact", check: "code", checker: "interests_present", severity: "minor", evidence: "A",
    statement: "Add a short, specific Interests line — bankers read it and use it to start conversations (e.g. \"Marathon (3:24, London 2025)\", \"Chess, ECF 1650\"). Generic ones like \"reading, travelling\" count against you.",
    llmGuidance: "Missing interests = minor; generic interests (reading, travelling, socialising) with no specifics = minor.",
    citations: [F_S3, F_S2, F_S8],
  },
  {
    id: "FIN-09", sectors: FIN, dimension: "relevance", check: "llm", severity: "minor", evidence: "D",
    statement: "List languages with a level (CEFR, or native/fluent/professional) — especially useful for EMEA desks and coverage roles.",
    llmGuidance: "Look for each language paired with a level (CEFR A1–C2, native, fluent, professional working). pass = levels given; partial = languages without levels; na = no languages listed.",
    citations: [],
  },
  {
    id: "FIN-10", sectors: FIN, dimension: "clarity", check: "code", checker: "summary_length", severity: "minor", evidence: "C",
    statement: "A profile or objective is optional for students. If you include one, keep it to two lines at most; leaving it out is fine.",
    llmGuidance: "Never penalise absence; a profile longer than 3 lines is a minor flag. Sources conflict: eFinancialCareers recommends a short keyword-rich summary, while UK university and Goldman Sachs templates omit it.",
    citations: [F_S8, F_S1, F_S3],
  },
  {
    id: "FIN-11", sectors: FIN, dimension: "relevance", check: "llm", severity: "minor", evidence: "C",
    statement: "Passing CFA Level I is a plus, especially for asset management or research — but it never replaces good grades.",
    llmGuidance: "Look for 'CFA Level I/1' passed. Bonus only: pass if present, na if absent.",
    citations: [F_S8, F_S36],
  },
  {
    id: "FIN-12", sectors: FIN, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Avoid red flags: the wrong firm's name, a division interest your CV doesn't back up, unexplained gaps, bullets over two lines, or school-level detail on a penultimate-year CV.",
    llmGuidance: "Composite red-flag check. Doc severity: wrong firm name in the profile/objective versus the target employer = critical; division mismatch, unexplained gaps, bullets longer than 2 lines, GCSE/high-school detail on a penultimate CV = minor. Base severity is major because the critical sub-items are covered by their own rules.",
    citations: [F_S36, F_S2],
  },
  {
    id: "FIN-13", sectors: FIN, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "For asset management, show investment thinking — a stock pitch with a thesis and outcome, an investment club, or a portfolio with a disciplined process — not just \"interest in markets\".",
    llmGuidance: "Asset-management roles only (otherwise na). Does the CV show investment reasoning (thesis, process, outcome) rather than a stated interest? pass = concrete reasoning; partial = activity without reasoning; fail = interest only.",
    citations: [F_S37],
  },
  {
    id: "FIN-14", sectors: FIN, dimension: "relevance", check: "llm", severity: "major", evidence: "D",
    statement: "For markets/sales & trading, show numeracy, quick decisions and communication — trading competitions, mental maths, debating, sales roles — plus macro awareness.",
    llmGuidance: "S&T roles only (otherwise na). Look for trading competitions, mental-maths or estimation results, debate, sales roles and macro commentary. pass = 2+ signals; partial = 1; fail = none.",
    citations: [F_S1],
  },

  // ---------- §3 Quant / trading (QNT) ----------
  {
    id: "QNT-01", sectors: QNT, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Show a quantitative academic background: a STEM degree, or strong quantitative modules with marks. It's strong evidence rather than a gate — Jane Street says no specific degree is required.",
    llmGuidance: "pass = STEM degree (maths, statistics, CS, physics, engineering) or 2+ quantitative modules with marks; partial = non-STEM with some quant evidence; fail = no quant evidence. Never critical.",
    citations: [F_S12, F_S17, F_S14],
  },
  {
    id: "QNT-02", sectors: QNT, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "List competition results with rankings: maths or physics olympiads (UKMT, BMO, IMO), Putnam, Kaggle, trading competitions, or chess and poker ratings.",
    llmGuidance: "Look for competition names plus a rank, medal or percentile. pass = result stated; partial = participation only; fail = none (never penalise absence in 1st year).",
    yearAdjust: { "1st": { skip: true } },
    citations: [F_S12, F_S17, F_S36],
  },
  {
    id: "QNT-03", sectors: QNT, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "List your programming languages honestly: Python is near-universal, C++ matters for research and dev roles, and Java, OCaml or Rust are a bonus.",
    llmGuidance: "A language list must be present. For quant research/dev roles require at least one of Python or C++ (major); for quant trading roles it's minor.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [F_S12, F_S14, F_S17, F_S19],
  },
  {
    id: "QNT-04", sectors: QNT, dimension: "relevance", check: "llm", severity: "minor", evidence: "A",
    statement: "Don't list Word or Excel — they're assumed. If you rate yourself, calibrate against professionals: \"very good C++\" sets a high bar.",
    llmGuidance: "Flag 'Microsoft Word/Office' or 'MS Word' in the skills line, and strong adjectives (expert, advanced, very good) without supporting projects.",
    citations: [F_S15],
  },
  {
    id: "QNT-05", sectors: QNT, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Show projects with results: back-tests, paper replications, or ML/execution models, with metrics (Sharpe, hit rate, RMSE, latency) and a link to the code or write-up.",
    llmGuidance: "Look for a projects section with a metric term or a GitHub URL, then judge rigour (out-of-sample testing, honest results). Major for quant research; minor→major for trading in the penultimate year.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [F_S12, F_S19],
  },
  {
    id: "QNT-06", sectors: QNT, dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Show your maths foundations — probability, statistics, linear algebra, optimisation, stochastic processes — through modules or projects.",
    llmGuidance: "Match the quant maths keyword bank in Education and Projects. pass = 2+ areas evidenced; partial = 1; fail = none.",
    citations: [F_S12, F_S7],
  },
  {
    id: "QNT-07", sectors: QNT, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Mental maths is tested in interviews, not scored from your CV — but competition results, trading-society practice or strategy games can hint at it.",
    llmGuidance: "Optional positive signal only: pass if competition results, trading-society practice or games are shown; otherwise na. Never fail for absence.",
    citations: [F_S1, F_S12, F_S20],
  },
  {
    id: "QNT-08", sectors: QNT, dimension: "relevance", check: "llm", severity: "minor", evidence: "A",
    statement: "You don't need finance knowledge for quant roles. A CV heavy on finance jargon but light on quantitative evidence is a weak profile.",
    llmGuidance: "Never penalise missing finance knowledge. If finance-keyword density is high and quant evidence is low, return partial with 're-balance towards quantitative evidence' advice; otherwise pass.",
    citations: [F_S13, F_S14, F_S16],
  },
  {
    id: "QNT-09", sectors: QNT, dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 1 }, severity: "major", evidence: "A",
    statement: "Keep it clear and concise on one page. Put extra detail in a separate document; IMC and Jane Street don't need a cover letter.",
    llmGuidance: "Also flag cover-letter-style paragraphs inside the CV.",
    citations: [F_S15, F_S13],
  },
  {
    id: "QNT-10", sectors: QNT, dimension: "impact", check: "llm", severity: "minor", evidence: "A",
    statement: "Show collaboration and communication — tutoring, TA roles, team competitions. Quant firms stress humility and teamwork.",
    llmGuidance: "Look for tutoring, teaching-assistant work, team competitions or collaborative projects with the candidate's role stated. pass = at least one clear example; fail = none.",
    citations: [F_S13, F_S14, F_S16, F_S19],
  },
  {
    id: "QNT-11", sectors: QNT, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "For research or dev roles, show engineering practice: testing, version control (Git) and documentation.",
    llmGuidance: "Look for Git/GitHub, unit tests/pytest, CI, documentation. pass = present; fail = absent (research/dev roles; minor).",
    citations: [F_S12],
  },
  {
    id: "QNT-12", sectors: QNT, dimension: "uk", check: "code", checker: "uk_grades", severity: "major", evidence: "B",
    statement: "A top mark (a First or 70%+) and your rank are strong positives. Firms differ — Jane Street has no grade requirement — so missing grades are a major flag, not a rejection.",
    citations: [F_S13, F_S16, F_S1],
  },

  // ---------- §4 Consulting (CON) ----------
  {
    id: "CON-01", sectors: CON, dimension: "uk", check: "code", checker: "uk_grades", severity: "critical", evidence: "B",
    statement: "State strong academics clearly: BCG UK asks for at least a 2:1, and Bain wants as much detail as possible on qualifications and grades. Big 4 firms are more flexible.",
    llmGuidance: "MBB/strategy: no grades or a sub-2:1 average is critical. Big 4: major (PwC dropped its 2:1 requirement; Deloitte collects GCSE/A-level/UCAS via its form).",
    citations: [F_S24, F_S23, F_S22, F_S29, F_S31],
  },
  {
    id: "CON-02", sectors: CON, dimension: "impact", check: "code", checker: "leadership_lexicon", severity: "critical", evidence: "A",
    statement: "Show leadership with scope and outcome: positions of responsibility, founding or growing something, leading a team through a challenge. Say \"I\", not \"we\", with strong verbs (\"trained\", \"organised\"), not \"did\".",
    llmGuidance: "Critical for MBB, major for Big 4. Also grade scope (team size, budget, change achieved) and the 'we'-ratio (above 0.5 triggers a warning).",
    citations: [F_S22, F_S23, F_S24, F_S25],
  },
  {
    id: "CON-03", sectors: CON, dimension: "impact", check: "llm", severity: "major", evidence: "A",
    statement: "Show structured problem-solving: bullets that go problem → analysis → recommendation → result (e.g. \"Diagnosed an 18% drop-off by segmenting 2k survey responses; recommendation adopted, +12% retention\").",
    llmGuidance: "Classify each bullet for a problem-solving arc (0–3 elements: problem, analysis, recommendation/result) and look for analytic verbs (analysed, diagnosed, modelled, prioritised, recommended). pass = at least one full arc; partial = partial arcs; fail = none.",
    citations: [F_S21, F_S24, F_S2],
  },
  {
    id: "CON-04", sectors: CON, dimension: "impact", check: "code", checker: "quantified_bullets", params: { threshold: 0.5 }, severity: "critical", evidence: "A",
    statement: "Quantify your impact everywhere: show why your work mattered and what changed because of you.",
    llmGuidance: "Consulting thresholds: 30% of bullets with numbers in 1st year, 50% penultimate, 60% final year/Master's. Critical for MBB, major for Big 4.",
    yearAdjust: { "1st": { threshold: 0.3 }, final: { threshold: 0.6 }, masters: { threshold: 0.6 } },
    citations: [F_S22, F_S2, F_S23],
  },
  {
    id: "CON-05", sectors: CON, dimension: "impact", check: "llm", severity: "major", evidence: "A",
    statement: "Show entrepreneurial drive: something you started (a society, venture, project or fundraiser), or a time you went beyond the brief.",
    llmGuidance: "Look for founded, launched, initiated, built, pitched, raised £ and judge whether it shows initiative beyond the brief. pass = clear example with an outcome; partial = initiative without outcome; fail = none.",
    citations: [F_S21, F_S22, F_S23],
  },
  {
    id: "CON-06", sectors: CON, dimension: "ats", check: "llm", severity: "minor", evidence: "B",
    statement: "Consulting-friendly headings like \"Leadership/Project Management\", \"Research\" or \"Consulting experience\" are fine — group related experience together and put the most relevant group first.",
    llmGuidance: "Accept these as valid headings. pass = clear headings grouping related experience; partial = relevant experience scattered across sections.",
    citations: [F_S2, F_S11_BROCHURE],
  },
  {
    id: "CON-07", sectors: CON, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Show case competitions, consulting societies or pro-bono consulting (e.g. 180 Degrees Consulting), with the results or deliverables.",
    llmGuidance: "Match the consulting keyword bank (case competition, consulting society, pro bono consulting, 180 Degrees Consulting, firm case challenges) and check a deliverable or outcome is stated. pass = with outcome; partial = involvement only; fail = none.",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [F_S27, F_S26, F_S2],
  },
  {
    id: "CON-08", sectors: CON, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "If your degree isn't quantitative, surface your analytical work: data handling, source analysis, Excel/SQL, or a statistics module.",
    llmGuidance: "If the degree is non-quantitative, look for at least one bullet evidencing quantitative or qualitative analysis. pass = present; fail = none. For quantitative degrees return na.",
    citations: [F_S27],
  },
  {
    id: "CON-09", sectors: CON, dimension: "clarity", check: "llm", severity: "major", evidence: "B",
    statement: "Write in plain English with no heavy jargon — a generalist partner should understand every line.",
    llmGuidance: "Score jargon and readability; average bullet length should be ≤ ~25 words and ≤ 2 lines. pass = plain English; partial = some jargon-heavy lines; fail = technical descriptions throughout.",
    citations: [F_S22],
  },
  {
    id: "CON-10", sectors: CON, dimension: "impact", check: "llm", severity: "minor", evidence: "A",
    statement: "Make extracurriculars and interests specific and evidenced — frequency, level, results (and quantify travel if you mention it).",
    llmGuidance: "Score the specificity of extracurriculars and interests (see FCQ-09). pass = specific; fail = generic ('reading, travelling, socialising') with no level or result.",
    citations: [F_S2],
  },
  {
    id: "CON-11", sectors: CON, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Include a skills line with Excel, PowerPoint, data tools (SQL, Python, Tableau, Power BI — valued in Big 4 tech consulting) and languages.",
    llmGuidance: "Match the consulting skills keyword bank. pass = skills line with relevant tools; partial = generic skills only; fail = no skills line.",
    citations: [F_S28, F_S2],
  },
  {
    id: "CON-12", sectors: CON, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Make sure your CV backs up your interest in consulting — events attended, relevant electives — and doesn't contradict your cover letter.",
    llmGuidance: "Low weight. Look for consulting-aligned signals (firm events, insight days, relevant electives) and anything that contradicts a consulting motivation. pass = aligned; partial = neutral; fail = contradictory.",
    citations: [F_S27, F_S2],
  },
  {
    id: "CON-13", sectors: CON, dimension: "clarity", check: "llm", severity: "major", evidence: "A",
    statement: "Avoid consulting red flags: a generic or AI-sounding profile, \"we\"-only bullets, responsibilities with no results, typos, two pages, references to the wrong firm, or long paragraphs.",
    llmGuidance: "Composite of FCQ-05, FCQ-12, CON-02 and CON-04. Doc severity: typos, a two-page CV or a wrong-firm reference = critical (covered by FCQ-05 and FCQ-01); the others = major. Base severity is major.",
    citations: [F_S1, F_S2, F_S25, F_S8],
  },
];
