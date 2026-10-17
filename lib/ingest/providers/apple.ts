import type { RawJob } from "@/lib/types";
import { RETRY_DELAYS_MS, defaultSleep, isTransient } from "./http";

// Apple careers (jobs.apple.com). The site's own search API (/api/v1/search) did not answer a plain request with results (recon, re-checked
// 2026-10-17: HTTP 200 with zero records for every filter shape), so this reads the one JSON blob the server-rendered page embeds:
//   window.__staticRouterHydrationData = JSON.parse("<json string literal>")
// We locate that single assignment, take the string literal, and JSON.parse twice (no eval, no selectors). A missing marker, unparseable blob or
// missing expected keys FAILS the board: a site redesign must never look like "zero jobs".
// List: GET /en-gb/search?location=united-kingdom-GBR&page=<n>  (20 rows a page, `loaderData.search.{searchResults,totalRecords}`; one row per
//   location, so a position in several UK places repeats under the same positionId).
// Detail: GET /en-gb/details/<positionId>/<slug>  (`loaderData.jobDetails.jobsData` has description/responsibilities/qualifications).
// slug = country key in the seed row ("uk"). Title filter runs before any detail call. Recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

export const APPLE_PAGE = 20;
export const APPLE_MAX_PAGES = 40;
const APPLE_PAUSE_MS = 600;
const HOST = "https://jobs.apple.com";
const LOCATIONS: Record<string, string> = { uk: "united-kingdom-GBR" };
const MARKER = "__staticRouterHydrationData = JSON.parse(";

type AppleLoc = { name?: string; countryName?: string };
type AppleRow = {
  positionId?: string; postingTitle?: string; transformedPostingTitle?: string; jobSummary?: string; locations?: AppleLoc[];
  postDateInGMT?: string; homeOffice?: boolean;
};
type AppleSearch = { searchResults: AppleRow[]; totalRecords: number };
type AppleDetail = {
  positionId?: string; jobNumber?: string; jobSummary?: string; description?: string; responsibilities?: string;
  minimumQualifications?: string; preferredQualifications?: string;
};

export function appleSearchUrl(slug: string, page: number): string {
  const loc = LOCATIONS[slug];
  if (!loc) throw new Error(`unknown Apple country key "${slug}" (known: ${Object.keys(LOCATIONS).join(", ")})`);
  return `${HOST}/en-gb/search?${new URLSearchParams({ location: loc, page: String(page) })}`;
}

const detailPath = (id: string, slug?: string) => `${HOST}/en-gb/details/${encodeURIComponent(id)}${slug ? `/${slug}` : ""}`;

