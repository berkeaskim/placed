/**
 * Text detectors behind the LinkedIn code checks, kept separate so each has a fixture table of real phrasings
 * (tests/linkedin/detectors.test.ts; audit 2026-10-18 T2 / 08 #5, #6, #8, #16-#18, #30, #31, #14).
 */

/**
 * A stated grade. "Expected graduation", "average module size" and a bare "Predicted" are NOT grades (08 #8), and
 * neither is "First year". Covers UK classes, Master's Distinction/Merit, GPA/CGPA, IB points and percentage averages.
 */
export const GRADE_RE = new RegExp(
  [
    String.raw`\bFirst[- ]Class\b`,
    String.raw`\bFirst Honours\b`,
    String.raw`\b1st[- ]Class\b`,
    String.raw`\b(?:Grade|Classification|Result|Predicted|Expected|On track for|Achieved|Awarded)\s*:?\s*(?:a\s+)?(?:First|1st|2:1|2\.1|2:2|2\.2|Third|Distinction|Merit|Pass)\b`,
    String.raw`\((?:First|1st)\b[^)]*\)`,
    String.raw`(?<![\d.])2[:.][12](?![\d.])`,
    String.raw`\b(?:Upper|Lower) Second\b`,
    String.raw`\bThird[- ]Class\b`,
    String.raw`\bDistinction\b`,
    String.raw`\bMerit\b(?!\s+(?:scholarship|award|badge|list))`,
    String.raw`\b(?:C?GPA|Grade Point Average)\s*:?\s*[0-4]\.\d{1,2}\b`,
    String.raw`\bIB\b[^\n]{0,20}?\b[2-4]\d(?:\s*\/\s*45)?\b(?:\s*points)?`,
    String.raw`\b[2-4]\d\s*\/\s*45\b`,
    String.raw`(?<![\d.])\d{2}(?:\.\d)?\s?%`,
  ].join("|"),
  "i",
);

/**
 * LinkedIn headline segments: split on | and •. A middot (·) list and a slash ("APM / product", "A/B") stay inside one
 * segment: the playbook's own Good headlines use both (08 #5).
 */
export function headlineSegments(h: string): string[] {
  return h.split(/\s*\|\s*|\s*•\s*/).map((s) => s.trim()).filter(Boolean);
}
const HEADLINE_STOPWORDS = new Set(["and", "the", "for", "with", "student", "university", "@"]);
/** Terms (3+ letters, not stopwords) used 3 or more times in the headline. */
export function headlineRepeats(h: string): string[] {
  const words: string[] = h.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) if (!HEADLINE_STOPWORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= 3).map(([w]) => w);
}

const UK_PLACE_RE = /\b(United Kingdom|UK|U\.K\.|Great Britain|England|Scotland|Wales|Northern Ireland|London|Manchester|Birmingham|Leeds|Bristol|Edinburgh|Glasgow|Cambridge|Oxford|Liverpool|Nottingham|Sheffield|Newcastle|Cardiff|Swansea|Belfast|Derry|Coventry|Leicester|Southampton|Portsmouth|Brighton|Bath|York|Durham|Warwick|Reading|Exeter|Plymouth|Lancaster|St Andrews|Aberdeen|Dundee|Stirling|Surrey|Guildford|Canterbury|Norwich|Loughborough|Hatfield|Stoke-on-Trent|Keele|Hull|Bradford|Huddersfield|Salford|Milton Keynes|Luton|Colchester|Essex|Kent|Sussex|Hertfordshire|Berkshire|Oxfordshire|Cambridgeshire|Yorkshire|Lancashire|Cheshire|Devon|Cornwall|Middlesex|Greater Manchester|Wolverhampton|Sunderland|Middlesbrough|Bournemouth|Cheltenham|Gloucester|Worcester|Lincoln|Northampton|Ipswich|Chester)\b/i;
/** Signals the place is outside the UK even though a UK town name appears ("New York", "Cambridge, Massachusetts"). */
const NON_UK_RE = /\b(New York|New Hampshire|New South Wales|New England|United States|USA|U\.S\.|Massachusetts|Pennsylvania|North Carolina|Ontario|Canada|Australia|Ireland(?<!Northern Ireland)|India|Nigeria|Pakistan|China|Hong Kong|Singapore|Malaysia|Jamaica|Tasmania|Western Australia|Nova Scotia)\b/i;

/** True for a UK place. Non-UK and unrecognised places return false; callers treat that as not applicable, never a fail (08 #6, #31). */
export function isUkLocation(loc: string): boolean {
  if (/\bNorthern Ireland\b/i.test(loc)) return true;
  return UK_PLACE_RE.test(loc) && !NON_UK_RE.test(loc);
}

/**
 * LinkedIn's default public URL ends in a generated suffix such as "-1a2b3c4d" (letters AND digits) or a long number.
 * A 4-digit year ("jane-doe-2003") or a word+year ("-mba2027") is a choice the student made (08 #17).
 */
export function isDefaultSlug(slug: string): boolean {
  const s = slug.replace(/\/$/, "");
  const m = s.match(/-([0-9a-z]{6,12})$/i);
  if (m && /\d/.test(m[1]) && /[a-z]/i.test(m[1]) && !/^[a-z]{2,}(?:19|20)\d{2}$/i.test(m[1])) return true;
  return /-\d{6,}$/.test(s);
}

