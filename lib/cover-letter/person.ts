// Named people in the student's answers. A real name in a letter is a claim the student must stand behind, so the
// writer asks first; until then the draft says "a {company} associate" instead.

/** Capitalised words that start or fill a sentence, or name events, places and times: never a person. */
const NOT_NAMES = new Set((
  "the a an at in on of for to from by with and or but so my our your their his her its i we you they he she it this that these those " +
  "last next first one two when while after before during since then there here what why how dear hello hi thanks thank yes no " +
  "spring summer autumn winter insight insights day days week weeks evening morning open event events fair fairs careers career " +
  "graduate graduates networking webinar panel workshop office offices team teams programme program scheme internship analyst " +
  "associate director manager partner head desk floor london manchester edinburgh birmingham leeds glasgow bristol uk england " +
  "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september " +
  "october november december university college school society club linkedin zoom teams"
).split(" "));

const WORD = "\\p{Lu}\\p{Ll}+(?:[-'’]\\p{Lu}?\\p{Ll}+)?";
// Overlapping pairs: "Spring Sarah Khan" must still find "Sarah Khan".
const PAIR = new RegExp(`(?<![\\p{L}])(${WORD})(?=\\s+(${WORD})(?![\\p{L}]))`, "gu");

const lowerWords = (texts: string[]) => new Set(texts.join(" ").toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) ?? []);

/** Every capitalised two-word name in `text` (in order, once each) whose words are neither stock words nor in `avoid` (company, role, job post, CV names). */
export function findPersons(text: string, avoid: string[]): string[] {
  const known = lowerWords(avoid);
  const out: string[] = [];
  for (const m of text.matchAll(PAIR)) {
    const [a, b] = [m[1], m[2]];
    if ([a, b].some((w) => NOT_NAMES.has(w.toLowerCase()) || known.has(w.toLowerCase()))) continue;
    if (!out.includes(`${a} ${b}`)) out.push(`${a} ${b}`);
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wordRe = (w: string) => new RegExp(`(?<![\\p{L}])${escapeRe(w)}(?![\\p{L}])`, "gu");

/**
 * Replaces each masked name, then either half on its own, with "a {company} associate". A half that is also part of a
 * name in `keep` (confirmed) is left alone, so "Khan" in a confirmed "Sarah Khan" survives masking "James Khan".
 */
export function maskPersons(text: string, names: string[], company: string, keep: string[] = []): string {
  const stand = `a ${company} associate`;
  const kept = new Set(keep.flatMap((k) => k.split(" ")));
  let out = text;
  for (const name of names) out = out.replace(wordRe(name), stand);
  for (const name of names) for (const part of name.split(" ")) if (!kept.has(part)) out = out.replace(wordRe(part), stand);
  return out;
}
