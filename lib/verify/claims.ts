/**
 * Claim-level fabrication checks (audit 2026-10-18 report 05, "New rules"). Pure, deterministic, no LLM.
 *
 * The entity/number gate in tailoring.ts catches invented employers, digits, skills and verbs. These checks catch the
 * claims that slip past it because they reuse words the CV already has: a dropped hedge ("estimated", "paper",
 * "predicted"), a higher rung on a ladder (finalist → won, monthly → weekly, conversational → fluent, Spring Insight →
 * summer analyst, committee → senior management), a grade or duration the CV doesn't state, an invented cause or
 * purpose, and playbook reframes whose evidence isn't in the original.
 *
 * Every check compares a tailored unit with the text it cites: a bullet's cited source bullets, or for a summary
 * sentence the source units that share at least two content words with it. Grade, proficiency, role-type and duration
 * claims compare with the whole CV, because those facts live in the education section, the skills list and the dates.
 */
import type { CvEntry, ParsedCV } from "@/lib/types";
import { extractSkills } from "@/lib/skills/extract";
import { escapeRegex } from "@/lib/text/regex";

export type ClaimCheck =
  | "modalityDrop" | "outcomeEscalation" | "audienceEscalation" | "adoptionClaim" | "scopeSuperlative"
  | "frequencyEscalation" | "proficiencyEscalation" | "gradeClaim" | "roleTypeEscalation" | "durationClaim"
  | "causalInsertion" | "evaluativeAdverb" | "reframeGuard";
export type ClaimIssue = { check: ClaimCheck; severity: "block" | "warn"; claim: string; reason: string };
export type ClaimUnit = {
  text: string;
  /** What this unit may restate: its cited source bullets, or for a summary sentence the source units it overlaps. */
  cited: string;
  /** Two or more source bullets were merged into this one. */
  merged?: boolean;
  /** A summary or interests line (no single cited bullet). */
  scoped?: boolean;
};

const lc = (s: string) => s.toLowerCase();
const first = (re: RegExp, t: string) => t.match(re)?.[0] ?? null;

// ---------------------------------------------------------------- modality / hedge drops (05 #3)

type Group = { id: string; label: string; re: RegExp };
/** Each group is a kind of "this didn't really happen (yet)". Dropping the whole group turns it into a realised fact. */
export const MODALITY_GROUPS: Group[] = [
  { id: "simulated", label: "simulated / paper",
    re: /\bpaper[- ](?:trading|portfolio|trade|fund)s?\b|\bpaper\b(?=[^.;\n]{0,25}\bportfolio)|\bsimulat\w*|\bmock\b|\bvirtual\b|\bfantasy\b|\bhypothetical\b|\bmodel portfolio\b|\bstudent[- ]run fund\b|\bcase (?:study|competition)\b|\b(?:trading|investment|stock|case|coding|hackathon) challenge\b/i },
  { id: "projection", label: "estimated / projected",
    re: /\bestimated?\b|\bprojected\b|\bforecast(?:ed)? to\b|\bexpected to\b|\bon track to\b|\bpotential(?:ly)?\b|\btarget(?:ed)? (?:to|of|saving)\b|\baim(?:ed|ing)? to\b|\bcould\b|\bwould\b/i },
  { id: "proposal", label: "proposed / drafted",
    re: /\bpropos\w*|\brecommend\w*|\bsuggest\w*|\bdraft\w*|\bpitched\b|\bprototyp\w*|\bproof of concept\b|\bMVP\b|\bpilot\w*/i },
  { id: "predicted", label: "predicted", re: /\bpredicted\b|\bexpected\b(?! to)|\bon course for\b/i },
];
/** A realised result: "that cut costs", "Reduced costs", "Delivered …". */
const REALISED = /\b(?:that|which|and)\s+(?:cut|reduced|saved|increased|grew|improved|boosted|raised|lowered|generated|delivered)\b|(?:^|[.;]\s*)(?:Cut|Reduced|Saved|Increased|Grew|Improved|Boosted|Delivered|Implemented|Achieved|Generated|Lowered)\b|\b(?:delivered|implemented|achieved|rolled out)\b/;

