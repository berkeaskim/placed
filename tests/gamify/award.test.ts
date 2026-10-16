import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles, xpEvents } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import { resetGamify, seedJob, U, useTempDb } from "./temp-db";

useTempDb(() => resetGamify({ xp: 40, streak_days: 2, last_active_date: "2026-01-01" }));
const xp = () => db.select().from(profiles).where(eq(profiles.user_id, U)).get()!.xp;

describe("awardXP", () => {
  it("awards once and increments the stored XP", async () => {
    const j = seedJob();
    const r = await awardXP(U, { type: "job_saved" }, j);
    expect(r).toMatchObject({ xpGained: 5, newXp: 45 });
    expect(xp()).toBe(45);
    expect(db.select().from(xpEvents).all()).toMatchObject([{ type: "job_saved", xp: 5, job_id: j }]);
  });
  it("returns zero XP on a duplicate (unique index) without incrementing", async () => {
    const j = seedJob();
    await awardXP(U, { type: "job_saved" }, j);
    const r = await awardXP(U, { type: "job_saved" }, j);
    expect(r).toMatchObject({ xpGained: 0, newXp: 45, newBadges: [] });
    expect(xp()).toBe(45);
  });
  it("throws on a missing jobId and a missing profile", async () => {
    await expect(awardXP(U, { type: "applied" })).rejects.toThrow(/jobId/);
    db.delete(profiles).run();
    await expect(awardXP(U, { type: "quiz_done" })).rejects.toThrow(/profile/);
    expect(db.select().from(xpEvents).all()).toHaveLength(0);
  });
});
