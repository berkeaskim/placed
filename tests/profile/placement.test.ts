import { describe, it, expect } from "vitest";
import { guessGradYear, hasPlacementYear, isPlacementEligible, placementGradYear, placementStartYear } from "@/lib/profile/cycle";
import { applyFilters, parseFilters, resolveMode } from "@/lib/feed/filters";
import { studentYearLabels } from "@/lib/scoring/eligibility";
import { scoreFit } from "@/lib/scoring/fit";
import type { JobForScoring, StudentProfile } from "@/lib/types";
import type { Ranked } from "@/lib/feed/rank";

// research/placement-year/03-eligibility.md: placement start year + 2 = graduation year (2027/28 placements → class of 2029).
const OCT_2026 = "2026-10-19";

describe("placement cycle", () => {
  it.each([["2026-10-19", 2027], ["2027-03-01", 2027], ["2027-07-31", 2027], ["2027-08-01", 2028]] as const)("%s → placements starting %i", (d, y) => {
    expect(placementStartYear(d)).toBe(y);
  });
  it("2027/28 placements are for the class of 2029", () => {
    expect(placementGradYear(OCT_2026)).toBe(2029);
  });
});

describe("guessGradYear with a placement year", () => {
  it.each([
    ["1st", "required", 2030], ["2nd", "opted_in", 2029], ["2nd", "considering", 2028], ["2nd", null, 2028], ["final", "required", 2027],
  ] as const)("%s, %s → %i", (year, status, grad) => {
    expect(guessGradYear(year, OCT_2026, status)).toBe(grad);
  });
});

describe("isPlacementEligible", () => {
  it.each([
    [{ year: "2nd", gradYear: 2029, placementStatus: "required" }, true],
    [{ year: "2nd", gradYear: 2029, placementStatus: "considering" }, true],
    [{ year: "2nd", gradYear: null, placementStatus: "opted_in" }, true],
    [{ year: "1st", gradYear: 2030, placementStatus: "required" }, false],  // next cycle
    [{ year: "2nd", gradYear: 2029, placementStatus: "none" }, false],
    [{ year: "2nd", gradYear: 2029, placementStatus: null }, false],         // not asked yet
    [{ year: "final", gradYear: 2028, placementStatus: "completed" }, false],
  ] as const)("%o → %s", (s, expected) => {
    expect(isPlacementEligible(s, OCT_2026)).toBe(expected);
    expect(hasPlacementYear(s.placementStatus)).toBe(s.placementStatus === "required" || s.placementStatus === "opted_in" || s.placementStatus === "considering");
  });
});

describe("feed mode precedence", () => {
  it("explicit choice > placement > spring > all", () => {
    expect(resolveMode("all", true, true)).toBe("all");
    expect(resolveMode(null, true, true)).toBe("placement");
    expect(resolveMode(null, true, false)).toBe("spring");
    expect(resolveMode(null, false, false)).toBe("all");
  });
  it("parses ?mode=placement", () => {
    expect(parseFilters({ mode: "placement" }).mode).toBe("placement");
  });
  it("placement mode keeps only placements", () => {
    const r = (t: JobForScoring["employmentType"], id: string) => ({ job: { id, employmentType: t, location: "London", remote: false, archetype: null, deadline: null } }) as unknown as Ranked;
    const out = applyFilters([r("placement", "a"), r("internship", "b"), r("spring_week", "c")], { a: null, loc: null, soon: false, mode: "placement" }, OCT_2026);
    expect(out.map((x) => x.job.id)).toEqual(["a"]);
  });
});

describe("year labels on a sandwich degree", () => {
  it("the year before the placement counts as penultimate", () => {
    expect(studentYearLabels({ year: "2nd", gradYear: 2029, placementStatus: "required" }, OCT_2026).has("penultimate")).toBe(true);
    expect(studentYearLabels({ year: "2nd", gradYear: 2029 }, OCT_2026).has("penultimate")).toBe(false); // 4-year course without one
  });
});

const job = (over: Partial<JobForScoring> = {}): JobForScoring => ({
  id: "j", title: "2027 Technology Industrial Placement", location: "London, UK", remote: false, deadline: null, postedAt: null, archetype: null,
  yearEligibility: ["2nd", "penultimate"], sponsorsVisa: "unknown", employmentType: "placement", firstYearFriendly: false,
  cohortClash: false, requirements: [], textLines: [], ...over,
});
const student = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  year: "2nd", gradYear: 2029, placementStatus: "required", locationPref: [], needsVisa: false, archetypes: [], skills: [], ...over,
});
const noCoverage = { weighted: null } as never;

describe("scoreFit for placements", () => {
  it("a sandwich 2nd year (class of 2029) passes a 'penultimate year' placement", () => {
    expect(scoreFit(student(), job(), noCoverage, OCT_2026).gates.find((g) => g.key === "year")?.passed).toBe(true);
  });
  it("a student without a placement year gets a soft flag, not a gate", () => {
    const r = scoreFit(student({ placementStatus: "none", gradYear: 2028 }), job({ yearEligibility: [] }), noCoverage, OCT_2026);
    expect(r.gates.find((g) => g.key === "year")?.passed).toBe(true);
    expect(r.softFlags.join(" ")).toMatch(/placement year/i);
  });
  it("someone who already did a placement is told so", () => {
    const r = scoreFit(student({ placementStatus: "completed", year: "final", gradYear: 2027 }), job({ yearEligibility: [] }), noCoverage, OCT_2026);
    expect(r.softFlags.join(" ")).toMatch(/already/i);
  });
});
