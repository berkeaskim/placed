import { describe, it, expect } from "vitest";
import { CHECKERS } from "@/lib/cv-score/checkers";
import { effectiveSeverity } from "@/lib/cv-score/aggregate";
import { DIMENSION_WEIGHTS, RULES, RULES_BY_ID, rulesFor, weightsFor } from "@/lib/cv-rules";
import { PLACEMENT_CAVEAT, caveatFor } from "@/lib/cv-rules/profiles";
import { scoreTrackFor } from "@/lib/profile/cycle";
import type { CvContext } from "@/lib/cv-score/context";
import { ARCHETYPES, type ParsedCV } from "@/lib/types";

// Design: research/placement-year/05-application-content.md §4(a).

const edu = (degree: string, ...details: string[]): ParsedCV["education"] => [
  { id: "e0", institution: "University of Bath", degree, dates: "2025–2029", grade: null, details: details.map((text, i) => ({ id: `d${i}`, text })) },
];
const cv = (over: Partial<ParsedCV> = {}): ParsedCV => ({
  name: "A", email: "a@b.co", phone: "07700 900123", location: null, links: [], summary: null, education: edu("BEng Mechanical Engineering"),
  experience: [], projects: [], leadership: [], skills: [], interests: null, sectionOrder: ["education", "experience"],
  yearGuess: null, archetypes: [], ...over,
});
const ctx = (over: Partial<CvContext> = {}): CvContext => ({
  text: "x".repeat(900), pageTexts: ["x".repeat(900)], pageCount: 1, fileSize: 1000, cv: cv(), year: "2nd", spellingErrors: [], track: "placement", ...over,
});
const R = (id: string) => RULES_BY_ID.get(id)!;

describe("first_year_marks (PLC-01)", () => {
  it.each([
    [["Year 1: 68% average (First)"], "pass"],
    [["First-year average: 2:1"], "pass"],
    [["Thermodynamics: 72%", "Engineering Design: 75%"], "pass"],
    [["Predicted: 2:1"], "partial"],
    [[], "fail"],
  ] as const)("%o → %s", (details, expected) => {
    expect(CHECKERS.first_year_marks(ctx({ cv: cv({ education: edu("BEng Mechanical Engineering", ...details) }) }), R("PLC-01")).status).toBe(expected);
  });
});

describe("placement_grad_date (PLC-02)", () => {
  it("a 3-year date on a sandwich profile fails and quotes the CV's year", () => {
    const c = ctx({ gradYear: 2029, cv: cv({ education: [{ ...edu("BEng Mechanical Engineering")[0], dates: "2025–2028" }] }) });
    const out = CHECKERS.placement_grad_date(c, R("PLC-02"));
    expect(out.status).toBe("fail");
    expect(out.evidenceLine).toBe("2028");
  });
  it("the right year passes; saying 'with Industrial Placement' passes without a known grad year", () => {
    expect(CHECKERS.placement_grad_date(ctx({ gradYear: 2029 }), R("PLC-02")).status).toBe("pass");
    expect(CHECKERS.placement_grad_date(ctx({ cv: cv({ education: edu("BEng Mechanical Engineering with Industrial Placement") }) }), R("PLC-02")).status).toBe("pass");
  });
  it("no marker and no known year is a partial", () => {
    expect(CHECKERS.placement_grad_date(ctx(), R("PLC-02")).status).toBe("partial");
  });
});

describe("rulesFor on the placement track", () => {
  it("adds the PLC rules and the two shared spring rules, and nothing else from spring", () => {
    for (const s of ARCHETYPES) {
      const ids = rulesFor(s, "placement").map((r) => r.id);
      for (const id of ["PLC-01", "PLC-02", "PLC-03", "PLC-04", "SPR-02", "SPR-06"]) expect(ids, `${s} ${id}`).toContain(id);
      for (const id of ["SPR-01", "SPR-03", "SPR-04", "SPR-05", "SPR-07"]) expect(ids, `${s} ${id}`).not.toContain(id);
    }
    expect(rulesFor("software_eng", "placement").map((r) => r.id)).toContain("PLC-05");
    expect(rulesFor("finance_banking", "placement").map((r) => r.id)).not.toContain("PLC-05");
  });
  it("standard and spring don't get PLC rules", () => {
    for (const s of ARCHETYPES) {
      expect(rulesFor(s).some((r) => r.id.startsWith("PLC-")), s).toBe(false);
      expect(rulesFor(s, "spring").some((r) => r.id.startsWith("PLC-")), s).toBe(false);
    }
  });
  it("every PLC rule is placement-only and cited", () => {
    const plc = RULES.filter((r) => r.id.startsWith("PLC-"));
    expect(plc).toHaveLength(5);
    for (const r of plc) { expect(r.tracks).toEqual(["placement"]); expect(r.citations.length, r.id).toBeGreaterThan(0); }
  });
  it("adjustments: action/result softer, quantified bullets at 0.3, extracurriculars major", () => {
    expect(effectiveSeverity(R("G-21"), "consulting", "2nd", "placement")).toBe("minor");
    expect(effectiveSeverity(R("G-34"), "consulting", "2nd", "placement")).toBe("major");
    const bullets = ["Ran stall", "Taught kids", "Served 40 customers a shift", "Opened shop", "Trained 3 starters", "Cleaned"].map((text, i) => ({ id: `b${i}`, text }));
    const c = ctx({ cv: cv({ experience: [{ id: "x", org: "Shop", title: "Assistant", dates: "2025", location: "", bullets }] }) }); // 2 of 6 = 33%
    expect(CHECKERS.quantified_bullets(c, R("G-22")).status).toBe("pass");
    expect(CHECKERS.quantified_bullets({ ...c, track: "standard" }, R("G-22")).status).not.toBe("pass");
  });
});

describe("weights, caveat, default track", () => {
  it("sector weights with impact −5 and uk +5", () => {
    for (const s of ARCHETYPES) {
      const w = weightsFor(s, "placement"), base = DIMENSION_WEIGHTS[s];
      expect(Object.values(w).reduce((a, b) => a + b, 0), s).toBe(100);
      expect(w.impact).toBe(base.impact - 5);
      expect(w.uk).toBe(base.uk + 5);
    }
  });
  it("placement shows its caveat", () => {
    expect(caveatFor("consulting", "placement")).toBe(PLACEMENT_CAVEAT);
  });
  it("placement beats spring for a sandwich 2nd year (class of 2029)", () => {
    expect(scoreTrackFor({ year: "2nd", gradYear: 2029, placementStatus: "required" }, "2026-10-19")).toBe("placement");
    expect(scoreTrackFor({ year: "2nd", gradYear: 2029, placementStatus: "none" }, "2026-10-19")).toBe("spring");
    expect(scoreTrackFor({ year: "2nd", gradYear: 2028 }, "2026-10-19")).toBe("standard");
  });
});
