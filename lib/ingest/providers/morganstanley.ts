import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// Morgan Stanley students & graduates: one resultset.json call returns every opportunity worldwide (~1.2 MB, no paging, no detail call).
// Company seed: slug = country key ("uk"), e.g. { slug: uk, name: Morgan Stanley, ats: morganstanley, employer: morganstanley }.
// The API has no country filter parameter, so "UK at the source" means filtering `country` right here; the ingest location filter still applies.
// The Workday board ms/External carries no campus roles, so it stays as it is. Recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

const COUNTRY: Record<string, string> = { uk: "United Kingdom" };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type MsRow = {
  jobNumber?: string | number; jobTitle?: string; city?: string; country?: string; location?: string; url?: string;
  applicationDate?: string | null; jobHtmlDescription?: string | null; jobDescription?: string | null;
};
type MsList = { totalResults?: number; resultSet?: MsRow[] };

export function morganStanleyUrl(slug: string): string {
  if (!COUNTRY[slug]) throw new Error(`no country mapped for slug "${slug}"`);
  return "https://www.morganstanley.com/web/career_services/webapp/service/careerservice/resultset.json?&opportunity=sg&lang=EN&location=";
}

/** "Nov 27, 2026" -> "2026-11-27"; anything else -> null. */
function parseDeadline(s: string | null | undefined): string | null {
  const m = /^\s*([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})\s*$/.exec(s ?? "");
  const mo = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

export function normalizeMorganStanley(item: unknown): RawJob | null {
  const r = item as MsRow | null;
  if (!r?.jobNumber || !r.jobTitle || !r.url) return null;
  return {
    extId: String(r.jobNumber),
    title: r.jobTitle,
    url: r.url,
    location: r.location || [r.city, r.country].filter(Boolean).join(", "),
    remote: false,
    html: r.jobHtmlDescription || r.jobDescription || "",
    postedAt: null, // sortingDate tracks the deadline, not the posting
    deadline: parseDeadline(r.applicationDate),
  };
}

/** One call. Fails the board (no false closures) unless the unique ids across the whole worldwide list cover `totalResults`. */
export async function fetchMorganStanley(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const json = (await getJson(morganStanleyUrl(slug), fetchImpl, { method: "GET" }, sleep)) as MsList;
  if (typeof json?.totalResults !== "number" || !Array.isArray(json.resultSet)) throw new Error("listing has no totalResults/resultSet");
  if (json.totalResults === 0) throw new Error("empty listing (totalResults 0); refusing to close the board");
  const ids = new Set(json.resultSet.map((r) => (r.jobNumber === undefined ? "" : String(r.jobNumber))).filter(Boolean));
  if (ids.size < json.totalResults) throw new Error(`partial list: ${ids.size} unique of ${json.totalResults} postings`);
  const country = COUNTRY[slug];
  const rows = json.resultSet.filter((r) => r.country === country);
  // A renamed country value or vanished UK rows in a non-empty worldwide list must not read as "every UK job closed".
  if (rows.length === 0) throw new Error(`no ${country} rows in a non-empty listing; refusing to close the board`);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of rows) {
    if (!r.jobTitle || !keepTitle(r.jobTitle)) continue;
    const j = normalizeMorganStanley(r);
    if (!j) throw new Error(`opportunity ${r.jobNumber ?? "?"} has no jobNumber/url; refusing to drop it silently`);
    if (!seen.has(j.extId)) { seen.add(j.extId); jobs.push(j); }
  }
  return { jobs, listed: rows.length };
}
