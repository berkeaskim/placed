# Placed: Cross-Industry CV Rules for UK Students (General Rubric Evidence Base)

Scope: cross-industry rules for UK undergraduate/postgraduate CVs for internships, placements and graduate roles, plus how ATS parsing works in practice. Sector-specific rules (tech, product, finance, etc.) live in sibling files such as `cv-rules-tech-product.md`.

Research date: October 2026. Sources were checked against the original page where it was reachable. Where a page blocked fetching (403/401) and only a search snippet was available, the citation is marked **[snippet-verified]**.

---

## 0. How to read this document

**Check type**
- **RULE**: deterministic code (regex, PDF/DOCX parsing, counts, dictionaries).
- **LLM**: needs language-model judgement (semantics, genericness, relevance).
- **HYBRID**: a rule-based detector finds candidates and an LLM confirms or grades them.

**Severity** (suggested scoring impact inside its dimension)
- **critical**: can make the CV unreadable to a parser or get it rejected on the spot. Cap the dimension score, or deduct 40–100% of the rule's points.
- **major**: a clear competitive disadvantage. Deduct 15–40%.
- **minor**: polish. Deduct 0–15%.

**Evidence strength**
- **strong**: peer-reviewed experiment or field study, or primary vendor documentation of system behaviour.
- **moderate**: large institutional survey (ISE), statutory/regulator guidance, or consistent findings from older or non-UK peer-reviewed work.
- **weak**: single small, non-peer-reviewed or commercially motivated study.
- **consensus-only**: UK careers services and graduate-recruitment publishers agree, but nobody has tested it empirically. The rubric treats these as conventions, not as proven causes of success.

**Big-picture caveat (read first).** There is very little rigorous, recent, UK-specific experimental evidence on what makes a student CV succeed. The strongest causal evidence covers only (a) **writing errors and quality** (Sterkens et al. 2023; van Inwegen et al. 2025), (b) **discrimination signals** (GEMM audit study), and (c) **how ATS software handles files** (vendor docs). Most layout, length and section-order advice is consensus. Recruiter judgements are also noisy: in one non-peer-reviewed dataset, two recruiters looking at the same CV agreed only 64% of the time (interviewing.io, 76 recruiters, about 2,200 judgements). Scores should therefore be presented as **guidance, not a prediction of outcome**.

---

## 1. Key context facts (for product copy and calibration)

| Fact | Source | Strength |
|---|---|---|
| UK graduate employers received an average of **140 applications per graduate vacancy** (2023/24 and 2024/25). This is the highest since ISE records began in 1991. Retail/FMCG/tourism reached about 290. | ISE Student Recruitment Survey 2025 | moderate (large employer survey) |
| **48%** of ISE employers required a 2:1 minimum in 2024 (57% in 2021). About 20% required a 2:2, 13% set a UCAS-points minimum, and 26% had no minimum. | ISE SRS 2024 via Times Higher Education / Personnel Today | moderate |
| **73%** of student respondents had used AI somewhere in applications, and **46%** used it to write CVs or cover letters. ISE says employer use of AI in hiring is "currently minimal" and most assessment is still led by humans. | ISE insight, 2026 | moderate |
| About half of employers worry that candidates who use AI misrepresent their abilities (48% for graduates). | ISE Student Development Survey 2025 | moderate |
| ATS software ranks, searches and stores CVs. Outright auto-rejection is mostly done through **knockout questions** (right to work, location, licences), not CV "scores". | Enhancv 2025 (vendor, n=25 US recruiters): 8% configured auto-reject on match thresholds, 100% used knockout questions. HBS/Accenture *Hidden Workers* 2021: 88% of employers agree rigid filters exclude qualified high-skilled candidates. | weak (Enhancv) + moderate (HBS) |

---

## 2. Rules

### A. Document, file and ATS-parse safety

