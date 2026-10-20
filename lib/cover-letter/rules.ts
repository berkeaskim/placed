import rulesJson from "./rules.json";
import { namesCompany } from "./employers";
import type { Fact, Limit, LintHit, Mode, Span } from "./types";
import type { Track } from "@/lib/cv-rules/types";
import { trackLintHits } from "./track";

type HardEntry = { pattern: string; scope: "any" | "opening" | "close"; label: string };
type SoftEntry = { pattern: string; weight: number };
type Counters = {
  emDashMax: number;
  emDashFail: number;
  notOnlyButMax: number;
  notOnlyBut: string;
  tripletMax: number;
  triplet: string;
  softDistinctPer300: number;
  sentenceStdDevMin: number;
  shortSentenceMaxWords: number;
  sentenceMeanMax: number;
  sentenceMax: number;
  paragraphCvMin: number;
  paragraphMaxWords: number;
  iStartRatioMax: number;
};
type ModeBand = { words?: [number, number] | null; hardMax?: number; defaultWords?: number; fillRatio?: [number, number] };
type RulesFile = {
  modes: Record<string, ModeBand>;
  lexicon: { flags: string; hard: HardEntry[]; soft: SoftEntry[]; counters: Counters };
};

export const RULES = rulesJson as unknown as RulesFile;

export type LetterOpts = {
  mode: Mode;
  limit: Limit;
  company: string;
  role: string;
  otherEmployers: string[];
  ownSpans: Span[];
  /** Spring/placement lint (swap test, track clichés, why-placement anchor). Absent = standard: none of it runs. */
  track?: Track;
  rivals?: string[];
  pickedFacts?: Fact[];
};

type Region = { opening: boolean; close: boolean };
type RawHit = Omit<LintHit, "scope">;

// Hard labels that carry their own rule id and severity; everything else is CL-50 / block.
const HARD_OVERRIDES: Record<string, { ruleId: string; severity: LintHit["severity"] }> = {
  Placeholder: { ruleId: "CL-21", severity: "block" },
  "Chatbot leakage": { ruleId: "CL-21", severity: "block" },
  // 09 #18: Prospects and TARGETjobs still list "Dear Sir/Madam" (with "Yours faithfully"); a name or team reads warmer
  Salutation: { ruleId: "CL-42", severity: "med" },
  "Generic salutation": { ruleId: "CL-42", severity: "low" },
  // 09 #5: these fired on ordinary prose ("bonus-pool model", "tested three pricing models before deciding")
  "Consulting stepping-stone": { ruleId: "CL-70", severity: "med" },
  "Money as motivation": { ruleId: "CL-71", severity: "med" },
  "Deficit framing": { ruleId: "CL-35", severity: "med" },
};

const FLAGS = RULES.lexicon.flags + "g";
const HARD = RULES.lexicon.hard.map((h) => ({ ...h, re: new RegExp(h.pattern, FLAGS) }));
const SOFT = RULES.lexicon.soft.map((s) => ({ ...s, re: new RegExp(s.pattern, FLAGS) }));
const C = RULES.lexicon.counters;
const NOT_ONLY_BUT = new RegExp(C.notOnlyBut, FLAGS);
const TRIPLET = new RegExp(C.triplet, FLAGS);

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function countChars(text: string): number {
  return text.length;
}

/**
 * The words a letter's length is judged on, and the card's word chip shows: a full or short letter counts its body
 * (no salutation, sign-off or name); a field answer and a short note count all their text.
 */
export function letterWords(text: string, mode: Mode): number {
  if (mode !== "full_letter" && mode !== "short_letter") return countWords(text);
  return countWords(splitLetter(text).body.map((p) => p.text).join("\n\n"));
}

