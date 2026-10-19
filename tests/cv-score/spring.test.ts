import { describe, it, expect } from "vitest";
import { CHECKERS, runCodeChecks } from "@/lib/cv-score/checkers";
import { aggregateCvScore, effectiveSeverity } from "@/lib/cv-score/aggregate";
import { adjustFor, RULES, RULES_BY_ID, rulesFor, SPRING_ADJUST, weightsFor } from "@/lib/cv-rules";
import { SPRING_DEFAULT, SPRING_CAVEAT, caveatFor } from "@/lib/cv-rules/profiles";
import { scoreTrackFor } from "@/lib/profile/cycle";
import type { CvContext } from "@/lib/cv-score/context";
import type { CvRule } from "@/lib/cv-rules/types";
import { ARCHETYPES, type ParsedCV } from "@/lib/types";

// Design: research/spring-weeks/07-cv-rules-design.md §2.

const edu = (...details: string[]): ParsedCV["education"] => [
  { id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2026–2029", grade: "Predicted 2:1", details: details.map((text, i) => ({ id: `d${i}`, text })) },
];
const cv = (over: Partial<ParsedCV> = {}): ParsedCV => ({
  name: "A", email: "a@b.co", phone: "07700 900123", location: null, links: [], summary: null, education: edu(),
  experience: [], projects: [], leadership: [], skills: [], interests: null, sectionOrder: ["education", "experience"],
  yearGuess: null, archetypes: [], ...over,
});
const ctx = (over: Partial<CvContext> = {}): CvContext => ({
  text: "x".repeat(900), pageTexts: ["x".repeat(900)], pageCount: 1, fileSize: 1000, cv: cv(), year: "1st", spellingErrors: [], track: "spring", ...over,
});
const R = (id: string) => RULES_BY_ID.get(id)!;
const status = (checker: keyof typeof CHECKERS, c: CvContext, rule: CvRule = R("SPR-03")) => CHECKERS[checker](c, rule).status;

describe("pre_uni_grades (SPR-03)", () => {
  it.each([
    ["A-levels: Mathematics (A*), Economics (A), History (A)", "pass"],
    ["A-levels: Mathematics, Economics, History", "partial"],
    ["IB Diploma: 40/45 (HL Maths 7, Economics 7)", "pass"],
    ["Abitur: 1.3", "pass"],
    ["Scottish Highers: Maths A, Physics A, English B", "pass"],
  ])("%s → %s", (line, expected) => {
    expect(status("pre_uni_grades", ctx({ cv: cv({ education: edu(line) }) }))).toBe(expected);
  });
  it("fails with no pre-university qualification at all", () => {
    const out = CHECKERS.pre_uni_grades(ctx(), R("SPR-03"));
    expect(out.status).toBe("fail");
    expect(out.fix).toMatch(/A-levels/);
  });
});

describe("gcse_summarised (SPR-02)", () => {
  it("passes a one-line summary", () => {
    expect(status("gcse_summarised", ctx({ cv: cv({ education: edu("10 GCSEs (9–7), including Maths 9 and English Language 8") }) }))).toBe("pass");
  });
  it("fails a subject-by-subject list", () => {
    const line = "GCSEs: Maths 9, English 8, Physics 9, Chemistry 8, Biology 9, History 7, French 7";
    expect(status("gcse_summarised", ctx({ cv: cv({ education: edu(line) }) }))).toBe("fail");
  });
  it("fails AS-levels and quotes them", () => {
    const out = CHECKERS.gcse_summarised(ctx({ cv: cv({ education: edu("AS-levels: Maths A, Physics B") }) }), R("SPR-02"));
    expect(out.status).toBe("fail");
    expect(out.evidenceLine).toBe("AS-levels");
  });
  it("prose 'as' never triggers it; no GCSE line is not applicable", () => {
    expect(status("gcse_summarised", ctx({ cv: cv({ education: edu("Worked as part of a team") }) }))).toBe("not_applicable");
  });
});

describe("leadership_lexicon accepts school roles (every track)", () => {
  it.each(["Prefect, Kingsway School (2023–25)", "Head Girl", "House Captain", "Young Enterprise company director", "Student ambassador"])("%s", (title) => {
    const c = ctx({ track: "standard", cv: cv({ leadership: [{ id: "l0", org: "School", title, dates: "2024", location: "", bullets: [] }] }) });
    expect(CHECKERS.leadership_lexicon(c, R("FIN-06")).status).toBe("pass");
  });
});

describe("track adjustments", () => {
  it("every SPRING_ADJUST key is a real rule", () => {
    for (const id of Object.keys(SPRING_ADJUST)) expect(RULES_BY_ID.has(id), id).toBe(true);
  });
  it("trackAdjust beats yearAdjust (AU-03 is minor for 2nd years, skipped on spring)", () => {
    expect(adjustFor(R("AU-03"), "2nd", "standard")?.severity).toBe("minor");
    expect(adjustFor(R("AU-03"), "2nd", "spring")?.skip).toBe(true);
    // QNT-02 is no longer skipped for first-years (audit 03#10): olympiads are their strongest quant signal.
    expect(adjustFor(R("QNT-02"), "1st", "standard")?.skip).toBeFalsy();
    expect(effectiveSeverity(R("QNT-02"), "quant_trading", "1st", "spring")).toBe("minor");
  });
  it("one page on the spring track", () => {
    const two = ctx({ pageCount: 2 });
    expect(CHECKERS.page_count(two, R("G-11")).status).not.toBe("pass");
    expect(CHECKERS.page_count({ ...two, track: "standard" }, R("G-11")).status).toBe("pass");
  });
  it("quantified bullets: 20% is enough on spring, not on standard", () => {
    const bullets = ["Served customers", "Stacked shelves", "Trained 3 new starters", "Opened the shop", "Closed the till"].map((text, i) => ({ id: `b${i}`, text }));
    const c = ctx({ cv: cv({ experience: [{ id: "x", org: "Tesco", title: "Sales Assistant", dates: "2025", location: "", bullets }] }) });
    expect(CHECKERS.quantified_bullets(c, R("G-22")).status).toBe("pass");
    expect(CHECKERS.quantified_bullets({ ...c, track: "standard", year: "2nd" }, R("G-22")).status).not.toBe("pass");
    expect(effectiveSeverity(R("G-22"), "finance_banking", "1st", "spring")).toBe("minor");
  });
  it("runCodeChecks marks track-skipped rules not applicable", () => {
    const out = runCodeChecks([R("G-31")], ctx());
    expect(out[0].status).toBe("not_applicable");
  });
});

describe("rulesFor by track", () => {
  it("spring adds every SPR rule and drops the replaced ones", () => {
    for (const s of ARCHETYPES) {
      const ids = rulesFor(s, "spring").map((r) => r.id);
      for (const id of ["SPR-01", "SPR-02", "SPR-03", "SPR-04", "SPR-05", "SPR-06", "SPR-07"]) expect(ids, `${s} ${id}`).toContain(id);
      for (const id of ["FIN-04", "FIN-05", "FIN-07", "G-31", "G-33", "AU-03"]) expect(ids, `${s} ${id}`).not.toContain(id);
    }
  });
  it("the standard track has no SPR rules (unchanged)", () => {
    for (const s of ARCHETYPES) expect(rulesFor(s).some((r) => r.id.startsWith("SPR-")), s).toBe(false);
    expect(rulesFor("finance_banking").map((r) => r.id)).toContain("FIN-04");
  });
  it("every SPR rule is spring-only and cited", () => {
    const spr = RULES.filter((r) => r.id.startsWith("SPR-"));
    expect(spr).toHaveLength(7);
    for (const r of spr) {
      expect(r.tracks, r.id).toEqual(["SPR-02", "SPR-06"].includes(r.id) ? ["spring", "placement"] : ["spring"]);
      expect(r.citations.length, r.id).toBeGreaterThan(0);
    }
  });
});

describe("weights and caveat", () => {
  it("spring weights sum to 100 for every sector", () => {
    for (const s of ARCHETYPES) expect(Object.values(weightsFor(s, "spring")).reduce((a, b) => a + b, 0), s).toBe(100);
    expect(weightsFor("consulting", "spring")).toEqual(SPRING_DEFAULT);
  });
  it("a missing-grades fail costs more on spring than on standard", () => {
    const rules = [R("G-32"), R("G-20")];
    const results = [{ ruleId: "G-32", status: "fail" as const, evidenceLine: null, fix: null }, { ruleId: "G-20", status: "pass" as const, evidenceLine: null, fix: null }];
    const facts = { imageOnly: false, spellingErrors: 0, hasPhone: true, hasEmail: true };
    const spring = aggregateCvScore({ rules, results, sector: "consulting", year: "1st", track: "spring", facts });
    const standard = aggregateCvScore({ rules, results, sector: "consulting", year: "1st", facts });
    expect(spring.total).toBeLessThan(standard.total);
  });
  it("spring shows its own caveat", () => {
    expect(caveatFor("consulting", "spring")).toBe(SPRING_CAVEAT);
    expect(caveatFor("software_eng", "standard")).toBeUndefined();
  });
});

describe("scoreTrackFor", () => {
  it("spring-week-eligible students score on the spring track", () => {
    expect(scoreTrackFor({ year: "1st", gradYear: 2029 }, "2026-10-18")).toBe("spring");
    expect(scoreTrackFor({ year: "2nd", gradYear: 2028 }, "2026-10-18")).toBe("standard");
  });
});
