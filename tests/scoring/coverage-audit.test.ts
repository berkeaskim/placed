import { describe, it, expect } from "vitest";
import { computeCoverage, cvSkillSource, jdRequirementSkills } from "@/lib/scoring/coverage";
import { impliedSkills } from "@/lib/skills/extract";

const cvWith = (over: { skills?: string[]; bullets?: string[]; interests?: string | null; summary?: string | null; modules?: string[] }) => cvSkillSource({
  skills: over.skills ? [{ group: "Skills", items: over.skills }] : [],
  experience: [{ id: "e", org: "Acme", title: "Intern", dates: "", location: "", bullets: (over.bullets ?? []).map((text, i) => ({ id: `b${i}`, text })) }],
  projects: [],
  interests: over.interests ?? null,
  summary: over.summary ?? null,
  education: [{ id: "ed", institution: "UCL", degree: "BSc Economics", dates: "", grade: null, details: (over.modules ?? []).map((text, i) => ({ id: `m${i}`, text })) }],
});
const must = (skill: string) => ({ skill, section: "must" as const });

describe("soft skills leave keyword coverage (10#10)", () => {
  it("'excellent teamwork and communication skills' is not two keyword must-haves", () => {
    const reqs = jdRequirementSkills(["## Requirements", "- Excellent teamwork and communication skills", "- Python"], [
      { text: "Strong leadership", skill: "Leadership", importance: "high", section: "must", evidenceTier: "stated" },
    ]);
    expect(reqs.map((r) => r.skill)).toEqual(["Python"]);
  });
  it("so 'worked in a team of 4' is no longer a false gap, and a Skills-list 'Communication' no longer a false match", () => {
    const reqs = jdRequirementSkills(["## Requirements", "- Teamwork", "- Communication skills"], []);
    expect(computeCoverage(reqs, cvWith({ skills: ["Communication skills"], bullets: ["Worked in a team of 4 to ship an app"] })).readable).toBe(false);
  });
});

describe("skill implication on the CV side (10#11)", () => {
  it.each([
    ["SQL", { bullets: ["Queried PostgreSQL for the society's membership data"] }],
    ["Python", { skills: ["pandas", "NumPy", "PyTorch"] }],
    ["Machine Learning", { skills: ["scikit-learn"] }],
    ["React", { bullets: ["Built a Next.js site for a charity"] }],
    ["Node.js", { skills: ["Express.js"] }],
    ["Java", { skills: ["Spring Boot"] }],
    ["Python", { skills: ["Django"] }],
    ["Data Visualisation", { skills: ["Power BI"] }],
    ["JavaScript", { skills: ["TypeScript"] }],
  ] as const)("JD %s is supported by %j", (skill, cv) => {
    const r = computeCoverage([must(skill)], cvWith(cv));
    expect(r.items[0].status).toBe("supportedByResume");
    expect(r.weighted).toBeCloseTo(0.75, 5);
  });
  it("never the other way round: a CV saying Python does not satisfy a JD asking for pandas", () => {
    expect(computeCoverage([must("Pandas")], cvWith({ skills: ["Python"] })).items[0].status).toBe("gap");
  });
  it("closure is transitive and excludes what the CV already names", () => {
    expect(impliedSkills(["Next.js"]).sort()).toEqual(["JavaScript", "React"]);
    expect(impliedSkills(["Python", "Pandas"])).toEqual([]);
  });
  it("a skill shown directly still counts in full", () => {
    expect(computeCoverage([must("SQL")], cvWith({ skills: ["SQL", "PostgreSQL"] })).items[0].status).toBe("existing");
  });
});

describe("interests and summary mentions count for little (10#16)", () => {
  it("'Interests: following AI, chess, Python meetups' is a gap with 0.25 credit, not 0.75", () => {
    const r = computeCoverage([must("Python")], cvWith({ interests: "Following AI, chess, Python meetups" }));
    expect(r.items[0].status).toBe("gap");
    expect(r.items[0].mentioned).toBe(true);
    expect(r.weighted).toBeCloseTo(0.25, 5);
    expect(r.must.matched).toBe(0);
  });
  it("a summary claim is also only a mention", () => {
    expect(computeCoverage([must("SQL")], cvWith({ summary: "Economics student skilled in SQL" })).items[0]).toMatchObject({ status: "gap", mentioned: true });
  });
  it("an education module keeps 0.75", () => {
    const r = computeCoverage([must("Statistics")], cvWith({ modules: ["Modules: Statistics, Econometrics"] }));
    expect(r.items[0].status).toBe("supportedByResume");
    expect(r.weighted).toBeCloseTo(0.75, 5);
  });
});