function matches(re: RegExp, text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0) continue;
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function lexiconHits(text: string, region: Region): RawHit[] {
  const hits: RawHit[] = [];
  for (const h of HARD) {
    if (h.scope === "opening" && !region.opening) continue;
    if (h.scope === "close" && !region.close) continue;
    const o = HARD_OVERRIDES[h.label] ?? { ruleId: "CL-50", severity: "block" as const };
    for (const m of matches(h.re, text)) hits.push({ ...o, label: h.label, ...m });
  }
  for (const s of SOFT) {
    for (const m of matches(s.re, text)) hits.push({ ruleId: "CL-51", severity: "med", label: "Soft AI-ism", ...m });
  }
  return hits;
}

function counterHits(text: string): RawHit[] {
  const hits: RawHit[] = [];
  // 09 #25: a spaced en dash and "--" are the same habit as an em dash; now a historical signal, so never a block
  const dashes = [...text.matchAll(/—| – |--/g)].map((m) => ({ at: m.index + (m[0] === " – " ? 1 : 0), len: m[0] === "--" ? 2 : 1 }));
  if (dashes.length > C.emDashMax) {
    const d = dashes[C.emDashMax];
    hits.push({
      ruleId: "CL-50",
      severity: dashes.length >= C.emDashFail ? "high" : "med",
      label: "Dash overuse",
      start: d.at,
      end: d.at + d.len,
    });
  }
  const nob = matches(NOT_ONLY_BUT, text);
  if (nob.length > C.notOnlyButMax) hits.push({ ruleId: "CL-50", severity: "high", label: "Not only... but pattern", ...nob[C.notOnlyButMax] });
  const trip = matches(TRIPLET, text);
  // 09 #24: phrase-level tricolons; a list of names or tools ("Python, SQL and Excel") is just a list
  const phrasal = trip.filter((m) => {
    const parts = text.slice(m.start, m.end).split(/,\s*|\s+(?:and|or)\s+/).map((x) => x.trim()).filter(Boolean);
    const middle = parts[parts.length - 2] ?? "";
    return !/^[A-Z0-9][\w+#.&-]*$/.test(middle); // "Python, SQL and Excel": the middle item is one name
  });
  if (phrasal.length > C.tripletMax) hits.push({ ruleId: "CL-51", severity: "low", label: "Repeated triplet list", ...phrasal[C.tripletMax] });
  return hits;
}

function withScope(hits: RawHit[], ownSpans: Span[]): LintHit[] {
  return hits
    .map((h) => {
      const span = ownSpans.find((s) => h.start >= s.start && h.start < s.end);
      return { ...h, scope: span ? span.kind : ("ai" as const) };
    })
    .sort((a, b) => a.start - b.start);
}

/** Lexicon (hard + soft) and paragraph-scope counters. A standalone paragraph is treated as both opening and close. */
export function lintParagraph(text: string): LintHit[] {
  return withScope([...lexiconHits(text, { opening: true, close: true }), ...counterHits(text)], []);
}

/** `lintParagraph`, with each hit's scope taken from the span that contains it (default "ai"). */
export function lintParagraphScoped(text: string, ownSpans: Span[]): LintHit[] {
  return withScope([...lexiconHits(text, { opening: true, close: true }), ...counterHits(text)], ownSpans);
}

// ---------------------------------------------------------------- structure

type Para = { start: number; end: number; text: string };

const SALUTATION_LINE = /^(dear|hi|hello)\b[^\n]*$/i;
const SIGNOFF_LINE = /^(yours (sincerely|faithfully)|kind regards|best wishes|best regards|regards|sincerely|many thanks|best)\b[,.]?[ \t]*$/gim;

type Structure = { salutation: Para | null; body: Para[]; signOff: Para | null };

function splitLetter(text: string): Structure {
  let from = 0;
  let to = text.length;
  let salutation: Para | null = null;
  let signOff: Para | null = null;

  const lead = text.length - text.trimStart().length;
  const firstLineEnd = text.indexOf("\n", lead) === -1 ? text.length : text.indexOf("\n", lead);
  const firstLine = text.slice(lead, firstLineEnd).trimEnd();
  if (SALUTATION_LINE.test(firstLine) && countWords(firstLine) <= 8) {
    salutation = { start: lead, end: lead + firstLine.length, text: firstLine };
    from = firstLineEnd;
  }

  let lastAt = -1;
  for (const m of text.matchAll(SIGNOFF_LINE)) if (m.index >= from) lastAt = m.index;
  if (lastAt >= 0) {
    to = lastAt;
    signOff = { start: lastAt, end: text.length, text: text.slice(lastAt) };
  }

  const body: Para[] = [];
  const region = text.slice(from, to);
  for (const m of region.matchAll(/\S[\s\S]*?(?=\n[ \t]*\n|$)/g)) {
    const t = m[0].trimEnd();
    body.push({ start: from + m.index, end: from + m.index + t.length, text: t });
  }
  return { salutation, body, signOff };
}

function sentenceSpans(text: string): { start: number; end: number }[] {
  // Mask dots that do not end a sentence (abbreviations, decimals) without changing offsets.
  const masked = text
    .replace(/\b(?:Mr|Mrs|Ms|Mx|Dr|Prof|St|No|vs|e\.g|i\.e|etc)\./gi, (m) => m.replace(/\./g, "\u0001"))
    .replace(/(\d)\.(\d)/g, "$1\u0001$2");
  const out: { start: number; end: number }[] = [];
  let pos = 0;
  const push = (end: number) => {
    const slice = text.slice(pos, end);
    const lead = slice.length - slice.trimStart().length;
    const trimmed = slice.trim();
    if (trimmed) out.push({ start: pos + lead, end: pos + lead + trimmed.length });
  };
  for (const m of masked.matchAll(/[.!?]+["')”’]*(?=\s|$)/g)) {
    const end = m.index + m[0].length;
    push(end);
    pos = end;
  }
  push(text.length);
  return out;
}

function stats(nums: number[]) {
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
  return { mean, sd };
}

// ---------------------------------------------------------------- letter-level checks

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ROLE_NOUN = /\b(?:analyst|intern|internship|engineer|engineering|associate|consultant|developer|scientist|graduate|placement|insight|trainee|researcher|manager|apprentice|apprenticeship|programme|program|scheme|week)\b/i;
const ROLE_FILLER = new Set(["programme", "program", "scheme", "the", "a", "an", "of", "and", "in", "for", "role", "position", "opportunity", "job"]);

/**
 * The role's head noun phrase (audit 09#7): scraped titles like "2027 Summer Analyst Programme – Global Banking &
 * Markets – London" reduce to ["summer", "analyst"]. Divisions, offices, years and "Programme" are not required.
 */
export function roleHead(role: string): string[] {
  const segments = role.split(/\s[–—-]\s|\s*[|,()/]\s*/).map((x) => x.trim()).filter(Boolean);
  const seg = segments.find((x) => ROLE_NOUN.test(x)) ?? segments[0] ?? "";
  return norm(seg).split(/[^a-z0-9]+/).filter((w) => w && !ROLE_FILLER.has(w) && !/^(?:19|20)\d{2}$/.test(w));
}

/** Every head word appears, allowing word-form changes ("Engineer" ~ "Engineering", "Intern" ~ "Internship"). */
function roleNamed(text: string, role: string): boolean {
  const head = roleHead(role);
  if (!head.length) return true;
  const words = norm(text).split(/[^a-z0-9]+/).filter(Boolean);
  const has = (h: string) => words.some((w) => w === h || (Math.min(w.length, h.length) >= 4 && (w.startsWith(h) || h.startsWith(w))));
  const found = head.filter(has).length;
  return head.length > 4 ? found / head.length >= 0.6 : found === head.length;
}

function lengthHits(text: string, opts: LetterOpts): RawHit[] {
  const { mode, limit } = opts;
  if (mode === "skip") return [];
  const whole = { start: 0, end: text.length };
  const hits: RawHit[] = [];
  const measure = (unit: "words" | "chars", t: string) => (unit === "words" ? countWords(t) : countChars(t));
  const band = RULES.modes[mode];

  if (limit) {
    const used = measure(limit.unit, text);
    if (used > limit.max) hits.push({ ruleId: "CL-02", severity: "block", label: `Over the limit (${used}/${limit.max} ${limit.unit})`, ...whole });
  }
  if (mode === "field_answer") {
    const eff = limit ?? { unit: "words" as const, max: band.defaultWords ?? 300 };
    const used = measure(eff.unit, text);
    const [lo] = band.fillRatio ?? [0.85, 1];
    if (!limit && used > eff.max) hits.push({ ruleId: "CL-02", severity: "block", label: `Over the default limit (${used}/${eff.max} words)`, ...whole });
    // 09 #21: short is fine; "room for one more example" is advice, never an auto-repair
    if (used < Math.floor(lo * eff.max)) hits.push({ ruleId: "CL-03", severity: "low", label: `You have room for one more specific example (${used}/${eff.max} ${eff.unit})`, ...whole });
    return hits;
  }
  const words = letterWords(text, mode);
  if (band.hardMax && words > band.hardMax) hits.push({ ruleId: "CL-02", severity: "block", label: `Over the hard maximum (${words}/${band.hardMax} words)`, ...whole });
  if (band.words && (words < band.words[0] || words > band.words[1]) && !(band.hardMax && words > band.hardMax)) {
    hits.push({ ruleId: "CL-03", severity: "high", label: `Outside ${band.words[0]}-${band.words[1]} words (${words})`, ...whole });
  }
  return hits;
}

function furnitureHits(text: string, mode: Mode): RawHit[] {
  if (mode !== "field_answer" && mode !== "short_note") return [];
  const patterns: [RegExp, string][] = [
    [/(^|\n)[ \t]*dear\b/gi, "Salutation in a field answer or note"],
    [/\byours (sincerely|faithfully)\b/gi, "Formal sign-off in a field answer or note"],
    [/^[ \t]*\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}[ \t]*$/gim, "Date line in a field answer or note"],
  ];
  if (mode === "field_answer") patterns.push([/(^|\n)[ \t]*(kind regards|best wishes|best regards|regards)\b/gi, "Sign-off in a field answer"]);
  const hits: RawHit[] = [];
  for (const [re, label] of patterns) for (const m of matches(re, text)) hits.push({ ruleId: "CL-04", severity: "high", label, ...m });
  return hits;
}

function pairingHits(text: string, struct: Structure, mode: Mode): RawHit[] {
  if (mode !== "full_letter" && mode !== "short_letter") return [];
  const hits: RawHit[] = [];
  const whole = { start: 0, end: text.length };
  const sal = struct.salutation;
  if (!sal) hits.push({ ruleId: "CL-42", severity: "high", label: "Missing salutation", ...whole });
  else if (/^dear\s+(mr|mrs|ms|mx|dr|prof)\.\s/i.test(sal.text)) {
    hits.push({ ruleId: "CL-42", severity: "high", label: "Title followed by a full stop", start: sal.start, end: sal.end });
  }
  const so = struct.signOff;
  if (!so) hits.push({ ruleId: "CL-43", severity: "med", label: "Missing sign-off", ...whole });
  else {
    const first = so.text.split("\n", 1)[0].trim().toLowerCase();
    // 09 #19: "Dear Priya Patel" is a named recipient too
    const named = !!sal && (/^dear\s+(mr|mrs|ms|mx|dr|prof|professor)\b\.?\s+\S/i.test(sal.text)
      || (/^[Dd]ear\s+[A-Z][a-z]+(?:\s+[A-Z][\w'’-]+)+,?\s*$/.test(sal.text.trim()) && !/\b(?:Team|Manager|Recruitment|Recruiter|Committee|Panel|Department|Sir|Madam|Graduate|Hiring)\b/.test(sal.text)));
    if (/^sincerely\b/.test(first)) hits.push({ ruleId: "CL-43", severity: "med", label: "US-style sign-off", start: so.start, end: so.start + first.length });
    else if (named && /^yours faithfully/.test(first)) hits.push({ ruleId: "CL-43", severity: "med", label: "Named recipient needs 'Yours sincerely'", start: so.start, end: so.start + first.length });
  }
  return hits;
}

/** CL-20: letter-level (never scoped by ownSpans). */
function openingNameHits(text: string, struct: Structure, opts: LetterOpts): RawHit[] {
  const hits: RawHit[] = [];
  const whole = { start: 0, end: text.length };
  const first = struct.body[0];
  let firstText = first?.text ?? "";
  if (opts.mode === "field_answer") {
    const s = sentenceSpans(firstText)[0];
    firstText = s ? firstText.slice(s.start, s.end) : firstText;
  }
  // 09#7: any of the company's names counts. A form answer only needs the company (the field label usually names the
  // role and firm already), as a medium note; a letter needs the company and the role's head noun phrase.
  const field = opts.mode === "field_answer";
  if (opts.company.trim() && !namesCompany(firstText, opts.company)) {
    hits.push({ ruleId: "CL-20", severity: field ? "med" : "block", label: "Company not named in the opening", ...(first ?? whole) });
  }
  if (!field && opts.role.trim() && !roleNamed(firstText, opts.role)) {
    hits.push({ ruleId: "CL-20", severity: "block", label: "Role not named in the opening", ...(first ?? whole) });
  }
  return hits;
}

/** CL-21 other-employer names: position-scoped. */
function otherEmployerHits(text: string, opts: LetterOpts): RawHit[] {
  const hits: RawHit[] = [];
  const company = norm(opts.company);
  for (const name of opts.otherEmployers) {
    const n = norm(name);
    if (!n || (company && (company.includes(n) || n.includes(company)))) continue;
    const re = new RegExp(`(?<![\\w])${escapeRe(name.trim())}(?![\\w])`, "gi");
    // 09 #2: a name only counts written as a name (capital initial), so "next", "wise" or "three" in prose never fire
    for (const m of matches(re, text)) if (/^[A-Z0-9]/.test(text[m.start])) hits.push({ ruleId: "CL-21", severity: "block", label: `Another employer named: ${name}`, ...m });
  }
  return hits;
}

function rhythmHits(text: string, body: Para[], mode: Mode): RawHit[] {
  if (mode === "field_answer" || mode === "short_note") return [];
  const hits: RawHit[] = [];
  const sentences = body.flatMap((p) =>
    sentenceSpans(p.text).map((s) => ({ start: p.start + s.start, end: p.start + s.end, words: countWords(p.text.slice(s.start, s.end)), text: p.text.slice(s.start, s.end) })),
  );
  const whole = { start: body[0]?.start ?? 0, end: body.at(-1)?.end ?? text.length };

  if (sentences.length >= 3) {
    const lens = sentences.map((s) => s.words);
    const { mean, sd } = stats(lens);
    if (mean > C.sentenceMeanMax) hits.push({ ruleId: "CL-53", severity: "low", label: `Average sentence is ${Math.round(mean)} words`, ...whole });
    if (sentences.length >= 4 && sd < C.sentenceStdDevMin) hits.push({ ruleId: "CL-53", severity: "low", label: "Sentence lengths too even", ...whole });
    if (!lens.some((n) => n <= C.shortSentenceMaxWords)) hits.push({ ruleId: "CL-53", severity: "low", label: "No short sentence", ...whole });
    for (const s of sentences) if (s.words > C.sentenceMax) hits.push({ ruleId: "CL-53", severity: "low", label: `Sentence of ${s.words} words`, start: s.start, end: s.end });
  }

  const paraWords = body.map((p) => countWords(p.text));
  if (body.length >= 4) {
    const { mean, sd } = stats(paraWords);
    if (mean > 0 && sd / mean < C.paragraphCvMin) hits.push({ ruleId: "CL-54", severity: "low", label: "Paragraph lengths too even", ...whole });
  }
  body.forEach((p, i) => {
    if (paraWords[i] > C.paragraphMaxWords) hits.push({ ruleId: "CL-03", severity: "high", label: `Paragraph of ${paraWords[i]} words`, start: p.start, end: p.end });
  });

  const iStart = (t: string) => /^I(\b|')/.test(t.trim());
  if (sentences.length >= 4) {
    const ratio = sentences.filter((s) => iStart(s.text)).length / sentences.length;
    if (ratio > C.iStartRatioMax) hits.push({ ruleId: "CL-55", severity: "low", label: `${Math.round(ratio * 100)}% of sentences start with 'I'`, ...whole });
  }
  for (let i = 1; i < body.length; i++) {
    if (iStart(body[i - 1].text) && iStart(body[i].text)) hits.push({ ruleId: "CL-55", severity: "low", label: "Consecutive paragraphs start with 'I'", start: body[i].start, end: body[i].end });
  }
  const opening = body[0] && sentenceSpans(body[0].text)[0];
  if (body[0] && opening) {
    const s = body[0].text.slice(opening.start, opening.end);
    const m = /\bI (want|like)\b/i.exec(s);
    if (m) hits.push({ ruleId: "CL-55", severity: "low", label: "'I want' / 'I like' in the opening", start: body[0].start + opening.start + m.index, end: body[0].start + opening.start + m.index + m[0].length });
  }
  return hits;
}

/** Everything in `lintParagraph`, plus length, identity, structure and rhythm checks over the whole letter. */
export function lintLetter(text: string, opts: LetterOpts): LintHit[] {
  if (opts.mode === "skip") return [];
  const struct = splitLetter(text);
  const paras: { p: Para; region: Region }[] = [];
  if (struct.salutation) paras.push({ p: struct.salutation, region: { opening: false, close: false } });
  struct.body.forEach((p, i) => paras.push({ p, region: { opening: i === 0, close: i === struct.body.length - 1 } }));
  if (struct.signOff) paras.push({ p: struct.signOff, region: { opening: false, close: false } });
  if (!struct.salutation && !struct.signOff && struct.body.length === 0) paras.push({ p: { start: 0, end: text.length, text }, region: { opening: true, close: true } });

  const local: RawHit[] = [];
  for (const { p, region } of paras) {
    for (const h of [...lexiconHits(p.text, region), ...counterHits(p.text)]) local.push({ ...h, start: h.start + p.start, end: h.end + p.start });
  }
  local.push(...otherEmployerHits(text, opts));
  if (opts.track && opts.track !== "standard") {
    local.push(...trackLintHits(text, { track: opts.track, company: opts.company, role: opts.role, rivals: opts.rivals ?? [], pickedFacts: opts.pickedFacts ?? [] }));
  }
  const scoped = withScope(local, opts.ownSpans);

  const letterLevel: RawHit[] = [
    ...openingNameHits(text, struct, opts),
    ...lengthHits(text, opts),
    ...furnitureHits(text, opts.mode),
    ...pairingHits(text, struct, opts.mode),
    ...rhythmHits(text, struct.body, opts.mode),
  ];
  // Soft density: more than N distinct soft patterns per 300 words.
  const distinct = SOFT.filter((s) => matches(s.re, text).length > 0).length;
  const allowed = C.softDistinctPer300 * Math.max(1, countWords(text) / 300);
  if (distinct > allowed) letterLevel.push({ ruleId: "CL-51", severity: "med", label: `${distinct} distinct soft AI-isms`, start: 0, end: text.length });

  const letterHits: LintHit[] = letterLevel.map((h) => ({ ...h, scope: "letter" as const }));
  return [...scoped, ...letterHits];
}
