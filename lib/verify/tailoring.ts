/**
 * verifyTailoring — the deterministic anti-fabrication gate (spec §7.3, amendments A3, research 05 §3). No LLM.
 *
 * Tailoring may reorder, rephrase and emphasise. It may never add skills, numbers, employers, titles or tools
 * that are absent from the source CV ∪ confirmed_facts. The JD is never a fact source: it is only used for
 * coverage and gaps. A PDF is never rendered while the verdict is `block`.
 *
 * Fact corpus (C7): CONTENT ONLY — raw CV text, bullet/detail texts, org/title/dates/location, degree/grade/
 * institution, skills, summary, interests — plus confirmedFacts. Never ids, archetypes, sectionOrder, yearGuess
 * or any serialised JSON. Employer/title/tool presence is whole-token matching.
 *
 * Known limit (by design): a tool written in lower case that is outside the skills vocabulary
 * (lib/skills/vocab.ts) and is not a known employer is indistinguishable from an ordinary English word, so it
 * cannot be detected here ("used airtable" passes). Capitalised or acronym tools are caught by the proper-noun
 * rule; vocab tools by skillInjection/siblingContamination. Grow the vocab to close the gap.
 */
import type { ParsedCV, TailoredCV, TailoredEntry, TailoredBullet, TailorChangeType, CvEntry } from "@/lib/types";
import { extractSkills } from "@/lib/skills/extract";
import { EMAIL_RE, PHONE_RE, escapeRegex } from "@/lib/text/regex";
import { clicheDensity } from "@/lib/cv/cliches";
import { runExtraChecks, extractMetrics, authorshipLevel, type SourceRole, type TailoredRole, type Issue as ExtraIssue } from "./checks-extra";

export type IssueType =
  | "inventedMetrics" | "unsupportedFacts" | "authorshipEscalation" | "skillInjection" | "orphanBullets"
  | "perBulletDrift" | "forbiddenPhrases" | "coverage"
  | "siblingContamination" | "qualifierDrop" | "structuralLoss" | "temporal" | "clicheDensity";
/** `check` names the fine-grained rule when it differs from `type` (e.g. scoped metrics report as inventedMetrics). */
export type Issue = { type: IssueType; severity: "block" | "warn"; bulletId?: string; entryId?: string; claim: string; reason: string; check?: string };
export type VerifyReport = {
  verdict: "pass" | "warn" | "block";
  issues: Issue[];
  keywordCoverage?: { before: number; after: number; missing: string[] };
  gapsStillOpen?: string[];
};
export type VerifyInput = {
  source: ParsedCV; sourceText: string; confirmedFacts: string[]; tailored: TailoredCV;
  jdKeywords: string[]; coverageBefore: number | null; coverageAfter: number | null;
};

// ---------- text helpers ----------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Whole-token phrase match on normalised text ("lead" does not match "leadership"). */
const hasToken = (hayNorm: string, needle: string) => { const n = norm(needle); return n !== "" && ` ${hayNorm} `.includes(` ${n} `); };

const MONTHS: [RegExp, string][] = ["january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december"]
  .map((m) => [new RegExp(`\\b${m}\\b`, "g"), m.slice(0, 3)]);
/** Dates compare with month names shortened: "September 2023" ≡ "Sep 2023" ≡ "Sept 2023". */
const normDate = (s: string) => MONTHS.reduce((t, [re, short]) => t.replace(re, short), norm(s)).replace(/\bsept\b/g, "sep");

/** "500 GBP", "500 pounds" → "£500" (same for $/€), applied to both sides before comparing metrics. */
const normCurrency = (t: string) => t
  .replace(/(\d[\d,.]*(?:\s?(?:k|m|bn)\b)?)\s*(?:GBP|pounds?(?:\s+sterling)?|sterling)\b/gi, "£$1")
  .replace(/(\d[\d,.]*(?:\s?(?:k|m|bn)\b)?)\s*(?:USD|US\s?dollars?|dollars?)\b/gi, "$$$1")
  .replace(/(\d[\d,.]*(?:\s?(?:k|m|bn)\b)?)\s*(?:EUR|euros?)\b/gi, "€$1");

const NUM = /\d+(?:[.,]\d+)*(?:\s?(?:%|k\b|m\b|bn\b|x\b))?/gi;
const MULT: Record<string, number> = { k: 1e3, m: 1e6, bn: 1e9 };
/** Numeric values a token stands for: "1,200" → 1200; "2k" → 2 and 2000. */
function numValues(raw: string): string[] {
  const d = raw.match(/\d+(?:[.,]\d+)*/)?.[0];
  if (!d) return [];
  const v = parseFloat(d.replace(/,/g, ""));
  const sfx = raw.toLowerCase().match(/(k|m|bn)\s*$/)?.[1];
  return sfx ? [String(v), String(Math.round(v * MULT[sfx] * 1000) / 1000)] : [String(v)];
}
const GLOBAL = (re: RegExp) => new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
/** Contact details are content but never claims; strip them so a phone number can't license a metric. */
const stripContacts = (t: string) => t.replace(GLOBAL(EMAIL_RE), " ").replace(/https?:\/\/\S+|www\.\S+/gi, " ").replace(GLOBAL(PHONE_RE), " ");

function numberSet(text: string): Set<string> {
  const out = new Set<string>();
  const clean = stripContacts(text);
  for (const m of clean.match(NUM) ?? []) numValues(m).forEach((v) => out.add(v));
  for (const m of extractMetrics(clean)) for (const v of m.value.replace(/%$/, "").split("-")) out.add(v);
  return out;
}
const isYearLike = (v: string) => /^\d{4}$/.test(v) && +v >= 1950 && +v <= 2049;

// ---------- word / multiplier / vague metrics (fix 1) ----------

const ONES: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SMALL: Record<string, number> = { a: 1, one: 1, ...ONES, ...TEENS, ...TENS };
const alt = (o: Record<string, number>) => Object.keys(o).join("|");
/** Lower bound a vague quantity implies; the source must show a number at least this big (or the same word). */
const VAGUE_MIN: Record<string, number> = { dozens: 24, scores: 40, hundreds: 200, thousands: 2000, millions: 2_000_000 };
const MULT_VERB: Record<string, number> = { doubl: 2, tripl: 3, quadrupl: 4, halv: 0.5 };

