// Pure matching and dedupe helpers for the Experience Bank. No DB imports.
import type { BankEntry } from "./types";

type EntryKey = { org: string; title: string; startYm: string | null; endYm: string | null };
type Range = { startYm: string | null; endYm: string | null };

const ORG_SUFFIXES = new Set(["ltd", "llp", "inc", "plc", "limited", "llc", "gmbh", "group"]);

export function normOrg(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !ORG_SUFFIXES.has(w))
    .join(" ");
}

function words(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2),
  );
}

function jaccard(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

export function titleOverlap(a: string, b: string): number {
  return jaccard(a, b);
}

export function bulletJaccard(a: string, b: string): number {
  return jaccard(a, b);
}

export function rangesOverlap(a: Range, b: Range): boolean {
  if (!a.startYm || !b.startYm) return false;
  const aEnd = a.endYm ?? "9999-12";
  const bEnd = b.endYm ?? "9999-12";
  return a.startYm <= bEnd && b.startYm <= aEnd;
}

export function sameEntry(a: EntryKey, b: EntryKey): boolean {
  const oa = normOrg(a.org);
  const ob = normOrg(b.org);
  if (!oa || !ob) return false;
  if (!(oa === ob || oa.includes(ob) || ob.includes(oa))) return false;
  return titleOverlap(a.title, b.title) >= 0.5 || rangesOverlap(a, b);
}

export function isDupBullet(text: string, existing: string[]): boolean {
  return existing.some((e) => bulletJaccard(text, e) >= 0.7);
}

export function matchEntry(c: EntryKey, bankEntries: BankEntry[]): BankEntry[] {
  return bankEntries.filter((e) => sameEntry(c, e));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SEASONS: Record<string, [number, number]> = { spring: [3, 5], summer: [6, 8], autumn: [9, 11], fall: [9, 11], winter: [12, 2] };

const pad = (n: number) => String(n).padStart(2, "0");

/** One point in time: "Jun 2024", "June 2024", "2023", "Summer 2024". Returns [startYm, endYm] of that point. */
function point(s: string): [string, string] | null {
  const y = s.match(/(?:19|20)\d{2}/);
  if (!y) return null;
  const year = Number(y[0]);
  const word = s.toLowerCase().match(/[a-z]+/)?.[0] ?? "";
  const mi = MONTHS.findIndex((m) => word.startsWith(m));
  if (mi >= 0) return [`${year}-${pad(mi + 1)}`, `${year}-${pad(mi + 1)}`];
  const season = SEASONS[word];
  if (season) return [`${year}-${pad(season[0])}`, `${season[1] < season[0] ? year + 1 : year}-${pad(season[1])}`];
  return [`${year}-01`, `${year}-12`];
}

export function parseYm(dates: string): { startYm: string | null; endYm: string | null } {
  const text = dates.replace(/\([^)]*\)/g, " ").trim();
  if (!text) return { startYm: null, endYm: null };
  const parts = text.split(/\s*[-–—]\s*|\s+to\s+/i);
  const start = point(parts[0]);
  if (!start) return { startYm: null, endYm: null };
  if (parts.length === 1) {
    // Single point: a season or month is a bounded span; a bare year is just a start.
    return { startYm: start[0], endYm: /^\s*\d{4}\s*$/.test(parts[0]) ? null : start[1] };
  }
  const last = parts[parts.length - 1].trim();
  if (/^(present|current|now)$/i.test(last)) return { startYm: start[0], endYm: null };
  const end = point(last);
  // Bare end year ("2022 - 2023") means the end of that year.
  return { startYm: start[0], endYm: end ? end[1] : null };
}
