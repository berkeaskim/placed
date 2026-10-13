import { describe, it, expect } from "vitest";
import { computeCoverage, jdRequirementSkills, profileSkillSource } from "@/lib/scoring/coverage";
import type { Requirement } from "@/lib/types";

const req = (skill: string, text: string, anyOf?: string[]): Requirement => ({
  text, skill, anyOf, importance: "critical", section: "must", evidenceTier: "stated",
});

describe("anyOf requirement groups", () => {
  const lines = ["## Requirements", "- Python or C++ is required", "- Solid SQL"];
  const tagged = [
    req("Python", "Python or C++ is required", ["Python", "C++"]),
    req("C++", "Python or C++ is required", ["Python", "C++"]),
    req("SQL", "Solid SQL"),
  ];

  it("becomes one must-have item instead of demanding every alternative", () => {
    const skills = jdRequirementSkills(lines, tagged);
    expect(skills).toEqual([
      { skill: "SQL", section: "must" },
      { skill: "Python or C++", section: "must", anyOf: ["Python", "C++"] },
    ]);
  });

  it("is satisfied by any one alternative", () => {
    const r = computeCoverage(jdRequirementSkills(lines, tagged), profileSkillSource(["C++", "SQL"]));
    expect(r.weighted).toBe(1);
    expect(r.must).toEqual({ matched: 2, total: 2 });
  });

  it("is a gap only when no alternative is present", () => {
    const r = computeCoverage(jdRequirementSkills(lines, tagged), profileSkillSource(["SQL"]));
    expect(r.items.find((i) => i.anyOf)?.status).toBe("gap");
    expect(r.must).toEqual({ matched: 1, total: 2 });
  });

  it("an alternative also required on its own line is still required on its own", () => {
    const r = computeCoverage(
      jdRequirementSkills([...lines, "- Python scripting is essential"], tagged),
      profileSkillSource(["C++", "SQL"]),
    );
    expect(r.items.find((i) => i.skill === "Python")?.status).toBe("gap");
  });
});
