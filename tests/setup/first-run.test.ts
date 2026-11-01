import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { ensureLocalSetup } from "@/lib/setup/first-run";
import { dataDir, db } from "@/lib/db/client";
import { companies, jobs, profiles } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";

const root = path.resolve(__dirname, "../..");
const tableCount = (t: typeof companies | typeof jobs) => db.select({ n: count() }).from(t).get()?.n ?? 0;

describe("ensureLocalSetup", () => {
  it("seeds an empty data dir: secret key, profile, companies and snapshot jobs", () => {
    expect(tableCount(jobs)).toBe(0);
    const lines: string[] = [];
    const r = ensureLocalSetup({ root, log: (l) => lines.push(l) });

    expect(existsSync(path.join(dataDir(), "secret.key"))).toBe(true);
    expect(db.select().from(profiles).where(eq(profiles.user_id, LOCAL_USER_ID)).get()).toBeTruthy();
    expect(r.companies).toBeGreaterThan(0);
    expect(r.curated).toBeGreaterThanOrEqual(0);
    expect(tableCount(companies)).toBeGreaterThan(0);
    if (existsSync(path.join(root, "seed/jobs.json"))) {
      expect(JSON.parse(readFileSync(path.join(root, "seed/jobs.json"), "utf8")).length).toBeGreaterThan(0);
      expect(r.jobsInserted).toBeGreaterThan(0);
      expect(tableCount(jobs)).toBe(r.jobsInserted);
    }
    expect(lines.some((l) => l.startsWith("companies:"))).toBe(true);
  });

  it("is idempotent: a second run keeps the same rows and inserts no jobs", () => {
    const before = { companies: tableCount(companies), jobs: tableCount(jobs) };
    const r = ensureLocalSetup({ root, log: () => {} });
    expect(r.jobsInserted).toBe(0);
    expect({ companies: tableCount(companies), jobs: tableCount(jobs) }).toEqual(before);
  });
});
