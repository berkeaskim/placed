import { describe, it, expect } from "vitest";
import { computeAward, levelFromXp, londonDayStart, noAward, xpFor, APPLY_XP, LEVEL_NAMES, type GamifyState } from "@/lib/gamify/core";
import { todayLondon } from "@/lib/scoring/dates";

const base: GamifyState = { xp: 0, streakDays: 0, lastActiveDate: null, badges: [], savesToday: 0, appliedCount: 0, rejectedCount: 0 };

describe("levelFromXp — curve boundaries (each level needs 100 × level)", () => {
  // Cumulative thresholds: L2 @100, L3 @300, L4 @600, L5 @1000, L6 @1500, L7 @2100
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100];
  it.each(thresholds.slice(1).map((t, i) => [t, i + 2]))("xp %i is exactly level %i, xp-1 is the level below", (t, lvl) => {
    expect(levelFromXp(t).level).toBe(lvl);
    expect(levelFromXp(t).intoLevel).toBe(0);
    expect(levelFromXp(t - 1).level).toBe(lvl - 1);
    expect(levelFromXp(t - 1).intoLevel).toBe(100 * (lvl - 1) - 1);
  });
  it("needed is always 100 × level and intoLevel < needed", () => {
    for (let xp = 0; xp <= 5000; xp += 7) {
      const l = levelFromXp(xp);
      expect(l.needed).toBe(100 * l.level);
      expect(l.intoLevel).toBeGreaterThanOrEqual(0);
      expect(l.intoLevel).toBeLessThan(l.needed);
    }
  });
  it("names follow the ladder and clamp at Placed", () => {
    expect([0, 100, 300, 600, 1000].map((x) => levelFromXp(x).name)).toEqual([...LEVEL_NAMES]);
    expect(levelFromXp(1500).name).toBe("Placed");
    expect(levelFromXp(1_000_000).name).toBe("Placed");
  });
  it("is monotone non-decreasing in xp", () => {
    let prev = 1;
    for (let xp = 0; xp < 20_000; xp += 13) {
      const l = levelFromXp(xp).level;
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
  it("negative and fractional xp stay at level 1 (no throw)", () => {
    expect(levelFromXp(-50)).toMatchObject({ level: 1, name: "Explorer" });
    expect(levelFromXp(99.9).level).toBe(1);
    expect(levelFromXp(Number.NaN).level).toBe(1);
  });
  it("huge (int4-max) xp terminates quickly with a sane level", () => {
    const t0 = Date.now();
    const l = levelFromXp(2_147_483_647); // Postgres int max
    expect(Date.now() - t0).toBeLessThan(500);
    // sum_{k=1}^{L-1} 100k <= xp  =>  L ~ sqrt(2*xp/100)
    expect(l.level).toBeGreaterThan(6000);
    expect(l.level).toBeLessThan(7000);
    expect(l.name).toBe("Placed");
  });
});

describe("xpFor — spec table", () => {
  it("matches the spec XP table exactly", () => {
    expect(xpFor({ type: "onboarding_complete" }, base)).toBe(50);
    expect(xpFor({ type: "cv_uploaded" }, base)).toBe(100);
    expect(xpFor({ type: "quiz_done" }, base)).toBe(100);
    expect(xpFor({ type: "cv_tailored" }, base)).toBe(30);
    expect(xpFor({ type: "interview" }, base)).toBe(100);
    expect(xpFor({ type: "rejected" }, base)).toBe(20);
    expect(xpFor({ type: "offer" }, base)).toBe(300);
    expect(APPLY_XP).toEqual({ "Strong fit": 50, "Good fit": 50, Stretch: 25, "Not recommended": 10 });
    expect(xpFor({ type: "applied" }, base)).toBe(25); // unknown fit → stretch-equivalent
  });
  it("save cap: the 10th save of the day still pays, the 11th does not", () => {
    expect(xpFor({ type: "job_saved" }, { ...base, savesToday: 9 })).toBe(5);
    expect(xpFor({ type: "job_saved" }, { ...base, savesToday: 10 })).toBe(0);
    expect(xpFor({ type: "job_saved" }, { ...base, savesToday: 500 })).toBe(0);
  });
  it("10 saves/day yield at most 50 XP when replayed through computeAward", () => {
    let s: GamifyState = { ...base, lastActiveDate: "2026-10-13" };
    let total = 0;
    for (let i = 0; i < 25; i++) {
      const { result, next } = computeAward(s, { type: "job_saved" }, "2026-10-13");
      total += result.xpGained;
      s = next;
    }
    expect(total).toBe(50);
    expect(s.savesToday).toBe(25);
  });
  it("save counter resets on a new day", () => {
    const s: GamifyState = { ...base, savesToday: 10, lastActiveDate: "2026-10-12" };
    expect(computeAward(s, { type: "job_saved" }, "2026-10-13").result.xpGained).toBe(5);
  });
});

describe("computeAward — negative / huge state", () => {
  it("does not throw and still levels from a negative xp balance", () => {
    const { result } = computeAward({ ...base, xp: -500 }, { type: "offer" }, "2026-10-13");
    expect(result.newXp).toBe(-200);
    expect(result.level).toBe(1);
    expect(result.levelUp).toBe(false);
  });
  it("handles near-int-max xp without overflow semantics in JS", () => {
    const { result } = computeAward({ ...base, xp: 2_147_483_000 }, { type: "offer" }, "2026-10-13");
    expect(result.newXp).toBe(2_147_483_300);
  });
  it("levelUp is true exactly when crossing a boundary", () => {
    expect(computeAward({ ...base, xp: 99 }, { type: "job_saved" }, "2026-10-13").result.levelUp).toBe(true);
    expect(computeAward({ ...base, xp: 94 }, { type: "job_saved" }, "2026-10-13").result.levelUp).toBe(false);
    expect(computeAward({ ...base, xp: 95 }, { type: "job_saved" }, "2026-10-13").result.levelUp).toBe(true);
    // big jump across two levels still reports a single levelUp with the final level
    const big = computeAward({ ...base, xp: 0 }, { type: "offer" }, "2026-10-13").result;
    expect(big).toMatchObject({ levelUp: true, level: 3, newXp: 300 });
  });
  it("is pure: never mutates the input state", () => {
    const s: GamifyState = { ...base, badges: ["first_shot"] };
    const snap = JSON.stringify(s);
    computeAward(s, { type: "applied", fitLabel: "Good fit", jobTitle: "Spring Insight", deadline: "2027-01-01" }, "2026-10-13");
    expect(JSON.stringify(s)).toBe(snap);
  });
  it("noAward reflects current state with zero gain", () => {
    expect(noAward(350, 4)).toEqual({ xpGained: 0, newXp: 350, level: 3, levelName: "Contender", levelUp: false, streakDays: 4, newBadges: [] });
  });
});

describe("streak across London midnight and DST", () => {
  const streak = (last: string | null, days: number, today: string) =>
    computeAward({ ...base, streakDays: days, lastActiveDate: last }, { type: "cv_tailored" }, today).result.streakDays;

  it("todayLondon flips at London midnight, not UTC midnight (BST)", () => {
    // 2026-07-01 23:30Z is 00:30 BST on 07-02
    expect(todayLondon(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(todayLondon(new Date("2026-07-01T22:59:59Z"))).toBe("2026-07-01");
    // in GMT, London == UTC
    expect(todayLondon(new Date("2026-12-01T23:59:59Z"))).toBe("2026-12-01");
    expect(todayLondon(new Date("2026-12-02T00:00:00Z"))).toBe("2026-12-02");
  });
  it("an action at 23:59 BST and one at 00:01 BST next day extend the streak", () => {
    const d1 = todayLondon(new Date("2026-07-01T22:59:00Z"));
    const d2 = todayLondon(new Date("2026-07-01T23:01:00Z"));
    expect(d1).not.toBe(d2);
    expect(streak(d1, 3, d2)).toBe(4);
  });
  it("two actions within the same London day (spanning UTC midnight) do not double count", () => {
    const d1 = todayLondon(new Date("2026-07-01T23:10:00Z"));
    const d2 = todayLondon(new Date("2026-07-02T10:00:00Z"));
    expect(d1).toBe(d2);
    expect(streak(d1, 3, d2)).toBe(3);
  });
  it("spring-forward (2026-03-29, 23h day) and fall-back (2026-10-25, 25h day) are each one calendar day", () => {
    expect(streak("2026-03-28", 2, "2026-03-29")).toBe(3);
    expect(streak("2026-03-29", 3, "2026-03-30")).toBe(4);
    expect(streak("2026-10-24", 2, "2026-10-25")).toBe(3);
    expect(streak("2026-10-25", 3, "2026-10-26")).toBe(4);
  });
  it("month/year boundaries and leap day", () => {
    expect(streak("2026-12-31", 9, "2027-01-01")).toBe(10);
    expect(streak("2028-02-28", 1, "2028-02-29")).toBe(2);
    expect(streak("2028-02-29", 2, "2028-03-01")).toBe(3);
    expect(streak("2027-02-28", 2, "2027-03-01")).toBe(3);
  });
  it("a missed day resets; a lastActiveDate in the future (clock skew) resets to 1", () => {
    expect(streak("2026-10-11", 9, "2026-10-13")).toBe(1);
    expect(streak("2026-10-14", 9, "2026-10-13")).toBe(1);
    expect(streak(null, 9, "2026-10-13")).toBe(1);
  });
  it("same day with a stored streak of 0 normalises to 1", () => {
    expect(streak("2026-10-13", 0, "2026-10-13")).toBe(1);
  });

  it("londonDayStart is local midnight in both GMT and BST", () => {
    expect(londonDayStart("2026-01-15")).toBe("2026-01-15T00:00:00.000Z");
    expect(londonDayStart("2026-07-15")).toBe("2026-07-14T23:00:00.000Z");
  });
  it("londonDayStart on DST transition days", () => {
    // Spring forward happens at 01:00Z on 03-29: midnight is still GMT.
    expect(londonDayStart("2026-03-29")).toBe("2026-03-29T00:00:00.000Z");
    expect(londonDayStart("2026-03-30")).toBe("2026-03-29T23:00:00.000Z");
    // Fall back happens at 01:00Z on 10-25: midnight is still BST.
    expect(londonDayStart("2026-10-25")).toBe("2026-10-24T23:00:00.000Z");
    expect(londonDayStart("2026-10-26")).toBe("2026-10-26T00:00:00.000Z");
  });
  it("londonDayStart round-trips through todayLondon for every day of 2026", () => {
    for (let t = Date.parse("2026-01-01T12:00:00Z"); t < Date.parse("2027-01-01T00:00:00Z"); t += 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      const start = Date.parse(londonDayStart(day));
      expect(todayLondon(new Date(start))).toBe(day);
      expect(todayLondon(new Date(start - 1))).not.toBe(day);
    }
  });
});

describe("badge unlock conditions", () => {
  const today = "2026-10-13";
  const apply = (s: Partial<GamifyState>, e: Partial<Parameters<typeof computeAward>[1]> = {}) =>
    computeAward({ ...base, ...s }, { type: "applied", fitLabel: "Good fit", ...e } as never, today).result.newBadges;

  it("profile_pro only for cv_uploaded/quiz_done with profileComplete", () => {
    expect(computeAward(base, { type: "cv_uploaded", profileComplete: true }, today).result.newBadges).toEqual(["profile_pro"]);
    expect(computeAward(base, { type: "quiz_done", profileComplete: true }, today).result.newBadges).toEqual(["profile_pro"]);
    expect(computeAward(base, { type: "cv_uploaded", profileComplete: false }, today).result.newBadges).toEqual([]);
    expect(computeAward(base, { type: "cv_uploaded" }, today).result.newBadges).toEqual([]);
    expect(computeAward(base, { type: "onboarding_complete", profileComplete: true }, today).result.newBadges).toEqual([]);
  });
  it("first_shot only on the very first application", () => {
    expect(apply({ appliedCount: 0 })).toContain("first_shot");
    expect(apply({ appliedCount: 1 })).not.toContain("first_shot");
  });
  it("spring_week_hunter on spring/insight titles, case-insensitive", () => {
    expect(apply({}, { jobTitle: "SPRING WEEK 2027" })).toContain("spring_week_hunter");
    expect(apply({}, { jobTitle: "Insight Programme" })).toContain("spring_week_hunter");
    expect(apply({}, { jobTitle: "Summer Analyst" })).not.toContain("spring_week_hunter");
    expect(apply({}, { jobTitle: undefined })).not.toContain("spring_week_hunter");
  });
  // BUG: /spring|insight/ is a substring match, so non-programme roles unlock the badge.
  it.fails("spring_week_hunter is not awarded for 'Data Insights Analyst' or 'Springer Nature' roles", () => {
    expect(apply({}, { jobTitle: "Data Insights Analyst Intern" })).not.toContain("spring_week_hunter");
    expect(apply({}, { jobTitle: "Springer Nature — Software Intern" })).not.toContain("spring_week_hunter");
  });
  it("early_bird strictly more than 7 days before the deadline", () => {
    expect(apply({}, { deadline: "2026-10-20" })).not.toContain("early_bird"); // exactly 7
    expect(apply({}, { deadline: "2026-10-21" })).toContain("early_bird"); // 8
    expect(apply({}, { deadline: "2026-10-01" })).not.toContain("early_bird"); // past
    expect(apply({}, { deadline: null })).not.toContain("early_bird"); // rolling
    expect(apply({}, { deadline: "not-a-date" })).not.toContain("early_bird");
  });
  it("bounce_back requires a prior rejection", () => {
    expect(apply({ appliedCount: 2, rejectedCount: 0 })).not.toContain("bounce_back");
    expect(apply({ appliedCount: 2, rejectedCount: 1 })).toContain("bounce_back");
  });
  it("application badges are never granted by non-apply events", () => {
    for (const type of ["job_saved", "cv_tailored", "interview", "rejected", "offer"] as const) {
      const r = computeAward({ ...base, rejectedCount: 3 }, { type, jobTitle: "Spring Week", deadline: "2027-12-01" }, today).result;
      expect(r.newBadges).toEqual([]);
    }
  });
  it("all five badges can be earned at most once each, in any order", () => {
    let s: GamifyState = base;
    const seen: string[] = [];
    const evs = [
      { type: "rejected" as const },
      { type: "applied" as const, fitLabel: "Good fit" as const, jobTitle: "Spring Week", deadline: "2027-01-01" },
      { type: "quiz_done" as const, profileComplete: true },
      { type: "applied" as const, fitLabel: "Good fit" as const, jobTitle: "Spring Week", deadline: "2027-01-01" },
      { type: "cv_uploaded" as const, profileComplete: true },
    ];
    for (const e of evs) {
      const { result, next } = computeAward(s, e, today);
      seen.push(...result.newBadges);
      s = next;
    }
    expect(seen.sort()).toEqual(["bounce_back", "early_bird", "first_shot", "profile_pro", "spring_week_hunter"]);
    expect(new Set(s.badges).size).toBe(s.badges.length);
  });
});
