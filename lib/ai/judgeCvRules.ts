import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CvRule, Track } from "@/lib/cv-rules/types";
import { adjustFor, resolvedStatement } from "@/lib/cv-rules/adjust";
import { ARCHETYPE_LABELS, type Archetype, type Year } from "@/lib/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";
import { isSpellingVariant } from "@/lib/cv-score/checkers";
import { aiDeadline, aiMode } from "@/lib/ai/config";
import { escapeRegex, stripListMarker } from "@/lib/text/regex";
import { currentModelId } from "./models";
import { AiError, generateStructured, runAi } from "./provider";
import { SYSTEM_JUDGE } from "./prompts";
import { JudgeOutput, type JudgeOutputT } from "./schemas";

/**
 * Part of the cache key (06 R2). Bump the manual part whenever buildJudgePrompt or mapVerdicts change
 * meaning; the SYSTEM_JUDGE hash suffix invalidates the cache automatically on any prompt edit.
 */
export const PROMPT_VERSION = `judge-2026-10-18.1-${createHash("sha256").update(SYSTEM_JUDGE).digest("hex").slice(0, 8)}`;
const FN = "judgeCvRules";

export type JudgeInput = {
  /** redactCv output for the raw CV text. evidence_line must be a substring of this. */
  redactedText: string;
  /** Redacted rendering of the structured CV (lib/cv-score/pii.ts). Never parsed_json. */
  structuredText: string;
  rules: CvRule[];
  /** What the CV is being judged for (audit 03#5, 04#20). Absent = generic, no job advert. */
  context?: JudgeContext;
  /** Fixture mode only: an EXACT fixture under fixtures/ai/judgeCvRules/<key>.json (no default fallback). */
  fixtureKey?: string;
};
/** Sent to the judge in a <target> block, and used to resolve each rule's sector wording and year skips. */
export type JudgeContext = { year: Year; sector: Archetype; track: Track; jdPresent: boolean };
/**
 * `cacheable: false` when no verdicts were obtained (fixture mode without an exact fixture, or a live AI failure): never
 * cache those. `aiUnavailable`: the live judge failed, so the score is the automatic (code) checks only.
 */
export type JudgeResult = { results: ScoredRuleResult[]; spellingErrors: string[] | null; modelId: string; cacheable: boolean; aiUnavailable?: boolean };

const escapeData = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescapeData = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Placeholder numbers (amendment item 5 / 06 R9b): a line containing one is not a real result. Redaction placeholders ([NAME], [SOCIETY]…) are not matched. */
export const NUMBER_PLACEHOLDER_RE =
  /\[(?:add|insert|enter|your|number|metric|figure|amount|percent|percentage|x+|n|tbc|tbd)\b[^\]]*\]|\bNEEDS_NUMBER\b|(?<![A-Za-z])X{1,3}\s?%|(?<![A-Za-z])£\s?X{1,3}\b|\b(?:TBC|TBD)\b/i;

export function buildJudgePrompt(i: Pick<JudgeInput, "redactedText" | "structuredText" | "rules" | "context">): string {
  const llm = i.rules.filter((r) => r.check === "llm");
  const c = i.context;
  const rules = llm
    .map((r) => {
      const statement = c ? resolvedStatement(r, c.sector) : r.statement;
      const na = r.naAllowed ? " (NOT_APPLICABLE ALLOWED)" : "";
      return `- [${r.id}]${r.allowPartial ? " (PARTIAL ALLOWED)" : ""}${na}\n  Rule: ${statement}\n  Question: ${r.llmGuidance}\n  pass e.g.: ${r.passExample}\n  fail e.g.: ${r.failExample}`;
    })
    .join("\n");
  const target = c
    ? `<target>\nYear of study: ${c.year}\nTarget sector: ${ARCHETYPE_LABELS[c.sector]}\nTrack: ${c.track}${c.track === "spring" ? " (spring week / insight programme)" : ""}\nJob advert: ${c.jdPresent ? "provided" : "not provided"}\n</target>\n\n`
    : "";
  return (
    target +
    `RULES (${llm.length}):\n${rules}\n\n` +
    `<cv_structured>\n${escapeData(i.structuredText)}\n</cv_structured>\n\n` +
    `<cv_text>\n${escapeData(i.redactedText)}\n</cv_text>`
  );
}

