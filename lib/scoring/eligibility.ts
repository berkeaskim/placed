import type { Year } from "@/lib/types";
import { sponsorshipRefusalLine } from "@/lib/ingest/filter";

/**
 * Eligibility signals read straight from the posting text (10#2, #6, #7, #26). Pure and deterministic, so it works with
 * AI off and on postings tagged before these fields existed. Every signal carries the sentence it came from: a gate the
 * student can't see the reason for is a gate they can't contest (DSIT, Responsible AI in Recruitment, 2024).
 * Employers state eligibility by graduation year ("expecting to graduate in 2029"), not by year label.
 */

export type DegreeClass = "first" | "2:1" | "2:2";
export const DEGREE_RANK: Record<DegreeClass, number> = { first: 3, "2:1": 2, "2:2": 1 };

export type SubjectFamily = "computing" | "maths" | "physics" | "engineering" | "science" | "economics" | "business" | "law" | "humanities" | "social";

export type EligibilitySignals = {
  gradWindow: { min: number; max: number; quote: string } | null;
  minYearsExperience: { years: number; quote: string } | null;
  minDegreeClass: { cls: DegreeClass; quote: string } | null;
  contextualOffers: boolean;
  /** `related`: the posting says "or related", so a near-miss course still counts. */
  degreeSubjects: { families: SubjectFamily[]; related: boolean; quote: string } | null;
  languages: { lang: string; quote: string }[];
  /** Year the role starts, from the title ("2027 Summer Internship") or a start sentence. */
  startYear: number | null;
  /** The posting names the UK/London/EMEA anywhere: a "Europe" location then isn't a non-UK role. */
  mentionsUk: boolean;
  sponsorQuote: string | null;
  /** A sentence naming a year of study ("penultimate year"), to quote with a label-based year gate. */
  yearQuote: string | null;
};

