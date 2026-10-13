/**
 * Extra deterministic anti-fabrication checks for verifyTailoring (Task 22 amendments, 05 §3 #1 scoped, #4, #5, #6, #8, #10).
 * Pure functions, no LLM. Each returns Issue[]; `runExtraChecks` runs them all, block-first.
 * `lib/verify/tailoring.ts` owns the original checks and merges these in.
 */
import { escapeRegex } from "@/lib/text/regex";
import { canonicalize, extractSkills } from "@/lib/skills/extract";
import { TOOL_FAMILIES, type FamilyMember } from "./tool-families";
import { TOOL_RELEASE_YEARS } from "./tool-release-years";

// ---------- Input / output types (mirror spec §7.1) ----------

export type SourceBullet = { id: string; text: string };
export type SourceRole = { id: string; org: string; title: string; dates: { start?: string; end?: string | "present" }; bullets: SourceBullet[] };
export type ChangeType = "kept" | "reordered" | "rephrased" | "merged" | "dropped";
export type TailoredBullet = { id: string; text: string; sourceRefs: string[]; changeType: ChangeType; dropReason?: string };
export type TailoredRole = { id: string; bullets: TailoredBullet[] };
export type IssueCheck = "siblingContamination" | "qualifierDrop" | "authorshipEscalation" | "scopedMetrics" | "structuralLoss" | "temporal";
export type Issue = { check: IssueCheck | (string & {}); severity: "block" | "warn"; bulletId?: string; roleId?: string; message: string; evidence?: string };

// ---------- Shared text helpers ----------

/** Resolve a tailored bullet's sourceRefs against the given source bullets (unknown refs are ignored; orphanBullets owns those). */
function cited(t: TailoredBullet, source: SourceBullet[]): SourceBullet[] {
  const byId = new Map(source.map((s) => [s.id, s]));
  return t.sourceRefs.map((r) => byId.get(r)).filter((s): s is SourceBullet => !!s);
}

const STOPWORDS = new Set((
  "a an the and or but nor of to in on at by for from with without into onto over under via per as is are was were be been being " +
  "this that these those it its their them they we our us i my me he she his her you your who whom which what while when where " +
  "than then so such also very more most less least many much some any each every all both other another across within during " +
  "after before through about around up down out off new using use used based including include includes etc"
).split(" "));

/** British → US and light suffix stripping, applied identically to both sides so only the stem matters. */
function stem(w: string): string {
  let s = w.replace(/'s$/, "")
    .replace(/is(e|ed|es|ing|ation|ations)$/, "iz$1")
    .replace(/ys(e|ed|es|ing)$/, "yz$1")
    .replace(/our$/, "or");
  if (s.length > 4) s = s.replace(/(ing|ed|es|s)$/, "");
  if (s.length > 3) s = s.replace(/e$/, "");
  return s;
}

/** Content-word stems: lower-cased words minus stopwords, numbers and authorship-ladder verbs. */
function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9+#]*(?:'[a-z]+)?/g) ?? []) {
    if (STOPWORDS.has(w) || authorshipLevel(w) !== null) continue;
    out.add(stem(w));
  }
  return out;
}

function sharedCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

// ---------- 1. siblingContamination ----------

const termRe = (term: string, caseSensitive?: boolean) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}(?![A-Za-z0-9+#])`, caseSensitive ? "" : "i");

type TermRe = { re: RegExp; caseSensitive: boolean };
const MEMBER_RES = new Map<FamilyMember, TermRe[]>(
  TOOL_FAMILIES.flatMap((f) => f.members).map((mem) => [mem, [
    ...mem.terms.map((t) => ({ re: termRe(t, mem.caseSensitive), caseSensitive: !!mem.caseSensitive })),
    ...(mem.exactTerms ?? []).map((t) => ({ re: termRe(t, true), caseSensitive: true })),
  ]]),
);

/** "Excel at explaining…", "React to feedback": a word that is also a verb, followed by a preposition, outside a tool context. */
const PREP_AFTER = /^\s+(?:at|to|on|in|with)\b/i;
const TOOL_CONTEXT_BEFORE = /(?:\b(?:in|using|with|via|and|or|on)|[,/(])\s*$/i;
const LIST_AFTER = /^\s*[,/)]/;

function mentions(mem: FamilyMember, text: string): boolean {
  return MEMBER_RES.get(mem)!.some(({ re, caseSensitive }) => {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + "g"))) {
      if (!caseSensitive) return true;
      const before = text.slice(0, m.index), after = text.slice(m.index! + m[0].length);
      if (PREP_AFTER.test(after) && !TOOL_CONTEXT_BEFORE.test(before) && !LIST_AFTER.test(after)) continue;
      return true;
    }
    return false;
  });
}