/** The fields verdict mapping needs; LinkedIn rules (lib/linkedin-rules) share this shape. */
export type JudgedRule = { id: string; check: string; allowPartial?: true };

function mapStatus(s: string, rule: JudgedRule): "pass" | "fail" | "partial" | "not_applicable" {
  const t = s.trim().toLowerCase();
  if (t === "pass" || t === "fail") return t;
  if (t === "partial" && rule.allowPartial) return "partial";
  return "not_applicable";
}

/**
 * Model output → one result per llm rule, in rule order.
 * - status: pass | fail | not_applicable; partial only with allowPartial; anything else → not_applicable.
 * - A1 (06 R1): evidence_line must be an exact substring of the redacted text after whitespace
 *   normalisation, else the verdict becomes could_not_assess (dropped from the denominator).
 *   pass and partial REQUIRE a quote (a pass claims presence, and anything present can be quoted);
 *   only fail may have a null evidence_line ("absent from the CV"), counted by countUnevidencedFails.
 * - A passing line that contains a placeholder number scores as fail.
 */
export type MapOptions = {
  /** Status for a rule with no verdict, or an unknown status. LinkedIn keeps not_applicable; the CV judge uses could_not_assess. */
  missing?: "not_applicable" | "could_not_assess";
  /** Rules that may legitimately answer not_applicable; any other not_applicable becomes could_not_assess. */
  naAllowed?: (r: JudgedRule) => boolean;
  /** Section headings of the structured CV: a quote-less fail must say "ABSENT: <sections>" naming real ones (04#21). */
  absentSections?: string[];
};

export function mapVerdicts(raw: JudgeOutputT, rules: JudgedRule[], redactedText: string, judged: (r: JudgedRule) => boolean = (r) => r.check === "llm", opts: MapOptions = {}): ScoredRuleResult[] {
  const hay = norm(redactedText);
  const missing = opts.missing ?? "not_applicable";
  const got = new Map<string, JudgeOutputT["verdicts"][number]>();
  for (const v of raw.verdicts) if (!got.has(v.rule_id)) got.set(v.rule_id, v);

  return rules
    .filter(judged)
    .map((rule): ScoredRuleResult => {
      const v = got.get(rule.id);
      if (!v) return missing === "could_not_assess"
        ? { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: "no verdict returned" }
        : { ruleId: rule.id, status: "not_applicable", evidenceLine: null, fix: null };
      const t = v.status.trim().toLowerCase();
      const known = t === "pass" || t === "fail" || t === "not_applicable" || (t === "partial" && rule.allowPartial);
      if (!known && missing === "could_not_assess") return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: `unusable status: ${v.status.slice(0, 40)}` };
      const status = mapStatus(v.status, rule);
      if (status === "not_applicable") {
        if (opts.naAllowed && !opts.naAllowed(rule)) return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: "not_applicable is not allowed for this rule" };
        return { ruleId: rule.id, status, evidenceLine: null, fix: null };
      }

      const rawLine = v.evidence_line == null ? "" : unescapeData(v.evidence_line).trim();
      if (opts.absentSections && status === "fail" && /^ABSENT\b/i.test(rawLine)) {
        const named = rawLine.replace(/^ABSENT\s*:?\s*/i, "").split(/[,;/]|\band\b/i).map((x) => x.trim().toUpperCase()).filter(Boolean);
        const known = named.filter((n) => opts.absentSections!.includes(n));
        if (!known.length || known.length < named.length) {
          return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: `absence claimed in unknown section: ${rawLine.slice(0, 80)}` };
        }
        return { ruleId: rule.id, status: "fail", evidenceLine: null, fix: v.fix?.trim() || null, detail: `absent: ${known.join(", ")}` };
      }
      const quoted = rawLine ? norm(stripListMarker(rawLine.replace(/^["“'‘]+|["”'’]+$/g, ""))) : "";
      const evidenceLine = quoted || null;
      if (!evidenceLine && (status !== "fail" || opts.absentSections)) {
        return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: `${status} verdict without an evidence line` };
      }
      if (evidenceLine && !hay.includes(evidenceLine)) {
        return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: `quoted line not found in CV: ${evidenceLine.slice(0, 200)}` };
      }
      if (evidenceLine && status !== "fail" && NUMBER_PLACEHOLDER_RE.test(evidenceLine)) {
        return { ruleId: rule.id, status: "fail", evidenceLine, fix: v.fix?.trim() || "Replace the placeholder with your real number — a placeholder isn't a result yet." };
      }
      return { ruleId: rule.id, status, evidenceLine, fix: status === "pass" ? null : v.fix?.trim() || null };
    });
}