type WordMetric = { raw: string; key: string };
/** Keys: `n:<value>` (a number; fractions as their percent), `x:<factor>` (multiplier), `v:<word>` (vague quantity). */
export function wordMetrics(text: string): WordMetric[] {
  const out: WordMetric[] = [];
  const taken: [number, number][] = [];
  const scan = (re: RegExp, key: (m: RegExpMatchArray) => string | null) => {
    for (const m of text.matchAll(new RegExp(re.source, "gi"))) {
      const s = m.index!, e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      const k = key(m);
      if (k === null) continue;
      taken.push([s, e]);
      out.push({ raw: m[0].trim(), key: k });
    }
  };
  const n = (w: string | undefined) => (w ? SMALL[w.toLowerCase()] ?? parseFloat(w) : 1);
  scan(/\b(dozens|scores|hundreds|thousands|millions)\s+of\b/, (m) => `v:${m[1].toLowerCase()}`);
  scan(new RegExp(`\\b(?:(a|one|${alt(ONES)})\\s+)?dozen\\b`), (m) => `n:${12 * n(m[1])}`);
  scan(/\b(a|one|two|three)[- ](quarters?|thirds?)\b/, (m) => `n:${Math.round((100 * n(m[1])) / (/quarter/i.test(m[2]) ? 4 : 3))}`);
  scan(/\b(?:by|in)\s+half\b|\bhalf\s+(?:of|the)\b/, () => "n:50");
  scan(/\b(doubl|tripl|quadrupl|halv)(?:e|ed|es|ing)\b/, (m) => `x:${MULT_VERB[m[1].toLowerCase()]}`);
  scan(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${alt(ONES)}|ten)[- ]?fold\\b`), (m) => `x:${n(m[1])}`);
  scan(new RegExp(`\\b(${alt(TENS)})(?:[- ](${alt(ONES)}))?(?:\\s+(hundred|thousand))?\\b`),
    (m) => `n:${(TENS[m[1].toLowerCase()] + (m[2] ? ONES[m[2].toLowerCase()] : 0)) * (m[3] ? (/hundred/i.test(m[3]) ? 100 : 1000) : 1)}`);
  scan(new RegExp(`\\b(a|one|${alt(ONES)}|${alt(TEENS)})\\s+(hundred|thousand)\\b`), (m) => `n:${n(m[1]) * (/hundred/i.test(m[2]) ? 100 : 1000)}`);
  scan(new RegExp(`\\b(${alt(ONES)}|${alt(TEENS)})\\b`), (m) => `n:${n(m[1])}`);
  return out;
}

/** Everything a source text can back: digit values, digit multipliers ("3x", "3-fold", "+100%"), and its own word metrics. */
function supportKeys(text: string): Set<string> {
  const keys = new Set<string>();
  const clean = stripContacts(text);
  for (const v of numberSet(clean)) keys.add(`n:${v}`);
  for (const m of clean.matchAll(/(\d+(?:\.\d+)?)\s?(?:[x×](?![a-z0-9])|-?fold\b)/gi)) keys.add(`x:${parseFloat(m[1])}`);
  for (const m of clean.matchAll(/(\d+)\s?%/g)) { const p = +m[1]; if (p % 100 === 0 && p > 0) keys.add(`x:${p / 100 + 1}`); }
  for (const w of wordMetrics(clean)) keys.add(w.key);
  return keys;
}
function keySupported(key: string, keys: Set<string>): boolean {
  if (keys.has(key)) return true;
  if (key.startsWith("v:")) {
    const min = VAGUE_MIN[key.slice(2)];
    return [...keys].some((k) => k.startsWith("n:") && +k.slice(2) >= min);
  }
  return false;
}
/**
 * Round 5: "dozens of weekly society events" names what it counts; the source must count the same thing ("30 weekly
 * society events"), not just hold a big number for something else ("60 members"). The noun is the first count noun
 * within four words of the phrase; with none, any number big enough still backs it.
 */
function vagueNoun(text: string, end: number): string | null {
  const words = text.slice(end).match(/[A-Za-z][A-Za-z-]*/g)?.slice(0, 5) ?? [];
  const w = words.map((x) => x.split("-").pop()!).find((x) => isCountNoun(x));
  return w ? stem(w) : null;
}
function vagueBacked(key: string, noun: string | null, keys: Set<string>, supportText: string): boolean {
  if (keys.has(key)) return true;
  const min = VAGUE_MIN[key.slice(2)];
  if (noun === null) return keySupported(key, keys);
  const followedByNoun = (end: number) =>
    (supportText.slice(end).match(/[A-Za-z][A-Za-z-]*/g)?.slice(0, 4) ?? []).some((x) => stem(x.split("-").pop()!) === noun);
  for (const m of supportText.matchAll(NUM)) {
    if (numValues(m[0]).some((v) => +v >= min) && followedByNoun(m.index! + m[0].length)) return true;
  }
  // Task 22b: number words count too ("Organised thirty weekly society events" backs "dozens of … events")
  for (const w of wordMetrics(supportText)) {
    if (!w.key.startsWith("n:") || +w.key.slice(2) < min) continue;
    for (let at = supportText.indexOf(w.raw); at >= 0; at = supportText.indexOf(w.raw, at + 1)) if (followedByNoun(at + w.raw.length)) return true;
  }
  return false;
}
/** Numeric values named by an issue claim, digits or words ("thirty" → 30). */
const claimValues = (claim: string) => [...numValues(claim), ...wordMetrics(claim).filter((w) => w.key.startsWith("n:")).map((w) => w.key.slice(2))];

// ---------- stems ----------

const STOP = new Set(("a an the and or but of to in on at by for from with into over under via per as is are was were be been this that these those it its " +
  "their them they our who which what while when where than then so such also very more most less each every all both other across within during after " +
  "before through about using used use based including weekly daily monthly").split(" "));
const stem = (w: string) => {
  let s = w.toLowerCase();
  if (s.length > 5) s = s.replace(/(ations?|ings?|edly|ed|es|ly|s)$/, "");
  if (s.length > 4) s = s.replace(/e$/, "");
  return s;
};
const contentStems = (t: string) => new Set((t.toLowerCase().match(/[a-z][a-z0-9+#]*/g) ?? []).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem));

// ---------- corpus ----------

const sections = <T extends { experience: E[]; projects: E[]; leadership: E[] }, E>(c: T) => [...c.experience, ...c.projects, ...c.leadership];

/** The fact corpus (C7): content only, plus confirmed facts. Exported for tests and Task 23. */
export function buildFactCorpus(cv: ParsedCV, sourceText: string, confirmedFacts: string[]): string {
  const parts: (string | null)[] = [sourceText, cv.name, cv.location, cv.summary, cv.interests];
  for (const e of cv.education) parts.push(e.institution, e.degree, e.dates, e.grade, ...e.details.map((d) => d.text));
  for (const e of sections<ParsedCV, CvEntry>(cv)) parts.push(e.org, e.title, e.dates, e.location, ...e.bullets.map((b) => b.text));
  for (const g of cv.skills) parts.push(g.group, ...g.items);
  parts.push(...confirmedFacts);
  return parts.filter((p): p is string => !!p && p.trim() !== "").join("\n");
}

/**
 * Numbers a metric may use (fix 6): everything in the structured, non-date content and confirmed facts, plus
 * raw-text numbers that are neither a date-field value nor year-shaped. "Mentored 2026 students" can't borrow
 * a graduation year.
 */
function metricCorpus(cv: ParsedCV, sourceText: string, confirmedFacts: string[]): Set<string> {
  const structured: (string | null)[] = [cv.summary, cv.interests, ...confirmedFacts];
  const dates: string[] = [];
  for (const e of cv.education) { structured.push(e.institution, e.degree, e.grade, ...e.details.map((d) => d.text)); dates.push(e.dates); }
  for (const e of sections<ParsedCV, CvEntry>(cv)) { structured.push(e.org, e.title, e.location, ...e.bullets.map((b) => b.text)); dates.push(e.dates); }
  for (const g of cv.skills) structured.push(...g.items);
  const out = numberSet(structured.filter(Boolean).join("\n"));
  const dateVals = new Set<string>();
  for (const d of dates) for (const m of d.match(NUM) ?? []) numValues(m).forEach((v) => dateVals.add(v));
  for (const v of numberSet(sourceText)) if (!dateVals.has(v) && !isYearLike(v)) out.add(v);
  return out;
}

/** Every value in the CV's own date fields (entries and education). */
function dateFieldValues(cv: ParsedCV): Set<string> {
  // no contact stripping here: adjacent date ranges ("2023 - 2024\n2024–2027") look like a phone number
  const out = new Set<string>();
  for (const d of [...cv.education.map((e) => e.dates), ...sections<ParsedCV, CvEntry>(cv).map((e) => e.dates)]) for (const m of d.match(NUM) ?? []) numValues(m).forEach((v) => out.add(v));
  return out;
}

/** A year-shaped number followed by a dash and another year (or "present") is the start of a range, not a count. */
const RANGE_AFTER = /^\s*[–—-]\s*(?:\d{2,4}|present|now|current)\b/i;
/** Count verbs (round 4 ruling, plus amount verbs): directly before a CV year they make it a count ("Served 2025", "Raised 2025"). */
const COUNT_VERB = "(?:serv|mentor|train|host|welcom|reach|manag|recruit|teach|support|attract|engag|onboard|coach|" +
  "rais|generat|sav|collect|process|secur|earn|donat|sell)(?:e|es|ed|s|ing)?|led|leads?|leading|taught|sold";
/** Quantity phrases directly before a number: "over 2025", "for up to 2025", "attendance of 2025", "£2025". */
const QUANTIFIER = "over|more\\s+than|at\\s+least|up\\s+to|nearly|almost|approximately|approx\\.?|roughly|upwards\\s+of|in\\s+excess\\s+of|" +
  "(?:a\\s+)?total\\s+of|(?:attendance|audience|turnout|crowd|footfall|membership|reach)\\s+of";
const COUNT_BEFORE = new RegExp(`(?:\\b(?:${COUNT_VERB})(?:\\s+(?:${QUANTIFIER}))?|\\borgani[sz](?:e|es|ed|ing)\\s+for|\\b(?:${QUANTIFIER})|[£$€#~+×]|(?<![A-Za-z])x)\\s*$`, "i");
/**
 * Words after a year-shaped number that make it a count (round 3). Case-sensitive on purpose: only a lowercase
 * plural ("students", "venues") or an irregular plural counts. Capitalised words ("Economics", "Physics") and
 * singular nouns ("student", "member") don't, so "Class of 2027 Economics student" is a date.
 */
const PLURAL = /^[a-z][a-z]*s$/;
const IRREG_PLURAL = new Set(["people", "staff", "children", "alumni", "personnel", "crew"]);
const NOT_COUNT = new Set(("as is was has his its this thus plus across towards alongside besides whereas does goes always various previous " +
  "gas bus yes us").split(" "));
const FUNCTION_WORD = new Set("with as at in on for and or to of by from the a an while during under over into via when where who which that".split(" "));
/** Skill names that look plural ("pandas", "Sheets") are tools, not counted things (round 4). */
const isCountNoun = (w: string) => IRREG_PLURAL.has(w) || (PLURAL.test(w) && !NOT_COUNT.has(w) && !/(?:ss|ics|us|is)$/.test(w) && extractSkills(w).length === 0);
/** True when the words after a number read as a count: a plural noun within 2 tokens (past closing brackets), or "in total". */
function countAfter(after: string): boolean {
  const rest = after.replace(/^\s*[)\]]+/, " ");
  if (/^\s+(?:in\s+total|total\b|per\b|each\b|every\b|a\s+(?:day|week|weekend|month|term|year|session|shift|night)\b)/i.test(rest)) return true;
  const toks = rest.match(/^\s+([A-Za-z][A-Za-z-]*)(?:\s+([A-Za-z][A-Za-z-]*))?/);
  if (!toks) return false;
  const last = (w: string) => w.split("-").pop()!;
  if (isCountNoun(last(toks[1]))) return true;
  return !!toks[2] && !FUNCTION_WORD.has(toks[1].toLowerCase()) && /^[a-z]/.test(toks[1]) && isCountNoun(last(toks[2]));
}
/** "growing membership to 2025", "from 40 to 2025": a to/by year closing a numeric growth phrase is a count. */
function growthTarget(before: string): boolean {
  if (!/\b(?:to|by)\s*$/i.test(before)) return false;
  const win = before.slice(-60);
  const nonYearNumber = (win.match(/\d[\d,.]*/g) ?? []).some((d) => !isYearLike(d.replace(/[,.]/g, "")));
  return nonYearNumber || /\b(?:grow\w*|grew|increas\w*|rais\w*|expand\w*|boost\w*|reach\w*|doubl\w*|tripl\w*|scal\w*|membership|attendance|audience|followers|sign-?ups?|users|revenue|sales)\b/i.test(win);
}
/**
 * Round 4: a year-shaped value from the CV's own date fields is a YEAR by default ("2027 Economics student",
 * "UCL | 2027", "Events Officer 2025", "Class of '27"). It is a COUNT only when a count verb or quantity phrase
 * directly precedes it ("Served 2025", "for up to 2025"), a count noun / "in total" / "per" follows it
 * ("2024 users", "2025 per weekend"), or it closes a growth phrase ("growing membership to 2025").
 */
function isYearUse(text: string, index: number, raw: string, dateVals: Set<string>): boolean {
  const before = text.slice(0, index), after = text.slice(index + raw.length);
  if (!/^\d{2}$|^\d{4}$/.test(raw)) return false; // "2,025", "2025%", "2025k" are never years
  // "2024-27": the short end of a range takes the century of its start; "'27" is a CV year written short
  const rangeStart = /^\d{2}$/.test(raw) ? before.match(/(\d{2})\d{2}\s*[–—-]\s*$/) : null;
  const v = rangeStart ? rangeStart[1] + raw : /^\d{2}$/.test(raw) ? (/['’‘]$/.test(before) ? `20${raw}` : null) : raw;
  if (!v || !isYearLike(v) || !dateVals.has(v)) return false;
  if (countAfter(after) || growthTarget(before)) return false;
  if (/^\s*\+/.test(after)) return false; // "2025+"
  // a count verb before a range start ("Served 2024–2025 as …") still reads as a date
  return !COUNT_BEFORE.test(before) || RANGE_AFTER.test(after);
}

/** Content units a summary/interests number can be scoped to (fix 5). */
function sourceUnits(cv: ParsedCV): string[] {
  const u: string[] = [];
  for (const e of sections<ParsedCV, CvEntry>(cv)) { u.push(`${e.title} ${e.org}`); u.push(...e.bullets.map((b) => b.text)); }
  for (const e of cv.education) { u.push(`${e.institution} ${e.degree} ${e.grade ?? ""}`); u.push(...e.details.map((d) => d.text)); }
  if (cv.summary) u.push(cv.summary);
  if (cv.interests) u.push(cv.interests);
  return u;
}

/** JD keywords that name a credential, tool or qualification (not a soft word like "stakeholder"). */
const isHardTerm = (kw: string) => /\d/.test(kw) || /[A-Z]{2,}/.test(kw) || /\b(level|certif\w*|chartered|licen[cs]\w*|qualif\w*|accredit\w*|degree|diploma)\b/i.test(kw);

/** JD requirements/keywords the student's CV (∪ confirmed facts) does not evidence. The tailored CV is never consulted. */
export function gapsStillOpen(i: { source: ParsedCV; sourceText: string; confirmedFacts: string[]; jdKeywords: string[] }): string[] {
  const corpus = buildFactCorpus(i.source, i.sourceText, i.confirmedFacts);
  const cNorm = norm(corpus);
  const srcSkills = new Set(extractSkills(corpus));
  return i.jdKeywords.filter((kw) => {
    const sk = extractSkills(kw);
    return sk.length ? sk.some((s) => !srcSkills.has(s)) : !hasToken(cNorm, kw);
  });
}

// ---------- identity tailoring ----------

export function toTailored(cv: ParsedCV): TailoredCV {
  const map = (es: CvEntry[]): TailoredEntry[] => es.map((e) => ({
    id: e.id, org: e.org, title: e.title, dates: e.dates, location: e.location,
    bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, sourceRefs: [b.id], changeType: "kept" as const })),
  }));
  return {
    summary: cv.summary, education: cv.education.map((e) => ({ ...e, details: e.details.map((d) => ({ ...d })) })),
    experience: map(cv.experience), projects: map(cv.projects), leadership: map(cv.leadership),
    skills: cv.skills.map((g) => ({ ...g, items: [...g.items] })), interests: cv.interests, changes: [],
  };
}

// ---------- lexicons ----------

