import { ARCHETYPES, type Archetype, type Region } from "@/lib/types";
import { classifyRegion } from "@/lib/ingest/filter";
import { daysUntil, isValidDate } from "@/lib/scoring/dates";
import type { Ranked } from "./rank";

export const LOCATION_FILTERS = ["london", "uk", "europe", "remote"] as const satisfies readonly Region[];
export type LocationFilter = (typeof LOCATION_FILTERS)[number];
export const LOCATION_LABELS: Record<LocationFilter, string> = { london: "London", uk: "UK", europe: "Europe", remote: "Remote" };

/** "spring": spring weeks and insight events only. null: not chosen, so the student's eligibility decides (resolveMode). */
export type FeedMode = "spring" | "all";
export type FeedFilters = { a: Archetype | null; loc: LocationFilter | null; soon: boolean; mode: FeedMode | null };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Reads ?a= ?loc= ?soon= ?mode= from searchParams, accepting only known values. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): FeedFilters {
  const a = one(sp.a), loc = one(sp.loc), mode = one(sp.mode);
  return {
    a: a && (ARCHETYPES as readonly string[]).includes(a) ? (a as Archetype) : null,
    loc: loc && (LOCATION_FILTERS as readonly string[]).includes(loc) ? (loc as LocationFilter) : null,
    soon: one(sp.soon) === "1",
    mode: mode === "spring" || mode === "all" ? mode : null,
  };
}

/** Spring-week-eligible students land on spring weeks; everyone else on all roles. An explicit choice wins. */
export function resolveMode(mode: FeedMode | null, springEligible: boolean): FeedMode {
  return mode ?? (springEligible ? "spring" : "all");
}

const isFirstYearProgramme = (t: string) => t === "spring_week" || t === "insight";

export const CLOSING_SOON_DAYS = 7;

export function applyFilters(ranked: Ranked[], f: FeedFilters, today: string): Ranked[] {
  return ranked.filter(({ job }) =>
    (f.mode !== "spring" || isFirstYearProgramme(job.employmentType)) &&
    (!f.a || job.archetype === f.a) &&
    (!f.loc || classifyRegion(job.location, job.remote) === f.loc) &&
    (!f.soon || (!job.curated && isValidDate(job.deadline) && daysUntil(job.deadline, today) <= CLOSING_SOON_DAYS)));
}

/** Builds a /feed href that keeps the other filters, toggling one param. */
export function feedHref(f: FeedFilters, change: Partial<{ a: Archetype | null; loc: LocationFilter | null; soon: boolean; mode: FeedMode | null }>): string {
  const n = { ...f, ...change };
  const q = new URLSearchParams();
  if (n.a) q.set("a", n.a);
  if (n.loc) q.set("loc", n.loc);
  if (n.soon) q.set("soon", "1");
  if (n.mode) q.set("mode", n.mode);
  const s = q.toString();
  return s ? `/feed?${s}` : "/feed";
}
