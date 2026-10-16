import { createHash } from "node:crypto";
import type { ParsedCV, Requirement, StudentProfile } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import type { CoverageResult } from "@/lib/scoring/coverage";
import {
  IMPORTANCE_RANK, capImportance, isMustHave, orderRequirementRows,
  type Explanation, type ExplanationGap, type RequirementRow,
} from "@/lib/scoring/requirements";
import { renderCvContent, stripPii } from "@/lib/cv-score/pii";
import { canonicalize, extractSkills } from "@/lib/skills/extract";
import { escapeRegex, stripListMarker } from "@/lib/text/regex";
import { aiMode } from "@/lib/env";
import { AiError, generateStructured, runAi } from "./provider";
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
const wordCount = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’.+#-]*/gu) ?? []).length;

/** The CV as the model sees it: named content fields only, PII-stripped (never parsed_json, whose `safety` holds injected text). */
function cvContent(cv: ParsedCV): string {
  return renderCvContent(stripPii(cv));
}

/**
 * The lines a Strong quote may come from: the CV's raw text plus its real content fields (summary, bullets, skills,
 * education details, interests). Never renderCvContent's fixed headings ("CV", "SKILLS") or "(none)" placeholders.
 */
export function cvEvidenceLines(cv: ParsedCV | null, cvText: string): string[] {
  const out = cvText.split("\n");
  if (cv) {
    const entries = [...(cv.experience ?? []), ...(cv.projects ?? []), ...(cv.leadership ?? [])];
    out.push(cv.summary ?? "", cv.interests ?? "");
    for (const e of entries) out.push(e.title, ...e.bullets.map((b) => b.text));
    for (const g of cv.skills ?? []) out.push(`${g.group}: ${g.items.join(", ")}`, ...g.items);
    for (const e of cv.education ?? []) out.push(e.degree, ...e.details.map((d) => d.text));
  }
  return [...new Set(out.map(norm).filter(Boolean))];
}

/** Minimum for a Strong quote: ≥ 3 words and ≥ 15 characters, or (≥ 2 words and) ≥ 60% of the CV line it comes from. */
export const QUOTE_MIN_WORDS = 3;
export const QUOTE_MIN_CHARS = 15;
export const QUOTE_MIN_LINE_SHARE = 0.6;

function mentionsSkill(quote: string, names: string[]): boolean {
  const found = new Set(extractSkills(quote).map((x) => x.toLowerCase()));
  return names.some((n) => {
    const canon = (canonicalize(n) ?? n).toLowerCase();
    if (found.has(canon)) return true;
    return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(n.trim())}(?![A-Za-z0-9+#])`, "i").test(quote);
  });
}

/**
 * A Strong row's quote, or null. The quote must sit inside ONE real CV line (whitespace/case-insensitive),
 * be substantive (see QUOTE_MIN_*), and, when the requirement names skills, mention one of them.
 * A posting that tells the model to quote "CV" or "a" for everything therefore yields Partial, not Strong.
 */
export function verifyQuote(raw: string | null, lines: string[], req: Pick<Requirement, "skill" | "anyOf">): string | null {
  if (!raw) return null;
  const quote = stripListMarker(unescapeData(raw)).trim();
  const q = norm(quote);
  if (!q) return null;
  const line = lines.find((l) => l.includes(q));
  if (!line) return null;
  const words = wordCount(q);
  const substantive = (words >= QUOTE_MIN_WORDS && q.length >= QUOTE_MIN_CHARS) || (words >= 2 && q.length / line.length >= QUOTE_MIN_LINE_SHARE);
  if (!substantive) return null;
  const names = req.anyOf?.length ? req.anyOf : req.skill ? [req.skill] : [];
  if (names.length && !mentionsSkill(quote, names)) return null;
  return quote;
}

/** Requirements, title and posting text all come from the scraped JD, so all of them go inside the escaped wrapper. */
export function buildExplainPrompt(i: { cv: ParsedCV; job: JobListItem; reqs: Requirement[] }): string {
  const list = i.reqs.map((r, n) => `${n}. [${capImportance(r.importance, r.evidenceTier)}] ${r.text}`).join("\n");
  const posting = `REQUIREMENTS (importance already fixed):\n${list}\n\nPOSTING:\n${i.job.textLines.join("\n")}`;
  return `${wrapJob(posting, i.job.title)}\n\n<cv>\n${escapeData(cvContent(i.cv))}\n</cv>`;
}

export const MISSING_GAP_HOW_TO_CLOSE =
  "Not shown in your CV yet. If you have done this, add a line that shows it; if not, a small project, module or course can close the gap.";

/**
 * tagJob emits one requirement per skill, so "Knowledge in SQL and Python" arrived as two identical-looking rows.
 * Rows with the same text become one: Strong only if every part is, Missing only if every part is, else Partial;
 * the most important importance and the first verified quote are kept.
 */
export function mergeSameText(rows: RequirementRow[]): RequirementRow[] {
  const byText = new Map<string, RequirementRow[]>();
  for (const r of rows) byText.set(r.text, [...(byText.get(r.text) ?? []), r]);
  return [...byText.values()].map((group) => {
    if (group.length === 1) return group[0];
    const match = group.every((r) => r.match === "strong") ? "strong" : group.every((r) => r.match === "missing") ? "missing" : "partial";
    const top = [...group].sort((a, b) => IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance])[0];
    const skills = [...new Set(group.map((r) => r.skill).filter((x): x is string => Boolean(x)))];
    return {
      ...top, match, skill: skills.length ? skills.join(", ") : null,
      cvEvidence: match === "missing" ? null : group.find((r) => r.cvEvidence)?.cvEvidence ?? null,
    };
  });
}

