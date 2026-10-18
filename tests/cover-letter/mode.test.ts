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
  // 09 #1: the old regex missed every one of these
  it.each(["Candidates must not use generative AI tools.", "Use of AI tools is not permitted.", "AI tools are not permitted.",
    "We ask that you not use AI assistants during the application process."])("detects a ban: %s", (t) => expect(aiPolicyBlocks(t)).toBe(true));
  it("does not read a spelling-only or assessment-only policy as a full ban", () => {
    expect(aiPolicyBlocks("You may use AI for spelling and grammar only.")).toBe(false);
    expect(aiPolicyBlocks("For the online assessment or virtual interviews, use of AI is not permitted.")).toBe(false);
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
    expect(isMotivationLabel("Describe your interest in the team")).toBe(true);
    expect(isMotivationLabel("Describe your interest in teamwork")).toBe(false);
  });
  // 09 #11: the standard UK prompts the old regex missed
  it.each(["Why are you applying to Goldman Sachs?", "What attracts you to this programme?", "Why have you chosen this business area?",
    "Tell us why you want to join Barclays", "Why Anthropic?", "What interests you about this role?",
    "Please explain your interest in this position (250 words)", "Why J.P. Morgan?", "Why our firm?"])("matches: %s", (l) => expect(isMotivationLabel(l)).toBe(true));
  it.each(["Why did you leave your last job?", "Describe a challenge you overcame", "Which office are you applying to? (dropdown)"])("does not match: %s", (l) => expect(isMotivationLabel(l)).toBe(false));
});
