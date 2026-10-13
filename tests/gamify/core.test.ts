import { describe, it, expect } from "vitest";
import { computeAward, levelFromXp, xpFor, type GamifyState } from "@/lib/gamify/core";

const base: GamifyState = { xp: 0, streakDays: 0, lastActiveDate: null, badges: [], savesToday: 0, appliedCount: 0, rejectedCount: 0 };
const today = "2026-10-13";

describe("levelFromXp", () => {
  it("each level needs 100 × level XP", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, name: "Explorer", intoLevel: 0, needed: 100 });
    expect(levelFromXp(100)).toMatchObject({ level: 2, name: "Applicant", needed: 200 });
    expect(levelFromXp(300)).toMatchObject({ level: 3, name: "Contender", intoLevel: 0 });
    expect(levelFromXp(99999).name).toBe("Placed");
  });
});

describe("xpFor", () => {
  it("rewards quality over volume", () => {
    expect(xpFor({ type: "applied", fitLabel: "Strong fit" }, base)).toBe(50);
    expect(xpFor({ type: "applied", fitLabel: "Stretch" }, base)).toBe(25);
    expect(xpFor({ type: "applied", fitLabel: "Not recommended" }, base)).toBe(10);
    expect(xpFor({ type: "rejected" }, base)).toBe(20);
  });
  it("caps saves at 10 per day", () => {
    expect(xpFor({ type: "job_saved" }, { ...base, savesToday: 9, lastActiveDate: today })).toBe(5);
    expect(xpFor({ type: "job_saved" }, { ...base, savesToday: 10, lastActiveDate: today })).toBe(0);
  });
});

describe("computeAward", () => {
  it("levels up and starts a streak", () => {
    const { result, next } = computeAward({ ...base, xp: 60 }, { type: "cv_uploaded", profileComplete: true }, today);
    expect(result.xpGained).toBe(100);
    expect(result.levelUp).toBe(true);
    expect(result.streakDays).toBe(1);
    expect(result.newBadges).toContain("profile_pro");
    expect(next.lastActiveDate).toBe(today);
  });
  it("extends the streak on consecutive days, resets after a gap, keeps it on the same day", () => {
    expect(computeAward({ ...base, streakDays: 4, lastActiveDate: "2026-10-12" }, { type: "job_saved" }, today).result.streakDays).toBe(5);
    expect(computeAward({ ...base, streakDays: 4, lastActiveDate: "2026-10-10" }, { type: "job_saved" }, today).result.streakDays).toBe(1);
    expect(computeAward({ ...base, streakDays: 4, lastActiveDate: today }, { type: "job_saved" }, today).result.streakDays).toBe(4);
  });
  it("awards application badges", () => {
    const r = computeAward(base, { type: "applied", fitLabel: "Good fit", jobTitle: "Spring Week 2027", deadline: "2026-10-30" }, today).result;
    expect(r.newBadges).toEqual(expect.arrayContaining(["first_shot", "spring_week_hunter", "early_bird"]));
    const bounce = computeAward({ ...base, appliedCount: 3, rejectedCount: 1, badges: ["first_shot"] }, { type: "applied", fitLabel: "Good fit" }, today).result;
    expect(bounce.newBadges).toEqual(["bounce_back"]);
  });
  it("never re-awards an earned badge", () => {
    const r = computeAward({ ...base, badges: ["profile_pro"] }, { type: "quiz_done", profileComplete: true }, today).result;
    expect(r.newBadges).toEqual([]);
  });
  it("resets the daily save counter on a new day", () => {
    const { next } = computeAward({ ...base, savesToday: 10, lastActiveDate: "2026-10-12" }, { type: "job_saved" }, today);
    expect(next.savesToday).toBe(1);
  });
});

import { londonDayStart } from "@/lib/gamify/core";
describe("londonDayStart", () => {
  it("handles BST and GMT", () => {
    expect(londonDayStart("2026-07-01")).toBe("2026-06-30T23:00:00.000Z");
    expect(londonDayStart("2026-12-01")).toBe("2026-12-01T00:00:00.000Z");
  });
});
