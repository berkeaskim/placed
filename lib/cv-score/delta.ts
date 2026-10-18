/**
 * Delta re-judging (audit 2026-10-18, 04#9 and #30; research 06 R2). When a CV's text changes, only rules whose
 * evidence could have changed go back to the AI judge; every other rule keeps its earlier verdict. A one-character fix
 * no longer re-rolls ~40 unrelated verdicts, so AI noise stops looking like progress or regress.
 *
 * A previous verdict is reused only when ALL of these hold:
 *   1. The caller has matched everything that invalidates verdicts wholesale: same user, sector, track, year of study,
 *      model_id, prompt_version and rules_version (lib/cv-score/run.ts). Any change there re-judges everything.
 *   2. The verdict was a real one (not could_not_assess).
 *   3. Its quoted evidence line, if any, is still in the new redacted text, word for word.
 *   4. EITHER the rule's evidence scope is byte-identical (after whitespace normalisation): the sections the rule is
 *      about (RULE_SCOPE) plus any text the parser didn't place in a section, or the whole CV for every other rule;
 *   5. OR the edit is cosmetic (a few small spelling fixes, see cosmeticEdit), the verdict is a pass with a quote, and
 *      the rule isn't about wording (WORDING_SENSITIVE). A spelling fix can't remove the evidence a pass quoted.
 * Fails, partials and not-applicable verdicts in a changed scope are always re-judged: an edit can add evidence.
 */
import { createHash } from "node:crypto";
import { stripListMarker } from "@/lib/text/regex";
import type { ScoredRuleResult } from "./context";

export const SECTIONS = ["SUMMARY", "EDUCATION", "EXPERIENCE", "PROJECTS", "LEADERSHIP", "SKILLS", "INTERESTS", "LINKS"] as const;
export type Section = (typeof SECTIONS)[number];

const ENTRIES: Section[] = ["EXPERIENCE", "PROJECTS", "LEADERSHIP"];
const TIMELINE: Section[] = ["EDUCATION", ...ENTRIES];

/**
 * Rules whose question is about named sections of the CV (from each rule's llmGuidance). Rules not listed here are
 * judged against the whole CV, so any text change re-judges them. Keep this conservative: when a rule could be passed
 * by evidence from elsewhere, list that section too or leave the rule out.
 */
export const RULE_SCOPE: Record<string, Section[]> = {
  "G-33": ["EDUCATION"],
  "QNT-01": ["EDUCATION"],
  "DAT-01": ["EDUCATION"],
  "G-12": TIMELINE,
  "G-14": TIMELINE,
  "G-20": ENTRIES,
  "G-21": ENTRIES,
  "AU-02": ENTRIES,
  "SWE-08": ENTRIES,
  "CON-03": ENTRIES,
  "MKT-03": ENTRIES,
  "FIN-05": ["EXPERIENCE"],
  "G-34": ["EXPERIENCE", "LEADERSHIP", "INTERESTS"],
  "FCQ-09": ["EXPERIENCE", "LEADERSHIP", "INTERESTS"],
  "CON-10": ["EXPERIENCE", "LEADERSHIP", "INTERESTS"],
  "FIN-03": ["EDUCATION", "EXPERIENCE", "LEADERSHIP"],
  "FCQ-06": ["SKILLS"],
  "DAT-08": ["SKILLS"],
  "RES-06": ["SKILLS"],
  "FIN-07": ["SKILLS"],
  "CON-11": ["SKILLS"],
  "QNT-03": ["SKILLS"],
  "QNT-04": ["SKILLS"],
  "FIN-09": ["SUMMARY", "SKILLS", "INTERESTS"],
  "QNT-05": ["PROJECTS", "EXPERIENCE"],
  "SWE-05": ["PROJECTS", "EXPERIENCE"],
  "SWE-06": ["PROJECTS", "EXPERIENCE"],
  "DAT-03": ["PROJECTS", "EXPERIENCE"],
  "DAT-04": ["PROJECTS", "EXPERIENCE"],
  "QNT-06": ["EDUCATION", "SKILLS", "PROJECTS"],
  "DAT-02": ["SKILLS", "PROJECTS", "EXPERIENCE"],
  "SWE-13": ["SKILLS", "PROJECTS", "EXPERIENCE"],
};

