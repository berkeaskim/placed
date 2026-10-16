import { describe, expect, it } from "vitest";
import { JUDGE_BATCH_SIZE, judgeBatches } from "@/lib/ai/judgeCvRules";

describe("judgeBatches", () => {
  it("keeps every rule once, in order, in near-equal batches no larger than the cap", () => {
    for (const n of [1, 5, 12, 13, 24, 46, 47]) {
      const rules = Array.from({ length: n }, (_, i) => i);
      const b = judgeBatches(rules);
      expect(b.flat()).toEqual(rules);
      expect(Math.max(...b.map((x) => x.length))).toBeLessThanOrEqual(JUDGE_BATCH_SIZE);
      expect(Math.max(...b.map((x) => x.length)) - Math.min(...b.map((x) => x.length))).toBeLessThanOrEqual(1);
    }
  });
  it("returns no batches for no rules", () => {
    expect(judgeBatches([])).toEqual([]);
  });
});

import { mergeSameText } from "@/lib/ai/explainMatch";
import type { RequirementRow } from "@/lib/scoring/requirements";

const row = (p: Partial<RequirementRow>): RequirementRow => ({
  text: "Knowledge in SQL and Python", skill: "SQL", importance: "preferred", evidenceTier: "structural", match: "strong", cvEvidence: "Used Python and SQL", ...p,
});

describe("mergeSameText", () => {
  it("shows one row per requirement line, Strong only when every part is", () => {
    expect(mergeSameText([row({}), row({ skill: "Python" })])).toEqual([row({ skill: "SQL, Python" })]);
    const mixed = mergeSameText([row({}), row({ skill: "Python", match: "missing", cvEvidence: null })]);
    expect(mixed).toHaveLength(1);
    expect(mixed[0].match).toBe("partial");
    expect(mergeSameText([row({ match: "missing", cvEvidence: null }), row({ skill: "Python", match: "missing", cvEvidence: null, importance: "high" })])[0])
      .toMatchObject({ match: "missing", importance: "high", cvEvidence: null });
  });
  it("leaves rows with different text alone", () => {
    expect(mergeSameText([row({}), row({ text: "Excel" })])).toHaveLength(2);
  });
});

import { verifyQuote } from "@/lib/ai/explainMatch";
import { mapVerdicts } from "@/lib/ai/judgeCvRules";

describe("quotes copied with our list markers still verify", () => {
  const line = "used python and sql to collect and clean 1,200 rental listings";
  it("explainMatch: '  - Used Python…' matches the CV line", () => {
    expect(verifyQuote("  - Used Python and SQL to collect and clean 1,200 rental listings", [line], { skill: "SQL" }))
      .toBe("Used Python and SQL to collect and clean 1,200 rental listings");
    expect(verifyQuote("• Used Python and SQL to collect", [line], { skill: "Python" })).toBe("Used Python and SQL to collect");
  });
  it("judgeCvRules: a dash-prefixed pass quote is not dropped as could_not_assess", () => {
    const [r] = mapVerdicts({ verdicts: [{ rule_id: "R1", status: "pass", evidence_line: "- Used Python and SQL", fix: null }], spelling_errors: [] },
      [{ id: "R1", check: "llm" }], "• Used Python and SQL to collect");
    expect(r).toMatchObject({ status: "pass", evidenceLine: "Used Python and SQL" });
  });
});
