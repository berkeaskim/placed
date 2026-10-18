/** Employer AI policy (audit 2026-10-18: 02 #1, 05 #13, 09 #1). Advert phrasings are the 09 audit's tested strings. */
import { describe, it, expect } from "vitest";
import { EMPLOYER_AI_POLICIES, aiPolicyLine, detectJdAiPolicy, employerAiPolicy, findEmployerPolicy, needsAiPolicyAck } from "@/lib/employer-policy";

describe("curated table", () => {
  it("every entry has a quote, an https source and an access date", () => {
    for (const e of EMPLOYER_AI_POLICIES) {
      expect(e.quote.length, e.employer).toBeGreaterThan(20);
      expect(e.url, e.employer).toMatch(/^https:\/\//);
      expect(e.accessed, e.employer).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.policy).not.toBe("not_permitted"); // a full ban only ever comes from an advert's own words
    }
  });
  it.each([["Bain & Company", "grammar_only"], ["Bain", "grammar_only"], ["Anthropic", "draft_yourself_first"], ["BCG", "allowed"],
    ["Boston Consulting Group", "allowed"], ["McKinsey & Company", "banned_in_assessments"], ["Goldman Sachs International", "banned_in_assessments"]])("%s → %s", (c, p) =>
    expect(findEmployerPolicy(c)?.policy).toBe(p));
  it("does not match unrelated names", () => {
    for (const c of ["Bainbridge Capital", "GSA Capital", "Anthropos Ltd", "JPMorgan Chase & Co.", "Tesco"]) expect(findEmployerPolicy(c), c).toBeNull();
  });
});

describe("advert detector", () => {
  it.each([
    "Candidates must not use generative AI tools to complete this application.",
    "Use of AI tools is not permitted.",
    "AI tools are not permitted at any stage of this application.",
    "Please do not use ChatGPT or other AI assistants to write your answers.",
    "We ask that you not use AI assistants during the application process.",
    "Applications must be completed without the use of AI.",
    "AI-generated applications will not be considered.",
  ])("reads a full ban: %s", (t) => expect(detectJdAiPolicy(t)?.policy).toBe("not_permitted"));
  it.each(["You may use AI for spelling and grammar only.", "Please only use AI to check grammar and spelling in your CV."])("reads grammar-only: %s", (t) =>
    expect(detectJdAiPolicy(t)?.policy).toBe("grammar_only"));
  it("reads draft-yourself-first (Anthropic's wording)", () =>
    expect(detectJdAiPolicy("Please create your first draft yourself, then use Claude to refine it.")?.policy).toBe("draft_yourself_first"));
  it("reads an assessment-only ban as that, not a full ban", () =>
    expect(detectJdAiPolicy("For the online assessment or virtual interviews, use of AI is not permitted.")?.policy).toBe("banned_in_assessments"));
  it.each(["We build AI tools for banks.", "Experience with generative AI is a plus.", "You will use AI to automate reporting.", "Our AI team is not permitted to share data externally without approval."])(
    "ignores adverts that only mention AI: %s", (t) => expect(detectJdAiPolicy(t)?.policy ?? null).not.toBe("not_permitted"));
});

describe("employerAiPolicy", () => {
  it("Bain London: grammar-only tailoring and proofread-only letters, with a notice", () => {
    const r = employerAiPolicy({ company: "Bain & Company", jdText: "Associate Consultant, London" });
    expect(r).toMatchObject({ policy: "grammar_only", source: "curated", tailorMode: "grammar_only", letterMode: "proofread_only" });
    expect(r.notice).toMatch(/only to check spelling and grammar/);
    expect(needsAiPolicyAck(r)).toBe(true);
  });
  it("Anthropic: draft first", () => expect(employerAiPolicy({ company: "Anthropic", jdText: "" })).toMatchObject({ letterMode: "draft_first", tailorMode: "full" }));
  it("the stricter source wins (advert ban over a curated 'allowed')", () => {
    const r = employerAiPolicy({ company: "BCG", jdText: "Use of AI tools is not permitted." });
    expect(r).toMatchObject({ policy: "not_permitted", source: "advert", tailorMode: "none", letterMode: "feedback_only" });
  });
  it("unknown employer with a silent advert: no policy, no notice", () => {
    const r = employerAiPolicy({ company: "Acme Analytics", jdText: "Excel and SQL." });
    expect(r).toMatchObject({ policy: null, notice: null, tailorMode: "full", letterMode: "full" });
    expect(needsAiPolicyAck(r)).toBe(false);
  });
  it("aiPolicyLine gives one line or null", () => {
    expect(aiPolicyLine("Bain & Company")).toMatch(/spelling and grammar/);
    expect(aiPolicyLine("Acme Analytics")).toBeNull();
  });
});
