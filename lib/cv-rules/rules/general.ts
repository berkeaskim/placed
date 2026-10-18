import type { CvRule } from "../types";
import { DEFAULT_MAX_PAGES, FIRST_PERSON, GRADE_POLICY, PAGE_LENGTH_COPY, PROFILE_COPY, cvMaxPages } from "@/lib/conventions";
import {
  GH_PARSE, WD_PARSE, GH_FILETYPES, TEXTKERNEL_COLUMNS, LEVER_PARSING, SHEFFIELD_ATS, GH_SEARCH, PROSPECTS_CV,
  MANCHESTER_CV, NCS_SECTIONS, TJ_6STEP, LADDERS_2012, TJ_PROPERTY_CV, EQUALITY_ACT, ACAS_AGE,
  TJ_PERSONAL_STATEMENTS, PROSPECTS_PERSONAL_STATEMENT, KNOUSE_1994, BRIGHT_INTERNSHIP_CV, STERKENS_2023,
  VAN_INWEGEN_2025, COLE_2007, ISE_AI_2026, PUBLICTECH_CIVIL_SERVICE_AI, GRADCRACKER_EXPERIAN, GEMM_2019, T_S1, T_S3,
  T_S4, T_S5, T_S6, T_S11, T_S12, T_S14, M_QUADLIN_GPA, M_BRAUN_AUDIT, M_RIVERA_TILCSIK, F_S1, F_S10, F_S11, F_S13,
  F_S15, F_S2, F_S23, F_S24, F_S29, F_S32, THE_ISE_2022, TJ_CV_FAQ_2026, TJ_TECH_CV_2025,
} from "./sources";

/**
 * Cross-industry rules: docs/research/cv-rules-general.md §2 (strong→A, moderate→B, weak→C, consensus-only→D).
 *
 * Audit 2026-10-18 (docs/research/audit-2026-10-18, 04#2): one detector is one rule. The GEN-01…12 baseline from
 * cv-rules-tech-product.md §1 and the sector copies of the same checks (FCQ-01/03/04/05/08, FIN-02, QNT-09/12,
 * CON-01/04, SWE-01/09/10/11/15/16, PRD-01, MKT-02/07, RES-01) were merged into the G- rules below; sectors now
 * change severity, page limits and wording through sectorAdjust. Removed from scoring because the judge can't
 * observe them: G-03 (header/footer position), G-10 (file name), G-28 (font), G-35 (link liveness), GEN-11
 * (file type), G-09 (hidden text: ATS-HID-01 covers it). G-37 (fairness guardrail) is not a CV rule; its promise
 * is shown in "How this score works".
 */
