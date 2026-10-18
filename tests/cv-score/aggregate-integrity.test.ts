import { describe, it, expect } from "vitest";
import { aggregateCvScore, PROVISIONAL_COVERAGE, ruleWeight } from "@/lib/cv-score/aggregate";
import { rulesFor } from "@/lib/cv-rules";
import { resolvedSeverity } from "@/lib/cv-rules/adjust";
import type { CvRule } from "@/lib/cv-rules/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";
import { ARCHETYPES } from "@/lib/types";

// Audit 2026-10-18, report 04 findings #1, #3, #4, #5, #6, #7, #8, #11, #26.

const facts = { imageOnly: false, spellingErrors: 0, hasPhone: true, hasEmail: true };
const res = (ruleId: string, status: ScoredRuleResult["status"]): ScoredRuleResult => ({ ruleId, status, evidenceLine: null, fix: status === "pass" ? null : "fix" });
const score = (sector: (typeof ARCHETYPES)[number], results: ScoredRuleResult[], over: Partial<typeof facts> = {}) =>
  aggregateCvScore({ rules: rulesFor(sector), results, sector, year: "2nd", facts: { ...facts, ...over } });

/** Every rule for the sector passes, except `ids` which get `status`. */
function withStatus(sector: (typeof ARCHETYPES)[number], ids: string[], status: ScoredRuleResult["status"]): ScoredRuleResult[] {
  return rulesFor(sector).map((r) => res(r.id, ids.includes(r.id) ? status : "pass"));
}
const llmIds = (sector: (typeof ARCHETYPES)[number], n: number) =>
  rulesFor(sector).filter((r) => r.check === "llm" && !r.naAllowed && !r.needs).slice(0, n).map((r) => r.id);

describe("04#1: judge failure modes never raise the score", () => {
  const ids = llmIds("consulting", 10);
  const failed = score("consulting", withStatus("consulting", ids, "fail"));
  const unassessed = score("consulting", withStatus("consulting", ids, "could_not_assess"));
  const dodged = score("consulting", withStatus("consulting", ids, "not_applicable"));
  const passed = score("consulting", withStatus("consulting", ids, "pass"));

  it("could_not_assess and un-allowed not_applicable score below a full pass (no free 100)", () => {
    expect(passed.total).toBe(100);
    expect(unassessed.total).toBeLessThan(100);
    expect(dodged.total).toBe(unassessed.total);
    expect(failed.total).toBeLessThan(unassessed.total);
  });
  it("an un-allowed not_applicable from the judge is counted as could_not_assess", () => {
    expect(dodged.couldNotAssess).toBe(10);
    expect(dodged.coverage).toBeLessThan(1);
  });
  it("reports a range from 'all unassessed fail' to 'all unassessed pass'", () => {
    expect(unassessed.range.low).toBe(failed.total);
    expect(unassessed.range.high).toBe(100);
  });
  it("a rule that may answer not_applicable is excluded without lowering coverage", () => {
    const naRule = rulesFor("finance_banking").find((r) => r.id === "FIN-11")!;
    expect(naRule.naAllowed).toBe(true);
    const s = score("finance_banking", withStatus("finance_banking", ["FIN-11"], "not_applicable"));
    expect(s.total).toBe(100);
    expect(s.coverage).toBe(1);
    expect(s.couldNotAssess).toBe(0);
  });
  it("code-rule not_applicable (nothing to check) stays excluded", () => {
    const s = score("consulting", withStatus("consulting", ["G-19"], "not_applicable"));
    expect(s.total).toBe(100);
    expect(s.coverage).toBe(1);
  });
});

describe("04#1 / #11: provisional state below the coverage threshold", () => {
  it("is provisional when the AI judge failed entirely", () => {
    const rules = rulesFor("consulting");
    const results = rules.map((r) => res(r.id, r.check === "llm" ? "could_not_assess" : "pass"));
    const s = score("consulting", results);
    expect(s.coverage).toBeLessThan(PROVISIONAL_COVERAGE);
    expect(s.provisional).toBe(true);
    expect(s.range.low).toBeLessThan(s.total);
    expect(s.range.high).toBe(100);
  });
  it("is not provisional when everything was assessed", () => {
    expect(score("consulting", withStatus("consulting", [], "pass")).provisional).toBe(false);
  });
  it("blanks a dimension that is mostly unassessed", () => {
    const impact = rulesFor("consulting").filter((r) => r.dimension === "impact" && r.check === "llm").map((r) => r.id);
    const s = score("consulting", withStatus("consulting", impact, "could_not_assess"));
    expect(s.dimensions.impact).toBeNull();
    expect(s.provisional).toBe(true);
  });
});