const COMP_WORDS_RE = /\b(olympiad|UKMT|IMO|BMO|Putnam|ICPC|UKIEPC|Codeforces|AtCoder|Kaggle|competition|contest|hackathon|(?:Mathematical|Maths|Math|Trading|Coding|Programming|Data|Quant|Case|Investment|Stock[- ]pitch|Kangaroo)\s+Challenge)\b/i;
/** STEP and MAT are the Cambridge/Oxford admissions papers: capitals only, next to a paper/grade/score (08 #16). */
const ADMISSIONS_PAPER_RE = /\b(?:STEP|MAT)\b(?=[^\n]*\b(?:paper|exam|grade|score|S|[1-3]|I{1,3}|\d{2,3})\b)/;
export function isCompetitionLine(l: string): boolean {
  return COMP_WORDS_RE.test(l) || ADMISSIONS_PAPER_RE.test(l);
}
/** A rank, medal, percentile or rating. A bare year is not a rank (08 #16), nor is "1st year". */
export const RANKED_RE = /(\btop \d+%?|\b\d+(?:st|nd|rd|th)\b(?![- ]?year)|\brank(?:ed)?\s*#?\d+|#\d+\b|\bmedal|\bgold\b|\bsilver\b|\bbronze\b|\bdistinction\b|\bmerit\b|\bhonourable mention|\bfinalist|\bwinner|\bwon\b|\brating\s*:?\s*\d{3,4}|\bpercentile|\bgrade\s*:?\s*(?:S|[1-3])\b|\bscore[d]?\s*:?\s*\d+|\b(?:Expert|Specialist|Candidate Master|Master|Grandmaster)\b)/i;

/**
 * A link a reader can open: a URL, a www. host, a path on a known portfolio host, or a personal-site domain.
 * The bare word "portfolio" and library names like "Socket.io" or "Chart.js" are not links (08 #18).
 */
export const PORTFOLIO_URL_RE = /https?:\/\/\S+|\bwww\.[\w-]+\.[a-z]{2,}\S*|\b(?:github\.com|gitlab\.com|devpost\.com|kaggle\.com|public\.tableau\.com|huggingface\.co|observablehq\.com|app\.powerbi\.com|behance\.net|dribbble\.com|orcid\.org|scholar\.google\.[a-z.]+|researchgate\.net)\/\S+|\b[\w-]+\.(?:github\.io|vercel\.app|netlify\.app|streamlit\.app|pages\.dev|dev)\b|\b[\w-]+\.(?:io|com|co\.uk|me|app|org)\/\S+/i;
/** Social profiles listed as a website don't show work. */
const SOCIAL_RE = /\b(twitter\.com|x\.com|instagram\.com|facebook\.com|tiktok\.com|threads\.net|snapchat\.com)\b/i;
/** True when a Contact website (any non-social URL the student listed) or a URL in the text points to their work. */
export function hasPortfolioLink(links: string[], text: string): boolean {
  if (links.some((l) => !SOCIAL_RE.test(l))) return true;
  return (text.match(new RegExp(PORTFOLIO_URL_RE.source, "gi")) ?? []).some((u) => !SOCIAL_RE.test(u));
}

/** R the language, not "R&D" or "R-squared" (08 #18): a skills item that is just "R", or R next to an R tool or another language. */
export function mentionsRLanguage(text: string, skills: string[]): boolean {
  if (skills.some((s) => /^R(?:\s*\(.*\))?$/i.test(s.trim()) || /^R programming$/i.test(s.trim()))) return true;
  return /\bR\s*(?:programming|Studio|Markdown|Shiny)\b|\b(?:tidyverse|ggplot2?|dplyr|RStudio|CRAN|data\.table)\b|(?:\b(?:in|using|with|and)|&)\s+R\b(?![&-])|\bR\b(?![&-])\s*(?:,|\/|and|&)\s*(?:Python|SQL|Stata|SPSS|MATLAB)\b|\(R\)/.test(text);
}

/**
 * Placeholder text left in the profile. TBD/TBC fail only as a whole field or in brackets: "Start date TBC" on an
 * accepted offer is legitimate (08 #30).
 */
export const PLACEHOLDER_RE = /\b(lorem ipsum|lorem)\b|\[(company|employer|role|title|insert[^\]]*|your [^\]]*|x+|tbd|tbc)\]|^\s*(TBD|TBC)\s*[.!]?\s*$/im;

/**
 * Investment promotion a student shouldn't run on a recruiting profile: affiliate/referral links, paid signals,
 * paid groups. These invite others in, so they are plausibly financial promotions (FCA FG24/1) and stay critical
 * (08 #14). Talking about a paper portfolio or "signal processing" is not.
 */
export const FINFLUENCER_PROMO_RE = /(\bt\.me\/|\bdiscord\.gg\/|\b(?:affiliate|referral|invite)\s+(?:link|code)\b|\buse my (?:code|link)\b|\b(?:trading|crypto|forex|fx|stock|options)\s+signals\b|\bDM (?:me )?for (?:signals|tips|picks|calls)\b|\bjoin my (?:paid |vip |private )?(?:group|community|discord|telegram|channel)\b|\b(?:VIP|paid) (?:signals|group|channel)\b|\bcopy my trades\b)/i;
