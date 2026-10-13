import type { CvRule } from "../types";
import {
  GH_PARSE, WD_PARSE, GH_FILETYPES, ICIMS_MANUAL, TEXTKERNEL_COLUMNS, HRDIVE_LADDERS_2018, LEVER_PARSING,
  SHEFFIELD_ATS, GH_SEARCH, NOTTINGHAM_ATS, PROSPECTS_CV, MANCHESTER_CV, NCS_SECTIONS, TJ_6STEP, LADDERS_2012,
  TJ_PROPERTY_CV, EQUALITY_ACT, ACAS_AGE, TJ_PERSONAL_STATEMENTS, PROSPECTS_PERSONAL_STATEMENT, KNOUSE_1994,
  BRIGHT_INTERNSHIP_CV, STERKENS_2023, VAN_INWEGEN_2025, THE_ISE_2024, COLE_2007, ISE_AI_2026,
  PUBLICTECH_CIVIL_SERVICE_AI, GRADCRACKER_EXPERIAN, GEMM_2019,
  T_S1, T_S2, T_S3, T_S4, T_S5, T_S6, T_S7_CAREER, T_S7_EXPERIAN, T_S8_TECH, T_S8_INTERN, T_S11, T_S12, T_S14, T_S15,
  M_QUADLIN_GPA,
  M_BRAUN_AUDIT,
  M_RIVERA_TILCSIK,
} from "./sources";