function modalityIssues(u: ClaimUnit): ClaimIssue[] {
  const out: ClaimIssue[] = [];
  // A summary compresses many lines, so it can't carry every "proposed"/"estimated"; it must still keep "paper" and
  // "predicted", and must not turn a proposal into a result (below).
  for (const g of u.scoped ? MODALITY_GROUPS.filter((x) => x.id === "simulated" || x.id === "predicted") : MODALITY_GROUPS) {
    const was = first(g.re, u.cited);
    if (was && !g.re.test(u.text)) {
      out.push({ check: "modalityDrop", severity: "block", claim: was,
        reason: `Your original says "${was}" — keep that, or it reads as if it really happened` });
    }
  }
  // "Drafted a proposal to cut costs by an estimated 15%" → "Delivered a proposal that cut costs": hedge kept, result realised
  if (!out.length && (MODALITY_GROUPS[1].re.test(u.cited) || MODALITY_GROUPS[2].re.test(u.cited))) {
    const r = u.text.match(REALISED)?.[0]?.replace(/^[.;\s]+/, "");
    if (r && !new RegExp(`\\b${escapeRegex(r.toLowerCase())}\\b`).test(lc(u.cited))) {
      out.push({ check: "modalityDrop", severity: "block", claim: r,
        reason: "Your original describes a proposal or an estimate, not a result that happened" });
    }
  }
  return out;
}

// ---------------------------------------------------------------- outcome ladder (05 #4)

const OUTCOME: [number, RegExp][] = [
  [0, /\bparticipa\w*|\bcompeted\b|\bentered\b/i],
  [1, /\bshortlist\w*|\bnominat\w*|\blonglist\w*/i],
  [2, /\b(?:semi[- ]?)?finalists?\b|\breached the final\b/i],
  [3, /\brunner[- ]up\b|\bhighly commended\b|\b(?:second|third|2nd|3rd) place\b|\bplaced (?:second|third|2nd|3rd)\b|\b(?:silver|bronze) (?:medal|award)\b/i],
  [4, /\bwon\b|\bwinn(?:er|ers|ing)\b|\b(?:first|1st) place\b|\bplaced (?:first|1st|top)\b|\bchampions?\b|\bgold (?:medal|award)\b|\btop[- ]ranked\b/i],
];
function outcomeRank(t: string): { rank: number; word: string } | null {
  let best: { rank: number; word: string } | null = null;
  for (const [rank, re] of OUTCOME) { const w = first(re, t); if (w && (!best || rank > best.rank)) best = { rank, word: w }; }
  return best;
}
function outcomeIssues(u: ClaimUnit): ClaimIssue[] {
  const t = outcomeRank(u.text);
  if (!t || t.rank === 0) return [];
  const c = outcomeRank(u.cited);
  if (c && t.rank <= c.rank) return [];
  // A bullet with no outcome word in its source keeps the old warn (newAchievement); a summary has no source line for it.
  if (!c && !u.scoped) return [];
  return [{ check: "outcomeEscalation", severity: "block", claim: t.word,
    reason: c ? `Your CV says "${c.word}", not "${t.word}"` : `"${t.word}" isn't in your CV` }];
}

// ---------------------------------------------------------------- audience / scope (05 #5)

const SENIOR = "senior management|senior leadership|senior leaders|senior stakeholders|directors|executives|partners|managing directors|MDs|the board|board members|board of directors|C-suite|leadership team|heads? of department|cross[- ]functional (?:teams?|committees?|stakeholders?)";
const EXTERNAL = "clients?|customers?|investors?|sponsors?|regulators?|the press|journalists";
const AUDIENCE = new RegExp(
  `\\b(?:to|for|with|before|advising|advised|briefed|briefing)\\s+(?:the\\s+|our\\s+|its\\s+|their\\s+|external\\s+|key\\s+|prospective\\s+|potential\\s+|a\\s+)?(?:${SENIOR}|${EXTERNAL})\\b|\\b(?:client|customer|investor)[- ]facing\\b|\\ba cross[- ]functional\\b`, "gi");
const ADOPTION = /\b(?:was|were|been|being|got)\s+(?:adopted|implemented|approved|rolled out|signed off|accepted|taken forward|actioned)\b|\bwent live\b|\b(?:adopted|implemented|approved|actioned) by\b/i;
const SUPERLATIVE_BLOCK = /\b(?:busiest|largest|biggest|highest[- ]grossing|top[- ]performing|best[- ]performing|record[- ](?:breaking|high|number|attendance))\b/i;
const SUPERLATIVE_WARN = /\b(?:leading|national|nationwide|global|firm[- ]wide|company[- ]wide|international)\b/i;

/** The audience head noun ("senior management", "clients") a phrase names. */
const audienceKey = (m: string) => lc(m).replace(/^(?:to|for|with|before|advising|advised|briefed|briefing)\s+/, "")
  .replace(/^(?:the|our|its|their|external|key|prospective|potential|a)\s+/, "").replace(/-facing$/, "").replace(/s$/, "");

