import { describe, it, expect } from "vitest";
import { db } from "@/lib/db/client";
import { xpEvents } from "@/lib/db/schema";
import { computeAward, xpFor, BADGES, type GamifyState } from "@/lib/gamify/core";
import { awardXP } from "@/lib/gamify/award";
import { resetGamify, U, useTempDb } from "./temp-db";

const base: GamifyState = { xp: 0, streakDays: 0, lastActiveDate: null, badges: [], savesToday: 0, appliedCount: 0, rejectedCount: 0 };
const today = "2026-10-13";

describe("playbook_done XP", () => {
  it("gives 40 XP for the first three per day, then 0", () => {
    expect(xpFor({ type: "playbook_done", ref: "A" }, { ...base, playbookDoneToday: 2, lastActiveDate: today })).toBe(40);
    expect(xpFor({ type: "playbook_done", ref: "A" }, { ...base, playbookDoneToday: 3, lastActiveDate: today })).toBe(0);
  });

  it("awards Gap Closer on the first one only", () => {
    const first = computeAward(base, { type: "playbook_done", ref: "A" }, today);
    expect(first.result).toMatchObject({ xpGained: 40, newBadges: ["gap_closer"] });
    const second = computeAward(first.next, { type: "playbook_done", ref: "B" }, today);
    expect(second.result.newBadges).toEqual([]);
    expect(second.next.playbookDoneToday).toBe(2);
    expect(BADGES.gap_closer.name).toBe("Gap Closer");
  });

  it("resets the daily cap on a new day", () => {
    const s = { ...base, playbookDoneToday: 3, lastActiveDate: "2026-10-12" };
    expect(computeAward(s, { type: "playbook_done", ref: "A" }, today).result.xpGained).toBe(40);
  });
});

describe("awardXP for playbook_done", () => {
  useTempDb(() => resetGamify());

  it("requires a ref and records it on the event row", async () => {
    await expect(awardXP(U, { type: "playbook_done" })).rejects.toThrow(/ref/);
    const r = await awardXP(U, { type: "playbook_done", ref: "PB-DAT-P01" });
    expect(r.xpGained).toBe(40);
    expect(db.select().from(xpEvents).all()).toContainEqual(expect.objectContaining({ type: "playbook_done", ref: "PB-DAT-P01", xp: 40 }));
  });
});