/**
 * Final shape shared by every branch: rows ordered and trimmed (orderRequirementRows); gaps only for rows still in
 * the table and not Strong; every Partial/Missing critical/high row gets a gap (a deterministic one if none was
 * given); gaps ordered by importance.
 */
export function finalizeExplanation(rows: RequirementRow[], gaps: ExplanationGap[], whyFit: string[]): Explanation {
  const table = orderRequirementRows(mergeSameText(rows));
  const byText = new Map(table.map((r) => [r.text, r]));
  const seen = new Set<string>();
  const out: ExplanationGap[] = [];
  for (const g of gaps) {
    const row = byText.get(g.requirement);
    if (!row || row.match === "strong" || seen.has(g.requirement)) continue;
    seen.add(g.requirement);
    out.push({ ...g, blocking: g.blocking && isMustHave(row.importance) });
  }
  for (const r of table) {
    if (isMustHave(r.importance) && r.match !== "strong" && !seen.has(r.text)) {
      seen.add(r.text);
      out.push({ requirement: r.text, blocking: true, adjacentExperience: null, howToClose: MISSING_GAP_HOW_TO_CLOSE });
    }
  }
  const rank = (g: ExplanationGap) => IMPORTANCE_RANK[byText.get(g.requirement)!.importance];
  out.sort((a, b) => rank(a) - rank(b));
  return { rows: table, whyFit: whyFit.map((w) => w.trim()).filter(Boolean), gaps: out };
}

/**
 * Raw model output (or a fixture recorded in the same shape) -> Explanation. Shared by the live and fixture
 * branches (C6) so both are post-processed identically:
 * - one row per tagJob requirement, by index; importance always from tagJob (two-pass rule), inferred capped;
 * - a requirement the model skipped is "partial";
 * - "strong" needs a verified quote (verifyQuote), else it becomes "partial";
 * - gaps with an unknown index are dropped; then finalizeExplanation.
 */
export function toExplanation(raw: ExplainOutputT, reqs: Requirement[], evidenceLines: string[]): Explanation {
  const byIndex = new Map<number, ExplainOutputT["rows"][number]>();
  for (const v of raw.rows) if (!byIndex.has(v.index)) byIndex.set(v.index, v);

  const rows: RequirementRow[] = reqs.map((r, n) => {
    const v = byIndex.get(n);
    let match: RequirementRow["match"] = v?.match ?? "partial";
    const evidence = match === "missing" ? null : verifyQuote(v?.cv_evidence ?? null, evidenceLines, r);
    if (match === "strong" && !evidence) match = "partial";
    return {
      text: r.text, skill: r.skill, importance: capImportance(r.importance, r.evidenceTier), evidenceTier: r.evidenceTier,
      match, cvEvidence: evidence,
    };
  });

  const gaps: ExplanationGap[] = [];
  for (const g of raw.gaps) {
    const row = Number.isInteger(g.index) ? rows[g.index] : undefined;
    if (!row) continue;
    gaps.push({ requirement: row.text, blocking: g.blocking, adjacentExperience: g.adjacent_experience?.trim() || null, howToClose: g.how_to_close });
  }
  return finalizeExplanation(rows, gaps, raw.why_fit);
}

