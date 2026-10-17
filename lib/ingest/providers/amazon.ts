import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// amazon.jobs public search.json (no key). Company seed: slug = region key ("uk"), e.g. { slug: uk, name: Amazon, ats: amazon, employer: amazon }.
// The list rows already carry the full text, so there is no detail call. The student-programmes facet value is
// "studentprograms" (not "student-programs"); recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

export const AMAZON_PAGE = 100;
export const AMAZON_MAX_PAGES = 20;
const COUNTRY: Record<string, string> = { uk: "GBR" };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

type AmRow = {
  id_icims?: string | number; title?: string; job_path?: string; normalized_location?: string | null;
  posted_date?: string | null; description?: string | null; basic_qualifications?: string | null; preferred_qualifications?: string | null;
};
type AmList = { hits?: number; jobs?: AmRow[] };

export function amazonSearchUrl(slug: string, offset: number, limit = AMAZON_PAGE): string {
  const country = COUNTRY[slug];
  if (!country) throw new Error(`no country mapped for slug "${slug}"`);
  return `https://www.amazon.jobs/en-gb/search.json?country=${country}&business_category%5B%5D=studentprograms&offset=${offset}&result_limit=${limit}&sort=recent`;
}

/** "October  7, 2026" (double space) -> "2026-10-07"; anything else -> null. */
function parsePosted(s: string | null | undefined): string | null {
  const m = /^\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*$/.exec(s ?? "");
  const mo = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

export function normalizeAmazon(item: unknown): RawJob | null {
  const r = item as AmRow | null;
  if (!r?.id_icims || !r.title || !r.job_path) return null;
  return {
    extId: String(r.id_icims),
    title: r.title,
    url: `https://www.amazon.jobs${r.job_path}`,
    location: r.normalized_location ?? "",
    remote: false,
    html: [r.description, r.basic_qualifications, r.preferred_qualifications].filter(Boolean).join("<br/>"),
    postedAt: parsePosted(r.posted_date),
    deadline: null,
  };
}

/** Pages the whole list. Fails the board (no false closures) unless the unique ids cover `hits` and `hits` held steady. */
export async function fetchAmazon(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const rows: AmRow[] = [];
  let hits = -1;
  for (let page = 0; ; page++) {
    if (page >= AMAZON_MAX_PAGES) throw new Error(`more than ${AMAZON_MAX_PAGES} pages`);
    const offset = page * AMAZON_PAGE;
    const json = (await getJson(amazonSearchUrl(slug, offset), fetchImpl, { method: "GET" }, sleep)) as AmList;
    if (typeof json?.hits !== "number" || !Array.isArray(json.jobs)) throw new Error("listing has no hits/jobs");
    if (hits >= 0 && json.hits !== hits) throw new Error(`hits changed mid-run (${hits} to ${json.hits}); partial list refused`);
    if (json.hits === 0) throw new Error("empty listing (hits 0); refusing to close the board");
    hits = json.hits;
    rows.push(...json.jobs);
    // The jobs.length === 0 break relies on the ids-vs-hits check below to reject a short list.
    if (offset + AMAZON_PAGE >= hits || json.jobs.length === 0) break;
  }
  const ids = new Set(rows.map((r) => (r.id_icims === undefined ? "" : String(r.id_icims))).filter(Boolean));
  if (ids.size < hits) throw new Error(`partial list: ${ids.size} unique of ${hits} postings`);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of rows) {
    if (!r.title || !keepTitle(r.title)) continue;
    const j = normalizeAmazon(r);
    if (j && !seen.has(j.extId)) { seen.add(j.extId); jobs.push(j); }
  }
  return { jobs, listed: rows.length };
}