/** Pulls loaderData out of the page's single hydration assignment; `kind` names the loader whose keys must be present. */
export function extractApplePage(page: string, kind: "search"): AppleSearch;
export function extractApplePage(page: string, kind: "jobDetails"): { jobsData: AppleDetail };
export function extractApplePage(page: string, kind: "search" | "jobDetails"): AppleSearch | { jobsData: AppleDetail } {
  const at = page.indexOf(MARKER);
  if (at < 0) throw new Error("hydration data marker not found (page changed or blocked); refusing to treat it as zero jobs");
  const start = at + MARKER.length;
  if (page[start] !== '"') throw new Error("hydration data is not a string literal");
  let end = start + 1;
  while (end < page.length && page[end] !== '"') end += page[end] === "\\" ? 2 : 1;
  if (end >= page.length) throw new Error("hydration data literal is unterminated");
  let data: { loaderData?: Record<string, unknown> };
  try {
    data = JSON.parse(JSON.parse(page.slice(start, end + 1)) as string);
  } catch (e) {
    throw new Error(`hydration data is not valid JSON (${(e as Error).message})`);
  }
  const part = data?.loaderData?.[kind] as Record<string, unknown> | undefined;
  if (kind === "search") {
    if (!part || !Array.isArray(part.searchResults) || typeof part.totalRecords !== "number") throw new Error("hydration data has no usable loaderData.search");
    return part as unknown as AppleSearch;
  }
  const d = (part as { jobsData?: AppleDetail } | undefined)?.jobsData;
  if (!d || typeof d !== "object" || (typeof d.description !== "string" && typeof d.jobSummary !== "string")) {
    throw new Error("hydration data has no usable loaderData.jobDetails.jobsData (soft error or changed page)");
  }
  return { jobsData: d };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const section = (title: string, text: string | undefined) => (text?.trim() ? `<h3>${title}</h3><p>${esc(text.trim()).replace(/\n+/g, "<br>")}</p>` : "");

/** One position = every row sharing its positionId (one per UK location). `detail` adds the full text; without it the list summary is used. */
export function normalizeApple(group: unknown, detail: unknown): RawJob | null {
  const rows = (Array.isArray(group) ? group : [group]).filter((r): r is AppleRow => !!r && typeof r === "object");
  const first = rows[0];
  if (!first?.postingTitle || typeof first.positionId !== "string" || !/^\d+$/.test(first.positionId)) return null;
  const names = [...new Set(rows.flatMap((r) => (r.locations ?? []).map((l) => (l.name ?? "").replace(/\s+Metro Area$/i, "").trim()).filter(Boolean)))];
  const d = detail as AppleDetail | null;
  const text = d
    ? section("Summary", d.jobSummary) + section("Description", d.description) + section("Responsibilities", d.responsibilities) +
      section("Minimum qualifications", d.minimumQualifications) + section("Preferred qualifications", d.preferredQualifications)
    : section("Summary", first.jobSummary);
  const slug = typeof first.transformedPostingTitle === "string" && /^[A-Za-z0-9-]+$/.test(first.transformedPostingTitle) ? first.transformedPostingTitle : undefined;
  const posted = first.postDateInGMT ? new Date(first.postDateInGMT) : null;
  return {
    extId: first.positionId,
    title: first.postingTitle,
    url: detailPath(first.positionId, slug),
    location: names.length ? names.map((n) => `${n}, United Kingdom`).join("; ") : "United Kingdom",
    remote: rows.some((r) => r.homeOffice === true),
    html: text,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
    deadline: null,
  };
}

/** GET text with the same backoff rules as getJson (429/5xx and transient network errors). */
async function getText(url: string, fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), headers: { accept: "text/html" } });
    } catch (e) {
      if (isTransient(e) && attempt < RETRY_DELAYS_MS.length) { await sleep(RETRY_DELAYS_MS[attempt]); continue; }
      throw e;
    }
    if (res.ok) return res.text();
    if ([429, 502, 503, 504].includes(res.status) && attempt < RETRY_DELAYS_MS.length) { await sleep(RETRY_DELAYS_MS[attempt]); continue; }
    throw new Error(`HTTP ${res.status}`);
  }
}

const SOFT_RETRIES = 3;

/**
 * jobs.apple.com intermittently answers HTTP 200 with a well-formed page that has `totalRecords: 0` and no rows (seen on roughly a third of
 * requests, 2026-10-17), and answers the same way for a page past the end. A zero on a page we have no reason to expect to be empty is a soft
 * error: ask again a few times, then fail the board rather than store a short list.
 */
async function getSearchPage(slug: string, page: number, expectRows: boolean, fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>): Promise<AppleSearch> {
  for (let attempt = 0; ; attempt++) {
    const s = extractApplePage(await getText(appleSearchUrl(slug, page), fetchImpl, sleep), "search");
    if (s.totalRecords > 0 && (s.searchResults.length > 0 || !expectRows)) return s;
    if (attempt >= SOFT_RETRIES) {
      if (s.totalRecords === 0 && page > 1) throw new Error(`page ${page} answered total 0 ${SOFT_RETRIES + 1} times (soft error); refusing a partial list`);
      return s;
    }
    await sleep(1000 * (attempt + 1));
  }
}

