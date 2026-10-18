import type { ParsedCV } from "@/lib/types";
import type { LiExperience } from "@/lib/linkedin/parse-export";
import { DATE_LINE_RE } from "@/lib/linkedin/parse-export";

/**
 * Deterministic half of LI-GEN-01 (playbook §6: "the CV cross-check is our unique advantage"): find the same
 * employer on both documents and compare start/end dates. A gap of more than one month is a contradiction.
 * Titles, grades and metrics are left to the LLM (synonyms need judgement).
 */
export type Mismatch = { company: string; cv: string; linkedin: string; evidenceLine: string };

const STOP = new Set(["ltd", "limited", "plc", "llp", "inc", "group", "uk", "the", "and", "&", "co", "company", "international", "london"]);
const tokens = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9& ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));

/**
 * Same organisation when the shorter token set is contained in the longer and differs by at most one token
 * ("J.P. Morgan" vs "J.P. Morgan Chase & Co."). The one-token limit keeps "Google" ≠ "Google Developer Student Club":
 * a false match here would raise a critical contradiction.
 */
export function sameOrg(a: string, b: string): boolean {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const [s, l] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return (s.every((t) => l.has(t)) && l.size - new Set(s).size <= 1) || ta.join("") === tb.join("");
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
type Ym = { year: number; month: number | null };
function point(s: string): Ym | null {
  const y = s.match(/(19|20)\d{2}/);
  if (!y) return null;
  const m = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
  const num = s.match(/\b(0?[1-9]|1[0-2])\/(19|20)\d{2}\b/);
  return { year: Number(y[0]), month: m ? MONTHS.indexOf(m[1]) + 1 : num ? Number(num[1]) : null };
}
/** "Jun 2025 – Aug 2025", "06/2025 - Present", "Summer 2025" → [start, end|null(present)|undefined(unknown)]. */
export function cvRange(dates: string): [Ym | null, Ym | null | undefined] {
  const parts = dates.split(/\s*(?:[-–—]|\bto\b)\s*/i);
  const start = point(parts[0] ?? "");
  if (parts.length < 2) return [start, undefined];
  return [start, /present|current|now|ongoing/i.test(parts[1]) ? null : point(parts[1])];
}

/** Earliest / latest month a point could mean: a year-only date spans Jan-Dec, so it only contradicts when certain. */
const lo = (p: Ym) => p.year * 12 + (p.month ?? 1);
const hi = (p: Ym) => p.year * 12 + (p.month ?? 12);

/**
 * LinkedIn often splits one CV line into several roles (a promotion, two society terms) and groups them under one
 * company, so a LinkedIn role agrees with the CV when it sits INSIDE the CV's span for that organisation (±1 month).
 * Flagged only when (08 #1):
 *   (a) a LinkedIn role starts more than a month before the earliest CV date for that organisation;
 *   (b) the LATEST LinkedIn role there says Present while the CV says ended, or the reverse;
 *   (c) a LinkedIn role ends more than a month after every CV end date there (both ended).
 * Year-only dates ("2025", "Summer 2025") never contradict a month inside that year.
 */
export function crossCheckDates(cv: ParsedCV, li: LiExperience[]): Mismatch[] {
  const cvEntries = [...cv.experience, ...cv.leadership];
  const out: Mismatch[] = [];
  const dated = li.filter((e) => e.start && DATE_LINE_RE.test(e.dates));
  for (const e of dated) {
    const candidates = cvEntries.filter((c) => sameOrg(c.org, e.company)).map((c) => ({ c, range: cvRange(c.dates) })).filter((x) => x.range[0]);
    if (!candidates.length) continue;
    const cvStart = Math.min(...candidates.map((x) => lo(x.range[0]!)));
    const ends = candidates.map((x) => x.range[1]);
    const cvPresent = ends.some((x) => x === null);
    const cvUnknownEnd = !cvPresent && ends.some((x) => x === undefined);
    const cvEnd = cvPresent || cvUnknownEnd ? null : Math.max(...ends.map((x) => hi(x as Ym)));

    const siblings = dated.filter((o) => sameOrg(o.company, e.company));
    const latest = siblings.reduce((a, b) => (lo(b.start!) > lo(a.start!) ? b : a));
    const startsEarly = hi(e.start!) < cvStart - 1;
    const statusClash = e === latest && !cvUnknownEnd && (e.end === null) !== cvPresent;
    const endsLate = e.end !== null && cvEnd !== null && lo(e.end) > cvEnd + 1;
    if (startsEarly || statusClash || endsLate) out.push({ company: e.company, cv: candidates[0].c.dates, linkedin: e.dates, evidenceLine: e.dates });
  }
  return out;
}

/** Distinct organisations with a date contradiction (one mismatch alone never caps the score). */
export function mismatchedOrgs(m: Mismatch[]): number {
  const orgs: string[] = [];
  for (const x of m) if (!orgs.some((o) => sameOrg(o, x.company))) orgs.push(x.company);
  return orgs.length;
}
