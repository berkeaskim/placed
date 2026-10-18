import { describe, it, expect } from "vitest";
import { db } from "@/lib/db/client";
import { xpEvents } from "@/lib/db/schema";
import { computeAward, xpFor, BADGES, type GamifyState } from "@/lib/gamify/core";
import { awardXP } from "@/lib/gamify/award";
import { resetGamify, U, withTempDb } from "./temp-db";

const base: GamifyState = { xp: 0, streakDays: 0, lastActiveDate: null, badges: [], savesToday: 0, appliedCount: 0, rejectedCount: 0 };
const today = "2026-10-13";

const term = { type: "playbook_done", ref: "A", effort: "term", signalValue: "cv_high" } as const;

describe("playbook_done XP", () => {
  it("scales with effort and evidence, for the first three per day, then 0 (06#7, 07#18)", () => {
    const s = { ...base, playbookDoneToday: 2, lastActiveDate: today };
    expect(xpFor({ ...term, effort: "weekend", signalValue: "cv_low" }, s)).toBe(15);
    expect(xpFor({ ...term, effort: "2-4 weeks", signalValue: "cv_medium" }, s)).toBe(40);
    expect(xpFor(term, s)).toBe(80);
    expect(xpFor({ ...term, hasEvidence: true }, s)).toBe(90);
    expect(xpFor(term, { ...s, playbookDoneToday: 3 })).toBe(0);
  });

  it("gives a token amount for practice that never goes on a CV, link or not", () => {
    // CFI "Careers in Finance" and Zetamac used to earn the same 40 XP as a 180DC client project
    expect(xpFor({ ...term, effort: "weekend", signalValue: "test_prep", hasEvidence: true }, base)).toBe(10);
    expect(xpFor({ ...term, signalValue: "interview_prep" }, base)).toBe(10);
  });

  it("awards Gap Closer only for a step that built a gap skill; otherwise First Step (06#8)", () => {
    const fallback = computeAward(base, term, today);
    expect(fallback.result.newBadges).toEqual(["first_step"]);
    const closer = computeAward(fallback.next, { ...term, ref: "B", closesGap: true }, today);
    expect(closer.result.newBadges).toEqual(["gap_closer"]);
    const again = computeAward(closer.next, { ...term, ref: "C", closesGap: true }, today);
    expect(again.result.newBadges).toEqual([]);
    expect(again.next.playbookDoneToday).toBe(3);
    expect(BADGES.gap_closer.name).toBe("Gap Closer");
    expect(BADGES.first_step.name).toBe("First Step");
  });

  it("resets the daily cap on a new day", () => {
    const s = { ...base, playbookDoneToday: 3, lastActiveDate: "2026-10-12" };
    expect(computeAward(s, term, today).result.xpGained).toBe(80);
  });
});

describe("awardXP for playbook_done", () => {
  withTempDb(() => resetGamify());

  it("requires a ref and records it on the event row", async () => {
    await expect(awardXP(U, { type: "playbook_done" })).rejects.toThrow(/ref/);
    const r = await awardXP(U, { type: "playbook_done", ref: "PB-DAT-P01", effort: "2-4 weeks", signalValue: "cv_medium" });
    expect(r.xpGained).toBe(40);
    expect(db.select().from(xpEvents).all()).toContainEqual(expect.objectContaining({ type: "playbook_done", ref: "PB-DAT-P01", xp: 40 }));
  });
});
