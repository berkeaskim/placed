import type { ParsedCV } from "@/lib/types";
import { KNOWN_EMPLOYERS, buildFactCorpus } from "@/lib/verify/tailoring";
import { extractSkills } from "@/lib/skills/extract";

export const CONNECTION_NOTE_MAX = 300;

export type GuardSource = { cv: ParsedCV; cvText: string; facts: string[]; note: string | null; company: string; jobTitle: string };
export type GuardIssue = { sentence: string; reason: string };

/** Claims about the recipient or a shared contact. Allowed only when the student's own note says the same thing. */
const RECIPIENT_CLAIMS: { reason: string; re: RegExp; note: RegExp }[] = [
  { reason: "says you read or saw their work", re: /\bI(?:'ve| have)? (?:read|saw|seen|watched|loved|enjoyed) your\b/i, note: /\b(?:read|saw|seen|watched|article|post|talk|podcast)\b/i },
  { reason: "says you have met", re: /\bwe (?:met|spoke|chatted|talked)\b|\bnice to meet you (?:at|during)\b/i, note: /\b(?:met|spoke|chatted|talked)\b/i },
  { reason: "claims a mutual contact", re: /\bmutual (?:friend|connection|contact|acquaintance)s?\b|\bwe both know\b/i, note: /\bmutual|both know\b/i },
  { reason: "claims a referral", re: /\b(?:recommended|suggested|told me) (?:I|that I|to) (?:reach out|contact|get in touch|message)\b|\breferred (?:me|by)\b/i, note: /\b(?:recommended|suggested|referred|told me)\b/i },
  { reason: "says you follow their work", re: /\b(?:been )?(?:following|followed) your (?:work|career|posts?|journey)\b/i, note: /\bfollow/i },
];

const sentences = (t: string) => t.match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
const sentenceWith = (t: string, needle: string) => sentences(t).find((s) => s.toLowerCase().includes(needle.toLowerCase())) ?? needle;
const NUMBER = /£?\$?€?\d[\d,]*(?:\.\d+)?%?/g;
const normNum = (n: string) => n.replace(/[£$€,%]/g, "");
/** "15 minutes", "20-minute": a time ask, not a claim about the student. */
const TIME_ASK = /\b\d{1,2}[- ]?(?:min(?:ute)?s?)\b/gi;

export function checkOutreach(text: string, s: GuardSource): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const allowedContext = `${s.company}\n${s.jobTitle}`.toLowerCase();
  const corpus = buildFactCorpus(s.cv, s.cvText, s.facts);

  // verifyTailoring is deliberately not used: its summary path reads capitalised words (greetings, the recipient's name,
  // "Could", the target firm) as unsupported CV facts, which are all false positives in a message. The note is never a
  // fact source for the student's own experience, so "I'm a Goldman Sachs intern" in a note can't launder that claim.

  // 1. Skills not on the CV.
  const cvSkills = new Set(extractSkills(corpus));
  const ctxSkills = new Set(extractSkills(allowedContext));
  for (const sk of extractSkills(text)) if (!cvSkills.has(sk) && !ctxSkills.has(sk)) issues.push({ sentence: sentenceWith(text, sk), reason: `${sk} is not on your CV` });

  // 2. Numbers not on the CV, the job title or the note (time asks excepted).
  const known = new Set([...`${corpus}\n${s.jobTitle}\n${s.note ?? ""}`.matchAll(NUMBER)].map((m) => normNum(m[0])));
  for (const m of text.replace(TIME_ASK, " ").matchAll(NUMBER)) {
    if (!known.has(normNum(m[0]))) issues.push({ sentence: sentenceWith(text, m[0]), reason: `${m[0]} is not on your CV` });
  }

  // 3. Named employers (Goldman Sachs, …) the CV never mentions, other than the firm being written to.
  const lowerCorpus = corpus.toLowerCase();
  for (const k of KNOWN_EMPLOYERS) {
    for (const name of [k.name, ...(k.aliases ?? [])]) {
      const re = new RegExp(`(?<![A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, k.caseSensitive ? "" : "i");
      if (re.test(text) && !lowerCorpus.includes(name.toLowerCase()) && !allowedContext.includes(name.toLowerCase())) {
        issues.push({ sentence: sentenceWith(text, name), reason: `${k.name} is not on your CV` });
      }
    }
  }

  // 4. Claims about the recipient, unless the student's note backs them.
  for (const c of RECIPIENT_CLAIMS) {
    const m = text.match(c.re);
    if (m && !(s.note && c.note.test(s.note))) issues.push({ sentence: sentenceWith(text, m[0]), reason: `${c.reason}, and your note doesn't say so` });
  }

  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(i.sentence) ? false : (seen.add(i.sentence), true)));
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