export type ExplainSource = "ai" | "fixture" | "heuristic";

/**
 * Requirement table + why you fit + gaps (spec §7.1/§7.2), with where it came from. Smart tier, fixture-backed
 * (fixtures/ai/explainMatch/<extId>.json, raw schema shape). No CV -> deterministic heuristic, no AI call.
 * A live AiError (outage, truncation, refusal) falls back to the heuristic with `aiFailed: true`, so the panel can say
 * so; heuristic results are never cached (shouldCacheExplanation). Any other error is a bug and propagates.
 */
export async function explainMatchWithSource(
  i: ExplainInput,
): Promise<{ explanation: Explanation; source: ExplainSource; aiFailed: boolean }> {
  const reqs = requirementsFor(i.job, i.coverage);
  let usedFallback = false;
  const fallback = () => {
    usedFallback = true;
    const h = heuristicExplain({
      requirements: reqs, coverage: i.coverage, cvText: i.cvText,
      archetypeMatch: Boolean(i.job.archetype) && i.student.archetypes[0]?.key === i.job.archetype,
    });
    return finalizeExplanation(h.rows, h.gaps, h.whyFit);
  };
  if (!i.cv || reqs.length === 0) return { explanation: fallback(), source: "heuristic", aiFailed: false };
  const cv = i.cv;
  const lines = cvEvidenceLines(cv, i.cvText);
  const map = (raw: ExplainOutputT) => toExplanation(raw, reqs, lines);
  let explanation: Explanation;
  try {
    explanation = await runAi({
      fn: "explainMatch",
      fixtureKey: i.job.extId,
      schema: ExplainOutput,
      fromFixture: map,
      live: async () => map(await generateStructured({
        // Gemini counts thinking tokens in maxOutputTokens: 4000 truncated (tagJob.ts note), so give the full budget.
        tier: "smart", system: SYSTEM_EXPLAIN, schema: ExplainOutput, maxTokens: 16000,
        parts: [{ type: "text", text: buildExplainPrompt({ cv, job: i.job, reqs }) }],
      })),
      fallback,
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("explainMatch: AI failed, showing the heuristic explanation", err.message);
    return { explanation: fallback(), source: "heuristic", aiFailed: true };
  }
  return { explanation, source: usedFallback ? "heuristic" : aiMode() === "fixture" ? "fixture" : "ai", aiFailed: false };
}

export async function explainMatch(i: ExplainInput): Promise<Explanation> {
  return (await explainMatchWithSource(i)).explanation;
}

// ---------- cache record (matches.explanation_json) ----------

/** Bump when toExplanation / the prompt change meaning: older cached rows are then recomputed. */
export const EXPLAIN_CACHE_VERSION = 4;

/** Heuristic results are cheap and would mask a fixture or live answer added later, so they are never cached. */
export const shouldCacheExplanation = (source: ExplainSource) => source !== "heuristic";

/**
 * Everything a cached explanation depends on: cache version, AI mode, the active CV, the job's tagJob requirements
 * (re-tagging invalidates) and, with no CV, the profile skills (editing them invalidates).
 */
export function explainCacheKey(i: { mode: "live" | "fixture"; cvId: string | null; requirements: Requirement[]; skills: string[] }): string {
  const basis = JSON.stringify([EXPLAIN_CACHE_VERSION, i.mode, i.cvId, i.requirements, i.cvId ? null : [...i.skills].sort()]);
  return createHash("sha256").update(basis).digest("hex").slice(0, 16);
}

export type ExplainCacheRecord = { v: number; key: string; source: ExplainSource; explanation: Explanation };

export function toCacheRecord(explanation: Explanation, key: string, source: ExplainSource): ExplainCacheRecord {
  return { v: EXPLAIN_CACHE_VERSION, key, source, explanation };
}

/** Reused only for the same key and version, never for a heuristic result, and only if well-formed. */
export function readCachedExplanation(json: unknown, key: string): Explanation | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Partial<ExplainCacheRecord>;
  if (r.v !== EXPLAIN_CACHE_VERSION || r.key !== key || r.source === "heuristic" || r.source === undefined) return null;
  const e = r.explanation;
  if (!e || !Array.isArray(e.rows) || !Array.isArray(e.whyFit) || !Array.isArray(e.gaps)) return null;
  // Rows cached before mergeSameText existed still hold one row per skill; merge on read instead of recomputing.
  return { ...e, rows: orderRequirementRows(mergeSameText(e.rows)) };
}