const FORBIDDEN: [string, RegExp][] = [
  ["proven track record", /\bproven track record\b/i], ["world-class", /\bworld[- ]class\b/i], ["rockstar", /\brock ?stars?\b/i],
  ["ninja", /\bninjas?\b/i], ["guru", /\bgurus?\b/i], ["thought leader", /\bthought[- ]leader\w*/i], ["synergy", /\bsynerg\w*/i],
  ["seasoned", /\bseasoned\b/i], ["visionary", /\bvisionary\b/i], ["best-in-class", /\bbest[- ]in[- ]class\b/i], ["unparalleled", /\bunparalleled\b/i],
  ["expert in", /\bexpert(?:ise)? (?:in|at|with)\b/i],
];
const WARN_PHRASES: [string, RegExp][] = [
  ["passionate about", /\bpassionate about\b/i], ["results-driven", /\bresults?[- ]driven\b/i], ["dynamic", /\bdynamic\b/i],
  ["detail-oriented", /\bdetail[- ]oriented\b/i], ["team player", /\bteam[- ]player\b/i], ["hard-working", /\bhard[- ]?working\b/i],
  ["self-starter", /\bself[- ]starter\b/i], ["go-getter", /\bgo[- ]getter\b/i],
];
/** Non-verb ownership claims (fix 4): blocked when the cited source doesn't already make them. */
const OWNERSHIP: [string, RegExp][] = [
  ["took ownership", /\b(?:took|taking|take)\s+(?:full\s+|complete\s+)?ownership\b|\bownership\s+of\b/i],
  ["responsible for", /\b(?:solely\s+|fully\s+|directly\s+)?responsible\s+for\b/i],
  ["end to end", /\bend[- ]to[- ]end\b/i],
  ["sole", /\bsole(?:ly)?\b/i],
  ["single-handedly", /\bsingle[- ]?handed(?:ly)?\b/i],
  ["lead role", /\b(?:as|the)\s+(?:[a-z]+\s+){0,2}lead\b(?!\s+(?:to|on|in)\b)|\blead\s+(?:developer|engineer|organi[sz]er|analyst|author|designer|researcher|consultant)\b/i],
  ["in charge of", /\bin\s+charge\s+of\b/i],
  ["independently", /\bindependently\b|\bon\s+my\s+own\b/i],
  ["head of", /\bhead\s+of\b/i],
];
/** New achievement claims (fix 8, warn). */
const ACHIEVEMENT = /\baward[- ]winning\b|\bawards?\b|\bawarded\b|\bprizes?\b|\b(?:first|1st|second|2nd|third|3rd)\s+place\b|\bwinners?\b|\bwon\b|\bwinning\b|\bfinalists?\b|\bchampion(?:s|ship)?\b|\branked\b|\btop\s+\d+%?/gi;
const INFLATE = /\b(?:over|more\s+than|upwards\s+of|at\s+least|in\s+excess\s+of)\s+[£$€]?(\d[\d,]*)|[£$€]?(\d[\d,]*)\s?\+/gi;

/** Capitalised words that are never a tool/employer claim on their own. */
const PROPER_ALLOW = new Set(("i kpi kpis roi uk us usa eu b2b b2c q1 q2 q3 q4 cv gbp usd eur " +
  "january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec " +
  "monday tuesday wednesday thursday friday saturday sunday").split(" "));
/**
 * Common English words that may start a sentence without naming anything (fix 2). Compact by design: verb- and
 * adjective-shaped words are handled by WORDISH below, and known employers are matched case-insensitively anyway.
 */
const COMMON = new Set((
  "a an the this that these those my our his her their its it i we he she they you one two some any each every all both many most several few " +
  "and or but so yet nor for to of in on at by with from into onto about as after before during while since until over under through between among " +
  "also then still just only even not no yes very well now here there when where why how what which who whose whom if though although because " +
  "ex former current currently previously recently later early first second third final penultimate last next new prior " +
  "student students undergraduate undergrad graduate postgraduate aspiring ambitious motivated keen eager curious hardworking diligent enthusiastic " +
  "interested experienced skilled strong proven confident reliable proactive creative analytical numerate driven committed dedicated organised organized " +
  "passionate year years team teams data software business finance economics mathematics maths math computer science engineering physics chemistry biology " +
  "history law medicine management marketing research project projects society club university college school course module degree " +
  "intern internship placement volunteer member president treasurer secretary officer captain tutor mentor analyst developer engineer assistant " +
  "ambassador representative coordinator lead head founder co cofounder award awards hobbies interests include includes including outside away " +
  "reading writing running football chess music piano guitar travel travelling traveling cooking photography swimming cycling hiking tennis rugby " +
  "cricket basketball debating gaming languages fluent native conversational working worked work skills skill experience tools technical languages " +
  "web mobile app apps backend frontend full stack cloud machine learning ai quantitative qualitative financial commercial technical"
).split(" "));
/**
 * Irregular past-tense verbs (round 2): ordinary CV openers that WORDISH can't see. Authorship-ladder verbs
 * (built, led, ran, wrote, oversaw…) are skipped here too but are still judged by the authorship checks.
 */
const IRREGULAR_PAST = new Set((
  "dealt taught made kept met grew cut held set took sold brought found gave became spoke drew won began chose did got lent left paid put read " +
  "sent spent stood told thought understood went undertook built led ran wrote oversaw drove bought caught fought sought saw knew threw rose " +
  "shot shut split spread struck swam taught tore wore won wound overcame oversaw overtook withdrew upheld withstood rebuilt rewrote reran " +
  "had was were felt heard lost meant sat slept stuck swept bent bound fed fled hung laid lit mistook outgrew sped forgave forecast broadcast"
).split(" "));
/** Plain adjectives that open summaries/bullets (round 2). */
const ADJECTIVES = new Set((
  "adept calm versatile thorough quick diligent organised organized proactive analytical curious reliable motivated passionate enthusiastic " +
  "able agile astute bright capable careful clear collaborative conscientious dependable determined efficient energetic focused hardworking " +
  "honest independent innovative inquisitive logical meticulous methodical numerate patient persistent personable practical precise " +
  "productive punctual quantitative rigorous resilient resourceful responsible self sharp smart sociable strategic talented tenacious " +
  "thoughtful tireless trustworthy upbeat vibrant warm keen eager friendly hard fast high low multi tech results detail people customer client " +
  "class cross well"
).split(" "));
/**
 * Ordinary heads of capitalised hyphen compounds (rounds 3–5): "Till-trained", "Self-funded", "Tax-savvy", "Society-trained".
 * A compound with any other head is exempt only when its tail is attitude-only (ATTITUDE_TAIL).
 */
const HYPHEN_HEADS = new Set(("hands hand detail fast self high low multi tech results client customer cross data team well long short full part " +
  "year time first second third final top mid non pre post re co sub semi over under open end real large small cost user people problem goal " +
  "award student community quick hard easy fact number numbers market public private front back side one two three four five half " +
  "forward future solution value risk budget deadline till crowd industry peer government council family employee charity state " +
  "dry trial test home barista retail sales staff volunteer club society university college school field site job " +
  "tax stats code spreadsheet money " +
  // fix round 2: generic organisation nouns ("Grant-funded", "Committee-led", "Board-approved", "Shop-run", "Weekend-trained")
  "employer company firm grant committee board manager supervisor trust union shop weekly members donations weekend shift hospitality").split(" "));
/**
 * Round 5 ruling: tails that only describe an attitude ("Policy-focused", "Brand-aware") never make the head a claim.
 * Every other tail (competence: savvy, literate, proficient, based, ready…; affiliation: trained, led, sponsored,
 * commissioned…) needs an ordinary head, or the head is a name candidate at any position.
 */
const ATTITUDE_TAIL = /^(?:focused|driven|minded|oriented|conscious|aware|centred|centered|centric|first|facing)$/;
/** Suffixes strong enough to mark a compound head as an ordinary word ("Leadership-trained"); not the loose -er/-ian/-al shapes. */
const STRONG_WORDISH = /(?:ing|ed|ment|ness|tion|sion|ship|ology|ism)$/;
/** Task 22b (b): -ly adverbs built on adjective endings ("Commercially-savvy", "Quantitatively-trained"). */
const LY_ADVERB = /^[a-z]{3,}(?:al|ic|ive|ous|ful|ent|ant|ate|ar)ly$/i;
/** Plain adverbs outside LY_ADVERB's shape that precede a participle ("Fully trained", "Newly funded"). */
const ADVERBS = new Set("fully newly highly partly jointly widely well".split(" "));
/** Task 22b (d): CV-domain nouns that head ordinary compounds ("Evidence-based", "Audit-ready", "Event-experienced"). */
const DOMAIN_HEADS = new Set(("evidence insight policy analytics career interview workplace audit media digital commerce model theory survey revenue " +
  "office cash case event data research finance market client project product team community sector industry numbers detail quality process " +
  "risk impact growth value people customer service stakeholder society till").split(" "));
/**
 * Fix round 1 (ruling 3): affiliation tails. With one of these the head names who trained/paid/ran it, so it must be list
 * vocabulary (not a CV word that merely happens to match, "boots"), never a known employer, and never a COMMON brand collision.
 */
const AFFIL_TAIL = /^(?:sponsored|funded|backed|mentored|commissioned|trained|hosted|employed|certified|accredited|endorsed|led|run|owned|hired|placed|partnered|approved)$/;
/** COMMON words that are also single-word brands ("Next-trained", "Three-sponsored"); they never head an affiliation compound. */
const COMMON_BRANDS = new Set("next one three first current head".split(" "));
/** Month names/abbreviations: date-field tokens never make a head ordinary ("Mar" must not launder "Mars-sponsored"). */
const MONTH_TOKENS = new Set(("jan feb mar apr may jun jul aug sep sept oct nov dec january february march april june july august september " +
  "october november december present now current").split(" "));
/** Task 22b (c): a head's stem — trailing s/es/ed/ing stripped ("Events" ≡ "Event"). */
const headStem = (w: string) => { const s = w.toLowerCase(); const t = s.replace(/(?:ing|ed|es|s)$/, ""); return t.length >= 3 ? t : s; };
/** Task 22b: participles that turn a preceding capitalised word into an affiliation claim ("Unilever sponsored"). */
const AFFIL_PARTICIPLE = /^\s+(sponsored|trained|backed|funded|led|mentored|certified|accredited|hosted|employed|commissioned|endorsed|run|owned|hired|placed|partnered|approved)\b/i;
/** Fix round 2: role/claim nouns that make the capitalised words before them an employer claim ("Unilever summer intern"). */
const ROLE_NOUN = "interns?|internships?|placements?|schemes?|trainees?|traineeships?|programmes?|programs?|alumn(?:us|a|i|ae)|analysts?|associates?|" +
  "graduates?|apprentices?|apprenticeships?|insight|spring\\s+weeks?|summer\\s+analysts?|work\\s+experience|employees?";
/** A role noun directly after, or one word after, a name ("Mercer placement", "Unilever summer intern"). */
/**
 * Fix round 3 (ruling C): what may sit between a name and its role noun — a possessive ('s / ’s), a comma, colon, dash
 * or plain space, a year or "(year)", and one more word ("Prudential, summer intern", "Prudential (2025) internship").
 */
/**
 * Fix round 4 (ruling 3): up to two gap tokens from a closed set — a season, a year, "(Season Year)", a city/region, a company
 * suffix — each followed by a separator (; | / — – , : or spaced hyphen); or (round 3) an optional gap token then one free word.
 */
const ROLE_SEP = "(?:\\s*[,:;|/–—]\\s*|\\s+-\\s+|\\s+)";
const GAP_YEAR = "(?:19|20)\\d{2}(?:\\s*[–—-]\\s*(?:19|20)?\\d{2})?";
const GAP_TOKEN = `\\(?(?:(?:[Ss]ummer|[Ss]pring|[Aa]utumn|[Ww]inter|[Vv]acation)(?:\\s+${GAP_YEAR})?|${GAP_YEAR}|` +
  "London|UK|Manchester|Edinburgh|Europe|EMEA|plc|PLC|Plc|Ltd|LTD|LLP|Group)\\)?";
/** Round-3 separators only (no ; | /) before a free word, so "Bloomberg / Excel analyst tools" stays tool use. */
const ROLE_SEP_FREE = "(?:\\s*[,:–—]\\s*|\\s+-\\s+|\\s+)";
const ROLE_GAP = `(?:['’]s)?(?:${ROLE_SEP}(?:${GAP_TOKEN}${ROLE_SEP}){1,2}|${ROLE_SEP_FREE}(?:${GAP_TOKEN}${ROLE_SEP})?(?:[A-Za-z]+\\s+)?)`;
const ROLE_AFTER = new RegExp(`^${ROLE_GAP}(?:${ROLE_NOUN}|employees?|staff|sponsorships?)\\b`, "i");
/**
 * Fix round 4 (ruling 1): a CV tool may modify only a bare "analyst" ("Bloomberg analyst consensus", "Tableau analyst for
 * society events"). A year, "(year)", "since", intern/internship, programme or scheme within two tokens makes it a role.
 */