export const GENERAL_RULES: CvRule[] = [
  // ---------- A. Document, file and ATS-parse safety ----------
  {
    id: "G-01", sectors: "all", dimension: "ats", check: "code", checker: "text_layer", severity: "critical", evidence: "A",
    statement: "Submit a text-based PDF or DOCX, never an image or a scanned page — ATS can't read images.",
    citations: [
      { title: "Unsuccessful resume parse", publisher: "Greenhouse Support", year: "current", url: "https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse" },
      { title: "Resume parsing", publisher: "Workday Admin Guide", year: "current", url: "https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html" },
    ],
  },
  {
    id: "G-02", sectors: "all", dimension: "ats", check: "code", checker: "file_size", severity: "major", evidence: "A",
    statement: "Keep the file under 2.5 MB. Greenhouse accepts bigger uploads but stops parsing them, so a recruiter has to type your details in by hand.",
    citations: [GH_PARSE, GH_FILETYPES],
  },
  {
    id: "G-04", sectors: "all", dimension: "ats", check: "llm", severity: "major", evidence: "A",
    statement: "Use a single-column layout and don't put content in tables, text boxes or graphics. Columns and tables are a known cause of parse failures.",
    llmGuidance: "Does the extracted text read in one coherent order, with no fragments of a sidebar, table or text box interleaved with other sections (e.g. skill ratings mixed into job lines)?",
    passExample: "Education, Experience and Skills follow one another in a single reading order",
    failExample: "'Python ★★★★ Barista, Costa Coffee Jun 2024 SQL ★★★' — a skills sidebar interleaved with experience lines",
    citations: [GH_PARSE, TEXTKERNEL_COLUMNS, T_S14],
  },
  {
    id: "G-05", sectors: "all", dimension: "ats", check: "code", checker: "skill_rating_glyphs", severity: "major", evidence: "B",
    statement: "Don't use skill bars, star ratings, percentages or \"8/10\" scores, icons in place of words, or images of text. Parsers can't read them; write proficiency in words like \"Proficient\" or \"Familiar\".",
    sectorAdjust: { software_eng: { statement: "Group skills by category (Languages / Frameworks / Tools). Text labels like \"Proficient\" or \"Familiar\" are fine; bars, stars, percentages or \"8/10\" are not." } },
    citations: [WD_PARSE, LEVER_PARSING],
  },
  {
    id: "G-06", sectors: "all", dimension: "ats", check: "code", checker: "section_headings", severity: "major", evidence: "B",
    statement: "Use standard section headings — Education, Experience, Projects, Skills, Leadership & Activities, Interests — not creative ones like \"My Journey\".",
    citations: [GH_PARSE, SHEFFIELD_ATS],
  },
  {
    id: "G-07", sectors: "all", dimension: "ats", check: "llm", severity: "minor", evidence: "A",
    statement: "Write job titles and organisation names in full, and expand an abbreviation the first time you use it, e.g. \"The Chartered Institute of Marketing (CIM)\".",
    llmGuidance: "Are all job titles and organisation names written in full, with any acronym expanded at least once? Never score employer or university brand.",
    passExample: "Marketing Officer, The Chartered Institute of Marketing (CIM)",
    failExample: "Sr. Mktg Exec, CIM",
    citations: [GH_PARSE, SHEFFIELD_ATS],
  },
  {
    id: "G-08", sectors: "all", dimension: "ats", check: "llm", severity: "major", evidence: "A",
    statement: "Don't space out the letters of your name or headings (\"J O H N  S M I T H\") — it breaks name parsing.",
    llmGuidance: "Are the name and section headings free of spaced-out letters (four or more single characters separated by spaces)?",
    passExample: "PRIYA SHAH",
    failExample: "P R I Y A   S H A H",
    citations: [GH_PARSE],
  },

  // ---------- B. Length and structure ----------
  {
    id: "G-11", sectors: "all", dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: DEFAULT_MAX_PAGES }, severity: "major", evidence: "B",
    statement: `Keep your CV to ${PAGE_LENGTH_COPY.default}. One page is the usual default for students; if you use a second page, fill it rather than spilling over a few lines.`,
    sectorAdjust: {
      finance_banking: {
        maxPages: cvMaxPages("finance_banking"), severity: "critical",
        statement: "Keep it to one page for finance applications. Cambridge, LSE and Warwick careers services all say so; two pages is for PhDs and experienced hires.",
        citations: [F_S1, F_S11, F_S10],
      },
      consulting: {
        maxPages: cvMaxPages("consulting"), severity: "critical",
        statement: "Keep it to one page for consulting applications. Cambridge, LSE and Warwick careers services all say so; two pages is for PhDs and experienced hires.",
        citations: [F_S2, F_S11, F_S10],
      },
      quant_trading: {
        maxPages: cvMaxPages("quant_trading"),
        statement: "Keep it clear and concise on one page. Put extra detail in a separate document; IMC and Jane Street don't need a cover letter.",
        citations: [F_S15, F_S13],
      },
      software_eng: {
        statement: "One or two full A4 pages is fine for UK software roles. Some US-headquartered tech firms prefer one page for students, so check the advert; avoid a second page with only a few lines on it.",
        citations: [TJ_TECH_CV_2025, PROSPECTS_CV],
      },
    },
    citations: [TJ_CV_FAQ_2026, PROSPECTS_CV, MANCHESTER_CV],
  },
  {
    id: "G-12", sectors: "all", dimension: "clarity", check: "llm", severity: "major", evidence: "D",
    statement: "List entries in reverse chronological order inside each section, most recent first.",
    llmGuidance: "Within every section, are entries listed most recent first (with 'Present' or an expected date counting as the latest)?",
    passExample: "Experience: Jun 2025 – Present, then Jul 2024 – Sep 2024",
    failExample: "Experience: Jul 2022 – Aug 2022 listed above Jun 2025 – Present",
    citations: [PROSPECTS_CV, NCS_SECTIONS, T_S5, T_S11],
  },
  {
    id: "G-13", sectors: "all", dimension: "relevance", check: "llm", severity: "minor", evidence: "D",
    statement: "Order your sections: contact details, optional profile, Education, Experience, Projects/Activities, Skills, Interests. Only put Experience above Education if you have substantial relevant experience.",
    llmGuidance: "Does Education come before Experience, or, if Experience comes first, is that experience substantial and relevant (e.g. a 12-month placement or several relevant internships)?",
    passExample: "Education (UCL, BSc Economics) is the first section after contact details",
    failExample: "A single two-week retail job is placed above Education for a first-year student",
    citations: [NCS_SECTIONS, PROSPECTS_CV, TJ_6STEP],
  },
  {
    id: "G-14", sectors: "all", dimension: "uk", check: "llm", severity: "major", evidence: "C",
    statement: "Every experience, education and project entry needs the organisation, your role or qualification, and start and end dates (month and year).",
    llmGuidance: "Does every experience, education and project entry state the organisation, the role or qualification, and start and end dates with month and year? Never score employer or university brand.",
    passExample: "Sales Assistant, Boots — Sep 2024 – Jun 2025",
    failExample: "Sales Assistant — 2024",
    citations: [LEVER_PARSING, LADDERS_2012],
  },
  {
    id: "G-15", sectors: "all", dimension: "uk", check: "code", checker: "cv_title", severity: "minor", evidence: "D",
    statement: "Don't title the document \"Curriculum Vitae\" or \"CV\" — your name is the title.",
    citations: [PROSPECTS_CV, TJ_PROPERTY_CV],
  },

  // ---------- C. Contact details and UK personal-data conventions ----------
  {
    id: "G-16", sectors: "all", dimension: "uk", check: "code", checker: "contact_present", severity: "critical", evidence: "D",
    statement: "Put your mobile number and a professional email at the top. Your town or city and a LinkedIn URL help too; a full home address isn't needed.",
    citations: [NCS_SECTIONS, PROSPECTS_CV],
  },
  {
    id: "G-17", sectors: "all", dimension: "uk", check: "code", checker: "uk_personal_details", severity: "major", evidence: "B",
    statement: "Leave out your date of birth or age, marital status, gender, religion and ethnicity — it's UK convention and protects you. Nationality is optional; a right-to-work line is fine.",
    citations: [EQUALITY_ACT, ACAS_AGE, NCS_SECTIONS, PROSPECTS_CV],
  },
  {
    id: "G-18", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "D",
    statement: "Leave references off, or just write \"References available on request\". Don't list your referees' phone numbers or emails.",
    llmGuidance: "Is the CV free of referees' personal contact details (names with phone numbers or email addresses)?",
    passExample: "References available on request",
    failExample: "Dr J. Brown, j.brown@uni.ac.uk, 07700 900456",
    citations: [NCS_SECTIONS, MANCHESTER_CV],
  },

  {
    id: "G-39", sectors: "all", dimension: "uk", check: "code", checker: "photo_present", severity: "minor", evidence: "B",
    statement: "Remove the photo — UK employers don't expect one and it takes space from your evidence.",
    sectorAdjust: {
      finance_banking: { severity: "major", citations: [F_S1] },
      consulting: { severity: "major", citations: [F_S2] },
      quant_trading: { severity: "major", citations: [F_S1] },
    },
    citations: [MANCHESTER_CV, F_S11, GEMM_2019],
  },

  // ---------- D. Personal statement / profile ----------
  {
    id: "G-19", sectors: "all", dimension: "clarity", check: "code", checker: "summary_length", severity: "minor", evidence: "B",
    statement: PROFILE_COPY,
    citations: [PROSPECTS_PERSONAL_STATEMENT, TJ_PERSONAL_STATEMENTS, MANCHESTER_CV],
  },

  // ---------- E. Bullets, impact and language ----------
  {
    id: "G-20", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "D",
    statement: "Start each bullet with a strong action verb (\"Led\", \"Built\", \"Analysed\"), not a duty phrase like \"Responsible for\" or \"Helped with\".",
    llmGuidance: "Do at least 80% of experience and activity bullets start with an action verb rather than a duty phrase such as 'Responsible for' or 'Helped with'? Partial: 50–79% of bullets start with an action verb.",
    passExample: "Organised a charity quiz for 120 guests, raising £1,450",
    failExample: "Responsible for organising events for the society",
    allowPartial: true,
    citations: [PROSPECTS_CV, MANCHESTER_CV, KNOUSE_1994, T_S1, T_S4],
  },
  {
    id: "G-21", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "C",
    statement: "Make bullets show what happened because of you: action, context, then result. Results can be scale, outcome, recognition or feedback, not only money.",
    llmGuidance: "Do most experience and activity bullets state a result of the candidate's own action (scale, outcome, recognition or feedback), not just a duty?",
    passExample: "Sold 46 tickets, just under a third of the total, by pitching to three course societies",
    failExample: "Helped with ticket sales for the summer ball",
    citations: [TJ_6STEP, BRIGHT_INTERNSHIP_CV],
  },
  {
    id: "G-22", sectors: "all", dimension: "impact", check: "code", checker: "quantified_bullets", params: { threshold: 0.4 }, severity: "major", evidence: "D",
    statement: "Quantify where it's true: aim for about 4 in 10 experience and project bullets to include a real number (%, £, counts, time saved, users, team size) — 2 in 10 is fine in first year. Dates don't count, and never invent figures.",
    yearAdjust: { "1st": { threshold: 0.2 }, final: { threshold: 0.5 }, masters: { threshold: 0.5 } },
    citations: [TJ_6STEP, T_S3, PROSPECTS_CV, T_S1, T_S4],
  },
  {
    id: "G-23", sectors: "all", dimension: "clarity", check: "code", checker: "bullet_length", severity: "minor", evidence: "C",
    statement: "Keep bullets to one or two lines (about 12–30 words), with roughly 2–5 bullets per role and no long paragraphs.",
    citations: [NCS_SECTIONS, T_S6],
  },
  {
    id: "G-24", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "D",
    statement: `Use present tense for current roles and past tense for finished ones, and don't use "I" or "my" in your bullets. ${FIRST_PERSON.note}`,
    llmGuidance: "In experience, project and activity bullets only: are they in the right tense (present for current roles, past for finished ones) and free of first-person pronouns ('I', 'my', 'me')? Ignore the profile: it may be written in the first or third person, as long as it is consistent.",
    passExample: "Tutor GCSE maths to 4 students weekly (current role)",
    failExample: "I was responsible for tutoring my students in maths",
    citations: [NCS_SECTIONS, PROSPECTS_PERSONAL_STATEMENT],
  },
  {
    id: "G-25", sectors: "all", dimension: "clarity", check: "code", checker: "spelling", severity: "major", evidence: "B",
    statement: "Aim for zero spelling and grammar errors. In a Belgian experiment, recruiters were about 7 percentage points less likely to invite a graduate with two spelling errors, and about 19 points less with five.",
    sectorAdjust: {
      marketing_growth: { severity: "critical", statement: "Zero tolerance for typos: in marketing and PR the role is communication, so spelling and grammar errors count heavily against you.", citations: [T_S11] },
      finance_banking: { severity: "critical", statement: "Aim for zero typos and no sloppy formatting. These jobs produce client documents, and some employers discard CVs that contain errors.", citations: [F_S1] },
      consulting: { severity: "critical", statement: "Aim for zero typos and no sloppy formatting. These jobs produce client documents, and some employers discard CVs that contain errors.", citations: [F_S2] },
    },
    citations: [STERKENS_2023, VAN_INWEGEN_2025],
  },
  {
    id: "G-26", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "D",
    statement: "Stick to UK English for UK roles (\"analysed\", \"organised\", \"programme\" for a scheme) and use it consistently. \"Program\" is correct British English for software.",
    llmGuidance: "Does the CV use UK English spellings consistently, with no mix of UK and US variants? 'Program' for software and Oxford -ize spellings used consistently are acceptable British usage; don't flag them.",
    passExample: "Analysed survey data and organised the summer programme; wrote a Python program to clean it",
    failExample: "Analysed survey data and organized the color-coded rota",
    citations: [STERKENS_2023],
  },
  {
    id: "G-27", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "B",
    statement: "Keep formatting consistent: one date format, one bullet style, matching headings, dates aligned (UK sources suggest the end of the line), and no more than two fonts.",
    llmGuidance: "Is formatting consistent throughout: one date format, one bullet style and matching heading styles?",
    passExample: "Every entry uses 'Sep 2024 – Jun 2025' and the same bullet glyph",
    failExample: "'Sep 2024 – Jun 2025' in one entry and '09/2023-06/2024' in the next",
    citations: [GH_PARSE, NCS_SECTIONS, SHEFFIELD_ATS],
  },
  {
    id: "G-29", sectors: "all", dimension: "impact", check: "llm", severity: "minor", evidence: "D",
    statement: "Avoid unsupported buzzwords. Every soft skill you claim (\"team player\", \"detail-oriented\") should be backed by an example somewhere on the CV.",
    llmGuidance: "Is every soft-skill claim on the CV (e.g. 'team player', 'detail-oriented') backed by a concrete example elsewhere on the CV?",
    passExample: "'Strong teamwork' is backed by: 'Co-led a 5-person hackathon team to 2nd place'",
    failExample: "Skills: team player, detail-oriented, multitasker — with no example anywhere",
    citations: [PROSPECTS_CV, TJ_PERSONAL_STATEMENTS],
  },

  // ---------- F. Relevance and keywords ----------
  {
    id: "G-30", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Tailor your CV to the job: cover the advert's must-have skills using the employer's own wording, inside your bullets as well as your skills list.",
    llmGuidance: "Does the CV cover at least half of the job description's must-have skills or qualifications, with matches shown inside bullets rather than only in the skills list?",
    needs: ["jd"],
    passExample: "JD asks for SQL and stakeholder work; bullet: 'Wrote SQL queries to build a weekly sales report for 3 store managers'",
    failExample: "JD asks for SQL and stakeholder work; SQL appears only in the skills list and nothing mentions stakeholders",
    citations: [GH_SEARCH, MANCHESTER_CV, TJ_6STEP, T_S12, T_S14],
  },
  {
    id: "G-31", sectors: "all", dimension: "relevance", check: "code", checker: "skills_count", severity: "minor", evidence: "B",
    statement: "Make your skills section specific and grouped (Technical: Python, SQL; Languages: Spanish (C1); Tools: Excel (pivot tables)), with proficiency in words, not bars or stars.",
    citations: [T_S3, WD_PARSE],
  },

  // ---------- G. Education and grades (UK specifics) ----------
  {
    id: "G-32", sectors: "all", dimension: "uk", check: "code", checker: "uk_grades", severity: "major", evidence: "B",
    statement: `Show your degree result or your current average or predicted grade, in your university's own format — including a 2:2, a Master's Merit or an international GPA (name the scale, e.g. \"GPA 3.7/4.0\"). One in five large UK employers accept a 2:2, and a missing grade is usually read as a low one. A higher grade earns no extra points here. ${GRADE_POLICY.cv.circumstances}`,
    llmGuidance: "Code: passes on any stated result or average (UK classification, Master's Distinction/Merit, GPA or CGPA with a scale, IB points, a year average). Never gives extra credit for a higher grade, and never fails an honest 2:2 or Third.",
    sectorAdjust: {
      finance_banking: {
        severity: "critical",
        statement: `State your degree result or current average, or a predicted grade marked with an asterisk — application forms ask anyway, so leaving it off only looks like a gap. ${GRADE_POLICY.cv.circumstances} A First earns no extra points here, but strong module marks still help recruiters.`,
        citations: [F_S1, F_S32],
      },
      consulting: {
        statement: "State your degree result or current average, or a predicted grade marked with an asterisk. BCG UK asks for a 2:1 or equivalent and Bain wants detail on grades; some Big 4 firms have dropped grade requirements. A higher grade earns no extra points here.",
        citations: [F_S24, F_S23, F_S29, F_S2],
      },
    },
    citations: [F_S32, TJ_CV_FAQ_2026, PROSPECTS_CV, M_QUADLIN_GPA, M_BRAUN_AUDIT, THE_ISE_2022],
  },
  {
    id: "G-33", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "B",
    statement: "Include A-levels (or IB, Highers, BTEC or your country's equivalent) with grades. Summarise GCSEs in one line, and name the system for international qualifications.",
    llmGuidance: "Are pre-university qualifications (A-levels, IB, Highers, BTEC or a named international equivalent) listed with grades? Never score employer or university brand.",
    passExample: "A-levels: Maths A*, Economics A, History A",
    failExample: "A-levels: Maths, Economics, History",
    citations: [MANCHESTER_CV, F_S32],
  },

  // ---------- H. Extracurriculars, interests, links ----------
  {
    id: "G-34", sectors: "all", dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Include extracurriculars (societies, sport, volunteering, part-time jobs, hackathons) written like jobs, with role, dates and 1–3 achievements, leadership first. Make interests specific (\"Half-marathon runner, 1:42 PB\"); hobbies are a minor signal, and class-coded hobbies (e.g. sailing, polo) are never rewarded.",
    llmGuidance: "Does the CV include at least one extracurricular or activity entry (society, sport, volunteering, hackathon) written with a role and at least one achievement? Never reward class-coded hobbies (e.g. sailing, polo, skiing) over other activities.",
    passExample: "Treasurer, Netball Club (Oct 2024 – Present): cut kit costs 20% by switching supplier",
    failExample: "Interests: reading, travelling, socialising",
    citations: [COLE_2007, TJ_6STEP, T_S3, M_RIVERA_TILCSIK],
  },

  // ---------- I. Integrity and authenticity ----------
  {
    id: "G-36", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Keep everything truthful and specific to you: no invented metrics and no generic boilerplate. Some employers limit how you may use AI on applications, so check each firm's policy.",
    llmGuidance: "Are all claims and metrics specific to the candidate and plausible, with no interchangeable boilerplate or internally inconsistent details (e.g. implausibly overlapping dates)?",
    passExample: "Cut stock-count time from 3 hours to 1 hour by building a barcode spreadsheet",
    failExample: "Drove 300% growth in synergistic outcomes across dynamic cross-functional initiatives",
    citations: [ISE_AI_2026, PUBLICTECH_CIVIL_SERVICE_AI, GRADCRACKER_EXPERIAN],
  },


];
