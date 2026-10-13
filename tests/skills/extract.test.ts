import { describe, it, expect } from "vitest";
import { extractSkills, canonicalize, SKILLS } from "@/lib/skills/extract";

describe("canonicalize", () => {
  it("maps aliases to canonical names", () => {
    expect(canonicalize("JS")).toBe("JavaScript");
    expect(canonicalize("ml")).toBe("Machine Learning");
    expect(canonicalize("MS Excel")).toBe("Excel");
    expect(canonicalize("unknownthing")).toBeNull();
  });
});

describe("extractSkills", () => {
  it("finds lowercase and symbol-heavy skills with word boundaries", () => {
    const s = extractSkills("Built a dashboard in python and sql; some C++ and C# work; used Node.js.");
    expect(s).toEqual(expect.arrayContaining(["Python", "SQL", "C++", "C#", "Node.js"]));
  });
  it("does not match substrings inside other words", () => {
    expect(extractSkills("Javanese culture and rapport building")).not.toContain("Java");
    expect(extractSkills("Rapport")).not.toContain("R");
  });
  it("matches single-letter R only in skill-like context", () => {
    expect(extractSkills("Statistical modelling in R and Python")).toContain("R");
  });
  it("de-duplicates aliases", () => {
    expect(extractSkills("Excel, MS Excel, Microsoft Excel").filter((x) => x === "Excel")).toHaveLength(1);
  });
  it("covers every archetype with at least 8 skills", () => {
    const keys = ["software_eng", "data_analytics", "quant_trading", "consulting", "product", "finance_banking", "marketing_growth", "research"];
    for (const k of keys) expect(SKILLS.filter((s) => s.archetypes.includes(k as never)).length).toBeGreaterThanOrEqual(8);
  });
  it("does not match R&D as R", () => {
    expect(extractSkills("Worked in Marketing, R&D")).not.toContain("R");
  });
  it("does not match common prose with skill-like words", () => {
    const text = "Improved retention and increased revenue; launched a new brand";
    const skills = extractSkills(text);
    expect(skills).not.toContain("Retention");
    expect(skills).not.toContain("Brand Strategy");
  });
  it("does not match generic prose containing framework-like words", () => {
    const text = "The nature of the role: express interest, spring term, rest of team. Science fair… macro team on rates and credit; the fund signal later published a paper";
    const skills = extractSkills(text);
    expect(skills).not.toContain("Computer Vision");
    expect(skills).not.toContain("Express.js");
    expect(skills).not.toContain("Spring Boot");
    expect(skills).not.toContain("REST API");
    expect(skills).not.toContain("Science");
    expect(skills).not.toContain("Macro");
    expect(skills).not.toContain("Hootsuite");
  });
  it("does not match C as a skill in C-suite", () => {
    expect(extractSkills("C-suite leadership")).not.toContain("C");
  });
  it("does not match Go as a skill in informal prose", () => {
    expect(extractSkills("Go to market strategy")).not.toContain("Go");
  });
  it("matches C++ and C# with symbols", () => {
    const skills = extractSkills("Experienced in C++ and C# development");
    expect(skills).toContain("C++");
    expect(skills).toContain("C#");
  });
  it("matches Express.js and Spring Boot as qualified forms", () => {
    const skills = extractSkills("Building with Express.js and Spring Boot");
    expect(skills).toContain("Express.js");
    expect(skills).toContain("Spring Boot");
  });
  it("matches REST API and RESTful", () => {
    const skills = extractSkills("Designing REST APIs and RESTful services");
    expect(skills).toContain("REST API");
  });
  it("matches PostgreSQL deterministically", () => {
    const skills = extractSkills("Using PostgreSQL and postgresql databases");
    const pgCount = skills.filter((x) => x === "SQL" || x === "PostgreSQL").length;
    expect(pgCount).toBeGreaterThan(0);
  });
});

describe("SKILLS vocabulary", () => {
  it("has no duplicate alias mappings", () => {
    const aliasMap = new Map<string, string>();
    for (const skill of SKILLS) {
      const canonical = skill.canonical.toLowerCase();
      aliasMap.set(canonical, skill.canonical);
      for (const alias of skill.aliases) {
        const lower = alias.toLowerCase();
        const existing = aliasMap.get(lower);
        if (existing && existing !== skill.canonical) {
          throw new Error(`Duplicate alias "${alias}" maps to both "${existing}" and "${skill.canonical}"`);
        }
        aliasMap.set(lower, skill.canonical);
      }
    }
    expect(aliasMap.size).toBeGreaterThan(0);
  });
});
