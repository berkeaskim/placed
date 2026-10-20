import { describe, it, expect } from "vitest";
import { CoreSchema, isComplete, normaliseUrl, prefillCore, vaultValue, isEeoLabel, isEeoKey, normLabel } from "@/lib/autopilot/vault";
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
    for (const l of ["Were you the first of your family to attend university?", "Are you a first-generation student?", "What is your nationality?", "Have you served in the military?", "If you answered 'prefer to self-describe', say more", "What was the occupation of your main household earner?", "What type of school did you attend?"]) expect(isEeoLabel(l)).toBe(true);
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
  it("normaliseUrl adds https:// to scheme-less links and leaves the rest alone", () => {
    expect(normaliseUrl("linkedin.com/in/amirakhan-e2e")).toBe("https://linkedin.com/in/amirakhan-e2e");
    expect(normaliseUrl("  www.github.com/ayse ")).toBe("https://www.github.com/ayse");
    expect(normaliseUrl("//ayse.dev")).toBe("https://ayse.dev");
    expect(normaliseUrl("https://linkedin.com/in/ayse")).toBe("https://linkedin.com/in/ayse");
    expect(normaliseUrl("HTTP://ayse.dev")).toBe("HTTP://ayse.dev");
    expect(normaliseUrl("")).toBe("");
    expect(normaliseUrl("   ")).toBe("");
    expect(normaliseUrl("my portfolio")).toBe("my portfolio");
    expect(normaliseUrl("ayse")).toBe("ayse");
  });
  it("prefill normalises scheme-less CV links so the setup form can save them", () => {
    const cv = { name: "Amira Khan", links: ["linkedin.com/in/amirakhan-e2e", "github.com/amira", "amira.dev"] } as unknown as ParsedCV;
    const p = prefillCore({ email: null, year: null, cv, needsVisa: false });
    expect(p).toMatchObject({ linkedin: "https://linkedin.com/in/amirakhan-e2e", github: "https://github.com/amira", portfolio: "https://amira.dev" });
  });
  it("schema accepts scheme-less links (normalised) and rejects non-web ones", () => {
    expect(CoreSchema.shape.linkedin.parse("linkedin.com/in/ayse")).toBe("https://linkedin.com/in/ayse");
    expect(CoreSchema.shape.linkedin.parse("")).toBeUndefined();
    expect(CoreSchema.shape.linkedin.parse(undefined)).toBeUndefined();
    expect(CoreSchema.shape.portfolio.safeParse("javascript:alert(1)").success).toBe(false);
    expect(CoreSchema.shape.portfolio.safeParse("my portfolio").success).toBe(false);
    expect(CoreSchema.parse({ ...AYSE_CORE, github: "github.com/ayse" }).github).toBe("https://github.com/ayse");
  });
});
