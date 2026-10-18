import { describe, it, expect } from "vitest";
import { reliabilityStats, retestSummary, wilson } from "@/lib/cv-score/reliability";

// Audit 04#13: one flip in 10 runs is not evidence of an unstable rule; a rule that flips most runs is.
describe("reliabilityStats", () => {
  const runs = (spec: Record<string, string[]>) =>
    Array.from({ length: Object.values(spec)[0].length }, (_, i) => new Map(Object.entries(spec).map(([id, v]) => [id, v[i]])));
  it("Wilson interval brackets the observed rate", () => {
    const [lo, hi] = wilson(1, 10);
    expect(lo).toBeLessThan(0.1);
    expect(hi).toBeGreaterThan(0.1);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
  it("a single flip in 10 runs is reported but doesn't fail the gate", () => {
    const st = reliabilityStats(Array(10).fill(80), runs({ A: [...Array(9).fill("pass"), "fail"] }));
    expect(st.flips.map((f) => f.ruleId)).toEqual(["A"]);
    expect(st.unstable).toEqual([]);
    expect(st.pass).toBe(true);
  });
  it("a rule flipping half the time fails the gate, as does SD > 2", () => {
    expect(reliabilityStats(Array(10).fill(80), runs({ A: Array.from({ length: 10 }, (_, i) => (i % 2 ? "pass" : "fail")) })).pass).toBe(false);
    expect(reliabilityStats([70, 75, 80, 85, 90, 70, 75, 80, 85, 90], runs({ A: Array(10).fill("pass") })).pass).toBe(false);
  });
});

// Audit 04#13: run-to-run agreement across the whole CV set, not just one CV at a time.
describe("retestSummary", () => {
  const verdicts = (xs: string[]) => xs.map((v) => new Map([["R1", v]]));
  it("pools each rule's flip rate over every CV and reports a Wilson interval", () => {
    const s = retestSummary([
      { label: "a", totals: [80, 80, 80, 80], verdicts: verdicts(["pass", "pass", "pass", "fail"]) },
      { label: "b", totals: [60, 60, 60, 60], verdicts: verdicts(["fail", "fail", "fail", "fail"]) },
    ]);
    const r1 = s.rules.find((r) => r.ruleId === "R1")!;
    // 1 disagreement with the modal verdict out of 8 runs.
    expect(r1.flips).toBe(1);
    expect(r1.runs).toBe(8);
    expect(r1.rate).toBeCloseTo(1 / 8);
    expect(r1.ci[0]).toBeLessThan(1 / 8);
    expect(r1.ci[1]).toBeGreaterThan(1 / 8);
  });
  it("reports Fleiss' κ across runs per rule (CVs are items, runs are raters)", () => {
    const s = retestSummary([
      { label: "a", totals: [80, 80, 80], verdicts: verdicts(["pass", "pass", "pass"]) },
      { label: "b", totals: [60, 60, 60], verdicts: verdicts(["fail", "fail", "fail"]) },
    ]);
    expect(s.rules[0].kappa).toBe(1);
  });
  it("reports ICC(1,1) and the SEM of totals, and the mean per-CV SD", () => {
    const s = retestSummary([
      { label: "a", totals: [80, 82, 78], verdicts: verdicts(["pass", "pass", "pass"]) },
      { label: "b", totals: [60, 61, 59], verdicts: verdicts(["fail", "fail", "fail"]) },
      { label: "c", totals: [70, 70, 70], verdicts: verdicts(["pass", "pass", "pass"]) },
    ]);
    expect(s.icc).toBeGreaterThan(0.95);
    expect(s.sem).toBeGreaterThan(0);
    expect(s.sem).toBeLessThan(2);
    expect(s.meanSd).toBeCloseTo((Math.sqrt(8 / 3) + Math.sqrt(2 / 3) + 0) / 3, 6);
  });
  it("counts a missing verdict as its own outcome, so a rule that sometimes isn't returned shows as unstable", () => {
    const s = retestSummary([{ label: "a", totals: [80, 80], verdicts: [new Map([["R1", "pass"]]), new Map()] }]);
    expect(s.rules[0].flips).toBe(1);
  });
  it("needs at least one CV and equal runs per CV", () => {
    expect(() => retestSummary([])).toThrow();
    expect(() => retestSummary([
      { label: "a", totals: [1, 2], verdicts: verdicts(["pass", "pass"]) },
      { label: "b", totals: [1], verdicts: verdicts(["pass"]) },
    ])).toThrow(/same number of runs/);
  });
});
