import type { RawJob, Requirement } from "@/lib/types";
import type { Ats, CompanySeed } from "./providers";
import { htmlToLines } from "@/lib/text/jd";
import { passesTitleFilter, detectCohortClash, passesLocationFilter, placementRegion } from "./filter";
import { normalizeUrl, jobFingerprint, contentHash } from "./fingerprint";
import { heuristicTagJob } from "@/lib/ai/heuristics";
import { reconcileProgramme } from "./spring-week";
import type { TaggedJob } from "@/lib/ai/tagJob";
import { resolveDeadline, extractDeadline, type DeadlineSource } from "./deadline";

export type CompanyRow = { id: number; slug: string; name: string; ats: Ats; api_host: string | null; employer: string | null; transport: "stealth" | null; enabled: boolean };

export type JobRow = {
  company_id: number; ext_id: string; title: string; employer_name: string | null; url: string; location: string; remote: boolean;
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
  /** Consecutive runs whose raw listing was empty, persisted per company. */
  emptyRuns(companyId: number): Promise<number>;
  setEmptyRuns(companyId: number, n: number): Promise<void>;
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
/**
 * An empty listing closes the board's live jobs only once it has come back empty this many runs in a row. A single
 * empty 200 is as likely a transient ATS glitch as a real "nothing open", and closing on it would wipe the board.
 */
export const EMPTY_RUNS_TO_CLOSE = 2;
/** Bump to force every job to be re-processed once (e.g. after changing deterministic extraction). */
export const HASH_VERSION = "v4"; // v3: spring-week classifier; v4: placement classifier (lib/ingest/placement.ts)

/**
 * Versioned, and includes the ATS close date: an extended deadline with an unchanged JD must still re-process.
 * opensOn is appended only when set, so jobs without it keep their pre-opensOn hash (no mass re-tag after upgrade).
 */
export function jobContentHash(j: Pick<RawJob, "title" | "deadline" | "opensOn">, text: string): string {
  const opens = j.opensOn ? `\nopens:${j.opensOn}` : "";
  return contentHash(`${HASH_VERSION}\n${j.title}\n${j.deadline ?? ""}\n${text}${opens}`);
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
    // A listing that already labels the role (TargetJobs "Placement") skips the keyword filter; the classifier still types it.
    if (!j.sourceType && !passesTitleFilter(j.title)) continue;
    const cohortClash = detectCohortClash(j.title);
    const lines = htmlToLines(j.html);
    const text = lines.join("\n");
    if (!passesLocationFilter(j.location, j.remote, text, j.sourceType != null).pass) continue;
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
    t = reconcileProgramme(t, j.title, text, j.employmentType, placementRegion(j.location), j.sourceType, j.programme);
    // Dates are deterministic only; the tagger's (possibly LLM) deadline is ignored on purpose.
    // Curated `closes` is the inclusive last day from seed/programmes.yml: never shifted like an ATS end date, and the
    // description's prose dates (e.g. "the earliest falling on 19 October") are never read as the card's deadline.
    const dl = c.ats === "curated"
      ? { deadline: j.deadline ?? null, source: j.deadline ? ("ats" as const) : null, rolling: extractDeadline(text, new Date(now)).rolling }
      : resolveDeadline(j.deadline, text, j.postedAt ? new Date(j.postedAt) : new Date(now));
    rows.push({
      company_id: c.id, ext_id: j.extId, title: j.title, employer_name: j.employerName ?? null, url: normalizeUrl(j.url), location: j.location, remote: j.remote,
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
  // Keyed on the raw listing, not keptIds: postings that all fail the filters are a real answer, not a glitch.
  const prevEmpty = await deps.store.emptyRuns(c.id);
  const emptyRuns = raw.length ? 0 : prevEmpty + 1;
  if (emptyRuns !== prevEmpty) await deps.store.setEmptyRuns(c.id, emptyRuns);
  const heldEmpty = emptyRuns > 0 && emptyRuns < EMPTY_RUNS_TO_CLOSE;
  const dead = heldEmpty ? 0 : await deps.store.markDead(c.id, keptIds);
  return { fetched: raw.length, kept: keptIds.length, tagged, failed, pending, dead, heldEmpty };
}
