import type { ParsedCV } from "@/lib/types";
import { KNOWN_EMPLOYERS, buildFactCorpus, toTailored, verifyTailoring } from "@/lib/verify/tailoring";
import { extractSkills } from "@/lib/skills/extract";

export const CONNECTION_NOTE_MAX = 300;

/** `allowInterviewClaim`: the interview_prep purpose may say "I have an interview at {company}"; every other purpose may not. */
export type GuardSource = { cv: ParsedCV; cvText: string; facts: string[]; note: string | null; company: string; jobTitle: string; allowInterviewClaim?: boolean };
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

/**
 * Titles, grades, awards, credentials, activities: blocked unless the same phrase is on the CV. `key` (capture group 1, else the
 * whole match) is what must appear in the CV; `stem` matches it as a prefix so "tutor" backs "tutored".
 */
const LEXICON: { reason: string; re: RegExp; stem?: boolean }[] = [
  { reason: "a title", re: /\b(?:Vice[- ]President|President|Head of|Chair(?:man|person)?|Captain|Co-?founder|Founder|Director|Lead(?:er)? of|Treasurer|Secretary)\b/gi },
  { reason: "a grade or honour", re: /\bfirst[- ]class\b|\ba First\b|\bpredicted (?:a )?first\b|\bDistinction\b|\bdean['’]s list\b|\bGPA\b|\bsumma\b|\bmagna\b/gi },
  { reason: "an award", re: /\b(?:prize|award|scholarship|bursary|fellowship|winner|won(?!['’]t))\b/gi },
  { reason: "work history", re: /\binterned\b|\b(?:my|our) (?:internships?|placements?)\b(?! (?:applications?|search|hunt|plans?|options|goals)\b)|\b(?:previous|prior|past) internships? (?:at|with)\b|\bdid an? internship\b/gi },
  { reason: "a credential", re: /\b(?:CFA|ACCA|ACA|CIMA|FRM|MSc|MBA|PhD)\b|\b(?:certified|certification)\b|\bMaster['’]s\b/g },
  { reason: "a membership", re: /\bmember of (?:the )?([A-Z][\w&'’-]*(?:\s+[A-Z][\w&'’-]*)*)/g },
  { reason: "a ranking", re: /\btop of (?:my|the) (?:class|cohort|year)\b|\branked (?:first|top|\d+\w*)\b|\bbest in (?:my|the)\b/gi },
  { reason: "a school grade", re: /\bA\* in ((?:[A-Z][A-Za-z]*)(?: [A-Z][A-Za-z]*)*)|\bA\*|\bgrade [A-E]\b/g },
  { reason: "an activity", re: /\bI(?:['’]m|['’]ve| am| have)? (tutor|volunteer|mentor)(?:ed|ing|s)?\b/gi, stem: true },
];
const LANGUAGE = /\b(?:fluent in|fluent|native|speak|speaking|proficient in)\s+([A-Z][a-z]+(?:(?:,|\s+and|,\s*and)\s+[A-Z][a-z]+)*)/g;
const LANGUAGE_LOWER = /\b(?:fluent in|fluent|native|speak|speaking|proficient in)\s+(spanish|french|german|italian|portuguese|mandarin|cantonese|chinese|japanese|korean|arabic|hindi|urdu|russian|dutch|polish|greek|swedish|hebrew|persian|farsi|bengali|punjabi)\b/gi;

const FIRST_PERSON = /\bI\b|\bI['’]|\bmy\b|\bme\b|\bwe\b|\bwe['’]|\bour\b|\bus\b/gi;
const LANGUAGE_IS = /\b[Mm]y ([A-Z][a-z]+) is (?:fluent|native|conversational)\b/g;
const THIRD_PARTY = /\b(?:you|your|they|their|them|he|she|his|her)\b/i;
/** Intent or wish before a verb: "hoping to work at", "I'd love to": not a claim of having done it. */
const INTENT = /\b(?:hop(?:e|ing)|want(?:ed)?|wish|keen|love|like|aim|aspire|plan|would|interested in|to (?:work|intern|join))\b|['’]d\b/i;
/** First-person progress at the target firm: offers, rounds, interviews. */
const PROGRESS = /\boffer(?:ed)?\b|\b(?:first|second|third|final) round\b|\bassessment cent(?:re|er)\b|\bsuperday\b|\bpassed\b/i;
const INTERVIEW = /\binterview(?:ing|s|ed)?\b[^.!?]{0,30}\b(?:with|at)\b/i;

/** Words that make a sentence about work at an employer. */
const WORK_WORD = /\b(?:interned|intern|internship|worked|work(?:ing)? at|joined|rejoin(?:ed)?|my time at|offered|placement|spring week|insight week|employee|analyst at)\b/i;
/** A sentence that also says it happened: intent is then a cover for a real past claim, so the intent exemption does not apply. */
const PAST_MARKER = /\b(?:did so|last (?:summer|year)|in 20(?:0\d|1\d|2[0-6])|there before|again|return(?:ing)? to|rejoin(?:ed)?|come back|back to|my time at|after my (?:internship|placement)|where I|I did|was lucky enough)\b/i;
/** Experience wording anywhere in the sentence ("intern there"), used with PAST_MARKER when the work word is far from the firm's name. */
const EXPERIENCE = /\b(?:interned|intern there|worked|joined|work(?:ed)? there|spent)\b/i;
/** The recipient's phrasing that still puts the student at the firm. */
const AT_FIRM_SIGNAL = /\b(?:hosted me|took me on|had me|overlapped|spent (?:last )?(?:summer|year|[a-z]+ months?) at)\b/i;
/** Before the company, these mean the student is applying or curious, not claiming to have worked there. */
const APPLYING = /\b(?:appl(?:y|ying|ied|ication)|interested in|learn(?:ing)?(?: more)? about|love to|excited (?:about|by)|keen)\b/i;

/** Splits on . ! ? followed by space, but not inside "£1.5m", "U.C.L." or after "Mr."/"Dr."/"St.". */
function sentences(t: string): string[] {
  const out: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\n") { flush(); continue; }
    cur += c;
    if (!/[.!?]/.test(c)) continue;
    const next = t[i + 1];
    if (next !== undefined && !/[\s"'”’)\]]/.test(next)) continue;
    if (/[.!?]/.test(next ?? "")) continue;
    if (c === ".") {
      const tok = cur.slice(cur.search(/\S+$/));
      if (/^(?:Mr|Mrs|Ms|Dr|Prof|St)\.$/.test(tok) || /^(?:[A-Za-z]\.){2,}$/.test(tok)) continue;
    }
    flush();
  }
  flush();
  return out;
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wholeWord = (needle: string, flags = "i") => new RegExp(`(?<![A-Za-z0-9])${esc(needle)}(?![A-Za-z0-9])`, flags);
const NUMBER = /£?\$?€?\d[\d,]*(?:\.\d+)?%?/g;
const normNum = (n: string) => n.replace(/[£$€,%]/g, "");
/** "15 minutes", "20-minute": a time ask, not a claim about the student. */
const TIME_ASK = /\b\d{1,2}[- ]?(?:min(?:ute)?s?)\b/gi;
/** "two quick questions", "one or two pointers", "a chat": an ask, not a metric about the student. */
const ASK_AFTER = /^\s+(?:[A-Za-z]+\s+){0,2}?(?:questions?|pointers?|minutes?|mins?|call|chat)\b/i;

/**
 * Every sentence of `text` that the claim is about: contains it, or (for a skill) extracts to it, or shares a token with it.
 * Returns [] when none does: never blame an unrelated sentence (removeSentences would delete it); other checks cover the claim.
 */
function attribute(text: string, claim: string): string[] {
  const ss = sentences(text);
  const direct = ss.filter((s) => wholeWord(claim).test(s));
  if (direct.length) return direct;
  const viaSkill = ss.filter((s) => extractSkills(s).some((k) => k.toLowerCase() === claim.toLowerCase()));
  if (viaSkill.length) return viaSkill;
  const toks = claim.split(/\W+/).filter((t) => t.length > 3);
  return ss.filter((s) => toks.some((t) => wholeWord(t).test(s)));
}

/** True when `idx` in `sen` is the student's own claim: a first-person marker, and no other subject between it and the hit. */
function ownClaim(sen: string, idx: number, others: string[]): boolean {
  const marks = [...sen.matchAll(FIRST_PERSON)];
  if (!marks.length) return false;
  const before = marks.filter((m) => m.index! < idx).pop();
  if (!before) return true; // "As Head of Events …, I ran": the hit leads a first-person sentence
  const seg = sen.slice(before.index! + before[0].length, idx);
  return !THIRD_PARTY.test(seg) && !others.some((n) => wholeWord(n).test(seg));
}

/** False when the hit sits in a sentence about the recipient: "you" as the subject, with no first-person marker before it. */
function notAboutRecipient(sen: string, idx: number): boolean {
  const before = [...sen.matchAll(FIRST_PERSON)].filter((m) => m.index! < idx).pop();
  const seg = before ? sen.slice(before.index! + before[0].length, idx) : sen.slice(0, idx);
  return !THIRD_PARTY.test(seg);
}

/** The clause of `sen` before `idx`, cut at the last comma, semicolon, "but" or "and". */
const clauseBefore = (sen: string, idx: number) => sen.slice(0, idx).split(/[,;:]|\b(?:but|and)\b/).pop() ?? "";

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
    let sens = attribute(text, i.claim);
    if (promoted) {
      // Excluded: "won't" is not "won".
      if (new RegExp(`${esc(i.claim)}['’]t`, "i").test(stripped)) continue;
      // Excluded: "Lendable won an award" is about them, not a claim by the student.
      sens = sens.filter((sen) => { const at = sen.search(wholeWord(i.claim)); return at < 0 || ownClaim(sen, at, companyNames); });
    }
    // Excluded: ownership and title phrases ("promoted to Head of Credit") in a sentence about the recipient.
    if (i.type === "authorshipEscalation" || i.type === "forbiddenPhrases") sens = sens.filter((sen) => { const at = sen.search(wholeWord(i.claim)); return at < 0 || notAboutRecipient(sen, at); });
    for (const sen of sens) add(sen, i.reason);
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
  const firstPerson = (sen: string) => /\bI\b|\bI['’]|\bmy\b|\bme\b|\bwe\b|\bwe['’]|\bour\b|\bus\b/i.test(sen);
  // The job title names the role being applied for ("Credit Analyst Intern"); its words are not work claims.
  const titles = [...new Set([s.jobTitle, s.jobTitle.replace(/\s*\([^)]*\)/g, "").trim()])].filter(Boolean).sort((a, b) => b.length - a.length);
  const mask = (sen: string) => titles.reduce((acc, t) => acc.replace(new RegExp(esc(t), "gi"), (m) => " ".repeat(m.length)), sen);
  /** "you" is the subject and no first-person marker follows it. */
  const youOnly = (clause: string) => { const y = [...clause.matchAll(/\byou(?:r)?\b/gi)].pop(); return !!y && !/\bI\b|\bI['’]|\bwe\b/i.test(clause.slice(y.index! + y[0].length)); };
  for (const sen of ss) {
    if (!firstPerson(sen)) continue;
    const msen = mask(sen);
    const hasPast = PAST_MARKER.test(msen);
    for (const name of companyNames) {
      for (const m of msen.matchAll(wholeWord(name, "gi"))) {
        if (AT_FIRM_SIGNAL.test(msen)) { add(sen, `says you worked at ${s.company}, which your CV doesn't`); continue; }
        // A past marker plus experience wording, wherever it sits: "I wanted to join Lendable and was lucky enough to intern there in 2025".
        if (hasPast && EXPERIENCE.test(msen) && !youOnly(msen.slice(0, m.index!))) { add(sen, `says you worked at ${s.company}, which your CV doesn't`); continue; }
        const wordsBefore = msen.slice(0, m.index!).split(/\s+/).filter(Boolean);
        const before = wordsBefore.slice(-5).join(" ");
        const after = msen.slice(m.index! + m[0].length).split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
        const wb = before.match(WORK_WORD), wa = after.match(WORK_WORD);
        if (!wb && !wa) continue;
        // where the work word sits, to read the clause leading up to it
        const wordAt = wb ? msen.lastIndexOf(wb[0], m.index!) : msen.indexOf(wa![0], m.index!);
        const clause = clauseBefore(msen, wordAt < 0 ? m.index! : wordAt);
        // Excluded: intent ("hoping to work at", "I'd love to"), unless the sentence also says it happened.
        if (INTENT.test(clause) && !hasPast) continue;
        // Excluded: the recipient's history ("I saw you joined"): "you" with no first-person subject after it.
        if (youOnly(clause)) continue;
        // Excluded: applying for / curious about the firm (the whole clause up to the firm).
        if (APPLYING.test(clauseBefore(msen, m.index!)) && !hasPast &&!/\b(?:interned|worked|joined|offered)\b/i.test(`${before} ${after}`)) continue;
        add(sen, `says you worked at ${s.company}, which your CV doesn't`);
      }
    }
  }

  // 5b. Offers and progress at the target firm are claims the inbox, not this guard, can know. Interview claims pass only for interview_prep.
  for (const sen of ss) {
    if (!firstPerson(sen)) continue;
    const msen = mask(sen);
    const hasPast = PAST_MARKER.test(msen);
    const mentionsCompany = companyNames.some((n) => wholeWord(n).test(msen));
    const intent = (idx: number) => INTENT.test(clauseBefore(msen, idx)) && !hasPast;
    if (mentionsCompany) {
      for (const m of msen.matchAll(new RegExp(PROGRESS.source, "gi"))) if (!intent(m.index!)) add(sen, `claims progress at ${s.company}, and nothing you gave us says so`);
    }
    if (s.allowInterviewClaim) continue;
    const iv = msen.match(INTERVIEW);
    if (iv && mentionsCompany && !intent(iv.index!)) add(sen, `claims an interview at ${s.company}, and nothing you gave us says so`);
    else if (/\bI(?:['’]ve| have)\b[^.!?]{0,25}\binterview/i.test(msen)) add(sen, "claims an interview, and nothing you gave us says so");
  }

  // 6. Titles, grades, awards, credentials, languages not on the CV, in the student's own claims.
  for (const sen of ss) {
    for (const { reason, re, stem } of LEXICON) for (const m of sen.matchAll(re)) {
      if (!ownClaim(sen, m.index!, companyNames)) continue; // "Lendable won an award" is about them
      const key = m[1] ?? m[0];
      const found = stem ? new RegExp(esc(key), "i").test(corpus) : wholeWord(key).test(corpus);
      if (!found) add(sen, `${m[0]} (${reason}) is not on your CV`);
    }
    for (const re of [LANGUAGE, LANGUAGE_LOWER, LANGUAGE_IS]) for (const m of sen.matchAll(re)) for (const lang of m[1].split(/,|\band\b/).map((l) => l.trim()).filter(Boolean)) {
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
