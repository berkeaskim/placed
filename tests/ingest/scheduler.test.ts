import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ingest/providers", () => ({ fetchJobs: vi.fn(async () => []) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { db, resetDbForTests } from "@/lib/db/client";
import { appSettings, companies } from "@/lib/db/schema";
import { setSetting } from "@/lib/settings/store";
import { lastIngestAt } from "@/lib/ingest/local";
import { ingestDue, ingestIntervalHours, ingestTick, nextIngestAt, schedulerEnabled, setIngestIntervalHours } from "@/lib/ingest/scheduler";

let dir: string;
const prev = { dir: process.env.PLACED_DATA_DIR, env: process.env.INGEST_INTERVAL_HOURS };
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-sched-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
  db.insert(companies).values({ slug: "acme", name: "Acme", ats: "lever" }).run();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prev.dir;
  if (prev.env === undefined) delete process.env.INGEST_INTERVAL_HOURS;
  else process.env.INGEST_INTERVAL_HOURS = prev.env;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  db.delete(appSettings).run();
  delete process.env.INGEST_INTERVAL_HOURS;
});

const H = 3_600_000;
const lastRun = (iso: string) =>
  setSetting("ingest.lastRun", JSON.stringify({ companies: 1, failed: 0, kept: 0, newJobs: 0, dead: 0, aiTagging: false, startedAt: iso, finishedAt: iso }));

describe("interval", () => {
  it("setting > INGEST_INTERVAL_HOURS > 6; junk falls through", () => {
    expect(ingestIntervalHours()).toBe(6);
    process.env.INGEST_INTERVAL_HOURS = "12";
    expect(ingestIntervalHours()).toBe(12);
    process.env.INGEST_INTERVAL_HOURS = "-1";
    expect(ingestIntervalHours()).toBe(6);
    setIngestIntervalHours(0);
    expect(ingestIntervalHours()).toBe(0);
    expect(() => setIngestIntervalHours(5)).toThrow();
  });
});

describe("due", () => {
  it("never run → due now; recent → due at last + interval; off → never", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(nextIngestAt(now)).toBe(new Date(now).toISOString());
    expect(ingestDue(now)).toBe(true);
    lastRun(new Date(now - 2 * H).toISOString());
    expect(nextIngestAt(now)).toBe(new Date(now + 4 * H).toISOString());
    expect(ingestDue(now)).toBe(false);
    expect(ingestDue(now + 4 * H)).toBe(true);
    setIngestIntervalHours(0);
    expect(nextIngestAt(now)).toBeNull();
    expect(ingestDue(now + 100 * H)).toBe(false);
  });
});

describe("schedulerEnabled", () => {
  it("off under vitest and fixture e2e unless forced", () => {
    expect(schedulerEnabled({ VITEST: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(schedulerEnabled({ AI_MODE: "fixture" } as NodeJS.ProcessEnv)).toBe(false);
    expect(schedulerEnabled({ VITEST: "true", INGEST_SCHEDULER: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(schedulerEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(schedulerEnabled({ INGEST_SCHEDULER: "0" } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("ingestTick", () => {
  it("runs when due, skips when not, waits for a live lock", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await ingestTick()).toBe("ran");
    expect(lastIngestAt()).not.toBeNull();
    expect(await ingestTick()).toBe("skipped");
    setSetting("ingest.lastRun", null);
    setSetting("ingest.lock", JSON.stringify({ pid: process.pid, at: Date.now(), token: "x" }));
    expect(await ingestTick()).toBe("busy");
  });
});