/** Section headings renderCvContent (lib/cv-score/pii.ts) always writes, in capitals on their own line. */
const SECTION_HEADING = /^(SUMMARY|EDUCATION|EXPERIENCE|PROJECTS|LEADERSHIP|SKILLS|INTERESTS|LINKS)$/;

/**
 * The CV judge's stricter mapping (audit 04#1, #21): a missing verdict, an unknown status or a not_applicable the rule
 * doesn't allow is could_not_assess; a fail must quote a line or say "ABSENT: <sections>" naming real sections.
 */
export function mapCvVerdicts(raw: JudgeOutputT, rules: CvRule[], redactedText: string, structuredText: string): ScoredRuleResult[] {
  const absentSections = structuredText.split("\n").map((l) => l.trim()).filter((l) => SECTION_HEADING.test(l));
  const byId = new Map(rules.map((r) => [r.id, r]));
  return mapVerdicts(raw, rules, redactedText, (r) => r.check === "llm", {
    missing: "could_not_assess",
    naAllowed: (r) => byId.get(r.id)?.naAllowed === true,
    absentSections: absentSections.length ? absentSections : ["SUMMARY", "EDUCATION", "EXPERIENCE", "PROJECTS", "LEADERSHIP", "SKILLS", "INTERESTS", "LINKS"],
  });
}

/** LLM fails with no quoted line ("ABSENT" verdicts); tracked for the reliability run and the low-confidence flag. */
export function countUnevidencedFails(llmResults: ScoredRuleResult[]): number {
  return llmResults.filter((r) => r.status === "fail" && r.evidenceLine == null).length;
}

/** Keep only misspellings that actually occur in the text and are not UK/US variants (06 R12). */
export function cleanSpelling(words: string[], text: string): string[] {
  const out: string[] = [];
  for (const w of words.map((x) => x.trim()).filter(Boolean)) {
    if (isSpellingVariant(w) || out.includes(w)) continue;
    const re = new RegExp(`(?<![\\p{L}])${escapeRegex(w)}(?![\\p{L}])`, "iu");
    if (re.test(text)) out.push(w);
  }
  return out;
}

