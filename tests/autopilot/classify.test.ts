import { describe, it, expect } from "vitest";
import labels from "../fixtures/autopilot/labels.json";
import { classify } from "@/lib/autopilot/classify";

describe("classify", () => {
  it.each([
    ["First Name", "text", { kind: "vault", key: "first_name" }],
    ["Last Name", "text", { kind: "vault", key: "last_name" }],
    ["Name", "text", { kind: "vault", key: "full_name" }],
    ["Email", "text", { kind: "vault", key: "email" }],
    ["Best Contact Number", "text", { kind: "vault", key: "phone" }],
    ["LinkedIn Profile", "text", { kind: "vault", key: "linkedin" }],
    ["What year does your course finish?", "multiselect", { kind: "vault", key: "grad_year" }],
    ["If you're studying a degree, let us know what degree course you are studying?", "text", { kind: "vault", key: "degree" }],
    ["What year of your studies are you in?", "text", { kind: "vault", key: "year_of_study" }],
    ["🛂 Please confirm your Right to Work status in the location where this job is advertised.", "select", { kind: "vault", key: "rtw_uk" }],
    ["Will you now or in the future require sponsorship to work within the UK?", "boolean", { kind: "vault", key: "needs_sponsorship" }],
    ["Where did you hear about us?", "textarea", { kind: "vault", key: "heard_about" }],
    ["Location", "location", { kind: "vault", key: "location" }],
    ["Resume/CV", "file", { kind: "file", which: "cv" }],
    ["Cover Letter (optional)", "file", { kind: "file", which: "cover" }],
    ["Let us know why you're excited to work for Monzo? (250 word limit)", "textarea", { kind: "freeText" }],
    ["Why Multiverse?", "textarea", { kind: "freeText" }],
    ["🔐 Keeping your data safe is really important to us. Please take a look at our Candidate Data Privacy Notice", "select", { kind: "consent" }],
    ["What is your gender?", "select", { kind: "eeo" }],
    ["Do you require any reasonable adjustments to be made throughout our hiring process?", "textarea", { kind: "yours" }],
    ["Tell us about any disability-related adjustments you need", "textarea", { kind: "eeo" }],
    ["Have you previously been employed by this company?", "select", { kind: "yours" }],
    ["What's your level of German?", "select", { kind: "extra" }],
    ["Do you have prior coding experience? If so, please provide details about languages, projects or experiences that demonstrate your coding skills. Github links welcome.", "textarea", { kind: "freeText" }],
    ["If you'd like to, please spell out your name how it's pronounced so we know how to say it.", "text", { kind: "extra" }],
  ] as const)("%s", (label, type, expected) => {
    expect(classify(label, type)).toEqual(expected);
  });

  it.each([
    ["If you went to university, were you the first of your family to attend?", "select", { kind: "eeo" }],
    ["What is your nationality?", "select", { kind: "eeo" }],
    ["Are you legally authorized to work in the United States?", "select", { kind: "yours" }],
    ["Do you have the right to work in the UK?", "select", { kind: "vault", key: "rtw_uk" }],
    ["Do you have the right to work in London throughout the internship period, without sponsorship?", "select", { kind: "vault", key: "rtw_uk" }],
    ["Please upload your degree transcript with course breakdown here.", "text", { kind: "extra" }],
    ["What is your GPA?", "text", { kind: "vault", key: "grades" }],
    ["Alternate Email", "text", { kind: "extra" }],
    ["Which university do you currently attend?", "select", { kind: "vault", key: "university" }],
    ["Terms & Conditions", "select", { kind: "consent" }],
  ] as const)("regression: %s", (label, type, expected) => {
    expect(classify(label, type)).toEqual(expected);
  });

  it("never maps an EEO or consent label from the real corpus to vault or extra", () => {
    const leaks = (labels as string[]).filter((l) => /gender|ethnic|disab|sexual|religio|free school|privacy notice/i.test(l))
      .filter((l) => ["vault", "extra", "freeText"].includes(classify(l, "select").kind));
    expect(leaks).toEqual([]);
  });

  it("classifies every real label without throwing", () => {
    for (const l of labels as string[]) expect(() => classify(l, "text")).not.toThrow();
  });
});
