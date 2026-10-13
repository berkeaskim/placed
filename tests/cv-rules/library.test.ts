import { describe, it, expect } from "vitest";
import { RULES, RULES_BY_ID, rulesFor, DIMENSION_WEIGHTS, BASE_WEIGHTS, MYTHS } from "@/lib/cv-rules";
import { CHECKER_IDS } from "@/lib/cv-rules/types";
import { ARCHETYPES } from "@/lib/types";

/** Rule counts per id prefix: 161 from the three research docs (spec §6.1) + 8 from the approved CV amendments. */
const EXPECTED_PER_PREFIX: Record<string, number> = {
  G: 37, GEN: 12, FCQ: 12, FIN: 14, QNT: 12, CON: 13, SWE: 17, DAT: 12, PRD: 9, MKT: 12, RES: 11,
  EV: 3, AU: 3, ATS: 2,
};

const prefixOf = (id: string) => id.split("-")[0];

describe("CV rule library", () => {
  it("has the transcribed research rules with unique ids", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
  it("has exactly the 169 rules (161 research + 8 amendments)", () => {
    expect(RULES.length).toBe(169);
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
  it("keeps the 11 debunked myths plus the 2 from the amendments", () => {
    expect(MYTHS).toHaveLength(13);
    expect(MYTHS.map((m) => m.id)).toEqual(Array.from({ length: 13 }, (_, i) => `M${i + 1}`));
  });
  it("uses the amended base weights", () => {
    expect(BASE_WEIGHTS).toEqual({ ats: 15, impact: 25, clarity: 25, relevance: 25, uk: 10 });
  });
  it("every llm rule is one binary question with pass and fail anchors", () => {
    for (const r of RULES.filter((r) => r.check === "llm")) {
      expect(r.llmGuidance, r.id).toMatch(/\?/);
      expect(r.passExample?.trim().length, r.id).toBeGreaterThan(0);
      expect(r.failExample?.trim().length, r.id).toBeGreaterThan(0);
    }
  });
  it("allowPartial is only on llm rules that define partial numerically", () => {
    for (const r of RULES.filter((r) => r.allowPartial)) {
      expect(r.check, r.id).toBe("llm");
      expect(r.llmGuidance, r.id).toMatch(/Partial:.*\d/);
    }
  });
  it("hidden-text and injection rules are critical and block export", () => {
    for (const id of ["ATS-HID-01", "ATS-INJ-01"]) {
      const r = RULES_BY_ID.get(id);
      expect(r?.severity, id).toBe("critical");
      expect(r?.check, id).toBe("code");
      expect(r?.blocksExport, id).toBe(true);
    }
  });
  it("applies the amended evidence grades", () => {
    expect(RULES_BY_ID.get("G-22")?.evidence).toBe("C");
    expect(RULES_BY_ID.get("GEN-04")?.evidence).toBe("C");
    expect(RULES_BY_ID.get("SWE-07")?.evidence).toBe("B");
    expect(RULES_BY_ID.get("SWE-12")?.evidence).toBe("B");
  });
  it("EV-03 is major for software and data, minor elsewhere", () => {
    const r = RULES_BY_ID.get("EV-03");
    expect(r?.severity).toBe("minor");
    expect(r?.sectorAdjust?.software_eng?.severity).toBe("major");
    expect(r?.sectorAdjust?.data_analytics?.severity).toBe("major");
  });
});
