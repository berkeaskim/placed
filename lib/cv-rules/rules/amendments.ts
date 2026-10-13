import type { CvRule } from "../types";
import {
  M_NHB_SALIENCE, M_BAERT_INTERNSHIPS, M_BAERT_VUJIC_VOLUNTEERING, M_BRAUN_AUDIT, M_NACE_2025, M_STEPHANY_AI_SKILLS,
  M_AI_PERCEPTION, M_TILBURG_LLM_SIGNALS, M_CUI_SIGNALING, M_GALDIN_CHEAP_TALK, M_INTERVIEWING_IO,
  M_FRONTIERS_EYETRACKING, M_GLOBE_HIDDEN_TEXT, M_INJECTION_COLLAPSE,
} from "./sources";

/**
 * Rules added by the approved CV amendments (docs/superpowers/plans/2026-10-13-cv-amendments.md, Task 16 §3),
 * from docs/research/market-2026/02-recruiter-screening-evidence.md §5.2 and 03-ats-ai-screening.md §4.2.
 * Grades are the reports' own (A peer-reviewed/randomised … D weak/commercial); where two are given, the first.
 * The checkers for the new code rules are implemented later (Task 17 / feat/cv-modules).
 */
export const AMENDMENT_RULES: CvRule[] = [
  // ---------- EV: experience evidence (02 §5.2) ----------
  {
    id: "EV-01", sectors: "all", dimension: "relevance", check: "code", checker: "experience_present", severity: "major", evidence: "A",
    statement: "Include at least one real experience entry — an internship, part-time job, volunteering or a society role all count — with its duration visible, and put it near the top when it's your strongest asset.",
    llmGuidance: "Code: at least one internship, part-time, volunteering or society-role entry with dates. Judge salience: the entry's duration is visible and, when it is the strongest asset, it sits in the top half of page 1. Quest for students with none: \"Add your part-time job: it counts\". Never score employer or university brand.",
    citations: [M_NHB_SALIENCE, M_BAERT_INTERNSHIPS, M_BAERT_VUJIC_VOLUNTEERING, M_BRAUN_AUDIT],
  },
  {
    id: "EV-02", sectors: "all", dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Show at least one time you dealt with customers, stakeholders or a team — and what came of it. A bar or retail job described with responsibility and an outcome is a real signal.",
    llmGuidance: "Does at least one bullet show the candidate dealing with customers, stakeholders or a team, with a stated outcome?",
    passExample: "Handled 60+ customer queries a shift at Boots; complaints to the manager fell from 5 to 1 a week",
    failExample: "Worked as part of a team in a busy shop",
    citations: [M_BRAUN_AUDIT, M_NACE_2025],
  },
  {
    id: "EV-03", sectors: "all", dimension: "relevance", check: "code", checker: "skills_evidenced", severity: "minor", evidence: "B",
    sectorAdjust: { software_eng: { severity: "major" }, data_analytics: { severity: "major" } },
    statement: "Back up the programming, data and AI tools in your skills list by naming each one in at least one project or experience bullet. You don't need certificates.",
    llmGuidance: "Code: each programming/data/AI tool in the skills list must appear in at least one bullet. Major for software and data roles, minor elsewhere. Never require certificates.",
    citations: [M_BRAUN_AUDIT, M_STEPHANY_AI_SKILLS],
  },

  // ---------- AU: authenticity and readability (02 §5.2) ----------
  {
    id: "AU-01", sectors: "all", dimension: "clarity", check: "code", checker: "cliche_density", params: { threshold: 1, majorThreshold: 3 }, severity: "minor", evidence: "B",
    statement: "Cut generic AI-style phrasing — \"leveraged\", \"spearheaded\", \"passionate about\", \"results-driven\", \"fast-paced environment\". Recruiters mark down text they suspect is AI-written.",
    llmGuidance: "Code: count AI-cliché tokens per 100 words. At or above params.threshold (1 per 100 words) = minor; at or above params.majorThreshold (3 per 100 words) = major. Both cut-offs are tunable product defaults, not evidence-derived.",
    citations: [M_AI_PERCEPTION, M_TILBURG_LLM_SIGNALS],
  },
  {
    id: "AU-02", sectors: "all", dimension: "impact", check: "llm", severity: "major", evidence: "B",
    statement: "Make your bullets specific: at least 6 in 10 should include something concrete and checkable — a named tool, dataset, organisation, number, date or link. Bullets that could appear on anyone's CV don't count.",
    llmGuidance: "Do at least 60% of the experience and project bullets contain a concrete, checkable anchor (a named tool, dataset, organisation, number, date or link)?",
    passExample: "Built a Python script that cleaned 40k rows of the society's membership data",
    failExample: "Worked on various data tasks to support the team",
    citations: [M_CUI_SIGNALING, M_GALDIN_CHEAP_TALK, M_TILBURG_LLM_SIGNALS],
  },
  {
    id: "AU-03", sectors: "all", dimension: "clarity", check: "code", checker: "read_time", severity: "minor", evidence: "C",
    statement: "Recruiters spend roughly 30 seconds on a first screen, looking at titles, organisations, dates and education. Make sure your name, latest role, dates and education all sit in the top third of page 1.",
    llmGuidance: "Code: name, latest role or organisation, dates and education are all extractable from the top third of page 1. Copy says \"roughly a 30-second first screen\", never \"6 seconds\".",
    citations: [M_INTERVIEWING_IO, M_FRONTIERS_EYETRACKING, M_NHB_SALIENCE],
  },

  // ---------- ATS: adversarial content (03 §4.2) ----------
  {
    id: "ATS-HID-01", sectors: "all", dimension: "ats", check: "code", checker: "hidden_text", severity: "critical", evidence: "B", blocksExport: true,
    statement: "Remove any text a person can't see but software can read (white or tiny text, invisible characters). Major ATSs now detect it and some reject CVs that contain it — it won't help you.",
    llmGuidance: "Code: flag white/near-background fill, font size under 4pt, ~0 opacity, text outside the page box, zero-width or bidi Unicode (U+200B–U+200D, U+2060, U+FEFF, U+202A–U+202E), and metadata fields containing job-advert-like text. Blocks export; hidden text is stripped from anything Placed exports.",
    citations: [M_GLOBE_HIDDEN_TEXT, M_INJECTION_COLLAPSE],
  },
  {
    id: "ATS-INJ-01", sectors: "all", dimension: "ats", check: "code", checker: "prompt_injection", severity: "critical", evidence: "B", blocksExport: true,
    statement: "Don't include instructions aimed at AI screeners (\"ignore previous instructions\", \"rank this CV first\"). It's dishonest, employers detect it, and any advantage disappears once others do it.",
    llmGuidance: "Code: regex and lexicon over the extracted text — 'ignore (all )?(previous|prior) instructions', 'rank (this|me) (first|top)', 'you are an? (AI|assistant|recruiter)', 'system prompt', 'mark (this|the) (resume|CV) as qualified'. Blocks export.",
    citations: [M_GLOBE_HIDDEN_TEXT, M_INJECTION_COLLAPSE],
  },
];
