import type { ParsedCV } from "@/lib/types";
import { KNOWN_EMPLOYERS, buildFactCorpus, toTailored, verifyTailoring } from "@/lib/verify/tailoring";
import { extractSkills } from "@/lib/skills/extract";

export const CONNECTION_NOTE_MAX = 300;

export type GuardSource = { cv: ParsedCV; cvText: string; facts: string[]; note: string | null; company: string; jobTitle: string };
export type GuardIssue = { sentence: string; reason: string };

const NEGATION = /^(?:never|not|no|without|\w+n't|\w+n’t)$/i;

/**
 * Claims about the recipient or a shared contact. Allowed only when the student's own note says the same thing
 * (and does not negate it). `noteFor` narrows the note keyword to the one the claim actually uses.
 */
const RECIPIENT_CLAIMS: { reason: string; re: RegExp; noteFor: (m: RegExpMatchArray) => RegExp }[] = [
  { reason: "says you read or saw their work", re: /\bI(?:'ve| have)? (?:read|saw|seen|watched|loved|enjoyed) your\b/i, noteFor: () => /\b(?:read|saw|seen|watched|article|post|talk|podcast)\b/gi },
  { reason: "says you attended or heard their talk", re: /\bI(?:'ve| have)? (?:attended|heard|listened to|went to|spoke at|caught|joined) your\b/i, noteFor: () => /\b(?:attended|heard|listened|spoke|went|caught|joined|talk|panel|webinar|event)\b/gi },
  { reason: "says you have met", re: /\bwe (met|spoke|chatted|talked)\b|\bnice to meet you (?:at|during)\b/i, noteFor: (m) => new RegExp(`\\b${m[1] ?? "met"}\\b`, "gi") },
  { reason: "claims a mutual contact", re: /\bmutual (?:friend|connection|contact|acquaintance)s?\b|\bwe both know\b|\bwe(?:'re| are) both\b/i, noteFor: () => /\bmutual\b|\bboth\b/gi },
  { reason: "claims a referral", re: /\b(?:recommended|suggested|told me) (?:I|that I|to) (?:reach out|contact|get in touch|message)\b|\breferred (?:me|by)\b/i, noteFor: () => /\b(?:recommended|suggested|referred|told me)\b/gi },
  { reason: "claims a third party sent you", re: /\b[A-Z][a-z]{2,} (?:said|suggested|recommended|told me|mentioned|thought) (?:you|I|that)\b/, noteFor: () => /\b(?:said|suggested|recommended|referred|told|mentioned)\b/gi },
  { reason: "says you follow their work", re: /\b(?:been )?(?:following|followed) your (?:work|career|posts?|journey)\b/i, noteFor: () => /\bfollow/gi },
];

/** Titles, grades, awards, credentials: blocked unless the same phrase is on the CV. */
const LEXICON: { reason: string; re: RegExp }[] = [
  { reason: "a title", re: /\b(?:Vice[- ]President|President|Head of|Chair(?:man|person)?|Captain|Co-?founder|Founder|Director|Lead(?:er)? of|Treasurer|Secretary)\b/gi },
  { reason: "a grade or honour", re: /\bfirst[- ]class\b|\ba First\b|\bpredicted (?:a )?first\b|\bDistinction\b|\bdean['’]s list\b|\bGPA\b|\bsumma\b|\bmagna\b/gi },
  { reason: "an award", re: /\b(?:prize|award|scholarship|bursary|fellowship|winner|won)\b/gi },
  { reason: "work history", re: /\binterned\b|\b(?:my|previous|prior|past|did an?) internships?\b/gi },
  { reason: "a credential", re: /\b(?:CFA|ACCA|ACA|CIMA|FRM|MSc|MBA|PhD)\b|\b(?:certified|certification)\b|\bMaster['’]s\b/g },
];
const LANGUAGE = /\b(?:fluent in|fluent|native|speak|speaking|proficient in)\s+([A-Z][a-z]+(?:(?:,|\s+and|,\s*and)\s+[A-Z][a-z]+)*)/g;

/** Words that make a sentence about work at an employer. */
const WORK_WORD = /\b(?:interned|intern|internship|worked|work(?:ing)? at|joined|offered|placement|spring week|insight week|employee|analyst at)\b/i;
/** Before the company, these mean the student is applying or curious, not claiming to have worked there. */
const APPLYING = /\b(?:appl(?:y|ying|ied|ication)|interested in|learn(?:ing)?(?: more)? about|love to|excited (?:about|by)|keen)\b/i;

const sentences = (t: string) => t.match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wholeWord = (needle: string, flags = "i") => new RegExp(`(?<![A-Za-z0-9])${esc(needle)}(?![A-Za-z0-9])`, flags);
const NUMBER = /£?\$?€?\d[\d,]*(?:\.\d+)?%?/g;
const normNum = (n: string) => n.replace(/[£$€,%]/g, "");
/** "15 minutes", "20-minute": a time ask, not a claim about the student. */
const TIME_ASK = /\b\d{1,2}[- ]?(?:min(?:ute)?s?)\b/gi;
/** "two quick questions", "one or two pointers", "a chat": an ask, not a metric about the student. */
const ASK_AFTER = /^\s+(?:[A-Za-z]+\s+){0,2}?(?:questions?|pointers?|minutes?|mins?|call|chat)\b/i;

/** Every sentence of `text` that contains `claim` as a whole word; falls back to sentences sharing a token with it. */
function attribute(text: string, claim: string): string[] {
  const ss = sentences(text);
  const direct = ss.filter((s) => wholeWord(claim).test(s));
  if (direct.length) return direct;
  const toks = claim.split(/\W+/).filter((t) => t.length > 1);
  const partial = ss.filter((s) => toks.some((t) => wholeWord(t).test(s)));
  return partial.length ? partial : ss.slice(0, 1);
}

/** Keyword matches in the note that are not negated within the three words before them. */
function noteBacks(note: string | null, re: RegExp): boolean {
  if (!note) return false;
  for (const m of note.matchAll(re)) {
    const before = note.slice(0, m.index!).split(/\s+/).filter(Boolean).slice(-3);
    if (!before.some((w) => NEGATION.test(w.replace(/[^A-Za-z'’]/g, "")))) return true;
  }
  return false;
}

export function checkOutreach(text: string, s: GuardSource): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const add = (sentence: string, reason: string) => issues.push({ sentence, reason });
  const corpus = buildFactCorpus(s.cv, s.cvText, s.facts);
  const ss = sentences(text);
  const known = KNOWN_EMPLOYERS.find((k) => [k.name, ...(k.aliases ?? [])].some((n) => n.toLowerCase() === s.company.toLowerCase()));
  const companyNames = [s.company, ...(known ? [known.name, ...(known.aliases ?? [])] : [])].filter(Boolean);
  const isCompany = (c: string) => companyNames.some((n) => n.toLowerCase() === c.toLowerCase());
  const inContext = (name: string) => `${s.company}\n${s.jobTitle}`.toLowerCase().includes(name.toLowerCase());

  // 1. verifyTailoring with the message as the summary. Fact source is CV + confirmed facts only: the note is NOT
  //    a fact source, so "I'm a Goldman Sachs intern" in a note can't launder that claim.
  const stripped = text.replace(TIME_ASK, " ");
  const report = verifyTailoring({
    source: s.cv, sourceText: s.cvText, confirmedFacts: s.facts, tailored: { ...toTailored(s.cv), summary: stripped },
    jdKeywords: [], coverageBefore: null, coverageAfter: null,
  });
  for (const i of report.issues) {
    if (i.entryId !== "summary") continue;
    const promoted = i.check === "newAchievement"; // warn on a CV bullet, but in a message a new achievement is a fabrication
    if (i.severity !== "block" && !promoted) continue;
    // Excluded: untagged unsupportedFacts is the capitalised-word detector; it flags greetings, the recipient's name, "Could", "I'm".
    if (i.type === "unsupportedFacts" && !i.check) continue;
    // Excluded: untagged digit inventedMetrics; our own number check (below) covers digits without CV-specific context.
    if (i.type === "inventedMetrics" && !i.check) continue;
    // Excluded: the target firm named as a firm is not a claim; employment claims about it are caught in check 5.
    if (i.check === "knownEmployer" && isCompany(i.claim)) continue;
    // Excluded: "two quick questions" / "one or two pointers" are asks, not metrics about the student.
    if (i.check === "wordMetrics") {
      const at = stripped.toLowerCase().indexOf(i.claim.toLowerCase());
      if (at >= 0 && ASK_AFTER.test(stripped.slice(at + i.claim.length))) continue;
    }
    for (const sen of attribute(text, i.claim)) add(sen, i.reason);
  }

  // 2. Skills not on the CV. A skill in the job title is what the student wants, not what they have.
  const cvSkills = new Set(extractSkills(corpus));
  for (const sen of ss) for (const sk of extractSkills(sen)) if (!cvSkills.has(sk)) add(sen, `${sk} is not on your CV`);

  // 3. Numbers not on the CV or the job title. The note never backs a number: it may only back recipient context.
  const knownNums = new Set([...`${corpus}\n${s.jobTitle}`.matchAll(NUMBER)].map((m) => normNum(m[0])));
  for (const sen of ss) for (const m of sen.replace(TIME_ASK, " ").matchAll(NUMBER)) {
    if (!knownNums.has(normNum(m[0]))) add(sen, `${m[0]} is not on your CV`);
  }

  // 4. Named employers the CV never mentions, other than the firm being written to.
  const lowerCorpus = corpus.toLowerCase();
  for (const k of KNOWN_EMPLOYERS) {
    for (const name of [k.name, ...(k.aliases ?? [])]) {
      if (lowerCorpus.includes(name.toLowerCase()) || inContext(name) || isCompany(name)) continue;
      for (const sen of ss) if (wholeWord(name, k.caseSensitive ? "" : "i").test(sen)) add(sen, `${k.name} is not on your CV`);
    }
  }

  // 5. Employment claims about the target firm ("I interned at Lendable"): naming it is fine, claiming to have worked there is not.
  for (const sen of ss) {
    if (!/\bI\b|\bI['’]|\bmy\b/i.test(sen)) continue;
    for (const name of companyNames) {
      for (const m of sen.matchAll(wholeWord(name, "gi"))) {
        const words = sen.split(/(\s+)/);
        let pos = 0, idx = 0;
        for (let w = 0; w < words.length; w++) { if (pos + words[w].length > m.index!) { idx = w; break; } pos += words[w].length; }
        const win = words.slice(Math.max(0, idx - 10), idx + 10).join("");
        const wordsBefore = sen.slice(0, m.index!).split(/\s+/).filter(Boolean);
        const near = (re: RegExp, str: string) => re.test(str);
        const before = wordsBefore.slice(-5).join(" ");
        const after = sen.slice(m.index! + m[0].length).split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
        if (!near(WORK_WORD, `${before} ${after}`)) continue;
        if (APPLYING.test(wordsBefore.slice(-7).join(" ")) && !/\b(?:interned|worked|joined|offered)\b/i.test(win)) continue;
        add(sen, `says you worked at ${s.company}, which your CV doesn't`);
      }
    }
  }

  // 6. Titles, grades, awards, credentials, languages not on the CV.
  for (const sen of ss) {
    for (const { reason, re } of LEXICON) for (const m of sen.matchAll(re)) {
      if (!wholeWord(m[0]).test(corpus)) add(sen, `${m[0]} (${reason}) is not on your CV`);
    }
    for (const m of sen.matchAll(LANGUAGE)) for (const lang of m[1].split(/,|\band\b/).map((l) => l.trim()).filter(Boolean)) {
      if (!wholeWord(lang).test(corpus)) add(sen, `${lang} is not a language on your CV`);
    }
  }

  // 7. Claims about the recipient, unless the student's note backs them (and does not negate them).
  for (const c of RECIPIENT_CLAIMS) {
    for (const sen of ss) for (const m of sen.matchAll(new RegExp(c.re.source, c.re.flags.includes("g") ? c.re.flags : `${c.re.flags}g`))) {
      if (!noteBacks(s.note, c.noteFor(m))) add(sen, `${c.reason}, and your note doesn't say so`);
    }
  }

  const seen = new Set<string>();
  return issues.filter((i) => { const k = `${i.sentence}|${i.reason}`; return seen.has(k) ? false : (seen.add(k), true); });
}

export function removeSentences(text: string, drop: string[]): string {
  const bad = new Set(drop.map((d) => d.trim()));
  return sentences(text).filter((s) => !bad.has(s)).join(" ").replace(/\s+/g, " ").trim();
}

/** At most `max` characters, cut at the last sentence end that fits; a single overlong sentence is cut at a word. */
export function fitToLimit(text: string, max = CONNECTION_NOTE_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  let out = "";
  for (const s of sentences(t)) { const next = out ? `${out} ${s}` : s; if (next.length > max) break; out = next; }
  if (out) return out;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`;
}
