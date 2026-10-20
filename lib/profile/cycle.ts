import type { PlacementStatus, Year } from "@/lib/types";
import type { Track } from "@/lib/cv-rules/types";

/**
 * Spring week eligibility by graduation year. Firms word it as "first year of a three-year degree or second year of a
 * four-year degree", i.e. graduating two years after the spring week (spring 2027 → class of 2029). Year of study alone
 * is ambiguous: a 2nd year is penultimate on a 3-year degree but spring-week eligible on a 4-year one.
 * Dates are YYYY-MM-DD London days (todayLondon()).
 */

const yearOf = (today: string) => Number(today.slice(0, 4));
const monthOf = (today: string) => Number(today.slice(5, 7));

/** The spring the current applications are for: programmes run Mar–Apr, and next cycle's open from about May. */
export function springCycleYear(today: string): number {
  return monthOf(today) >= 5 ? yearOf(today) + 1 : yearOf(today);
}

/** The graduation year spring weeks are recruiting this cycle. */
export function springWeekGradYear(today: string): number {
  return springCycleYear(today) + 2;
}

/**
 * Best guess from the year of study, assuming a 3-year degree (the UK default); the student can correct it. A placement
 * year the student is doing (compulsory or chosen) adds a year for 1st and 2nd years; later years have it behind them.
 */
export function guessGradYear(year: Year, today: string, placement?: PlacementStatus | null): number {
  const academicStart = monthOf(today) >= 9 ? yearOf(today) : yearOf(today) - 1;
  const left: Record<Year, number> = { "1st": 3, "2nd": 2, penultimate: 2, final: 1, masters: 1 };
  const extra = (placement === "required" || placement === "opted_in") && (year === "1st" || year === "2nd") ? 1 : 0;
  return academicStart + left[year] + extra;
}

/**
 * Placement years (research/placement-year/03-eligibility.md): 9–15 months from June–September, applied for the year
 * before. Recruiting runs September to the summer, so from August the next cycle's placements are the ones on offer.
 */
export function placementStartYear(today: string): number {
  return monthOf(today) >= 8 ? yearOf(today) + 1 : yearOf(today);
}

/** The graduation year placements recruit: the final year comes after the placement (2027/28 → class of 2029). */
export function placementGradYear(today: string): number {
  return placementStartYear(today) + 2;
}

/** The degree has a placement year the student may take (compulsory, chosen, or optional and undecided). */
export function hasPlacementYear(status: PlacementStatus | null | undefined): boolean {
  return status === "required" || status === "opted_in" || status === "considering";
}

/** Applying for a placement this cycle: a placement degree, and the graduation year placements recruit (or a 2nd year). */
export function isPlacementEligible(s: { year: Year; gradYear: number | null; placementStatus?: PlacementStatus | null }, today: string): boolean {
  if (!hasPlacementYear(s.placementStatus)) return false;
  return s.gradYear != null ? s.gradYear === placementGradYear(today) : s.year === "2nd";
}

/** Graduation years a student can pick: this year to five years out (5-year degrees, foundation years). */
export function gradYearOptions(today: string): number[] {
  return Array.from({ length: 6 }, (_, i) => yearOf(today) + i);
}

export function isSpringWeekEligible(s: { year: Year; gradYear: number | null }, today: string): boolean {
  return s.gradYear != null ? s.gradYear === springWeekGradYear(today) : s.year === "1st";
}

/** CV scoring track for the profile panel: spring-week-eligible students are scored as spring applicants. */
export function scoreTrackFor(s: { year: Year; gradYear: number | null; placementStatus?: PlacementStatus | null }, today: string): Track {
  // A placement-year student applying this cycle is scored as a placement applicant first (their next summer is the placement).
  if (isPlacementEligible(s, today)) return "placement";
  return isSpringWeekEligible(s, today) ? "spring" : "standard";
}

/** The tracks a student can switch between on the profile: the ones they're eligible for, then internships. */
export function scoreTracksFor(s: { year: Year; gradYear: number | null; placementStatus?: PlacementStatus | null }, today: string): Track[] {
  const out: Track[] = [];
  if (isPlacementEligible(s, today)) out.push("placement");
  if (isSpringWeekEligible(s, today)) out.push("spring");
  return [...out, "standard"];
}

/** "BSc Economics with Placement Year", "MEng Mechanical Engineering (Year in Industry)", "sandwich": the course says so. */
const PLACEMENT_COURSE = /\bwith\s+(an?\s+)?(industrial\s+|professional\s+)?(placement|industrial|professional|work)\s*(year|experience|training|placement)?\b|\byear\s+in\s+(industry|employment|professional\s+practice)\b|\bsandwich\b|\bplacement\s+year\b|\bindustrial\s+placement\b/i;

export function placementHintFromCourse(course: string): PlacementStatus | null {
  return PLACEMENT_COURSE.test(course) ? "opted_in" : null;
}

/** University "secure a placement by" date when the student hasn't given theirs: 30 June of the placement's start year. */
export function defaultSecureBy(today: string): string {
  return `${placementStartYear(today)}-06-30`;
}

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type CountdownPhase = "main" | "late" | "final" | "passed";
/**
 * Days to the university deadline for securing a placement (research/placement-year/04-timeline-process.md):
 * "late" from 1 February (big schemes have closed; SMEs and startups recruit January–June), "final" in the last 30 days
 * (miss it and most universities move you onto the 3-year degree), "passed" after it.
 */
export function placementCountdown(today: string, secureBy: string | null | undefined): { secureBy: string; days: number; phase: CountdownPhase } {
  const by = secureBy && ISO.test(secureBy) && !Number.isNaN(Date.parse(secureBy)) ? secureBy : defaultSecureBy(today);
  const days = Math.round((Date.parse(`${by}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  const lateFrom = `${placementStartYear(today)}-02-01`;
  const phase: CountdownPhase = days < 0 ? "passed" : days <= 30 ? "final" : today >= lateFrom ? "late" : "main";
  return { secureBy: by, days, phase };
}
