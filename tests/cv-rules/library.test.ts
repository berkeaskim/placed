import { describe, it, expect } from "vitest";
import { RULES, RULES_BY_ID, rulesFor, DIMENSION_WEIGHTS, MYTHS } from "@/lib/cv-rules";
import { CHECKER_IDS } from "@/lib/cv-rules/types";
import { ARCHETYPES } from "@/lib/types";

/** Rule counts per id prefix in the three research docs (spec §6.1: 161 in total). */
const EXPECTED_PER_PREFIX: Record<string, number> = {
  G: 37, GEN: 12, FCQ: 12, FIN: 14, QNT: 12, CON: 13, SWE: 17, DAT: 12, PRD: 9, MKT: 12, RES: 11,
};

const prefixOf = (id: string) => id.split("-")[0];

describe("CV rule library", () => {
  it("has the transcribed research rules with unique ids", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
  it("has exactly the 161 rules from the research docs", () => {
    expect(RULES.length).toBe(161);
  });
  for (const [prefix, n] of Object.entries(EXPECTED_PER_PREFIX)) {
    it(`has ${n} ${prefix} rules`, () => {
      expect(RULES.filter((r) => prefixOf(r.id) === prefix).length).toBe(n);
    });
  }
  it("only uses known id prefixes", () => {
    for (const r of RULES) expect(Object.keys(EXPECTED_PER_PREFIX), r.id).toContain(prefixOf(r.id));
  });
  it("every non-D rule cites at least one source with a URL", () => {
    for (const r of RULES.filter((r) => r.evidence !== "D")) {
      expect(r.citations.length, r.id).toBeGreaterThan(0);
    }
    for (const r of RULES) for (const c of r.citations) expect(c.url, r.id).toMatch(/^https?:\/\//);
  });
  it("code rules point at a real checker; llm rules have guidance", () => {
    for (const r of RULES) {
      if (r.check === "code") expect(CHECKER_IDS, r.id).toContain(r.checker);
      else expect(r.statement.length + (r.llmGuidance?.length ?? 0), r.id).toBeGreaterThan(20);
    }
  });
  it("every sector gets at least 25 applicable rules", () => {
    for (const a of ARCHETYPES) expect(rulesFor(a).length, a).toBeGreaterThanOrEqual(25);
  });
  it("sector weights sum to 100", () => {
    for (const a of ARCHETYPES) expect(Object.values(DIMENSION_WEIGHTS[a]).reduce((x, y) => x + y, 0), a).toBe(100);
  });
  it("sectorAdjust only uses valid archetype keys", () => {
    for (const r of RULES) for (const k of Object.keys(r.sectorAdjust ?? {})) expect(ARCHETYPES, r.id).toContain(k);
  });
  it("FCQ length and grade rules are major (not critical) for quant", () => {
    expect(RULES_BY_ID.get("FCQ-01")?.sectorAdjust?.quant_trading?.severity).toBe("major");
    expect(RULES_BY_ID.get("FCQ-04")?.sectorAdjust?.quant_trading?.severity).toBe("major");
  });
  it("keeps the 11 debunked myths", () => {
    expect(MYTHS).toHaveLength(11);
  });
});
