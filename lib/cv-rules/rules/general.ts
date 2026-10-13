import type { CvRule } from "../types";
import {
  GH_PARSE, WD_PARSE, GH_FILETYPES, ICIMS_MANUAL, TEXTKERNEL_COLUMNS, HRDIVE_LADDERS_2018, LEVER_PARSING,
  SHEFFIELD_ATS, GH_SEARCH, NOTTINGHAM_ATS, PROSPECTS_CV, MANCHESTER_CV, NCS_SECTIONS, TJ_6STEP, LADDERS_2012,
  TJ_PROPERTY_CV, EQUALITY_ACT, ACAS_AGE, TJ_PERSONAL_STATEMENTS, PROSPECTS_PERSONAL_STATEMENT, KNOUSE_1994,
  BRIGHT_INTERNSHIP_CV, STERKENS_2023, VAN_INWEGEN_2025, THE_ISE_2024, COLE_2007, ISE_AI_2026,
  PUBLICTECH_CIVIL_SERVICE_AI, GRADCRACKER_EXPERIAN, GEMM_2019,
  T_S1, T_S2, T_S3, T_S4, T_S5, T_S6, T_S7_CAREER, T_S7_EXPERIAN, T_S8_TECH, T_S8_INTERN, T_S11, T_S12, T_S14, T_S15,
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
    llmGuidance: "Look for signs that the name, email or phone sit only in a page header/footer or a text box: contact details repeated on every page, appearing detached from the body text, or missing from the main text but present in a margin line. pass = name and contact details in the body; fail = found only in a header/footer/text box. Critical for DOCX (iCIMS creates no candidate profile without a parsed name), major for PDF.",
    citations: [GH_PARSE, ICIMS_MANUAL],
  },
  {
    id: "G-04", sectors: "all", dimension: "ats", check: "llm", severity: "major", evidence: "A",
    statement: "Use a single-column layout and don't put content in tables, text boxes or graphics. Columns and tables are a known cause of parse failures.",
    llmGuidance: "Check for signs of a multi-column or table layout in the extracted text: interleaved lines from two topics, a sidebar of skills/contact mixed into experience lines, table-cell fragments, or content apparently missing because it was in a graphic. pass = clean single-column reading order; partial = minor sidebar; fail = clearly two-column or table-based core content.",
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
    llmGuidance: "Flag abbreviated job titles or organisation names (Sr., Mgr, Exec, Assoc., unexplained acronyms for employers or societies). pass = titles and organisations written in full or acronyms expanded once; partial = one or two abbreviations; fail = abbreviations throughout.",
    citations: [GH_PARSE, SHEFFIELD_ATS],
  },
  {
    id: "G-08", sectors: "all", dimension: "ats", check: "llm", severity: "major", evidence: "A",
    statement: "Don't space out the letters of your name or headings (\"J O H N  S M I T H\") — it breaks name parsing.",
    llmGuidance: "Look for single characters separated by spaces, four or more in a row, in the name or section headings, or other decorative typography in the extracted text. pass = none; fail = spaced-out letters in the name or headings.",
    citations: [GH_PARSE],
  },
  {
    id: "G-09", sectors: "all", dimension: "ats", check: "llm", severity: "critical", evidence: "D",
    statement: "Never hide keywords in white or tiny text, or paste in blocks from the job description. Recruiters see the parsed text, so hidden keywords get exposed, not rewarded.",
    llmGuidance: "Flag keyword blocks with no context, long passages copied verbatim from a job description (more than ~25 consecutive words), or text that looks like a hidden keyword list (unrelated terms run together). pass = none; fail = any hidden or stuffed keyword block.",
    citations: [GH_SEARCH, NOTTINGHAM_ATS],
  },
  {
    id: "G-10", sectors: "all", dimension: "ats", check: "llm", severity: "minor", evidence: "D",
    statement: "Give the file a professional name like Firstname-Lastname-CV.pdf, not CV_final_v3(2).pdf.",
    llmGuidance: "If the file name is available, check it contains the candidate's name and no draft markers (final, v2, copy, (1), new). pass = name-based; partial = generic 'CV.pdf'; fail = draft-style name. If the file name is unknown, return na.",
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
    llmGuidance: "Within each section, parse the entry dates and check they run from most recent to oldest (\"Present\" or \"Expected 2027\" counts as the latest). pass = every section in order; partial = one entry out of order; fail = sections ordered oldest first.",
    citations: [PROSPECTS_CV, NCS_SECTIONS],
  },
  {
    id: "G-13", sectors: "all", dimension: "relevance", check: "llm", severity: "minor", evidence: "D",
    statement: "Order your sections: contact details, optional profile, Education, Experience, Projects/Activities, Skills, Interests. Only put Experience above Education if you have substantial relevant experience.",
    llmGuidance: "Check the section order. Education should come first for most students. If Experience comes before Education, decide whether the experience is substantial and relevant (e.g. a 12-month placement or several relevant internships): if yes, pass; if not, partial. Order is flexible, so never fail unless the order hides the strongest evidence at the bottom.",
    citations: [NCS_SECTIONS, PROSPECTS_CV, TJ_6STEP],
  },
  {
    id: "G-14", sectors: "all", dimension: "uk", check: "llm", severity: "major", evidence: "C",
    statement: "Every experience, education and project entry needs the organisation, your role or qualification, and start and end dates (month and year).",
    llmGuidance: "For each entry check organisation, role/qualification, and start and end dates with month + year (e.g. 'Sep 2024 – Jun 2025', '09/2024', '2024–Present'). pass = all entries complete; partial = some missing months or one missing field; fail = several entries missing dates or titles.",
    citations: [LADDERS_2012, LEVER_PARSING],
  },
  {
    id: "G-15", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "D",
    statement: "Don't title the document \"Curriculum Vitae\" or \"CV\" — your name is the title.",
    llmGuidance: "Check whether the first line or heading of the document is 'Curriculum Vitae', 'CV' or 'Resume' rather than the candidate's name. pass = name is the title; fail = generic title.",
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
    llmGuidance: "Check for a references section that lists referees' names with phone numbers or email addresses. pass = no references or 'available on request'; fail = referees' personal contact details listed (wasted space and third-party data).",
    citations: [NCS_SECTIONS, MANCHESTER_CV],
  },

  // ---------- D. Personal statement / profile ----------
  {
    id: "G-19", sectors: "all", dimension: "relevance", check: "llm", severity: "minor", evidence: "D",
    statement: "A profile is optional. If you include one, keep it under about 150 words (3–6 lines), specific to the role, and free of clichés like \"hard-working team player\".",
    llmGuidance: "If there is no profile, return na (never penalise a missing profile). If present: count words (>150 = minor issue); flag clichés ('team player', 'hard-working', 'excellent communication skills', 'passionate', 'self-motivated', 'multitasker', 'go-getter', 'think outside the box') and hedging ('trying', 'might', 'maybe'); rate genericness 1–5 ('could this sentence appear on 1,000 other CVs?') and check it names the target sector or role. pass = specific, tailored, ≤150 words; partial = somewhat generic; fail = generic boilerplate.",
    citations: [TJ_PERSONAL_STATEMENTS, PROSPECTS_PERSONAL_STATEMENT, MANCHESTER_CV],
  },

  // ---------- E. Bullets, impact and language ----------
  {
    id: "G-20", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "D",
    statement: "Start each bullet with a strong action verb (\"Led\", \"Built\", \"Analysed\"), not a duty phrase like \"Responsible for\" or \"Helped with\".",
    llmGuidance: "Compute the share of experience/activity bullets whose first word is an action verb; flag weak openers ('Responsible for', 'Duties included', 'Helped with', 'Assisted'). pass = 80%+ start with action verbs; partial = 50–80% (minor); fail = under 50% (major).",
    citations: [PROSPECTS_CV, MANCHESTER_CV, KNOUSE_1994],
  },
  {
    id: "G-21", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "C",
    statement: "Make bullets show what happened because of you: action, context, then result. Results can be scale, outcome, recognition or feedback, not only money.",
    llmGuidance: "Classify each bullet as duty / action without result / action + result. Score the share of bullets with a result (scale, outcome, recognition, feedback, money). Personal contribution in team work must be clear. pass = most bullets have results; partial = some; fail = mostly duties.",
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
    llmGuidance: "Check the first verb of each bullet against the entry's end date (current role → present tense, finished role → past tense) and look for first-person pronouns ('I', 'my', 'me') in bullets. pass = consistent; partial = a few slips; fail = mixed tense or first person throughout.",
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
    llmGuidance: "Flag US spellings (analyzed, organized, program for a scheme, color) in a UK-targeted CV, and any mixing of UK and US variants. pass = consistent UK English; partial = a few US variants; fail = mixed throughout.",
    citations: [STERKENS_2023],
  },
  {
    id: "G-27", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "B",
    statement: "Keep formatting consistent: one date format, one bullet style, matching headings, dates aligned (UK sources suggest the end of the line), and no more than two fonts.",
    llmGuidance: "Check the extracted text for mixed date formats ('Sep 2024', '09/2024', 'September 2024'), mixed bullet glyphs and inconsistent heading styles. pass = consistent; partial = one inconsistency; fail = formats vary widely (parsers also struggle with 'differing formats throughout').",
    citations: [GH_PARSE, NCS_SECTIONS, SHEFFIELD_ATS],
  },
  {
    id: "G-28", sectors: "all", dimension: "clarity", check: "llm", severity: "major", evidence: "D",
    statement: "Use a standard font (Arial, Calibri, Garamond, Georgia and similar) at 10–12pt for body text, with margins around 1.5–2.5 cm and enough white space.",
    llmGuidance: "If font names/sizes are available: body text under 9.5pt = major; a novelty font (Comic Sans, script) = major; margins under 1.27 cm = minor. If typography metadata is unavailable, return na.",
    citations: [PROSPECTS_CV, NCS_SECTIONS],
  },
  {
    id: "G-29", sectors: "all", dimension: "impact", check: "llm", severity: "minor", evidence: "D",
    statement: "Avoid unsupported buzzwords. Every soft skill you claim (\"team player\", \"detail-oriented\") should be backed by an example somewhere on the CV.",
    llmGuidance: "Find soft-skill claims and buzzwords ('team player', 'hard-working', 'detail-oriented', 'multitasker'); for each, check whether a bullet elsewhere demonstrates it. pass = claims are evidenced or absent; partial = some unsupported; fail = a list of unsupported buzzwords.",
    citations: [PROSPECTS_CV, TJ_PERSONAL_STATEMENTS],
  },

  // ---------- F. Relevance and keywords ----------
  {
    id: "G-30", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Tailor your CV to the job: cover the advert's must-have skills using the employer's own wording, inside your bullets as well as your skills list.",
    llmGuidance: "With a job description: extract must-have skills, tools and qualifications, accept semantic equivalents ('stakeholder management' ≈ 'worked with clients'), and measure coverage, counting matches in bullets separately from the skills list. Under 50% must-have coverage = major. Without a JD, judge against the chosen sector profile and label it generic relevance.",
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
    statement: "Your Education entry needs the institution, degree, dates with expected graduation, and a grade: achieved, predicted (\"On track for a 2:1\") or a current average (\"Year 1 average: 68%\").",
    citations: [THE_ISE_2024, COLE_2007, PROSPECTS_CV],
  },
  {
    id: "G-33", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "B",
    statement: "Include A-levels (or IB, Highers, BTEC or your country's equivalent) with grades. Summarise GCSEs in one line, and name the system for international qualifications.",
    llmGuidance: "Look for A-level/IB/Highers/BTEC or named international qualifications with grade tokens (A*, A, B; 7/6/5; 92/100). pass = present with grades; partial = present without grades, or GCSE detail longer than 3 lines; fail = no pre-university qualifications. Sector rules may raise this to major where employers screen on UCAS points.",
    citations: [MANCHESTER_CV, THE_ISE_2024],
  },

  // ---------- H. Extracurriculars, interests, links ----------
  {
    id: "G-34", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Include extracurriculars (societies, sport, volunteering, part-time jobs, hackathons) written like jobs, with role, dates and 1–3 achievements, leadership first. Make interests specific: \"Half-marathon runner, 1:42 PB\", not \"reading, travelling\".",
    llmGuidance: "Check there is an activities/extracurricular section with entries that have roles, dates and achievement bullets, leadership roles first, and that interests are specific and discussable. No experience or activities at all = major; generic interests = minor.",
    citations: [COLE_2007, TJ_6STEP, T_S3],
  },
  {
    id: "G-35", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "D",
    statement: "Make links live, relevant and visible as plain text (linkedin.com/in/yourname; GitHub or portfolio for technical or creative roles), and keep linked work current.",
    llmGuidance: "Extract URLs. Flag links that look broken or malformed (major), icons with no visible URL text (minor), and for technical CVs a GitHub/portfolio that appears stale or empty (minor).",
    citations: [NCS_SECTIONS, T_S3],
  },

  // ---------- I. Integrity and authenticity ----------
  {
    id: "G-36", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Keep everything truthful and specific to you: no invented metrics and no generic AI boilerplate. AI can polish wording, but not make things up.",
    llmGuidance: "Score genericness, not provenance — never claim to 'detect AI'. Flag interchangeable boilerplate phrasing, internal inconsistencies (implausibly overlapping dates) and metrics with no plausible basis, and ask the user to confirm figures. Suggestions must use placeholders like '[X%]' that the user fills in; never invent numbers.",
    citations: [ISE_AI_2026, PUBLICTECH_CIVIL_SERVICE_AI, GRADCRACKER_EXPERIAN],
  },

  // ---------- J. Fairness guardrail (product rule, not a CV rule) ----------
  {
    id: "G-37", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "A",
    statement: "Placed never rewards or penalises who you are: your name, ethnicity, gender, age, nationality, disability, school or university prestige, or postcode don't change your score.",
    llmGuidance: "System guardrail, not a CV check: strip identity signals (name, ethnicity cues, gender, age, nationality, disability, school/university prestige beyond sector norms, postcode) before scoring and never let them affect any rule. Always return pass for this rule.",
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
    llmGuidance: "Check the extracted text looks complete (no missing blocks that suggest images or text boxes), reads in a single column, and uses standard headings. pass = clean; partial = one issue; fail = multi-column/table layout or core content missing from the text.",
    citations: [T_S14, T_S15],
  },
  {
    id: "GEN-03", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Write achievement-led bullets, not duty lists: start each with an action verb and state the outcome.",
    llmGuidance: "For each experience bullet, check it opens with an action verb and states an outcome (a number or a concrete result). pass = most bullets achievement-led; partial = mixed; fail = mostly duty lists.",
    citations: [T_S1, T_S4, T_S8_INTERN, T_S8_TECH],
  },
  {
    id: "GEN-04", sectors: "all", dimension: "impact", check: "code", checker: "quantified_bullets", params: { threshold: 0.4 }, severity: "major", evidence: "A",
    statement: "Quantify wherever it's honest — %, £, users, time saved, ranking, dataset size. Aim for at least 40% of experience and project bullets (20% in first year, 50% in final year).",
    yearAdjust: { "1st": { threshold: 0.2 }, final: { threshold: 0.5 }, masters: { threshold: 0.5 } },
    citations: [T_S1, T_S4, T_S2],
  },
  {
    id: "GEN-05", sectors: "all", dimension: "relevance", check: "llm", severity: "major", evidence: "A",
    statement: "Tailor each CV: mirror the job advert's essential skills and wording, and back the keywords up with evidence rather than just listing them.",
    llmGuidance: "Measure keyword overlap with the job description (apply synonyms), then check each matched keyword is evidenced in a bullet, not only listed. pass = essentials covered and evidenced; partial = covered but only listed; fail = most essentials missing.",
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
    llmGuidance: "List skills that have no supporting evidence anywhere else in the CV and flag them as 'unevidenced'. pass = skills evidenced; partial = a few unevidenced; fail = most of the skills list unevidenced.",
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
    llmGuidance: "Score genericness and flag high-frequency LLM clichés ('leveraged', 'spearheaded' with vague objects, 'in today's fast-paced…'). pass = specific personal content; partial = some clichés; fail = reads as generic boilerplate (can be major when pervasive).",
    citations: [T_S7_EXPERIAN],
  },
  {
    id: "GEN-10", sectors: "all", dimension: "clarity", check: "llm", severity: "minor", evidence: "A",
    statement: "List entries in reverse chronological order within each section.",
    llmGuidance: "Parse the dates in each section and check they are descending (most recent first). pass = all sections descending; fail = any section out of order.",
    citations: [T_S5, T_S11],
  },
  {
    id: "GEN-11", sectors: "all", dimension: "ats", check: "llm", severity: "minor", evidence: "B",
    statement: "Send your CV as a PDF unless the employer asks for a different format.",
    llmGuidance: "If the file type is known: PDF = pass; DOCX = pass when the employer asked for Word, otherwise a minor tip; anything else = fail. If unknown, return na.",
    citations: [T_S2],
  },
  {
    id: "GEN-12", sectors: "all", dimension: "uk", check: "llm", severity: "minor", evidence: "D",
    statement: "Write dates consistently (e.g. \"Sep 2024 – Jun 2025\") and show your expected graduation date.",
    llmGuidance: "Check date formats are consistent (minor if mixed) and that an expected/anticipated graduation date is shown — a missing graduation date is major for an internship applicant.",
    citations: [],
  },
];
