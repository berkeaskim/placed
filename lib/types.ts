export const ARCHETYPES = [
  "software_eng", "data_analytics", "quant_trading", "consulting",
  "product", "finance_banking", "marketing_growth", "research",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  software_eng: "Software Engineering",
  data_analytics: "Data & Analytics",
  quant_trading: "Quant & Trading",
  consulting: "Consulting",
  product: "Product",
  finance_banking: "Finance & Banking",
  marketing_growth: "Marketing & Growth",
  research: "Research",
};

export const YEARS = ["1st", "2nd", "penultimate", "final", "masters"] as const;
export type Year = (typeof YEARS)[number];

export type FitLabel = "Strong fit" | "Good fit" | "Stretch" | "Not recommended";
export type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";
export type Region = "london" | "uk" | "europe" | "remote" | "other";

export interface RawJob {
  extId: string;
  title: string;
  url: string;
  location: string;
  remote: boolean;
  html: string;
  postedAt: string | null;
  /** YYYY-MM-DD close date from a structured ATS field (e.g. Workday endDate); wins over text extraction. */
  deadline?: string | null;
  /** YYYY-MM-DD the application window opens (curated programme cards). */
  opensOn?: string | null;
  /** Multi-employer listings (TargetJobs): the employer this posting is for. Null = the board's own company. */
  employerName?: string | null;
  /** The listing already says what this is (TargetJobs' "Placement" type): it skips the title keyword filter. */
  sourceType?: "placement" | null;
  /** Authoritative type from a curated programme card's `kind`; overrides the tagger. */
  employmentType?: JobForScoring["employmentType"] | null;
}

export type Importance = "critical" | "high" | "meaningful" | "preferred" | "low_signal";

export interface Requirement {
  text: string;
  skill: string | null;
  /** Set when the posting accepts alternatives ("Python or Java"): every skill in the group, this one included. */
  anyOf?: string[];
  importance: Importance;
  section: "must" | "nice";
  evidenceTier: "stated" | "structural" | "inferred";
}

export interface JobForScoring {
  id: string;
  title: string;
  location: string;
  remote: boolean;
  archetype: Archetype | null;
  yearEligibility: Year[];
  sponsorsVisa: "yes" | "no" | "unknown";
  employmentType: "internship" | "placement" | "spring_week" | "insight" | "graduate" | "permanent" | "other";
  firstYearFriendly: boolean;
  requirements: Requirement[];
  textLines: string[];
  deadline: string | null; // YYYY-MM-DD
  postedAt: string | null; // ISO
  cohortClash?: boolean; // term-time cohort (e.g. Winter); soft flag, default false
}

export interface ArchetypeScore {
  key: Archetype;
  score: number; // 0-100
  why: string[];
}

/** How the student may work in the UK; null = not said (treated as no visa needed). */
export const WORK_AUTH = ["uk_rtw", "student_visa", "graduate_visa", "needs_sponsorship"] as const;
export type WorkAuth = (typeof WORK_AUTH)[number];

export interface StudentProfile {
  year: Year;
  /** Expected graduation year; null/absent when the student hasn't said (eligibility then falls back to `year`). */
  gradYear?: number | null;
  locationPref: Region[];
  /** Derived from workAuth: anything but UK right to work. Kept for callers that only need yes/no. */
  needsVisa: boolean;
  workAuth?: WorkAuth | null;
  archetypes: ArchetypeScore[]; // sorted desc by score
  skills: string[]; // canonical skill names
}

export interface CvBullet {
  id: string;
  text: string;
}

export interface CvEntry {
  id: string;
  org: string;
  title: string;
  dates: string;
  location: string;
  bullets: CvBullet[];
}

export interface ParsedCV {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
  summary: string | null;
  education: { id: string; institution: string; degree: string; dates: string; grade: string | null; details: CvBullet[] }[];
  experience: CvEntry[];
  projects: CvEntry[];
  leadership: CvEntry[];
  skills: { group: string; items: string[] }[];
  interests: string | null;
  sectionOrder: string[]; // e.g. ["education","experience","projects","skills","interests"]
  yearGuess: Year | null;
  archetypes: ArchetypeScore[];
}

// ---------- Tailored CV (Task 22/23) ----------

/** How a tailored bullet relates to its cited source bullets (mirrors lib/verify/checks-extra ChangeType). */
export type TailorChangeType = "kept" | "reordered" | "rephrased" | "merged" | "dropped";

/**
 * A bullet in the tailored CV. `sourceRefs` cite source bullet ids (ParsedCV bullet/detail ids).
 * `changeType` is optional: verifyTailoring infers it when absent. A `dropped` bullet is never rendered.
 */
export type TailoredBullet = { id: string; text: string; sourceRefs: string[]; changeType?: TailorChangeType; dropReason?: string; qualifiersKept?: string[];
  /** Added from the bank by a no-AI swap: the bank text as-is ("added, not tailored — Tailor again to polish"). */
  untailored?: boolean };
export type TailoredEntry = { id: string; org: string; title: string; dates: string; location: string; bullets: TailoredBullet[] };
export type TailorChange = { bulletId: string; before: string; after: string; reason: string; jdRequirement: string | null; keywordsAdded: string[] };
export type TailoredCV = {
  summary: string | null; education: ParsedCV["education"]; experience: TailoredEntry[]; projects: TailoredEntry[]; leadership: TailoredEntry[];
  skills: { group: string; items: string[] }[]; interests: string | null; changes: TailorChange[];
};
