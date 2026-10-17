import { describe, it, expect } from "vitest";
import { aiPolicyBlocks, chooseMode, isMotivationLabel, noLetterWanted } from "@/lib/cover-letter/mode";

describe("chooseMode", () => {
  it("gives an upload a full letter", () => {
    expect(chooseMode({ target: { kind: "upload" }, fieldType: "file", jdText: "" })).toMatchObject({ mode: "full_letter", limit: null });
  });
  it("uses the form's word limit for a field", () => {
    expect(chooseMode({ target: { kind: "field", fieldKey: "q1", label: "Why us?" }, fieldType: "textarea", wordLimit: 250, jdText: "" }))
      .toMatchObject({ mode: "field_answer", limit: { unit: "words", max: 250 } });
  });
  it("uses a character limit when only that is given", () => {
    expect(chooseMode({ target: { kind: "field", fieldKey: "q1", label: "Why us?" }, fieldType: "textarea", charLimit: 1500, jdText: "" }).limit)
      .toEqual({ unit: "chars", max: 1500 });
  });
  it("defaults a field to 300 words", () => {
    expect(chooseMode({ target: { kind: "field", fieldKey: "q1", label: "Why us?" }, fieldType: "textarea", jdText: "" }).limit).toEqual({ unit: "words", max: 300 });
  });
  it("skips a field target too when the posting wants no letter", () => {
    expect(chooseMode({ target: { kind: "field", fieldKey: "q1", label: "Why us?" }, fieldType: "textarea", jdText: "Do not send a cover letter." }).mode).toBe("skip");
  });
  it("skips when the posting wants no letter", () => {
    expect(chooseMode({ target: { kind: "upload" }, fieldType: "file", jdText: "Please note: no cover letter is required." }).mode).toBe("skip");
  });
});

describe("posting checks", () => {
  it("detects an AI policy", () => {
    expect(aiPolicyBlocks("Please don't use AI assistants when applying")).toBe(true);
    expect(aiPolicyBlocks("We use AI to build products")).toBe(false);
  });
  it("detects a no-letter notice", () => {
    expect(noLetterWanted("Cover letters are not required")).toBe(true);
    expect(noLetterWanted("Please attach a cover letter")).toBe(false);
  });
  it("matches motivation labels but not additional information", () => {
    expect(isMotivationLabel("Why are you interested in this role?")).toBe(true);
    expect(isMotivationLabel("Motivation")).toBe(true);
    expect(isMotivationLabel("What is your motivation for applying?")).toBe(true);
    expect(isMotivationLabel("Why us?")).toBe(true);
    expect(isMotivationLabel("Describe a time you motivated a team")).toBe(false);
    expect(isMotivationLabel("Additional information")).toBe(false);
    expect(isMotivationLabel("Anything else we should know?")).toBe(false);
  });
});
