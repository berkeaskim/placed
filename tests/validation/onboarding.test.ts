import { describe, it, expect } from "vitest";
import { OnboardingInput } from "@/lib/validation/onboarding";

const base = { university: "University of Leeds", course: "Economics", year: "2nd", locationPref: ["london", "remote"], needsVisa: false };

describe("OnboardingInput", () => {
  it("accepts a valid payload", () => {
    expect(OnboardingInput.safeParse(base).success).toBe(true);
  });
  it("rejects empty location and unknown year", () => {
    expect(OnboardingInput.safeParse({ ...base, locationPref: [] }).success).toBe(false);
    expect(OnboardingInput.safeParse({ ...base, year: "5th", locationPref: ["uk"] }).success).toBe(false);
  });
  it("requires a university and a course", () => {
    expect(OnboardingInput.safeParse({ ...base, university: undefined }).success).toBe(false);
    expect(OnboardingInput.safeParse({ ...base, course: "" }).success).toBe(false);
  });
});
