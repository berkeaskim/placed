import { ARCHETYPES, type Archetype } from "@/lib/types";
import type { Citation, CvRule, RuleAdjust } from "../types";

/**
 * Placement-year track (2nd-year applicants for 9–15 month placements). A light track: the standard rules mostly hold,
 * but first-year marks, modules and one project carry the CV because there is no internship yet.
 * Design and evidence: research/placement-year/05-application-content.md §3–4(a).
 */

const HIGHERIN_PLACEMENT_CV: Citation = { title: "How to write a CV for a placement or work experience", publisher: "Higherin (RateMyPlacement)", year: "current", url: "https://higherin.com/careers-advice/application-tips/placement-work-experience-cv" };
export const NEWCASTLE_ENG_CV: Citation = { title: "How to write a winning CV for an engineering student", publisher: "Newcastle University", year: "current", url: "https://international-blogs.ncl.ac.uk/blog/how-to-write-a-winning-cv-for-an-engineering-student" };
export const BRIGHTON_STEM_CV: Citation = { title: "STEM placements CV example guide", publisher: "University of Brighton", year: "2022", url: "https://blogs.brighton.ac.uk/stemplacements/files/2022/09/CV-EXAMPLE-GUIDE-STEM.pdf" };
const SOTON_PLACEMENT_PREP: Citation = { title: "Preparing for placement (first-year module marks on your CV)", publisher: "University of Southampton", year: "current", url: "https://www.southampton.ac.uk/healthsciences/undergraduate/placements/hmpr/hmpr_students/preparing.page" };

const PLACEMENT = ["placement"] as const satisfies readonly ["placement"];
/**
 * PLC-03 (modules) and PLC-04 (project write-up) have sector versions for engineering and science: STM-01, ENG-02 and
 * SCI-03 (research/placement-year/07 §1.3). One question, one rule, so those sectors get the sector version only.
 */
const NON_STEM: Archetype[] = ARCHETYPES.filter((a) => a !== "engineering" && a !== "science_pharma");

export const PLACEMENT_RULES: CvRule[] = [
  {
    id: "PLC-01", sectors: "all", tracks: [...PLACEMENT], dimension: "uk", check: "code", checker: "first_year_marks", severity: "major", evidence: "B",
    statement: "Show your first-year result: an average or class ('Year 1: 68% (First)') or 2–4 strong module marks. Placement screeners have no other university grade to go on. Add your predicted class only if your department gives one.",
    citations: [SOTON_PLACEMENT_PREP, HIGHERIN_PLACEMENT_CV],
  },
  {
    id: "PLC-02", sectors: "all", tracks: [...PLACEMENT], dimension: "uk", check: "code", checker: "placement_grad_date", severity: "major", evidence: "C",
    statement: "Show your expected graduation year including your placement year, and say the course includes one (e.g. 'BEng Mechanical Engineering with Industrial Placement, 2025–2029 (expected)'). A three-year date makes you look ineligible.",
    citations: [BRIGHTON_STEM_CV],
  },
  {
    id: "PLC-03", sectors: NON_STEM, tracks: [...PLACEMENT], dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "List 3–6 modules relevant to this placement, with marks where they're strong. In STEM, your modules and projects stand in for work experience.",
    llmGuidance: "Does the Education entry list at least three modules (or coursework units) relevant to the target role, ideally with marks? Pass if relevant modules are named, even without marks. Not applicable if the CV is for a non-degree applicant. Never judge the university's name or prestige.",
    passExample: "Relevant modules: Thermodynamics (72%), Engineering Design (75%), Materials (68%)",
    failExample: "BEng Mechanical Engineering, University of X, 2025–2029",
    citations: [HIGHERIN_PLACEMENT_CV, NEWCASTLE_ENG_CV],
  },
  {
    id: "PLC-04", sectors: NON_STEM, tracks: [...PLACEMENT], dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Write up one academic, group or personal project like a job: your role, the tools or methods (CAD, MATLAB, Python, lab techniques, Excel) and the outcome (a mark, a test result, a working prototype, a ranking).",
    llmGuidance: "Is at least one academic, group or personal project described with the candidate's own role, a named tool or method, and an outcome (mark, result, working output, ranking)? Group work passes if the candidate's own part is clear.",
    passExample: "Group design project (4 people): modelled gearbox in SolidWorks and ran FEA on the shaft; design scored 74%, top 3 of 20 teams",
    failExample: "Did a group project on gearboxes",
    citations: [BRIGHTON_STEM_CV, NEWCASTLE_ENG_CV],
  },
  {
    id: "PLC-05", sectors: ["software_eng", "data_analytics", "research", "engineering"], tracks: [...PLACEMENT], dimension: "relevance", check: "llm", severity: "minor", evidence: "C",
    statement: "Name your technical tools with a level and where you used them ('SolidWorks: 2nd-year gearbox design project'; 'HPLC: organic chemistry lab'), grouped by type.",
    llmGuidance: "Are technical tools named with a level or a place they were used, rather than as a bare list? Never require a specific tool; judge only specificity.",
    passExample: "Python (pandas, 2nd-year data project); SQL (society membership database); MATLAB (signals coursework)",
    failExample: "Skills: Python, SQL, MATLAB, Excel",
    citations: [NEWCASTLE_ENG_CV],
  },
];

// PLC-05 is not for science_pharma: SCI-02 already asks for each technique with where it was used, on every track.

/** How existing rules behave on the placement track (05 §4a); merged into each rule's `trackAdjust.placement`. */
export const PLACEMENT_ADJUST: Record<string, RuleAdjust> = {
  "G-21": { severity: "minor" },                  // no professional outcomes yet; G-20 (action verbs) stays major
  "G-22": { threshold: 0.3 },                     // between spring (0.2) and standard (0.4)
  "GEN-04": { threshold: 0.3 },
  "FCQ-08": { threshold: 0.3 },
  "CON-04": { threshold: 0.35, severity: "major" },
  "G-34": { severity: "major" },                  // competency frameworks are often evidenced from societies
};

/** Spring rules that also apply on the placement track (05 §4a): GCSEs on one line, only substantial school-era items. */
export const SHARED_WITH_SPRING = ["SPR-02", "SPR-06"] as const;
