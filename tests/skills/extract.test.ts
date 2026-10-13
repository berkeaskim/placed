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
});
