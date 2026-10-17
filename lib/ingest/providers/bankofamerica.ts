import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// Bank of America students & graduates: one campusjobssearchservlet call returns every campus role worldwide (~440 KB, no detail call).
// Company seed: slug = country key ("uk"), e.g. { slug: uk, name: Bank of America, ats: bankofamerica, employer: bankofamerica }.
// The servlet has no country filter, so "UK at the source" means filtering `country` right here; the ingest location filter still applies.
// Rows carry a `primaryRecruiter` contact field: it is never read or stored. Recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

const BASE = "https://careers.bankofamerica.com";
const COUNTRY: Record<string, string> = { uk: "United Kingdom" };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type BoaRow = {
  jobRequisitionId?: string | number; postingTitle?: string; city?: string; country?: string; location?: string; jcrURL?: string;
  postedDate?: string | null; applyByDate?: string | null; jobDescriptionExternal?: string | null;
};
type BoaList = { totalMatches?: number; jobsList?: BoaRow[] };

export function bankOfAmericaUrl(slug: string): string {
  if (!COUNTRY[slug]) throw new Error(`no country mapped for slug "${slug}"`);
  return `${BASE}/services/campusjobssearchservlet?start=0&rows=500&search=getAllJobs`;
}

/** "Oct 22, 2026" -> "2026-10-22"; anything else -> null. */
function parseDeadline(s: string | null | undefined): string | null {
  const m = /^\s*([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})\s*$/.exec(s ?? "");
  const mo = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

/** "09/23/2026" (US order) -> "2026-09-23"; anything else -> null. */
function parsePosted(s: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(s ?? "");
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

export function normalizeBankOfAmerica(item: unknown): RawJob | null {
  const r = item as BoaRow | null;
  if (!r?.jobRequisitionId || !r.postingTitle || !r.jcrURL) return null;
  return {
    extId: String(r.jobRequisitionId),
    title: r.postingTitle,
    url: BASE + r.jcrURL,
    location: r.location || [r.city, r.country].filter(Boolean).join(", "),
    remote: false,
    html: r.jobDescriptionExternal || "",
    postedAt: parsePosted(r.postedDate),
    deadline: parseDeadline(r.applyByDate),
  };
}

/** One call. Fails the board (no false closures) unless the unique ids across the whole worldwide list cover `totalMatches`. */
export async function fetchBankOfAmerica(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const json = (await getJson(bankOfAmericaUrl(slug), fetchImpl, { method: "GET" }, sleep)) as BoaList;
  if (typeof json?.totalMatches !== "number" || !Array.isArray(json.jobsList)) throw new Error("listing has no totalMatches/jobsList");
  if (json.totalMatches === 0) throw new Error("empty listing (totalMatches 0); refusing to close the board");
  const ids = new Set(json.jobsList.map((r) => (r.jobRequisitionId === undefined ? "" : String(r.jobRequisitionId))).filter(Boolean));
  if (ids.size < json.totalMatches) throw new Error(`partial list: ${ids.size} unique of ${json.totalMatches} postings`);
  const country = COUNTRY[slug];
  const rows = json.jobsList.filter((r) => r.country === country);
  // A renamed country value or vanished UK rows in a non-empty worldwide list must not read as "every UK job closed".
  if (rows.length === 0) throw new Error(`no ${country} rows in a non-empty listing; refusing to close the board`);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of rows) {
    if (!r.postingTitle || !keepTitle(r.postingTitle)) continue;
    const j = normalizeBankOfAmerica(r);
    if (!j) throw new Error(`posting ${r.jobRequisitionId ?? "?"} has no jobRequisitionId/jcrURL; refusing to drop it silently`);
    if (!seen.has(j.extId)) { seen.add(j.extId); jobs.push(j); }
  }
  return { jobs, listed: rows.length };
}
