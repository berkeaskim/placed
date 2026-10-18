import { describe, it, expect } from "vitest";
import { needsVisaFor, workAuthOf } from "@/lib/profile/work-auth";
import { OnboardingInput } from "@/lib/validation/onboarding";

describe("work status helpers", () => {
  it("only unrestricted UK right to work (or not saying) means no visa", () => {
    expect(needsVisaFor("uk_rtw")).toBe(false);
    expect(needsVisaFor(null)).toBe(false);
    for (const w of ["student_visa", "graduate_visa", "needs_sponsorship"] as const) expect(needsVisaFor(w)).toBe(true);
  });
  it("profiles saved before work_auth map the old switch to a Student visa", () => {
    expect(workAuthOf({ needs_visa: true })).toBe("student_visa");
    expect(workAuthOf({ needs_visa: false })).toBe(null);
    expect(workAuthOf({ needs_visa: true, work_auth: "needs_sponsorship" })).toBe("needs_sponsorship");
  });
  it("onboarding accepts a work status and still accepts old clients without one", () => {
    const base = { university: "UCL", course: "Economics", year: "1st", locationPref: ["london"], needsVisa: false };
    expect(OnboardingInput.safeParse({ ...base, workAuth: "graduate_visa" }).success).toBe(true);
    expect(OnboardingInput.safeParse(base).success).toBe(true);
    expect(OnboardingInput.safeParse({ ...base, workAuth: "tourist" }).success).toBe(false);
  });
});
