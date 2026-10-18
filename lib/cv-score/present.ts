import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import type { Dimension } from "@/lib/cv-rules/types";
import { IMAGE_ONLY_CAP, type Fix } from "./aggregate";

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

/** Real gain from fixing (04#5); rows stored before the audit only have the rounded lostPoints. */
export const fixGain = (f: Pick<Fix, "lostPoints"> & { gain?: number }) => (typeof f.gain === "number" ? f.gain : f.lostPoints);
const byLost = (a: Fix, b: Fix) => fixGain(b) - fixGain(a) || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0);

/**
 * Neutral "worth" label for a fix (04#5, #23): the real gain, never "+0". Under one point reads "<1 pt"; while a cap
 * holds the total down, a fix that can't lift it says so.
 */
export function fixWorthLabel(f: Pick<Fix, "lostPoints"> & { gain?: number }, capped = false): string {
  const g = fixGain(f);
  if (g < 0.05 && capped) return "after the cap is fixed";
  const n = Math.round(g);
  return n >= 1 ? `worth ~${n} pt${n === 1 ? "" : "s"}` : "worth <1 pt";
}

/** Next best fix = highest gain (ties by ruleId); the rest follow in the same order, capped. */
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

/** "Provisional: 62–88" for a score with too little assessed to show one number (04#1). */
export const provisionalLabel = (r: { low: number; high: number }) => `${r.low}–${r.high}`;

/** Share of the rules (by weight) that got a verdict. */
export const coverageLabel = (coverage: number) => `${Math.round(coverage * 100)}% of rules assessed`;

/**
 * Which AI judged this score (04#10): scores from different models aren't comparable. Local models are labelled
 * experimental until one is validated against human labels.
 */
export function judgeLabel(scoredBy: string | null): string | null {
  if (!scoredBy || scoredBy === "fixture" || scoredBy === "off") return null;
  const [provider, ...rest] = scoredBy.split(":");
  const model = rest.join(":") || "unknown model";
  const name = provider === "anthropic" ? "Claude" : provider === "gemini" ? "Gemini" : provider === "ollama" ? "local model" : provider;
  return provider === "ollama" ? `Judged by ${model} (${name}, experimental)` : `Judged by ${name} (${model})`;
}

/** What redaction does, shown in "How this score works" (replaces the scored G-37 guardrail, 04#14). */
export const FAIRNESS_NOTE =
  "We remove your name, contact details, visa status and sensitive personal terms before the AI reads your CV. University and school names are kept because rules check your education section; the AI is told not to consider their prestige.";

/** The model card (what the score measures and doesn't, models, known biases). Public repo, so a plain link works offline-first too. */
export const MODEL_CARD_URL = "https://github.com/berkeaskim/placed/blob/main/docs/validation/MODEL_CARD.md";

/** 04#28: shown when the scored PDF was rendered by Placed's tailor. */
export const SELF_PREFERENCE_LABEL = "Judged by the same AI family that tailored it";
export const SELF_PREFERENCE_NOTE =
  "This CV was made with Placed's tailor, and the score comes from the same AI provider that rewrote it. AI judges tend to rate their own writing more kindly, so a higher score than your original CV isn't proof that this version is better. Your trend only compares CVs made the same way.";

/** 04#30: after an edit, say which verdicts were re-checked, so a change elsewhere isn't read as progress or AI noise. */
export function deltaLabel(d: { reused: number; rejudged: number } | null): string | null {
  if (!d || d.reused === 0) return null;
  return `After your edit the AI re-checked ${d.rejudged} rule${d.rejudged === 1 ? "" : "s"} your changes could affect; the other ${d.reused} kept their earlier verdict.`;
}

/** 04#25: an "I disagree" is shown on the verdict; it never hides or flips it. */
export const DISPUTED_TITLE = "You disagreed with this. It still counts in your score; we use disagreements to review our rules.";

export const disclaimer = (sector: Archetype) =>
  `Measures how well your CV follows evidence-based conventions for ${ARCHETYPE_LABELS[sector]}. It does not predict whether you'll get an interview.`;

export const IMAGE_ONLY_CAP_COPY = "We couldn't read this CV — try another file or take the quiz";

/** Every cap is shown (never hidden); the image-only cap additionally links to the quiz. */
export function capBanners(caps: string[]): { text: string; imageOnly: boolean }[] {
  return caps.map((text) => ({ text, imageOnly: text === IMAGE_ONLY_CAP }));
}

/** Screen-reader summary of the personal sparkline. */
export const sparklineLabel = (h: number[]) => `Score history: first ${h[0]}, latest ${h[h.length - 1]}, ${h.length} points`;

export const barColor = (v: number) => (v >= 75 ? "#0E8A5F" : v >= 60 ? "#5B3DF5" : "#C2410C");
