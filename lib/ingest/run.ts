import type { RawJob, Requirement } from "@/lib/types";
import type { Ats, CompanySeed } from "./providers";
import { htmlToLines } from "@/lib/text/jd";
import { passesTitleFilter, detectCohortClash, passesLocationFilter } from "./filter";
import { normalizeUrl, jobFingerprint, contentHash } from "./fingerprint";
import { heuristicTagJob } from "@/lib/ai/heuristics";
import type { TaggedJob } from "@/lib/ai/tagJob";
import { resolveDeadline, type DeadlineSource } from "./deadline";

export type CompanyRow = { id: number; slug: string; name: string; ats: Ats; api_host: string | null; employer: string | null; transport: "stealth" | null; enabled: boolean };

export type JobRow = {
  company_id: number; ext_id: string; title: string; url: string; location: string; remote: boolean;
  deadline: string | null; deadline_source: DeadlineSource | null; rolling: boolean; closed_at: null; posted_at: string | null; opens_on: string | null; archetype: string; field_tags: string[];
  year_eligibility: string[]; sponsors_visa: string; employment_type: string; first_year_friendly: boolean; cohort_clash: boolean;
  requirements: Requirement[]; skills: string[]; summary: string; raw_html: string; text_lines: string[];
  fingerprint: string; content_hash: string; tag_status: "ok" | "failed" | "pending"; is_live: boolean; last_seen: string;
};

export interface IngestStore {
  existing(companyId: number): Promise<Map<string, { content_hash: string | null; tag_status: string }>>;
  upsert(rows: JobRow[]): Promise<void>;
  touch(companyId: number, extIds: string[]): Promise<void>;
  markDead(companyId: number, liveExtIds: string[]): Promise<number>;
}

export type IngestDeps = {
  fetchJobs: (c: CompanySeed) => Promise<RawJob[]>;
  tagJob: (i: { title: string; textLines: string[] }) => Promise<TaggedJob>;
  store: IngestStore;
  now?: () => Date;
  /** Max tagJob calls per company per run; further jobs are stored heuristically as tag_status "pending". */
  maxTags?: number;
};

export const MAX_TAGS_PER_COMPANY = 25;
/** Bump to force every job to be re-processed once (e.g. after changing deterministic extraction). */
export const HASH_VERSION = "v2";

/** Versioned, and includes the ATS close date: an extended deadline with an unchanged JD must still re-process. */
export function jobContentHash(j: Pick<RawJob, "title" | "deadline" | "opensOn">, text: string): string {
  return contentHash(`${HASH_VERSION}\n${j.title}\n${j.deadline ?? ""}\n${j.opensOn ?? ""}\n${text}`);
}

export async function ingestCompany(c: CompanyRow, deps: IngestDeps) {
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const raw = await deps.fetchJobs({ slug: c.slug, name: c.name, ats: c.ats, apiHost: c.api_host, employer: c.employer, transport: c.transport });
  const existing = await deps.store.existing(c.id);
  const keptIds: string[] = [];
  const unchanged: string[] = [];
  const rows: JobRow[] = [];
  let tagged = 0, failed = 0, pending = 0;
  const maxTags = deps.maxTags ?? MAX_TAGS_PER_COMPANY;

  for (const j of raw) {
    if (!passesTitleFilter(j.title)) continue;
    const cohortClash = detectCohortClash(j.title);
    const lines = htmlToLines(j.html);
    const text = lines.join("\n");
    if (!passesLocationFilter(j.location, j.remote, text).pass) continue;
    keptIds.push(j.extId);
    const hash = jobContentHash(j, text);
    const prev = existing.get(j.extId);
    if (prev && prev.content_hash === hash && prev.tag_status === "ok") {
      unchanged.push(j.extId); // only "ok" is skipped; "failed" and "pending" are retried
      continue;
    }
    let t: TaggedJob;
    let status: JobRow["tag_status"];
    if (tagged >= maxTags) {
      t = heuristicTagJob({ title: j.title, textLines: lines });
      status = "pending";
      pending++;
    } else {
      t = await deps.tagJob({ title: j.title, textLines: lines });
      status = t.status;
      tagged++;
      if (t.status === "failed") failed++;
    }
    // Dates are deterministic only; the tagger's (possibly LLM) deadline is ignored on purpose.
    const dl = resolveDeadline(j.deadline, text, j.postedAt ? new Date(j.postedAt) : new Date(now));
    rows.push({
      company_id: c.id, ext_id: j.extId, title: j.title, url: normalizeUrl(j.url), location: j.location, remote: j.remote,
      deadline: dl.deadline, deadline_source: dl.source, rolling: dl.rolling, closed_at: null, posted_at: j.postedAt, opens_on: j.opensOn ?? null, archetype: t.archetype, field_tags: t.fieldTags,
      year_eligibility: t.yearEligibility, sponsors_visa: t.sponsorsVisa, employment_type: t.employmentType,
      first_year_friendly: t.firstYearFriendly, cohort_clash: cohortClash, requirements: t.requirements,
      skills: [...new Set(t.requirements.map((r) => r.skill).filter((s): s is string => Boolean(s)))],
      summary: t.summary, raw_html: j.html, text_lines: lines, fingerprint: jobFingerprint(c.slug, j.title, j.location),
      content_hash: hash, tag_status: status, is_live: true, last_seen: now,
    });
  }
  if (rows.length) await deps.store.upsert(rows);
  if (unchanged.length) await deps.store.touch(c.id, unchanged);
  const dead = await deps.store.markDead(c.id, keptIds);
  return { fetched: raw.length, kept: keptIds.length, tagged, failed, pending, dead };
}
