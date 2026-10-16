import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { db, resetDbForTests } from "@/lib/db/client";
import { badges, companies, jobs, profiles, xpEvents } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";

/** Points the app at a fresh temp SQLite for this test file; `wipe` runs before each test. */
export function useTempDb(wipe?: () => void) {
  let dir = "";
  const prev = process.env.PLACED_DATA_DIR;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "placed-test-"));
    process.env.PLACED_DATA_DIR = dir;
    resetDbForTests();
  });
  afterAll(() => {
    resetDbForTests();
    process.env.PLACED_DATA_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  });
  if (wipe) beforeEach(wipe);
}

export const U = LOCAL_USER_ID;

export function resetGamify(p: { xp?: number; streak_days?: number; last_active_date?: string | null } = {}) {
  db.delete(xpEvents).run();
  db.delete(badges).run();
  db.delete(profiles).run();
  db.insert(profiles).values({ user_id: U, xp: 0, streak_days: 0, last_active_date: null, ...p }).run();
}

/** Inserts a company + job and returns the job id. */
export function seedJob(over: Partial<typeof jobs.$inferInsert> = {}, companyName = "Acme"): string {
  const slug = `${companyName.toLowerCase().replace(/\W+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const c = db.insert(companies).values({ slug, name: companyName, ats: "greenhouse" }).returning().get();
  return db.insert(jobs).values({ company_id: c.id, ext_id: crypto.randomUUID(), title: "Intern", url: "https://x", ...over }).returning().get().id;
}
