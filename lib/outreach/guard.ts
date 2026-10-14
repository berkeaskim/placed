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
  { reason: "claims a referral", re: /\binvited me to\b|\bencouraged me to (?:apply|reach out|get in touch|contact|message|connect)\b/i, noteFor: () => /\b(?:invited|encouraged|referred|recommended|suggested)\b/gi },
  { reason: "claims a third party sent you", re: /\b[A-Z][a-z]{2,} (?:said|suggested|recommended|told me|mentioned|thought) (?:you|I|that)\b/, noteFor: () => /\b(?:said|suggested|recommended|referred|told|mentioned)\b/gi },
  { reason: "says you follow their work", re: /\b(?:been )?(?:following|followed) your (?:work|career|posts?|journey)\b/i, noteFor: () => /\bfollow/gi },
];

/**
 * Titles, grades, awards, credentials, activities: blocked unless the same phrase is on the CV. `key` (capture group 1, else the
 * whole match) is what must appear in the CV; `stem` matches it as a prefix so "tutor" backs "tutored".
 */
const LEXICON: { reason: string; re: RegExp; stem?: boolean }[] = [
  { reason: "a title", re: /\b(?:Vice[- ]President|President|Head of|Chair(?:man|person)?|Captain|Co-?founder|Founder|Director|Lead(?:er)? of|Treasurer|Secretary)\b/gi },
  { reason: "a title", re: /\bco-?found(?:ed|er|ing)\b|\bfounded\b|\b(?:set up|started) (?:a|the|my|our) (?:club|society|company|startup|start-up|business|charity|fund)\b|\b(?:[A-Z][\w&'’-]*\s+){0,6}[Cc]ommittee(?: member)?\b/g },
  { reason: "a grade or honour", re: /\bfirst[- ]class\b|\ba First\b|\bpredicted (?:a )?first\b|\bDistinction\b|\bdean['’]s list\b|\bGPA\b|\bsumma\b|\bmagna\b/gi },
  { reason: "an award", re: /\b(?:prize|award|scholarship|bursary|fellowship|winner|won(?!['’]t))\b/gi },
  { reason: "work history", re: /\binterned\b|\b(?:my|our) (?:internships?|placements?)\b(?! (?:applications?|search|hunt|plans?|options|goals)\b)|\b(?:previous|prior|past) internships? (?:at|with)\b|\bdid an? internship\b/gi },
  { reason: "a credential", re: /\b(?:CFA|ACCA|ACA|CIMA|FRM|MSc|MBA|PhD)\b|\b(?:certified|certification)\b|\bMaster['’]s\b/g },
  { reason: "a membership", re: /\bmember of (?:the )?([A-Z][\w&'’-]*(?:\s+[A-Z][\w&'’-]*)*)/g },
  { reason: "a ranking", re: /\btop of (?:my|the) (?:class|cohort|year)\b|\b(?:ranked|placed|came|finished) (?:first|second|third|fourth|fifth|top|\d+(?:st|nd|rd|th)?)\b|\bbest in (?:my|the)\b/gi },
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

/** A clause that also says it happened: intent is then a cover for a real past claim, so the intent frame does not apply. */
const PAST_MARKER = /\b(?:did so|last (?:summer|year)|in 20(?:0\d|1\d|2[0-6])|there before|again|return(?:ing)? to|rejoin(?:ed)?|come back|back to|my time at|after my (?:internship|placement)|where I|I did|was lucky enough)\b/i;
/** The recipient's phrasing that still puts the student at the firm. */
const AT_FIRM_SIGNAL = /\b(?:hosted me|took me on|had me|overlapped|spent (?:last )?(?:summer|year|[a-z]+ months?) at)\b/i;

/**
 * Check 5 is an allow-list: a first-person clause naming the target firm (written `QQCO` after masking) passes only in one of
 * these frames. Anything else ("I shadowed the team at Lendable", "I'm a contractor at Lendable") is a claimed connection.
 */
const CO = "QQCO";
const APPLY_FRAME = /\bappl(?:y|ying|ied|ications?)\s+(?:to|for|at|with)\b.*QQCO|\bmy application (?:to|for|at|with)\b.*QQCO/i;
/** Interest and intent; only without a past marker in the same clause ("I'd love to work at Lendable again" is a claim). */
const INTEREST_FRAME = /\b(?:interested in|(?:my |an? )?interest in|would (?:be|welcome)|['’]d (?:be|welcome)|thrilled|excited (?:to|about|by)|(?:good |great |strong |natural )?fit (?:for|with)|place to (?:start|begin|grow|learn)|(?:start|begin|build|launch) (?:my|a) career|contribute to|keen (?:to|on)|hop(?:e|es|ed|ing)(?: to)?|want(?:s|ed)? to|would love|would like|['’]d (?:love|like)|aim(?:ing)? to|aspir(?:e|es|ing)|drawn to|appeals? to (?:me|us)|why I['’]m applying|part of why|still (?:very )?interested|follow(?:ing|ed)?|read(?:ing)? about|impressed by|inspired by|admire)\b/i;
const LEARN_FRAME = /\b(?:learn(?:ing)? (?:more )?about|know(?:ing)? (?:more )?about|hear (?:about|how|what|more)|understand|curious|ask (?:you )?(?:about|a)|questions? about|what (?:it['’]s|it is) like|how you found|advice (?:on|about)|update on|timeline)\b/i;
/** How the student found the firm: "I first heard about Lendable", "after researching Lendable", "I saw Lendable's post". */
const DISCOVERY_FRAME = /\b(?:heard (?:about|of)|learn(?:ed|t) (?:about|of)|came across|found out about|discovered|research(?:ing|ed)?|read(?:ing)?|follow(?:ing|ed)?)\s+(?:[\w-]+\s+){0,2}?QQCO|\b(?:saw|seen|noticed|visited|checked|browsing|browsed) QQCO['’]s (?:[\w-]+ ){0,2}?(?:posts?|page|site|website|blog|advert|ad|listing|article|announcement|video|careers)\b|\b(?:use|used|using) QQCO['’]s (?:[\w-]+ )?(?:app|product|products|card|platform|service)\b/i;
/** The firm as a topic or a subject: "Lendable's credit work", "lenders like Lendable", "Lendable was named …". */
const TOPIC_FRAME = /QQCO['’]s (?:[\w-]+ ){0,2}(?:mission|work|team|approach|culture|programmes?|programs?|products?|customers|growth|roles?|internships?|scheme|process|values|business|platform|story|model|lending)\b|\b(?:a|the) (?:team|firm|company|lender|place) like QQCO|\b(?:like|such as) QQCO|QQCO (?:is|was|has|had|won|wins|launched|announced|raised|grew|hires|hired|recently|just|became|does|looks|seems|seemed|runs|offers|would|presented|spoke|visited|came|exhibited|hosted|posted|published|shared|stood out|stands out|appeals?|interests? me)\b/i;
/** Claims that no frame can cover: first-person work verbs, "my summer at", "worked there", "I'm on Lendable's scheme". */
const CLAIM_VETO = [
  AT_FIRM_SIGNAL,
  /\b(?:I|we)(?:['’](?:m|ve|d|re)| am| are| have| had| was| were)?\s+(?:(?:[a-z]+ly|already|also|just|still|once|been)\s+){0,2}(?:interned|interning|shadowed|shadowing|worked|work|working|helped|helping|completed|passed|joined|rejoined|contracted|freelanced|consulted|temped|spent)\b/i,
  /\b(?:my|our) (?:[\w-]+ )?(?:work|time|summer|year|stint|role|job|placement|internship|manager|colleagues?|office|desk|contract|shifts?|days?|weeks?|months?) (?:at|with|in|there)\b/i,
  /\b(?:interned|interning|worked|working|been|time|summer|stint|spent [\w ]{0,20}?)\s+there\b|\bdid so\b|\b(?:I|we) did\s*[.!?]?\s*$/i,
  /\b(?:did|done|completed|finished|attended|loved|enjoyed|(?:I['’]m|I am|we['’]re|we are)\s+(?:(?:[a-z]+ly|already|now|still)\s+)?(?:on|in|part of))\s+(?:[\w-]+\s+){0,2}QQCO/i,
];
/**
 * One sentence-wide veto for any sentence naming the firm, whatever frame it is in: the student as the object of something the
 * firm (or "you"/"they") did to them ("Lendable hired me", "whose team hosted me"), the student possessing a tie to it ("my first
 * employer", "after my spring week", "I was on Lendable's programme"), or going back to it. A "me" inside a request to the
 * recipient ("could you tell me", "let me know", "give me advice") is removed first, so asks still pass.
 */
const REQUEST_ME = /\b(?:tell|help|let|give|show|point|connect|send|introduce|put)\s+(?:me|us)\b/gi;
const DONE_TO_ME = /\b(?:hired|employed|trained|taught|hosted|onboarded|gave|offered|took|invited|selected|accepted|mentored|supervised|paid|sponsored)\s+(?:me|us)\b/gi;
const SUBJECT = /QQCO|\b(?:you|your|they|their|them|it|its|who|whose|which|I|my|we|our)\b/gi;
const TIE_VETO = [
  /\b(?:my|our) (?:first |second |previous |last |former |old )?(?:employer|manager|boss|team|internship|placement|spring week|insight (?:day|week|programme|program)|time|summer|stint)\b(?! (?:applications?|search|hunt|plans?|options|goals|in mind)\b)/i,
  /\b(?:after|during|from|since) (?:my|our) (?:[\w-]+ ){0,2}?(?:spring week|internship|placement|insight|programme|program|summer)\b/i,
  /\b(?:I|we)(?:['’](?:m|re)| am| are| was| were| have been| had been)\s+(?:(?:already|also|still|once)\s+)?(?:part of|on|in|at|with)\s+(?:[\w-]+\s+){0,2}?QQCO/i,
  /\b(?:return(?:ing|ed)?|com(?:e|ing) back|go(?:ing)? back|get(?:ting)? back|(?:be|being|been) back|rejoin(?:ing|ed)?)\s+(?:to\s+|at\s+)?(?:[\w-]+\s+){0,2}?QQCO|\brejoin/i,
];
function experienceVeto(t: string): boolean {
  const u = t.replace(REQUEST_ME, (m) => " ".repeat(m.length));
  if (TIE_VETO.some((re) => re.test(u))) return true;
  for (const m of u.matchAll(DONE_TO_ME)) {
    // The nearest subject before the verb: the firm, "you" or "they" did it to the student (not "my project gave me").
    const subj = [...u.slice(0, m.index!).matchAll(SUBJECT)].pop()?.[0].toLowerCase();
    if (subj && !["i", "my", "we", "our"].includes(subj)) return true;
  }
  return false;
}
/** Clause boundaries for check 5; the conjunction is kept so "…, where I worked" reads as about the firm. */
const CLAUSE_SPLIT = /(\s*[,;:–—]\s*|\s+-\s+|\s+(?:and|but|while|which|where|because|whereas)\s+)/i;
/** A later clause that points back at the firm: "and did so", "where I …", "worked there". */
const ANAPHOR = /\b(?:intern(?:ed|ing)?|work(?:ed|ing)?|been|time|summer|stint|spent [\w ]{0,20}?)\s+there\b|\bdid so\b|\b(?:I|we) did\s*[.!?]?\s*$|\bjoined them\b/i;
/** A bare noun phrase ("the culture at Lendable") continues the clause before it rather than making a claim. */
const VERBISH = /\b(?:I|we|me|us|my|our|\w+ed|\w+ing|is|are|was|were|am|be|been|have|has|had|do|does|did|work|works|intern|join|joins|help|helps|run|build|got|get|spent|went|took|made)\b/i;
/** No subject, starting with a verb: "Worked at Lendable last summer." */
const SUBJECTLESS = /^(?:[A-Z][a-z]+ed|Spent|Been|Currently|Previously|Recently|Formerly)\b/;

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
  // verifyTailoring's job-title detector backtracks quadratically over a long run of bare words; a comma every 40 words caps it
  // (real prose has punctuation long before that, so normal messages are unchanged).
  const bounded = stripped.replace(/(?:[A-Za-z][A-Za-z&]*[ \t]+){40}/g, (m) => `${m.trimEnd()}, `);
  const report = verifyTailoring({
    source: s.cv, sourceText: s.cvText, confirmedFacts: s.facts, tailored: { ...toTailored(s.cv), summary: bounded },
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

  // 5. The target firm in a first-person clause passes only in an allowed frame (applying, interest, questions, the firm as a
  //    topic, the recipient's history); any other connection to it ("I shadowed the team at Lendable") is blocked.
  const firstPerson = (sen: string) => /\bI\b|\bI['’]|\bmy\b|\bme\b|\bwe\b|\bwe['’]|\bour\b|\bus\b/i.test(sen);
  // The job title names the role being applied for ("Credit Analyst Intern"); its words are not work claims.
  const titles = [...new Set([s.jobTitle, s.jobTitle.replace(/\s*\([^)]*\)/g, "").trim()])].filter(Boolean).sort((a, b) => b.length - a.length);
  const mask = (sen: string) => titles.reduce((acc, t) => acc.replace(new RegExp(esc(t), "gi"), (m) => " ".repeat(m.length)), sen);
  /** "you" is the subject and no first-person marker follows it. */
  const youOnly = (clause: string) => { const y = [...clause.matchAll(/\byou(?:r)?\b/gi)].pop(); return !!y && !/\bI\b|\bI['’]|\bwe\b/i.test(clause.slice(y.index! + y[0].length)); };
  const byLength = [...companyNames].sort((a, b) => b.length - a.length);
  const tokenize = (sen: string) => byLength.reduce((acc, n) => acc.replace(wholeWord(n, "gi"), CO), mask(sen));
  const allowed = (c: string, question: boolean) => {
    if (CLAIM_VETO.some((re) => re.test(c))) return false;
    if (question || APPLY_FRAME.test(c) || LEARN_FRAME.test(c) || TOPIC_FRAME.test(c) || DISCOVERY_FRAME.test(c)) return true;
    if (INTEREST_FRAME.test(c) && !PAST_MARKER.test(c)) return true;
    if (s.allowInterviewClaim && /\binterview/i.test(c)) return true;
    const at = c.indexOf(CO);
    return youOnly(at < 0 ? c : c.slice(0, at));
  };
  for (const sen of ss) {
    if (!firstPerson(sen) && !SUBJECTLESS.test(sen)) continue;
    const t = tokenize(sen);
    if (!t.includes(CO)) continue;
    if (experienceVeto(t)) { add(sen, `says you have a connection to ${s.company} that your CV doesn't show`); continue; }
    const question = /\?\s*$/.test(sen);
    const parts = t.split(CLAUSE_SPLIT); // clause, delimiter, clause, …
    let seen = false, prev = "";
    for (let i = 0; i < parts.length; i += 2) {
      let c = parts[i];
      const lead = (/^\s*(which|where)\b/i.exec(c)?.[1] ?? parts[i - 1] ?? "").trim().toLowerCase();
      const names = c.includes(CO);
      if (!names && seen) {
        // "…, which is a leader in lending" reads as the firm's subject; "…, where I worked" and "and did so" are checked as claims.
        if ((lead === "which" || lead === "where") && firstPerson(c)) c = `${CO} ${c}`;
        else if (!ANAPHOR.test(c)) { prev = c; continue; }
      }
      if (names || seen) {
        const bareNoun = names && !!prev && !VERBISH.test(c.replace(CO, ""));
        if (!allowed(c, question) && !(bareNoun && allowed(`${prev} ${c}`, question))) {
          add(sen, `says you have a connection to ${s.company} that your CV doesn't show`);
          break;
        }
      }
      if (names) seen = true;
      prev = c;
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