/**
 * Source-side leniency through the shared skills canonicaliser: a member also counts as present when the
 * vocab maps a source alias to it (e.g. "EC2" → AWS). Skipped when two members of the family share one
 * canonical (Keras and TensorFlow both canonicalise to TensorFlow), so siblings stay distinguishable.
 */
function canonicalFor(mem: FamilyMember, family: FamilyMember[]): string | null {
  const c = canonicalize(mem.name);
  if (!c || family.some((o) => o !== mem && canonicalize(o.name) === c)) return null;
  return c;
}

export function siblingContamination(tailored: TailoredBullet, source: SourceBullet[]): Issue[] {
  if (tailored.changeType === "dropped") return [];
  const refs = cited(tailored, source);
  const srcText = refs.map((s) => s.text).join("\n");
  const srcCanon = new Set(extractSkills(srcText));
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const f of TOOL_FAMILIES) {
    for (const mem of f.members) {
      if (seen.has(mem.name) || !mentions(mem, tailored.text)) continue;
      const canon = canonicalFor(mem, f.members);
      if (mentions(mem, srcText) || (canon && srcCanon.has(canon))) continue;
      seen.add(mem.name);
      const siblings = f.members.filter((o) => o !== mem && mentions(o, srcText)).map((o) => o.name);
      issues.push({
        check: "siblingContamination", severity: "block", bulletId: tailored.id, evidence: mem.name,
        message: siblings.length
          ? `"${mem.name}" replaces ${siblings.join("/")} from your original bullet`
          : `"${mem.name}" isn't in the original bullet(s) this line cites`,
      });
    }
  }
  return issues;
}

// ---------- 2. qualifierDrop ----------

type Qualifier = { label: string; group: string; severity: "block" | "warn"; re: RegExp };
const Q = (label: string, group: string, severity: "block" | "warn", re: RegExp): Qualifier => ({ label, group, severity, re });
const NUM_WORD = "(?:\\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)";

/** Qualifiers in one group are interchangeable: "helped" → "assisted" keeps the scope, so it is not a drop. */
const QUALIFIERS: Qualifier[] = [
  Q("team of N", "teamSize", "block", new RegExp(`\\bteam of (?:about |around |~)?${NUM_WORD}\\b|\\b${NUM_WORD}[- ](?:person|people|member|strong) (?:team|group|squad)\\b`, "i")),
  Q("as part of", "partOf", "block", /\bas part of\b/i),
  Q("group project", "partOf", "block", /\bgroup project\b/i),
  Q("jointly", "partOf", "block", /\bjointly\b/i),
  Q("collaborated with", "partOf", "block", /\bcollaborat(?:ed|ing|ion) with\b/i),
  Q("alongside", "partOf", "block", /\balongside\b/i),
  Q("assisted", "subordinate", "block", /\bassist(?:ed|ing|s)?\b/i),
  Q("helped", "subordinate", "block", /\b[Hh]elp(?:ed|ing)\b|(?:^|[.;]\s+)[Hh]elps?\s+(?!desk|line|centre|center|page)[a-z]+/),
  Q("supported", "subordinate", "block", /\bsupport(?:ed|ing)\b/i),
  Q("contributed to", "subordinate", "block", /\bcontribut(?:ed|ing|es|e) to\b/i),
  Q("shadowed", "subordinate", "block", /\bshadow(?:ed|ing)\b/i),
  Q("under supervision", "subordinate", "block", /\bunder (?:the )?supervision\b|\bsupervised by\b/i),
  Q("co-", "co", "block", /(?<![A-Za-z])co-(?!ordinat|operat|op\b)(?=[a-z])/i),
  Q("personal project", "context", "block", /\bpersonal project\b/i),
  Q("university project", "context", "block", /\b(?:university|uni|academic|class|course) project\b/i),
  Q("coursework", "context", "block", /\bcoursework\b/i),
  Q("module", "context", "block", /\bmodule (?:project|coursework|assignment)s?\b/i),
  Q("~", "hedge", "warn", /~\s?[£$€]?\d/),
  Q("approx", "hedge", "warn", /\bapprox(?:\.|imately)?(?![a-z])/i),
  Q("around", "hedge", "warn", /\baround [£$€]?\d/i),
  Q("about", "hedge", "warn", /\babout [£$€]?\d/i),
  Q("up to", "hedge", "warn", /\bup to [£$€]?\d/i),
  Q("over", "hedge", "warn", /\b(?:over|more than) [£$€]?\d/i),
  Q("nearly", "hedge", "warn", /\b(?:nearly|almost) [£$€]?\d/i),
];

