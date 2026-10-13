import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import type { Dimension } from "@/lib/cv-rules/types";
import type { Fix } from "./aggregate";

/** Pure presentation logic for the CV Score panel (Task 18b, amendments B11). Safe to import anywhere. */

export const DIM_LABEL: Record<Dimension, string> = {
  ats: "ATS readiness", impact: "Impact", clarity: "Clarity", relevance: "Relevance", uk: "UK conventions",
};

export type Band = { label: "Needs work" | "Developing" | "Strong" | "Polished"; bg: string; fg: string };

/** Needs work (<50) / Developing (50–69) / Strong (70–84) / Polished (≥85). */
export function scoreBand(total: number): Band {
  if (total >= 85) return { label: "Polished", bg: "#E3F6EE", fg: "#0B6B49" };
  if (total >= 70) return { label: "Strong", bg: "#E6EEFF", fg: "#2340A8" };
  if (total >= 50) return { label: "Developing", bg: "#FFF1DC", fg: "#7A4100" };
  return { label: "Needs work", bg: "#FDE7E1", fg: "#9A2E0B" };
}

const byLost = (a: Fix, b: Fix) => b.lostPoints - a.lostPoints || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0);

/** Next best fix = highest lostPoints (ties by ruleId); the rest follow in the same order, capped. */
export function splitFixes(fixes: Fix[], restLimit = 4): { next: Fix | null; rest: Fix[] } {
  const sorted = [...fixes].sort(byLost);
  return { next: sorted[0] ?? null, rest: sorted.slice(1, 1 + restLimit) };
}

/** Evidence C or D → "Convention" tag (spec §6.4). Derived from the grade, not trusted from stored JSON. */
export const isConvention = (f: Pick<Fix, "evidence">) => f.evidence === "C" || f.evidence === "D";

export function sourceChip(f: Pick<Fix, "citation" | "evidence">): { label: string; href: string | null } {
  if (!f.citation) return { label: `Common practice · Evidence ${f.evidence}`, href: null };
  const href = /^https?:\/\//i.test(f.citation.url) ? f.citation.url : null;
  return { label: `Source: ${f.citation.publisher} · Evidence ${f.evidence}`, href };
}

/** SVG polyline points for totals (0–100) in a width×height box; null when there is no trend to show (<2 points). */
export function sparklinePoints(totals: number[], width: number, height: number): string | null {
  if (totals.length < 2) return null;
  const step = width / (totals.length - 1);
  const r = (n: number) => Math.round(n * 100) / 100;
  return totals
    .map((t, i) => `${r(i * step)},${r(height - (Math.min(100, Math.max(0, t)) / 100) * height)}`)
    .join(" ");
}

export type HistoryRow = { total: number; created_at: string; cvs: { uploaded_at: string } | null };

/** Past totals for one sector, oldest first: by CV upload time (one row per cv × sector), falling back to score time. */
export function historyTotals(rows: HistoryRow[]): number[] {
  const t = (r: HistoryRow) => Date.parse(r.cvs?.uploaded_at ?? r.created_at) || 0;
  return [...rows].sort((a, b) => t(a) - t(b) || Date.parse(a.created_at) - Date.parse(b.created_at)).map((r) => r.total);
}

export const rulesPassedLabel = (passed: number, assessed: number) => `Rules passed ${passed}/${assessed}`;
export const couldntAssessLabel = (n: number) => (n > 0 ? `${n} couldn't assess` : null);

export const disclaimer = (sector: Archetype) =>
  `Measures how well your CV follows evidence-based conventions for ${ARCHETYPE_LABELS[sector]}. It does not predict whether you'll get an interview.`;

export const IMAGE_ONLY_CAP_COPY = "We couldn't read this CV — try another file or take the quiz";

/** Every cap is shown (never hidden); the image-only cap additionally links to the quiz. */
export function capBanners(caps: string[]): { text: string; imageOnly: boolean }[] {
  return caps.map((text) => ({ text, imageOnly: /^image-only/i.test(text) }));
}

export const barColor = (v: number) => (v >= 75 ? "#0E8A5F" : v >= 60 ? "#5B3DF5" : "#C2410C");