function hasExactFixture(key: string | undefined): key is string {
  if (!key) return false;
  return existsSync(path.join(process.cwd(), "fixtures", "ai", FN, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`));
}

/** Rules per parallel judge call. Hand-set: small enough to cut latency, large enough to keep the call count low. */
export const JUDGE_BATCH_SIZE = 12;

/** Past this a batch counts as failed (Gemini's own timeout is 240s with retries, so a stall could hold the score for minutes). */
export const JUDGE_BATCH_DEADLINE_MS = 120_000;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AiError(`judge batch timed out after ${ms}ms`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** llm rules split into near-equal batches of at most JUDGE_BATCH_SIZE, in rule order. */
export function judgeBatches<R>(rules: R[]): R[][] {
  const n = Math.ceil(rules.length / JUDGE_BATCH_SIZE);
  // Batch k gets floor(k·len/n)..floor((k+1)·len/n): sizes differ by at most one.
  return Array.from({ length: n }, (_, k) => rules.slice(Math.floor((k * rules.length) / n), Math.floor(((k + 1) * rules.length) / n)));
}

/**
 * Parallel smart-tier calls (judgeBatches) judge every llm rule for the sector. Input is already redacted (pii.ts).
 * Rules skipped for the year/track or missing required context (needs) are not_applicable and never sent.
 * Live AiError: every judged rule is could_not_assess with `aiUnavailable: true` and `cacheable: false`, so the panel
 * shows a provisional range from the automatic checks, never caches it under the live model id. Other errors are bugs.
 * Fixture mode without an exact fixture: every judged rule is could_not_assess (provisional).
 */
export async function judgeCvRules(i: JudgeInput): Promise<JudgeResult> {
  const c = i.context;
  const allLlm = i.rules.filter((r) => r.check === "llm");
  // Not sent: rules skipped for this year/track, and rules whose required context is missing (03#5).
  const skipped = allLlm.filter((r) => c && adjustFor(r, c.year, c.track, c.sector)?.skip);
  const unmet = (r: CvRule) => (r.needs ?? []).filter((n) => !(n === "jd" && c?.jdPresent));
  const preset: ScoredRuleResult[] = [
    ...skipped.map((r): ScoredRuleResult => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null, detail: "skipped for this year or track" })),
    ...allLlm.filter((r) => !skipped.includes(r) && unmet(r).length).map((r): ScoredRuleResult => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null, detail: `needs: ${unmet(r).join(", ")}` })),
  ];
  const presetIds = new Set(preset.map((p) => p.ruleId));
  const llmRules = allLlm.filter((r) => !presetIds.has(r.id));
  const inOrder = (rs: ScoredRuleResult[]) => { const m = new Map([...preset, ...rs].map((x) => [x.ruleId, x])); return allLlm.map((r) => m.get(r.id)!); };
  const modelId = currentModelId("smart");
  // No verdicts at all: every judged rule is could_not_assess, so the score is provisional rather than inflated (04#1).
  const none = (detail: string): JudgeResult => ({
    results: inOrder(llmRules.map((r) => ({ ruleId: r.id, status: "could_not_assess", evidenceLine: null, fix: null, detail }))),
    spellingErrors: null,
    modelId,
    cacheable: false,
  });
  if (llmRules.length === 0) return { ...none("no rules to judge"), cacheable: true };
  if (aiMode() === "fixture" && !hasExactFixture(i.fixtureKey)) return none("no AI verdict (fixture mode)");

  let raw: JudgeOutputT | null;
  let partial = false;
  try {
    raw = await runAi<JudgeOutputT | null, JudgeOutputT>({
      fn: FN,
      fixtureKey: i.fixtureKey,
      schema: JudgeOutput,
      fromFixture: (r) => r,
      // One call for ~46 rules took 80-120s (output length is the latency): judge rule batches in parallel instead.
      live: async () => {
        const outs = await Promise.all(judgeBatches(llmRules).map((rules) =>
          withDeadline(generateStructured({
            tier: "smart",
            system: SYSTEM_JUDGE,
            schema: JudgeOutput,
            // Lowest variance where the provider allows it (Ollama); Claude and Gemini 3 drop it (provider.ts) (04#9).
            temperature: 0,
            // Gemini counts thinking tokens in maxOutputTokens, so a per-rule budget (400 + 180/rule) truncated. Billing is per token used.
            maxTokens: Math.max(16000, 400 + 180 * rules.length),
            parts: [{ type: "text", text: buildJudgePrompt({ ...i, rules }) }],
          }), aiDeadline(JUDGE_BATCH_DEADLINE_MS)).catch((err) => {
            if (!(err instanceof AiError)) throw err;
            console.error("judgeCvRules: a rule batch failed, its rules are not counted", err.message);
            return null;
          })));
        const ok = outs.filter((o): o is JudgeOutputT => o !== null);
        if (ok.length === 0) throw new AiError("every judge batch failed");
        partial = ok.length < outs.length;
        // Every batch sees the whole CV; spelling comes from the first batch that succeeded, never from a failed one (04#4).
        return { verdicts: ok.flatMap((o) => o.verdicts), spelling_errors: ok[0].spelling_errors };
      },
      fallback: () => null,
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("judgeCvRules: AI failed, scoring the automatic checks only", err.message);
    return { ...none("AI review failed"), aiUnavailable: true };
  }
  if (!raw) return none("no AI verdict");
  // A failed batch leaves its rules could_not_assess: show what was judged, labelled as incomplete, and never cache it.
  return {
    results: inOrder(mapCvVerdicts(raw, llmRules, i.redactedText, i.structuredText)),
    spellingErrors: cleanSpelling(raw.spelling_errors, i.redactedText), modelId, cacheable: !partial, aiUnavailable: partial,
  };
}