async function getDetail(url: string, fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>): Promise<AppleDetail> {
  for (let attempt = 0; ; attempt++) {
    try {
      return extractApplePage(await getText(url, fetchImpl, sleep), "jobDetails").jobsData;
    } catch (e) {
      // A 200 page without the expected keys is retried briefly (same soft-error behaviour as the list), then fails the board.
      if (attempt >= SOFT_RETRIES - 1 || /^HTTP /.test((e as Error).message)) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}

const isUk = (r: AppleRow) => (r.locations ?? []).some((l) => l.countryName === "United Kingdom");
const rowKey = (r: AppleRow) => `${r.positionId ?? ""}|${(r.locations ?? []).map((l) => l.name ?? "").join(",")}`;

/** Pages the whole UK list, keeps titles that pass `keepTitle`, then reads each kept position's detail page. */
export async function fetchApple(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  appleSearchUrl(slug, 1); // validates the country key
  const listAll = async () => {
    const rows: AppleRow[] = [];
    let total = -1;
    const lens: number[] = [];
    for (let page = 1; ; page++) {
      if (page > APPLE_MAX_PAGES) throw new Error(`more than ${APPLE_MAX_PAGES} pages`);
      if (page > 1) await sleep(APPLE_PAUSE_MS);
      const s = await getSearchPage(slug, page, page === 1 || (total >= 0 && rows.length < total), fetchImpl, sleep);
      if (page === 1 && s.totalRecords === 0) throw new Error("empty listing (total 0); refusing to close the board");
      if (total >= 0 && s.totalRecords !== total) throw new Error(`total changed mid-run (${total} to ${s.totalRecords}); partial list refused`);
      total = s.totalRecords;
      if (s.searchResults.length === 0) break;
      lens.push(s.searchResults.length);
      rows.push(...s.searchResults);
      if (rows.length >= total) break;
    }
    const keys = new Set(rows.map(rowKey));
    return { total, rows, keys, pagesFull: lens.slice(0, -1).every((n) => n === APPLE_PAGE) };
  };
  let run = await listAll();
  if (run.keys.size < run.total) {
    // Same rule as oracle.ts/eightfold.ts: a one-row shortfall is accepted only if a second full listing gives the same total and identical rows.
    const partial = () => new Error(`partial list: ${run.keys.size} unique of ${run.total} rows`);
    if (run.total - run.keys.size !== 1 || !run.pagesFull) throw partial();
    const again = await listAll();
    const same = again.total === run.total && again.pagesFull && again.keys.size === run.keys.size && [...run.keys].every((k) => again.keys.has(k));
    if (!same) throw partial();
    run = again;
  }
  const uk = run.rows.filter(isUk);
  if (uk.length === 0) throw new Error("no UK rows in a non-empty listing; refusing to close the board");
  const groups = new Map<string, AppleRow[]>();
  for (const r of uk) {
    if (typeof r.positionId !== "string" || !r.postingTitle) continue;
    groups.set(r.positionId, [...(groups.get(r.positionId) ?? []), r]);
  }
  const jobs: RawJob[] = [];
  for (const [id, g] of groups) {
    if (!keepTitle(g[0].postingTitle as string)) continue;
    const listJob = normalizeApple(g, null);
    if (!listJob) throw new Error(`position ${id} has an unusable id; refusing to drop it silently`);
    await sleep(APPLE_PAUSE_MS);
    // A failed or soft-error detail fails the board: a silently skipped posting would be marked dead.
    const jobsData = await getDetail(listJob.url, fetchImpl, sleep);
    if (String(jobsData.positionId ?? jobsData.jobNumber) !== id) throw new Error(`detail for ${id} describes another position; refusing to store it`);
    jobs.push(normalizeApple(g, jobsData) as RawJob);
  }
  return { jobs, listed: run.rows.length };
}
