import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, resetDbForTests } from "@/lib/db/client";
import { appSettings, applications, badges, companies, cvScores, cvs, jobs, outreach, OUTREACH_TARGET_VALUES, profiles, xpEvents } from "@/lib/db/schema";
import { resetUserData, USER_BUCKETS, USER_TABLES } from "@/lib/db/reset";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { ensureProfile } from "@/lib/db/functions";
import { getFile, putFile } from "@/lib/files";
import { setSetting, getSetting } from "@/lib/settings/store";

let dir: string;
const prevDir = process.env.PLACED_DATA_DIR;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-reset-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});

const U = LOCAL_USER_ID;
const TARGET = OUTREACH_TARGET_VALUES[0];
function seed() {
  ensureProfile(U, "you@localhost");
  db.update(profiles).set({ year: "2nd", field: "Economics", location_pref: ["uk"], skills: ["SQL"], onboarded: true, xp: 120, level: 2, streak_days: 3, last_active_date: "2026-10-16" })
    .where(eq(profiles.user_id, U)).run();
  const c = db.insert(companies).values({ slug: `acme-${Math.random()}`, name: "Acme", ats: "greenhouse" }).returning().get();
  const j = db.insert(jobs).values({ company_id: c.id, ext_id: "1", title: "Intern", url: "https://x" }).returning().get();
  const cv = db.insert(cvs).values({ user_id: U, storage_path: `${U}/cv.pdf`, file_size: 1, page_count: 1, raw_text: "x", parsed_json: {} as never }).returning().get();
  db.insert(cvScores).values({ cv_id: cv.id, user_id: U, sector: "consulting", total: 50, dimensions: {}, rule_results: [] }).run();
  const a = db.insert(applications).values({ user_id: U, job_id: j.id }).returning().get();
  db.insert(outreach).values({ user_id: U, application_id: a.id, job_id: j.id, company: "Acme", target: TARGET, body: "hi" }).run();
  db.insert(xpEvents).values({ user_id: U, type: "onboarding_complete", xp: 50 }).run();
  db.insert(badges).values({ user_id: U, badge_key: "first_cv" }).run();
  return j;
}

describe("resetUserData", () => {
  it("covers every user table except the shared ones, and no removed Gmail tables", () => {
    for (const t of ["cv_scores", "cvs", "confirmed_facts", "matches", "applications", "xp_events", "badges", "cv_feedback", "playbook_progress", "outreach", "autopilot_vault", "autopilot_packs", "linkedin_scores"]) {
      expect(USER_TABLES).toContain(t);
    }
    expect(USER_TABLES).not.toContain("inbox_events");
    expect(USER_TABLES.indexOf("cv_scores")).toBeLessThan(USER_TABLES.indexOf("cvs"));
    expect(USER_TABLES.indexOf("outreach")).toBeLessThan(USER_TABLES.indexOf("applications"));
    expect([...USER_BUCKETS]).toEqual(["cvs", "tailored"]);
  });

  it("wipes the user's rows and files, resets the profile, and keeps jobs, other files and settings", async () => {
    const job = seed();
    setSetting("ai.provider", "ollama");
    await putFile("cvs", `${U}/cv.pdf`, Buffer.from("%PDF"));
    await putFile("tailored", `${U}/job/cv.pdf`, Buffer.from("%PDF"));
    await putFile("cvs", "someone-else/cv.pdf", Buffer.from("%PDF"));

    await resetUserData(U);

    for (const t of [cvs, cvScores, applications, outreach, xpEvents, badges]) expect(db.select().from(t).all()).toEqual([]);
    expect(db.select().from(profiles).where(eq(profiles.user_id, U)).get()).toMatchObject({
      year: null, field: null, location_pref: [], skills: [], onboarded: false, xp: 0, level: 1, streak_days: 0, last_active_date: null,
    });
    expect(db.select().from(jobs).where(eq(jobs.id, job.id)).get()).toBeDefined();
    expect(getSetting("ai.provider")).toBe("ollama");
    expect(db.select().from(appSettings).all().length).toBeGreaterThan(0);
    expect(await getFile("cvs", `${U}/cv.pdf`)).toBeNull();
    expect(existsSync(path.join(dir, "files", "tailored", U))).toBe(false);
    expect(await getFile("cvs", "someone-else/cv.pdf")).not.toBeNull();
  });

  it("is idempotent when there is nothing to delete", async () => {
    await expect(resetUserData(U)).resolves.toBeUndefined();
  });

  it("a failed row delete rolls back every row and leaves files untouched", async () => {
    seed();
    await putFile("cvs", `${U}/cv.pdf`, Buffer.from("%PDF"));
    db.$client.exec("create trigger no_del before delete on badges begin select raise(abort, 'boom'); end");
    try {
      await expect(resetUserData(U)).rejects.toThrow(/boom/);
    } finally {
      db.$client.exec("drop trigger no_del");
    }
    expect(db.select().from(cvs).all()).toHaveLength(1);
    expect(db.select().from(profiles).where(eq(profiles.user_id, U)).get()?.onboarded).toBe(true);
    expect(await getFile("cvs", `${U}/cv.pdf`)).not.toBeNull();
  });

  it("rejects an empty or path-like user id", async () => {
    for (const bad of ["", "..", "a/b", "..\\x"]) await expect(resetUserData(bad)).rejects.toThrow();
  });
});
