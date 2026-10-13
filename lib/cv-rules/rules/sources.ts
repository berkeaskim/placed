import type { Citation } from "../types";

/**
 * Citation records resolved from the research docs' source lists.
 * Only sources with a URL are listed. Sources the docs flag as unverified
 * (snippet-only / login-gated pages, test-domain pages, unconfirmed figures)
 * carry " (unverified)" in the title, and the rules citing them are downgraded one evidence grade.
 */

// ---------- docs/research/cv-rules-general.md ----------
export const GH_PARSE: Citation = { title: "Unsuccessful resume parse", publisher: "Greenhouse Support", year: "current", url: "https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse" };
export const WD_PARSE: Citation = { title: "Resume parsing", publisher: "Workday Admin Guide", year: "current", url: "https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html" };
export const GH_FILETYPES: Citation = { title: "Supported file types for resumes and cover letters", publisher: "Greenhouse Support", year: "current", url: "https://support.greenhouse.io/hc/en-us/articles/360052218132" };
export const ICIMS_MANUAL: Citation = { title: "Creating a New Candidate Manually in the Platform or via Email Import (unverified)", publisher: "iCIMS Community", year: "current", url: "https://community.icims.com/articles/Knowledge/Creating-a-New-Candidate-Manually-in-the-Platform-or-via-Email-Import" };
export const TEXTKERNEL_COLUMNS: Citation = { title: "Improving extraction from column resumes", publisher: "Textkernel", year: "c. 2024–26", url: "https://www.textkernel.com/improving-extraction-from-column-resumes/" };
export const HRDIVE_LADDERS_2018: Citation = { title: "Eye-tracking study shows recruiters look at résumés for 7 seconds", publisher: "HR Dive", year: "2018", url: "https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/" };
export const LEVER_PARSING: Citation = { title: "Understanding Resume Parsing (unverified)", publisher: "Lever Help Center", year: "current", url: "https://help.lever.co/hc/en-us/articles/20087345054749" };
export const SHEFFIELD_ATS: Citation = { title: "Applicant tracking systems", publisher: "University of Sheffield Careers", year: "current", url: "https://sheffield.ac.uk/careers/support/apply/applications/tracking-systems" };
export const GH_SEARCH: Citation = { title: "Search resumes for keywords", publisher: "Greenhouse Support", year: "current", url: "https://support.greenhouse.io/hc/en-us/articles/115004600186-Search-resumes-for-keywords" };
export const NOTTINGHAM_ATS: Citation = { title: "ATS: stop trying to beat the system and focus on what really matters", publisher: "University of Nottingham Careers", year: "2026", url: "https://www.nottingham.ac.uk/careers/students/career-insights/ats-stop-trying-to-beat-the-system-and-focus-on-what-really-matters.aspx" };
export const PROSPECTS_CV: Citation = { title: "How to write a CV", publisher: "Prospects", year: "2025", url: "https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/how-to-write-a-cv" };
export const MANCHESTER_CV: Citation = { title: "Creating your CV", publisher: "University of Manchester Careers", year: "current", url: "https://www.careers.manchester.ac.uk/applicationsinterviews/cv/step1creatingyourcv/" };
export const NCS_SECTIONS: Citation = { title: "CV sections", publisher: "National Careers Service", year: "current", url: "https://nationalcareers.service.gov.uk/careers-advice/cv-sections" };
export const TJ_6STEP: Citation = { title: "The 6-step guide to perfecting your graduate CV", publisher: "TARGETjobs", year: "2024", url: "https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/6-step-guide-perfecting-your-graduate-cv" };
export const LADDERS_2012: Citation = { title: "Eye-tracking study", publisher: "TheLadders", year: "2012", url: "https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf" };
export const TJ_PROPERTY_CV: Citation = { title: "How to write a CV for a property graduate job", publisher: "TARGETjobs", year: "current", url: "https://targetjobs.co.uk/careers-advice/construction-and-property/how-write-cv-property-graduate-job" };
export const EQUALITY_ACT: Citation = { title: "Equality Act 2010", publisher: "legislation.gov.uk", year: "2010", url: "https://www.legislation.gov.uk/ukpga/2010/15/contents" };
export const ACAS_AGE: Citation = { title: "Age discrimination: key points for the workplace", publisher: "Acas", year: "2024", url: "https://www.acas.org.uk/sites/default/files/2024-04/age-discrimination-key-points-for-the-workplace.pdf" };
export const TJ_PERSONAL_STATEMENTS: Citation = { title: "Are personal statements a waste of space on graduate CVs?", publisher: "TARGETjobs", year: "2023", url: "https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/are-personal-statements-waste-space-graduate-cvs" };
export const PROSPECTS_PERSONAL_STATEMENT: Citation = { title: "Writing a personal statement for your CV", publisher: "Prospects", year: "2025", url: "https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/writing-a-personal-statement-for-your-cv" };
export const KNOUSE_1994: Citation = { title: "Impressions of the résumé: The effects of applicant education, experience, and impression management", publisher: "Journal of Business and Psychology (Knouse)", year: "1994", url: "https://doi.org/10.1007/BF02230985" };
export const BRIGHT_INTERNSHIP_CV: Citation = { title: "5 tips to write an internship-worthy CV (unverified)", publisher: "Bright Network", year: "current", url: "https://www.brightnetwork.co.uk/employer-advice/5-tips-to-write-an-internship-worthy-cv" };
export const STERKENS_2023: Citation = { title: "Costly mistakes: Why and when spelling errors in resumes jeopardise interview chances", publisher: "PLOS ONE (Sterkens et al.)", year: "2023", url: "https://doi.org/10.1371/journal.pone.0283280" };
export const VAN_INWEGEN_2025: Citation = { title: "Algorithmic Writing Assistance on Jobseekers' Resumes Increases Hires", publisher: "Management Science / NBER (van Inwegen, Munyikwa & Horton)", year: "2025", url: "https://www.nber.org/papers/w30886" };
export const THE_ISE_2024: Citation = { title: "Less than half of UK's big graduate recruiters now demand a 2:1", publisher: "Times Higher Education (ISE Student Recruitment Survey 2024)", year: "2024", url: "https://www.timeshighereducation.com/node/724569" };
export const COLE_2007: Citation = { title: "Recruiters' perceptions and use of applicant résumé information: Screening the recent graduate", publisher: "Applied Psychology (Cole, Rubin, Feild & Giles)", year: "2007", url: "https://doi.org/10.1111/j.1464-0597.2007.00288.x" };
export const ISE_AI_2026: Citation = { title: "Students use AI to compete yet oppose AI assessment", publisher: "Institute of Student Employers", year: "2026", url: "https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment" };
export const PUBLICTECH_CIVIL_SERVICE_AI: Citation = { title: "What new civil service guidance on AI for job applicants tells us about shifts in recruitment", publisher: "PublicTechnology", year: "2025", url: "https://www.publictechnology.net/2025/10/31/education-and-skills/what-new-civil-service-guidance-on-ai-for-job-applicants-tells-us-about-shifts-in-recruitment/" };
export const GRADCRACKER_EXPERIAN: Citation = { title: "CV application (Experian employer advice)", publisher: "Gradcracker", year: "current", url: "https://www.gradcracker.com/hub/872/experian/additional-content/1782/cv-application" };
export const GEMM_2019: Citation = { title: "The GEMM Study: A Cross-National Harmonized Field Experiment on Labour Market Discrimination: Technical Report", publisher: "SSRN (Lancee et al.)", year: "2019", url: "https://papers.ssrn.com/abstract=3398191" };

