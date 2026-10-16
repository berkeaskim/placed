import { revalidateTag } from "next/cache";
import { getSetting, setSetting } from "@/lib/settings/store";
import { IngestBusyError, ingestRunning, lastIngestAt, runIngest } from "./local";

export const INTERVAL_SETTING = "ingest.intervalHours";
export const INTERVAL_CHOICES = [0, 3, 6, 12, 24] as const;
export const DEFAULT_INTERVAL_HOURS = 6;
const CHECK_MS = 15 * 60 * 1000;
const BOOT_DELAY_MS = 15 * 1000;
const HOUR = 3_600_000;

const hours = (v: string | null | undefined) => {
  const n = v == null || v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Hours between background runs; 0 = off. The settings page wins over INGEST_INTERVAL_HOURS, which wins over 6. */
export function ingestIntervalHours(): number {
  return hours(getSetting(INTERVAL_SETTING)) ?? hours(process.env.INGEST_INTERVAL_HOURS) ?? DEFAULT_INTERVAL_HOURS;
}

export function setIngestIntervalHours(h: number): void {
  if (!(INTERVAL_CHOICES as readonly number[]).includes(h)) throw new Error("unsupported interval");
  setSetting(INTERVAL_SETTING, String(h));
}

/** When the next background run is due (ISO), null when scheduling is off. Overdue (or never run) → now. */
export function nextIngestAt(now = Date.now()): string | null {
  const h = ingestIntervalHours();
  if (h === 0) return null;
  const last = lastIngestAt();
  const due = last ? Date.parse(last) + h * HOUR : now;
  return new Date(Math.max(due, now)).toISOString();
}

export function ingestDue(now = Date.now()): boolean {
  const next = nextIngestAt(now);
  return next !== null && Date.parse(next) <= now;
}

/** Off under vitest and fixture-mode e2e unless INGEST_SCHEDULER=1; INGEST_SCHEDULER=0 turns it off anywhere. */
export function schedulerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.INGEST_SCHEDULER === "1") return true;
  if (env.INGEST_SCHEDULER === "0") return false;
  return !env.VITEST && env.AI_MODE !== "fixture";
}

/** One scheduler check: runs the ingest when due and nobody else is running it. */
export async function ingestTick(now = Date.now()): Promise<"ran" | "skipped" | "busy"> {
  if (!ingestDue(now)) return "skipped";
  if (ingestRunning()) return "busy";
  try {
    const s = await runIngest();
    console.log(`[ingest] background run: ${s.newJobs} new jobs from ${s.companies - s.failed}/${s.companies} companies`);
    try { revalidateTag("jobs", { expire: 0 }); } catch { /* outside a request; the feed keys its cache on the last run anyway */ }
    return "ran";
  } catch (e) {
    if (e instanceof IngestBusyError) return "busy";
    console.error("[ingest] background run failed", e instanceof Error ? e.message : e);
    return "skipped";
  }
}

const g = globalThis as typeof globalThis & { __placedIngestScheduler?: boolean };

/** Starts the background job search in this (Next server) process: a check shortly after boot, then every 15 minutes. */
export function startIngestScheduler(): void {
  if (g.__placedIngestScheduler || !schedulerEnabled()) return;
  g.__placedIngestScheduler = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await ingestTick(); } finally { running = false; }
  };
  setTimeout(tick, BOOT_DELAY_MS).unref();
  setInterval(tick, CHECK_MS).unref();
}
