import { describe, it, expect } from "vitest";
import { heuristicTagJob, archetypeScores } from "@/lib/ai/heuristics";

const lines = [
  "## About the role",
  "Join our data team as a Data Analyst Intern for summer 2027. Open to penultimate year students.",
  "## Requirements",
  "- Strong SQL and Excel skills",
  "- Experience with Python",
  "## Nice to have",
  "- Tableau",
  "Applications close 30 November 2026. We are unable to provide visa sponsorship.",
];

describe("heuristicTagJob", () => {
  const t = heuristicTagJob({ title: "Data Analyst Intern", textLines: lines });
  it("detects archetype, year, sponsorship, deadline", () => {
    expect(t.archetype).toBe("data_analytics");
    expect(t.yearEligibility).toEqual(expect.arrayContaining(["penultimate"]));
    expect(t.sponsorsVisa).toBe("no");
    expect(t.deadline).toBe("2026-11-30");
    expect(t.employmentType).toBe("internship");
  });
  it("extracts must and nice requirements with canonical skills", () => {
    const must = t.requirements.filter((r) => r.section === "must").map((r) => r.skill);
    const nice = t.requirements.filter((r) => r.section === "nice").map((r) => r.skill);
    expect(must).toEqual(expect.arrayContaining(["SQL", "Excel", "Python"]));
    expect(nice).toContain("Tableau");
  });
  it("never marks heuristic (structural) requirements as critical", () => {
    expect(t.requirements.every((r) => r.importance !== "critical")).toBe(true);
  });
});

describe("archetypeScores", () => {
  it("ranks the title's archetype first", () => {
    expect(archetypeScores("We build trading systems", "Quantitative Trader Intern")[0].key).toBe("quant_trading");
  });
});