function audienceIssues(u: ClaimUnit): ClaimIssue[] {
  const out: ClaimIssue[] = [];
  const cited = lc(u.cited);
  for (const m of u.text.matchAll(AUDIENCE)) {
    const key = audienceKey(m[0]);
    const head = key.split(/[\s-]/)[0];
    if (cited.includes(key) || (head.length > 3 && new RegExp(`\\b${escapeRegex(head)}`).test(cited))) continue;
    out.push({ check: "audienceEscalation", severity: "block", claim: m[0].trim(),
      reason: `Your original doesn't say this went ${m[0].trim().split(/\s+/)[0]} ${key} — keep the audience it names` });
    break;
  }
  const a = first(ADOPTION, u.text);
  if (a && !ADOPTION.test(u.cited)) out.push({ check: "adoptionClaim", severity: "block", claim: a, reason: "Your original doesn't say this was adopted or implemented" });
  const s = first(SUPERLATIVE_BLOCK, u.text);
  if (s && !new RegExp(`\\b${escapeRegex(lc(s))}\\b`).test(cited)) out.push({ check: "scopeSuperlative", severity: "block", claim: s, reason: `"${s}" is a new claim your CV doesn't make` });
  const w = first(SUPERLATIVE_WARN, u.text);
  if (w && !new RegExp(`\\b${escapeRegex(lc(w))}\\b`).test(cited)) out.push({ check: "scopeSuperlative", severity: "warn", claim: w, reason: `"${w}" widens the scope — keep it only if your CV says so` });
  return out;
}

// ---------------------------------------------------------------- frequency ladder (05 #6)

const FREQ: [number, RegExp][] = [
  [1, /\bannual(?:ly)?\b|\byearly\b|\b(?:each|every|per|once a) year\b/i],
  [2, /\btermly\b|\bquarterly\b|\b(?:each|every|per|once a) (?:term|quarter)\b/i],
  [3, /\bmonthly\b|\b(?:each|every|per|once a) month\b|\ba month\b/i],
  [4, /\bfortnightly\b|\bbi-?weekly\b|\bevery (?:other|two) weeks?\b|\btwice a month\b/i],
  [5, /\bweekly\b|\b(?:each|every|per|once a) week\b|\ba week\b/i],
  [6, /\bdaily\b|\b(?:each|every|per) day\b|\ba day\b(?!-)|\bdaily basis\b/i],
  [7, /\bhourly\b|\b(?:each|every|per|an) hour\b/i],
];
const VAGUE_FREQ = /\bregular(?:ly)?\b|\bfrequent(?:ly)?\b|\broutine(?:ly)?\b|\bongoing\b/i;
function freq(t: string): { rank: number; word: string } | null {
  let best: { rank: number; word: string } | null = null;
  for (const [rank, re] of FREQ) { const w = first(re, t); if (w && (!best || rank > best.rank)) best = { rank, word: w }; }
  return best;
}
function frequencyIssues(u: ClaimUnit, corpus: string): ClaimIssue[] {
  // a summary may restate any frequency the CV states somewhere
  const t = freq(u.text), c = freq(u.scoped ? corpus : u.cited);
  if (t && (!c || t.rank > c.rank)) {
    return [{ check: "frequencyEscalation", severity: "block", claim: t.word,
      reason: c ? `Your CV says "${c.word}", not "${t.word}"` : `Your original doesn't say how often — "${t.word}" is new` }];
  }
  if (!t && c && !u.scoped && VAGUE_FREQ.test(u.text)) {
    return [{ check: "frequencyEscalation", severity: "warn", claim: first(VAGUE_FREQ, u.text)!, reason: `Your CV says "${c.word}" — the exact frequency reads stronger` }];
  }
  return [];
}

// ---------------------------------------------------------------- proficiency ladder (05 #7)

