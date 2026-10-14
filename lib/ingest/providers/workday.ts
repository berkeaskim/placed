import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson, mapLimit } from "./http";

// Workday's public candidate-site JSON ("cxs") API. No key; the same calls the careers SPA makes.
// Company seed: slug = "{tenant}/{site}", apiHost = "{tenant}.wdN.myworkdayjobs.com".

export const WD_PAGE = 20; // Workday rejects larger page sizes
export const WD_MAX_PAGES = 150; // 3000 postings; larger boards get truncated (logged by the caller via `truncated`)
const WD_CONCURRENCY = 4;

type WdListItem = { title?: string; externalPath?: string; locationsText?: string };
type WdList = { total?: number; jobPostings?: WdListItem[] };
type WdDetail = {
  jobPostingInfo?: {
    id?: string; title?: string; jobDescription?: string; location?: string; additionalLocations?: string[];
    startDate?: string; endDate?: string; externalUrl?: string; remoteType?: string; jobReqId?: string;
    country?: { descriptor?: string };
  };
};

export function parseWorkdaySlug(slug: string): { tenant: string; site: string } {
  const [tenant, site] = slug.split("/");
  if (!tenant || !site) throw new Error(`workday slug must be "tenant/site", got "${slug}"`);
  return { tenant, site };
}

export function workdayBase(slug: string, host: string): string {
  const { tenant, site } = parseWorkdaySlug(slug);
  return `https://${host}/wday/cxs/${tenant}/${site}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** remoteType is free text per tenant: "Remote", "Hybrid", but also "This position is not available for remote working". */
export const isRemoteType = (t: string | undefined): boolean =>
  /remote/i.test(t ?? "") && !/\b(not|no|non)\b[- ](?:(?:available|eligible) for )?remote|\bremote\s+(?:is\s+)?not\b|\bnot\s+(?:available|eligible)\b/i.test(t ?? "");

export function normalizeWorkdayDetail(json: unknown): RawJob | null {
  const i = (json as WdDetail | null)?.jobPostingInfo;
  if (!i?.id || !i.title || !i.externalUrl) return null;
  // Site names like "Knutsford, Radbroke Hall" don't say UK; append the structured country so the location filter sees it.
  const country = i.country?.descriptor ?? "";
  const primary = country && !(i.location ?? "").toLowerCase().includes(country.toLowerCase())
    ? [i.location, country].filter(Boolean).join(", ") : (i.location ?? "");
  const locs = [primary, ...(i.additionalLocations ?? [])].filter(Boolean);
  const location = locs.join("; ");
  return {
    extId: i.id,
    title: i.title,
    url: i.externalUrl,
    location,
    remote: isRemoteType(i.remoteType) || /remote/i.test(location),
    html: i.jobDescription ?? "",
    postedAt: i.startDate && ISO_DAY.test(i.startDate) ? `${i.startDate}T00:00:00Z` : null,
    // Structured close date set by the employer in Workday; exact, no text parsing.
    deadline: i.endDate && ISO_DAY.test(i.endDate) ? i.endDate : null,
  };
}

/**
 * Lists the whole board (no searchText: Workday's search is fuzzy, "intern" also matches "internal"),
 * keeps titles that pass `keepTitle`, then fetches details only for those.
 */
export async function fetchWorkday(
  slug: string, host: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number; truncated: boolean }> {
  const base = workdayBase(slug, host);
  const page = (offset: number) => getJson(`${base}/jobs`, fetchImpl, {
    method: "POST",
    body: JSON.stringify({ appliedFacets: {}, limit: WD_PAGE, offset, searchText: "" }),
  }, sleep) as Promise<WdList>;

  // Workday only reports `total` reliably on the first page.
  const first = await page(0);
  const total = typeof first.total === "number" ? first.total : 0;
  const pages = Math.min(Math.ceil(total / WD_PAGE), WD_MAX_PAGES);
  const rest = await mapLimit(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * WD_PAGE), WD_CONCURRENCY, page);
  const items = [first, ...rest].flatMap((p) => p.jobPostings ?? []);

  const paths = [...new Set(items.filter((j) => j.title && j.externalPath && keepTitle(j.title)).map((j) => j.externalPath as string))];
  // getJson retries transient errors; anything else fails the board, because a silently skipped
  // posting would be marked dead (a false closure).
  const details = await mapLimit(paths, WD_CONCURRENCY, async (p) => normalizeWorkdayDetail(await getJson(`${base}${p}`, fetchImpl, undefined, sleep)));
  const seen = new Set<string>();
  const jobs = details.filter((j): j is RawJob => j !== null && !seen.has(j.extId) && Boolean(seen.add(j.extId)));
  return { jobs, listed: items.length, truncated: total > WD_MAX_PAGES * WD_PAGE };
}
