import type { SupabaseClient } from "@supabase/supabase-js";
import type { Archetype, ArchetypeScore, JobForScoring, ParsedCV, Region, StudentProfile, Year } from "@/lib/types";

export type ProfileRow = {
  user_id: string; display_name: string | null; year: Year | null; field: string | null; location_pref: Region[];
  needs_visa: boolean; target_archetype: Archetype | null; archetypes: ArchetypeScore[]; skills: string[];
  onboarded: boolean; xp: number; level: number; streak_days: number; last_active_date: string | null;
};

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data as ProfileRow;
}

export function toStudent(p: ProfileRow): StudentProfile {
  return {
    year: p.year ?? "2nd",
    locationPref: p.location_pref ?? [],
    needsVisa: p.needs_visa,
    archetypes: [...(p.archetypes ?? [])].sort((a, b) => b.score - a.score),
    skills: p.skills ?? [],
  };
}

/** `rolling`: the posting says it may close early (migration 0004); false when the column is missing. */
export type JobListItem = JobForScoring & { company: string; url: string; summary: string; extId: string; rolling?: boolean };

type JobDbRow = {
  id: string; ext_id: string; title: string; url: string; location: string; remote: boolean; deadline: string | null; posted_at: string | null;
  archetype: JobForScoring["archetype"]; year_eligibility: JobForScoring["yearEligibility"]; sponsors_visa: JobForScoring["sponsorsVisa"];
  employment_type: JobForScoring["employmentType"]; first_year_friendly: boolean; cohort_clash: boolean | null; requirements: JobForScoring["requirements"];
  text_lines: string[]; summary: string; companies: { name: string } | null; rolling?: boolean | null;
};

// Excludes deadline_source / closed_at (migration 0004). `rolling` (also 0004) is asked for, with a retry without it
// when the column is missing, so the feed still works on a DB where 0004 was never applied.
const JOB_COLUMNS_BASE = "id, ext_id, title, url, location, remote, deadline, posted_at, archetype, year_eligibility, sponsors_visa, employment_type, first_year_friendly, cohort_clash, requirements, text_lines, summary, companies(name)";
const JOB_COLUMNS = `${JOB_COLUMNS_BASE}, rolling`;

/** "column does not exist": Postgres 42703 or PostgREST PGRST204 (schema cache). */
const isMissingColumn = (e: { code?: string } | null | undefined) => !!e && (e.code === "42703" || e.code === "PGRST204");

/** Runs `query` with `rolling`, and once more without it if that column is missing. */
async function withRollingFallback<R extends { error: { code?: string } | null }>(query: (columns: string) => PromiseLike<R>): Promise<R> {
  const first = await query(JOB_COLUMNS);
  if (!isMissingColumn(first.error)) return first;
  return query(JOB_COLUMNS_BASE);
}

function toJob(r: JobDbRow): JobListItem {
  return {
    id: r.id, extId: r.ext_id, title: r.title, url: r.url, location: r.location, remote: r.remote, deadline: r.deadline, postedAt: r.posted_at,
    archetype: r.archetype, yearEligibility: r.year_eligibility ?? [], sponsorsVisa: r.sponsors_visa, employmentType: r.employment_type,
    firstYearFriendly: r.first_year_friendly, cohortClash: r.cohort_clash ?? false, requirements: r.requirements ?? [], textLines: r.text_lines ?? [],
    summary: r.summary, company: r.companies?.name ?? "", rolling: r.rolling === true,
  };
}

/** Live jobs that have not closed. `today` is the London day; a job closing today is still returned. */
export async function getLiveJobs(supabase: SupabaseClient, today: string): Promise<JobListItem[]> {
  const { data, error } = await withRollingFallback((cols) => supabase.from("jobs").select(cols).eq("is_live", true)
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("posted_at", { ascending: false, nullsFirst: false }).order("id").limit(500));
  if (error) throw error;
  return ((data ?? []) as unknown as JobDbRow[]).map(toJob);
}

export async function getJob(supabase: SupabaseClient, id: string): Promise<JobListItem | null> {
  const { data } = await withRollingFallback((cols) => supabase.from("jobs").select(cols).eq("id", id).maybeSingle());
  return data ? toJob(data as unknown as JobDbRow) : null;
}

export async function getActiveCv(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("cvs").select("id, parsed_json, raw_text").eq("user_id", userId).eq("is_active", true).maybeSingle();
  return data ? { id: data.id as string, parsed: data.parsed_json as ParsedCV, rawText: data.raw_text as string } : null;
}
