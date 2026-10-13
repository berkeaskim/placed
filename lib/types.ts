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
}

export type Importance = "critical" | "high" | "meaningful" | "preferred" | "low_signal";

export interface Requirement {
  text: string;
  skill: string | null;
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

export interface StudentProfile {
  year: Year;
  locationPref: Region[];
  needsVisa: boolean;
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