export function qualifierDrop(tailored: TailoredBullet, source: SourceBullet[]): Issue[] {
  if (tailored.changeType === "dropped") return [];
  const refs = cited(tailored, source);
  const keptGroups = new Set(QUALIFIERS.filter((q) => q.re.test(tailored.text)).map((q) => q.group));
  const issues: Issue[] = [];
  const reported = new Set<string>();
  for (const q of QUALIFIERS) {
    if (keptGroups.has(q.group) || reported.has(q.group)) continue;
    for (const s of refs) {
      const m = s.text.match(q.re);
      if (!m) continue;
      reported.add(q.group);
      issues.push({
        check: "qualifierDrop", severity: q.severity, bulletId: tailored.id, evidence: m[0].trim(),
        message: q.severity === "block"
          ? `Dropped "${m[0].trim()}" — the original makes your role/scope clear, keep it`
          : `Dropped the hedge "${m[0].trim()}" — the figure now reads as exact`,
      });
      break;
    }
  }
  return issues;
}

// ---------- 3. authorshipLevel / authorshipEscalation ----------

const LADDER: Record<string, number> = {};
function forms(level: number, ...words: string[]) { for (const w of words) LADDER[w] = level; }
forms(0, "familiar", "familiarity", "familiarised", "familiarized", "exposed", "exposure", "learned", "learnt", "learn", "learning", "learns", "studied", "observed");
forms(1, "used", "use", "uses", "using", "utilised", "utilized", "leveraged", "applied", "assisted", "assist", "assisting", "assists",
  "supported", "support", "supporting", "helped", "help", "helping", "helps", "contributed", "contribute", "contributing", "contributes");
forms(2, "built", "build", "building", "builds", "developed", "develop", "developing", "develops", "implemented", "implement", "implementing",
  "created", "create", "creating", "designed", "design", "designing", "engineered", "architected", "wrote", "programmed", "coded", "launched", "delivered",
  "ran", "run", "running", "organised", "organized", "organising", "organizing", "coordinated", "co-ordinated", "coordinate", "co-ordinate", "coordinating", "co-ordinating");
forms(3, "led", "lead", "leading", "leads", "owned", "owning", "managed", "manage", "managing", "founded", "founding",
  "spearheaded", "spearhead", "spearheading", "headed", "head", "heading", "directed", "chaired", "captained", "oversaw", "supervised",
  "pioneered", "pioneering", "established", "establishing", "orchestrated", "orchestrating", "championed", "championing", "drove", "driving");

/** Verb → rung on the authorship ladder: familiar(0) < used/helped(1) < built(2) < led/founded(3). `co-` keeps the base rung. */
export function authorshipLevel(verb: string): number | null {
  const w = verb.trim().toLowerCase();
  if (w in LADDER) return LADDER[w];
  const base = w.replace(/^co-/, "");
  return base in LADDER ? LADDER[base] : null;
}

