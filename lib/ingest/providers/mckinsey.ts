import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// McKinsey careers search gateway, public JSON, no key.
// List: GET https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search?pageSize=100&start=<page, 1-based>&countries=United+Kingdom&lang=en
//   -> { numFound, httpStatus: "OK", docs: [...] }. `docs` already carries the full text (whoYouWillWorkWith / whatYouWillDo / yourBackground), so there
//   is no detail call. A page past the end answers `docs: null`. `cities[]` and `countries[]` are parallel arrays: the UK cities are the entries whose
//   country is "United Kingdom". Postings are global evergreen roles listing many cities; there is no posted date (postedAt stays null).
// slug = country key in the seed row ("uk"). Recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

export const MK_PAGE = 100;
export const MK_MAX_PAGES = 20;
const COUNTRIES: Record<string, string> = { uk: "United Kingdom" };
const SITE = "https://www.mckinsey.com/careers/search-jobs/jobs/";

type MkDoc = {
  jobID?: string | number; title?: string; cities?: string[]; countries?: string[]; friendlyURL?: string;
  whoYouWillWorkWith?: string; whatYouWillDo?: string; yourBackground?: string;
};
type MkList = { numFound?: number; httpStatus?: string; statusMessage?: string; docs?: MkDoc[] | null };

export function mckinseySearchUrl(slug: string, page: number): string {
  const country = COUNTRIES[slug];
  if (!country) throw new Error(`unknown McKinsey country key "${slug}" (known: ${Object.keys(COUNTRIES).join(", ")})`);
  return `https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search?${new URLSearchParams({ pageSize: String(MK_PAGE), start: String(page), countries: country, lang: "en" })}`;
}

const isUkDoc = (d: MkDoc) => (d.countries ?? []).includes("United Kingdom");

export function normalizeMckinsey(item: unknown): RawJob | null {
  const d = item as MkDoc | null;
  // friendlyURL comes from the response: only a plain slug may be placed in our own site path.
  if (!d?.jobID || !d.title || typeof d.friendlyURL !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(d.friendlyURL)) return null;
  const cities = (d.cities ?? []).filter((c, i) => d.countries?.[i] === "United Kingdom" && c);
  return {
    extId: String(d.jobID),
    title: d.title,
    url: `${SITE}${encodeURIComponent(d.friendlyURL)}`,
    location: cities.length ? [...new Set(cities)].map((c) => `${c}, United Kingdom`).join("; ") : "United Kingdom",
    remote: false,
    html: [d.whoYouWillWorkWith, d.whatYouWillDo, d.yourBackground].filter((s): s is string => typeof s === "string" && s.trim() !== "").join("\n"),
    postedAt: null,
    deadline: null,
  };
}

/** Pages the whole UK list and keeps titles that pass `keepTitle` (the list rows already carry the text). */
export async function fetchMckinsey(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  mckinseySearchUrl(slug, 1); // validates the country key
  const listAll = async () => {
    const rows: MkDoc[] = [];
    let total = -1;
    const lens: number[] = [];
    for (let page = 1; ; page++) {
      if (page > MK_MAX_PAGES) throw new Error(`more than ${MK_MAX_PAGES} pages`);
      if (page > 1) await sleep(500);
      const d = (await getJson(mckinseySearchUrl(slug, page), fetchImpl, { method: "GET" }, sleep)) as MkList;
      // HTTP 200 with a non-OK httpStatus / no numFound is a soft error, never an empty board.
      if (!d || d.httpStatus !== "OK" || typeof d.numFound !== "number") throw new Error(`listing is a soft error (httpStatus ${d?.httpStatus ?? "missing"}, no numFound)`);
      if (d.docs !== null && d.docs !== undefined && !Array.isArray(d.docs)) throw new Error("listing docs is not an array");
      if (d.numFound === 0) throw new Error("empty listing (numFound 0); refusing to close the board");
      if (total >= 0 && d.numFound !== total) throw new Error(`numFound changed mid-run (${total} to ${d.numFound}); partial list refused`);
      total = d.numFound;
      const docs = d.docs ?? [];
      if (docs.length === 0) {
        if (page === 1) throw new Error("listing has numFound but no docs (soft error); refusing to close the board");
        break;
      }
      lens.push(docs.length);
      rows.push(...docs);
      if (rows.length >= total) break;
    }
    const idSet = new Set(rows.map((r) => (r.jobID === undefined ? "" : String(r.jobID))).filter(Boolean));
    return { total, rows, idSet, pagesFull: lens.slice(0, -1).every((n) => n === MK_PAGE) };
  };
  let run = await listAll();
  if (run.idSet.size < run.total) {
    // Same rule as oracle.ts/eightfold.ts: a one-row shortfall is accepted only if a second full listing gives the same total and identical ids.
    const partial = () => new Error(`partial list: ${run.idSet.size} unique of ${run.total} postings`);
    if (run.total - run.idSet.size !== 1 || !run.pagesFull) throw partial();
    const again = await listAll();
    const same = again.total === run.total && again.pagesFull && again.idSet.size === run.idSet.size && [...run.idSet].every((id) => again.idSet.has(id));
    if (!same) throw partial();
    run = again;
  }
  const uk = run.rows.filter(isUkDoc);
  if (uk.length === 0) throw new Error("no UK rows in a non-empty listing; refusing to close the board");
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of uk) {
    const id = r.jobID === undefined ? "" : String(r.jobID);
    if (!id || !r.title || !keepTitle(r.title) || seen.has(id)) continue;
    seen.add(id);
    const j = normalizeMckinsey(r);
    if (!j) throw new Error(`posting ${id} has no usable friendlyURL; refusing to drop it silently`);
    jobs.push(j);
  }
  return { jobs, listed: run.rows.length };
}