function toolModifier(after: string): boolean {
  const m = after.match(/^\s+analysts?\b/i);
  if (!m) return false;
  const next = after.slice(m[0].length).match(/[A-Za-z0-9]+/g)?.slice(0, 2) ?? [];
  // fix round 5 (ruling c): role nouns, seasons, months and closed-set places make it a role too ("analyst placement", "analyst in London")
  return !next.some((w) => /^(?:19|20)\d{2}$/.test(w) || MONTH_TOKENS.has(w.toLowerCase()) ||
    /^(?:since|interns?|internships?|programmes?|programs?|schemes?|placements?|roles?|positions?|jobs?|summer|spring|autumn|winter|vacation|london|uk|manchester|edinburgh|europe|emea)$/i.test(w));
}
/** Fix round 4 (ruling 2): work words that make "for/with/at <tool>" an employer claim ("worked for Bloomberg"). */
const WORK_WORD = /^(?:work|works|worked|working|interns?|interned|interning|internships?|placements?|roles?|employed|employees?|analysts?|associates?|positions?|jobs?|contracts?|apprentices?|apprenticeships?|trainees?|consultants?|contractors?|consulted|volunteered)$/i;
/**
 * Fix round 5 (ruling a): "with <tool>" is tool use ("worked with Bloomberg data", "analyst with Tableau") unless the word directly
 * before "with" is an employment word, or the tool is followed by "as <role>", a year, "since" or "in <year>".
 */
const WITH_WORD = /^(?:interns?|interned|interning|internships?|placements?|apprentices?|apprenticeships?|apprenticed|trainees?|traineeships?|employed|employees?|jobs?|contracts?|contractors?|consultants?)$/i;
/** Task 22c (ruling 1): month tokens and ranges after a tool ("with X, Jun–Aug 2025"); "May" only before a year or dash. */
const WITH_MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b|may\\s*(?=[–—-]|(?:19|20)\\d{2})";
const WITH_SEASON = "(?:summer|spring|autumn|winter|vacation)\\b";
const WITH_ROLE_AFTER = new RegExp(`^\\s*,?\\s*(?:as\\s+(?:an?\\s+|the\\s+)?(?:[A-Za-z]+\\s+){0,2}(?:${"interns?|internships?|placements?|trainees?|analysts?|associates?|graduates?|apprentices?|employees?|consultants?|contractors?|staff"})\\b|\\(?(?:19|20)\\d{2}\\b|since\\b|in\\s+(?:19|20)\\d{2}\\b|` +
  // task 22c (ruling 1): month(s), "(season" / ", season", over/during a season, a closed-set place, "as part of", "on its/their … programme"
  `\\(?(?:${WITH_MONTH})|[,(]\\s*${WITH_SEASON}|(?:over|during)\\s+(?:the\\s+|a\\s+)?${WITH_SEASON}|in\\s+(?:the\\s+)?(?:London|UK|Manchester|Edinburgh|Europe|EMEA)\\b|` +
  `as\\s+part\\s+of\\b|on\\s+(?:its|their)\\s+(?:[A-Za-z-]+\\s+){0,3}(?:programmes?|programs?|schemes?)\\b)` +
  // possessive ("with X's equities team"), unless it names the tool's own data ("with X's data feeds")
  `|^['’]s\\b(?!\\s+(?:data|prices|feeds|terminals?|API)\\b(?!\\s+(?:team|desk|division|group|unit|office)\\b))`, "i");
/** Task 22c (ruling 1): "<role-ish noun> with <tool>" is a claim when a season/programme/hiring word sits within 3 tokens before the noun. */
const WITH_ROLE_NOUN = /^(?:analysts?|associates?|roles?|positions?|experience|weeks?|placements?|internships?|summers?)$/i;
const WITH_ROLE_CUE = /^(?:summer|spring|autumn|winter|vacation|graduate|insight|work|secured|began|started|landed|offered|accepted|joined|completed|spent)$/i;
/** "<prep> <tool> <noun>": the tool modifies a thing, never an employer ("with Bloomberg data", "with Tableau and Excel"). */
const TOOL_NOUN_AFTER = /^\s+(?:data|prices|skills|experience|dashboards|tables|feeds|models|queries|and|or)\b/i;
/** Fix round 5 (ruling b): capitalised role titles that make a capitalised run before them a name ("Prudential Analyst"). */
const CAP_ROLE_TITLE = "(?:Analyst|Associate|Intern|Trainee|Consultant|Apprentice)s?";
/** A 1–3-word capitalised run ("Slaughter and May", "Silverwater Partners") opening a sentence, followed by a role noun. */
const ROLE_RUN = new RegExp(`(?:^|[.!?:;•▪|–—(\\n])\\s*(?:-\\s+)?([A-Z][A-Za-z0-9&.]*(?:\\s+(?:(?:and|&)\\s+)?[A-Z][A-Za-z0-9&.]*){0,2})(?=${ROLE_GAP}(?:${ROLE_NOUN})\\b)`, "g");
/** Fix round 3 (ruling A): sector/programme words that open role phrases ("Consulting internship", "Insurance graduate scheme"). */
const SECTOR_NOUNS = new Set(("consulting banking investment operations pricing economic industrial professional insurance econometrics budding " +
  "prospective remote hybrid virtual mentoring networking speaker careers onboarding policy tax treasury sandwich exchange insight trainee future " +
  "aspiring data finance marketing research technology product strategy " +
  // fix round 5 (ruling b): sector words before capitalised role titles ("Equity Research Analyst", "Sales Associate")
  "equity credit legal sales trading markets quant compliance accounting actuarial valuation portfolio wealth asset corporate advisory").split(" "));
/** Fix round 5 (ruling b): the same run followed by a capitalised role title ("Prudential Analyst", "Admiral Associate, 2025"). */
const CAP_ROLE_RUN = new RegExp(`(?:^|[.!?:;•▪|–—(\\n])\\s*(?:-\\s+)?([A-Z][A-Za-z0-9&.]*(?:\\s+(?:(?:and|&)\\s+)?[A-Z][A-Za-z0-9&.]*){0,2})(?=\\s+${CAP_ROLE_TITLE}\\b)`, "g");
/** Task 22c (ruling 2): capitalised sector phrases that may precede a capitalised role title ("Investment Banking Analyst"). */
const SECTOR_PHRASES = new Set(("investment banking|private equity|asset management|wealth management|corporate finance|credit risk|equity research|" +
  "sales and trading|global markets|sustainability|esg|regulatory|compliance|payments|mortgage|rates|climate|logistics|cyber|performance|" +
  "behavioural|statistical|economic policy|public policy|supply chain|actuarial").split("|"));
/** A capitalised run (words joined by spaces, "and" or "&") directly before a capitalised role title. */
const SECTOR_TITLE_RUN = new RegExp(`((?:[A-Za-z][A-Za-z&]*\\s+)+)(?=${CAP_ROLE_TITLE}\\b)`, "g");
/** Ordinary words a role run may contain ("Summer intern", "Graduate scheme", "Economics graduate", "Charity volunteer"). */
const ROLE_ORDINARY = new Set(("summer spring autumn winter vacation insight work graduate graduates events event charity intern internship placement " +
  "scheme trainee programme program analyst associate apprentice apprenticeship alumnus alumna " +
  "junior senior freelance principal lead assistant consultant").split(" "));
/** Fix round 2: role titles that are ordinary words mid-sentence ("aspiring Economist", "become an Analyst"). */
const ROLE_TITLES = new Set(("economist economists analyst analysts associate associates researcher researchers officer officers assistant assistants " +
  "consultant consultants intern interns trainee trainees apprentice apprentices").split(" "));
/** Task 22c (ruling 2): a single word a sector title may contain ("Future", "Investment", "Research"); never a brand-like COMMON word. */
const sectorWord = (lower: string) => SECTOR_NOUNS.has(lower) || ROLE_ORDINARY.has(lower) || DOMAIN_HEADS.has(lower) || ADJECTIVES.has(lower) ||
  (COMMON.has(lower) && !COMMON_BRANDS.has(lower));
/**
 * Task 22c (ruling 2): spans of the longest suffix of each capitalised run before a role title that is made only of sector phrases
 * and ordinary words, written capitalised ("UCL and Future Investment Banking Analyst" → "Future Investment Banking"). Unknown
 * names in front of it ("Prudential Investment Banking Analyst") stay outside the span and are judged as before.
 */
function sectorTitleSpans(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(SECTOR_TITLE_RUN)) {
    const words = [...m[1].matchAll(/[A-Za-z][A-Za-z&]*/g)].map((w) => ({ w: w[0], at: m.index! + w.index! }));
    const memo = new Map<number, boolean>();
    const ok = (i: number): boolean => {
      if (i === words.length) return true;
      if (memo.has(i)) return memo.get(i)!;
      memo.set(i, false);
      const r = seg(i);
      memo.set(i, r);
      return r;
    };
    const seg = (i: number): boolean => {
      if (!/^[A-Z]/.test(words[i].w) && !/^(?:and|&)$/.test(words[i].w)) return false;
      for (let l = Math.min(3, words.length - i); l >= 1; l--) {
        if (SECTOR_PHRASES.has(words.slice(i, i + l).map((x) => x.w.toLowerCase()).join(" ")) && ok(i + l)) return true;
      }
      return /^[A-Z]/.test(words[i].w) && sectorWord(words[i].w.toLowerCase()) && ok(i + 1);
    };
    const start = words.findIndex((_, i) => /^[A-Z]/.test(words[i].w) && ok(i));
    if (start >= 0) out.push([words[start].at, m.index! + m[1].length]);
  }
  return out;
}
/** Fix round 2 (ruling 2): contexts where an employer name claims an affiliation, not tool use ("former X intern", "at X", "X-sponsored"). */
function employerClaim(text: string, start: number, end: number, cvTool: boolean): boolean {
  const before = text.slice(0, start), after = text.slice(end);
  if (/(?:\binterned\s+(?:at|with|for)\s+|\b(?:at|former|formerly|joined|joining|secured|won)\s+|\bex\s*-\s*|\bex\s+)$/i.test(before)) return true;
  // fix round 5 (ruling d): "hired/employed by X", "(return) offer from X", "spent summer 2025 with X"
  if (/(?:\b(?:hired|employed)\s+by|\boffers?\s+from|\bspent\s+(?:the\s+)?(?:summer|spring|autumn|winter)(?:\s+(?:of\s+)?(?:19|20)\d{2})?\s+(?:with|at))\s+$/i.test(before)) return true;
  // fix round 5 (ruling a): "with <tool>" claims only after an employment word or before a role/date
  if (/\bwith\s+$/i.test(before)) {
    if (TOOL_NOUN_AFTER.test(after)) return false;
    const prev = before.match(/([A-Za-z]+)\s+with\s+$/i)?.[1] ?? "";
    if (WITH_WORD.test(prev) || WITH_ROLE_AFTER.test(after)) return true;
    if (WITH_ROLE_NOUN.test(prev)) {
      const lead = before.replace(/[A-Za-z]+\s+with\s+$/i, "").match(/[A-Za-z]+/g) ?? [];
      if (lead.slice(-3).some((w) => WITH_ROLE_CUE.test(w))) return true;
    }
  }
  // fix round 3 (ruling B): "for/with <tool>" and "<tool> analyst" are tool use when the CV lists the tool
  if (/\bfor\s+$/i.test(before) && !cvTool) return true;
  // fix round 4 (ruling 2): …unless a work word sits within 3 tokens before the preposition ("worked for"); "with" is handled above
  const prep = before.match(/\b(?:for|at)\s+$/i);
  if (prep && (before.slice(0, prep.index).match(/[A-Za-z]+/g) ?? []).slice(-3).some((w) => WORK_WORD.test(w))) return true;
  if (cvTool && toolModifier(after)) return false;
  return ROLE_AFTER.test(after) ||
    /^(?:-| - |\s+)(?:sponsored|funded|backed|mentored|commissioned|trained|hosted|employed|certified|accredited|endorsed|led|run|owned|hired|placed|partnered|approved)\b/i.test(after);
}
/** Task 22b: hyphen-like characters between letters (U+2010–U+2014, U+2212) read as "-" before tokenising. Same length, so indices hold. */
const dashNorm = (t: string) => t.replace(/(?<=[A-Za-z])[‐‑‒–—−](?=[A-Za-z])/g, "-");
/** Task 22b: vendor names allowed only directly before a tool the CV already has ("Microsoft Excel"). */
const VENDOR_PREFIX = new Set(["microsoft", "google", "adobe", "apache", "amazon"]);
/** Morphology that marks an ordinary verb/adjective/noun rather than a name ("Cleaned", "Analytical", "Leadership"). */
const WORDISH = /(?:ed|ing|ise|ize|ises|izes|ly|ive|ful|ous|able|ible|ment|ments|ness|tion|tions|sion|ity|ship|ist|ists|ism|ics|ical|al|ent|ents|ant|ants|ary|ory|ic|er|ers|or|ors|ian|ians|ate|ates|ance|ence|ology|age)$/;