/** First ladder verb within the bullet's opening words (CV bullets lead with the verb). */
function leadVerb(text: string): { word: string; level: number } | null {
  const words = text.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [];
  for (const w of words.slice(0, 3)) {
    const level = authorshipLevel(w);
    if (level !== null) return { word: w, level };
  }
  return null;
}

/** A source with no ladder verb ("Organised…", "Analysed…") is treated as direct, hands-on work (rung 2). */
const UNLADDERED_SOURCE_LEVEL = 2;

export function authorshipEscalation(tailored: TailoredBullet, source: SourceBullet[]): Issue[] {
  if (tailored.changeType === "dropped") return [];
  const after = leadVerb(tailored.text);
  const refs = cited(tailored, source);
  if (!after || refs.length === 0) return [];
  const tTok = contentTokens(tailored.text);
  // Same object = ≥2 shared content tokens. If no cited bullet qualifies, the citation itself asserts it.
  const sameObject = refs.filter((s) => sharedCount(tTok, contentTokens(s.text)) >= 2);
  const compare = sameObject.length ? sameObject : refs;
  const best = compare
    .map((s) => ({ s, v: leadVerb(s.text) }))
    .reduce((a, b) => ((b.v?.level ?? UNLADDERED_SOURCE_LEVEL) > (a.v?.level ?? UNLADDERED_SOURCE_LEVEL) ? b : a));
  const srcLevel = best.v?.level ?? UNLADDERED_SOURCE_LEVEL;
  if (after.level <= srcLevel) return [];
  return [{
    check: "authorshipEscalation", severity: "block", bulletId: tailored.id, evidence: `${best.v?.word ?? "(no ownership verb)"} → ${after.word}`,
    message: `"${after.word}" claims more ownership than your original "${best.v?.word ?? best.s.text.split(/\s+/)[0]}"`,
  }];
}

// ---------- 4. scopedMetrics ----------

/** `count` = a head-count ("team of 5", "5-person", "20 students"); it compares equal to a plain number of the same value. */
type MetricKind = "percent" | "currency" | "multiplier" | "range" | "plain" | "count";
type Metric = { kind: MetricKind; value: string; raw: string };

const WORD_NUMS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
};
const SUFFIX: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };

function num(raw: string, suffix?: string): string {
  const n = parseFloat(raw.replace(/,/g, "")) * (suffix ? SUFFIX[suffix.toLowerCase()] ?? 1 : 1);
  return String(Math.round(n * 1000) / 1000);
}

const N = "(\\d[\\d,]*(?:\\.\\d+)?)";
const SFX = "(?:\\s?(k|m|bn|thousand|million|billion)(?![a-z]))?";
// Digits glued to letters (GPT-4, S3, Web3, Python3) or dotted versions (Next.js 13.4) are not metrics.
const NOT_VERSION = "(?<![A-Za-z][-.]?|\\d[.,]?)";