describe("04#3: no spelling cliff", () => {
  it("3+ spelling errors no longer cap the total at 50", () => {
    const s = score("finance_banking", withStatus("finance_banking", ["G-25"], "fail"), { spellingErrors: 3 });
    expect(s.capsApplied).toEqual([]);
    expect(s.total).toBeGreaterThan(90);
  });
  it("spelling is graded: partial costs less than fail", () => {
    const partial = score("finance_banking", withStatus("finance_banking", ["G-25"], "partial"));
    const fail = score("finance_banking", withStatus("finance_banking", ["G-25"], "fail"));
    expect(partial.total).toBeGreaterThan(fail.total);
    expect(100 - fail.total).toBeLessThan(10);
  });
});

describe("04#5: '+N pts' is the real gain from re-aggregating with the rule passed", () => {
  it("matches the actual score change for every fix (uncapped)", () => {
    const ids = ["G-20", "G-22", "G-32", "FIN-04"];
    const results = withStatus("finance_banking", ids, "fail");
    const s = score("finance_banking", results);
    for (const f of s.fixes) {
      const after = score("finance_banking", results.map((r) => (r.ruleId === f.ruleId ? res(r.ruleId, "pass") : r)));
      expect(f.gain, f.ruleId).toBeCloseTo(after.exactTotal - s.exactTotal, 6);
    }
    expect(s.fixes.reduce((n, f) => n + f.gain, 0)).toBeCloseTo(100 - s.exactTotal, 6);
  });
  it("when a cap binds, a non-cap fix gains nothing and the cap-lifting fix gains the most", () => {
    const results = withStatus("software_eng", ["G-16", "SWE-03"], "fail");
    const s = score("software_eng", results, { hasPhone: false, hasEmail: false });
    expect(s.total).toBe(40);
    const swe03 = s.fixes.find((f) => f.ruleId === "SWE-03")!;
    const contact = s.fixes.find((f) => f.ruleId === "G-16")!;
    expect(swe03.gain).toBe(0);
    expect(contact.gain).toBeGreaterThan(50);
    expect(s.fixes[0].ruleId).toBe("G-16");
  });
  it("never reports a negative gain, and keeps fixes sorted by gain", () => {
    const s = score("quant_trading", withStatus("quant_trading", llmIds("quant_trading", 6), "fail"));
    const gains = s.fixes.map((f) => f.gain);
    expect(Math.min(...gains)).toBeGreaterThanOrEqual(0);
    expect([...gains].sort((a, b) => b - a)).toEqual(gains);
  });
});

describe("04#26: invariants", () => {
  it("monotonic: turning any fail into a pass never lowers the total", () => {
    for (const sector of ARCHETYPES) {
      const rules = rulesFor(sector);
      const base = rules.map((r, i) => res(r.id, i % 3 === 0 ? "fail" : i % 3 === 1 ? "partial" : "pass"));
      const t0 = score(sector, base).exactTotal;
      for (const r of rules) {
        const t1 = score(sector, base.map((x) => (x.ruleId === r.id ? res(x.ruleId, "pass") : x))).exactTotal;
        expect(t1, `${sector} ${r.id}`).toBeGreaterThanOrEqual(t0 - 1e-9);
      }
    }
  });
  it("order-invariant", () => {
    const results = withStatus("product", llmIds("product", 5), "fail");
    expect(score("product", [...results].reverse()).exactTotal).toBeCloseTo(score("product", results).exactTotal, 9);
  });
});

describe("04#7 / #8: weights", () => {
  it("within every sector, no critical rule is worth less than any minor rule", () => {
    for (const sector of ARCHETYPES) {
      for (const track of ["standard", "spring"] as const) {
        const rules = rulesFor(sector, track);
        const w = (r: CvRule) => ruleWeight(r, sector, "2nd", track);
        const crit = rules.filter((r) => resolvedSeverity(r, sector, "2nd", track) === "critical").map(w);
        const minor = rules.filter((r) => resolvedSeverity(r, sector, "2nd", track) === "minor").map(w);
        if (crit.length && minor.length) expect(Math.min(...crit), `${sector}/${track}`).toBeGreaterThanOrEqual(Math.max(...minor) - 1e-9);
      }
    }
  });
  it("only A/B-evidence rules can be critical", () => {
    for (const sector of ARCHETYPES) {
      for (const r of rulesFor(sector)) {
        if (r.evidence === "C" || r.evidence === "D") expect(resolvedSeverity(r, sector, "2nd"), `${sector} ${r.id}`).not.toBe("critical");
      }
    }
  });
  it("evidence grade is not a weight multiplier: same severity, same dimension → same weight", () => {
    const a = { id: "A", sectors: "all", dimension: "ats", statement: "a", check: "code", checker: "text_layer", severity: "major", evidence: "A", citations: [] } as CvRule;
    const d = { ...a, id: "D", evidence: "D" } as CvRule;
    expect(ruleWeight(a, "consulting", "2nd")).toBe(ruleWeight(d, "consulting", "2nd"));
  });
});
