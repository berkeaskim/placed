import { describe, it, expect, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, profiles, xpEvents } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import { resetGamify, seedJob, U, withTempDb } from "../../gamify/temp-db";

/**
 * Real SQLite: the partial unique indexes on xp_events are the idempotency gate, and each award runs in one
 * synchronous IMMEDIATE transaction (reads, event row, xp increment, profile, badges).
 */
withTempDb(() => resetGamify());
afterEach(() => { vi.useRealTimers(); });

const profile = () => db.select().from(profiles).where(eq(profiles.user_id, U)).get()!;
const events = () => db.select().from(xpEvents).all();
const jobs = (n: number) => Array.from({ length: n }, () => seedJob());
function seedEvents(n: number, created_at: string) {
  for (const j of jobs(n)) db.insert(xpEvents).values({ user_id: U, type: "job_saved", xp: 5, job_id: j, created_at }).run();
}

describe("awardXP idempotency", () => {
  it("same once-per-user event twice → XP awarded once, second is a zero no-op", async () => {
    const a = await awardXP(U, { type: "onboarding_complete" });
    const b = await awardXP(U, { type: "onboarding_complete" });
    expect(a.xpGained).toBe(50);
    expect(b).toMatchObject({ xpGained: 0, newXp: 50, levelUp: false, newBadges: [] });
    expect(profile().xp).toBe(50);
    expect(events().filter((e) => e.type === "onboarding_complete")).toHaveLength(1);
  });
  it("same (type, job) twice → once; different job → pays again", async () => {
    const [j1, j2] = jobs(2);
    await awardXP(U, { type: "applied", fitLabel: "Strong fit" }, j1);
    const dup = await awardXP(U, { type: "applied", fitLabel: "Strong fit" }, j1);
    const other = await awardXP(U, { type: "applied", fitLabel: "Strong fit" }, j2);
    expect(dup.xpGained).toBe(0);
    expect(other.xpGained).toBe(50);
    expect(profile().xp).toBe(100);
  });
  it("concurrent duplicate awards (double click) → exactly one pays", async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => awardXP(U, { type: "quiz_done", profileComplete: true })));
    expect(rs.map((r) => r.xpGained).sort()).toEqual([0, 0, 0, 0, 100]);
    expect(profile().xp).toBe(100);
    expect(db.select().from(badges).all()).toHaveLength(1);
    expect(rs.filter((r) => r.newBadges.includes("profile_pro"))).toHaveLength(1);
  });
  it("concurrent distinct awards never lose XP", async () => {
    await Promise.all(jobs(8).map((j) => awardXP(U, { type: "job_saved" }, j)));
    expect(profile().xp).toBe(40);
    expect(events().map((e) => e.xp)).toEqual(Array(8).fill(5));
  });
  it("the day's 11th save inserts a zero-XP event and leaves XP alone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    resetGamify({ xp: 50, last_active_date: "2026-10-13" });
    seedEvents(10, "2026-10-13T09:00:00.000Z");
    const r = await awardXP(U, { type: "job_saved" }, seedJob());
    expect(r.xpGained).toBe(0);
    expect(profile().xp).toBe(50);
    expect(events()).toHaveLength(11);
  });
  it("saves made before London midnight don't count toward today's cap (BST)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-02T08:00:00Z"));
    resetGamify({ xp: 50, last_active_date: "2026-07-01" });
    seedEvents(10, "2026-07-01T22:30:00.000Z"); // 23:30 BST on 07-01
    const r = await awardXP(U, { type: "job_saved" }, seedJob());
    expect(r.xpGained).toBe(5);
    expect(r.streakDays).toBe(1);
  });
  it("saves made after London midnight but before UTC midnight count toward today (BST)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-02T08:00:00Z"));
    resetGamify({ xp: 50, last_active_date: "2026-07-02" });
    seedEvents(10, "2026-07-01T23:30:00.000Z"); // 00:30 BST on 07-02
    expect((await awardXP(U, { type: "job_saved" }, seedJob())).xpGained).toBe(0);
  });
  it("persists streak and last_active_date using the London day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-01T23:05:00Z")); // 00:05 BST 07-02
    resetGamify({ streak_days: 3, last_active_date: "2026-07-01" });
    const r = await awardXP(U, { type: "cv_tailored" }, seedJob());
    expect(r.streakDays).toBe(4);
    expect(profile()).toMatchObject({ streak_days: 4, last_active_date: "2026-07-02" });
  });
  it("level written to the profile matches the new XP", async () => {
    resetGamify({ xp: 95 });
    const r = await awardXP(U, { type: "job_saved" }, seedJob());
    expect(r).toMatchObject({ newXp: 100, level: 2, levelName: "Applicant", levelUp: true });
    expect(profile().level).toBe(2);
  });
  it("levelUp is reported once when two awards cross the boundary together", async () => {
    resetGamify({ xp: 95 });
    const rs = await Promise.all(jobs(2).map((j) => awardXP(U, { type: "job_saved" }, j)));
    expect(profile().xp).toBe(105);
    expect(rs.filter((r) => r.levelUp)).toHaveLength(1);
  });
  it("first_shot is reported as newly unlocked to exactly one of two concurrent applications", async () => {
    const rs = await Promise.all(jobs(2).map((j) => awardXP(U, { type: "applied", fitLabel: "Good fit" }, j)));
    expect(db.select().from(badges).all()).toHaveLength(1);
    expect(rs.filter((r) => r.newBadges.includes("first_shot"))).toHaveLength(1);
  });
  it("a readable CV after an image-only first upload still unlocks profile_pro", async () => {
    await awardXP(U, { type: "cv_uploaded", profileComplete: false });
    expect(events()).toHaveLength(0);
    expect(profile().xp).toBe(0);
    const second = await awardXP(U, { type: "cv_uploaded", profileComplete: true });
    expect(second.newBadges).toContain("profile_pro");
    expect(second.xpGained).toBe(100);
  });
  it("playbook_done is once per ref", async () => {
    const a = await awardXP(U, { type: "playbook_done", ref: "PB-DAT-P01" });
    const b = await awardXP(U, { type: "playbook_done", ref: "PB-DAT-P01" });
    const c = await awardXP(U, { type: "playbook_done", ref: "PB-DAT-P02" });
    expect([a.xpGained, b.xpGained, c.xpGained]).toEqual([40, 0, 40]);
  });
  it("rejects job events without a jobId before any write", async () => {
    for (const type of ["job_saved", "cv_tailored", "applied", "interview", "rejected", "offer"] as const) {
      await expect(awardXP(U, { type })).rejects.toThrow(/jobId/);
    }
    expect(events()).toHaveLength(0);
  });
});