/**
 * Cross-industry rules.
 * G-01…G-37: docs/research/cv-rules-general.md §2 (strong→A, moderate→B, weak→C, consensus-only→D).
 * GEN-01…GEN-12: docs/research/cv-rules-tech-product.md §1 (already graded A–D). The finance doc says
 * GEN is inherited by finance/quant/consulting too, so both sets apply to every sector.
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
    id: "G-03", sectors: "all", dimension: "ats", check: "llm", severity: "critical", evidence: "B",
    statement: "Put your name and contact details in the main body of the page, not in a header, footer or text box — some ATS can't create your profile without them.",
    llmGuidance: "Do the candidate's name, email and phone number appear in the main body text rather than only in a page header, footer or text box?",
    passExample: "Priya Shah · priya.shah@gmail.com · 07700 900123 · London (first lines of the body)",
    failExample: "Contact details appear only in a repeated page-footer line: 'p.shah@gmail.com | Page 1 of 2'",
    citations: [GH_PARSE, ICIMS_MANUAL],
  },
  {
    id: "G-04", sectors: "all", dimension: "ats", check: "llm", severity: "major", evidence: "A",
    statement: "Use a single-column layout and don't put content in tables, text boxes or graphics. Columns and tables are a known cause of parse failures.",
    llmGuidance: "Does the extracted text read in a single-column order, with no signs of tables, sidebars or text boxes holding core content?",
    passExample: "Education, Experience and Skills follow one another in a single reading order",
    failExample: "'Python ★★★★ Barista, Costa Coffee Jun 2024 SQL ★★★' — a skills sidebar interleaved with experience lines",
    citations: [GH_PARSE, TEXTKERNEL_COLUMNS, HRDIVE_LADDERS_2018],
  },
  {
    id: "G-05", sectors: "all", dimension: "ats", check: "code", checker: "skill_rating_glyphs", severity: "major", evidence: "B",
    statement: "Don't use skill bars, star ratings, icons in place of words, or images of text. Parsers can't read them; write proficiency in words instead.",
    citations: [WD_PARSE, LEVER_PARSING],
  },
  {
    id: "G-06", sectors: "all", dimension: "ats", check: "code", checker: "section_headings", severity: "major", evidence: "A",
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
  {
    id: "G-09", sectors: "all", dimension: "ats", check: "llm", severity: "critical", evidence: "D",
    statement: "Never hide keywords in white or tiny text, or paste in blocks from the job description. Recruiters see the parsed text, so hidden keywords get exposed, not rewarded.",
    llmGuidance: "Is the CV free of hidden or stuffed keyword blocks, such as an uncontextualised list of job-advert terms or a passage of 25+ words copied from a job description?",
    passExample: "Skills: Python, SQL, Tableau (used in the projects below)",
    failExample: "Keywords: stakeholder management agile synergy leadership Python SQL Excel communication teamwork",
    citations: [GH_SEARCH, NOTTINGHAM_ATS],
  },
  {
    id: "G-10", sectors: "all", dimension: "ats", check: "llm", severity: "minor", evidence: "D",
    statement: "Give the file a professional name like Firstname-Lastname-CV.pdf, not CV_final_v3(2).pdf.",
    llmGuidance: "Does the file name contain the candidate's name and no draft markers such as 'final', 'v2', 'copy' or '(1)'? (Not applicable if the file name is unknown.)",
    passExample: "Priya-Shah-CV.pdf",
    failExample: "CV_final_v3(2).pdf",
    citations: [PROSPECTS_CV],
  },

  // ---------- B. Length and structure ----------
  {
    id: "G-11", sectors: "all", dimension: "clarity", check: "code", checker: "page_count", params: { maxPages: 2 }, severity: "major", evidence: "D",
    statement: "Keep your CV to at most two A4 pages; one page is the usual default for students with limited experience. Some sectors, like investment banking, expect exactly one.",
    citations: [PROSPECTS_CV, MANCHESTER_CV],
  },
  {
    id: "G-12", sectors: "all", dimension: "clarity", check: "llm", severity: "major", evidence: "D",
    statement: "List entries in reverse chronological order inside each section, most recent first.",
    llmGuidance: "Within every section, are entries listed most recent first (with 'Present' or an expected date counting as the latest)?",
    passExample: "Experience: Jun 2025 – Present, then Jul 2024 – Sep 2024",
    failExample: "Experience: Jul 2022 – Aug 2022 listed above Jun 2025 – Present",
    citations: [PROSPECTS_CV, NCS_SECTIONS],
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
    citations: [LADDERS_2012, LEVER_PARSING],
  },
  {
    id: "G-15", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "D",
    statement: "Don't title the document \"Curriculum Vitae\" or \"CV\" — your name is the title.",
    llmGuidance: "Is the document titled with the candidate's name rather than 'Curriculum Vitae', 'CV' or 'Resume'?",
    passExample: "PRIYA SHAH (first line)",
    failExample: "CURRICULUM VITAE (first line)",
    citations: [PROSPECTS_CV, TJ_PROPERTY_CV],
  },

  // ---------- C. Contact details and UK personal-data conventions ----------
  {
    id: "G-16", sectors: "all", dimension: "uk", check: "code", checker: "contact_present", severity: "critical", evidence: "D",
    statement: "Include your full name, mobile number, a professional email and your town or city. A LinkedIn URL is recommended; a full home address isn't needed.",
    citations: [NCS_SECTIONS, PROSPECTS_CV],
  },
  {
    id: "G-17", sectors: "all", dimension: "uk", check: "code", checker: "uk_personal_details", severity: "major", evidence: "B",
    statement: "Leave out your photo, date of birth or age, marital status, gender and religion — it's UK convention and protects you. Nationality is optional; a right-to-work line is fine.",
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

  // ---------- D. Personal statement / profile ----------
  {
    id: "G-19", sectors: "all", dimension: "relevance", check: "llm", severity: "minor", evidence: "D",
    statement: "A profile is optional. If you include one, keep it under about 150 words (3–6 lines), specific to the role, and free of clichés like \"hard-working team player\".",
    llmGuidance: "If a profile is present, is it 150 words or fewer, specific to the target role or sector, and free of stock clichés such as 'hard-working team player'? (Not applicable if there is no profile.)",
    passExample: "Second-year Economics student targeting consulting; led a 6-person case team to the UCL Case Competition final.",
    failExample: "Hard-working, passionate team player with excellent communication skills seeking a challenging role.",
    citations: [TJ_PERSONAL_STATEMENTS, PROSPECTS_PERSONAL_STATEMENT, MANCHESTER_CV],
  },

  // ---------- E. Bullets, impact and language ----------
  {
    id: "G-20", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "D",
    statement: "Start each bullet with a strong action verb (\"Led\", \"Built\", \"Analysed\"), not a duty phrase like \"Responsible for\" or \"Helped with\".",
    llmGuidance: "Do at least 80% of experience and activity bullets start with an action verb rather than a duty phrase such as 'Responsible for' or 'Helped with'? Partial: 50–79% of bullets start with an action verb.",
    passExample: "Organised a charity quiz for 120 guests, raising £1,450",
    failExample: "Responsible for organising events for the society",
    allowPartial: true,
    citations: [PROSPECTS_CV, MANCHESTER_CV, KNOUSE_1994],
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
    statement: "Quantify where it's true: aim for at least 4 in 10 experience and project bullets to include a number (%, £, counts, time saved, users, ranking, team size). Never invent figures.",
    citations: [TJ_6STEP, T_S3, PROSPECTS_CV],
  },
  {
    id: "G-23", sectors: "all", dimension: "clarity", check: "code", checker: "bullet_length", severity: "minor", evidence: "C",
    statement: "Keep bullets to one or two lines (about 12–30 words), with roughly 2–5 bullets per role and no long paragraphs.",
    citations: [HRDIVE_LADDERS_2018, NCS_SECTIONS],
  },
  {
    id: "G-24", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "D",
    statement: "Use present tense for current roles and past tense for finished ones, and don't use \"I\" or \"my\" in bullets.",
    llmGuidance: "Are bullets in the right tense (present for current roles, past for finished ones) and free of first-person pronouns ('I', 'my', 'me')?",
    passExample: "Tutor GCSE maths to 4 students weekly (current role)",
    failExample: "I was responsible for tutoring my students in maths",
    citations: [NCS_SECTIONS, PROSPECTS_PERSONAL_STATEMENT],
  },
  {
    id: "G-25", sectors: "all", dimension: "clarity", check: "code", checker: "spelling", severity: "critical", evidence: "A",
    statement: "Have zero spelling and grammar errors. In a study of 445 recruiters, two typos cut interview chances by about 7 points and five typos by about 19.",
    llmGuidance: "List genuine en-GB spelling and grammar errors only; ignore names, company names and technical jargon. 3+ errors = critical, 1–2 = major.",
    citations: [STERKENS_2023, VAN_INWEGEN_2025],
  },
  {
    id: "G-26", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "D",
    statement: "Stick to UK English for UK roles (\"analysed\", \"organised\", \"programme\") and use it consistently.",
    llmGuidance: "Does the CV use UK English spellings consistently, with no mix of UK and US variants?",
    passExample: "Analysed survey data and organised the programme",
    failExample: "Analysed survey data and organized the program",
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
    id: "G-28", sectors: "all", dimension: "clarity", check: "llm", severity: "major", evidence: "D",
    statement: "Use a standard font (Arial, Calibri, Garamond, Georgia and similar) at 10–12pt for body text, with margins around 1.5–2.5 cm and enough white space.",
    llmGuidance: "Is the body text in a standard font at 9.5pt or larger, with no novelty fonts? (Not applicable if font metadata is unavailable.)",
    passExample: "Body text in Calibri 11pt",
    failExample: "Body text in Comic Sans 9pt",
    citations: [PROSPECTS_CV, NCS_SECTIONS],
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
    llmGuidance: "Does the CV cover at least half of the job description's must-have skills or qualifications, with matches shown inside bullets rather than only in the skills list? (Without a job description, judge against the chosen sector profile.)",
    passExample: "JD asks for SQL and stakeholder work; bullet: 'Wrote SQL queries to build a weekly sales report for 3 store managers'",
    failExample: "JD asks for SQL and stakeholder work; SQL appears only in the skills list and nothing mentions stakeholders",
    citations: [GH_SEARCH, MANCHESTER_CV, TJ_6STEP],
  },
  {
    id: "G-31", sectors: "all", dimension: "relevance", check: "code", checker: "skills_count", severity: "minor", evidence: "B",
    statement: "Make your skills section specific and grouped (Technical: Python, SQL; Languages: Spanish (C1); Tools: Excel (pivot tables)), with proficiency in words, not bars or stars.",
    llmGuidance: "Also check the items are relevant to the target role and not generic ('Microsoft Office', 'communication'). A missing skills section is major for technical or analytical roles; a bloated generic list is minor.",
    citations: [T_S3, WD_PARSE],
  },

  // ---------- G. Education and grades (UK specifics) ----------
  {
    id: "G-32", sectors: "all", dimension: "uk", check: "code", checker: "uk_grades", severity: "major", evidence: "B",
    statement: "Your Education entry needs the institution, degree and dates with expected graduation. State your grade if it's a 2:1 or above, or predicted 2:1 (\"On track for a 2:1\") — a higher grade earns no extra credit.",
    llmGuidance: "Pass when a degree grade of 2:1 or above, or a predicted 2:1, is stated. Never give extra credit for a higher grade (a First, a higher percentage or a rank earns nothing more). Never score employer or university brand.",
    citations: [THE_ISE_2024, COLE_2007, PROSPECTS_CV, M_QUADLIN_GPA, M_BRAUN_AUDIT],
  },
  {
    id: "G-33", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "B",
    statement: "Include A-levels (or IB, Highers, BTEC or your country's equivalent) with grades. Summarise GCSEs in one line, and name the system for international qualifications.",
    llmGuidance: "Are pre-university qualifications (A-levels, IB, Highers, BTEC or a named international equivalent) listed with grades? Never score employer or university brand.",
    passExample: "A-levels: Maths A*, Economics A, History A",
    failExample: "A-levels: Maths, Economics, History",
    citations: [MANCHESTER_CV, THE_ISE_2024],
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
  {
    id: "G-35", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "D",
    statement: "Make links live, relevant and visible as plain text (linkedin.com/in/yourname; GitHub or portfolio for technical or creative roles), and keep linked work current.",
    llmGuidance: "Are all links shown as readable, well-formed URLs (e.g. linkedin.com/in/name), rather than icons or broken text?",
    passExample: "linkedin.com/in/priyashah · github.com/priyashah",
    failExample: "[LinkedIn icon] [GitHub icon] with no visible URL",
    citations: [NCS_SECTIONS, T_S3],
  },

  // ---------- I. Integrity and authenticity ----------
  {
    id: "G-36", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Keep everything truthful and specific to you: no invented metrics and no generic AI boilerplate. AI can polish wording, but not make things up.",
    llmGuidance: "Are all claims and metrics specific to the candidate and plausible, with no interchangeable boilerplate or internally inconsistent details (e.g. implausibly overlapping dates)?",
    passExample: "Cut stock-count time from 3 hours to 1 hour by building a barcode spreadsheet",
    failExample: "Drove 300% growth in synergistic outcomes across dynamic cross-functional initiatives",
    citations: [ISE_AI_2026, PUBLICTECH_CIVIL_SERVICE_AI, GRADCRACKER_EXPERIAN],
  },

  // ---------- J. Fairness guardrail (product rule, not a CV rule) ----------
  {
    id: "G-37", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "A",
    statement: "Placed never rewards or penalises who you are: your name, ethnicity, gender, age, nationality, disability, school or university prestige, or postcode don't change your score.",
    llmGuidance: "Was this score produced without considering identity signals (name, ethnicity, gender, age, nationality, disability, school or university prestige, postcode)? Always answer yes; this is a system guardrail. Never score employer or university brand.",
    passExample: "Placeholders such as [UNIVERSITY] are treated as neutral",
    failExample: "A bullet is judged stronger because the university is famous",
    citations: [GEMM_2019, EQUALITY_ACT],
  },

  // ---------- GEN: cross-sector baseline from cv-rules-tech-product.md §1 ----------
  {
    id: "GEN-01", sectors: "all", dimension: "uk", check: "code", checker: "uk_personal_details", severity: "major", evidence: "A",
    statement: "Put contact details first — name, phone, personal email, LinkedIn, plus GitHub or portfolio where relevant — and leave out photo, date of birth, gender, ethnicity and marital status.",
    llmGuidance: "Missing email or phone is critical; a photo or date of birth is major.",
    citations: [T_S3, T_S5],
  },
  {
    id: "GEN-02", sectors: "all", dimension: "ats", check: "llm", severity: "major", evidence: "B",
    statement: "Use a single-column, text-based layout with standard headings (Education, Experience, Projects, Skills). Avoid tables, text boxes, skill bars and contact details in headers or footers.",
    llmGuidance: "Does the extracted text look complete and single-column, with standard headings (Education, Experience, Projects, Skills) and no signs of tables, text boxes or skill bars?",
    passExample: "EDUCATION / EXPERIENCE / PROJECTS / SKILLS in one clean reading order",
    failExample: "'My Journey' heading, with skills apparently held in an image the text layer can't read",
    citations: [T_S14, T_S15],
  },
  {
    id: "GEN-03", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Write achievement-led bullets, not duty lists: start each with an action verb and state the outcome.",
    llmGuidance: "Do most experience bullets start with an action verb and state an outcome?",
    passExample: "Built a rota spreadsheet that cut weekly scheduling time by 2 hours",
    failExample: "Duties included making rotas and answering emails",
    citations: [T_S1, T_S4, T_S8_INTERN, T_S8_TECH],
  },
  {
    id: "GEN-04", sectors: "all", dimension: "impact", check: "code", checker: "quantified_bullets", params: { threshold: 0.4 }, severity: "major", evidence: "C",
    statement: "Quantify wherever it's honest — %, £, users, time saved, ranking, dataset size. Aim for at least 40% of experience and project bullets (20% in first year, 50% in final year).",
    yearAdjust: { "1st": { threshold: 0.2 }, final: { threshold: 0.5 }, masters: { threshold: 0.5 } },
    citations: [T_S1, T_S4, T_S2],
  },
  {
    id: "GEN-05", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Tailor each CV: mirror the job advert's essential skills and wording, and back the keywords up with evidence rather than just listing them.",
    llmGuidance: "Are the job advert's essential skills both present and evidenced in bullets (not only listed)? (Without a job description, judge against the chosen sector profile.)",
    passExample: "Advert asks for Python; bullet: 'Wrote a Python script to clean 40k survey rows'",
    failExample: "Advert asks for Python; it appears only in the skills list",
    citations: [T_S3, T_S12, T_S14],
  },
  {
    id: "GEN-06", sectors: "all", dimension: "clarity", check: "code", checker: "spelling", severity: "major", evidence: "B",
    statement: "Have zero spelling or grammar errors. In marketing this is critical, because the CV is your writing sample.",
    llmGuidance: "Spell-check with a technical-term allowlist; confirm grammar errors. Major everywhere; marketing roles treat errors as critical (see MKT-07).",
    citations: [T_S3, T_S11, T_S8_INTERN, T_S8_TECH],
  },
  {
    id: "GEN-07", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Don't exaggerate: every skill you list should be one you can defend at interview, and inconsistencies get spotted.",
    llmGuidance: "Is every listed skill supported by evidence somewhere else on the CV?",
    passExample: "Skills: SQL — Experience: 'Queried 2M-row sales table in SQL to find top-selling lines'",
    failExample: "Skills: SQL, Rust, Kubernetes, Tableau — none appear anywhere else",
    citations: [T_S3],
  },
  {
    id: "GEN-08", sectors: "all", dimension: "clarity", check: "code", checker: "summary_length", severity: "minor", evidence: "C",
    statement: "Objectives and generic summaries add little. If you include a profile, keep it to 2–3 lines and make it specific to the role.",
    llmGuidance: "Also flag buzzword density in the profile ('passionate', 'hard-working', 'team player', 'synergy') and check it is role-specific.",
    citations: [T_S6, T_S7_CAREER, T_S7_EXPERIAN],
  },
  {
    id: "GEN-09", sectors: "all", dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "AI-written boilerplate reads as inauthentic. Use AI to help with structure, not to write your content.",
    llmGuidance: "Is the CV free of generic AI-style phrasing (e.g. 'leveraged', 'spearheaded' with vague objects, 'in today's fast-paced world')?",
    passExample: "Wrote the society's first sponsorship pack and secured £600 from two local cafés",
    failExample: "Spearheaded dynamic initiatives in today's fast-paced environment",
    citations: [T_S7_EXPERIAN],
  },
  {
    id: "GEN-10", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "A",
    statement: "List entries in reverse chronological order within each section.",
    llmGuidance: "Are entries in each section in reverse chronological order (most recent first)?",
    passExample: "Projects: 2025 project listed above 2024 project",
    failExample: "Experience: 2022 summer job listed above a 2025 internship",
    citations: [T_S5, T_S11],
  },
  {
    id: "GEN-11", sectors: "all", dimension: "ats", check: "llm", severity: "minor", evidence: "B",
    statement: "Send your CV as a PDF unless the employer asks for a different format.",
    llmGuidance: "Is the CV a PDF, or in the format the employer asked for? (Not applicable if the file type is unknown.)",
    passExample: "Priya-Shah-CV.pdf",
    failExample: "CV uploaded as a .pages file",
    citations: [T_S2],
  },
  {
    id: "GEN-12", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "D",
    statement: "Write dates consistently (e.g. \"Sep 2024 – Jun 2025\") and show your expected graduation date.",
    llmGuidance: "Is an expected or actual graduation date shown, and are dates written in one consistent format?",
    passExample: "BSc Computer Science, expected Jun 2027; all dates as 'Mon YYYY'",
    failExample: "BSc Computer Science (no graduation date), with dates as '2024' and '09/2025'",
    citations: [],
  },
];
