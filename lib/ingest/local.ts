import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings, companies, ingestState, jobs } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings/store";
import { aiMode } from "@/lib/ai/config";
import { tagJob as liveTagJob } from "@/lib/ai/tagJob";
import { fetchJobs as liveFetchJobs } from "./providers";
import { ingestCompany, type CompanyRow, type IngestDeps } from "./run";
import { sqliteStore } from "./store";

export type IngestProgress = { done: number; total: number; slug: string; line: string; error: boolean };
export type IngestSummary = {
  companies: number; failed: number; kept: number; newJobs: number; dead: number; aiTagging: boolean; startedAt: string; finishedAt: string;
};
export type RunIngestOptions = {
  /** Only this ATS (`npm run ingest -- workday`). */
  ats?: string;
  concurrency?: number;
  onProgress?: (p: IngestProgress) => void;
  /** Test seams; default to the live providers and tagger. */
  fetchJobs?: IngestDeps["fetchJobs"];
  tagJob?: IngestDeps["tagJob"];
};

export class IngestBusyError extends Error {
  constructor() { super("A job refresh is already running."); }
}

/** A lock older than this is treated as left behind by a crashed run. */
const STALE_LOCK_MS = 2 * 60 * 60 * 1000;
const LOCK_KEY = "ingest.lock";
const LAST_RUN_KEY = "ingest.lastRun";

type Lock = { pid: number; at: number; token: string };

function isLive(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const { pid, at } = JSON.parse(raw) as Lock;
    if (Date.now() - at > STALE_LOCK_MS) return false;
    process.kill(pid, 0); // throws when that process is gone
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"; // alive, owned by someone else
  }
}

const lockRow = (tx: Pick<typeof db, "select"> = db) =>
  tx.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, LOCK_KEY)).get()?.value;

/**
 * Single-flight across processes: the Refresh button, the background scheduler (both in the Next server) and
 * `npm run ingest` share one lock row in app_settings. null when a live run holds it.
 */
function acquireLock(): (() => void) | null {
  const token = crypto.randomUUID();
  const value = JSON.stringify({ pid: process.pid, at: Date.now(), token } satisfies Lock);
  const got = db.transaction((tx) => {
    if (isLive(lockRow(tx))) return false;
    tx.insert(appSettings).values({ key: LOCK_KEY, value, updated_at: new Date().toISOString() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: new Date().toISOString() } }).run();
    return true;
  }, { behavior: "immediate" });
  if (!got) return null;
  return () => {
    db.delete(appSettings).where(and(eq(appSettings.key, LOCK_KEY), sql`json_extract(${appSettings.value}, '$.token') = ${token}`)).run();
  };
}

export function ingestRunning(): boolean {
  return isLive(lockRow());
}

/** When the last full run finished (also written to ingest_state.updated_at, which migrations seed with their own time). */
export function lastIngestAt(): string | null {
  return lastIngestSummary()?.finishedAt ?? null;
}

/** The last run's summary, null before the first run. */
export function lastIngestSummary(): IngestSummary | null {
  const raw = getSetting(LAST_RUN_KEY);
  try {
    return raw ? (JSON.parse(raw) as IngestSummary) : null;
  } catch {
    return null;
  }
}

/**
 * The ingest pipeline: every enabled company, a few at a time, one failure never stops the rest. Without a live AI
 * provider, jobs are stored with the heuristic tagger as "pending", so the first run after an AI is set up re-tags them.
 * Throws IngestBusyError when another run (this process or another) is in progress.
 */
export async function runIngest(o: RunIngestOptions = {}): Promise<IngestSummary> {
  const release = acquireLock();
  if (!release) throw new IngestBusyError();
  try {
    const startedAt = new Date().toISOString();
    const aiTagging = aiMode() === "live";
    const list = db.select().from(companies)
      .where(and(eq(companies.enabled, true), o.ats ? eq(companies.ats, o.ats as CompanyRow["ats"]) : undefined))
      .orderBy(asc(companies.id)).all() as CompanyRow[];
    const deps: IngestDeps = {
      fetchJobs: o.fetchJobs ?? liveFetchJobs,
      tagJob: o.tagJob ?? liveTagJob,
      store: sqliteStore(),
      ...(aiTagging ? {} : { maxTags: 0 }),
    };
    const queue = [...list];
    let done = 0, failed = 0, kept = 0, dead = 0;
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        let line: string, error = false;
        try {
          const r = await ingestCompany(c, deps);
          kept += r.kept;
          dead += r.dead;
          line = `fetched=${r.fetched} kept=${r.kept} tagged=${r.tagged} pending=${r.pending} failed=${r.failed} dead=${r.dead}${r.heldEmpty ? " (empty listing: jobs held open until it is empty again)" : ""}`;
        } catch (e) {
          failed++;
          error = true;
          line = `ERROR ${(e as Error).message}`;
        }
        o.onProgress?.({ done: ++done, total: list.length, slug: c.slug, line, error });
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 3) }, worker));
    const newJobs = db.select({ n: count() }).from(jobs).where(gte(jobs.first_seen, startedAt)).get()?.n ?? 0;
    const finishedAt = new Date().toISOString();
    const summary: IngestSummary = { companies: list.length, failed, kept, newJobs, dead, aiTagging, startedAt, finishedAt };
    // A full run that reached at least one company counts; a one-ATS run or an offline one (all failed) doesn't.
    if (!o.ats && failed < list.length) {
      db.update(ingestState).set({ cursor: 0, updated_at: finishedAt }).where(eq(ingestState.id, 1)).run();
      setSetting(LAST_RUN_KEY, JSON.stringify(summary));
    }
    return summary;
  } finally {
    release();
  }
}
