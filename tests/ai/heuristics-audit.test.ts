import { describe, it, expect } from "vitest";
import { archetypeScores, heuristicExplain, heuristicTagJob, listShape } from "@/lib/ai/heuristics";
import { finalizeExplanation } from "@/lib/ai/explainMatch";
import { jdRequirementSkills } from "@/lib/scoring/coverage";
import { requirementKind, type RequirementRow } from "@/lib/scoring/requirements";
import type { CoverageResult } from "@/lib/scoring/coverage";

const tag = (lines: string[], title = "Software Engineering Intern") => heuristicTagJob({ title, textLines: lines });

describe("heuristic year labels (10#2)", () => {
  it("'graduating in 2028' is not turned into final year", () => {
    expect(tag(["For students graduating in 2028."], "Summer Analyst 2027").yearEligibility).toEqual([]);
  });
  it("explicit wording still maps", () => {
    expect(tag(["Open to penultimate year students"]).yearEligibility).toEqual(["penultimate", "2nd"]);
    expect(tag(["Open to final year students"]).yearEligibility).toEqual(["final", "masters"]);
  });
  it("a 'final-year project' mention is not a final-year restriction", () => {
    expect(tag(["You will present your work like a final-year project"]).yearEligibility).toEqual([]);
  });
});

describe("heuristic must-have over-tagging (10#15)", () => {
  it("'Experience with any of: Python, Java, C++, Go, Rust' is one alternatives group, not five must-haves", () => {
    const t = tag(["## Requirements", "- Experience with any of: Python, Java, C++, Go, Rust"]);
    expect(t.requirements).toHaveLength(5);
    for (const r of t.requirements) expect(r.anyOf).toEqual(["Python", "Java", "C++", "Go", "Rust"]);
    const reqs = jdRequirementSkills(["## Requirements", "- Experience with any of: Python, Java, C++, Go, Rust"], t.requirements);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].anyOf).toHaveLength(5);
  });
  it("'such as' lists are preferred examples", () => {
    const t = tag(["## Requirements", "- Familiarity with data tools such as SQL, Tableau or Excel"]);
    expect(t.requirements.every((r) => r.importance === "preferred" && r.section === "nice")).toBe(true);
  });
  it("only the first five must-section skills are high", () => {
    const t = tag(["## Requirements", "- Python", "- SQL", "- Excel", "- Tableau", "- Docker", "- Git", "- AWS"]);
    expect(t.requirements.filter((r) => r.importance === "high")).toHaveLength(5);
    expect(t.requirements.filter((r) => r.importance === "meaningful").map((r) => r.skill)).toEqual(["Git", "AWS"]);
  });
  it("list shapes", () => {
    expect(listShape("Python, Java or C++", 3)).toBe("alternatives");
    expect(listShape("SQL and Python, or similar", 2)).toBe("all");
    expect(listShape("Tools such as Excel and SQL", 2)).toBe("examples");
    expect(listShape("Python", 1)).toBe("all");
  });
});

describe("non-skill requirements and gap copy (10#13)", () => {
  const coverage: CoverageResult = { readable: true, weighted: 0, must: { matched: 0, total: 1 }, nice: { matched: 0, total: 0 }, items: [{ skill: "Bloomberg", section: "must", status: "gap" }] };
  const reqs = [
    { text: "Right to work in the UK", skill: null, importance: "high" as const, section: "must" as const, evidenceTier: "stated" as const },
    { text: "On track for a 2:1", skill: null, importance: "high" as const, section: "must" as const, evidenceTier: "stated" as const },
    { text: "Bloomberg experience", skill: "Bloomberg", importance: "high" as const, section: "must" as const, evidenceTier: "stated" as const },
    { text: "Excellent teamwork", skill: "Teamwork", importance: "high" as const, section: "must" as const, evidenceTier: "stated" as const },
  ];
  it("kinds", () => {
    expect(requirementKind(reqs[0])).toBe("eligibility");
    expect(requirementKind(reqs[1])).toBe("degree");
    expect(requirementKind(reqs[2])).toBe("skill");
    expect(requirementKind(reqs[3])).toBe("behaviour");
    expect(requirementKind({ text: "Fluent German", skill: null })).toBe("language");
    expect(requirementKind({ text: "2+ years of commercial experience", skill: null })).toBe("experience");
  });
  it("eligibility and degree rows become checks, not blocking gaps with 'society role' advice", () => {
    const h = heuristicExplain({ requirements: reqs, coverage, cvText: "", archetypeMatch: false });
    const e = finalizeExplanation(h.rows, h.gaps, h.whyFit);
    expect(e.checks).toEqual(["Right to work in the UK", "On track for a 2:1"]);
    expect(e.rows.map((r) => r.text)).toEqual(["Bloomberg experience", "Excellent teamwork"]);
    expect(e.gaps.map((g) => g.requirement)).not.toContain("Right to work in the UK");
  });
  it("skill gaps never promise 'a weekend is enough'; soft skills ask for a line that shows it", () => {
    const h = heuristicExplain({ requirements: reqs, coverage, cvText: "", archetypeMatch: false });
    const all = h.gaps.map((g) => g.howToClose).join(" ");
    expect(all).not.toMatch(/weekend/i);
    expect(h.gaps.find((g) => g.requirement === "Bloomberg experience")!.howToClose).toBe("Not shown in your CV. If you've used Bloomberg, add a line that shows it; if not, a small project, module or course can close it.");
    expect(h.gaps.find((g) => g.requirement === "Excellent teamwork")!.howToClose).toMatch(/^Keywords can't judge this one/);
  });
  it("a check the CV does show stays in the table", () => {
    const rows: RequirementRow[] = [{ text: "Degree in Economics", skill: null, importance: "high", evidenceTier: "stated", match: "strong", cvEvidence: "BSc Economics, UCL" }];
    expect(finalizeExplanation(rows, [], []).rows).toHaveLength(1);
  });
});

describe("archetype keywords (10#28)", () => {
  it("bare 'product', 'research', 'data' and 'markets' don't classify", () => {
    const s = (text: string) => archetypeScores(text).find((a) => a.score === 100)?.key ?? null;
    expect(archetypeScores("This launch was the product of a team effort").find((a) => a.key === "product")!.score).toBe(0);
    expect(archetypeScores("Researched suppliers and collated data for the markets team").every((a) => a.score === 0)).toBe(true);
    expect(s("Product Manager intern working on the roadmap")).toBe("product");
    expect(s("Research assistant in a neuroscience laboratory")).toBe("research");
    expect(s("Data analyst building dashboards")).toBe("data_analytics");
  });
});
