import { describe, it, expect } from "vitest";
import { RULES, RULES_BY_ID, rulesFor, DIMENSION_WEIGHTS, BASE_WEIGHTS, MYTHS, TRACKS } from "@/lib/cv-rules";
import { resolvedMaxPages, resolvedSeverity } from "@/lib/cv-rules/adjust";
import { CHECKER_IDS } from "@/lib/cv-rules/types";
import { ARCHETYPES } from "@/lib/types";

/**
 * Rule counts per id prefix after the 2026-10-18 audit (one detector, one rule; unobservable rules removed):
 * G 37→32 (−G-03/09/10/28/35/37, +G-39 photo), GEN 12→0 (merged into G-), FCQ 12→7, FIN 14→12, QNT 12→10, CON 13→11,
 * SWE 17→11, PRD 9→8, MKT 12→9, RES 11→10.
 */
const EXPECTED_PER_PREFIX: Record<string, number> = {
  G: 32, FCQ: 7, FIN: 12, QNT: 10, CON: 11, SWE: 11, DAT: 12, PRD: 8, MKT: 9, RES: 10,
  EV: 3, AU: 3, ATS: 2, SPR: 7, PLC: 5,
};

const prefixOf = (id: string) => id.split("-")[0];

describe("CV rule library", () => {
  it("has the transcribed research rules with unique ids", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
  it("has exactly the 142 rules: 137 after the audit merge + 5 placement-year", () => {
    expect(RULES.length).toBe(142);
  });
  it("one detector, one rule: no two scored code rules share a checker in any sector or track (audit 04#2)", () => {
    for (const a of ARCHETYPES) for (const t of TRACKS) {
      const code = rulesFor(a, t).filter((r) => r.check === "code" && !r.trackAdjust?.[t]?.skip);
      const seen = new Map<string, string>();
      for (const r of code) {
        const k = r.checker ?? r.id;
        expect(seen.get(k), `${a}/${t}: ${r.id} and ${seen.get(k)} share ${k}`).toBeUndefined();
        seen.set(k, r.id);
      }
    }
  });
  it("page length: one page for finance, consulting and quant; one or two full pages elsewhere, incl. software (03#1)", () => {
    const g11 = RULES_BY_ID.get("G-11")!;
    for (const a of ["finance_banking", "consulting", "quant_trading"] as const) expect(resolvedMaxPages(g11, a, "2nd"), a).toBe(1);
    for (const a of ["software_eng", "data_analytics", "product", "marketing_growth", "research"] as const) expect(resolvedMaxPages(g11, a, "2nd"), a).toBe(2);
    expect(resolvedMaxPages(g11, "software_eng", "1st", "spring")).toBe(1);
  });
  it("first-years get the relaxed quantification threshold in every sector (01#3, 03#7)", () => {
    expect(RULES_BY_ID.get("G-22")?.yearAdjust?.["1st"]?.threshold).toBe(0.2);
  });
  it("naAllowed rules say when; needs only on llm rules", () => {
    for (const r of RULES) {
      if (r.naAllowed) expect(r.check === "llm" && /not[ _]applicable/i.test(r.llmGuidance), r.id).toBe(true);
      if (r.needs) expect(r.check, r.id).toBe("llm");
    }
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
  it("length and grade rules are critical for finance, major for quant", () => {
    for (const id of ["G-11", "G-32"]) {
      expect(resolvedSeverity(RULES_BY_ID.get(id)!, "finance_banking", "2nd"), id).toBe("critical");
      expect(resolvedSeverity(RULES_BY_ID.get(id)!, "quant_trading", "2nd"), id).toBe("major");
    }
  });
  it("keeps the 11 debunked myths plus the 2 from the amendments", () => {
    expect(MYTHS).toHaveLength(13);
    expect(MYTHS.map((m) => m.id)).toEqual(Array.from({ length: 13 }, (_, i) => `M${i + 1}`));
  });
  it("pins each sector row: doc row shifted by the amended base change", () => {
    const row = (ats: number, impact: number, clarity: number, relevance: number, uk: number) => ({ ats, impact, clarity, relevance, uk });
    expect(DIMENSION_WEIGHTS).toEqual({
      software_eng: row(15, 20, 20, 35, 10),
      data_analytics: row(15, 20, 20, 35, 10),
      quant_trading: row(5, 15, 25, 45, 10),
      consulting: row(10, 30, 25, 20, 15),
      product: row(10, 25, 30, 25, 10),
      finance_banking: row(10, 20, 25, 25, 20),
      marketing_growth: row(10, 25, 30, 25, 10),
      research: row(10, 15, 25, 40, 10),
    });
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
    expect(RULES_BY_ID.get("G-22")?.evidence).toBe("D");
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
