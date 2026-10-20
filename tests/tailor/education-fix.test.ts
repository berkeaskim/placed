import { describe, expect, it } from "vitest";
import { fixEducationForTrack, parsePairs, placementEducationLines, predictedGrade, springEducationLines } from "@/lib/tailor/education-fix";
import type { ParsedCV } from "@/lib/types";

const lines = (...t: string[]) => t.map((text, i) => ({ id: `d${i}`, text }));
const texts = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text);

describe("parsePairs", () => {
  it("reads subject-grade pairs in several styles", () => {
    expect(parsePairs("Mathematics A*, Economics (A); History - A")).toEqual([
      { subject: "Mathematics", grade: "A*" }, { subject: "Economics", grade: "A" }, { subject: "History", grade: "A" },
    ]);
    expect(parsePairs("Further Mathematics: A, Physics (B)")).toHaveLength(2);
  });
  it("refuses a line that says more than pairs", () => {
    expect(parsePairs("Mathematics A*, predicted at St Paul's")).toBeNull();
  });
});

describe("springEducationLines", () => {
  it("puts A-levels on one line with grades in brackets, keeping order and names", () => {
    const r = springEducationLines(lines("A Levels - Maths A*, Economics A, History A"));
    expect(texts(r)).toEqual(["A-levels: Maths (A*), Economics (A), History (A)"]);
    expect(r.changes).toHaveLength(1);
  });
  it("merges one-per-line A-levels into one line", () => {
    const r = springEducationLines(lines("A-level Mathematics: A*", "A-level Physics: A", "Head of House"));
    expect(texts(r)).toEqual(["A-levels: Mathematics (A*), Physics (A)", "Head of House"]);
  });
  it("summarises itemised GCSEs, naming Maths and English only when listed", () => {
    const r = springEducationLines(lines("GCSEs: Maths 9, English Language 8, Physics 9, Chemistry 8, Biology 7, History 6"));
    expect(texts(r)).toEqual(["6 GCSEs (9–6), including Maths (9) and English Language (8)"]);
    const noMaths = springEducationLines(lines("GCSEs: Physics 9, Chemistry 8, Biology 7, History 6"));
    expect(texts(noMaths)).toEqual(["4 GCSEs (9–6)"]);
  });
  it("leaves a GCSE line that is already short", () => {
    const src = lines("10 GCSEs (9-7) including Maths and English");
    expect(texts(springEducationLines(src))).toEqual(["10 GCSEs (9-7) including Maths and English"]);
  });
  it("drops AS-levels and formats the EPQ", () => {
    const r = springEducationLines(lines("AS-levels: Chemistry B", "Extended Project Qualification (EPQ): A* - The economics of rent controls"));
    expect(texts(r)).toEqual(["EPQ (A*): The economics of rent controls"]);
    expect(r.changes[0].after).toBeNull();
  });
  it("puts an IB total out of 45", () => {
    expect(texts(springEducationLines(lines("IB 40 points (HL Mathematics 7, Economics 7, Physics 6)")))).toEqual(["IB Diploma: 40/45 (HL Mathematics 7, Economics 7, Physics 6)"]);
  });
  it("never touches a line it can't parse", () => {
    const src = lines("A-levels: Maths, Economics and History (results August 2025)", "Scholarship for academic excellence");
    const r = springEducationLines(src);
    expect(texts(r)).toEqual(src.map((l) => l.text));
    expect(r.changes).toEqual([]);
  });
  it("keeps the multiset of A-level grades exactly", () => {
    const src = "A-levels: Mathematics A*, Further Mathematics A*, Economics A";
    const out = texts(springEducationLines(lines(src)))[0];
    const bag = (s: string) => (s.match(/A\*|\b[A-E]\b/g) ?? []).sort();
    expect(bag(out.replace("A-levels", ""))).toEqual(bag(src.replace("A-levels", "")));
  });
});

describe("predictedGrade", () => {
  const edu = (grade: string | null, dates: string) => ({ id: "e", institution: "UCL", degree: "BSc", dates, grade, details: [] });
  it("labels a stated class on a degree in progress, never upgrades", () => {
    expect(predictedGrade(edu("2:1", "2025–2028"), 2026)).toBe("2:1 (predicted)");
    expect(predictedGrade(edu("2:1", "2021–2024"), 2026)).toBeNull();
    expect(predictedGrade(edu("Predicted 2:1", "2025–2028"), 2026)).toBeNull();
    expect(predictedGrade(edu(null, "2025–2028"), 2026)).toBeNull();
  });
});

describe("placementEducationLines", () => {
  it("cuts a long module list to the relevant ones, marks kept, source order kept", () => {
    const src = "Modules: Thermodynamics (72%), Programming in Python (80%), Fluid Mechanics (68%), Materials (65%), Maths 1 (70%), Design (75%), Lab Skills (60%)";
    const r = placementEducationLines(lines(src), ["Python", "fluid", "design"]);
    expect(texts(r)).toEqual(["Relevant modules: Programming in Python (80%), Fluid Mechanics (68%), Design (75%)"]);
    // A subset of the source modules.
    for (const m of texts(r)[0].replace("Relevant modules: ", "").split(", ")) expect(src).toContain(m);
  });
  it("tops up to three and leaves the list when nothing matches", () => {
    const src = "Modules: A (70%), B (71%), C (72%), D (73%), E (74%), F (75%), G (76%)";
    expect(texts(placementEducationLines(lines(src), ["zzz"]))).toEqual([src]);
    expect(texts(placementEducationLines(lines(src), ["Python"]))).toEqual([src]);
  });
  it("normalises a Year-1 result", () => {
    expect(texts(placementEducationLines(lines("First year average: 68% - First class"), []))).toEqual(["Year 1: 68% (First)"]);
    expect(texts(placementEducationLines(lines("Year 1 68% avg"), []))).toEqual(["Year 1: 68%"]);
  });
});

describe("fixEducationForTrack", () => {
  const cv = {
    name: "A", email: null, phone: null, location: null, links: [], summary: null, experience: [], projects: [], leadership: [], skills: [],
    interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
    education: [
      { id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2025–2028", grade: "2:1", details: lines("Modules: Micro, Macro") },
      { id: "e1", institution: "Sixth Form", degree: "A-levels", dates: "2023–2025", grade: null, details: lines("A-levels: Maths A*, Economics A", "AS Levels: Physics B") },
    ],
  } as unknown as ParsedCV;
  it("is a no-op on the standard track", () => {
    expect(fixEducationForTrack(cv, "standard", { todayYear: 2026 }).cv).toBe(cv);
  });
  it("fixes spring education and reports each change", () => {
    const r = fixEducationForTrack(cv, "spring", { todayYear: 2026 });
    expect(r.cv.education[0].grade).toBe("2:1 (predicted)");
    expect(r.cv.education[1].details.map((d) => d.text)).toEqual(["A-levels: Maths (A*), Economics (A)"]);
    expect(r.changes).toHaveLength(3);
    expect(cv.education[1].details).toHaveLength(2); // the input is not mutated
  });
});