/** Inflected ladder forms checked anywhere in a bullet (bare forms like "lead"/"head"/"design" are too often nouns). */
const IRREGULAR = new Set(["built", "led", "ran", "wrote", "drove", "oversaw", "founded", "owned"]);
const DRIFT_K = 3;
/** A source with no ladder verb at all is treated as direct work (matches checks-extra UNLADDERED_SOURCE_LEVEL). */
const UNLADDERED = 2;

export type KnownEmployer = { name: string; aliases?: string[]; caseSensitive?: boolean };
const E = (name: string, aliases: string[] = [], caseSensitive = false): KnownEmployer => ({ name, aliases, caseSensitive });
/**
 * Known organisations (fix 2), matched in any case unless `caseSensitive` (names that are also English words).
 * Big banks, Big 4, MBB, big tech, top trading firms, plus every company in seed/companies.yml (a test enforces it).
 */
export const KNOWN_EMPLOYERS: KnownEmployer[] = [
  // banks
  E("Goldman Sachs", ["Goldman"]), E("JPMorgan", ["JP Morgan", "J.P. Morgan", "J P Morgan", "JPMorgan Chase", "JPMC"]), E("Morgan Stanley"),
  E("Barclays"), E("HSBC"), E("Citi", [], true), E("Citigroup"), E("Deutsche Bank"), E("UBS"), E("BNP Paribas"), E("Bank of America", ["BofA"]),
  E("Lloyds Banking Group", ["Lloyds"]), E("NatWest"), E("Santander"), E("Nomura"), E("Credit Suisse"), E("Lazard"), E("Rothschild"), E("Evercore"),
  E("Jefferies"), E("RBC"), E("Macquarie"), E("Societe Generale", ["SocGen"]), E("Standard Chartered"), E("Wells Fargo"), E("Mizuho"),
  E("Bank of England"),
  // Big 4 and consulting
  E("Deloitte"), E("PwC", ["PricewaterhouseCoopers"]), E("EY", ["Ernst & Young", "Ernst and Young"], true), E("KPMG"),
  E("McKinsey", ["McKinsey & Company"]), E("BCG", ["Boston Consulting Group"]), E("Bain", ["Bain & Company"], true), E("Accenture"),
  E("Oliver Wyman"), E("Kearney"), E("Roland Berger"), E("Capgemini"),
  // big tech
  E("Google", ["Alphabet", "DeepMind", "Google DeepMind"]), E("Meta", ["Facebook"], true), E("Amazon", [], true), E("Apple", [], true),
  E("Netflix"), E("Microsoft"), E("Nvidia"), E("Tesla"), E("Uber"), E("OpenAI"), E("IBM"), E("Revolut"), E("Bloomberg"),
  // trading / funds
  E("Jane Street"), E("Citadel"), E("Citadel Securities"), E("Two Sigma"), E("Optiver"), E("Hudson River Trading", ["HRT"]), E("Susquehanna", ["SIG"]),
  E("Millennium"), E("Squarepoint"), E("Qube"), E("XTX Markets", ["XTX"]), E("Bridgewater"), E("Vanguard"), E("Fidelity"),
  // seed/companies.yml
  E("incident.io"), E("AIG"), E("Airbnb"), E("Anduril"), E("Anthropic"), E("Aquatic Capital Management"), E("Atoms", [], true), E("Attio"),
  E("BlackRock"), E("Blackstone"), E("BlockTech"), E("Brex"), E("Capco"), E("Capital Group", [], true), E("Capstone Investment Advisors"),
  E("Celonis"), E("Chicago Trading Company"), E("Cirrus Logic"), E("Cleo", [], true), E("Cohere", [], true), E("Cushman & Wakefield"), E("DRW"),
  E("DV Trading"), E("Databricks"), E("Datadog"), E("Deliveroo"), E("ElevenLabs"), E("Equinor"), E("FTI Consulting"), E("Faculty", [], true),
  E("Fever", [], true), E("Figma"), E("Financial Conduct Authority", ["FCA"]), E("Financial Technology Partners"), E("Flow Traders"), E("Form3"),
  E("Freshfields"), E("GSA Capital"), E("GSK"), E("GoCardless"), E("Graham Capital Management"), E("Guggenheim Securities", ["Guggenheim"]),
  E("Harrison Street", [], true), E("Houlihan Lokey"), E("Howden"), E("IMC Trading", ["IMC"]), E("Improbable", [], true), E("Intercom", [], true),
  E("Isidor"), E("Isomorphic Labs"), E("JLL"), E("Jump Trading"), E("KKR"), E("LSEG", ["London Stock Exchange Group"]), E("Lendable"),
  E("Linear", [], true), E("Lottie", [], true), E("MUFG"), E("Man Group"), E("Marshall Wace"), E("Marshmallow", [], true), E("Maven Securities"),
  E("Mercury", [], true), E("Miro"), E("Monzo"), E("Multiverse", [], true), E("Notion", [], true), E("Nova Founders Capital"), E("OakNorth"),
  E("PGIM"), E("PJT Partners"), E("Palantir"), E("Parloa"), E("Payhawk"), E("Plaid", [], true), E("Pleo"), E("Point72"), E("PolyAI"),
  E("Poolside", [], true), E("Quadrature Capital", ["Quadrature"]), E("Quantexa"), E("Ramp", [], true), E("Riverlane"), E("Rothesay"),
  E("Scale AI"), E("Schonfeld"), E("Shell", [], true), E("Snowflake", [], true), E("Sophos"), E("Spotify"), E("Stability AI"), E("Stripe", [], true),
  E("SumUp"), E("Synthesia"), E("TD Securities"), E("Talos", [], true), E("Thought Machine"), E("Tide", [], true), E("Tower Research Capital", ["Tower Research"]),
  E("Tractable", [], true), E("Trainline"), E("UNIQLO"), E("UiPath"), E("Vercel"), E("Verkada"), E("Viridien"), E("Virtu Financial", ["Virtu"]),
  E("Wayve"), E("Wellington Management"), E("Wise", [], true), E("Xantium"), E("Zilch", [], true), E("Zopa"), E("iSAM"), E("Econic Partners"),
  E("Lloyds"),
  // fix round 2: employers whose names look like ordinary words (-er/-ers/-ian/-ing) at sentence start
  E("Unilever"), E("Mercer"), E("Linklaters"), E("Boeing"), E("Schroders"), E("Gartner"), E("Experian"), E("Ocado"), E("Slaughter and May", [], true),
  // fix round 4: tool companies that also employ graduates
  E("Tableau"), E("Salesforce"),
];
/** Single-word employer names/aliases, lowercased: never an ordinary affiliation head (fix round 1, ruling 3). */
const EMPLOYER_WORDS = new Set(KNOWN_EMPLOYERS.flatMap((k) => [k.name, ...(k.aliases ?? [])]).filter((n) => /^[A-Za-z0-9.]+$/.test(n)).map((n) => n.toLowerCase()));
/**
 * Fix round 1 (ruling 4): a known employer is on the CV only when the CV writes it as a name — exact case for case-sensitive
 * or lowercase-led names ("incident.io"), otherwise with its leading capital ("apple", "shell", "linear regression" don't count).
 */
