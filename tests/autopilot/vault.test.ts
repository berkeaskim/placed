import { describe, it, expect } from "vitest";
import { CoreSchema, isComplete, prefillCore, vaultValue, isEeoLabel, isEeoKey, normLabel } from "@/lib/autopilot/vault";
import type { ParsedCV } from "@/lib/types";
import { AYSE_CORE } from "./fixtures";

describe("vault", () => {
  it("is complete only when every required field is set", () => {
    expect(isComplete(AYSE_CORE)).toBe(true);
    expect(isComplete({ ...AYSE_CORE, rtw_uk: undefined })).toBe(false);
    expect(isComplete({ ...AYSE_CORE, grad_year: "28" })).toBe(false);
  });
  it("rejects EEO-looking keys and labels", () => {
    for (const k of ["gender", "ethnicity", "disability_status", "sexual_orientation", "religion", "free_school_meals", "veteran"]) expect(isEeoKey(k)).toBe(true);
    expect(isEeoKey("grad_year")).toBe(false);
    expect(isEeoLabel("What is your gender identity?")).toBe(true);
    expect(isEeoLabel("Were you eligible for free school meals?")).toBe(true);
    expect(isEeoLabel("Do you consider yourself to have a disability?")).toBe(true);
    expect(isEeoLabel("What year does your course finish?")).toBe(false);
  });
  it("derives composite values", () => {
    expect(vaultValue(AYSE_CORE, "full_name")).toBe("Ayşe Demir");
    expect(vaultValue(AYSE_CORE, "location")).toBe("London, United Kingdom");
    expect(vaultValue(AYSE_CORE, "graduation")).toBe("June 2028");
    expect(vaultValue(AYSE_CORE, "needs_sponsorship")).toBe("No");
    expect(vaultValue(AYSE_CORE, "linkedin")).toBeNull();
  });
  it("prefills from CV and profile without inventing RTW", () => {
    const cv = { name: "Ayşe Demir", email: "a@x.com", phone: "07700 900123", location: "London", links: ["https://linkedin.com/in/ayse", "https://github.com/ayse"],
      education: [{ id: "e1", institution: "University College London", degree: "BSc Economics", dates: "2025 – 2028", grade: null, details: [] }] } as unknown as ParsedCV;
    const p = prefillCore({ email: "auth@x.com", year: "2nd", cv, needsVisa: false });
    expect(p).toMatchObject({ first_name: "Ayşe", last_name: "Demir", email: "auth@x.com", phone: "07700 900123", university: "University College London",
      degree: "BSc Economics", grad_year: "2028", year_of_study: "2nd", city: "London", linkedin: "https://linkedin.com/in/ayse", github: "https://github.com/ayse" });
    expect(p.rtw_uk).toBeUndefined();
    expect(p.needs_sponsorship).toBeUndefined();
  });
  it("normalises labels for ask-once memory", () => {
    expect(normLabel("  🛂 What's your level of German?\n")).toBe("whats your level of german");
  });
  it("schema strips unknown keys", () => {
    expect(CoreSchema.parse({ ...AYSE_CORE, gender: "x" })).not.toHaveProperty("gender");
  });
});
