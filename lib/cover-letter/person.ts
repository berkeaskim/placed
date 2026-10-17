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
  "october november december university college school society club linkedin zoom teams " +
  "everyone everybody someone somebody anyone nobody people staff students analysts traders recruiters colleagues speakers " +
  "many most some all both each several others everything something nothing"
).split(" "));

const WORD = "\\p{Lu}\\p{Ll}+(?:[-'’]\\p{Lu}?\\p{Ll}+)?";
// Overlapping pairs: "Spring Sarah Khan" must still find "Sarah Khan".
const PAIR = new RegExp(`(?<![\\p{L}])(${WORD})(?=\\s+(${WORD})(?![\\p{L}]))`, "gu");

const lowerWords = (texts: string[]) => new Set(texts.join(" ").toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) ?? []);

const TITLE = "(?:Dr|Mr|Ms|Mrs|Mx|Prof)";
const TITLED = new RegExp(`(?<![\\p{L}])${TITLE}\\.?\\s+(${WORD})(?![\\p{L}])`, "gu");
// One capitalised word that names someone by what follows it: "Priya from the rates desk", "James at Northbridge", "Tom, who".
const SINGLE = new RegExp(`(?<![\\p{L}'’-])(${WORD})(?=\\s+(?:from|at|in|on\\s+the)\\b|,?\\s+who\\b)`, "gu");
const TITLE_WORD = new RegExp(`^${TITLE}\\.?$`);
/** A word starts a sentence: the text start, or after . ! ? (and any closing quote) or a blank line. */
const sentenceInitial = (text: string, at: number) => /(?:^|[.!?]["'’”)]*\s+|\n\s*)$/.test(text.slice(0, at));

/**
 * Every named person in `text` (in order, once each) whose words are neither stock words nor in `avoid` (company,
 * role, job post, CV names): capitalised two-word names, a surname after a title ("Dr. Patel"), and a single
 * capitalised word followed by from / at / in / on the / who. A sentence's first word counts only before from, at or
 * who, and not when it looks like a verb ("Working at…").
 */
export function findPersons(text: string, avoid: string[]): string[] {
  const known = lowerWords(avoid);
  const stock = (w: string) => NOT_NAMES.has(w.toLowerCase()) || known.has(w.toLowerCase());
  const found: { at: number; end: number; name: string }[] = [];
  const taken = (at: number, end: number) => found.some((f) => at < f.end && end > f.at);
  for (const m of text.matchAll(PAIR)) {
    const [a, b] = [m[1], m[2]];
    if (TITLE_WORD.test(a) || [a, b].some(stock)) continue;
    const end = text.indexOf(b, m.index + a.length) + b.length;
    if (!taken(m.index, end)) found.push({ at: m.index, end, name: `${a} ${b}` });
  }
  for (const m of text.matchAll(TITLED)) {
    if (stock(m[1]) || taken(m.index, m.index + m[0].length)) continue;
    found.push({ at: m.index, end: m.index + m[0].length, name: m[0] });
  }
  for (const m of text.matchAll(SINGLE)) {
    const w = m[1];
    const end = m.index + w.length;
    if (stock(w) || taken(m.index, end)) continue;
    if (sentenceInitial(text, m.index) && (/(?:ing|ed|ly)$/.test(w) || !/^,?\s+(?:from|at|who)\b/.test(text.slice(end)))) continue;
    found.push({ at: m.index, end, name: w });
  }
  const out: string[] = [];
  for (const f of found.sort((x, y) => x.at - y.at)) if (!out.includes(f.name)) out.push(f.name);
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
  // A title ("Dr.") is not a name of its own: masking it would hit every other "Dr." in the text.
  for (const name of names) for (const part of name.split(" ")) if (!kept.has(part) && !TITLE_WORD.test(part)) out = out.replace(wordRe(part), stand);
  return out;
}
