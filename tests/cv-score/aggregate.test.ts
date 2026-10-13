import { describe, it, expect } from "vitest";
import { aggregateCvScore } from "@/lib/cv-score/aggregate";
import type { CvRule } from "@/lib/cv-rules/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";

const r = (id: string, over: Partial<CvRule> = {}): CvRule => ({
  id, sectors: "all", dimension: "ats", statement: id, check: "code", checker: "text_layer", severity: "major", evidence: "A",
  citations: [{ title: "t", publisher: "p", year: "2025", url: "https://x" }], ...over,
}) as CvRule;
const res = (ruleId: string, status: ScoredRuleResult["status"], fix: string | null = null): ScoredRuleResult => ({ ruleId, status, evidenceLine: null, fix });
const facts = { imageOnly: false, spellingErrors: 0, hasPhone: true, hasEmail: true };
const dims = ["ats", "impact", "clarity", "relevance", "uk"] as const;
const allRules = dims.map((d) => r(`R-${d}`, { dimension: d }));
const allPass = allRules.map((x) => res(x.id, "pass"));

describe("aggregateCvScore", () => {
  it("all pass → 100", () => {
    const s = aggregateCvScore({ rules: allRules, results: allPass, sector: "consulting", year: "2nd", facts });
    expect(s.total).toBe(100);
    expect(s.passed).toBe(5);
    expect(s.assessed).toBe(5);
  });

  it("a failed impact rule costs consulting more than software_eng (sector weights)", () => {
    const results = allRules.map((x) => res(x.id, x.dimension === "impact" ? "fail" : "pass"));
    const con = aggregateCvScore({ rules: allRules, results, sector: "consulting", year: "2nd", facts });
    const swe = aggregateCvScore({ rules: allRules, results, sector: "software_eng", year: "2nd", facts });
    // Amended DIMENSION_WEIGHTS: consulting impact 30, software_eng impact 20 (brief had 35/25 → 65/75).
    expect(con.total).toBe(70);
    expect(swe.total).toBe(80);
    expect(con.fixes[0]).toMatchObject({ ruleId: "R-impact", lostPoints: 30 });
  });

  it("not_applicable results are excluded; empty dimensions are renormalised", () => {
    const s = aggregateCvScore({ rules: [r("A"), r("B", { dimension: "impact" })], results: [res("A", "pass"), res("B", "not_applicable")], sector: "consulting", year: "2nd", facts });
    expect(s.total).toBe(100);
    expect(s.dimensions.impact).toBeNull();
  });

  it("could_not_assess is excluded from the denominator and counted separately (A1)", () => {
    const rules = [r("A"), r("B"), r("C")];
    const s = aggregateCvScore({ rules, results: [res("A", "pass"), res("B", "could_not_assess"), res("C", "fail", "fix")], sector: "consulting", year: "2nd", facts });
    expect(s.total).toBe(50); // 1 pass / 2 assessed, B dropped
    expect(s.couldNotAssess).toBe(1);
    expect(s.assessed).toBe(2);
    expect(s.fixes.map((f) => f.ruleId)).toEqual(["C"]);
  });

  it("partial earns half credit", () => {
    const s = aggregateCvScore({ rules: [r("A"), r("B")], results: [res("A", "pass"), res("B", "partial", "x")], sector: "consulting", year: "2nd", facts });
    expect(s.total).toBe(75);
  });

  it("applies sectorAdjust severity", () => {
    // A minor (1) passes, B fails: base B minor → 50; quant_trading lifts B to critical (3) → 1/(1+3) = 25.
    const rules = [r("A", { severity: "minor" }), r("B", { severity: "minor", sectorAdjust: { quant_trading: { severity: "critical" } } })];
    const results = [res("A", "pass"), res("B", "fail", "x")];
    expect(aggregateCvScore({ rules, results, sector: "consulting", year: "2nd", facts }).total).toBe(50);
    expect(aggregateCvScore({ rules, results, sector: "quant_trading", year: "2nd", facts }).total).toBe(25);
  });

  it("applies yearAdjust severity and skip", () => {
    const rules = [r("A", { severity: "minor" }), r("B", { severity: "critical", yearAdjust: { "1st": { severity: "minor" }, final: { skip: true } } })];
    const results = [res("A", "pass"), res("B", "fail", "x")];
    expect(aggregateCvScore({ rules, results, sector: "consulting", year: "2nd", facts }).total).toBe(25);
    expect(aggregateCvScore({ rules, results, sector: "consulting", year: "1st", facts }).total).toBe(50);
    expect(aggregateCvScore({ rules, results, sector: "consulting", year: "final", facts }).total).toBe(100);
  });

  it("applies caps and reports them", () => {
    expect(aggregateCvScore({ rules: allRules, results: allPass, sector: "consulting", year: "2nd", facts: { ...facts, imageOnly: true } }))
      .toMatchObject({ total: 50, capsApplied: ["Image-only PDF: capped at 50"] });
    expect(aggregateCvScore({ rules: allRules, results: allPass, sector: "consulting", year: "2nd", facts: { ...facts, spellingErrors: 3 } }))
      .toMatchObject({ total: 50, capsApplied: ["3+ spelling errors: capped at 50"] });
    expect(aggregateCvScore({ rules: allRules, results: allPass, sector: "consulting", year: "2nd", facts: { ...facts, spellingErrors: 2 } }).total).toBe(100);
    const noContact = aggregateCvScore({ rules: allRules, results: allPass, sector: "consulting", year: "2nd", facts: { ...facts, hasPhone: false, hasEmail: false } });
    expect(noContact.total).toBe(40);
    expect(noContact.capsApplied).toEqual(["No phone or email: capped at 40"]);
    expect(aggregateCvScore({ rules: allRules, results: allPass, sector: "consulting", year: "2nd", facts: { ...facts, hasPhone: false } }).capsApplied).toEqual([]);
  });

  it("weak-evidence rules weigh less and are marked as conventions", () => {
    const rules = [r("A", { evidence: "A" }), r("D", { evidence: "D", citations: [] })];
    const s = aggregateCvScore({ rules, results: [res("A", "pass"), res("D", "fail", "x")], sector: "consulting", year: "2nd", facts });
    // ats = 1.0/(1.0+0.4) → 71.4; other dims null → total 71
    expect(s.total).toBe(71);
    expect(s.fixes[0]).toMatchObject({ ruleId: "D", convention: true, citation: null });
  });

  it("ignores results for unknown rules", () => {
    const s = aggregateCvScore({ rules: [r("A")], results: [res("A", "pass"), res("ZZZ", "fail")], sector: "consulting", year: "2nd", facts });
    expect(s.total).toBe(100);
  });
});
