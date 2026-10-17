import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";

// Deutsche Bank graduates & students (beesite graduatesearch). Company seed: slug = country key ("uk"),
// e.g. { slug: uk, name: Deutsche Bank, ats: deutschebank, employer: deutschebank }. The API filters by country id at the source (71 = United Kingdom,
// from /lookup/country/lang/2); the ingest location filter still applies. FirstItem is 1-based.
// NO DESCRIPTION: the API exposes no description field (PositionFormattedDescription.Content is empty and the full "ALL" descriptor has none), and there
// is no per-posting detail endpoint on it; the full text only lives on the db.recsolu.com apply page, a different HTML host we don't scrape. Per the
// controller's ruling the posting is emitted with list text only: `html` is built from the programme (CareerLevel), division (JobCategory) and hiring year.
// The Workday board db/DBWebSite has no early-careers roles and stays as it is. Recorded 2026-10-17, see docs/research/employer-coverage-recon.md.

export const DB_PAGE = 100;
export const DB_MAX_PAGES = 20;
const COUNTRY: Record<string, { id: string; name: string; re: RegExp }> = {
  // The API answers in German whatever LanguageCode says ("Großbritannien und Nordirland").
  uk: { id: "71", name: "United Kingdom", re: /gro(ß|ss)britannien|united kingdom/i },
};
const FIELDS = ["PositionID", "PositionTitle", "PositionURI", "PositionLocation.CountryName", "PositionLocation.CityName", "PublicationStartDate", "PublicationEndDate",
  "CareerLevel.Name", "JobCategory.Name", "PositionHiringYear"];

type DbDesc = {
  PositionID?: string | number; PositionTitle?: string; PositionURI?: string; PositionLocation?: { CityName?: string; CountryName?: string }[];
  PublicationStartDate?: string | null; PublicationEndDate?: string | null; CareerLevel?: { Name?: string }[]; JobCategory?: { Name?: string }[]; PositionHiringYear?: string | null;
};
type DbList = { SearchResult?: { SearchResultCountAll?: number; SearchResultItems?: { MatchedObjectDescriptor?: DbDesc }[] } };

export function deutscheBankUrl(slug: string, first: number, count = DB_PAGE): string {
  const c = COUNTRY[slug];
  if (!c) throw new Error(`no country mapped for slug "${slug}"`);
  const data = {
    LanguageCode: "en",
    SearchParameters: { FirstItem: first, CountItem: count, MatchedObjectDescriptor: FIELDS, Sort: [{ Criterion: "PublicationStartDate", Direction: "DESC" }] },
    SearchCriteria: [{ CriterionName: "PositionLocation.Country", CriterionValue: [c.id] }],
  };
  return `https://api-deutschebank.beesite.de/graduatesearch/?data=${encodeURIComponent(JSON.stringify(data))}`;
}

const isoDate = (s: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? "") ? (s as string) : null);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function normalizeDeutscheBank(item: unknown): RawJob | null {
  const d = item as DbDesc | null;
  if (!d?.PositionID || !d.PositionTitle || !d.PositionURI) return null;
  const city = d.PositionLocation?.[0]?.CityName;
  const bits = [d.CareerLevel?.[0]?.Name, d.JobCategory?.[0]?.Name, d.PositionHiringYear ? `${d.PositionHiringYear} intake` : ""].filter(Boolean) as string[];
  return {
    extId: String(d.PositionID),
    title: d.PositionTitle,
    url: d.PositionURI,
    location: [city, "United Kingdom"].filter(Boolean).join(", "),
    remote: false,
    html: bits.length ? `<p>${bits.map(esc).join(" - ")}</p>` : "",
    postedAt: isoDate(d.PublicationStartDate),
    deadline: isoDate(d.PublicationEndDate),
  };
}

/** Pages with FirstItem/CountItem. Fails the board (no false closures) on partial lists, a total that moves mid-run, or an empty listing. */
export async function fetchDeutscheBank(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep, pageSize = DB_PAGE,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const c = COUNTRY[slug];
  if (!c) throw new Error(`no country mapped for slug "${slug}"`);
  const rows: DbDesc[] = [];
  let total = -1;
  for (let page = 0; page < DB_MAX_PAGES; page++) {
    const first = page * pageSize + 1;
    const res = ((await getJson(deutscheBankUrl(slug, first, pageSize), fetchImpl, { method: "GET" }, sleep)) as DbList)?.SearchResult;
    if (typeof res?.SearchResultCountAll !== "number" || !Array.isArray(res.SearchResultItems)) throw new Error("listing has no SearchResultCountAll/SearchResultItems");
    if (total >= 0 && res.SearchResultCountAll !== total) throw new Error(`total changed mid-run (${total} -> ${res.SearchResultCountAll}); refusing to trust a moving list`);
    total = res.SearchResultCountAll;
    if (total === 0) throw new Error("empty listing (SearchResultCountAll 0); refusing to close the board");
    for (const i of res.SearchResultItems) if (i.MatchedObjectDescriptor) rows.push(i.MatchedObjectDescriptor);
    if (res.SearchResultItems.length === 0 || first - 1 + res.SearchResultItems.length >= total) break;
    await sleep(250);
  }
  const ids = new Set(rows.map((r) => (r.PositionID === undefined ? "" : String(r.PositionID))).filter(Boolean));
  if (ids.size < total) throw new Error(`partial list: ${ids.size} unique of ${total} postings`);
  // The source filter already restricts to the UK; this guards against it being silently dropped or the country naming changing.
  const uk = rows.filter((r) => (r.PositionLocation ?? []).some((l) => c.re.test(l.CountryName ?? "")));
  if (uk.length === 0) throw new Error(`no ${c.name} rows in a non-empty listing; refusing to close the board`);
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const r of uk) {
    if (!r.PositionTitle || !keepTitle(r.PositionTitle)) continue;
    const j = normalizeDeutscheBank(r);
    if (!j) throw new Error(`position ${r.PositionID ?? "?"} has no PositionID/PositionURI; refusing to drop it silently`);
    if (!seen.has(j.extId)) { seen.add(j.extId); jobs.push(j); }
  }
  return { jobs, listed: uk.length };
}
