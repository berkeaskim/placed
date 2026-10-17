import { revalidateTag } from "next/cache";
import { getSetting, setSetting } from "@/lib/settings/store";
import { IngestBusyError, ingestRunning, lastIngestAt, runIngest } from "./local";
import { discoverIfDue } from "./discover";

export const INTERVAL_SETTING = "ingest.intervalHours";
/** "HH:MM" local time: a run every morning (or whenever) at that time. Set → wins over the interval. */
export const DAILY_AT_SETTING = "ingest.dailyAt";
export const DEFAULT_DAILY_AT = "07:00";
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
  setSetting(DAILY_AT_SETTING, null);
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The daily run time ("07:00"), null when the schedule is an interval. */
export function ingestDailyAt(): string | null {
  const v = getSetting(DAILY_AT_SETTING)?.trim() ?? "";
  return HHMM.test(v) ? v : null;
}

export function setIngestDailyAt(at: string): void {
  if (!HHMM.test(at)) throw new Error("unsupported time");
  setSetting(DAILY_AT_SETTING, at);
}

/** The latest moment at or before `now` when the clock read `at` (local time). */
function lastOccurrence(at: string, now: number): number {
  const [h, m] = at.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/** When the next background run is due (ISO), null when scheduling is off. Overdue (or never run) → now. */
export function nextIngestAt(now = Date.now()): string | null {
  const last = lastIngestAt();
  const at = ingestDailyAt();
  if (at) {
    // Missed the last slot (asleep, app closed) → catch up now; otherwise the next slot.
    const prev = lastOccurrence(at, now);
    if (!last || Date.parse(last) < prev) return new Date(now).toISOString();
    const next = new Date(prev);
    next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  const h = ingestIntervalHours();
  if (h === 0) return null;
  const due = last ? Date.parse(last) + h * HOUR : now;
  return new Date(Math.max(due, now)).toISOString();
}

export function ingestDue(now = Date.now()): boolean {
  const next = nextIngestAt(now);
  return next !== null && Date.parse(next) <= now;
}

/** Off under vitest and fixture-mode e2e unless INGEST_SCHEDULER=1; INGEST_SCHEDULER=0 turns it off anywhere. */
export function schedulerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.INGEST_SCHEDULER === "1") return true;
  if (env.INGEST_SCHEDULER === "0") return false;
  return !env.VITEST && env.AI_MODE !== "fixture";
}

/** One scheduler check: runs the ingest when due and nobody else is running it. */
export async function ingestTick(now = Date.now()): Promise<"ran" | "skipped" | "busy"> {
  if (!ingestDue(now)) return "skipped";
  if (ingestRunning()) return "busy";
  try {
    await discoverIfDue();
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
