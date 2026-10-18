import { describe, it, expect } from "vitest";
import { gradYearOptions, guessGradYear, isSpringWeekEligible, springCycleYear, springWeekGradYear } from "@/lib/profile/cycle";
import { applyFilters, feedHref, parseFilters, resolveMode } from "@/lib/feed/filters";
import { scoreFit } from "@/lib/scoring/fit";
import type { JobForScoring, StudentProfile } from "@/lib/types";
import type { Ranked } from "@/lib/feed/rank";

const OCT_2026 = "2026-10-18";

describe("spring week cycle", () => {
  it("applications from May onwards are for next spring", () => {
    expect(springCycleYear(OCT_2026)).toBe(2027);
    expect(springCycleYear("2027-02-10")).toBe(2027);
    expect(springCycleYear("2027-04-30")).toBe(2027);
    expect(springCycleYear("2027-05-01")).toBe(2028);
  });
  it("spring 2027 is for the class of 2029", () => {
    expect(springWeekGradYear(OCT_2026)).toBe(2029);
    expect(springWeekGradYear("2027-06-01")).toBe(2030);
  });
});

describe("guessGradYear (assumes a 3-year degree)", () => {
  it.each([
    ["1st", 2029], ["2nd", 2028], ["penultimate", 2028], ["final", 2027], ["masters", 2027],
  ] as const)("%s in Oct 2026 → %i", (year, grad) => {
    expect(guessGradYear(year, OCT_2026)).toBe(grad);
  });
  it("before September the academic year is the previous one", () => {
    expect(guessGradYear("1st", "2027-03-01")).toBe(2029);
  });
});

describe("gradYearOptions", () => {
  it("covers this year to five years out", () => {
    expect(gradYearOptions(OCT_2026)).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
  });
});

describe("isSpringWeekEligible", () => {
  it.each([
    [{ year: "1st", gradYear: 2029 }, true],   // 1st of a 3-year degree
    [{ year: "2nd", gradYear: 2029 }, true],   // 2nd of a 4-year degree / integrated master's
    [{ year: "1st", gradYear: 2030 }, false],  // 1st of a 4-year degree: next cycle
    [{ year: "2nd", gradYear: 2028 }, false],  // penultimate on a 3-year degree
    [{ year: "1st", gradYear: null }, true],   // no grad year: fall back to the year of study
    [{ year: "2nd", gradYear: null }, false],
  ] as const)("%o → %s", (s, expected) => {
    expect(isSpringWeekEligible(s, OCT_2026)).toBe(expected);
  });
});

const job = (over: Partial<JobForScoring> = {}): JobForScoring => ({
  id: "j", title: "Spring Insight", location: "London, UK", remote: false, deadline: null, postedAt: null, archetype: null,
  yearEligibility: ["1st", "2nd"], sponsorsVisa: "unknown", employmentType: "spring_week", firstYearFriendly: true,
  cohortClash: false, requirements: [], textLines: [], ...over,
});
const student = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  year: "2nd", gradYear: null, locationPref: [], needsVisa: false, archetypes: [], skills: [], ...over,
});
const noCoverage = { weighted: null } as never;

describe("scoreFit spring-week gate", () => {
  it("a penultimate-year 2nd year (grad 2028) is gated out of spring weeks", () => {
    const r = scoreFit(student({ year: "2nd", gradYear: 2028 }), job(), noCoverage, OCT_2026);
    const g = r.gates.find((x) => x.key === "year")!;
    expect(g.passed).toBe(false);
    expect(g.reason).toMatch(/2029/);
  });
  it("a 2nd year on a 4-year degree (grad 2029) passes", () => {
    expect(scoreFit(student({ year: "2nd", gradYear: 2029 }), job(), noCoverage, OCT_2026).capped).toBe(false);
  });
  it("without a grad year the job's own years decide (unchanged behaviour)", () => {
    expect(scoreFit(student({ year: "2nd" }), job(), noCoverage, OCT_2026).capped).toBe(false);
  });
  it("insight events are not gated by grad year", () => {
    expect(scoreFit(student({ year: "2nd", gradYear: 2028 }), job({ employmentType: "insight", yearEligibility: [] }), noCoverage, OCT_2026).capped).toBe(false);
  });
});

describe("feed mode", () => {
  const ranked = (types: JobForScoring["employmentType"][]) =>
    types.map((t, i) => ({ job: { ...job({ employmentType: t }), id: String(i), company: "X", url: "", summary: "", extId: String(i) } }) as unknown as Ranked);

  it("parses ?mode=spring|all and ignores junk", () => {
    expect(parseFilters({ mode: "spring" }).mode).toBe("spring");
    expect(parseFilters({ mode: "all" }).mode).toBe("all");
    expect(parseFilters({ mode: "x" }).mode).toBeNull();
  });
  it("defaults to spring weeks for eligible students only", () => {
    expect(resolveMode(null, true)).toBe("spring");
    expect(resolveMode(null, false)).toBe("all");
    expect(resolveMode("all", true)).toBe("all");
  });
  it("spring mode keeps spring weeks and insight events", () => {
    const out = applyFilters(ranked(["spring_week", "internship", "insight", "graduate"]), { a: null, loc: null, soon: false, mode: "spring" }, OCT_2026);
    expect(out.map((r) => r.job.employmentType)).toEqual(["spring_week", "insight"]);
  });
  it("feedHref keeps the mode", () => {
    expect(feedHref({ a: null, loc: null, soon: false, mode: "all" }, { soon: true })).toBe("/feed?soon=1&mode=all");
    expect(feedHref({ a: null, loc: null, soon: false, mode: null }, {})).toBe("/feed");
  });
});
