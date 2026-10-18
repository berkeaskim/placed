/**
 * Gold set of human-labelled CVs (audit 2026-10-18, 04 "Validation plan"). Format documented in
 * docs/validation/GOLD_FORMAT.md; version "placed-gold/1". Pure: loading, validation and consensus only.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { RULES_BY_ID, rulesFor } from "@/lib/cv-rules";
import { TRACKS, type Track } from "@/lib/cv-rules/types";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";
import { majority } from "./stats";

export const GOLD_FORMAT = "placed-gold/1";

/** A rater's verdict on one rule. "partial" only for rules that allow it; "na" = the rule doesn't apply to this CV. */
export const GOLD_LABELS = ["pass", "fail", "partial", "na"] as const;
export type GoldLabel = (typeof GOLD_LABELS)[number];

const Label = z.enum(GOLD_LABELS);
const RaterId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/, "rater ids are short codes (letters, digits, - or _), never names");

const GoldCvSchema = z.object({
  id: z.string().min(1).max(64),
  sector: z.enum(ARCHETYPES),
  year: z.enum(YEARS),
  track: z.enum(TRACKS).default("standard"),
  /** Redacted CV text (see GOLD_FORMAT.md: names replaced, contact details swapped for fictitious ones). */
  text: z.string().min(50),
  pageCount: z.number().int().min(1).max(10).default(1),
  notes: z.string().optional(),
  /** labels[raterId][ruleId] */
  labels: z.record(RaterId, z.record(z.string(), Label)),
});

const GoldFileSchema = z.object({
  format: z.literal(GOLD_FORMAT),
  name: z.string().min(1),
  /** true for made-up CVs and labels (tests, examples). Real gold files must say false and list real, consented raters. */
  synthetic: z.boolean(),
  description: z.string().min(1),
  created: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** RULES_VERSION the labels were made against (lib/cv-score/cache.ts); informational. */
  rulesVersion: z.string().optional(),
  raters: z.array(z.object({ id: RaterId, role: z.string().min(1), synthetic: z.boolean().optional() })).min(2),
  cvs: z.array(GoldCvSchema).min(1),
});

export type GoldCv = z.infer<typeof GoldCvSchema> & { sector: Archetype; year: Year; track: Track };
export type GoldFile = Omit<z.infer<typeof GoldFileSchema>, "cvs"> & { cvs: GoldCv[] };

/** Parse and validate a gold file. Throws with every problem listed (bad rule ids, unknown raters, < 2 raters per CV). */
export function parseGold(json: unknown): GoldFile {
  const parsed = GoldFileSchema.safeParse(json);
  if (!parsed.success) throw new Error(`gold file is not ${GOLD_FORMAT}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const g = parsed.data as GoldFile;
  const problems: string[] = [];
  const raterIds = new Set(g.raters.map((r) => r.id));
  if (raterIds.size !== g.raters.length) problems.push("duplicate rater ids");
  if (g.synthetic && g.raters.some((r) => r.synthetic === false)) problems.push("a synthetic file can't list real raters");
  const cvIds = new Set<string>();
  for (const cv of g.cvs) {
    if (cvIds.has(cv.id)) problems.push(`${cv.id}: duplicate CV id`);
    cvIds.add(cv.id);
    const raters = Object.keys(cv.labels);
    if (raters.length < 2) problems.push(`${cv.id}: needs labels from at least 2 raters (has ${raters.length})`);
    const inScope = new Set(rulesFor(cv.sector, cv.track).map((r) => r.id));
    for (const rater of raters) {
      if (!raterIds.has(rater)) problems.push(`${cv.id}: rater ${rater} isn't in "raters"`);
      for (const [ruleId, label] of Object.entries(cv.labels[rater])) {
        const rule = RULES_BY_ID.get(ruleId);
        if (!rule) { problems.push(`${cv.id}: unknown rule ${ruleId}`); continue; }
        if (!inScope.has(ruleId)) problems.push(`${cv.id}: rule ${ruleId} isn't scored for ${cv.sector}/${cv.track}`);
        if (label === "partial" && !rule.allowPartial) problems.push(`${cv.id}: rule ${ruleId} doesn't allow partial (rater ${rater})`);
      }
    }
  }
  if (problems.length) throw new Error(`gold file problems:\n- ${problems.join("\n- ")}`);
  return g;
}

export function loadGold(path: string): GoldFile {
  return parseGold(JSON.parse(readFileSync(path, "utf8")));
}

/** Labels collapsed for scoring comparisons: partial counts as not passing (the fix is still worth doing). */
export const binaryLabel = (l: string): "pass" | "fail" | "na" => (l === "pass" ? "pass" : l === "na" || l === "not_applicable" ? "na" : "fail");

/** Every rule labelled on this CV, with each rater's label (raters who skipped the rule are absent). */
export function labelsByRule(cv: GoldCv): Map<string, Map<string, GoldLabel>> {
  const out = new Map<string, Map<string, GoldLabel>>();
  for (const [rater, labels] of Object.entries(cv.labels)) {
    for (const [ruleId, label] of Object.entries(labels)) {
      if (!out.has(ruleId)) out.set(ruleId, new Map());
      out.get(ruleId)!.set(rater, label);
    }
  }
  return out;
}

/** Human consensus per rule: the strict-majority binary label among ≥ 2 raters, or null (tie / too few labels). */
export function consensus(cv: GoldCv): Map<string, "pass" | "fail" | "na" | null> {
  const out = new Map<string, "pass" | "fail" | "na" | null>();
  for (const [ruleId, byRater] of labelsByRule(cv)) {
    const labels = [...byRater.values()].map(binaryLabel);
    out.set(ruleId, labels.length >= 2 ? majority(labels) : null);
  }
  return out;
}