function employerInCv(corpus: string, k: KnownEmployer): boolean {
  return [k.name, ...(k.aliases ?? [])].some((n) => {
    const exact = k.caseSensitive || !/^[A-Z]/.test(n);
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(n).replace(/\\?\s+/g, "\\s+")}(?![A-Za-z0-9])`, exact ? "g" : "gi");
    return [...corpus.matchAll(re)].some((m) => exact || /^[A-Z]/.test(m[0]));
  });
}
const EMPLOYER_RES = KNOWN_EMPLOYERS.map((k) => ({
  k,
  res: [k.name, ...(k.aliases ?? [])].map((n) => new RegExp(`(?<![A-Za-z0-9])${escapeRegex(n).replace(/\\?\s+/g, "\\s+")}(?![A-Za-z0-9])`, k.caseSensitive ? "g" : "gi")),
}));

/** Fix round 5 (ruling e): skills implied by a tool on the CV (canonical vocab names). */
const IMPLIED_BY: Record<string, string[]> = {
  "Data Visualisation": ["Tableau", "Power BI", "Looker"],
  "CRM": ["Salesforce", "HubSpot"],
  "Data Analysis": ["Pandas", "NumPy"],
};
type Unit = { text: string; cited: string; bulletId?: string; entryId?: string; scoped?: boolean };

function parseDates(d: string): { start?: string; end?: string } {
  const parts = d.split(/\s*(?:–|—|-|\bto\b)\s*/i).filter(Boolean);
  return { start: parts[0], end: parts[parts.length - 1] };
}

function inferChange(b: TailoredBullet, src: Map<string, string>): TailorChangeType {
  if (b.changeType) return b.changeType;
  if (b.sourceRefs.length >= 2) return "merged";
  const s = src.get(b.sourceRefs[0] ?? "");
  return s !== undefined && norm(s) === norm(b.text) ? "kept" : "rephrased";
}

function mapExtra(i: ExtraIssue): Issue {
  const type = (i.check === "scopedMetrics" ? "inventedMetrics" : i.check) as IssueType;
  return { type, severity: i.severity, bulletId: i.bulletId, entryId: i.roleId, claim: i.evidence ?? "", reason: i.message, check: i.check };
}

/** Tokens in `text` that take part in a skill match (removing them changes extractSkills). */
function partOfSkill(text: string, index: number, len: number): boolean {
  const before = extractSkills(text);
  if (!before.length) return false;
  const blanked = text.slice(0, index) + " ".repeat(len) + text.slice(index + len);
  const after = new Set(extractSkills(blanked));
  return before.some((s) => !after.has(s));
}

/** Initialisms of capitalised multi-word phrases in the CV ("Computer Science" → "cs"). */
function initialisms(corpus: string): Set<string> {
  const out = new Set<string>();
  for (const m of corpus.matchAll(/\b[A-Z][A-Za-z]*(?:\s+(?:of|and|&|the|for|in)?\s*[A-Z][A-Za-z]*)+/g)) {
    const words = m[0].split(/\s+/).filter((w) => /^[A-Z]/.test(w));
    for (let a = 0; a < words.length; a++) for (let b = a + 2; b <= words.length; b++) out.add(words.slice(a, b).map((w) => w[0]).join("").toLowerCase());
  }
  return out;
}
/** Corpus tokens plus 2- and 3-token concatenations, so "Survey Monkey" ≡ "SurveyMonkey". */
function compactTokens(cNorm: string): Set<string> {
  const t = cNorm.split(" ");
  const out = new Set(t);
  for (let i = 0; i < t.length; i++) { if (t[i + 1]) out.add(t[i] + t[i + 1]); if (t[i + 2]) out.add(t[i] + t[i + 1] + t[i + 2]); }
  return out;
}

/** Sentence containing position `idx`. */
function sentenceAt(text: string, idx: number): string {
  const start = Math.max(text.lastIndexOf(".", idx - 1), text.lastIndexOf(";", idx - 1), text.lastIndexOf("\n", idx - 1)) + 1;
  const ends = [".", ";", "\n"].map((c) => text.indexOf(c, idx)).filter((x) => x >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) : text.length);
}

// ---------- verifyTailoring ----------

export function verifyTailoring(i: VerifyInput): VerifyReport {
  const issues: Issue[] = [];
  const corpus = buildFactCorpus(i.source, i.sourceText, i.confirmedFacts);
  const cNorm = norm(corpus);
  const cCompact = compactTokens(cNorm);
  const inits = initialisms(corpus);
  const corpusNums = metricCorpus(i.source, i.sourceText, i.confirmedFacts);
  const dateVals = dateFieldValues(i.source);
  const yearsUsed = new Map<string, Set<string>>(); // unit key → years accepted as dates (scopedMetrics must not re-flag them)
  const srcSkills = new Set(extractSkills(corpus));
  // fix round 5 (ruling e): skills a CV tool implies ("Tableau" → Data Visualisation) are never injected
  const impliedSkills = new Set(srcSkills);
  for (const [skill, tools] of Object.entries(IMPLIED_BY)) if (tools.some((t) => srcSkills.has(t))) impliedSkills.add(skill);
  const jdStems = new Set(i.jdKeywords.flatMap((k) => [...contentStems(k)]));
  // Task 22b (c), fix round 1: CV ∪ confirmed-fact tokens only (the JD is never a fact source, ruling 1). Exact match first;
  // stems only from CV tokens of ≥ 4 characters; month/date tokens never count (ruling 2: "Mar" must not launder "Mars-").
  const cvWords = (corpus.match(/[A-Za-z]+/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !MONTH_TOKENS.has(w));
  const cvHeadExact = new Set(cvWords);
  const cvHeadStems = new Set(cvWords.filter((w) => w.length >= 4).map(headStem));
  // fix round 2 (ruling 2): where an employer *claim* is made, only org/title/bullet/summary text counts — never the skills list
  // or the raw text (which repeats the skills list). "Snowflake" as a skill does not back "former Snowflake intern".
  const nameCorpus = [i.source.summary, i.source.interests, ...i.source.education.flatMap((e) => [e.institution, e.degree, e.grade, ...e.details.map((d) => d.text)]),
    ...sections<ParsedCV, CvEntry>(i.source).flatMap((e) => [e.org, e.title, e.location, ...e.bullets.map((b) => b.text)]), ...i.confirmedFacts]
    .filter((t): t is string => !!t).join("\n");
  /** The CV lists this company as a tool (skills list or vocab skill on the CV). */
  const skillItems = new Set(i.source.skills.flatMap((g) => g.items.map((x) => x.toLowerCase())));
  const cvTool = (k: KnownEmployer) => [k.name, ...(k.aliases ?? [])].some((n) => skillItems.has(n.toLowerCase()) ||
    (extractSkills(n).length > 0 && extractSkills(n).every((x) => srcSkills.has(x))));
  const nameInCv = (tok: string) => new RegExp(`(?<![A-Za-z0-9])${escapeRegex(tok)}(?![A-Za-z0-9])`).test(nameCorpus);
  const inCvVocab = (lower: string) => cvHeadExact.has(lower) || cvHeadStems.has(headStem(lower));
  /** List vocabulary, -ly adverbs and domain nouns (rulings (a), (b), (d)), without COMMON or the CV route. */
  const listHead = (lower: string) => ADJECTIVES.has(lower) || HYPHEN_HEADS.has(lower) || STRONG_WORDISH.test(lower) ||
    LY_ADVERB.test(lower) || ADVERBS.has(lower) || DOMAIN_HEADS.has(lower);
  /** Task 22b ruling: a compound head with a non-affiliation tail is ordinary vocabulary, not a name. */
  const headIsOrdinary = (lower: string) => COMMON.has(lower) || listHead(lower) || inCvVocab(lower);
  /** CV org/title/institution words as written: the student's own organisations may head an affiliation ("Northside-trained"). */
  const cvNames = new Set([...sections<ParsedCV, CvEntry>(i.source).flatMap((e) => [e.org, e.title]), ...i.source.education.map((e) => e.institution)]
    .flatMap((t) => t.match(/[A-Z][A-Za-z0-9&]*/g) ?? []));
  /**
   * Fix round 1 (ruling 3): a head taking an affiliation tail. List/adverb/domain vocabulary or a non-brand COMMON word, never a
   * known employer (those go through employerInCv); a CV word alone is not enough. Exceptions: the CV's own org/title/institution
   * names, and a CV skill before trained/certified ("Excel-trained").
   */
  const affilHeadOk = (tok: string, tail: string) => {
    const lower = tok.toLowerCase();
    if (EMPLOYER_WORDS.has(lower) || COMMON_BRANDS.has(lower)) return false;
    if (listHead(lower) || COMMON.has(lower) || cvNames.has(tok)) return true;
    if (/^(?:trained|certified)$/.test(tail)) { const sk = extractSkills(tok); return sk.length > 0 && sk.every((x) => srcSkills.has(x)); }
    return false;
  };
  /** "Microsoft Excel": a vendor word directly before a tool the CV already names. */
  const vendorOk = (text: string, end: number) => {
    const next = text.slice(end).match(/^\s+([A-Z][A-Za-z0-9+#]*)/)?.[1];
    if (!next) return false;
    const sk = extractSkills(next);
    return sk.length ? sk.every((x) => srcSkills.has(x)) : new RegExp(`(?<![A-Za-z0-9])${escapeRegex(next)}(?![A-Za-z0-9])`).test(corpus);
  };
  const hardJd = i.jdKeywords.filter((k) => isHardTerm(k) && extractSkills(k).length === 0 && !hasToken(cNorm, k));
  const srcUnits = sourceUnits(i.source).map((t) => ({ t, stems: contentStems(t) }));
  const factsText = i.confirmedFacts.join("\n");
  /** Source text a summary/interests sentence may draw numbers from: units sharing ≥1 content word, plus confirmed facts. */
  const scopeFor = (sentence: string) => {
    const s = contentStems(sentence);
    return [...srcUnits.filter((u) => [...u.stems].some((x) => s.has(x))).map((u) => u.t), factsText].join("\n");
  };

  // source bullet lookup: id → text and id → owning entry id
  const srcText = new Map<string, string>();
  const srcOwner = new Map<string, string>();
  for (const e of sections<ParsedCV, CvEntry>(i.source)) for (const b of e.bullets) { srcText.set(b.id, b.text); srcOwner.set(b.id, e.id); }
  for (const e of i.source.education) for (const d of e.details) { srcText.set(d.id, d.text); srcOwner.set(d.id, e.id); }
  const srcEntries = new Map(sections<ParsedCV, CvEntry>(i.source).map((e) => [e.id, e]));

  // ---- #2 unsupportedFacts: entry headers are immutable; tailoring never creates entries (fix 3) ----
  const tEntries = sections<TailoredCV, TailoredEntry>(i.tailored);
  for (const e of tEntries) {
    const se = srcEntries.get(e.id);
    if (!se) {
      issues.push({ type: "unsupportedFacts", severity: "block", entryId: e.id, claim: [e.title, e.org].filter(Boolean).join(" at "),
        reason: "This role isn't in your original CV — tailoring never adds roles" });
      continue;
    }
    for (const field of ["org", "title", "dates", "location"] as const) {
      const v = e[field];
      if (!v) continue;
      const ok = field === "dates" ? normDate(se.dates) === normDate(v) : norm(se[field]) === norm(v) || (field === "location" && hasToken(cNorm, v));
      if (!ok) issues.push({ type: "unsupportedFacts", severity: "block", entryId: e.id, claim: v,
        reason: `Your CV says "${se[field]}" here — tailoring can't change your ${field === "org" ? "employer" : field}` });
    }
  }
  const srcEdu = new Map(i.source.education.map((e) => [e.id, e]));
  for (const e of i.tailored.education) {
    const se = srcEdu.get(e.id);
    if (!se) {
      issues.push({ type: "unsupportedFacts", severity: "block", entryId: e.id, claim: [e.degree, e.institution].filter(Boolean).join(", "),
        reason: "This qualification isn't in your original CV" });
      continue;
    }
    for (const field of ["institution", "degree", "dates", "grade"] as const) {
      const v = e[field];
      if (!v) continue;
      const ok = field === "dates" ? normDate(se.dates) === normDate(v) : norm(se[field] ?? "") === norm(v);
      if (!ok) issues.push({ type: "unsupportedFacts", severity: "block", entryId: e.id, claim: v,
        reason: `Your CV says "${se[field] ?? ""}" — education details can't change` });
    }
  }

  // ---- build text units ----
  const units: Unit[] = [];
  if (i.tailored.summary) units.push({ text: i.tailored.summary, cited: corpus, entryId: "summary", scoped: true });
  if (i.tailored.interests) units.push({ text: i.tailored.interests, cited: corpus, entryId: "interests", scoped: true });
  for (const e of i.tailored.education) for (const d of e.details) {
    const s = srcText.get(d.id);
    units.push({ text: d.text, cited: s ?? corpus, bulletId: d.id, entryId: e.id, scoped: s === undefined });
  }

  const tailoredRoles: TailoredRole[] = [];
  for (const e of tEntries) {
    const role: TailoredRole = { id: e.id, bullets: [] };
    tailoredRoles.push(role);
    for (const b of e.bullets) {
      const changeType = inferChange(b, srcText);
      role.bullets.push({ id: b.id, text: normCurrency(b.text), sourceRefs: b.sourceRefs, changeType, dropReason: b.dropReason });
      if (changeType === "dropped") continue;
      // ---- #5 orphanBullets ----
      const refs = b.sourceRefs ?? [];
      const reason = refs.length === 0 ? "This bullet isn't linked to anything in your original CV"
        : refs.some((r) => !srcText.has(r)) ? "This bullet cites a line that isn't in your original CV"
        : refs.some((r) => srcOwner.get(r) !== e.id) ? "This bullet borrows a line from a different role — it must stay with the role it happened in"
        : changeType === "merged" && new Set(refs).size < 2 ? "A merged bullet has to cite at least two original bullets"
        : null;
      if (reason) { issues.push({ type: "orphanBullets", severity: "block", bulletId: b.id, entryId: e.id, claim: b.text, reason }); continue; }
      units.push({ text: b.text, cited: refs.map((r) => srcText.get(r)!).join("\n"), bulletId: b.id, entryId: e.id });

      // ---- #6 perBulletDrift: too many new content words ----
      const citedStems = contentStems(units[units.length - 1].cited);
      const fresh = [...contentStems(b.text)].filter((w) => !citedStems.has(w) && !jdStems.has(w));
      if (fresh.length > DRIFT_K) issues.push({ type: "perBulletDrift", severity: "warn", bulletId: b.id, entryId: e.id, claim: fresh.slice(0, 4).join(", "),
        reason: "Lots of new wording — check it still says what you actually did" });
    }
  }

  // ---- per-unit checks ----
  const where = (u: Unit) => ({ bulletId: u.bulletId, entryId: u.entryId });
  const key = (u: { bulletId?: string; entryId?: string }) => u.bulletId ?? `@${u.entryId}`;
  const invented = new Map<string, Set<string>>(); // unit key → invented values (digit or word)
  const addInvented = (k: string, vals: string[]) => vals.forEach((v) => (invented.get(k) ?? invented.set(k, new Set()).get(k)!).add(v));
  const injectedByUnit = new Map<string, Set<string>>();
  const ownershipFlagged = new Set<string>();
  const wordRaws = new Map<string, string[]>(); // unit key → flagged word-metric spans ("twenty five")
  for (const u of units) {
    const k = key(u);
    const text = normCurrency(u.text);
    // #1 inventedMetrics (global): every digit number must exist in source ∪ confirmed facts (dates excluded, fix 6)
    for (const m of text.matchAll(NUM)) {
      const vals = numValues(m[0]);
      if (isYearUse(text, m.index!, m[0].trim(), dateVals)) { (yearsUsed.get(k) ?? yearsUsed.set(k, new Set()).get(k)!).add(vals[0]); continue; }
      if (!vals.some((v) => corpusNums.has(v))) {
        addInvented(k, vals);
        issues.push({ type: "inventedMetrics", severity: "block", ...where(u), claim: m[0].trim(), reason: "This number isn't in your CV — confirm it or we'll leave it out" });
      } else if (u.scoped) {
        // #1b for summary/interests (fix 5): the number must co-occur with shared context in some source line
        const scope = numberSet(scopeFor(sentenceAt(text, m.index!)));
        if (!vals.some((v) => scope.has(v))) {
          addInvented(k, vals);
          issues.push({ type: "inventedMetrics", severity: "block", ...where(u), claim: m[0].trim(), check: "scopedSummary",
            reason: `"${m[0].trim()}" comes from a different claim in your CV — numbers can't move between claims` });
        }
      }
    }
    // #1 word / multiplier / vague metrics (fix 1): must be backed by the cited source text (or confirmed facts)
    const citedText = u.scoped ? null : stripContacts(`${normCurrency(u.cited)}\n${factsText}`);
    const citedKeys = citedText === null ? null : supportKeys(citedText);
    for (const w of wordMetrics(text)) {
      const at = text.indexOf(w.raw);
      const supportText = citedText ?? stripContacts(scopeFor(sentenceAt(text, at)));
      const keys = citedKeys ?? supportKeys(supportText);
      if (w.key.startsWith("v:") ? vagueBacked(w.key, vagueNoun(text, at + w.raw.length), keys, supportText) : keySupported(w.key, keys)) continue;
      if (w.key.startsWith("n:")) addInvented(k, [w.key.slice(2)]);
      (wordRaws.get(k) ?? wordRaws.set(k, []).get(k)!).push(w.raw.toLowerCase());
      issues.push({ type: "inventedMetrics", severity: "block", ...where(u), claim: w.raw, check: "wordMetrics",
        reason: `"${w.raw}" isn't what your original says — confirm the figure or keep the original wording` });
    }
    // #4 skillInjection: canonical skills absent from source ∪ confirmed facts (the JD never counts)
    const inj = new Set<string>();
    for (const s of extractSkills(u.text)) {
      if (impliedSkills.has(s)) continue;
      inj.add(s);
      issues.push({ type: "skillInjection", severity: "block", ...where(u), claim: s, reason: `${s} isn't anywhere in your CV — we never add skills you don't have` });
    }
    // JD credentials/tools that aren't skills in the vocab ("CFA Level I")
    const uNorm = norm(u.text);
    const jdHits = hardJd.filter((kw) => hasToken(uNorm, kw));
    for (const kw of jdHits) {
      inj.add(kw);
      issues.push({ type: "skillInjection", severity: "block", ...where(u), claim: kw, reason: `"${kw}" comes from the job description, not your CV — it stays a gap` });
    }
    injectedByUnit.set(k, inj);
    // #2 known employers, any case (fix 2)
    const employerSpans: [number, number][] = [];
    const dText = dashNorm(u.text);
    for (const { k: emp, res } of EMPLOYER_RES) {
      const isTool = extractSkills(emp.name).length > 0;
      for (const re of res) for (const m of u.text.matchAll(re)) {
        // fix round 2: an employer claim ("former Snowflake intern", "at Figma", "Notion-sponsored") needs a non-skills mention
        const claim = employerClaim(dText, m.index!, m.index! + m[0].length, cvTool(emp));
        if (isTool && !claim) continue; // skillInjection owns tool usage of companies that are also tools
        const known = employerInCv(claim ? nameCorpus : corpus, emp)
          || (!claim && VENDOR_PREFIX.has(m[0].toLowerCase()) && vendorOk(u.text, m.index! + m[0].length));
        employerSpans.push([m.index!, m.index! + m[0].length]);
        if (known || issues.some((x) => key(x) === k && x.claim.toLowerCase() === m[0].toLowerCase())) continue;
        issues.push({ type: "unsupportedFacts", severity: "block", ...where(u), claim: m[0], check: "knownEmployer",
          reason: `"${m[0]}" isn't in your original CV — we never add employers` });
      }
    }
    // #2 proper nouns / acronyms (employers, tools) not whole-token in the corpus. Hyphens split tokens ("Ex-Deloitte").
    const flagged = new Set<string>();
    const pText = dashNorm(u.text);
    const toks = [...pText.matchAll(/[A-Za-z][A-Za-z0-9+#&']*/g)].map((m) => ({ tok: m[0].replace(/'s$|'$/, ""), index: m.index!, len: m[0].length }));
    const isCap = (t: string) => /^[A-Z]/.test(t);
    // fix round 2 (ruling 1b): spans of sentence-opening capitalised runs followed by a role noun ("Mercer placement", "Linklaters trainee")
    const roleRuns = [...pText.matchAll(ROLE_RUN), ...pText.matchAll(CAP_ROLE_RUN)]
      .map((m) => { const s0 = m.index! + m[0].length - m[1].length; return [s0, s0 + m[1].length] as const; });
    const sectorSpans = sectorTitleSpans(pText);
    for (let n = 0; n < toks.length; n++) {
      const { tok, index, len } = toks[n];
      const lower = tok.toLowerCase();
      if (tok.length < 2 || PROPER_ALLOW.has(lower) || flagged.has(lower)) continue;
      // task 22c (ruling 2): ordinary sector words of a capitalised title ("Aspiring Credit Risk Analyst")
      if (sectorSpans.some(([a0, b0]) => index >= a0 && index < b0)) continue;
      if (employerSpans.some(([a, b]) => index < b && index + len > a)) continue;
      const allCaps = /^[A-Z0-9&+#]+$/.test(tok) && /[A-Z].*[A-Z]|[A-Z]\d/.test(tok);
      const before = pText.slice(0, index).trimEnd();
      const sentenceStart = before === "" || /[.!?:;•▪|–—(]$/.test(before) || /\s-$/.test(` ${before}`);
      // Round 5: a capitalised compound is exempt only when its head is ordinary vocabulary or its tail is attitude-only
      // ("Policy-focused", "Tax-savvy", "Till-trained" pass; "Xero-literate", "Zorblax-led", "Unilever-sponsored" don't).
      // A non-exempt compound head is a name candidate at any position, sentence start included.
      // fix round 1 (ruling 5): "Unilever - sponsored" (spaced hyphen) is the same compound
      const tail = isCap(tok) && !allCaps ? pText.slice(index + len).match(/^(?:-| - )([a-z]+)\b/)?.[1] : undefined;
      const headOrdinary = headIsOrdinary(lower);
      const compound = tail !== undefined;
      // fix round 1 (ruling 3): an affiliation tail needs affilHeadOk; other tails keep the round-5/22b test
      const affilTail = compound && AFFIL_TAIL.test(tail);
      const compoundExempt = compound && (affilTail ? affilHeadOk(tok, tail) : headOrdinary || ATTITUDE_TAIL.test(tail));
      // "UCL, Class of 2027": a cohort, not a name
      if (lower === "class" && /^\s+of\s+\d{4}\b/.test(pText.slice(index + len))) continue;
      if (VENDOR_PREFIX.has(lower) && vendorOk(pText, index + len)) continue;
      const ordinary = COMMON.has(lower) || ADJECTIVES.has(lower) || IRREGULAR_PAST.has(lower) || WORDISH.test(lower) || authorshipLevel(lower) !== null || IRREGULAR.has(lower) ||
        // fix round 3: domain, sector and role words open sentences too ("Policy analyst …", "Trainee analyst …", "Insight programme …")
        DOMAIN_HEADS.has(lower) || SECTOR_NOUNS.has(lower) || ROLE_ORDINARY.has(lower);
      // Task 22b: "Unilever sponsored …" at sentence start is the spaced form of "Unilever-sponsored"; verbs ("Led trained …") stay ordinary
      const participle = !compound && isCap(tok) && sentenceStart ? pText.slice(index + len).match(AFFIL_PARTICIPLE)?.[1]?.toLowerCase() : undefined;
      const spacedAffil = participle !== undefined &&
        !(affilHeadOk(tok, participle) || IRREGULAR_PAST.has(lower) || IRREGULAR.has(lower) || authorshipLevel(lower) !== null);
      // fix round 2: a role-run word is a name regardless of WORDISH shape unless it is ordinary or written as a name in the CV (not skills)
      const roleClaim = !compound && isCap(tok) && roleRuns.some(([a0, b0]) => index >= a0 && index < b0) &&
        !((COMMON.has(lower) && !COMMON_BRANDS.has(lower)) || ADJECTIVES.has(lower) || DOMAIN_HEADS.has(lower) || HYPHEN_HEADS.has(lower) ||
          ROLE_ORDINARY.has(lower) || nameInCv(tok) ||
          // fix round 3 (ruling A): verbs/gerunds, -ly adverbs, sector words and CV vocabulary; only loose -al/-er/-ian shapes and unknowns stay names
          STRONG_WORDISH.test(lower) || LY_ADVERB.test(lower) || SECTOR_NOUNS.has(lower) || inCvVocab(lower));
      if (roleClaim && !flagged.has(lower)) {
        flagged.add(lower);
        issues.push({ type: "unsupportedFacts", severity: "block", ...where(u), claim: tok, reason: `"${tok}" isn't in your original CV — we don't add employers, tools or credentials` });
        continue;
      }
      const roleTitle = !compound && ROLE_TITLES.has(lower);
      const candidate = allCaps || spacedAffil || (compound ? !compoundExempt : isCap(tok) && !roleTitle && (!sentenceStart || !ordinary));
      if (!candidate) continue;
      // an affiliation head was already judged against the CV in affilHeadOk; a matching lowercase CV word doesn't excuse it
      if (!affilTail && !spacedAffil && (hasToken(cNorm, tok) || cCompact.has(lower) || (allCaps && inits.has(lower)))) continue;
      // capitalised run ("Survey Monkey") compared with spaces removed
      let a = n, b = n;
      while (a > 0 && isCap(toks[a - 1].tok) && /^\s+$/.test(pText.slice(toks[a - 1].index + toks[a - 1].len, toks[a].index))) a--;
      while (b < toks.length - 1 && isCap(toks[b + 1].tok) && /^\s+$/.test(pText.slice(toks[b].index + toks[b].len, toks[b + 1].index))) b++;
      if (b > a && cCompact.has(toks.slice(a, b + 1).map((t) => t.tok.toLowerCase()).join(""))) continue;
      if (jdHits.some((kw) => hasToken(norm(kw), tok)) || [...inj].some((s) => hasToken(norm(s), tok))) continue;
      if (partOfSkill(pText, index, len)) continue;
      // fix round 5 (ruling e): a tool name for a skill the CV implies ("Salesforce CRM" when the CV lists Salesforce)
      { const sk = extractSkills(tok); if (sk.length && sk.every((x) => impliedSkills.has(x))) continue; }
      flagged.add(lower);
      issues.push({ type: "unsupportedFacts", severity: "block", ...where(u), claim: tok, reason: `"${tok}" isn't in your original CV — we don't add employers, tools or credentials` });
    }
    // #3 non-verb ownership escalation (fix 4)
    for (const [label, re] of OWNERSHIP) {
      if (!re.test(u.text) || re.test(u.cited)) continue;
      ownershipFlagged.add(k);
      issues.push({ type: "authorshipEscalation", severity: "block", ...where(u), claim: u.text.match(re)![0], check: "ownershipPhrase",
        reason: `"${label}" claims more ownership than your original says` });
      break;
    }
    // #7 forbiddenPhrases: block if new, warn if the source already said it (reverting couldn't remove it)
    for (const [label, re] of FORBIDDEN) {
      if (!re.test(u.text)) continue;
      const pre = label === "expert in" ? /\bexpert/i.test(u.cited) : re.test(u.cited);
      issues.push({ type: "forbiddenPhrases", severity: pre ? "warn" : "block", ...where(u), claim: label,
        reason: label === "expert in" ? "Your CV doesn't claim expertise" : "Empty buzzword recruiters discount" });
    }
    for (const [label, re] of WARN_PHRASES) {
      if (re.test(u.text)) issues.push({ type: "forbiddenPhrases", severity: "warn", ...where(u), claim: label, reason: "Generic phrase — show it instead of saying it" });
    }
    // fix 8 (warn): currency swap, inflation qualifiers, new achievement claims
    const citedC = normCurrency(u.cited);
    for (const m of text.matchAll(/([£$€])\s?(\d[\d,.]*)/g)) {
      const amt = m[2].replace(/,/g, "");
      const others = [...citedC.matchAll(/([£$€])\s?(\d[\d,.]*)/g)].filter((c) => c[2].replace(/,/g, "") === amt);
      if (others.length && !others.some((c) => c[1] === m[1])) issues.push({ type: "perBulletDrift", severity: "warn", ...where(u), claim: m[0], check: "currencySwap",
        reason: `Your CV says ${others[0][0]} — the currency changed` });
    }
    for (const m of u.text.matchAll(INFLATE)) {
      const amt = (m[1] ?? m[2]).replace(/,/g, "");
      if (!numberSet(u.cited).has(String(parseFloat(amt)))) continue;
      const already = [...u.cited.matchAll(INFLATE)].some((c) => (c[1] ?? c[2]).replace(/,/g, "") === amt);
      if (!already) issues.push({ type: "perBulletDrift", severity: "warn", ...where(u), claim: m[0].trim(), check: "inflationQualifier",
        reason: `Your CV says ${amt}, not "${m[0].trim()}" — keep the exact figure` });
    }
    for (const m of u.text.matchAll(ACHIEVEMENT)) {
      if (new RegExp(`\\b${escapeRegex(m[0])}\\b`, "i").test(u.cited)) continue;
      issues.push({ type: "perBulletDrift", severity: "warn", ...where(u), claim: m[0], check: "newAchievement",
        reason: `"${m[0]}" is a new achievement claim — only keep it if it's true and on your CV` });
    }
  }

  // ---- skills list: every item must be a source skill or whole-token in the corpus ----
  const skillClaims = new Set<string>();
  for (const g of i.tailored.skills) for (const item of g.items) {
    const sk = extractSkills(item);
    const missing = sk.length ? sk.filter((s) => !impliedSkills.has(s)) : hasToken(cNorm, item) || cCompact.has(norm(item).replace(/ /g, "")) ? [] : [item];
    for (const s of missing) {
      if (skillClaims.has(s)) continue;
      skillClaims.add(s);
      issues.push({ type: "skillInjection", severity: "block", entryId: "skills", claim: s, reason: `${s} isn't anywhere in your CV — we never add skills you don't have` });
    }
  }

  // ---- extra checks (checks-extra): sibling swaps, qualifier drops, ladder escalation, scoped metrics, structure, temporal ----
  const sourceRoles: SourceRole[] = sections<ParsedCV, CvEntry>(i.source).map((e) => ({
    id: e.id, org: e.org, title: e.title, dates: parseDates(e.dates), bullets: e.bullets.map((b) => ({ id: b.id, text: normCurrency(b.text) })),
  }));
  const orphaned = new Set(issues.filter((x) => x.type === "orphanBullets").map((x) => x.bulletId));
  const extra = runExtraChecks({ sourceRoles, tailoredRoles: tailoredRoles.filter((r) => srcEntries.has(r.id)), confirmedFacts: i.confirmedFacts.map(normCurrency) })
    .filter((x) => !x.bulletId || !orphaned.has(x.bulletId)) // orphanBullets owns uncited bullets
    .map(mapExtra)
    .filter((x) => {
      if (!x.bulletId) return true;
      // scoped metric already reported as an invented number (digit or word) → don't double-report
      if (x.check === "scopedMetrics") {
        const vals = claimValues(x.claim);
        const inv = invented.get(x.bulletId);
        if (vals.length && inv && vals.every((v) => inv.has(v))) return false;
        // part of a multi-word number already reported ("twenty" of "twenty five")
        const c = x.claim.toLowerCase();
        if ((wordRaws.get(x.bulletId) ?? []).some((r) => r.includes(c) || c.includes(r))) return false;
        // the CV's own years used as dates ("(2023–2024)") aren't metrics
        const yrs = yearsUsed.get(x.bulletId);
        return !(yrs && numValues(x.claim).length && [...x.claim.matchAll(/\d+/g)].every((d) => yrs.has(String(+d[0]))));
      }
      // sibling swap of a tool that's absent from the whole CV → skillInjection already says it
      if (x.check === "siblingContamination") {
        const inj = injectedByUnit.get(x.bulletId);
        const canon = extractSkills(x.claim)[0] ?? x.claim;
        return !inj?.has(canon);
      }
      return true;
    });
  issues.push(...extra);

  // ---- #3 authorshipEscalation, anywhere in the bullet (checks-extra covers the lead verb) ----
  const escalated = new Set(extra.filter((x) => x.type === "authorshipEscalation").map((x) => x.bulletId));
  for (const u of units) {
    if (!u.bulletId || escalated.has(u.bulletId) || ownershipFlagged.has(key(u)) || u.entryId === undefined || !srcEntries.has(u.entryId)) continue;
    const citedWords = new Set(u.cited.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? []);
    const srcLevels = [...citedWords].map((w) => authorshipLevel(w)).filter((l): l is number => l !== null);
    const srcMax = srcLevels.length ? Math.max(...srcLevels) : UNLADDERED;
    const hit = (u.text.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [])
      .filter((w) => !citedWords.has(w) && (IRREGULAR.has(w) || /(?:ed|ing)$/.test(w)))
      .map((w) => ({ w, l: authorshipLevel(w) }))
      .find((x) => x.l !== null && x.l > srcMax);
    if (hit) issues.push({ type: "authorshipEscalation", severity: "block", bulletId: u.bulletId, entryId: u.entryId, claim: hit.w, check: "authorshipLadder",
      reason: `"${hit.w}" claims more ownership than your original bullet` });
  }

  // ---- #13 AU-01 cliché density on the tailored output ----
  const outText = units.map((u) => u.text).join("\n");
  const cd = clicheDensity(outText);
  if (cd.severity !== "ok") issues.push({ type: "clicheDensity", severity: "warn", claim: `${cd.per100Words.toFixed(1)} per 100 words`,
    reason: `Reads generic (${cd.hits.slice(0, 3).map((h) => h.match).join(", ")}) — say what you did instead` });

  // ---- #8 coverage diagnostic: never a silent pass ----
  if (i.coverageBefore === null || i.coverageAfter === null) {
    issues.push({ type: "coverage", severity: "warn", claim: "unmeasured", reason: "We couldn't measure keyword coverage — check the result against the job yourself" });
  } else if (i.coverageAfter <= i.coverageBefore) {
    issues.push({ type: "coverage", severity: "warn", claim: `${Math.round(i.coverageBefore * 100)}% → ${Math.round(i.coverageAfter * 100)}%`, reason: "Tailoring didn't improve keyword coverage" });
  }
  for (const u of units) {
    if (!u.bulletId) continue;
    const countShaped = (u.text.match(/\b\d[\d,.]*\s+[a-z]/gi) ?? []).length;
    if (countShaped >= 2 && extractMetrics(u.text).length === 0) issues.push({ type: "coverage", severity: "warn", bulletId: u.bulletId, entryId: u.entryId, claim: u.text,
      reason: "This bullet has figures our checker couldn't read — double-check them" });
  }

  const verdict = issues.some((x) => x.severity === "block") ? "block" : issues.length ? "warn" : "pass";
  const report: VerifyReport = { verdict, issues, gapsStillOpen: gapsStillOpen(i) };
  if (i.coverageBefore !== null && i.coverageAfter !== null) {
    const allNorm = norm([outText, ...i.tailored.skills.flatMap((g) => g.items)].join("\n"));
    const tSkills = new Set(extractSkills(outText + "\n" + i.tailored.skills.flatMap((g) => g.items).join(", ")));
    const missing = i.jdKeywords.filter((kw) => { const sk = extractSkills(kw); return sk.length ? sk.some((s) => !tSkills.has(s)) : !hasToken(allNorm, kw); });
    report.keywordCoverage = { before: i.coverageBefore, after: i.coverageAfter, missing };
  }
  return report;
}

// ---------- revertBlocked ----------

export function revertBlocked(tailored: TailoredCV, source: ParsedCV, issues: Issue[]): {
  tailored: TailoredCV; reverted: { bulletId: string; reason: string }[]; removedSkills: string[];
} {
  const srcText = new Map<string, string>();
  const srcOwner = new Map<string, string>();
  for (const e of sections<ParsedCV, CvEntry>(source)) for (const b of e.bullets) { srcText.set(b.id, b.text); srcOwner.set(b.id, e.id); }
  const srcEntries = new Map(sections<ParsedCV, CvEntry>(source).map((e) => [e.id, e]));
  const eduIds = new Set([...source.education.map((e) => e.id), ...tailored.education.map((e) => e.id)]);

  const blocks = issues.filter((x) => x.severity === "block");
  const injected = blocks.filter((x) => x.type === "skillInjection").map((x) => x.claim);
  const injectedSkills = new Set(injected.filter((c) => extractSkills(c).length).map((c) => extractSkills(c)[0]));
  const mentionsInjected = (text: string) => {
    const n = norm(text);
    return extractSkills(text).some((s) => injectedSkills.has(s)) || injected.some((c) => hasToken(n, c));
  };
  const reasonFor = (pred: (x: Issue) => boolean, fallback: string) => blocks.find(pred)?.reason ?? fallback;
  const badBullets = new Set(blocks.filter((x) => x.bulletId).map((x) => x.bulletId!));
  const orphans = new Set(blocks.filter((x) => x.type === "orphanBullets").map((x) => x.bulletId!));
  const badHeads = new Set(blocks.filter((x) => !x.bulletId && x.entryId).map((x) => x.entryId!));
  const reverted: { bulletId: string; reason: string }[] = [];

  const fixEntries = (es: TailoredEntry[]): TailoredEntry[] => es.flatMap((e) => {
    const se = srcEntries.get(e.id);
    if (!se) { // tailoring never creates entries: drop it
      e.bullets.forEach((b) => reverted.push({ bulletId: b.id, reason: reasonFor((x) => x.entryId === e.id, "This entry isn't in your CV") }));
      return [];
    }
    const head = badHeads.has(e.id) ? { org: se.org, title: se.title, dates: se.dates, location: se.location } : {};
    const present = new Set(e.bullets.map((b) => b.id));
    const bullets = e.bullets.flatMap((b): TailoredBullet[] => {
      if (b.changeType === "dropped") return [b];
      const bad = badBullets.has(b.id) || mentionsInjected(b.text);
      if (!bad) return [b];
      const reason = reasonFor((x) => x.bulletId === b.id, "Mentioned a skill that isn't in your CV");
      reverted.push({ bulletId: b.id, reason });
      if (orphans.has(b.id)) return [];
      const refs = [...new Set(b.sourceRefs)].filter((r) => srcText.has(r) && srcOwner.get(r) === e.id);
      return refs.flatMap((r, n) => {
        if (n > 0 && present.has(r)) return [];
        return [{ id: n === 0 ? b.id : r, text: srcText.get(r)!, sourceRefs: [r], changeType: "kept" as const }];
      });
    });
    return [{ ...e, ...head, bullets }];
  });

  const revertField = (field: "summary" | "interests") => {
    const v = tailored[field];
    if (!v || (!badHeads.has(field) && !mentionsInjected(v))) return v;
    reverted.push({ bulletId: field, reason: reasonFor((x) => x.entryId === field, "Mentioned something that isn't in your CV") });
    return source[field];
  };
  const eduBad = tailored.education.some((e) => badHeads.has(e.id) || e.details.some((d) => badBullets.has(d.id) || mentionsInjected(d.text)))
    || [...badHeads].some((id) => eduIds.has(id) && !srcEntries.has(id));
  if (eduBad) reverted.push({ bulletId: "education", reason: reasonFor((x) => !!x.entryId && eduIds.has(x.entryId), "Education details can't change") });

  const removedSkills: string[] = [];
  const skills = tailored.skills.map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      const drop = injected.includes(it) || extractSkills(it).some((s) => injectedSkills.has(s));
      if (drop) removedSkills.push(it);
      return !drop;
    }),
  }));

  const out: TailoredCV = {
    ...tailored,
    summary: revertField("summary"),
    interests: revertField("interests"),
    education: eduBad ? source.education.map((e) => ({ ...e, details: e.details.map((d) => ({ ...d })) })) : tailored.education,
    experience: fixEntries(tailored.experience), projects: fixEntries(tailored.projects), leadership: fixEntries(tailored.leadership),
    skills,
    changes: [],
  };
  const revertedIds = new Set(reverted.map((r) => r.bulletId));
  out.changes = tailored.changes.filter((c) => !revertedIds.has(c.bulletId));
  return { tailored: out, reverted, removedSkills };
}