/** Rules about wording itself: a spelling fix can change their verdict, so they're re-judged on any edit. */
export const WORDING_SENSITIVE = new Set([
  "G-07", "G-08", "G-20", "G-24", "G-26", "G-27", "G-29", "G-36", "AU-02", "FCQ-12", "CON-09", "CON-13", "PRD-09", "MKT-12", "SWE-17",
]);

export type JudgeText = { redactedText: string; structuredText: string };

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const HEADING = new RegExp(`^(${SECTIONS.join("|")})$`);

/** The structured rendering (lib/cv-score/pii.ts renderCvContent) split into its fixed sections. */
export function splitSections(structuredText: string): Map<Section, string> {
  const out = new Map<Section, string>();
  let cur: Section | null = null;
  for (const line of structuredText.split("\n")) {
    const t = line.trim();
    if (HEADING.test(t)) { cur = t as Section; out.set(cur, ""); continue; }
    if (cur) out.set(cur, `${out.get(cur)}${norm(line)}\n`);
  }
  return out;
}

/** Lines of the raw text that don't appear in the structured rendering (headers, sections the parser dropped). */
export function unattributedText(i: JudgeText): string {
  const hay = norm(i.structuredText);
  return i.redactedText.split("\n").map((l) => norm(stripListMarker(l.trim()))).filter((l) => l && !hay.includes(l)).join("\n");
}

/** Hash of everything the judge could use for this rule. Unscoped rules hash the whole judge input. */
export function scopeKey(ruleId: string, i: JudgeText): string {
  const scope = RULE_SCOPE[ruleId];
  if (!scope) return sha(`all\n${norm(i.redactedText)}\n${norm(i.structuredText)}`);
  const sections = splitSections(i.structuredText);
  return sha(`${scope.map((s) => `${s}\n${sections.get(s) ?? ""}`).join("\n")}\nunplaced\n${unattributedText(i)}`);
}

/** Optimal string alignment distance (Levenshtein plus adjacent transpositions), capped early. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export const COSMETIC_MAX_WORDS = 3;
const WORD = /^[\p{L}'’-]{2,}[.,;:!?)]*$/u;

/**
 * True when the new raw text is the old one with at most COSMETIC_MAX_WORDS distinct word substitutions, each between
 * two alphabetic words at edit distance ≤ 2 ("Manged" → "Managed"). Added or removed words, numbers, symbols and
 * line-structure changes are not cosmetic. Judged on the raw text, which is where every quoted evidence line comes from.
 */
export function cosmeticEdit(oldText: string, newText: string): boolean {
  const a = norm(oldText).split(" "), b = norm(newText).split(" ");
  if (a.length !== b.length) return false;
  const pairs = new Set<string>();
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) continue;
    if (!WORD.test(a[k]) || !WORD.test(b[k]) || editDistance(a[k].toLowerCase(), b[k].toLowerCase()) > 2) return false;
    pairs.add(`${a[k]}\u0000${b[k]}`);
    if (pairs.size > COSMETIC_MAX_WORDS) return false;
  }
  return pairs.size > 0;
}

export type DeltaPlan = { reuse: ScoredRuleResult[]; rejudge: string[]; cosmetic: boolean };

/** Which of `ruleIds` (the llm rules to judge) keep their previous verdict, and which go back to the judge. */
export function planDelta(i: { ruleIds: string[]; prev: JudgeText; prevResults: ScoredRuleResult[]; next: JudgeText }): DeltaPlan {
  const prevById = new Map(i.prevResults.map((r) => [r.ruleId, r]));
  const hay = norm(i.next.redactedText);
  const cosmetic = cosmeticEdit(i.prev.redactedText, i.next.redactedText);
  const reuse: ScoredRuleResult[] = [];
  const rejudge: string[] = [];
  for (const id of i.ruleIds) {
    const p = prevById.get(id);
    const ok = (() => {
      if (!p || p.status === "could_not_assess") return false;
      // Context presets (skipped for the year, needs a job advert) are recomputed by the judge step, never reused.
      if (p.status === "not_applicable" && /^(skipped for|needs:)/.test(p.detail ?? "")) return false;
      if (p.evidenceLine && !hay.includes(norm(p.evidenceLine))) return false;
      if (scopeKey(id, i.prev) === scopeKey(id, i.next)) return true;
      return cosmetic && !WORDING_SENSITIVE.has(id) && p.status === "pass" && Boolean(p.evidenceLine);
    })();
    if (ok) reuse.push(p!);
    else rejudge.push(id);
  }
  return { reuse, rejudge, cosmetic };
}
