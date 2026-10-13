import { describe, it, expect } from "vitest";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { assignIds } from "@/lib/cv/ids";
import { isImageOnly } from "@/lib/cv/pdf-text";

const text = `Ayse Demir
ayse.demir@example.com | +44 7700 900123 | London | github.com/aysedemir
EDUCATION
University College London — BSc Economics, 2024–2027
Predicted 2:1
EXPERIENCE
Finance Society — Events Officer, 2025–present
• Organised weekly society events
• Managed a budget of £2,000
PROJECTS
Rent Dashboard
• Built a dashboard in Python and SQL tracking London rents
SKILLS
Python, SQL, Excel
INTERESTS
Running (London 10k 2025), chess`;

describe("heuristicParseCv", () => {
  const cv = assignIds(heuristicParseCv(text));
  it("extracts contact details and sections in order", () => {
    expect(cv.email).toBe("ayse.demir@example.com");
    expect(cv.phone).toContain("7700");
    expect(cv.sectionOrder.slice(0, 3)).toEqual(["education", "experience", "projects"]);
  });
  it("extracts bullets verbatim with stable ids", () => {
    expect(cv.experience[0].bullets.map((b) => b.text)).toEqual(["Organised weekly society events", "Managed a budget of £2,000"]);
    expect(cv.experience[0].bullets[1].id).toBe("x0-b1");
    expect(cv.projects[0].bullets[0].id).toBe("p0-b0");
  });
  it("extracts skills and interests", () => {
    expect(cv.skills.flatMap((g) => g.items)).toEqual(expect.arrayContaining(["Python", "SQL", "Excel"]));
    expect(cv.interests).toContain("Running");
  });
});

describe("heuristicParseCv on a blank CV", () => {
  it("returns no archetypes when nothing scored", () => {
    expect(heuristicParseCv("").archetypes).toEqual([]);
    expect(heuristicParseCv("   \n  ").archetypes).toEqual([]);
  });
  it("only keeps archetypes with a positive score", () => {
    expect(heuristicParseCv(text).archetypes.every((a) => a.score > 0)).toBe(true);
  });
});

describe("isImageOnly", () => {
  it("flags pages with almost no text", () => {
    expect(isImageOnly(["", "  "])).toBe(true);
    expect(isImageOnly(["a".repeat(800)])).toBe(false);
  });
});
