import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { Archetype, ArchetypeScore, JobForScoring, ParsedCV, PlacementStatus, Region, StudentProfile, WorkAuth, Year } from "@/lib/types";
import { needsVisaFor, workAuthOf } from "@/lib/profile/work-auth";
import { db } from "@/lib/db/client";
import { AGGREGATOR_ATS, companies, cvs, jobs, profiles } from "@/lib/db/schema";
import { normalizeUrl } from "@/lib/ingest/fingerprint";

export type ProfileRow = {
  user_id: string; display_name: string | null; year: Year | null; grad_year: number | null; placement_status?: PlacementStatus | null; field: string | null; course: string | null; location_pref: Region[];
  needs_visa: boolean; work_auth?: WorkAuth | null; target_archetype: Archetype | null; archetypes: ArchetypeScore[]; skills: string[];
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
    placementStatus: p.placement_status ?? null,
    locationPref: p.location_pref ?? [],
    needsVisa: needsVisaFor(workAuthOf(p)),
    workAuth: workAuthOf(p),
    archetypes: [...(p.archetypes ?? [])].sort((a, b) => b.score - a.score),
    skills: p.skills ?? [],
  };
}

/** `rolling`: the posting says it may close early. */
/** `via`: the multi-employer board the posting came from (e.g. "TargetJobs"); `company` is then the posting's employer. */
export type JobListItem = JobForScoring & { company: string; url: string; summary: string; extId: string; rolling?: boolean; opensOn?: string | null; curated?: boolean; via?: string | null };

const JOB_COLUMNS = {
  id: jobs.id, ext_id: jobs.ext_id, title: jobs.title, url: jobs.url, location: jobs.location, remote: jobs.remote, deadline: jobs.deadline,
  posted_at: jobs.posted_at, archetype: jobs.archetype, year_eligibility: jobs.year_eligibility, sponsors_visa: jobs.sponsors_visa,
  employment_type: jobs.employment_type, first_year_friendly: jobs.first_year_friendly, cohort_clash: jobs.cohort_clash,
  requirements: jobs.requirements, text_lines: jobs.text_lines, summary: jobs.summary, rolling: jobs.rolling, opens_on: jobs.opens_on, employer_name: jobs.employer_name, company: companies.name, ats: companies.ats, employer: companies.employer,
};

const jobQuery = () => db.select(JOB_COLUMNS).from(jobs).leftJoin(companies, eq(companies.id, jobs.company_id));
type JobDbRow = Awaited<ReturnType<ReturnType<typeof jobQuery>["all"]>>[number];

function toJob(r: JobDbRow): JobListItem {
  return {
    id: r.id, extId: r.ext_id, title: r.title, url: r.url, location: r.location, remote: r.remote, deadline: r.deadline, postedAt: r.posted_at,
    archetype: r.archetype as JobForScoring["archetype"], yearEligibility: r.year_eligibility ?? [], sponsorsVisa: r.sponsors_visa,
    employmentType: r.employment_type as JobForScoring["employmentType"], firstYearFriendly: r.first_year_friendly, cohortClash: r.cohort_clash ?? false,
    requirements: r.requirements ?? [], textLines: r.text_lines ?? [], summary: r.summary, rolling: r.rolling === true,
    company: r.employer_name ?? r.company ?? "", via: r.employer_name ? r.company ?? null : null,
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
  const shown = rows.filter((r) => !(r.ats === "curated" && r.employer && covered.has(coverKey(r.employer, r.employment_type))));
  return dropAggregatorDuplicates(shown).map(toJob);
}

const sameText = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const urlKey = (u: string) => { try { return normalizeUrl(u); } catch { return u; } };

/**
 * A multi-employer listing (TargetJobs) of a posting Placed also reads from the employer's own board is a duplicate:
 * keep the direct one (it has the real ATS link for Autopilot). Matched by application URL, or employer + title.
 */
function dropAggregatorDuplicates<R extends { ats: string | null; url: string; title: string; company: string | null; employer_name: string | null }>(rows: R[]): R[] {
  const isAgg = (r: R) => (AGGREGATOR_ATS as readonly (string | null)[]).includes(r.ats);
  const direct = rows.filter((r) => !isAgg(r));
  if (direct.length === rows.length) return rows;
  const urls = new Set(direct.map((r) => urlKey(r.url)));
  const titles = new Set(direct.map((r) => `${sameText(r.company)}|${sameText(r.title)}`));
  return rows.filter((r) => !isAgg(r) || !(urls.has(urlKey(r.url)) || titles.has(`${sameText(r.employer_name)}|${sameText(r.title)}`)));
}

/** Card kinds for hiding: spring weeks/insights, placement years, and everything else (internships, graduate roles). */
function programmeKind(type: string): "first_year" | "placement" | "other" {
  return type === "spring_week" || type === "insight" ? "first_year" : type === "placement" ? "placement" : "other";
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
