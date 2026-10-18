import type { Citation, CvRule, RuleAdjust } from "../types";

/**
 * Spring-week track (spring weeks and insight programmes for first-years).
 * Design and evidence: research/spring-weeks/05-application-content.md §4–6 and 07-cv-rules-design.md §2.
 * What changes: a first-year is screened on academics and activities, never on internships.
 */

const LANCASTER_FM_CV: Citation = { title: "Financial market CVs", publisher: "Lancaster University Management School Careers", year: "current", url: "https://www.lancaster.ac.uk/lums/careers/blogs/financial-market-cvs" };
const TARGETJOBS_CV: Citation = { title: "How to write a CV for a property graduate job (education section)", publisher: "TARGETjobs", year: "current", url: "https://targetjobs.co.uk/career-sectors/property/advice/324715-how-to-write-a-cv-for-a-property-graduate-job" };
const FINBOUND_SPRING_CV: Citation = { title: "Spring week CV guide", publisher: "Finbound", year: "current", url: "https://www.finbound.org/blog/spring-week-cv-guide" };
const EFC_GRAD_CV: Citation = { title: "The perfect graduate CV for investment banking", publisher: "eFinancialCareers", year: "2015", url: "https://www.efinancialcareers.com/news/2015/08/the-perfect-graduate-cv-for-investment-banking" };
const BRIGHT_FIRST_YEAR: Citation = { title: "Career timeline: first year at university", publisher: "Bright Network", year: "current", url: "https://www.brightnetwork.co.uk/uni-life/career-timeline-first-year-uni/" };

const SPRING = ["spring"] as const satisfies readonly ["spring"];

export const SPRING_RULES: CvRule[] = [
  {
    id: "SPR-01", sectors: "all", tracks: [...SPRING], dimension: "uk", check: "code", checker: "education_first", severity: "major", evidence: "A",
    statement: "Put Education first, straight after your contact details. For a spring week it's what you're screened on.",
    citations: [LANCASTER_FM_CV, FINBOUND_SPRING_CV],
  },
  {
    id: "SPR-02", sectors: "all", tracks: [...SPRING], dimension: "clarity", check: "code", checker: "gcse_summarised", severity: "minor", evidence: "B",
    statement: "Summarise GCSEs in one line, e.g. '10 GCSEs (9–7), including Maths 9 and English 8'. Don't list them one by one, and leave AS-levels off.",
    citations: [LANCASTER_FM_CV, TARGETJOBS_CV],
  },
  {
    id: "SPR-03", sectors: "all", tracks: [...SPRING], dimension: "uk", check: "code", checker: "pre_uni_grades", severity: "major", evidence: "B",
    statement: "List your A-levels (or IB, Highers, BTEC or equivalent) with the grades you achieved. In first year they're the main academic evidence you have.",
    citations: [TARGETJOBS_CV, FINBOUND_SPRING_CV],
  },
  {
    id: "SPR-04", sectors: "all", tracks: [...SPRING], dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Show one thing you did because you're interested in this sector: an event, a virtual work experience, Bloomberg Market Concepts, a stock pitch, a competition, or a society you're active in. Membership alone is thin. An internship is not expected.",
    llmGuidance: "Does the CV show at least one concrete, self-driven sign of interest in the sector of the target role, beyond membership alone? Counts: an insight day or spring week attended; a society event attended or organised; a named virtual work experience or job simulation (Forage, Bright Network); Bloomberg Market Concepts or another named course; a stock pitch, trading, case or coding competition; a personal portfolio or investing log; a blog or newsletter; regular named reading. Society membership plus one named activity passes. Never require an internship, a committee role or a finance employer. Never score employer, school or university brand.",
    passExample: "Investment Society (member): pitched a long on Tesco at the Oct 2026 stock-pitch night; Bloomberg Market Concepts (Sep 2026)",
    failExample: "Member, Finance Society",
    citations: [FINBOUND_SPRING_CV, BRIGHT_FIRST_YEAR],
  },
  {
    id: "SPR-05", sectors: "all", tracks: [...SPRING], dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Describe your part-time job, volunteering or school role with what you were trusted with and one concrete detail (customers per shift, people trained, money handled, how long you did it).",
    llmGuidance: "Is at least one part-time job, volunteering role or school-era position described with a responsibility the candidate held AND one concrete detail (a number, frequency, duration, amount, or people involved)? Answer not_applicable if the CV has no such entry.",
    passExample: "Sales Assistant, Tesco (Sat/Sun, Jun 2024 – Aug 2025): trained 3 new starters on the till; handled £2k+ cash per shift",
    failExample: "Sales Assistant, Tesco: worked on the till and stacked shelves",
    citations: [FINBOUND_SPRING_CV, LANCASTER_FM_CV],
  },
  {
    id: "SPR-06", sectors: "all", tracks: [...SPRING], dimension: "clarity", check: "llm", severity: "minor", evidence: "C",
    statement: "Keep school-era items to the substantial ones: positions of responsibility, national or regional results, EPQ, DofE, Young Enterprise, jobs. Cut minor school awards.",
    llmGuidance: "If the CV lists school-era items (before university), are they limited to substantial ones (positions of responsibility such as head student, prefect or captain; regional or national results such as UKMT, olympiads or competitions; EPQ; DofE; Young Enterprise; jobs or volunteering), with no minor school awards (attendance, form or effort prizes, subject certificates, Year 9 awards)? Answer not_applicable if there are no school-era items. Never judge the type, name or prestige of the school.",
    passExample: "Head Girl, Oakfield Academy (2024–25): chaired 12-member student council",
    failExample: "Year 10 Attendance Award; Form Prize for Effort",
    citations: [FINBOUND_SPRING_CV, LANCASTER_FM_CV],
  },
  {
    id: "SPR-07", sectors: "all", tracks: [...SPRING], dimension: "impact", check: "llm", severity: "minor", evidence: "D",
    statement: "Give the interviewer two or three specific things to ask you about: a result, an unusual job, a project, an interest with a level.",
    llmGuidance: "Does the CV contain at least two specific, distinctive items an interviewer could ask about (a named result or ranking, an unusual job, a project with an outcome, an interest with a level or time), as opposed to generic lines? Never reward class-coded hobbies over others.",
    passExample: "UKMT Senior Gold (2024); Grade 8 Piano (Distinction); built a Discord bot used by 200 students",
    failExample: "Interests: reading, football, travelling",
    citations: [EFC_GRAD_CV],
  },
];

