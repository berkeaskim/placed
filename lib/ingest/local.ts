import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import path from "node:path";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { dataDir, db } from "@/lib/db/client";
import { companies, ingestState, jobs } from "@/lib/db/schema";
import { aiMode } from "@/lib/env";
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
const lockFile = () => path.join(dataDir(), "ingest.lock");

function lockIsLive(): boolean {
  try {
    const { pid, at } = JSON.parse(readFileSync(lockFile(), "utf8")) as { pid: number; at: number };
    if (Date.now() - at > STALE_LOCK_MS) return false;
    process.kill(pid, 0); // throws when that process is gone
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"; // alive, owned by someone else
  }
}

/** Cross-process lock (the app's Refresh button and `npm run ingest` share one DB). null when a live run holds it. */
function acquireLock(): (() => void) | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockFile(), "wx");
      writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
      closeSync(fd);
      return () => rmSync(lockFile(), { force: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST" || lockIsLive()) return null;
      rmSync(lockFile(), { force: true });
    }
  }
  return null;
}

export function ingestRunning(): boolean {
  return lockIsLive();
}

/** When the last full run finished (ingest_state.updated_at). */
export function lastIngestAt(): string | null {
  return db.select({ at: ingestState.updated_at }).from(ingestState).where(eq(ingestState.id, 1)).get()?.at ?? null;
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
          line = `fetched=${r.fetched} kept=${r.kept} tagged=${r.tagged} pending=${r.pending} failed=${r.failed} dead=${r.dead}`;
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
    db.update(ingestState).set({ cursor: 0, updated_at: finishedAt }).where(eq(ingestState.id, 1)).run();
    return { companies: list.length, failed, kept, newJobs, dead, aiTagging, startedAt, finishedAt };
  } finally {
    release();
  }
}
