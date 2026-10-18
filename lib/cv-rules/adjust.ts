import type { Archetype, Year } from "@/lib/types";
import type { Citation, CvRule, RuleAdjust, Severity, Track } from "./types";

/**
 * The adjustment that applies: the track's if it has one, else the year's (the track describes the application).
 * A sector's own yearAdjust (sectorAdjust[sector].yearAdjust) replaces the rule's yearAdjust for that sector.
 */
export function adjustFor(rule: CvRule, year: Year, track: Track = "standard", sector?: Archetype): RuleAdjust | undefined {
  const years = (sector && rule.sectorAdjust?.[sector]?.yearAdjust) || rule.yearAdjust;
  return rule.trackAdjust?.[track] ?? years?.[year];
}

const RANK: Record<Severity, number> = { minor: 1, major: 2, critical: 3 };

/**
 * Severity after every override (track, then year, then sector, then base), capped by evidence: only A/B-graded
 * rules can be critical (audit 04#8). Weak evidence lowers how hard a rule can bite; it is not a weight multiplier.
 */
export function resolvedSeverity(rule: CvRule, sector: Archetype, year: Year, track: Track = "standard"): Severity {
  const s = adjustFor(rule, year, track, sector)?.severity ?? rule.sectorAdjust?.[sector]?.severity ?? rule.severity;
  return (rule.evidence === "C" || rule.evidence === "D") && RANK[s] > RANK.major ? "major" : s;
}

/** Numeric threshold after overrides (track/year, then sector, then params). */
export function resolvedThreshold(rule: CvRule, sector: Archetype | undefined, year: Year, track: Track = "standard"): number | undefined {
  return adjustFor(rule, year, track, sector)?.threshold ?? (sector ? rule.sectorAdjust?.[sector]?.threshold : undefined) ?? rule.params?.threshold;
}

/** Page limit after overrides (track/year, then sector, then params). */
export function resolvedMaxPages(rule: CvRule, sector: Archetype | undefined, year: Year, track: Track = "standard"): number | undefined {
  return adjustFor(rule, year, track, sector)?.maxPages ?? (sector ? rule.sectorAdjust?.[sector]?.maxPages : undefined) ?? rule.params?.maxPages;
}

/** The statement the student sees for this sector. */
export function resolvedStatement(rule: CvRule, sector: Archetype): string {
  return rule.sectorAdjust?.[sector]?.statement ?? rule.statement;
}

/** Citations for this sector: the sector's own first, then the rule's (deduplicated by URL). */
export function resolvedCitations(rule: CvRule, sector: Archetype): Citation[] {
  const all = [...(rule.sectorAdjust?.[sector]?.citations ?? []), ...rule.citations];
  return all.filter((c, i) => all.findIndex((x) => x.url === c.url) === i);
}