/** One ladder for tools and languages (IMC: "if we read 'very good' in C++…"). */
const LEVELS: [number, RegExp][] = [
  [0, /^(?:familiar|familiarity|exposure|basic|beginner|elementary|a1|a2)$/],
  [1, /^(?:working knowledge|intermediate|competent|conversational|b1|limited working)$/],
  [2, /^(?:proficient|proficiency|strong|professional working|b2|solid)$/],
  [3, /^(?:advanced|very good|fluent|fluency|excellent|c1|full professional)$/],
  [4, /^(?:expert|expertise|mastery|native|bilingual|c2|mother tongue)$/],
];
const LEVEL_PHRASE = /\b(?:working knowledge|limited working|professional working|full professional|very good|mother tongue|familiar(?:ity)?|exposure|basic|beginner|elementary|intermediate|competent|conversational|proficien(?:t|cy)|strong|solid|advanced|fluen(?:t|cy)|excellent|expert(?:ise)?|mastery|native|bilingual)\b|\b[ABC][12]\b/gi;
export const LANGUAGES = ("english french spanish german italian portuguese dutch russian polish ukrainian romanian greek turkish arabic hebrew persian farsi " +
  "urdu hindi bengali punjabi gujarati tamil telugu marathi mandarin cantonese chinese japanese korean vietnamese thai indonesian malay swahili " +
  "yoruba igbo hausa amharic somali czech hungarian swedish norwegian danish finnish welsh irish tagalog").split(" ");
const LANG_SET = new Set(LANGUAGES);
const levelRank = (w: string) => LEVELS.find(([, re]) => re.test(lc(w).replace(/\s+/g, " ")))?.[0] ?? null;

