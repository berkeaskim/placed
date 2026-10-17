import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// Eightfold PCSX careers sites (Microsoft: apply.careers.microsoft.com), public JSON, no key. Eightfold is a platform used by more
// than one employer, so the tenant lives in the seed row:
//   apiHost = the careers host ("apply.careers.microsoft.com"), slug = the Eightfold `domain` query parameter ("microsoft.com").
//   e.g. { slug: microsoft.com, name: Microsoft, ats: eightfold, apiHost: apply.careers.microsoft.com, employer: microsoft }
// List: GET /api/pcsx/search?domain=<slug>&query=&location=United%20Kingdom&start=<n>  (10 positions a page, `data.count` total, UK at the source).
// Detail: GET /api/pcsx/position_details?position_id=<id>&domain=<slug>&hl=en  (`data.jobDescription` is HTML).
// There is no working early-careers filter (recon: `seniority` was ignored and `filter_seniority` answered "Please try again later"), so
// only the params above are sent and the title filter runs on the UK rows before any detail call. The API rate-limits (429 "Please try
// again later"), so pages and details go one at a time with a pause; getJson backs off on 429. Recorded 2026-10-17, see
// docs/research/employer-coverage-recon.md.

export const EF_PAGE = 10;
export const EF_MAX_PAGES = 60;
const EF_PAUSE_MS = 700;
const UK = /^united kingdom\b/i;

type EfPosition = {
  id?: number | string; name?: string; locations?: string[] | null; postedTs?: number | null; workLocationOption?: string | null; positionUrl?: string | null;
};
type EfList = { data?: { count?: number; positions?: EfPosition[] } };
type EfDetail = { data?: { jobDescription?: string | null } };

export function eightfoldSearchUrl(slug: string, host: string, start: number): string {
  const q = new URLSearchParams({ domain: slug, query: "", location: "United Kingdom", start: String(start) });
  return `https://${host}/api/pcsx/search?${q}`;
}

const detailUrl = (slug: string, host: string, id: string) =>
  `https://${host}/api/pcsx/position_details?${new URLSearchParams({ position_id: id, domain: slug, hl: "en" })}`;

/** First UK entry of "Country, Region, City" strings -> "London, United Kingdom" ("Multiple Locations" -> "United Kingdom"). */
function ukLocation(locations: string[] | null | undefined): string | null {
  const uk = (locations ?? []).find((l) => UK.test(l));
  if (!uk) return null;
  const city = uk.split(",").map((s) => s.trim())[2] || uk.split(",")[1]?.trim();
  return city && !/multiple/i.test(city) ? `${city}, United Kingdom` : "United Kingdom";
}

export function normalizeEightfold(item: unknown, host: string, html: string): RawJob | null {
  const p = item as EfPosition | null;
  if (!p?.id || !p.name || !p.positionUrl) return null;
  return {
    extId: String(p.id),
    title: p.name,
    url: `https://${host}${p.positionUrl}`,
    location: ukLocation(p.locations) ?? (p.locations?.[0] ?? ""),
    remote: /remote/i.test(p.workLocationOption ?? ""),
    html,
    postedAt: typeof p.postedTs === "number" && p.postedTs > 0 ? new Date(p.postedTs * 1000).toISOString() : null,
    deadline: null,
  };
}

/** Pages the whole UK list, keeps titles that pass `keepTitle`, then fetches details one by one (the list has no description). */
export async function fetchEightfold(
  slug: string, host: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const listAll = async () => {
    const rows: EfPosition[] = [];
    let total = -1;
    const lens: number[] = [];
    for (let page = 0; ; page++) {
      if (page >= EF_MAX_PAGES) throw new Error(`more than ${EF_MAX_PAGES} pages`);
      if (page > 0) await sleep(EF_PAUSE_MS);
      const d = ((await getJson(eightfoldSearchUrl(slug, host, rows.length), fetchImpl, { method: "GET" }, sleep)) as EfList)?.data;
      if (typeof d?.count !== "number" || !Array.isArray(d.positions)) throw new Error("listing has no count/positions");
      if (d.count === 0) throw new Error("empty listing (count 0); refusing to close the board");
      if (total >= 0 && d.count !== total) throw new Error(`count changed mid-run (${total} to ${d.count}); partial list refused`);
      total = d.count;
      if (d.positions.length === 0) break;
      lens.push(d.positions.length);
      rows.push(...d.positions);
      if (rows.length >= total) break;
    }
    const idSet = new Set(rows.map((r) => (r.id === undefined ? "" : String(r.id))).filter(Boolean));
    return { total, rows, idSet, pagesFull: lens.slice(0, -1).every((n) => n === EF_PAGE) };
  };
  let run = await listAll();
  if (run.idSet.size < run.total) {
    // Same rule as oracle.ts: a one-row shortfall (phantom total, or a posting closing mid-run) is accepted only if a second full
    // listing gives the same total and the identical id set; anything else is a partial list.
    const partial = () => new Error(`partial list: ${run.idSet.size} unique of ${run.total} postings`);
    if (run.total - run.idSet.size !== 1 || !run.pagesFull) throw partial();
    const again = await listAll();
    const same = again.total === run.total && again.pagesFull && again.idSet.size === run.idSet.size && [...run.idSet].every((id) => again.idSet.has(id));
    if (!same) throw partial();
    run = again;
  }
  const uk = run.rows.filter((r) => (r.locations ?? []).some((l) => UK.test(l)));
  if (uk.length === 0) throw new Error("no UK rows in a non-empty listing; refusing to close the board");
  const seen = new Set<string>();
  const keep = uk.filter((r) => {
    const id = r.id === undefined ? "" : String(r.id);
    if (!id || !r.name || !keepTitle(r.name) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const jobs: RawJob[] = [];
  for (const r of keep) {
    await sleep(EF_PAUSE_MS);
    // A failed detail fails the board: a silently skipped posting would be marked dead.
    const det = (await getJson(detailUrl(slug, host, String(r.id)), fetchImpl, { method: "GET" }, sleep)) as EfDetail;
    const j = normalizeEightfold(r, host, det?.data?.jobDescription ?? "");
    if (j) jobs.push(j);
  }
  return { jobs, listed: run.rows.length };
}
