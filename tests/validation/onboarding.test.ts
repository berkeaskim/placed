import { describe, it, expect } from "vitest";
import { OnboardingInput } from "@/lib/validation/onboarding";

describe("OnboardingInput", () => {
  it("accepts a valid payload", () => {
    expect(OnboardingInput.safeParse({ year: "2nd", field: "Economics", locationPref: ["london", "remote"], needsVisa: false }).success).toBe(true);
  });
  it("rejects empty location and unknown year", () => {
    expect(OnboardingInput.safeParse({ year: "2nd", field: "Economics", locationPref: [], needsVisa: false }).success).toBe(false);
    expect(OnboardingInput.safeParse({ year: "5th", field: "Economics", locationPref: ["uk"], needsVisa: false }).success).toBe(false);
  });
  it("rejects a field outside the allowed list", () => {
    expect(OnboardingInput.safeParse({ year: "final", field: "Underwater Basket Weaving", locationPref: ["uk"], needsVisa: true }).success).toBe(false);
  });
});
