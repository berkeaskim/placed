import { describe, it, expect } from "vitest";
import { binaryMetrics, cohenKappa, fleissKappa, fleissKappaCounts, gwetAc1, icc1, majority } from "@/lib/cv-score/stats";

// Agreement statistics for the gold-set harness and test-retest (audit 04 validation plan, #13).
// Each case is a published worked example, so the numbers are checked against an outside source.

describe("cohenKappa", () => {
  it("matches the textbook 2×2 example (po 0.70, pe 0.50, κ 0.40)", () => {
    // Wikipedia "Cohen's kappa" worked example: 50 items; yes/yes 20, yes/no 5, no/yes 10, no/no 15.
    const pairs: [string, string][] = [
      ...Array(20).fill(["yes", "yes"]), ...Array(5).fill(["yes", "no"]),
      ...Array(10).fill(["no", "yes"]), ...Array(15).fill(["no", "no"]),
    ];
    const k = cohenKappa(pairs);
    expect(k.n).toBe(50);
    expect(k.po).toBeCloseTo(0.7, 10);
    expect(k.pe).toBeCloseTo(0.5, 10);
    expect(k.kappa).toBeCloseTo(0.4, 10);
  });
  it("is 1 for perfect agreement across categories, and null when undefined (one category only)", () => {
    expect(cohenKappa([["pass", "pass"], ["fail", "fail"], ["na", "na"]]).kappa).toBe(1);
    // Both raters always say pass: pe = 1, κ is undefined (the prevalence paradox; AC1 still reports agreement).
    expect(cohenKappa([["pass", "pass"], ["pass", "pass"]]).kappa).toBeNull();
    expect(cohenKappa([]).kappa).toBeNull();
  });
});

describe("gwetAc1", () => {
  it("stays high when agreement is high but prevalence is skewed (where κ collapses)", () => {
    // 18 pass/pass, 1 pass/fail, 1 fail/pass: po = 0.9 but κ ≈ −0.05.
    const pairs: [string, string][] = [...Array(18).fill(["pass", "pass"]), ["pass", "fail"], ["fail", "pass"]];
    expect(cohenKappa(pairs).kappa!).toBeLessThan(0);
    // AC1: π_pass = 0.95, pe = 2·0.95·0.05 / (2−1) = 0.095, AC1 = (0.9 − 0.095)/(1 − 0.095) ≈ 0.8895.
    expect(gwetAc1(pairs).ac1!).toBeCloseTo(0.8895, 3);
  });
});

describe("fleissKappa", () => {
  it("matches Fleiss (1971) as reproduced on Wikipedia: 10 subjects × 14 raters × 5 categories, κ ≈ 0.210", () => {
    const counts = [
      [0, 0, 0, 0, 14], [0, 2, 6, 4, 2], [0, 0, 3, 5, 6], [0, 3, 9, 2, 0], [2, 2, 8, 1, 1],
      [7, 7, 0, 0, 0], [3, 2, 6, 3, 0], [2, 5, 3, 2, 2], [6, 5, 2, 1, 0], [0, 2, 2, 3, 7],
    ];
    expect(fleissKappaCounts(counts).kappa!).toBeCloseTo(0.20993, 4);
  });
  it("takes raw labels per item and agrees with the count form", () => {
    const items = [["pass", "pass", "pass"], ["fail", "fail", "pass"], ["fail", "fail", "fail"], ["pass", "fail", "pass"]];
    const viaLabels = fleissKappa(items);
    const viaCounts = fleissKappaCounts([[3, 0], [1, 2], [0, 3], [2, 1]]);
    expect(viaLabels.kappa).toBeCloseTo(viaCounts.kappa!, 10);
    expect(viaLabels.items).toBe(4);
    expect(viaLabels.raters).toBe(3);
  });
  it("rejects items with a different number of raters", () => {
    expect(() => fleissKappa([["pass", "pass"], ["pass"]])).toThrow(/same number of ratings/);
  });
  it("is null with fewer than 2 raters or a single category everywhere", () => {
    expect(fleissKappa([["pass"], ["fail"]]).kappa).toBeNull();
    expect(fleissKappa([["pass", "pass"], ["pass", "pass"]]).kappa).toBeNull();
  });
});

describe("icc1", () => {
  it("matches Shrout & Fleiss (1979) Table 4: ICC(1,1) = .17 for 6 targets × 4 judges", () => {
    const data = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]];
    const r = icc1(data);
    expect(r.icc!).toBeCloseTo(0.17, 2);
    // SEM = √MSW (within-target mean square): MSW = 6.26 in the paper's ANOVA table.
    expect(r.sem).toBeCloseTo(Math.sqrt(6.2639), 2);
  });
  it("is null with one target (no between-target variance to compare)", () => {
    expect(icc1([[80, 81, 79]]).icc).toBeNull();
  });
});

describe("binaryMetrics", () => {
  it("treats fail as the positive class (does the checker catch what humans call a fail?)", () => {
    const m = binaryMetrics([
      { predicted: "fail", truth: "fail" }, { predicted: "fail", truth: "fail" }, { predicted: "fail", truth: "pass" },
      { predicted: "pass", truth: "fail" }, { predicted: "pass", truth: "pass" }, { predicted: "pass", truth: "pass" },
    ]);
    expect(m).toMatchObject({ tp: 2, fp: 1, fn: 1, tn: 2, n: 6 });
    expect(m.precision).toBeCloseTo(2 / 3);
    expect(m.recall).toBeCloseTo(2 / 3);
    expect(m.specificity).toBeCloseTo(2 / 3);
  });
  it("reports null precision/recall when undefined rather than 0 or 1", () => {
    const m = binaryMetrics([{ predicted: "pass", truth: "pass" }]);
    expect(m.precision).toBeNull();
    expect(m.recall).toBeNull();
  });
});

describe("majority", () => {
  it("returns the strict majority label, or null on a tie", () => {
    expect(majority(["pass", "fail", "pass"])).toBe("pass");
    expect(majority(["pass", "fail"])).toBeNull();
    expect(majority(["pass", "fail", "na"])).toBeNull();
    expect(majority([])).toBeNull();
  });
});
