import { ARCHETYPES, type Archetype, type Region } from "@/lib/types";
import { classifyRegion } from "@/lib/ingest/filter";
import { daysUntil, isValidDate } from "@/lib/scoring/dates";
import type { Ranked } from "./rank";

export const LOCATION_FILTERS = ["london", "uk", "europe", "remote"] as const satisfies readonly Region[];
export type LocationFilter = (typeof LOCATION_FILTERS)[number];
export const LOCATION_LABELS: Record<LocationFilter, string> = { london: "London", uk: "UK", europe: "Europe", remote: "Remote" };

export type FeedFilters = { a: Archetype | null; loc: LocationFilter | null; soon: boolean };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Reads ?a= ?loc= ?soon= from searchParams, accepting only known values. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): FeedFilters {
  const a = one(sp.a), loc = one(sp.loc);
  return {
    a: a && (ARCHETYPES as readonly string[]).includes(a) ? (a as Archetype) : null,
    loc: loc && (LOCATION_FILTERS as readonly string[]).includes(loc) ? (loc as LocationFilter) : null,
    soon: one(sp.soon) === "1",
  };
}

export const CLOSING_SOON_DAYS = 7;

export function applyFilters(ranked: Ranked[], f: FeedFilters, today: string): Ranked[] {
  return ranked.filter(({ job }) =>
    (!f.a || job.archetype === f.a) &&
    (!f.loc || classifyRegion(job.location, job.remote) === f.loc) &&
    (!f.soon || (isValidDate(job.deadline) && daysUntil(job.deadline, today) <= CLOSING_SOON_DAYS)));
}

/** Builds a /feed href that keeps the other filters, toggling one param. */
export function feedHref(f: FeedFilters, change: Partial<{ a: Archetype | null; loc: LocationFilter | null; soon: boolean }>): string {
  const n = { ...f, ...change };
  const q = new URLSearchParams();
  if (n.a) q.set("a", n.a);
  if (n.loc) q.set("loc", n.loc);
  if (n.soon) q.set("soon", "1");
  const s = q.toString();
  return s ? `/feed?${s}` : "/feed";
}
