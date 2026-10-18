/**
 * Rule AU-01: generic-LLM phrasing density (docs/research/market-2026/02 §1.A F5-F6, §5.2).
 * Counts AI-cliché tokens per 100 words and returns the offending spans. Pure and deterministic,
 * so it runs on the student's CV (scoring) and on tailored output (verifyTailoring warning).
 */

export type ClicheCategory = "buzzword" | "cliche" | "llm_tell";
export type ClicheHitCategory = ClicheCategory | "structural";

export type ClicheEntry = { term: string; category: ClicheCategory; pattern: RegExp };

export type ClicheHit = { term: string; category: ClicheHitCategory; index: number; match: string };

export type ClicheSeverity = "ok" | "minor" | "major";

export type ClicheDensity = {
  per100Words: number;
  hits: ClicheHit[];
  severity: ClicheSeverity;
  words: number;
  structural: { emDashes: number; notOnlyButAlso: number };
};

export type ClicheOptions = {
  /** Extra phrases (case-insensitive, literal) whose spans are never flagged, e.g. a module or society name. */
  allow?: string[];
  /** Minimum word basis for the density denominator. Defaults to CLICHE_MIN_WORDS. */
  minWords?: number;
  /** Severity cut-offs in hits per 100 words (default CLICHE_MINOR_THRESHOLD / CLICHE_MAJOR_THRESHOLD). */
  minor?: number;
  major?: number;
  /**
   * Count em-dashes and "not only… but also" (default true). The CV score turns this off: no study shows they mark a
   * CV as AI-written, and formal-register writers use them (audit 01#17). Tailoring output still warns on them.
   */
  structural?: boolean;
};

/**
 * Severity thresholds in hits per 100 words: ok < MINOR, minor < MAJOR, major >= MAJOR.
 * Tunable defaults, evidence grade D: no study gives a cut-off; these were set by hand so that one stray
 * buzzword in a full CV stays "ok" and a CV in typical unedited-LLM register lands in "major".
 */
export const CLICHE_MINOR_THRESHOLD = 1.0;
export const CLICHE_MAJOR_THRESHOLD = 2.5;

/**
 * Minimum word basis for the density denominator (tunable default, grade D). Stops a single buzzword in a
 * 4-word bullet reading as "25 per 100 words". Pass `minWords: 1` for a raw per-text rate.
 */
export const CLICHE_MIN_WORDS = 50;

const B = "\\b";
const word = (body: string) => new RegExp(`${B}(?:${body})${B}`, "gi");

/** Lexicon (02 §5.2 plus common LLM tells). Patterns cover simple inflections and hyphen/space variants. */
export const CLICHES: readonly ClicheEntry[] = [
  // buzzwords: inflated verbs and adjectives
  { term: "leveraged", category: "buzzword", pattern: word("leverag(?:e|es|ed|ing)") },
  { term: "spearheaded", category: "buzzword", pattern: word("spearhead(?:s|ed|ing)?") },
  { term: "synergy", category: "buzzword", pattern: word("synerg(?:y|ies|istic|ise|ize|ised|ized)") },
  { term: "dynamic", category: "buzzword", pattern: word("dynamic") },
  { term: "cutting-edge", category: "buzzword", pattern: word("cutting[- ]edge") },
  { term: "robust", category: "buzzword", pattern: word("robust(?:ly)?") },
  { term: "seamless", category: "buzzword", pattern: word("seamless(?:ly)?") },
  { term: "innovative", category: "buzzword", pattern: word("innovative") },
  { term: "world-class", category: "buzzword", pattern: word("world[- ]class") },
  { term: "seasoned", category: "buzzword", pattern: word("seasoned") },
  { term: "visionary", category: "buzzword", pattern: word("visionary") },
  { term: "thought leader", category: "buzzword", pattern: word("thought[- ]leader(?:s|ship)?") },
  // CV clichés: unprovable self-description
  { term: "passionate about", category: "cliche", pattern: word("passionate about") },
  { term: "results-driven", category: "cliche", pattern: word("results?[- ]driven") },
  { term: "detail-oriented", category: "cliche", pattern: word("detail[- ]oriented") },
  { term: "team player", category: "cliche", pattern: word("team[- ]player") },
  { term: "go-getter", category: "cliche", pattern: word("go[- ]getter") },
  { term: "fast-paced environment", category: "cliche", pattern: word("fast[- ]paced environments?") },
  { term: "proven track record", category: "cliche", pattern: word("proven track record") },
  // LLM tells: vocabulary over-represented in model output
  { term: "delve", category: "llm_tell", pattern: word("delv(?:e|es|ed|ing)") },
  { term: "tapestry", category: "llm_tell", pattern: word("tapestry") },
  { term: "testament to", category: "llm_tell", pattern: word("testament to") },
  { term: "pivotal", category: "llm_tell", pattern: word("pivotal") },
  { term: "foster", category: "llm_tell", pattern: word("foster(?:s|ed|ing)?") },
  { term: "showcasing", category: "llm_tell", pattern: word("showcas(?:e|es|ed|ing)") },
  { term: "navigate the complexities", category: "llm_tell", pattern: word("navigat(?:e|es|ed|ing) the complexit(?:y|ies)") },
  { term: "in today's ... landscape", category: "llm_tell", pattern: word("in today['’]s\\s+(?:[\\w-]+\\s+){0,4}landscape") },
  { term: "a deep understanding of", category: "llm_tell", pattern: word("an? deep understanding of") },
];

