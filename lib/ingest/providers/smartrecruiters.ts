import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson, mapLimit } from "./http";

// SmartRecruiters' public Posting API (no key; built for customer career sites).
// Company seed: slug = the company identifier in jobs.smartrecruiters.com/{identifier}, case-insensitive.
// Caveat: an unknown or renamed identifier returns 200 {totalFound: 0}, indistinguishable from an empty board;
// `npm run validate-slugs` and `npm run coverage -- --live` are how a dead slug gets noticed.

export const SR_PAGE = 100; // API maximum
export const SR_MAX_PAGES = 50;
const SR_CONCURRENCY = 4;
const SR_API = "https://api.smartrecruiters.com/v1/companies";

type SrLocation = { city?: string; region?: string; country?: string; remote?: boolean; fullLocation?: string };
type SrListItem = { id?: string; name?: string };
type SrList = { totalFound?: number; content?: SrListItem[] };
type SrSection = { title?: string; text?: string };
type SrDetail = {
  id?: string; name?: string; releasedDate?: string; postingUrl?: string; location?: SrLocation;
  jobAd?: { sections?: Record<string, SrSection | undefined> };
};

export const srPostingsUrl = (slug: string) => `${SR_API}/${encodeURIComponent(slug)}/postings`;

// The API gives an ISO country code; the location filter matches names, and fullLocation sometimes omits the country.
const COUNTRY: Record<string, string> = {
  gb: "United Kingdom", uk: "United Kingdom", ie: "Ireland", fr: "France", de: "Germany", nl: "Netherlands", be: "Belgium",
  es: "Spain", it: "Italy", ch: "Switzerland", at: "Austria", se: "Sweden", dk: "Denmark", pl: "Poland", pt: "Portugal",
  lu: "Luxembourg", no: "Norway", fi: "Finland", cz: "Czech Republic",
};

export function srLocation(l: SrLocation | undefined): string {
  if (!l) return "";
  const parts = (l.fullLocation ?? [l.city, l.region].join(", ")).split(",").map((s) => s.trim()).filter(Boolean);
  const country = l.country ? COUNTRY[l.country.toLowerCase()] : undefined;
  if (country && !parts.some((p) => p.toLowerCase() === country.toLowerCase())) parts.push(country);
  return parts.join(", ");
}

const SECTIONS = ["jobDescription", "qualifications", "additionalInformation"]; // companyDescription is boilerplate

export function normalizeSmartRecruitersDetail(json: unknown): RawJob | null {
  const d = json as SrDetail | null;
  if (!d?.id || !d.name || !d.postingUrl) return null;
  const html = SECTIONS.map((k) => d.jobAd?.sections?.[k]).filter((s): s is SrSection => Boolean(s?.text))
    .map((s) => `${s.title ? `<h3>${s.title}</h3>` : ""}${s.text}`).join("");
  const location = srLocation(d.location);
  return {
    extId: d.id,
    title: d.name,
    url: d.postingUrl,
    location,
    remote: Boolean(d.location?.remote) || /remote/i.test(location),
    html,
    postedAt: d.releasedDate ?? null,
  };
}

/** Pages the whole board, keeps titles that pass `keepTitle`, then fetches details (the list has no description). */
export async function fetchSmartRecruiters(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<{ jobs: RawJob[]; listed: number }> {
  const base = srPostingsUrl(slug);
  const page = (offset: number) => getJson(`${base}?limit=${SR_PAGE}&offset=${offset}`, fetchImpl, { method: "GET" }, sleep) as Promise<SrList>;
  const first = await page(0);
  // A malformed or truncated listing must fail the board: returning a partial list would let markDead close the rest.
  if (typeof first.totalFound !== "number") throw new Error("listing has no totalFound");
  const total = first.totalFound;
  if (total > SR_MAX_PAGES * SR_PAGE) throw new Error(`board has ${total} postings, over the ${SR_MAX_PAGES * SR_PAGE} cap`);
  const pages = Math.min(Math.ceil(total / SR_PAGE), SR_MAX_PAGES);
  const rest = await mapLimit(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * SR_PAGE), SR_CONCURRENCY, page);
  const items = [first, ...rest].flatMap((p) => p.content ?? []);
  if (items.length < total) throw new Error(`listed ${items.length} of ${total} postings`);
  const ids = [...new Set(items.filter((j) => j.id && j.name && keepTitle(j.name)).map((j) => j.id as string))];
  // A failed detail fails the board (as for Workday): a silently skipped posting would be marked dead.
  const details = await mapLimit(ids, SR_CONCURRENCY, async (id) =>
    normalizeSmartRecruitersDetail(await getJson(`${base}/${encodeURIComponent(id)}`, fetchImpl, { method: "GET" }, sleep)));
  return { jobs: details.filter((j): j is RawJob => j !== null), listed: items.length };
}
