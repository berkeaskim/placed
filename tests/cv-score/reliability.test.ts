import { describe, it, expect } from "vitest";
import { reliabilityStats, wilson } from "@/lib/cv-score/reliability";

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