export function extractMetrics(text: string): Metric[] {
  const out: Metric[] = [];
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => !taken.some(([a, b]) => s < b && e > a);
  const scan = (re: RegExp, make: (m: RegExpExecArray) => Metric | null) => {
    for (const m of text.matchAll(new RegExp(re.source, "gi"))) {
      const s = m.index!, e = s + m[0].length;
      if (!free(s, e)) continue;
      const metric = make(m as RegExpExecArray);
      taken.push([s, e]);
      if (metric) out.push(metric);
    }
  };
  scan(new RegExp(`[£$€]\\s?${N}${SFX}\\s?[-–]\\s?[£$€]?\\s?${N}${SFX}`), (m) => ({ kind: "range", value: `${num(m[1], m[2])}-${num(m[3], m[4])}`, raw: m[0] }));
  scan(new RegExp(`[£$€]\\s?${N}${SFX}`), (m) => ({ kind: "currency", value: num(m[1], m[2]), raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}${N}\\s?(?:%|per\\s?cent|percent)?\\s?[-–]\\s?${N}\\s?(?:%|per\\s?cent|percent)`), (m) => ({ kind: "range", value: `${num(m[1])}-${num(m[2])}%`, raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}${N}\\s?(?:%|per\\s?cent|percent)`), (m) => ({ kind: "percent", value: num(m[1]), raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}${N}\\s?[x×](?![A-Za-z0-9])`), (m) => ({ kind: "multiplier", value: num(m[1]), raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}${N}\\s?[-–]\\s?${N}(?![\\d.])`), (m) => ({ kind: "range", value: `${num(m[1])}-${num(m[2])}`, raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}${N}(k|m|bn)(?![A-Za-z])`), (m) => ({ kind: "plain", value: num(m[1], m[2]), raw: m[0] }));
  // Head-counts, extracted regardless of the following word ("a team of 5 to deliver", "a team of 4.").
  const numOrWord = (raw: string) => { const r = raw.toLowerCase(); return String(r in WORD_NUMS ? WORD_NUMS[r] : parseFloat(r.replace(/,/g, ""))); };
  const NW = `(\\d[\\d,]*|${Object.keys(WORD_NUMS).join("|")})`;
  scan(new RegExp(`\\b(?:team|group|squad|cohort) of (?:about |around |~\\s?)?${NW}(?![\\d.,]*\\d)`), (m) => ({ kind: "count", value: numOrWord(m[1]), raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}(?<![\\d.,])${NW}[- ](?:person|people|member|strong|student)(?![a-z])`), (m) => ({ kind: "count", value: numOrWord(m[1]), raw: m[0] }));
  scan(new RegExp(`${NOT_VERSION}(?<![\\d.,])${NW}\\s+(?:people|persons|members|students|pupils|volunteers|staff|employees|interns|analysts|engineers|developers|colleagues|mentees|attendees|participants)(?![a-z])`),
    (m) => ({ kind: "count", value: numOrWord(m[1]), raw: m[1] }));
  // Plain counts: ≥2, not a year, followed by a unit noun (a non-stopword), e.g. "3 society events".
  scan(new RegExp(`${NOT_VERSION}(?<![\\d.,])(\\d[\\d,]*|${Object.keys(WORD_NUMS).join("|")})(?![\\d.,]*\\d)(?=\\s+([a-z][a-z-]*))`), (m) => {
    const raw = m[1].toLowerCase();
    const n = raw in WORD_NUMS ? WORD_NUMS[raw] : parseFloat(raw.replace(/,/g, ""));
    const next = text.slice(m.index! + m[0].length).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (n < 2 || (n >= 1950 && n <= 2049 && !raw.includes(",")) || STOPWORDS.has(next)) return null;
    return { kind: "plain", value: String(n), raw: m[1] };
  });
  return out;
}

const metricKey = (m: Metric) => `${m.kind === "count" ? "plain" : m.kind}:${m.value}`;

/** A range is also supported when both endpoints appear in the same source bullet. */
function supports(have: Metric[], want: Metric): boolean {
  if (have.some((h) => metricKey(h) === metricKey(want))) return true;
  if (want.kind === "range") {
    const [a, b] = want.value.replace(/%$/, "").split("-");
    const vals = new Set(have.map((h) => h.value));
    return vals.has(a) && vals.has(b);
  }
  return false;
}

export function scopedMetrics(tailored: TailoredBullet, source: SourceBullet[], confirmedFacts: string[]): Issue[] {
  if (tailored.changeType === "dropped") return [];
  const refs = cited(tailored, source);
  const tTok = contentTokens(tailored.text);
  const scoped = refs.filter((s) => sharedCount(tTok, contentTokens(s.text)) >= 1).map((s) => extractMetrics(s.text));
  const facts = confirmedFacts.map(extractMetrics);
  const issues: Issue[] = [];
  for (const m of extractMetrics(tailored.text)) {
    if (scoped.some((h) => supports(h, m)) || facts.some((h) => supports(h, m))) continue;
    const elsewhere = refs.some((s) => supports(extractMetrics(s.text), m));
    issues.push({
      check: "scopedMetrics", severity: "block", bulletId: tailored.id, evidence: m.raw.trim(),
      message: elsewhere
        ? `"${m.raw.trim()}" comes from a different claim in your CV — numbers can't move between bullets`
        : `"${m.raw.trim()}" isn't in your original bullet — confirm it or keep the original wording`,
    });
  }
  return issues;
}