/**
 * How existing rules behave on the spring track (07 §2.3). Merged into each rule's `trackAdjust.spring`, so
 * the whole spring policy is visible in one place. Skipped rules are replaced by an SPR rule or don't apply.
 */
export const SPRING_ADJUST: Record<string, RuleAdjust> = {
  "G-11": { maxPages: 1 },                       // one page for every first-year CV
  "G-21": { severity: "minor" },                 // few outcomes yet; G-20 (action verbs) stays major
  "G-22": { threshold: 0.2, severity: "minor" },
  "GEN-04": { threshold: 0.2, severity: "minor" },
  "FCQ-08": { threshold: 0.2, severity: "minor" },
  "CON-04": { threshold: 0.25, severity: "major" },
  "G-30": { severity: "minor" },                 // spring adverts list almost no skills
  "G-33": { skip: true },                        // → SPR-03 (deterministic)
  "G-34": { severity: "major" },                 // extracurriculars carry a first-year CV
  "EV-01": { severity: "minor" },                // part-time work is a bonus, not a requirement
  "FIN-04": { skip: true },                      // → SPR-04 (its pass bar assumed a spring week already done)
  "FIN-05": { skip: true },                      // → SPR-05
  "FIN-07": { skip: true },                      // no DCF/LBO expected; BMC/Excel count in SPR-04
  "FIN-13": { severity: "minor" },
  "FIN-14": { severity: "minor" },
  "QNT-02": { severity: "minor" },               // olympiads are *the* first-year quant signal (un-skips 1st year)
  "CON-02": { severity: "major" },
  "CON-08": { severity: "minor" },               // case competitions are rare in first term
  "G-31": { skip: true },                        // no generic skills list for first-years
  "AU-03": { skip: true },                       // education first legitimately fills the top third
};
