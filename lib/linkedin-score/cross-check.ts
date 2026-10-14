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

const months = (p: Ym) => p.year * 12 + (p.month ?? 1);
/** Months apart; both month-less (year-only) dates compare on the year alone. */
function apart(a: Ym, b: Ym): number {
  if (a.month == null || b.month == null) return a.year === b.year ? 0 : 12;
  return Math.abs(months(a) - months(b));
}

export function crossCheckDates(cv: ParsedCV, li: LiExperience[]): Mismatch[] {
  const cvEntries = [...cv.experience, ...cv.leadership];
  const out: Mismatch[] = [];
  for (const e of li) {
    if (!e.start || !DATE_LINE_RE.test(e.dates)) continue;
    // Several CV roles at one organisation: it's a contradiction only if NONE of them agrees with this LinkedIn role.
    const candidates = cvEntries.filter((c) => sameOrg(c.org, e.company)).map((c) => ({ c, range: cvRange(c.dates) })).filter((x) => x.range[0]);
    if (!candidates.length) continue;
    const agrees = candidates.some(({ range: [cs, ce] }) => {
      if (apart(cs!, e.start!) > 1) return false;
      if (ce === undefined) return true;
      if ((ce === null) !== (e.end === null)) return false;
      return !ce || !e.end || apart(ce, e.end) <= 1;
    });
    if (!agrees) out.push({ company: e.company, cv: candidates[0].c.dates, linkedin: e.dates, evidenceLine: e.dates });
  }
  return out;
}
