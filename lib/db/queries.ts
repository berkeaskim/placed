import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { Archetype, ArchetypeScore, JobForScoring, ParsedCV, Region, StudentProfile, Year } from "@/lib/types";
import { db } from "@/lib/db/client";
import { companies, cvs, jobs, profiles } from "@/lib/db/schema";

export type ProfileRow = {
  user_id: string; display_name: string | null; year: Year | null; grad_year: number | null; field: string | null; course: string | null; location_pref: Region[];
  needs_visa: boolean; target_archetype: Archetype | null; archetypes: ArchetypeScore[]; skills: string[];
  onboarded: boolean; xp: number; level: number; streak_days: number; last_active_date: string | null;
};

export async function getProfile(userId: string): Promise<ProfileRow> {
  const row = db.select().from(profiles).where(eq(profiles.user_id, userId)).get();
  if (!row) throw new Error(`profile ${userId} not found`);
  return row;
}

export function toStudent(p: ProfileRow): StudentProfile {
  return {
    year: p.year ?? "2nd",
    gradYear: p.grad_year ?? null,
    locationPref: p.location_pref ?? [],
    needsVisa: p.needs_visa,
    archetypes: [...(p.archetypes ?? [])].sort((a, b) => b.score - a.score),
    skills: p.skills ?? [],
  };
}

/** `rolling`: the posting says it may close early. */
export type JobListItem = JobForScoring & { company: string; url: string; summary: string; extId: string; rolling?: boolean; opensOn?: string | null; curated?: boolean };

const JOB_COLUMNS = {
  id: jobs.id, ext_id: jobs.ext_id, title: jobs.title, url: jobs.url, location: jobs.location, remote: jobs.remote, deadline: jobs.deadline,
  posted_at: jobs.posted_at, archetype: jobs.archetype, year_eligibility: jobs.year_eligibility, sponsors_visa: jobs.sponsors_visa,
  employment_type: jobs.employment_type, first_year_friendly: jobs.first_year_friendly, cohort_clash: jobs.cohort_clash,
  requirements: jobs.requirements, text_lines: jobs.text_lines, summary: jobs.summary, rolling: jobs.rolling, opens_on: jobs.opens_on, company: companies.name, ats: companies.ats, employer: companies.employer,
};

const jobQuery = () => db.select(JOB_COLUMNS).from(jobs).leftJoin(companies, eq(companies.id, jobs.company_id));
type JobDbRow = Awaited<ReturnType<ReturnType<typeof jobQuery>["all"]>>[number];

function toJob(r: JobDbRow): JobListItem {
  return {
    id: r.id, extId: r.ext_id, title: r.title, url: r.url, location: r.location, remote: r.remote, deadline: r.deadline, postedAt: r.posted_at,
    archetype: r.archetype as JobForScoring["archetype"], yearEligibility: r.year_eligibility ?? [], sponsorsVisa: r.sponsors_visa,
    employmentType: r.employment_type as JobForScoring["employmentType"], firstYearFriendly: r.first_year_friendly, cohortClash: r.cohort_clash ?? false,
    requirements: r.requirements ?? [], textLines: r.text_lines ?? [], summary: r.summary, company: r.company ?? "", rolling: r.rolling === true,
    opensOn: r.opens_on ?? null, curated: r.ats === "curated",
  };
}

export const LIVE_JOBS_MAX = 5000;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Live jobs that have not closed. `today` is the London day; a job closing today is still returned. */
export async function getLiveJobs(today: string): Promise<JobListItem[]> {
  if (!ISO_DAY.test(today)) throw new Error("expected a YYYY-MM-DD date");
  const rows = jobQuery()
    .where(and(eq(jobs.is_live, true), or(isNull(jobs.deadline), gte(jobs.deadline, today))))
    .orderBy(sql`${jobs.posted_at} desc nulls last`, asc(jobs.id))
    .limit(LIVE_JOBS_MAX)
    .all();
  // Curated cards are a stand-in for employers whose postings we can't read; hide them while the same employer has a live
  // one of the same kind. A live summer internship must not hide that employer's spring week card.
  const coverKey = (employer: string, type: string) => `${employer}\u0000${programmeKind(type)}`;
  const covered = new Set(rows.filter((r) => r.ats !== "curated" && r.employer).map((r) => coverKey(r.employer!, r.employment_type)));
  return rows.filter((r) => !(r.ats === "curated" && r.employer && covered.has(coverKey(r.employer, r.employment_type)))).map(toJob);
}

/** Spring weeks and insight events are one kind of card; everything else (internships, graduate roles) another. */
function programmeKind(type: string): "first_year" | "other" {
  return type === "spring_week" || type === "insight" ? "first_year" : "other";
}

export async function getJob(id: string): Promise<JobListItem | null> {
  const row = jobQuery().where(eq(jobs.id, id)).get();
  return row ? toJob(row) : null;
}

export async function getActiveCv(userId: string) {
  const row = db.select({ id: cvs.id, parsed_json: cvs.parsed_json, raw_text: cvs.raw_text }).from(cvs)
    .where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  return row ? { id: row.id, parsed: row.parsed_json as ParsedCV, rawText: row.raw_text } : null;
}
