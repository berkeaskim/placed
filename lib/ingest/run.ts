import type { RawJob, Requirement } from "@/lib/types";
import type { Ats, CompanySeed } from "./providers";
import { htmlToLines } from "@/lib/text/jd";
import { passesTitleFilter, detectCohortClash, passesLocationFilter } from "./filter";
import { normalizeUrl, jobFingerprint, contentHash } from "./fingerprint";
import { heuristicTagJob } from "@/lib/ai/heuristics";
import type { TaggedJob } from "@/lib/ai/tagJob";

export type CompanyRow = { id: number; slug: string; name: string; ats: Ats; api_host: string | null; enabled: boolean };

export type JobRow = {
  company_id: number; ext_id: string; title: string; url: string; location: string; remote: boolean;
  deadline: string | null; posted_at: string | null; archetype: string; field_tags: string[];
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

export async function ingestCompany(c: CompanyRow, deps: IngestDeps) {
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const raw = await deps.fetchJobs({ slug: c.slug, name: c.name, ats: c.ats, apiHost: c.api_host });
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
    const hash = contentHash(j.title + "\n" + text);
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
    rows.push({
      company_id: c.id, ext_id: j.extId, title: j.title, url: normalizeUrl(j.url), location: j.location, remote: j.remote,
      deadline: j.deadline ?? t.deadline, posted_at: j.postedAt, archetype: t.archetype, field_tags: t.fieldTags,
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
