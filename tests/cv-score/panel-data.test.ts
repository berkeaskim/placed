import { describe, it, expect } from "vitest";
import { storedCounts } from "@/lib/cv-score/panel-data";
import { aggregateCvScore, type ScoreFacts } from "@/lib/cv-score/aggregate";
import type { CvRule } from "@/lib/cv-rules/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";

const r = (id: string, over: Partial<CvRule> = {}): CvRule => ({
  id, sectors: "all", dimension: "impact", statement: id, check: "code", checker: "text_layer", severity: "major", evidence: "B",
  citations: [], ...over,
}) as CvRule;
const res = (ruleId: string, status: ScoredRuleResult["status"]): ScoredRuleResult => ({ ruleId, status, evidenceLine: null, fix: null });

const rules = [
  r("A"), r("B", { dimension: "ats" }), r("C", { dimension: "uk" }), r("D", { dimension: "clarity" }),
  r("E", { yearAdjust: { "1st": { skip: true } } }), r("F", { dimension: "relevance" }),
];
const results = [res("A", "pass"), res("B", "fail"), res("C", "partial"), res("D", "not_applicable"), res("E", "pass"), res("F", "could_not_assess")];
const realFacts: ScoreFacts[] = [
  { imageOnly: true, spellingErrors: 5, hasPhone: false, hasEmail: false },
  { imageOnly: false, spellingErrors: 3, hasPhone: true, hasEmail: false },
  { imageOnly: false, spellingErrors: 0, hasPhone: true, hasEmail: true },
];

describe("storedCounts", () => {
  it.each(realFacts)("fallback (old rows) equals the counts from the real facts %o", (facts) => {
    for (const year of ["1st", "2nd"] as const) {
      const real = aggregateCvScore({ rules, results, sector: "consulting", year, facts });
      const fromStored = storedCounts({ code: results.slice(0, 3), llm: results.slice(3) }, rules, "consulting", year);
      expect(fromStored).toEqual({ assessed: real.assessed, passed: real.passed, couldNotAssess: real.couldNotAssess });
    }
  });
  it("fallback counts are as expected (year skip, n/a and could_not_assess excluded)", () => {
    expect(storedCounts({ code: results }, rules, "consulting", "1st")).toEqual({ assessed: 3, passed: 1, couldNotAssess: 1 });
    expect(storedCounts({ code: results }, rules, "consulting", "2nd")).toEqual({ assessed: 4, passed: 2, couldNotAssess: 1 });
  });
  it("prefers persisted counts (rows scored since 18b)", () => {
    expect(storedCounts({ code: results, assessed: 31, passed: 23, couldNotAssess: 2 }, rules, "consulting", "2nd"))
      .toEqual({ assessed: 31, passed: 23, couldNotAssess: 2 });
  });
  it("null rule_results → zeros", () => {
    expect(storedCounts(null, rules, "consulting", "2nd")).toEqual({ assessed: 0, passed: 0, couldNotAssess: 0 });
  });
});
