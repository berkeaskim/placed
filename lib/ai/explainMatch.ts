import type { ParsedCV, Requirement, StudentProfile } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import type { CoverageResult } from "@/lib/scoring/coverage";
import {
  IMPORTANCE_RANK, capImportance, isMustHave, orderRequirementRows,
  type Explanation, type ExplanationGap, type RequirementRow,
} from "@/lib/scoring/requirements";
import { renderCvContent, stripPii } from "@/lib/cv-score/pii";
import { generateStructured, runAi } from "./provider";
import { SYSTEM_EXPLAIN, wrapJob } from "./prompts";
import { ExplainOutput, type ExplainOutputT } from "./schemas";
import { heuristicExplain } from "./heuristics";

export type { Explanation, RequirementRow } from "@/lib/scoring/requirements";

export type ExplainInput = { cv: ParsedCV | null; cvText: string; student: StudentProfile; job: JobListItem; coverage: CoverageResult };

/** tagJob requirements; for an untagged job, structural rows from keyword coverage (must -> high, nice -> preferred). */
export function requirementsFor(job: JobListItem, coverage: CoverageResult): Requirement[] {
  if (job.requirements.length) return job.requirements;
  return coverage.items.map((c) => ({
    text: c.skill, skill: c.skill, anyOf: c.anyOf, importance: c.section === "must" ? "high" : "preferred",
    section: c.section, evidenceTier: "structural",
  }));
}

const escapeData = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescapeData = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** The CV as the model sees it: named content fields only, PII-stripped (never parsed_json, whose `safety` holds injected text). */
function cvContent(cv: ParsedCV): string {
  return renderCvContent(stripPii(cv));
}

/** Requirements, title and posting text all come from the scraped JD, so all of them go inside the escaped wrapper. */
export function buildExplainPrompt(i: { cv: ParsedCV; job: JobListItem; reqs: Requirement[] }): string {
  const list = i.reqs.map((r, n) => `${n}. [${capImportance(r.importance, r.evidenceTier)}] ${r.text}`).join("\n");
  const posting = `REQUIREMENTS (importance already fixed):\n${list}\n\nPOSTING:\n${i.job.textLines.join("\n")}`;
  return `${wrapJob(posting, i.job.title)}\n\n<cv>\n${escapeData(cvContent(i.cv))}\n</cv>`;
}

/**
 * Raw model output (or a fixture recorded in the same shape) -> Explanation. Shared by the live and fixture
 * branches (C6) so both are post-processed identically:
 * - one row per tagJob requirement, by index; importance always from tagJob (two-pass rule), inferred capped;
 * - a requirement the model skipped is "partial";
 * - "strong" needs a cv_evidence quote found in the CV (whitespace/case-insensitive), else it becomes "partial";
 * - gaps with an unknown index or for a strong row are dropped; blocking only for critical/high (after the cap);
 * - rows ordered and trimmed by orderRequirementRows; gaps ordered by importance.
 */
export function toExplanation(raw: ExplainOutputT, reqs: Requirement[], cvHaystack: string): Explanation {
  const hay = norm(cvHaystack);
  const verified = (q: string | null) => {
    if (!q) return null;
    const quote = unescapeData(q).trim();
    return quote && hay.includes(norm(quote)) ? quote : null;
  };
  const byIndex = new Map<number, ExplainOutputT["rows"][number]>();
  for (const v of raw.rows) if (!byIndex.has(v.index)) byIndex.set(v.index, v);

  const rows: RequirementRow[] = reqs.map((r, n) => {
    const v = byIndex.get(n);
    let match: RequirementRow["match"] = v?.match ?? "partial";
    const evidence = match === "missing" ? null : verified(v?.cv_evidence ?? null);
    if (match === "strong" && !evidence) match = "partial";
    return {
      text: r.text, skill: r.skill, importance: capImportance(r.importance, r.evidenceTier), evidenceTier: r.evidenceTier,
      match, cvEvidence: evidence,
    };
  });

  const seen = new Set<number>();
  const gaps: { gap: ExplanationGap; rank: number }[] = [];
  for (const g of raw.gaps) {
    const row = Number.isInteger(g.index) ? rows[g.index] : undefined;
    if (!row || seen.has(g.index) || row.match === "strong") continue;
    seen.add(g.index);
    gaps.push({
      gap: { requirement: row.text, blocking: g.blocking && isMustHave(row.importance), adjacentExperience: g.adjacent_experience?.trim() || null, howToClose: g.how_to_close },
      rank: IMPORTANCE_RANK[row.importance],
    });
  }
  gaps.sort((a, b) => a.rank - b.rank);

  return {
    rows: orderRequirementRows(rows),
    whyFit: raw.why_fit.map((w) => w.trim()).filter(Boolean),
    gaps: gaps.map((x) => x.gap),
  };
}

function ordered(e: Explanation): Explanation {
  const rank = new Map(e.rows.map((r) => [r.text, IMPORTANCE_RANK[r.importance]]));
  return {
    ...e,
    rows: orderRequirementRows(e.rows),
    gaps: [...e.gaps].sort((a, b) => (rank.get(a.requirement) ?? 9) - (rank.get(b.requirement) ?? 9)),
  };
}

/**
 * Requirement table + why you fit + gaps (spec §7.1/§7.2). Smart tier, fixture-backed (fixtures/ai/explainMatch/<extId>.json,
 * raw schema shape). No CV -> deterministic heuristic, no AI call. A live AiError propagates so the UI can offer a retry.
 */
export async function explainMatch(i: ExplainInput): Promise<Explanation> {
  const reqs = requirementsFor(i.job, i.coverage);
  const fallback = () => ordered(heuristicExplain({
    requirements: reqs, coverage: i.coverage, cvText: i.cvText,
    archetypeMatch: Boolean(i.job.archetype) && i.student.archetypes[0]?.key === i.job.archetype,
  }));
  if (!i.cv || reqs.length === 0) return fallback();
  const cv = i.cv;
  const haystack = `${i.cvText}\n${cvContent(cv)}`;
  const map = (raw: ExplainOutputT) => toExplanation(raw, reqs, haystack);
  return runAi({
    fn: "explainMatch",
    fixtureKey: i.job.extId,
    schema: ExplainOutput,
    fromFixture: map,
    live: async () => map(await generateStructured({
      tier: "smart", system: SYSTEM_EXPLAIN, schema: ExplainOutput, maxTokens: 4000,
      parts: [{ type: "text", text: buildExplainPrompt({ cv, job: i.job, reqs }) }],
    })),
    fallback,
  });
}

// ---------- cache record (matches.explanation_json) ----------

/** Bump when toExplanation / the prompt change meaning: older cached rows are then recomputed. */
export const EXPLAIN_CACHE_VERSION = 1;

export type ExplainCacheRecord = { v: number; cvId: string | null; mode: "live" | "fixture"; explanation: Explanation };

export function toCacheRecord(explanation: Explanation, cvId: string | null, mode: "live" | "fixture"): ExplainCacheRecord {
  return { v: EXPLAIN_CACHE_VERSION, cvId, mode, explanation };
}

/** A cached explanation is reused only for the same active CV, AI mode and cache version, and only if well-formed. */
export function readCachedExplanation(json: unknown, cvId: string | null, mode: "live" | "fixture"): Explanation | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Partial<ExplainCacheRecord>;
  if (r.v !== EXPLAIN_CACHE_VERSION || r.cvId !== cvId || r.mode !== mode) return null;
  const e = r.explanation;
  if (!e || !Array.isArray(e.rows) || !Array.isArray(e.whyFit) || !Array.isArray(e.gaps)) return null;
  return e;
}