// ---------- 5. structuralLoss ----------

export function structuralLoss(tailoredRoles: TailoredRole[], sourceRoles: SourceRole[]): Issue[] {
  const byId = new Map(tailoredRoles.map((r) => [r.id, r]));
  const issues: Issue[] = [];
  for (const src of sourceRoles) {
    if (src.bullets.length === 0) continue;
    const t = byId.get(src.id);
    const accounted = new Set<string>();
    for (const b of t?.bullets ?? []) {
      if (b.changeType === "dropped") {
        if (!b.dropReason?.trim()) continue; // a drop without a reason is not "explicit"
        accounted.add(b.id);
        b.sourceRefs.forEach((r) => accounted.add(r));
      } else b.sourceRefs.forEach((r) => accounted.add(r));
    }
    const missing = src.bullets.map((b) => b.id).filter((id) => !accounted.has(id));
    if (missing.length === 0) continue;
    issues.push({
      check: "structuralLoss", severity: "warn", roleId: src.id, evidence: missing.join(", "),
      message: t
        ? `${missing.length} bullet(s) from ${src.title} at ${src.org} disappeared without being marked as dropped`
        : `${src.title} at ${src.org} is missing from the tailored CV`,
    });
  }
  return issues;
}

// ---------- 6. temporal ----------

function endYear(end: string | undefined): number | null {
  if (!end || /present|current|now|ongoing/i.test(end)) return null;
  const years = end.match(/(?:19|20)\d{2}/g);
  return years ? parseInt(years[years.length - 1], 10) : null;
}

export function temporal(tailoredRoles: TailoredRole[], sourceRoles: SourceRole[]): Issue[] {
  const byId = new Map(sourceRoles.map((r) => [r.id, r]));
  const issues: Issue[] = [];
  for (const t of tailoredRoles) {
    const src = byId.get(t.id);
    const end = endYear(src?.dates.end as string | undefined);
    if (!src || end === null) continue;
    for (const b of t.bullets) {
      if (b.changeType === "dropped") continue;
      for (const tool of TOOL_RELEASE_YEARS) {
        if (tool.year <= end || !tool.pattern.test(b.text)) continue;
        issues.push({
          check: "temporal", severity: "block", roleId: t.id, bulletId: b.id, evidence: tool.name,
          message: `${tool.name} came out in ${tool.year}, after this role ended (${end})`,
        });
      }
    }
  }
  return issues;
}

// ---------- 7. runExtraChecks ----------

export type ExtraChecksInput = { sourceRoles: SourceRole[]; tailoredRoles: TailoredRole[]; confirmedFacts?: string[] };

export function runExtraChecks({ sourceRoles, tailoredRoles, confirmedFacts = [] }: ExtraChecksInput): Issue[] {
  const allSource = sourceRoles.flatMap((r) => r.bullets);
  const issues: Issue[] = [];
  for (const role of tailoredRoles) {
    for (const b of role.bullets) {
      if (b.changeType === "dropped") continue;
      for (const i of [
        ...siblingContamination(b, allSource), ...qualifierDrop(b, allSource),
        ...authorshipEscalation(b, allSource), ...scopedMetrics(b, allSource, confirmedFacts),
      ]) issues.push({ ...i, roleId: role.id });
    }
  }
  issues.push(...structuralLoss(tailoredRoles, sourceRoles), ...temporal(tailoredRoles, sourceRoles));
  const rank = (i: Issue) => (i.severity === "block" ? 0 : 1);
  return issues.map((i, n) => ({ i, n })).sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n).map(({ i }) => i);
}