/** Level claims in a text, each attached to the nearest skill or language within 4 tokens. Key = canonical skill or language. */
export function levelClaims(text: string): { key: string; rank: number; word: string }[] {
  // A level belongs to an item in its own list entry or line: "English (fluent)\nTurkish (native)" never crosses over
  return text.split(/[\n;,|•·]+/).flatMap(segmentLevels);
}
function segmentLevels(text: string): { key: string; rank: number; word: string }[] {
  const toks = [...text.matchAll(/[A-Za-z][A-Za-z0-9+#.]*/g)].map((m) => ({ w: m[0].replace(/\.$/, ""), at: m.index! }));
  const out: { key: string; rank: number; word: string }[] = [];
  const itemAt = (j: number): string | null => {
    const w = toks[j]?.w;
    if (!w) return null;
    if (LANG_SET.has(lc(w))) return lc(w);
    for (const span of [w, toks[j + 1] ? `${w} ${toks[j + 1].w}` : null]) {
      if (!span) continue;
      const sk = extractSkills(span);
      if (sk.length === 1) return sk[0];
    }
    return null;
  };
  for (const m of text.matchAll(LEVEL_PHRASE)) {
    // CEFR codes count only next to a language ("Spanish (C1)")
    const rank = levelRank(m[0]);
    if (rank === null) continue;
    const at = toks.findIndex((t) => t.at >= m.index!);
    if (at < 0) continue;
    const span = m[0].split(/\s+/).length;
    let key: string | null = null;
    const bracketed = /\(\s*$/.test(text.slice(0, m.index!)); // "Spanish (fluent)": the item comes first
    for (let d = 1; d <= 4 && !key; d++) {
      for (const j of bracketed ? [at - d, at + span - 1 + d] : [at + span - 1 + d, at - d]) {
        const k = itemAt(j);
        if (k && (!/^[ABC][12]$/i.test(m[0]) || LANG_SET.has(k))) { key = k; break; }
      }
    }
    if (key) out.push({ key, rank, word: m[0] });
  }
  return out;
}

// ---------------------------------------------------------------- grades (05 #8)

type GradeClass = "first" | "2:1" | "2:2" | "third" | "distinction" | "merit";
const CLASS_RES: [GradeClass, RegExp][] = [
  ["first", /\bfirst[- ]class\b|\b1st[- ]class\b|\b(?:a|achieved|predicted|expected|on track for|on course for|awarded)\s+(?:a\s+)?first\b(?!\s+(?:year|place|time|round|stage|job|role))/gi],
  ["2:1", /\b2\s?[:.]\s?1\b(?![\d.x%])|\bupper second\b/gi],
  ["2:2", /\b2\s?[:.]\s?2\b(?![\d.x%])|\blower second\b/gi],
  ["third", /\bthird[- ]class\b/gi],
  ["distinction", /\bdistinction\b/gi],
  ["merit", /\bmerit\b(?![- ]based)/gi],
];
const PREDICTED_BEFORE = /\b(?:predicted|expected|on track (?:for|to (?:get|achieve))|on course for|projected|anticipated|working towards)\b[^.;\n]{0,20}$/i;
const ALEVEL = /(?<![A-Za-z*])((?:A\*|[A-E]){3,5})(?![A-Za-z*])/g;

function gradeMentions(t: string): { cls: GradeClass; raw: string; predicted: boolean }[] {
  const out: { cls: GradeClass; raw: string; predicted: boolean }[] = [];
  for (const [cls, re] of CLASS_RES) for (const m of t.matchAll(re)) {
    out.push({ cls, raw: m[0], predicted: PREDICTED_BEFORE.test(t.slice(0, m.index!)) || /predicted|expected|on track|on course/i.test(m[0]) });
  }
  return out;
}
function aLevels(t: string): string[] {
  return [...t.matchAll(ALEVEL)].filter((m) => m[1].includes("*") || /\bA[- ]?levels?\b/i.test(t.slice(Math.max(0, m.index! - 20), m.index! + m[0].length + 20))).map((m) => m[1]);
}

// ---------------------------------------------------------------- role type (05 #2)

/** virtual(0) < insight(1) < internship/placement(2) < job(3). */
export function engagementRank(title: string, org: string): number {
  const t = `${title} ${org}`;
  if (/\bforage\b|\bvirtual (?:experience|work|internship|programme|program)\b|\bjob simulation\b|\bvirtual\b/i.test(t)) return 0;
  if (/\bspring (?:week|insight|intern\w*)\b|\binsight\b|\bdiscovery\b|\bopen day\b|\btaster\b|\bwork shadow\w*|\bexperience day\b|\bwork experience\b/i.test(t)) return 1;
  if (/\bintern\w*|\bplacement\b|\bvacation scheme\b|\bsummer (?:analyst|associate|scheme)\b|\bindustrial year\b|\byear in industry\b/i.test(t)) return 2;
  return 3;
}
const RANK_NAME = ["a virtual experience programme", "an insight programme", "an internship", "a job"];
const ROLE_WORDS: [number, string][] = [
  [1, "spring weeks?|spring insights?|insight (?:programmes?|programs?|days?|weeks?)"],
  [2, "interns?|internships?|placements?|vacation schemes?|work placements?|summer internships?|industrial placements?"],
  [3, "summer analysts?|analysts?|associates?|trainees?|employees?|staff|graduates?|consultants?|engineers?"],
];
const PERSON_NOUN = /^(?:summer analysts?|analysts?|associates?|trainees?|employees?|staff|graduates?|consultants?|engineers?)$/i;

function roleTypeIssues(text: string, entries: ClaimEntry[]): ClaimIssue[] {
  for (const e of entries) {
    if (e.rank >= 3 || e.org.trim().length < 3) continue;
    const org = escapeRegex(e.org.trim()).replace(/\s+/g, "\\s+");
    const claims: { rank: number; claim: string }[] = [];
    for (const [rank, words] of ROLE_WORDS) {
      // "Goldman Sachs summer analyst", "a Goldman Sachs internship", "Former Goldman Sachs analyst"
      for (const m of text.matchAll(new RegExp(`(^|.{0,12})\\b(${org})(?:['’]s)?\\s+(?:[A-Za-z&]+\\s+){0,2}?(${words})\\b`, "gi"))) {
        const before = m[1] ?? "";
        if (PERSON_NOUN.test(m[3]) && /\b(?:an?|the)\s+$/i.test(before) && !/\bas\s+(?:an?|the)\s+$/i.test(before)) continue; // "shadowed a Goldman Sachs analyst"
        claims.push({ rank, claim: m[0].slice(before.length).trim() });
      }
      // "internship at Goldman Sachs", "worked as an analyst with Goldman"
      for (const m of text.matchAll(new RegExp(`(.{0,12})\\b(${words})\\s+(?:at|with|for|in)\\s+(?:the\\s+)?(${org})\\b`, "gi"))) {
        const before = m[1] ?? "";
        if (PERSON_NOUN.test(m[2]) && /\b(?:an?|the)\s+$/i.test(before) && !/\bas\s+(?:an?|the)\s+$/i.test(before)) continue; // "shadowed an analyst at Goldman Sachs"
        claims.push({ rank, claim: m[0].slice(before.length).trim() });
      }
    }
    // "worked at / employed by / joined Goldman Sachs"
    const w = text.match(new RegExp(`\\b(?:worked|working|work|employed|interned|joined|hired)\\s+(?:at|for|with|by)?\\s*(?:the\\s+)?(${org})\\b`, "i"));
    if (w) claims.push({ rank: /interned/i.test(w[0]) ? 2 : 3, claim: w[0] });
    const top = claims.sort((a, b) => b.rank - a.rank)[0];
    if (top && top.rank > e.rank) {
      return [{ check: "roleTypeEscalation", severity: "block", claim: top.claim,
        reason: `Your CV lists ${e.org} as ${RANK_NAME[e.rank]} ("${e.title}"), not ${RANK_NAME[top.rank]}` }];
    }
  }
  return [];
}

// ---------------------------------------------------------------- duration (05 #19)

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SEASON: Record<string, [number, number]> = { spring: [2, 4], summer: [5, 7], autumn: [8, 10], winter: [11, 13] };
const WORD_N: Record<string, number> = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/** A date field as an inclusive range of month indexes (year*12 + month). A year alone spans the whole year. */
export function monthRange(dates: string, now: Date): [number, number] | null {
  const parts = dates.split(/\s*(?:–|—|-|\bto\b|\buntil\b)\s*/i).filter((p) => p.trim());
  const point = (p: string, end: boolean): number | null => {
    if (/\b(?:present|now|current|ongoing|today)\b/i.test(p)) return now.getFullYear() * 12 + now.getMonth();
    const y = p.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? (p.match(/['’](\d{2})\b/) ? `20${p.match(/['’](\d{2})\b/)![1]}` : null);
    if (!y) return null;
    const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m}`, "i").test(p));
    const season = Object.keys(SEASON).find((s) => new RegExp(`\\b${s}\\b`, "i").test(p));
    const month = mi >= 0 ? mi : season ? SEASON[season][end ? 1 : 0] : end ? 11 : 0;
    return +y * 12 + month;
  };
  if (!parts.length) return null;
  const a = point(parts[0], false);
  const b = point(parts[parts.length - 1], true);
  if (a === null) return null;
  return [a, b === null ? a : Math.max(a, b)];
}
function monthsCovered(ranges: [number, number][]): number {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  let total = 0, cur: [number, number] | null = null;
  for (const r of sorted) {
    if (!cur || r[0] > cur[1] + 1) { if (cur) total += cur[1] - cur[0] + 1; cur = [...r]; } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) total += cur[1] - cur[0] + 1;
  return total;
}
const DURATION = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an?)\+?\s*(years?|months?)['’]?\s+(?:of\s+)?((?:[\w-]+\s+){0,3}?)(?:work\s+)?experience\b/gi;
const stemOf = (w: string) => lc(w).replace(/(?:ing|ers|er|ed|es|s)$/, "").slice(0, 6);

function durationIssues(text: string, ctx: ClaimCtx): ClaimIssue[] {
  for (const m of text.matchAll(DURATION)) {
    const n = /^\d+$/.test(m[1]) ? +m[1] : WORD_N[lc(m[1])] ?? 1;
    const years = /^year/i.test(m[2]);
    const qual = (m[3] ?? "").split(/\s+/).filter((w) => w.length >= 4).map(stemOf);
    const related = ctx.entries.filter((e) => qual.some((q) => lc(e.text).split(/[^a-z]+/).some((w) => w.length >= 4 && stemOf(w) === q)));
    const pool = related.length ? related : ctx.entries;
    const months = monthsCovered(pool.map((e) => monthRange(e.dates, ctx.now)).filter((r): r is [number, number] => r !== null));
    if (!months) continue;
    const allowed = years ? Math.ceil(months / 12) : months;
    if (n > allowed) {
      return [{ check: "durationClaim", severity: "block", claim: m[0].trim(),
        reason: `Your dates add up to about ${months} month${months === 1 ? "" : "s"}, not ${m[1]} ${m[2]}` }];
    }
  }
  return [];
}

// ---------------------------------------------------------------- causal links and purpose clauses (05 #14)

const CAUSAL = /\b(?:that|which)\s+(?:led to|drove|grew|increased|reduced|cut|resulted in|boosted|improved|raised|lifted|doubled|tripled)\b|\bresulting in\b|\bleading to\b|\bthereby\b|\bso that\b|\bin order to\b|\bhelping to\b|\benabling\b|\bcontributing to\b|\bwhich helped\b/gi;
const PURPOSE = /\bto (?:cut|reduce|increase|improve|boost|drive|grow|save|lower|raise|speed up|streamline)\b/gi;
const EVALUATIVE = /\b(?:accurately|successfully|significantly|substantially|dramatically|efficiently|effectively|seamlessly|greatly|considerably|massively|hugely)\b/gi;

function causalIssues(u: ClaimUnit): ClaimIssue[] {
  const out: ClaimIssue[] = [];
  const cited = lc(u.cited);
  const isNew = (s: string) => !cited.includes(lc(s).replace(/\s+/g, " "));
  const c = [...u.text.matchAll(CAUSAL)].map((m) => m[0]).find(isNew);
  if (c) out.push({ check: "causalInsertion", severity: u.merged ? "block" : "warn", claim: c,
    reason: u.merged ? "Your original lists these separately; it doesn't say one caused the other" : `"${c}" adds a result your original doesn't state` });
  const p = [...u.text.matchAll(PURPOSE)].map((m) => m[0]).find(isNew);
  if (p) out.push({ check: "causalInsertion", severity: "block", claim: p, reason: `"${p}" adds a purpose your original doesn't state` });
  const a = [...u.text.matchAll(EVALUATIVE)].map((m) => m[0]).find(isNew);
  if (a) out.push({ check: "evaluativeAdverb", severity: "warn", claim: a, reason: `"${a}" is a new claim — show it with the facts instead` });
  return out;
}

// ---------------------------------------------------------------- playbook reframe guards (05 #9, #30)

/** A reframe target the playbooks suggest, and the evidence its cited source must show before it may appear. */
export const REFRAME_GUARDS: { term: string; re: RegExp; requires: RegExp; reason: string }[] = [
  { term: "A/B test", re: /\ba\/?b[- ]test\w*|\bsplit[- ]test\w*/i, requires: /\bcontrol\b|\bvariants?\b|\bsplit\b|\brandomi[sz]\w*|\btwo versions\b|\ba\/?b\b/i,
    reason: "'A/B test' needs a control or two variants with a measured result in your original" },
  { term: "deployed", re: /\bdeploy\w*|\bwent live\b|\bin production\b|\blive (?:app|site|website|product|service)\b/i,
    requires: /\bdeploy\w*|\bhosted\b|\blive\b|https?:|\bvercel\b|\bheroku\b|\baws\b|\bnetlify\b|\bapp store\b|\bplay store\b|\bproduction\b|\bpublished\b/i,
    reason: "Your original doesn't say this was deployed or live" },
  { term: "client-facing", re: /\bclient[- ]facing\b/i, requires: /\bclients?\b|\bcustomers?\b|\bexternal\b|\bpublic\b/i,
    reason: "'Client-facing' needs direct contact with clients or customers in your original" },
  { term: "published", re: /\bpublished\b|\bpublications?\b|\bpeer[- ]reviewed\b/i, requires: /\bjournal\b|\bconference\b|\bproceedings\b|\bdoi\b|\bpublished\b|\bpublication\b|\barxiv\b/i,
    reason: "Your original doesn't say this was published" },
  { term: "manuscript in preparation", re: /\bmanuscript\b|\bin preparation\b/i, requires: /\bpaper\b|\bmanuscript\b|\bjournal\b/i,
    reason: "Your original doesn't mention a paper or manuscript" },
  { term: "pitchbook", re: /\bpitch ?books?\b/i, requires: /\bdeal\b|\btransaction\b|\bm&a\b|\bpitch ?books?\b|\bmerger\b|\bacquisition\b/i,
    reason: "A pitchbook needs a deal or transaction in your original" },
  { term: "stock pitch", re: /\bstock pitch\w*|\binvestment thesis\b|\bequity research report\b/i, requires: /\bstock pitch\w*|\bpitch\w*|\binvestment thesis\b|\bequity research\b|\bstock\b/i,
    reason: "Your original doesn't mention a stock pitch" },
  { term: "DCF", re: /\bDCF\b|\bdiscounted cash[- ]flow\b/i, requires: /\bDCF\b|\bdiscounted cash[- ]flow\b/i, reason: "Your original doesn't name a DCF" },
  { term: "LBO", re: /\bLBO\b|\bleveraged buy-?out\b/i, requires: /\bLBO\b|\bleveraged buy-?out\b/i, reason: "Your original doesn't name an LBO" },
  { term: "comps", re: /\bcomparable compan(?:y|ies)(?: analysis)?\b|\btrading comps\b|\bcomps\b|\bprecedent transactions?\b/i,
    requires: /\bcomparable compan|\bcomps\b|\bprecedent transactions?\b/i, reason: "Your original doesn't name a comparable-company analysis" },
  { term: "pro bono consulting", re: /\bpro[- ]bono\b/i, requires: /\bpro[- ]bono\b|\bcharit\w*|\bnon[- ]profit\b|\bngo\b/i, reason: "Your original doesn't describe pro bono work for a charity" },
];
function reframeIssues(u: ClaimUnit): ClaimIssue[] {
  const out: ClaimIssue[] = [];
  for (const g of REFRAME_GUARDS) {
    const m = first(g.re, u.text);
    if (!m || g.re.test(u.cited) || g.requires.test(u.cited)) continue;
    out.push({ check: "reframeGuard", severity: "block", claim: m, reason: g.reason });
  }
  return out;
}

// ---------------------------------------------------------------- context and entry point

export type ClaimEntry = { id: string; org: string; title: string; dates: string; text: string; rank: number };
export type ClaimCtx = {
  entries: ClaimEntry[];
  /** The whole CV content (corpus): grades, skills levels, A-levels. */
  corpus: string;
  levels: Map<string, number>;
  grades: { cls: GradeClass; predicted: boolean }[];
  aLevels: Set<string>;
  now: Date;
};

export function buildClaimCtx(cv: ParsedCV, corpus: string, now: Date = new Date()): ClaimCtx {
  const all: CvEntry[] = [...cv.experience, ...cv.projects, ...cv.leadership];
  const entries = all.map((e) => ({ id: e.id, org: e.org, title: e.title, dates: e.dates, text: [e.title, e.org, ...e.bullets.map((b) => b.text)].join(" "), rank: engagementRank(e.title, e.org) }));
  const levels = new Map<string, number>();
  for (const c of levelClaims(corpus)) levels.set(c.key, Math.max(levels.get(c.key) ?? -1, c.rank));
  const grades = gradeMentions(corpus).map((g) => ({ cls: g.cls, predicted: g.predicted }));
  // a bare grade field ("First", "Predicted First", "Distinction") names the class without the word "class"
  for (const e of cv.education) {
    const m = e.grade?.match(/^\s*((?:predicted|expected)\s+)?(first|1st)\b/i);
    if (m) grades.push({ cls: "first", predicted: !!m[1] });
  }
  return { entries, corpus, levels, grades, aLevels: new Set(aLevels(corpus)), now };
}

/** Grade and A-level claims must match the CV exactly, "predicted" included. */
function gradeIssues(text: string, ctx: ClaimCtx): ClaimIssue[] {
  for (const g of gradeMentions(text)) {
    const src = ctx.grades.filter((s) => s.cls === g.cls);
    if (!src.length) {
      const have = ctx.grades[0];
      return [{ check: "gradeClaim", severity: "block", claim: g.raw,
        reason: have ? `Your grade is ${have.predicted ? "predicted " : ""}${have.cls} — we keep it exactly as written` : "Your CV doesn't state this grade" }];
    }
    if (src.every((s) => s.predicted) && !g.predicted) {
      return [{ check: "gradeClaim", severity: "block", claim: g.raw, reason: `Your ${g.cls} is predicted — keep "predicted"` }];
    }
  }
  for (const a of aLevels(text)) {
    if (!ctx.aLevels.has(a)) return [{ check: "gradeClaim", severity: "block", claim: a, reason: `Your CV gives your A-levels as ${[...ctx.aLevels][0] ?? "something else"}` }];
  }
  return [];
}

function proficiencyIssues(text: string, ctx: ClaimCtx): ClaimIssue[] {
  for (const c of levelClaims(text)) {
    const src = ctx.levels.get(c.key);
    if (src === undefined ? c.rank >= 2 : c.rank > src) {
      const name = LANG_SET.has(c.key) ? c.key[0].toUpperCase() + c.key.slice(1) : c.key;
      return [{ check: "proficiencyEscalation", severity: "block", claim: `${c.word} ${name}`,
        reason: src === undefined ? `Your CV doesn't give a level for ${name}` : `Your CV gives a lower level for ${name} than "${c.word}"` }];
    }
  }
  return [];
}

/** Every claim check on one tailored unit. */
export function unitClaimIssues(u: ClaimUnit, ctx: ClaimCtx): ClaimIssue[] {
  return [
    ...modalityIssues(u), ...outcomeIssues(u), ...audienceIssues(u), ...frequencyIssues(u, ctx.corpus), ...causalIssues(u), ...reframeIssues(u),
    ...gradeIssues(u.text, ctx), ...proficiencyIssues(u.text, ctx), ...roleTypeIssues(u.text, ctx.entries), ...durationIssues(u.text, ctx),
  ];
}

/** Skills-list items only state levels (and must not raise them). */
export function skillItemIssues(item: string, ctx: ClaimCtx): ClaimIssue[] {
  return proficiencyIssues(item, ctx);
}