const clean = (l: string) => l.replace(/^#+\s*/, "").replace(/^\s*[-•*]\s+/, "").trim();

/** The sentence of `line` that contains `index`, capped so a run-on paragraph doesn't fill the panel. */
function sentenceAt(line: string, index: number): string {
  const starts = [0];
  const re = /[.!?](?=\s+[A-Z(])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) starts.push(m.index + 1);
  let start = 0;
  for (const s of starts) if (s <= index) start = s;
  const next = starts.find((s) => s > index) ?? line.length;
  const out = line.slice(start, next).trim();
  return out.length > 220 ? `${out.slice(0, 217).trimEnd()}…` : out;
}

function firstMatch(lines: string[], re: RegExp, accept: (m: RegExpExecArray, line: string) => boolean = () => true): { m: RegExpExecArray; quote: string } | null {
  for (const raw of lines) {
    const line = clean(raw);
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(line)) !== null) {
      if (accept(m, line)) return { m, quote: sentenceAt(line, m.index) };
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return null;
}

// ---------- graduation-year window ----------

const MONTH = "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?|summer|spring|autumn|winter)";
const YEAR = "20[1-4]\\d";
const YEAR_LIST = `(?:${MONTH}\\s+)?${YEAR}(?:\\s*(?:,|-|–|—|to|and|or|\\/)\\s*(?:${MONTH}\\s+)?${YEAR})*`;
/** Verb forms only: "Graduate Programme 2027" names a programme and its start, not who may apply. */
const GRAD_KEY = "(?:graduating|graduation(?:\\s+(?:date|year))?|graduated|graduate\\s+(?:in|by|between|no later than)|due to graduate|expect\\w*\\s+to\\s+graduate|finish\\w*\\s+(?:your\\s+)?(?:degree|studies)|complet\\w*\\s+(?:your\\s+)?(?:degree|studies)|class of)";
const GRAD_BEFORE = new RegExp(`\\b${GRAD_KEY}\\b[^.;:\\n]{0,40}?(?<![\\w-])(${YEAR_LIST})(?![\\w-])|\\bgraduation\\s+date\\s*:\\s*(${YEAR_LIST})`, "i");
const GRAD_AFTER = new RegExp(`(?<![\\w-])(${YEAR})\\s+(?:graduates|graduation|grads)\\b`, "i");
const AFTER_GRADUATION = /\b(after|upon|following|on)\s+$/i;

function parseGradWindow(lines: string[]): EligibilitySignals["gradWindow"] {
  const hit = firstMatch(lines, GRAD_BEFORE, (m, line) => !AFTER_GRADUATION.test(line.slice(Math.max(0, m.index - 12), m.index)))
    ?? firstMatch(lines, GRAD_AFTER);
  if (!hit) return null;
  const list = hit.m[1] ?? hit.m[2] ?? hit.m[0];
  const years = (list.match(new RegExp(YEAR, "g")) ?? []).map(Number);
  if (!years.length) return null;
  return { min: Math.min(...years), max: Math.max(...years), quote: hit.quote };
}

// ---------- years of experience ----------

const EXPERIENCE = /\b(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)['’]?\s+(?:of\s+)?(?:(?:commercial|professional|industry|industrial|relevant|work(?:ing)?|full[- ]time|post[- ]qualification|hands[- ]on|practical)\s+)?(?:work\s+)?experience\b/i;
const NOT_A_FLOOR_BEFORE = /\b(up to|no more than|less than|fewer than|maximum of|max\.?)\s*$/i;
const NOT_REQUIRED_AFTER = /^\s*(is|are)?\s*(not|n't)\s+(required|necessary|needed|essential)/i;

function parseExperience(lines: string[]): EligibilitySignals["minYearsExperience"] {
  const hit = firstMatch(lines, EXPERIENCE, (m, line) =>
    Number(m[1]) >= 1 &&
    !NOT_A_FLOOR_BEFORE.test(line.slice(Math.max(0, m.index - 16), m.index)) &&
    !NOT_REQUIRED_AFTER.test(line.slice(m.index + m[0].length, m.index + m[0].length + 30)));
  return hit ? { years: Number(hit.m[1]), quote: hit.quote } : null;
}

// ---------- degree class ----------

const CLASS_RE = /\b(first[- ]class|1st[- ]class|2[:.]1|upper[- ]second|2[:.]2|lower[- ]second)(?![\d])/gi;
const toClass = (s: string): DegreeClass | null => {
  const t = s.toLowerCase();
  if (/first|1st/.test(t)) return "first";
  if (/2[:.]1|upper/.test(t)) return "2:1";
  if (/2[:.]2|lower/.test(t)) return "2:2";
  return null;
};

function parseDegreeClass(lines: string[]): EligibilitySignals["minDegreeClass"] {
  let best: { cls: DegreeClass; quote: string } | null = null;
  for (const raw of lines) {
    const line = clean(raw);
    for (const m of line.matchAll(CLASS_RE)) {
      const cls = toClass(m[1]);
      if (!cls) continue;
      // the most permissive class named is the real floor ("2:1, but a 2:2 with experience is considered")
      if (!best || DEGREE_RANK[cls] < DEGREE_RANK[best.cls]) best = { cls, quote: sentenceAt(line, m.index ?? 0) };
    }
  }
  return best;
}

const CONTEXTUAL = /\bcontextual(?:ised|ized)?\s+(?:recruitment|offers?|admissions?|data|system)\b|\bmitigating circumstances\b/i;

/** UK class from a CV grade string; null when it can't be read as a degree class (A-levels, GPA). */
export function cvDegreeClass(grade: string | null | undefined): DegreeClass | "third" | null {
  if (!grade) return null;
  const g = grade.toLowerCase();
  if (/\bthird\b|\b3rd\b/.test(g)) return "third";
  const named = toClass(g.replace(/\bfirst\b(?![- ]year)/, "first-class"));
  if (named) return named;
  if (/\bdistinction\b/.test(g)) return "first";
  if (/\bmerit\b/.test(g)) return "2:1";
  const pct = g.match(/\b(\d{2})(?:\.\d+)?\s*%/);
  if (pct) {
    const n = Number(pct[1]);
    return n >= 70 ? "first" : n >= 60 ? "2:1" : n >= 50 ? "2:2" : "third";
  }
  return null;
}

// ---------- degree subject ----------

const FAMILY_WORDS: [SubjectFamily, RegExp][] = [
  ["computing", /\b(computer science|computing|software engineering|informatics|computer engineering|artificial intelligence|data science)\b/i],
  ["maths", /\b(math(?:s|ematics)?|statistics|actuarial|operational research)\b/i],
  ["physics", /\b(physics|astrophysics)\b/i],
  ["engineering", /\b(engineering|electrical|electronic|mechanical|aerospace|chemical engineering|civil)\b/i],
  ["science", /\b(chemistry|biology|biochemistry|natural sciences?|life sciences?|neuroscience|medicine)\b/i],
  ["economics", /\b(economics|econometrics)\b/i],
  ["business", /\b(finance|accounting|business|management|marketing)\b/i],
  ["law", /\b(law|llb|legal)\b/i],
  ["humanities", /\b(history|english literature|philosophy|classics|languages|linguistics|theology|music|art history)\b/i],
  ["social", /\b(politics|sociology|psychology|geography|anthropology|international relations)\b/i],
];
const STEM: SubjectFamily[] = ["computing", "maths", "physics", "engineering", "science"];

export function subjectFamilies(text: string): SubjectFamily[] {
  const out = FAMILY_WORDS.filter(([, re]) => re.test(text)).map(([f]) => f);
  if (/\bSTEM\b/.test(text)) out.push(...STEM);
  if (/\bquantitative\b/i.test(text)) out.push("maths", "physics", "engineering", "computing", "economics");
  return [...new Set(out)];
}

const ANY_SUBJECT = /\b(any|all)\s+(degree\s+)?(disciplines?|subjects?|degrees?|backgrounds?)\b|\b(discipline|degree subject|subject)\s+(or degree\s+)?(is|are)\s+not\s+important\b|\bfrom any (degree|discipline|background)\b/i;
const SUBJECT_CLAUSE = /\b(?:degree|studying|background|qualification|applicants|students)\s+(?:in|from|studying)\s+([^.;\n]{3,120})|\b([A-Za-z ,&]{3,80}?)\s+or\s+(?:a\s+)?(?:related|similar|relevant|equivalent)\s+(?:degree|discipline|field|subject|course)s?\b|\b(STEM|quantitative)\s+(?:degree|discipline|subject|background)/i;

function parseSubjects(lines: string[]): EligibilitySignals["degreeSubjects"] {
  if (lines.some((l) => ANY_SUBJECT.test(l))) return null;
  for (const raw of lines) {
    const line = clean(raw);
    const m = SUBJECT_CLAUSE.exec(line);
    if (!m) continue;
    const clause = m[1] ?? m[2] ?? m[3] ?? "";
    const families = subjectFamilies(m[3] ? m[3] : clause);
    if (!families.length) continue;
    return { families, related: /\b(related|similar|relevant|equivalent)\b/i.test(line.slice(m.index, m.index + m[0].length + 40)), quote: sentenceAt(line, m.index) };
  }
  return null;
}

// ---------- languages ----------

const LANGS = "english|french|german|spanish|italian|mandarin|chinese|japanese|arabic|portuguese|dutch|russian|cantonese|korean|hindi|polish|swedish|turkish|danish|norwegian|greek";
const LANG_BEFORE = new RegExp(`\\b(?:fluent|fluency in|native|proficien\\w*(?: in)?|business[- ]level|professional(?: working)? proficiency in)\\s+(${LANGS})\\b`, "i");
const LANG_AFTER = new RegExp(`\\b(${LANGS})\\s*(?:\\(\\s*)?(?:fluent|native|business[- ]level|to a (?:fluent|business) level)\\b`, "i");
const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase();

function parseLanguages(lines: string[]): EligibilitySignals["languages"] {
  const out: EligibilitySignals["languages"] = [];
  for (const raw of lines) {
    const line = clean(raw);
    for (const re of [LANG_BEFORE, LANG_AFTER]) {
      const m = re.exec(line);
      if (!m) continue;
      const lang = titleCase(m[1]);
      if (lang === "English" || out.some((o) => o.lang === lang)) continue;
      out.push({ lang, quote: sentenceAt(line, m.index) });
    }
  }
  return out;
}

// ---------- start year, UK mention, year-of-study quote ----------

const START = new RegExp(`\\b(?:start(?:ing|s)?|commenc\\w*|join(?:ing)? us)\\b[^.\\n]{0,30}?\\b(?:${MONTH}\\s+)?(20[2-4]\\d)\\b`, "i");
const TITLE_YEAR = /(?<![\d-])(20[2-4]\d)(?![\d-])/;
const UK_WORDS = /\b(uk|u\.k\.|united kingdom|london|emea|britain|great britain|england|scotland|wales)\b/i;
const YEAR_OF_STUDY = /\b(penultimate|final[- ]year|first[- ]year|1st[- ]year|second[- ]year|2nd[- ]year|year of study)\b/i;

function parseStartYear(title: string, lines: string[]): number | null {
  const t = TITLE_YEAR.exec(title);
  if (t) return Number(t[1]);
  const s = firstMatch(lines, START);
  return s ? Number(s.m[1]) : null;
}

export function parseEligibility(title: string, textLines: string[]): EligibilitySignals {
  const lines = textLines.filter((l) => l.trim());
  const yq = firstMatch(lines, YEAR_OF_STUDY);
  const sponsor = sponsorshipRefusalLine(lines.map(clean));
  return {
    gradWindow: parseGradWindow(lines),
    minYearsExperience: parseExperience([title, ...lines]),
    minDegreeClass: parseDegreeClass(lines),
    contextualOffers: lines.some((l) => CONTEXTUAL.test(l)),
    degreeSubjects: parseSubjects(lines),
    languages: parseLanguages(lines),
    startYear: parseStartYear(title, lines),
    mentionsUk: UK_WORDS.test(title) || lines.some((l) => UK_WORDS.test(l)),
    sponsorQuote: sponsor ? sentenceAt(sponsor, Math.max(0, sponsor.search(/sponsor/i))) : null,
    yearQuote: yq?.quote ?? null,
  };
}

// ---------- the student's side ----------

const yearOf = (today: string) => Number(today.slice(0, 4));
const monthOf = (today: string) => Number(today.slice(5, 7));

/** The summer the current academic year ends in (Oct 2026 → 2027; Mar 2027 → 2027). */
export function academicEndYear(today: string): number {
  return monthOf(today) >= 9 ? yearOf(today) + 1 : yearOf(today);
}

/** Summer internships and graduate starts recruited now: from July, applications are for next summer. */
export function summerCycleYear(today: string): number {
  return monthOf(today) >= 7 ? yearOf(today) + 1 : yearOf(today);
}

/**
 * Graduation years the student could have. Exact when they told us; otherwise every year their year of study allows,
 * since a 1st or 2nd year may be on a 3- or 4-year course (10#14). A gate only fails when none of them fit.
 */
export function studentGradYears(s: { year: Year; gradYear?: number | null }, today: string): number[] {
  if (s.gradYear != null) return [s.gradYear];
  const e = academicEndYear(today);
  const left: Record<Year, number[]> = { "1st": [2, 3], "2nd": [1, 2], penultimate: [1], final: [0], masters: [0] };
  return left[s.year].map((n) => e + n);
}

/** Year-of-study labels the grad year settles: 2nd + graduating next summer is penultimate; 2nd on a 4-year course is not. */
export function studentYearLabels(s: { year: Year; gradYear?: number | null }, today: string): Set<Year> {
  const labels = new Set<Year>([s.year]);
  if (s.gradYear == null) return labels;
  const left = s.gradYear - academicEndYear(today);
  if (left <= 0) labels.add("final"); else labels.delete("final");
  if (left === 1) labels.add("penultimate"); else labels.delete("penultimate");
  if (s.year === "masters") labels.add("masters");
  return labels;
}

export function formatWindow(w: { min: number; max: number }): string {
  return w.min === w.max ? String(w.min) : `${w.min}–${w.max}`;
}

/** The CV's degree grade for a class-floor check: the first education entry whose grade reads as a UK class. */
export function cvGradeOf(cv: { education?: { grade: string | null }[] } | null | undefined): string | null {
  const grades = (cv?.education ?? []).map((e) => e.grade).filter((g): g is string => Boolean(g));
  return grades.find((g) => cvDegreeClass(g) !== null) ?? null;
}
