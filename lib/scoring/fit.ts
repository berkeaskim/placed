import type { Archetype, FitLabel, JobForScoring, Region, StudentProfile, Year } from "@/lib/types";
import { classifyRegion } from "@/lib/ingest/filter";
import type { CoverageResult } from "./coverage";
import { daysUntil, isValidDate } from "./dates";

export const FIT_WEIGHTS = { archetype: 0.35, coverage: 0.25, location: 0.15, accessibility: 0.25 } as const;
const GATE_CAP = 2.5;
const SOFT_FLAG_PENALTY = 0.5;

const ADJACENT: [Archetype, Archetype][] = [
  ["software_eng", "data_analytics"], ["data_analytics", "quant_trading"], ["quant_trading", "finance_banking"],
  ["finance_banking", "consulting"], ["consulting", "product"], ["product", "software_eng"],
  ["marketing_growth", "product"], ["research", "data_analytics"], ["research", "quant_trading"],
];
const isAdjacent = (a: Archetype, b: Archetype) => ADJACENT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const YEAR_LABEL: Record<Year, string> = { "1st": "1st year", "2nd": "2nd year", penultimate: "penultimate year", final: "final year", masters: "masters" };

export type Gate = { key: "year" | "permanent" | "location" | "visa"; passed: boolean; reason?: string };
export type FitResult = {
  global: number; label: FitLabel; gates: Gate[]; capped: boolean;
  sub: { archetype: number; coverage: number; location: number; accessibility: number }; softFlags: string[];
};

export function labelFor(g: number): FitLabel {
  if (g >= 4.5) return "Strong fit";
  if (g >= 4.0) return "Good fit";
  if (g >= 3.5) return "Stretch";
  return "Not recommended";
}

function archetypeSub(student: StudentProfile, job: JobForScoring): number {
  if (!job.archetype || student.archetypes.length === 0) return 3;
  const keys = student.archetypes.map((a) => a.key);
  if (keys[0] === job.archetype) return 5;
  if (keys.slice(0, 2).includes(job.archetype)) return 4;
  if (keys.slice(0, 2).some((k) => isAdjacent(k, job.archetype!))) return 3;
  return 1.5;
}

function locationSub(region: Region, job: JobForScoring, prefs: Region[]): number {
  if (prefs.length === 0) return 4;
  // No location published is absence of signal, not a mismatch: neutral, and it passes the gate.
  if (!job.location.trim() && !job.remote) return 3.5;
  if (prefs.includes(region)) return 5;
  if ((job.remote || region === "remote") && prefs.includes("remote")) return 5;
  if (region === "london" && prefs.includes("uk")) return 5;
  if (region === "uk" && prefs.includes("london")) return 3.5;
  if (job.remote || region === "remote") return 4;
  if (/hybrid/i.test(job.location)) return 3;
  return 2;
}

function accessibilitySub(student: StudentProfile, job: JobForScoring, today: string): number {
  let s: number;
  if (!isValidDate(job.deadline)) s = 3.5;
  else {
    const d = daysUntil(job.deadline, today);
    s = d < 0 ? 1 : d <= 3 ? 3 : d <= 30 ? 4.5 : 4;
  }
  if (job.postedAt && daysUntil(today, job.postedAt.slice(0, 10)) > 60) s -= 0.5;
  if (job.firstYearFriendly && (student.year === "1st" || student.year === "2nd")) s += 0.5;
  return Math.min(5, Math.max(1, s));
}

export function scoreFit(student: StudentProfile, job: JobForScoring, coverage: CoverageResult, today: string): FitResult {
  const region = classifyRegion(job.location, job.remote);
  const loc = locationSub(region, job, student.locationPref);
  const gates: Gate[] = [
    job.yearEligibility.length > 0 && !job.yearEligibility.includes(student.year)
      ? { key: "year", passed: false, reason: `Open to ${job.yearEligibility.map((y) => YEAR_LABEL[y]).join(" / ")} only` }
      : { key: "year", passed: true },
    job.employmentType === "permanent"
      ? { key: "permanent", passed: false, reason: "Permanent full-time role" }
      : { key: "permanent", passed: true },
    loc <= 2 ? { key: "location", passed: false, reason: `Outside your locations (${job.location || "unknown"})` } : { key: "location", passed: true },
    student.needsVisa && job.sponsorsVisa === "no"
      ? { key: "visa", passed: false, reason: "No visa sponsorship" }
      : { key: "visa", passed: true },
  ];
  const softFlags: string[] = [];
  if (job.postedAt && daysUntil(today, job.postedAt.slice(0, 10)) > 90) softFlags.push("Posted over 90 days ago");
  if (job.cohortClash) softFlags.push("Term-time cohort (e.g. Winter)");

  const sub = {
    archetype: archetypeSub(student, job),
    coverage: coverage.weighted === null ? 3 : 1 + 4 * coverage.weighted,
    location: loc,
    accessibility: accessibilitySub(student, job, today),
  };
  let g = FIT_WEIGHTS.archetype * sub.archetype + FIT_WEIGHTS.coverage * sub.coverage +
    FIT_WEIGHTS.location * sub.location + FIT_WEIGHTS.accessibility * sub.accessibility - SOFT_FLAG_PENALTY * softFlags.length;
  g = Math.min(5, Math.max(1, g));
  const capped = gates.some((x) => !x.passed);
  if (capped) g = Math.min(g, GATE_CAP);
  const global = Math.round((g + 1e-9) * 10) / 10; // epsilon: 4.655 must round to 4.7, not 4.6
  return { global, label: labelFor(global), gates, capped, sub, softFlags };
}
