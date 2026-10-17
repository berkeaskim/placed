import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// Goldman Sachs campus roles: GraphQL at api-higher.gs.com (no key, no cookies). Seed: { slug: uk, name: Goldman Sachs, ats: goldmansachs, employer: goldmansachs }.
// `experiences: ["CAMPUS"]` is the student pool; "EARLY_CAREER" is junior experienced hires (0 UK results), see docs/research/employer-coverage-recon.md.
//
// Detail text: the recon's gap was that the careers site gets posting text from `_next/data/<buildId>/roles/<id>.json`, whose buildId
// changes on every deploy. Tried in order, first that works wins (verified live 2026-10-17):
//   1. GraphQL on the same gateway: the roleSearch items type (ExternalRoleGraphQlDTO) itself exposes `descriptionHtml`, `lastPostedDate`
//      and `endDate`, so the list query already returns full posting text. (The gateway also has `role(externalSourceId)` for a single
//      posting.) This works, so there are no detail calls and no buildId scraping (options 2 and 3 are unnecessary).

export const GS_PAGE = 100;
export const GS_MAX_PAGES = 20;
const GS_URL = "https://api-higher.gs.com/gateway/api/v1/graphql";
const COUNTRY: Record<string, string> = { uk: "United Kingdom" };

const QUERY =
  "query GetCampusRoles($searchQueryInput: RoleSearchQueryInput!) { roleSearch(searchQueryInput: $searchQueryInput) { totalCount items { roleId jobTitle locations { primary state country city } status externalSource { sourceId } descriptionHtml lastPostedDate startDate endDate } } }";

type GsItem = {
  roleId?: string; jobTitle?: string; status?: string; descriptionHtml?: string | null;
  locations?: { primary?: boolean; city?: string; country?: string }[] | null;
  externalSource?: { sourceId?: string } | null; lastPostedDate?: string | null; startDate?: string | null; endDate?: string | null;
};
type GsList = { data?: { roleSearch?: { totalCount?: number; items?: GsItem[] } }; errors?: unknown[] };

export function goldmanBody(slug: string, pageNumber: number, pageSize = GS_PAGE): string {
  const country = COUNTRY[slug];
  if (!country) throw new Error(`no country mapped for slug "${slug}"`);
  return JSON.stringify({
    operationName: "GetCampusRoles",
    variables: { searchQueryInput: {
      page: { pageSize, pageNumber }, sort: { sortStrategy: "RELEVANCE", sortOrder: "DESC" },
      filters: [{ filterCategoryType: "LOCATION", filters: [{ filter: country, subFilters: [] }] }],
      experiences: ["CAMPUS"], searchTerm: "",
    } },
    query: QUERY,
  });
}

export const goldmanEndpoint = (): string => GS_URL;

const isoDay = (s: string | null | undefined): string | null => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

export function normalizeGoldman(item: unknown): RawJob | null {
  const r = item as GsItem | null;
  const sourceId = r?.externalSource?.sourceId;
  if (!r?.roleId || !r.jobTitle || !sourceId) return null;
  const locs = (r.locations ?? []).filter((l) => l.city || l.country);
  const primary = locs.find((l) => l.primary) ?? locs[0];
  return {
    extId: r.roleId,
    title: r.jobTitle,
    url: `https://higher.gs.com/roles/${sourceId}`,
    location: primary ? [primary.city, primary.country].filter(Boolean).join(", ") : "",
    remote: false,
    html: r.descriptionHtml ?? "",
    postedAt: isoDay(r.lastPostedDate) ?? isoDay(r.startDate),
    deadline: isoDay(r.endDate),
  };
}

/** Pages the whole list. Fails the board (no false closures) unless the unique ids cover `totalCount` and it held steady. */
export async function fetchGoldman(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const rows: GsItem[] = [];
  let total = -1;
  for (let page = 0; ; page++) {
    if (page >= GS_MAX_PAGES) throw new Error(`more than ${GS_MAX_PAGES} pages`);
    const json = (await getJson(GS_URL, fetchImpl, { method: "POST", body: goldmanBody(slug, page) }, sleep)) as GsList;
    const rs = json?.data?.roleSearch;
    if (json?.errors?.length || typeof rs?.totalCount !== "number" || !Array.isArray(rs.items)) throw new Error("listing has no totalCount/items");
    if (total >= 0 && rs.totalCount !== total) throw new Error(`totalCount changed mid-run (${total} to ${rs.totalCount}); partial list refused`);
    if (rs.totalCount === 0) throw new Error("empty listing (totalCount 0); refusing to close the board");
    total = rs.totalCount;
    rows.push(...rs.items);
    // The items.length === 0 break relies on the ids-vs-total check below to reject a short list.
    if ((page + 1) * GS_PAGE >= total || rs.items.length === 0) break;
  }
  const ids = new Set(rows.map((r) => r.roleId ?? "").filter(Boolean));
  if (ids.size < total) throw new Error(`partial list: ${ids.size} unique of ${total} postings`);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of rows) {
    if (!r.jobTitle || !keepTitle(r.jobTitle)) continue;
    const j = normalizeGoldman(r);
    if (j && !seen.has(j.extId)) { seen.add(j.extId); jobs.push(j); }
  }
  return { jobs, listed: rows.length };
}
