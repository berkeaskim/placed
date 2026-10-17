import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson, mapLimit } from "./http";
import { isRemoteType } from "./workday";

// Oracle Recruiting Cloud (HCM) candidate-experience REST API, public, no key.
// Company seed: slug = "<siteNumber>" or "<siteNumber>/<locationId>" (like Workday's "tenant/site"), apiHost = the tenant host,
// e.g. { slug: "CX_1001/300000000289276", apiHost: "jpmc.fa.oraclecloud.com" }.
// Never read the recruiter contact fields (ExternalContactName / ExternalContactEmail) or HiringManager.

export const ORACLE_PAGE = 25;
export const ORACLE_MAX_PAGES = 80;
const ORACLE_CONCURRENCY = 4;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

type OrListItem = { Id?: string | number; Title?: string };
type OrList = { items?: { TotalJobsCount?: number; requisitionList?: OrListItem[] }[] };
type OrDetail = {
  Id?: string | number; Title?: string; PrimaryLocation?: string; PrimaryLocationCountry?: string;
  ExternalPostedStartDate?: string | null; ExternalPostedEndDate?: string | null;
  WorkplaceType?: string | null; WorkplaceTypeCode?: string | null;
  ExternalDescriptionStr?: string | null; ExternalResponsibilitiesStr?: string | null; ExternalQualificationsStr?: string | null;
};

export function parseOracleSlug(slug: string): { siteNumber: string; locationId: string | null } {
  const [siteNumber, locationId] = slug.split("/");
  return { siteNumber, locationId: locationId || null };
}

const apiBase = (host: string) => `https://${host}/hcmRestApi/resources/latest`;

export function oracleListUrl(slug: string, host: string, offset: number, limit = ORACLE_PAGE): string {
  const { siteNumber, locationId } = parseOracleSlug(slug);
  const finder = `findReqs;siteNumber=${siteNumber},limit=${limit},offset=${offset}${locationId ? `,locationId=${locationId}` : ""},sortBy=POSTING_DATES_DESC`;
  return `${apiBase(host)}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=${encodeURIComponent(finder).replace(/%3D/g, "=").replace(/%2C/g, ",").replace(/%3B/g, ";")}`;
}

const detailUrl = (slug: string, host: string, id: string) =>
  `${apiBase(host)}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(id)}%22,siteNumber=${parseOracleSlug(slug).siteNumber}`;

export function normalizeOracleDetail(json: unknown, host: string, slug: string): RawJob | null {
  const d = (json as { items?: OrDetail[] } | null)?.items?.[0];
  if (!d?.Id || !d.Title) return null;
  const id = String(d.Id);
  const location = d.PrimaryLocation ?? "";
  const end = d.ExternalPostedEndDate;
  return {
    extId: id,
    title: d.Title,
    url: `https://${host}/hcmUI/CandidateExperience/en/sites/${parseOracleSlug(slug).siteNumber}/job/${id}`,
    location,
    remote: isRemoteType(d.WorkplaceTypeCode ?? undefined) || isRemoteType(d.WorkplaceType ?? undefined) || /remote/i.test(location),
    html: [d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr].filter(Boolean).join(""),
    postedAt: d.ExternalPostedStartDate ?? null,
    deadline: end && ISO_DAY.test(end) ? end.slice(0, 10) : null,
  };
}

/** Pages the whole list, keeps titles that pass `keepTitle`, then fetches details (the list has no full description). */
export async function fetchOracle(
  slug: string, host: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const page = async (offset: number) => {
    const w = ((await getJson(oracleListUrl(slug, host, offset), fetchImpl, { method: "GET" }, sleep)) as OrList).items?.[0];
    if (typeof w?.TotalJobsCount !== "number") throw new Error("listing has no TotalJobsCount");
    if (w.TotalJobsCount === 0) throw new Error("empty listing (TotalJobsCount 0); refusing to close the board");
    return { total: w.TotalJobsCount, rows: w.requisitionList ?? [] };
  };
  const listAll = async () => {
    const first = await page(0);
    if (first.total > ORACLE_MAX_PAGES * ORACLE_PAGE) throw new Error(`board has ${first.total} postings, over the ${ORACLE_MAX_PAGES * ORACLE_PAGE} cap`);
    const pages = Math.ceil(first.total / ORACLE_PAGE);
    const rest = await mapLimit(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * ORACLE_PAGE), ORACLE_CONCURRENCY, page);
    const all = [first, ...rest];
    const items = all.flatMap((p) => p.rows);
    const idSet = new Set(items.map((j) => (j.Id === undefined ? "" : String(j.Id))).filter(Boolean));
    return { total: first.total, items, idSet, pagesFull: all.slice(0, -1).every((p) => p.rows.length === ORACLE_PAGE) };
  };
  const run = await listAll();
  if (run.idSet.size < run.total) {
    // Live quirk (JPMorgan 2026-10-17): TotalJobsCount is one above the rows the API ever returns, with every page but the last full.
    // A posting closing mid-run shifts later rows up under offset paging and skips one, which looks identical (1 short). So a
    // 1-row shortfall is accepted only if a second full listing gives the same total and the identical id set; anything else is partial.
    const shortBy = run.total - run.idSet.size;
    const partial = () => new Error(`partial list: ${run.idSet.size} unique of ${run.total} postings`);
    if (shortBy !== 1 || !run.pagesFull) throw partial();
    const again = await listAll();
    const same = again.total === run.total && again.pagesFull && again.idSet.size === run.idSet.size && [...run.idSet].every((id) => again.idSet.has(id));
    if (!same) throw partial();
  }
  const { items } = run;
  const ids = [...new Set(items.filter((j) => j.Id && j.Title && keepTitle(j.Title)).map((j) => String(j.Id)))];
  // A failed or malformed detail fails the board: a silently skipped posting would be marked dead.
  // Only an empty items array (the posting closed between list and detail) is skipped.
  const details = await mapLimit(ids, ORACLE_CONCURRENCY, async (id) => {
    const json = (await getJson(detailUrl(slug, host, id), fetchImpl, { method: "GET" }, sleep)) as { items?: unknown } | null;
    if (!Array.isArray(json?.items)) throw new Error(`detail for ${id} has no items array; refusing to drop it silently`);
    if (json.items.length === 0) return null;
    const j = normalizeOracleDetail(json, host, slug);
    if (!j) throw new Error(`detail for ${id} has no Id/Title; refusing to drop it silently`);
    return j;
  });
  return { jobs: details.filter((j): j is RawJob => j !== null), listed: items.length };
}
