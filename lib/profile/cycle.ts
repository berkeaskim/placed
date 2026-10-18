import type { Year } from "@/lib/types";
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

/** Best guess from the year of study, assuming a 3-year degree (the UK default); the student can correct it. */
export function guessGradYear(year: Year, today: string): number {
  const academicStart = monthOf(today) >= 9 ? yearOf(today) : yearOf(today) - 1;
  const left: Record<Year, number> = { "1st": 3, "2nd": 2, penultimate: 2, final: 1, masters: 1 };
  return academicStart + left[year];
}

/** Graduation years a student can pick: this year to five years out (5-year degrees, foundation years). */
export function gradYearOptions(today: string): number[] {
  return Array.from({ length: 6 }, (_, i) => yearOf(today) + i);
}

export function isSpringWeekEligible(s: { year: Year; gradYear: number | null }, today: string): boolean {
  return s.gradYear != null ? s.gradYear === springWeekGradYear(today) : s.year === "1st";
}

/** CV scoring track for the profile panel: spring-week-eligible students are scored as spring applicants. */
export function scoreTrackFor(s: { year: Year; gradYear: number | null }, today: string): Track {
  return isSpringWeekEligible(s, today) ? "spring" : "standard";
}
