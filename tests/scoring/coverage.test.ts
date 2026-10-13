import { describe, it, expect } from "vitest";
import { jdRequirementSkills, computeCoverage, coverageLabel, type CvSkillSource } from "@/lib/scoring/coverage";

const cv: CvSkillSource = {
  skillsList: ["Python", "Excel"],
  bulletText: "Built a dashboard in SQL for the finance society",
  otherText: "Coursework: Statistics and econometrics. Familiar with Tableau.",
};

describe("jdRequirementSkills", () => {
  it("merges section-tagged JD skills with tagged requirements; must wins over nice", () => {
    const reqs = jdRequirementSkills(
      ["## Requirements", "- SQL and Python", "## Nice to have", "- Tableau, SQL"],
      [{ text: "Excel", skill: "Excel", importance: "high", section: "must", evidenceTier: "stated" }],
    );
    expect(reqs).toEqual(expect.arrayContaining([
      { skill: "SQL", section: "must" }, { skill: "Python", section: "must" },
      { skill: "Tableau", section: "nice" }, { skill: "Excel", section: "must" },
    ]));
    expect(reqs.filter((r) => r.skill === "SQL")).toHaveLength(1);
  });
  it("must wins over nice regardless of order (nice section first, must later)", () => {
    const reqs = jdRequirementSkills(["## Nice to have", "- SQL", "## Requirements", "- SQL and Python"], []);
    expect(reqs.filter((r) => r.skill === "SQL")).toEqual([{ skill: "SQL", section: "must" }]);
  });
  it("prose-only JD end to end is unreadable, never 100%", () => {
    const lines = ["We are a friendly team looking for a motivated person to join us and grow with the company over the summer."];
    const reqs = jdRequirementSkills(lines, []);
    const r = computeCoverage(reqs, cv);
    expect(r.readable).toBe(false);
    expect(r.weighted).toBeNull();
    expect(coverageLabel(r)).toBe("Couldn't read the requirements");
    expect(coverageLabel(r)).not.toContain("100%");
  });
});

describe("computeCoverage", () => {
  it("weights must ×2, nice ×1 and gives partial credit for prose-only mentions", () => {
    const r = computeCoverage(
      [{ skill: "Python", section: "must" }, { skill: "SQL", section: "must" }, { skill: "R", section: "must" }, { skill: "Tableau", section: "nice" }],
      cv,
    );
    // must: Python existing(1) + SQL existing(1) + R gap(0) = 2 of 3 weight-2 → 4/6; nice: Tableau supported 0.75 → 0.75/1
    expect(r.weighted).toBeCloseTo((4 + 0.75) / 7, 5);
    expect(r.must).toEqual({ matched: 2, total: 3 });
    expect(r.nice).toEqual({ matched: 1, total: 1 });
    expect(r.items.find((i) => i.skill === "Tableau")!.status).toBe("supportedByResume");
    expect(r.items.find((i) => i.skill === "R")!.status).toBe("gap");
  });
  it("is unreadable (null, never 100%) when the JD yields no requirements", () => {
    const r = computeCoverage([], cv);
    expect(r.readable).toBe(false);
    expect(r.weighted).toBeNull();
    expect(coverageLabel(r)).toBe("Couldn't read the requirements");
  });
  it("formats the label", () => {
    const r = computeCoverage([{ skill: "Python", section: "must" }, { skill: "Tableau", section: "nice" }], cv);
    expect(coverageLabel(r)).toBe("You match 1/1 must-haves, 1/1 nice-to-haves (92%)");
  });
});

describe("coverageLabel rounding", () => {
  it("never shows 100% while a gap exists", () => {
    const reqs = Array.from({ length: 300 }, (_, i) => ({ skill: i === 0 ? "R" : "Python", section: "nice" as const }));
    const r = computeCoverage(reqs, cv);
    expect(r.weighted!).toBeGreaterThan(0.995);
    expect(coverageLabel(r)).toContain("(99%)");
  });
});