// ---------- docs/research/cv-rules-tech-product.md §9 ----------
/** [S1] Laszlo Bock X-Y-Z formula, re-stated by Google recruiters (CNBC 2018). */
export const T_S1: Citation = { title: "Google recruiters share the 3-part formula for stronger resumes", publisher: "CNBC (Laszlo Bock X-Y-Z formula)", year: "2018", url: "https://www.cnbc.com/2018/08/16/google-recruiters-share-the-3-part-formula-for-stronger-resumes.html" };
/** [S2] Google recruiters' resume workshop at UofT. */
export const T_S2: Citation = { title: "Google Resume Workshop", publisher: "University of Toronto CS Teaching Labs Ambassadors", year: "2025", url: "https://www.teach.cs.toronto.edu/ambassadors/blog/2025-events/google_resume_workshop" };
/** [S3] TARGETjobs technical CV guide (also cited by cv-rules-general.md). */
export const T_S3: Citation = { title: "Tips for a graduate technical CV: template and advice", publisher: "TARGETjobs", year: "2025", url: "https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice" };
export const T_S4: Citation = { title: "8 things Amazon recruiters say top job candidates do", publisher: "About Amazon", year: "c. 2023–24", url: "https://aboutamazon.com/news/workplace/successful-amazon-job-candidates" };
export const T_S5: Citation = { title: "Technical CV example", publisher: "Prospects", year: "2025", url: "https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/example-cvs/technical-cv-example" };
export const T_S6: Citation = { title: "Cracking the Coding Interview (résumé chapter; talk slides)", publisher: "Gayle Laakmann McDowell", year: "2015", url: "https://www.slideshare.net/slideshow/cracking-the-coding-interview-master-slide-deck/30274970" };
export const T_S7_CAREER: Citation = { title: "CV and cover letters", publisher: "Gradcracker Career Centre", year: "current", url: "https://www.gradcracker.com/career-centre/career-coach/2/cv-and-cover-letters" };
export const T_S7_EXPERIAN: Citation = GRADCRACKER_EXPERIAN;
export const T_S8_TECH: Citation = { title: "Top 5 tips for writing a great CV for technology applications (unverified)", publisher: "Bright Network", year: "current", url: "https://brightnetwork.co.uk/career-path-guides/technology-it-software-development/top-5-tips-writing-great-cv-technology-applications" };
export const T_S8_INTERN: Citation = BRIGHT_INTERNSHIP_CV;
export const T_S11: Citation = { title: "Writing a CV for graduate advertising, marketing and PR jobs", publisher: "TARGETjobs", year: "2025", url: "https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/writing-cv-graduate-advertising-marketing-and-pr-jobs" };
export const T_S12: Citation = { title: "Help to get your first job in marketing", publisher: "Chartered Institute of Marketing (CIM Scotland)", year: "2023", url: "https://regions.cim.co.uk/scotland/home/news/2023/help-to-get-your-first-job-in-marketing" };
export const T_S14: Citation = NOTTINGHAM_ATS;
export const T_S15: Citation = { title: "CV booklet (skill bars and graphics guidance)", publisher: "University of Strathclyde Careers", year: "2020", url: "https://careers.strath.ac.uk/Portals/63/Documents/CV%20booklet%202020_a_web.pdf" };
export const T_S16: Citation = { title: "Preparing for mobile interviews at Monzo", publisher: "Monzo", year: "current", url: "https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo" };
export const T_S17: Citation = { title: "2025 Developer Survey: Technology", publisher: "Stack Overflow", year: "2025", url: "https://survey.stackoverflow.co/2025/technology" };
export const T_S18: Citation = { title: "Octoverse: A new developer joins GitHub every second as AI leads TypeScript to #1", publisher: "GitHub Blog", year: "2025", url: "https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/" };
export const T_S19: Citation = { title: "Data science & analytics graduate jobs & schemes 2026", publisher: "TARGETjobs", year: "2026", url: "https://targetjobs.co.uk/graduate-jobs/it/data" };
export const T_S20: Citation = { title: "Types of job: Data scientist", publisher: "Royal Statistical Society", year: "n.d.", url: "https://rss.org.uk/jobs-careers/career-development/types-of-job/data-scientist/" };
export const T_S21: Citation = { title: "Student Researcher Program", publisher: "Google DeepMind", year: "2026", url: "https://deepmind.google/careers/internships/" };
export const T_S22: Citation = { title: "CVs and cover letters for PhDs and postdocs", publisher: "University of Cambridge Careers Service", year: "current", url: "https://www.careers.cam.ac.uk/files/phdpostdoccvbook.pdf" };
export const T_S23: Citation = { title: "What it's really like working as a Graduate Product Manager at Capital One", publisher: "TARGETjobs", year: "2023", url: "https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one" };
export const T_S24: Citation = { title: "The top 10 skills that'll get you a job when you graduate", publisher: "TARGETjobs", year: "current", url: "https://targetjobs.co.uk/careers-advice/skills-for-getting-a-job/what-are-top-10-skills-thatll-get-you-job-when-you-graduate" };
export const T_S25: Citation = { title: "[UA→GA4] Universal Analytics is going away", publisher: "Google Analytics Help", year: "2025", url: "https://support.google.com/analytics/answer/11583528" };
export const T_S26: Citation = { title: "Undergraduate Research Opportunities Programme (UROP)", publisher: "Imperial College London, Dept of Aeronautics", year: "current", url: "https://www.imperial.ac.uk/aeronautics/study/ug/current-students/undergraduate-research-opportunities-programme-urop/" };
export const T_S27: Citation = { title: "GSAS CVs and Cover Letters", publisher: "Harvard FAS Mignone Center", year: "2025", url: "https://cdn-careerservices.fas.harvard.edu/wp-content/uploads/sites/161/2025/08/gsas-cvs-and-cover-letters-2025.pdf" };
export const T_S29: Citation = { title: "What is a spring week, insight day or insight programme?", publisher: "TARGETjobs", year: "current", url: "https://targetjobs.co.uk/careers-advice/internships/what-spring-week-insight-day-or-insight-programme" };
export const T_S30: Citation = { title: "Which IT and technology employers offer summer internships or industrial placements?", publisher: "TARGETjobs", year: "2026", url: "https://targetjobs.co.uk/careers-advice/information-technology/which-it-and-technology-employers-offer-summer-internships-or-industrial-placements" };
