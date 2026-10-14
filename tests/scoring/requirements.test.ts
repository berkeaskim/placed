import { describe, it, expect } from "vitest";
import {
  orderRequirementRows, mustHavesMet, mustHavesLabel, findabilityBand, keywordStuffing, shouldWarnStuffing,
  FINDABILITY_THRESHOLDS, STUFFING_COVERAGE_MIN, STUFFING_REPEAT_MIN, type RequirementRow,
} from "@/lib/scoring/requirements";

const row = (text: string, importance: RequirementRow["importance"], match: RequirementRow["match"], evidenceTier: RequirementRow["evidenceTier"] = "stated"): RequirementRow =>
  ({ text, skill: null, importance, evidenceTier, match, cvEvidence: null });

describe("orderRequirementRows", () => {
  it("caps inferred requirements below high (two-pass rule)", () => {
    const out = orderRequirementRows([row("Guess", "critical", "missing", "inferred")]);
    expect(out[0].importance).toBe("meaningful");
  });
  it("leaves inferred requirements that are already meaningful or lower alone", () => {
    const out = orderRequirementRows([row("Guess", "preferred", "missing", "inferred")]);
    expect(out[0].importance).toBe("preferred");
  });
  it("sorts by importance, unmet before met within a band", () => {
    const out = orderRequirementRows([row("a", "high", "strong"), row("b", "preferred", "missing"), row("c", "high", "missing"), row("d", "critical", "strong")]);
    expect(out.map((r) => r.text)).toEqual(["d", "c", "a", "b"]);
  });
  it("puts partial between missing and strong within a band", () => {
    const out = orderRequirementRows([row("s", "meaningful", "strong"), row("p", "meaningful", "partial"), row("m", "meaningful", "missing")]);
    expect(out.map((r) => r.text)).toEqual(["m", "p", "s"]);
  });
  it("keeps ≤12 rows but never drops critical/high", () => {
    const many = [...Array(14)].map((_, i) => row(`h${i}`, "high", "strong")).concat([row("p", "preferred", "missing")]);
    const out = orderRequirementRows(many);
    expect(out).toHaveLength(14);
    expect(out.some((r) => r.text === "p")).toBe(false);
  });
  it("trims lower bands to 12 rows in total", () => {
    const out = orderRequirementRows([...Array(20)].map((_, i) => row(`m${i}`, "meaningful", "missing")));
    expect(out).toHaveLength(12);
  });
});

describe("mustHavesMet (B10 headline)", () => {
  it("counts critical/high rows; only Strong is met, Partial is not", () => {
    const r = mustHavesMet([
      row("a", "critical", "strong"), row("b", "high", "partial"), row("c", "high", "missing"),
      row("d", "high", "strong"), row("e", "meaningful", "strong"), row("f", "preferred", "missing"),
    ]);
    expect(r).toEqual({ met: 2, partial: 1, total: 4 });
    expect(mustHavesLabel(r)).toBe("Must-haves met: 2/4");
  });
  it("an inferred 'critical' is capped first, so it is not a must-have", () => {
    expect(mustHavesMet([row("x", "critical", "missing", "inferred")])).toEqual({ met: 0, partial: 0, total: 0 });
  });
  it("says so when the posting states no must-haves", () => {
    expect(mustHavesLabel({ met: 0, partial: 0, total: 0 })).toBe("No must-haves stated");
  });
});

describe("findabilityBand", () => {
  it("uses the documented thresholds", () => {
    expect(FINDABILITY_THRESHOLDS).toEqual({ strong: 0.75, good: 0.5, partial: 0.25 });
  });
  it.each([
    [1, "Strong"], [0.75, "Strong"], [0.7499, "Good"], [0.5, "Good"], [0.4999, "Partial"], [0.25, "Partial"], [0.2499, "Limited"], [0, "Limited"],
  ])("weighted %s -> %s", (w, band) => {
    expect(findabilityBand({ readable: true, weighted: w as number })).toBe(band);
  });
  it("is null when the requirements could not be read", () => {
    expect(findabilityBand({ readable: false, weighted: null })).toBeNull();
  });
});

describe("keyword stuffing warning", () => {
  it(`flags a skill repeated ${STUFFING_REPEAT_MIN}+ times as a whole word`, () => {
    const cv = Array(STUFFING_REPEAT_MIN).fill("Python").join(", ") + "\nBuilt a dashboard.";
    expect(keywordStuffing(cv, ["Python", "SQL"])).toBe(true);
    expect(keywordStuffing(Array(STUFFING_REPEAT_MIN - 1).fill("Python").join(" "), ["Python"])).toBe(false);
  });
  it("does not count substrings (R inside other words)", () => {
    expect(keywordStuffing("Reporting regular reviews for researchers ".repeat(5), ["R"])).toBe(false);
  });
  it("handles skills with regex characters", () => {
    expect(keywordStuffing(Array(STUFFING_REPEAT_MIN).fill("C++").join(" "), ["C++"])).toBe(true);
  });
  it(`warns only above ${STUFFING_COVERAGE_MIN * 100}% coverage with major cliché density or stuffing`, () => {
    expect(STUFFING_COVERAGE_MIN).toBe(0.85);
    expect(shouldWarnStuffing({ weighted: 0.9, clicheSeverity: "major", stuffed: false })).toBe(true);
    expect(shouldWarnStuffing({ weighted: 0.9, clicheSeverity: "ok", stuffed: true })).toBe(true);
    expect(shouldWarnStuffing({ weighted: 0.9, clicheSeverity: "minor", stuffed: false })).toBe(false);
    expect(shouldWarnStuffing({ weighted: 0.85, clicheSeverity: "major", stuffed: true })).toBe(false);
    expect(shouldWarnStuffing({ weighted: null, clicheSeverity: "major", stuffed: true })).toBe(false);
  });
});
