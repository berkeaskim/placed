import { describe, expect, it } from "vitest";
import { canonicalUniversity, searchUniversities, UK_UNIVERSITIES } from "@/lib/profile/uk-universities";
import { COURSES, courseCore, fieldForCourse, searchCourses } from "@/lib/profile/courses";
import { FIELDS } from "@/lib/validation/onboarding";
import { OnboardingInput } from "@/lib/validation/onboarding";

describe("searchUniversities", () => {
  it("finds a school by its short name", () => {
    expect(searchUniversities("ucl")[0]).toBe("University College London");
    expect(searchUniversities("LSE")[0]).toBe("London School of Economics and Political Science");
    expect(searchUniversities("kcl")[0]).toBe("King's College London");
  });
  it("ranks the distinctive word over filler", () => {
    expect(searchUniversities("bristol")[0]).toBe("University of Bristol");
    expect(searchUniversities("edinb").slice(0, 2)).toEqual(["University of Edinburgh", "Edinburgh Napier University"]);
    expect(searchUniversities("manch")[0]).toBe("University of Manchester");
    expect(searchUniversities("univ of man")[0]).toBe("University of Manchester");
  });
  it("is empty for an empty query and caps the list", () => {
    expect(searchUniversities("  ")).toEqual([]);
    expect(searchUniversities("university").length).toBeLessThanOrEqual(8);
  });
  it("has no duplicates", () => expect(new Set(UK_UNIVERSITIES).size).toBe(UK_UNIVERSITIES.length));
  it("canonicalises exact names and aliases only", () => {
    expect(canonicalUniversity("imperial")).toBe("Imperial College London");
    expect(canonicalUniversity("university of york")).toBe("University of York");
    expect(canonicalUniversity("Sorbonne")).toBeNull();
  });
});

describe("courses", () => {
  it("files every suggestion under a real field", () => {
    for (const [, f] of COURSES) expect(FIELDS).toContain(f);
  });
  it("strips degree words", () => expect(courseCore("BSc (Hons) Economics & Statistics")).toBe("economics and statistics"));
  it("maps listed and unlisted courses by their leading subject", () => {
    expect(fieldForCourse("BSc Economics and Statistics")).toBe("Economics");
    expect(fieldForCourse("Mathematics with Economics")).toBe("Mathematics");
    expect(fieldForCourse("Economics with Mathematics")).toBe("Economics");
    expect(fieldForCourse("MEng Mechatronics")).toBe("Engineering");
    expect(fieldForCourse("Pharmacology")).toBe("Natural Sciences");
    expect(fieldForCourse("LLB")).toBe("Law");
    expect(fieldForCourse("Law (LLB)")).toBe("Law");
    expect(fieldForCourse("Medicine")).toBe("Other");
    expect(fieldForCourse("Liberal Arts")).toBeNull();
  });
  it("suggests courses as the student types", () => {
    expect(searchCourses("econ")[0]).toBe("Economics");
    expect(searchCourses("comp sci")).toContain("Computer Science");
    expect(searchCourses("")).toEqual([]);
  });
});

describe("OnboardingInput", () => {
  const base = { university: "  University  of Bristol ", course: "Economics", year: "2nd", locationPref: ["london"], needsVisa: false };
  it("tidies whitespace", () => expect(OnboardingInput.parse(base).university).toBe("University of Bristol"));
  it("rejects names without letters or too short", () => {
    expect(OnboardingInput.safeParse({ ...base, course: "123" }).success).toBe(false);
    expect(OnboardingInput.safeParse({ ...base, university: "a" }).success).toBe(false);
  });
});