**G-01: Submit a text-based PDF or DOCX (or whatever format the employer asks for). Never an image or scanned PDF.**
- Check: **RULE**. Extract the text layer (pdfminer/pdf.js/mammoth). If extracted characters per page < ~200, or the page is a single image, flag it as image-based. Check the extension is in {pdf, docx, doc, rtf, txt}.
- Severity: **critical** (image-only files can't be parsed by Greenhouse, Lever or Workday).
- Evidence: **strong** (vendor docs).
- Note: UK careers advice conflicts here. Sheffield and Manchester prefer Word for ATS, Bright Network prefers PDF, and Prospects says follow the advert. Every major ATS whose documentation we checked (Greenhouse, Workday, Taleo, iCIMS, Lever) accepts PDF. **Do not penalise text-based PDFs.** Show a minor tip: "If the employer specifies a format, use it."
- Citations:
  - Greenhouse Support, "Unsuccessful resume parse" (current), https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse ("Resumes uploaded as an image, rather than a document")
  - Workday Admin Guide, "Resume parsing" (current), https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html ("For best results, use resumes that don't have images or image-based styles")
  - Oracle Taleo Enterprise docs, "Attachments" (22D), https://docs.oracle.com/en/cloud/saas/taleo-enterprise/22d/otrcg/c-attachment.html (PDF, DOC/DOCX, RTF, TXT, ODT supported)

**G-02: File size under 2.5 MB.**
- Check: **RULE** (byte size).
- Severity: **major** (Greenhouse uploads succeed up to 100 MB but **parsing fails above 2.5 MB**, so recruiters have to key the data in by hand).
- Evidence: **strong** (vendor doc).
- Citations: Greenhouse Support, "Unsuccessful resume parse"; Greenhouse Support, "Supported file types for resumes and cover letters", https://support.greenhouse.io/hc/en-us/articles/360052218132

**G-03: Name and contact details go in the document body, not in the header, footer or a text box.**
- Check: **RULE** (DOCX: inspect header/footer XML and text-box shapes. PDF: check whether the email or phone sits only in the top/bottom page margin band, which is a weak heuristic).
- Severity: **critical** for DOCX (iCIMS: without a parsed name, no candidate profile is created). **Major** for PDF.
- Evidence: **strong** (vendor docs).
- Citations: Greenhouse Support, "Unsuccessful resume parse" ("Resumes with the name and contact information in the header, footer, or text box"); iCIMS Community, "Creating a New Candidate Manually…" **[snippet-verified; login-gated]**, https://community.icims.com/articles/Knowledge/Creating-a-New-Candidate-Manually-in-the-Platform-or-via-Email-Import

**G-04: Single-column layout. No tables, text boxes or graphics carrying content.**
- Check: **RULE**. Use PDF text-block x-coordinate clustering to detect 2+ columns. Count DOCX `<w:tbl>` and shapes. Detect embedded images apart from small logos.
- Severity: **major**. Modern parsers (e.g. Textkernel) increasingly handle columns, but Greenhouse still lists columns, tables and graphics as parse-failure causes. Ladders 2018 also reported that multi-column, cluttered CVs did worse with human readers.
- Evidence: **strong** (vendor) for parse risk; **weak** for the human-reader effect.
- Citations:
  - Greenhouse Support, "Unsuccessful resume parse" ("Complex resumes with tables, headers, and footers"; "Resumes that have a columned layout"; "graphics, photos, or word art")
  - Textkernel, "Improving extraction from column resumes" (c. 2024–26), https://www.textkernel.com/improving-extraction-from-column-resumes/ (column-specific gap classification improved from 60% to 82%, so columns remain a known failure mode)
  - HR Dive, "Eye-tracking study shows recruiters look at résumés for 7 seconds" (2018), https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/

**G-05: No skill bars, rating graphics, icons-as-text or images of text.**
- Check: **RULE** (images or vector shapes near the skills heading; Unicode pictographs replacing labels such as a phone icon with no "Phone" or "+44").
- Severity: **major** (the content is invisible to parsers, and Workday does not auto-fill Skills fields anyway).
- Evidence: **strong** (vendor).
- Citations: Workday Admin Guide (Skills and Languages are not auto-populated by parsing; avoid image-based styles); Lever Help Center, "Understanding Resume Parsing" **[snippet-verified]**, https://help.lever.co/hc/en-us/articles/20087345054749

**G-06: Use standard section headings** (Education, Experience/Work Experience, Projects, Skills, Leadership & Activities/Extracurricular, Interests).
- Check: **RULE** (match headings against a synonym dictionary; flag creative headings like "My Journey" or "Where I've Been").
- Severity: **major**.
- Evidence: **strong** for the parse mechanism (iCIMS maps recognised headers to fields; Greenhouse fails "without clear sections"). **Consensus** for human readers.
- Citations: Greenhouse Support, "Unsuccessful resume parse"; University of Sheffield Careers, "Applicant tracking systems", https://sheffield.ac.uk/careers/support/apply/applications/tracking-systems ("clear simple headings, eg 'Work experience'")

**G-07: Write full job titles and organisation names.** Expand abbreviations once, e.g. "The Chartered Institute of Marketing (CIM)".
- Check: **HYBRID** (dictionary of common abbreviations like Sr., Mgr, Exec, Assoc.; an LLM expands unknown acronyms).
- Severity: **minor**.
- Evidence: **strong** (Greenhouse lists abbreviated titles as a parse issue) and consensus (Sheffield).
- Citations: Greenhouse Support, "Unsuccessful resume parse" ("Sr. Account Exec"); Sheffield Careers, "Applicant tracking systems".

**G-08: No spaced-out letters or decorative typography in the name or headings** (e.g. "J O H N  S M I T H").
- Check: **RULE** (regex for single characters separated by spaces, 4 or more in a row).
- Severity: **major** (breaks name parsing).
- Evidence: **strong** (vendor).
- Citation: Greenhouse Support, "Unsuccessful resume parse" ("A resume with spaces between the letters").

**G-09: Never hide keywords** (white or tiny text, keyword blocks copied from the job description).
- Check: **RULE** (PDF text colour equals background, font size < 4pt, long verbatim overlap with the JD of more than 25 consecutive tokens).
- Severity: **critical** (integrity). The parsed text is what recruiters search and see in snippets, so hidden text is exposed, not rewarded.
- Evidence: **consensus-only** for the penalty. The mechanism (full-text indexing and snippets) is vendor-documented.
- Citations: Greenhouse Support, "Search resumes for keywords", https://support.greenhouse.io/hc/en-us/articles/115004600186-Search-resumes-for-keywords (matching snippets shown to recruiters); University of Nottingham Careers, "ATS: stop trying to beat the system…" (Sept 2026), https://www.nottingham.ac.uk/careers/students/career-insights/ats-stop-trying-to-beat-the-system-and-focus-on-what-really-matters.aspx

**G-10: Professional filename**, e.g. `Firstname-Lastname-CV.pdf`, not `CV_final_v3(2).pdf`.
- Check: **RULE**.
- Severity: **minor**.
- Evidence: **consensus-only**.
- Citation: Prospects, "How to write a CV" (May 2025), https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/how-to-write-a-cv

### B. Length and structure

**G-11: Length is at most 2 A4 pages. One page is the expected default for students with limited experience. Some sectors require exactly one (e.g. investment banking).**
- Check: **RULE** (page count, plus fill ratio of the last page).
- Scoring: 1 page = pass. 2 full pages = pass. 2 pages with a mostly empty page 2 (< 25% filled) = minor ("condense to one"). More than 2 pages = **major**. 4 or more = **critical**. A sector override (finance/consulting = 1 page) comes from the sector files.
- Evidence: **consensus-only**. UK sources agree on "≤2 pages". The only empirical work is old and US-based (Thoms et al. 1999, often summarised as favouring one page, though we could not verify the full text), plus commercial surveys. LSE Careers explicitly answers "it depends": banks lean towards one page, and some employers (e.g. Shell) have rejected one-pagers as too thin.
- Citations:
  - Prospects, "How to write a CV" (May 2025) ("no longer than two A4 pages")
  - University of Manchester Careers, "Creating your CV", https://www.careers.manchester.ac.uk/applicationsinterviews/cv/step1creatingyourcv/ ("The 2 page reverse chronological CV is the most common style of CV for the UK")
  - LSE Careers blog, "Should my CV be one or two pages?" **[snippet-verified; URL served from LSE's blog test domain]**

**G-12: Reverse chronological order inside each section.**
- Check: **RULE** (parse dates per entry and check they are monotonically non-increasing; "Present" or "Expected 2027" counts as the latest).
- Severity: **major**.
- Evidence: **consensus-only** (universal UK agreement).
- Citations: Prospects (May 2025); National Careers Service, "CV sections", https://nationalcareers.service.gov.uk/careers-advice/cv-sections ("List the most recent experience first")

**G-13: Section order: contact details, then (optional) profile, then Education, then Experience, then Projects/Activities, then Skills, then Interests. Put Experience above Education only when the candidate has substantial relevant experience.** For most students Education comes first.
- Check: **HYBRID**. Rule: detect section order. LLM: decide whether experience is "substantial and relevant" enough to justify putting it first (e.g. a 12-month placement or several relevant internships).
- Severity: **minor**. Order is flexible. TARGETjobs: "there are no hard and fast rules… unless the employer has stipulated".
- Evidence: **consensus-only**. Ladders eye-tracking found education among the six "hot spots" recruiters look at first (weak).
- Citations: National Careers Service, "CV sections" (early-career: education first); Prospects (May 2025) ("If you have plenty of relevant work experience, this section should come before education"); TARGETjobs, "The 6-step guide to perfecting your graduate CV" (Aug 2024), https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/6-step-guide-perfecting-your-graduate-cv

**G-14: Every experience, education and project entry has organisation, role/qualification, and start and end dates (month + year).**
- Check: **RULE** (entry segmentation, then field presence; date regex covering `Sep 2024 – Jun 2025`, `09/2024`, `2024–Present`).
- Severity: **major** (dates, titles and employers are what recruiters fixate on and what parsers extract).
- Evidence: **moderate** (vendor parse fields plus Ladders hot-spot data, which is weak alone).
- Citations: Ladders eye-tracking report (2012; 30 recruiters over 10 weeks), https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf (about 80% of review time on name, titles/companies, start/end dates, education); Lever Help Center **[snippet-verified]** (extracts roles, employers, dates).

**G-15: Don't title the document "Curriculum Vitae" or "CV". The candidate's name is the title.**
- Check: **RULE**.
- Severity: **minor**.
- Evidence: **consensus-only**.
- Citations: Prospects (May 2025); TARGETjobs via property-CV guide, https://targetjobs.co.uk/careers-advice/construction-and-property/how-write-cv-property-graduate-job

### C. Contact details and UK personal-data conventions

**G-16: Required contact block: full name, mobile number, professional email, and town/city. A LinkedIn URL is recommended.**
- Check: **RULE** (regex for UK mobile `(\+44\s?7|07)\d{3}\s?\d{6}`, email, linkedin.com/in/; professional-email heuristic flags handles containing words like "babe", "420" or "xx", or very long digit runs).
- Severity: missing phone or email = **critical**. Missing LinkedIn = **minor**. Unprofessional email = **major**.
- Evidence: **consensus-only**. A full home address is optional: Prospects lists it but advises against it when posting a CV online. Town/city is enough.
- Citations: National Careers Service, "CV sections" (name, phone, email, LinkedIn); Prospects (May 2025).

**G-17: Do NOT include a photo, date of birth/age, marital status, gender, or religion. Nationality: omit (NCS) or treat as optional (Manchester).**
- Check: **RULE** (embedded face-sized image; regexes for `DOB|Date of birth|Age:|\b\d{1,2}\s?(years old|y\/o)|Married|Single|Nationality|Religion|Gender`).
- Severity: photo = **major**. DOB/age = **major**. Marital status, gender or religion = **major**. Nationality = **minor**.
- Evidence: **moderate**. The legal context is statutory and regulator guidance: the Equality Act 2010 lists age, marriage/civil partnership, race (including nationality), religion, sex and others as protected characteristics. Acas advises employers not to ask for age or DOB, and says that asking can later be used as evidence in a discrimination claim. So employers gain nothing from these details and may be uncomfortable receiving them. UK careers advice is unanimous on this. Ladders' 2012 study found profile photos took about 19% of recruiter fixation time on LinkedIn profiles, i.e. they distract.
- Product note: frame this as "UK convention, and it protects you", not "illegal". It is not unlawful for a candidate to include these details. For international students, a short **right-to-work line** (e.g. "Eligible to work full-time in the UK under the Graduate visa from Sep 2027") is different from nationality. Do not penalise it. UK careers sources are mixed on whether to include it, and evidence is **consensus-only/uncertain**, so offer it as an optional LLM suggestion.
- Citations:
  - Equality Act 2010, legislation.gov.uk, https://www.legislation.gov.uk/ukpga/2010/15/contents
  - Acas, "Age discrimination: key points for the workplace" (Apr 2024), https://www.acas.org.uk/sites/default/files/2024-04/age-discrimination-key-points-for-the-workplace.pdf ("avoid asking for the applicant's age or date of birth on the form… they may claim that the fact that the employer did ask is evidence of discrimination")
  - National Careers Service, "CV sections" ("You should not include your age, your date of birth, whether you're married or your nationality"); Prospects (May 2025) (exclude DOB and photograph)

**G-18: References: omit, or write "References available on request". Do not list referees' personal contact details.**
- Check: **RULE**.
- Severity: **minor** (it wastes space; listing referees' phone numbers is also a third-party data issue).
- Evidence: **consensus-only**.
- Citations: National Careers Service, "CV sections"; Manchester Careers ("An employer will request these later").

### D. Personal statement / profile

**G-19: A profile is optional for students. If present, it is at most ~150 words (3–6 lines), tailored to the role/sector, specific (degree, standout evidence, target), and free of clichés.**
- Check: **HYBRID**. Rule: word count, cliché dictionary ("team player", "hard-working", "excellent communication skills", "passionate", "self-motivated", "multitasker", "go-getter", "think outside the box"), hedging words ("trying", "might", "maybe"). LLM: rates genericness on a 1–5 scale ("could this sentence appear on 1,000 other CVs?") and checks it mentions the target sector or role.
- Severity: generic profile = **minor/major** (TARGETjobs: generic statements can irritate graduate recruiters). More than 150 words = **minor**. **Never penalise a missing profile.**
- Evidence: **consensus-only**. Note that UK sources disagree: TARGETjobs (2023) says a profile is often "a waste of space" for graduates, while Prospects (2025) gives guidance on writing one. Both agree a generic one is worse than none.
- Citations: TARGETjobs, "Are personal statements a waste of space on graduate CVs?" (Jun 2023), https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/are-personal-statements-waste-space-graduate-cvs; Prospects, "Writing a personal statement for your CV" (May 2025), https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/writing-a-personal-statement-for-your-cv; Manchester Careers ("3-6 lines").

### E. Bullets, impact and language

**G-20: Experience and activity entries use bullets that start with a strong action verb ("Led", "Built", "Analysed"), not duty phrases ("Responsible for", "Duties included", "Helped with").**
- Check: **RULE** (first-token POS or dictionary of about 300 action verbs; flag a weak-opener list). Report the % of bullets that open with an action verb.
- Severity: **major** if fewer than 50% do. **Minor** if 50–80%.
- Evidence: **consensus-only** (UK-universal). Indirect support comes from older experiments where accomplishment statements improved recruiter impressions: Knouse 1994; Thoms et al. 1999 (moderate-weak, US, pre-2000).
- Citations: Prospects (May 2025) ("Use active verbs"); Manchester Careers ("Use strong action words"); Knouse, S. B. (1994), "Impressions of the résumé: The effects of applicant education, experience, and impression management", *Journal of Business and Psychology*, https://doi.org/10.1007/BF02230985

**G-21: Bullets show outcome or impact (action, then context/task, then result, i.e. CAR/STAR-lite). For students, results can be scale, outcome, recognition or feedback, not only money.**
- Check: **LLM**. Classify each bullet as *duty* / *action without result* / *action + result*. Score the share of bullets with results.
- Severity: **major** (this is the main lever in the Impact dimension).
- Evidence: **moderate/consensus**. Earlier experiments support it: competency and accomplishment statements raised shortlisting (Bright, Earl & Adams, Australian work from the late 1990s), and relevant experience increases recruiter-perceived person-job fit (Tsai et al. 2011, n=216 campus recruiters). Every UK source recommends it. There is **no modern RCT isolating "result clauses"**. Commercial claims like "40% more callbacks for quantified CVs" are marketing and are not used here.
- Citations: TARGETjobs, "6-step guide" (Aug 2024) (example: "Personally sold 46 tickets, just under a third of the total tickets available"; stresses personal contribution in team work); Bright Network, "5 tips to write an internship-worthy CV" **[snippet-verified]**, https://www.brightnetwork.co.uk/employer-advice/5-tips-to-write-an-internship-worthy-cv ("Employers want to know the impact of your actions"); Tsai, Chi, Huang & Hsu (2011), *Applied Psychology* 60(2), 231–254.

**G-22: Quantify where truthful. At least ~40% of experience/project bullets contain a number (%, £, counts, time saved, users, ranking, team size).**
- Check: **RULE** (regex for digits, %, £/$/€, number words, "x" multipliers) plus **LLM** to reject meaningless numbers (e.g. "1 year").
- Severity: **major** if under 20%. **Minor** if 20–40%. Threshold is a heuristic, not evidence-based.
- Evidence: **consensus-only** (the threshold is our choice). Supported in direction by TARGETjobs and Bright Network. Warn against inventing numbers (see G-35).
- Citations: TARGETjobs, "6-step guide" (Aug 2024); TARGETjobs, technical CV guide (download/user metrics), https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice; Prospects (May 2025) ("provide evidence").

**G-23: Bullets are concise. Mostly 1–2 lines (~12–30 words). Roughly 2–5 bullets per role. No paragraphs over 3 lines in experience sections.**
- Check: **RULE** (word/line counts per bullet, bullets per entry).
- Severity: **minor**.
- Evidence: **weak/consensus** (Ladders 2018 reported "long sentences" and lack of white space underperformed; NCS says use "2 to 3 lines" per role description).
- Citations: HR Dive on Ladders 2018; National Careers Service, "CV sections".

**G-24: Tense: present tense for current roles, past tense for finished ones. No first-person pronouns ("I", "my") in bullets.**
- Check: **RULE** (POS-tag the first verb against the entry's end date; regex `\b(I|my|me)\b` in bullets).
- Severity: **minor**.
- Evidence: **consensus-only** (no empirical study; a stylistic convention).
- Citations: National Careers Service, "CV sections" ("always use the same style throughout"); Prospects personal-statement guide (keep the person consistent).

**G-25: Zero spelling and grammar errors.**
- Check: **HYBRID** (en-GB spellchecker such as LanguageTool or Hunspell en_GB with a tech/proper-noun allowlist; an LLM confirms true errors and ignores names and jargon).
- Severity: **critical** if 3 or more errors. **Major** for 1–2.
- Evidence: **strong**.
  - Sterkens et al. (2023), *PLOS ONE*: 445 real recruiters. Interview probability was 65.6% with no errors, 58.1% with 2 errors and 46.6% with 5 errors (−7.3 and −18.5 percentage points). About half of the penalty came from lower perceived mental ability, conscientiousness and interpersonal skills. The study was in Belgium.
  - van Inwegen, Munyikwa & Horton (2025), *Management Science*: a field experiment with about 480k jobseekers on an online labour market. Algorithmic writing help (fewer errors, clearer text) gave **8% more hires** and 8.4% higher wages, with no fall in employer satisfaction.
- Citations: Sterkens, Caers, De Couck, Van Driessche, Geamanu & Baert (2023), "Costly mistakes: Why and when spelling errors in resumes jeopardise interview chances", *PLOS ONE* 18(4): e0283280, https://doi.org/10.1371/journal.pone.0283280; van Inwegen, Munyikwa & Horton (2025), "Algorithmic Writing Assistance on Jobseekers' Resumes Increases Hires", *Management Science* 71(12), NBER WP 30886, https://www.nber.org/papers/w30886

**G-26: Use one spelling variety (UK English for UK roles: "analysed", "organised", "programme"), applied consistently.**
- Check: **RULE** (US/UK variant dictionary; flag mixing, and flag US-only spellings for UK-targeted CVs as minor).
- Severity: **minor**.
- Evidence: **consensus-only** (the general error-penalty mechanism in G-25 suggests some risk, but variant spellings have not been tested).
- Citation: Sterkens et al. (2023) (mechanism only).

**G-27: Formatting is consistent: one date format, one bullet glyph, consistent heading styles, aligned dates (UK sources suggest dates at the end of the line), at most 2 font families.**
- Check: **RULE** (PDF font-span analysis; date-format regex classes; bullet glyph set).
- Severity: **minor** (it becomes **major** for the parser when formats vary wildly: Greenhouse lists "differing formats throughout").
- Evidence: **moderate** (vendor plus consensus).
- Citations: Greenhouse Support, "Unsuccessful resume parse"; National Careers Service ("always use the same style throughout"); Sheffield Careers ("Add dates at the end of the line").

**G-28: Readable typography: a standard sans or serif font (Arial, Calibri, Helvetica, Garamond, Georgia, Times New Roman, Lato and similar), body text 10–12pt, margins about 1.5–2.5 cm, enough white space.**
- Check: **RULE** (PDF font names and sizes; page-area text density).
- Severity: body under 9.5pt = **major**. A novelty font (Comic Sans, script fonts) = **major**. Margins under 1.27 cm = **minor**.
- Evidence: **consensus-only** (Prospects: 10–12pt, about 2.5 cm margins; NCS: size 11 or bigger). Ladders 2018 supports clear layout with white space (weak).
- Citations: Prospects (May 2025); National Careers Service, "CV sections".

**G-29: Avoid unsupported buzzwords and soft-skill claims. Every soft skill claimed should be backed by an example somewhere in the CV.**
- Check: **HYBRID** (dictionary flags "team player", "hard-working", "detail-oriented", "multitasker"; an LLM checks whether a supporting bullet exists).
- Severity: **minor**.
- Evidence: **consensus-only**.
- Citations: Prospects (May 2025) ("Avoid generic phrases: 'team player, hardworking and multitasker'"); TARGETjobs, personal statements article (2023).

### F. Relevance and keywords

**G-30: Tailor the CV to the target job: the CV should cover the job description's must-have skills and qualifications using the employer's own wording, placed in context (bullets), not only in a skills list.**
- Check: **HYBRID**. Rule: extract JD n-grams (skills, tools, qualifications), compute exact-match and lemma-match coverage, and separately count matches inside experience/project bullets versus the skills list. LLM: decide must-have versus nice-to-have, and recognise semantic equivalents ("stakeholder management" ≈ "worked with clients").
- Severity: **major** when must-have coverage is under 50%.
- Evidence: **moderate**. The mechanism is vendor-documented: Greenhouse indexes the full text and recruiters run keyword searches. Ladders 2012 observed recruiters scanning for keywords. UK careers services all advise echoing employer language. Caveat: the size of the effect on outcomes is untested, and match scores are **not** typically used to auto-reject (Enhancv 2025: 8%).
- Citations: Greenhouse Support, "Search resumes for keywords"; Manchester Careers ("use same words the employer is using in the job description"); TARGETjobs, "6-step guide" (Aug 2024) ("echo" employer language).

**G-31: Skills section is specific and grouped (e.g. Technical: Python, SQL; Languages: Spanish (C1); Tools: Excel (pivot tables, XLOOKUP)), with proficiency stated in words or recognised frameworks (CEFR), not bars or stars.**
- Check: **RULE** (presence; item count 4–20; detect bars/stars per G-05; flag generic items like "Microsoft Office", "communication") plus **LLM** for relevance to the target role.
- Severity: **minor/major** (missing entirely = major for technical or analytical roles; bloated generic lists = minor).
- Evidence: **moderate** (vendor: Workday doesn't auto-parse skills, so skills must also appear in context; TARGETjobs technical guidance on categories and relevance).
- Citations: TARGETjobs, technical CV guide ("Focus on the skills that the employer and the role requires"); Workday Admin Guide.

### G. Education and grades (UK specifics)

**G-32: The Education entry includes institution, degree title, dates (with expected graduation), and a classification: either achieved, or expected/predicted (e.g. "Predicted First", "On track for a 2:1"), or a current average (e.g. "Year 1 average: 68%"). Relevant modules, dissertation or projects are optional.**
- Check: **RULE** (regex for `First|1st|2:1|2.1|Upper Second|2:2|Lower Second|Distinction|Merit|Pass|predicted|expected|average\s*\d{2}%|GPA`). Flag "missing classification" as **major**. Show an LLM-generated suggestion for students who are worried about their grade, rather than a hard penalty.
- Severity: **major**. In 2024, 48% of large UK graduate employers set a 2:1 minimum and about 20% a 2:2. A missing grade invites the assumption that it falls below the threshold (consensus reasoning).
- Evidence: **moderate** (ISE threshold data; Cole et al. 2007 found academic qualifications among the main résumé items recruiters use when screening recent graduates).
- Citations: ISE SRS 2024, via Times Higher Education, "Less than half of UK's big graduate recruiters now demand a 2:1", https://www.timeshighereducation.com/node/724569; Cole, Rubin, Feild & Giles (2007), "Recruiters' perceptions and use of applicant résumé information: Screening the recent graduate", *Applied Psychology* 56(2), 319–343, https://doi.org/10.1111/j.1464-0597.2007.00288.x; Prospects (May 2025).

**G-33: Include A-levels (or IB/Scottish Highers/BTEC/international equivalent) with grades. GCSEs can be summarised in one line (e.g. "9 GCSEs incl. Maths 8, English 7"). For international qualifications, name the system (e.g. "Turkish Lise Diploma, 92/100").**
- Check: **RULE** (detect A-level/IB/Highers/BTEC patterns and grade tokens such as A*, A, B and 7/6/5; flag GCSE sections longer than 3 lines as minor).
- Severity: missing pre-university qualifications = **minor** generally. It becomes **major** for sectors that screen on UCAS points; the sector files set the override. ISE: only 13% set a UCAS minimum.
- Evidence: **moderate/consensus** (Manchester: employers expect A-levels and GCSEs; ISE: a minority still set UCAS thresholds).
- Citations: Manchester Careers ("A levels, GCSEs and equivalents"); ISE SRS 2024 via THE.

### H. Extracurriculars, interests, links

**G-34: Include extracurriculars (societies, sport, volunteering, part-time jobs, hackathons, competitions) written like experience entries: role, organisation, dates, and 1–3 achievement bullets. Leadership or responsibility roles should come first. Interests should be specific and discussable ("Half-marathon runner, 1:42 PB"), not generic ("reading, travelling, socialising").**
- Check: **HYBRID** (rule: section present and has entries with dates/roles; LLM: specificity and whether skills are demonstrated).
- Severity: **major** if a student has no experience or activities at all. **Minor** for generic interests.
- Evidence: **moderate**. Cole et al. (2007) show recruiters screening recent graduates do use extracurricular information (peer-reviewed, US). TARGETjobs and Prospects recommend specific interests you can talk about in depth.
- Citations: Cole et al. (2007), *Applied Psychology*; TARGETjobs, "6-step guide" (Aug 2024) (interests you can "talk about in-depth"); TARGETjobs technical CV guide ("Hackathons, events and personal projects").

**G-35: Links are live, relevant and readable as plain text: LinkedIn (`linkedin.com/in/name`), GitHub or portfolio for technical/creative roles, with the URL visible (not hidden behind an icon). Linked work must be current.**
- Check: **RULE** (extract URLs; HTTP HEAD check; GitHub API: public repos > 0, last push < 12 months; flag icon-only links with no visible text).
- Severity: broken link = **major**. Icon-only link = **minor**. Stale or empty GitHub on a tech CV = **minor** (the sector file may raise this).
- Evidence: **consensus-only** (NCS recommends LinkedIn; TARGETjobs: "make sure it includes up-to-date examples"). Lever reportedly extracts LinkedIn URLs **[snippet-verified]**.
- Citations: National Careers Service, "CV sections"; TARGETjobs, technical CV guide.

### I. Integrity and authenticity

**G-36: Content must be truthful and specific to the candidate. No invented metrics, no generic AI boilerplate.** AI may be used to refine wording but not to fabricate content.
- Check: **LLM** (detect generic, interchangeable phrasing, internal inconsistencies such as dates overlapping implausibly, or a metric with no plausible basis; ask the user to confirm figures). Never claim to "detect AI". Score genericness, not provenance.
- Severity: **major** (and the app should never invent numbers for the user. Suggestions should use placeholders like "[X%]" the user must fill in).
- Evidence: **moderate** (ISE 2025: about half of employers worry AI misrepresents candidates; UK Civil Service guidance, Oct 2025, allows AI for refining but not for inventing or exaggerating; TARGETjobs: inconsistencies "will likely be quickly picked up").
- Citations: ISE, "Students use AI to compete yet oppose AI assessment" (2026), https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment; PublicTechnology, "What new civil service guidance on AI for job applicants tells us…" (31 Oct 2025), https://www.publictechnology.net/2025/10/31/education-and-skills/what-new-civil-service-guidance-on-ai-for-job-applicants-tells-us-about-shifts-in-recruitment/; Gradcracker × Experian, "CV application", https://www.gradcracker.com/hub/872/experian/additional-content/1782/cv-application ("AI-generated content can be buzz word heavy and lacks authenticity").

### J. Fairness guardrail (product rule, not a CV rule)

**G-37: The scorer must never reward or penalise identity signals:** name, ethnicity cues, gender, age, nationality, disability, school or university prestige (beyond noting sector norms), or postcode.
- Check: **RULE** (strip these fields before LLM scoring; run a counterfactual test: swap names and verify the score is unchanged).
- Severity: n/a (system requirement).
- Evidence: **strong** that such signals bias human screeners. GEMM (Nuffield/CSI Oxford, 2019, a cross-national field experiment) found UK applicants with minority-ethnic-sounding names needed about 60% more applications for the same callback rate. Our tool must not reproduce that. Equality Act 2010.
- Citations: Lancee, B. et al. (incl. V. Di Stasio and A. Heath), "The GEMM Study: A Cross-National Harmonized Field Experiment on Labour Market Discrimination: Technical Report" (2019), https://papers.ssrn.com/abstract=3398191; Equality Act 2010.

---

## 3. Myths (debunked or overstated)

| # | Myth | Verdict | Evidence |
|---|---|---|---|
| M1 | **"75% of CVs are rejected by ATS before a human sees them."** | **Unsupported.** The figure traces back to a 2012 sales claim by Preptel, a CV-optimisation company that closed in 2013 and never published a method or sample. Real ATS behaviour: parse, store, search and rank. Auto-rejection happens mainly through **knockout questions** (right to work, location). Caveat: rigid filters do exclude people. HBS/Accenture *Hidden Workers* (2021) found 88% of employers agreed qualified high-skilled candidates get screened out for not matching criteria exactly, so "ATS never matters" is also wrong. | HiringThing (ATS vendor) blog citing Christine Assaf's investigation (2022), https://blog.hiringthing.com/applicant-tracking-system-myths; Enhancv recruiter interviews (2025, n=25 US, vendor) via IT Brief UK, https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth; HR Dive on *Hidden Workers* (2021), https://www.hrdive.com/news/report-applicant-tracking-systems-may-exclude-whole-segments-of-candidates/606614/; Nottingham Careers (2026) |
| M2 | **"Recruiters read your CV for exactly 6 / 7.4 seconds."** | **Overstated.** It comes from Ladders, a company selling CV-writing services. The 2012 study had 30 recruiters over 10 weeks and was not peer-reviewed. The 2018 follow-up did not publish its sample, roles or protocol. Useful as a directional point ("make key facts scannable"), not a law. | Ladders report (2012) PDF; HR Dive (2018); ERE, "Is the 6-second resume scan a myth?", https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth |
| M3 | **"ATS can't read PDFs, always send Word."** | **False for major ATS.** Greenhouse, Workday, Lever, iCIMS and Taleo all list PDF as supported. The real risk is **image-based** PDFs, columns/tables, and content in headers or footers. Some UK careers pages (Sheffield, Manchester) still say Word is safer. Follow the employer's stated format. | Greenhouse, Workday, Taleo docs (see G-01) |
| M4 | **"A UK CV must be one page."** | **Sector-dependent.** The UK norm is up to 2 A4 pages. One page suits most early students and is expected in banking. Some employers find one page too thin. | Prospects (2025); Manchester; LSE Careers |
| M5 | **"Paste the JD in white text to beat the ATS."** | **Counterproductive.** The parsed text is what recruiters search and see, and the original file is kept for human review. There is no evidence it works. | Greenhouse keyword search doc; Nottingham Careers (2026) |
| M6 | **"Employers don't care about a couple of typos."** | **False.** Two errors cost about 7 percentage points of interview probability, and five errors about 19 points. | Sterkens et al. (2023), *PLOS ONE* |
| M7 | **"Every graduate employer requires a 2:1."** | **No longer true for most.** It was 48% in 2024, down from 57% in 2021, and 26% set no minimum. Still worth stating your grade if you meet common thresholds. | ISE SRS 2024 |
| M8 | **"Add a photo to stand out."** | **Not UK convention.** It is not standard, and employers are advised not to request age-related information. Photos draw attention away from content. | TARGETjobs; Prospects; Acas (2024); Ladders (2012) |
| M9 | **"AI screens and scores every UK student application."** | **Overstated for the UK.** 95% of students believe employers use AI to shortlist, but ISE reports employer AI use in hiring is currently minimal and assessment is mostly human-led. | ISE (2026) |
| M10 | **"A personal statement is mandatory."** | **Optional.** TARGETjobs argues most graduate profiles are generic and add little. Prospects gives guidance for writing a good one. A generic one is worse than none. | TARGETjobs (2023); Prospects (2025) |
| M11 | **"Quantified CVs get 40% / 4× more callbacks."** | **Unverified marketing figures.** The direction is widely endorsed, but these specific numbers come from CV-builder blogs with no published method. Don't use them in product copy. | n/a (identified to avoid) |

---

## 4. Proposed rubric (general, cross-industry)

Total = 100. Each dimension is scored 0–100 internally and then weighted. Inside a dimension, start at 100 and deduct per rule using severity (critical 40–100% of the rule's share, major 15–40%, minor 0–15%). **Gates:** if G-01 (image-only file) or G-25 (3 or more spelling errors) fires, cap the overall score at 50 and show it as the top fix. If both G-16 phone and email are missing, cap at 40.

| Dimension | Weight | What it measures | Rules feeding it (main ones in bold) | Check mix |
|---|---|---|---|---|
| **1. ATS readiness** | **20** | Will the file parse cleanly into an ATS profile? | **G-01, G-02, G-03, G-04, G-05, G-06**, G-07, G-08, G-09, G-10 | ~95% rule-based |
| **2. Impact & evidence** | **30** | Do bullets prove achievement (action + result, numbers, ownership)? | **G-20, G-21, G-22**, G-29, G-34 (activity bullets), G-36 | ~40% rule / 60% LLM |
| **3. Clarity & polish** | **20** | Error-free, concise, consistent, readable | **G-25** (strongest evidence), G-23, G-24, G-26, G-27, G-28, G-11 (length), G-12 | ~80% rule (spellcheck plus LLM confirm) |
| **4. Relevance & tailoring** | **20** | Fit to target role/sector; keywords in context; right things foregrounded | **G-30, G-31**, G-13 (order), G-19 (profile tailoring), G-35 (relevant links) | ~40% rule / 60% LLM; needs a JD. Without a JD, score against the user's chosen sector profile and label it "generic relevance". |
| **5. UK conventions & completeness** | **10** | UK norms and required facts present | **G-14, G-16, G-17, G-32**, G-33, G-15, G-18 | ~95% rule-based |

Why these weights:
- **Impact (30)** is the most consistent recommendation across UK sources and the main thing a student can improve. Its evidence is moderate, not strong, so it is not weighted higher.
- **Clarity (20)** holds the rule with the **strongest causal evidence** (G-25 errors), and that rule is enforced through a gate, not only through weight.
- **ATS readiness (20)** has strong mechanistic evidence (vendor docs), but parsing failures usually cost manual re-keying or poor searchability, not automatic rejection (see M1). So it gets equal weight, not dominance.
- **Relevance (20)** matters most when a JD is supplied. Without a JD it should be shown with lower confidence.
- **UK conventions (10)** are mostly binary checks. Missing contact details or grades are handled by gates or major deductions.

Gamification note for Placed: map critical and major findings to "quests" (e.g. "Add a result to 3 bullets", "Move your contact details out of the header"). These are concrete, verifiable, and each one maps to a single rule ID.

---

## 5. Open questions and uncertainty log

1. **Lever and iCIMS docs** could only be verified through search snippets (the help-centre pages were login-gated or would not render). Re-verify before quoting in product copy.
2. **Thoms et al. (1999)** findings on one-page CVs and objectives are reported second-hand. We could not read the full text.
3. **LSE Careers "one or two pages"** was found on an LSE blog test domain, so it may be stale or moved.
4. **Quantification thresholds** (G-22: 40%) and bullet-length bands (G-23) are product heuristics, not evidence-derived. Tune them on real UCL CVs if possible.
5. **Right-to-work statements** for international students: no authoritative UK source found either way. Treat as optional and do not score.
6. Many UK graduate schemes use **online application forms and psychometrics** instead of (or as well as) CVs. CV score improvements may matter more for SME internships, spring weeks requesting CVs, and speculative applications. This was not quantified here.
7. Recruiter judgement is noisy (interviewing.io data: 64% agreement between two recruiters on the same candidate, not peer-reviewed). UI copy should avoid implying a score predicts an outcome.
