import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// Phenom People career sites (BCG: careers.bcg.com), public `refineSearch` widget, no key. Phenom is a platform used by more than one
// employer, so the tenant lives in the seed row:
//   apiHost = the careers host ("careers.bcg.com"), slug = "<siteType>/<pageId>" of the search-results page ("external/page11" for BCG).
//   e.g. { slug: external/page11, name: BCG, ats: phenom, apiHost: careers.bcg.com, employer: bcg }
// POST https://<apiHost>/widgets with ddoKey "refineSearch"; `selected_fields.country = ["United Kingdom"]` filters at the source, and
// `from`/`size` page against `totalHits`. Multi-location rows can have a non-UK primary `location`, so the UK entry of `multi_location` is used.
// The body's language/country are BCG's ("en_global"/"global"); another Phenom tenant needs them lifted into the slug. PwC's Phenom site
// uses the same API but is covered via Workday, so it is not seeded here. Most UK rows are experienced hires, so the title filter matters.
// The list only carries `descriptionTeaser` (a short summary); there is no per-posting call, so `html` is that teaser.
// Rows can carry a hiring-manager contact object: it is never read or stored. Recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

export const PHENOM_PAGE = 100;
export const PHENOM_MAX_PAGES = 20;
const UK = /united kingdom/i;

type PhRow = {
  jobId?: string | number; title?: string; location?: string | null; multi_location?: string[] | null;
  postedDate?: string | null; descriptionTeaser?: string | null;
};
type PhList = { refineSearch?: { totalHits?: number; data?: { jobs?: PhRow[] } } };

export const phenomUrl = (host: string): string => `https://${host}/widgets`;

export function phenomBody(slug: string, from: number, size = PHENOM_PAGE): string {
  const [siteType, pageId] = slug.split("/");
  if (!siteType || !pageId) throw new Error(`slug "${slug}" must be "<siteType>/<pageId>"`);
  return JSON.stringify({
    lang: "en_global", deviceType: "desktop", country: "global", pageName: "search-results", ddoKey: "refineSearch", sortBy: "", subsearch: "",
    from, jobs: true, counts: true, all_fields: ["category", "country", "city", "type"], size, clearAll: false, jdsource: "facets",
    isSliderEnable: false, pageId, siteType, keywords: "", global: true, selected_fields: { country: ["United Kingdom"] }, locationData: {},
  });
}

const ukLocation = (r: PhRow): string | null => [...(r.multi_location ?? []), r.location ?? ""].find((l) => UK.test(l)) ?? null;
const isoDay = (s: string | null | undefined): string | null => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

export function normalizePhenom(item: unknown, host: string): RawJob | null {
  const r = item as PhRow | null;
  if (!r?.jobId || !r.title) return null;
  return {
    extId: String(r.jobId),
    title: r.title,
    url: `https://${host}/global/en/job/${r.jobId}`,
    location: ukLocation(r) ?? r.location ?? "",
    remote: false,
    html: r.descriptionTeaser ?? "",
    postedAt: isoDay(r.postedDate),
    deadline: null,
  };
}

/** Pages the whole UK list. Fails the board (no false closures) unless unique ids cover `totalHits` and it held steady. */
export async function fetchPhenom(
  slug: string, host: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const rows: PhRow[] = [];
  let total = -1;
  for (let page = 0; ; page++) {
    if (page >= PHENOM_MAX_PAGES) throw new Error(`more than ${PHENOM_MAX_PAGES} pages`);
    const json = (await getJson(phenomUrl(host), fetchImpl, { method: "POST", body: phenomBody(slug, rows.length) }, sleep)) as PhList;
    const rs = json?.refineSearch;
    if (typeof rs?.totalHits !== "number" || !Array.isArray(rs.data?.jobs)) throw new Error("listing has no totalHits/jobs");
    if (total >= 0 && rs.totalHits !== total) throw new Error(`totalHits changed mid-run (${total} to ${rs.totalHits}); partial list refused`);
    if (rs.totalHits === 0) throw new Error("empty listing (totalHits 0); refusing to close the board");
    total = rs.totalHits;
    rows.push(...rs.data.jobs);
    // The empty-page break relies on the ids-vs-total check below to reject a short list.
    if (rows.length >= total || rs.data.jobs.length === 0) break;
  }
  const ids = new Set(rows.map((r) => (r.jobId === undefined ? "" : String(r.jobId))).filter(Boolean));
  if (ids.size < total) throw new Error(`partial list: ${ids.size} unique of ${total} postings`);
  const uk = rows.filter((r) => ukLocation(r));
  if (uk.length === 0) throw new Error("no UK rows in a non-empty listing; refusing to close the board");
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of uk) {
    if (!r.title || !keepTitle(r.title)) continue;
    const j = normalizePhenom(r, host);
    if (j && !seen.has(j.extId)) { seen.add(j.extId); jobs.push(j); }
  }
  return { jobs, listed: rows.length };
}