/** Legitimate uses that contain a lexicon word. Case-insensitive; matched as whole phrases. */
export const CLICHE_ALLOWLIST: readonly string[] = [
  "foster care", "foster carer", "foster carers", "foster parent", "foster parents", "foster family", "foster families", "foster home", "foster homes",
  "robust statistics", "robust optimisation", "robust optimization", "robust control", "robust regression", "robust standard errors",
  "dynamic programming", "dynamic pricing", "dynamic systems", "dynamic stochastic general equilibrium", "dynamic macroeconomics",
  "microsoft dynamics",
  "leveraged finance", "leveraged buyout", "leveraged buyouts", "leveraged loan", "leveraged loans",
  "leverage ratio", "leverage ratios", "operating leverage", "financial leverage",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function allowSpans(text: string, phrases: readonly string[]): [number, number][] {
  const spans: [number, number][] = [];
  for (const p of phrases) {
    if (!p.trim()) continue;
    const re = new RegExp(`${B}${escapeRe(p.trim()).replace(/\s+/g, "\\s+")}${B}`, "gi");
    for (const m of text.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

/** Lines this short are treated as headers ("Intern — Google", "Python — advanced"), never prose. */
const HEADER_MAX_WORDS = 7;

/**
 * A prose em-dash: lowercase word characters on both sides (so not "Intern — Google" or a date range
 * "2024 — Present") on a line long enough to be a sentence rather than a header or skills row.
 */
function isProseDash(text: string, i: number): boolean {
  const before = text.slice(Math.max(0, i - 4), i).trimEnd();
  const after = text.slice(i + 1, i + 5).trimStart();
  if (!/\p{Ll}$/u.test(before) || !/^\p{Ll}/u.test(after)) return false;
  const lineStart = text.lastIndexOf("\n", i) + 1;
  const nl = text.indexOf("\n", i);
  const line = text.slice(lineStart, nl === -1 ? text.length : nl);
  return countWords(line) > HEADER_MAX_WORDS;
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function clicheDensity(text: string, opts: ClicheOptions = {}): ClicheDensity {
  const allowed = allowSpans(text, [...CLICHE_ALLOWLIST, ...(opts.allow ?? [])]);
  const isAllowed = (start: number, end: number) => allowed.some(([s, e]) => start < e && end > s);
  const hits: ClicheHit[] = [];

  for (const c of CLICHES) {
    for (const m of text.matchAll(c.pattern)) {
      if (!isAllowed(m.index, m.index + m[0].length)) hits.push({ term: c.term, category: c.category, index: m.index, match: m[0] });
    }
  }

  let emDashes = 0;
  const structural = opts.structural ?? true;
  for (const m of structural ? text.matchAll(/—/g) : []) {
    if (!isProseDash(text, m.index)) continue;
    emDashes++;
    hits.push({ term: "em-dash", category: "structural", index: m.index, match: m[0] });
  }

  let notOnlyButAlso = 0;
  for (const m of structural ? text.matchAll(/\bnot only\b[^.!?]{1,120}?\bbut also\b/gi) : []) {
    notOnlyButAlso++;
    hits.push({ term: "not only ... but also", category: "structural", index: m.index, match: m[0] });
  }

  hits.sort((a, b) => a.index - b.index);
  const words = countWords(text);
  const basis = Math.max(words, opts.minWords ?? CLICHE_MIN_WORDS, 1);
  const per100Words = words === 0 ? 0 : (hits.length / basis) * 100;
  const severity: ClicheSeverity =
    per100Words >= (opts.major ?? CLICHE_MAJOR_THRESHOLD) ? "major" : per100Words >= (opts.minor ?? CLICHE_MINOR_THRESHOLD) ? "minor" : "ok";

  return { per100Words, hits, severity, words, structural: { emDashes, notOnlyButAlso } };
}
