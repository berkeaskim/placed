import { describe, it, expect } from "vitest";
import { BADGES, computeAward, xpFor, type GamifyState } from "@/lib/gamify/core";

const base: GamifyState = { xp: 0, streakDays: 0, lastActiveDate: null, badges: [], savesToday: 0, appliedCount: 0, rejectedCount: 0 };
const today = "2026-10-14";

describe("Task 23b XP events", () => {
  it("a confirmed number earns XP (once per job is the DB's unique index)", () => {
    expect(xpFor({ type: "number_confirmed" }, base)).toBe(10);
    expect(computeAward(base, { type: "number_confirmed" }, today).result.newBadges).toEqual([]);
  });
  it("editing a suggestion earns XP and the Made it yours badge, once", () => {
    expect(xpFor({ type: "suggestion_edited" }, base)).toBe(10);
    expect(computeAward(base, { type: "suggestion_edited" }, today).result.newBadges).toEqual(["made_it_yours"]);
    expect(computeAward({ ...base, badges: ["made_it_yours"] }, { type: "suggestion_edited" }, today).result.newBadges).toEqual([]);
    expect(BADGES.made_it_yours.name).toBe("Made it yours");
  });
});
