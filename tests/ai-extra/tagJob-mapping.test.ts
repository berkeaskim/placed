import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TagJobOutputT } from "@/lib/ai/schemas";

const gen = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/ai/provider", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/ai/provider")>();
  return { ...orig, generateStructured: (...a: unknown[]) => gen.fn(...a) };
});

import { tagJob } from "@/lib/ai/tagJob";
import { AiError, AI_REFUSAL } from "@/lib/ai/provider";

const base: TagJobOutputT = {
  archetype: "software_eng", field_tags: [], year_eligibility: ["penultimate"], sponsors_visa: "unknown",
  employment_type: "internship", first_year_friendly: false, deadline: "2026-11-30", summary: "s", requirements: [],
};
const input = { title: "Software Engineering Intern", textLines: ["Requirements", "- Python and SQL", "Applications close 30 November 2026."] };
const saved = { AI_MODE: process.env.AI_MODE, GEMINI_API_KEY: process.env.GEMINI_API_KEY };

beforeEach(() => {
  delete process.env.AI_MODE;
  process.env.GEMINI_API_KEY = "fake-for-unit-test"; // aiMode() === "live"; generateStructured is mocked
  gen.fn.mockReset();
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("tagJob live-output mapping (mocked provider)", () => {
  it("passes the JD wrapped as untrusted data on the fast tier", async () => {
    gen.fn.mockResolvedValue(base);
    await tagJob(input);
    const req = gen.fn.mock.calls[0][0] as { tier: string; parts: { text: string }[] };
    expect(req.tier).toBe("fast");
    expect(req.parts[0].text).toMatch(/^<job_posting>\nTitle: Software Engineering Intern\n/);
  });

  it.each([
    ["2027-02-30", null], ["2026-13-01", null], ["30/11/2026", null], ["2026-1-5", null], ["", null], [null, null], ["2026-11-30", "2026-11-30"], ["2028-02-29", "2028-02-29"],
  ])("deadline %j -> %j", async (deadline, expected) => {
    gen.fn.mockResolvedValue({ ...base, deadline });
    expect((await tagJob(input)).deadline).toBe(expected);
  });

  it("caps inferred critical/high to meaningful, leaves stated/structural alone", async () => {
    gen.fn.mockResolvedValue({
      ...base,
      requirements: [
        { text: "a", skills: ["python"], skill_logic: "all", importance: "critical", section: "must", evidence_tier: "inferred" },
        { text: "b", skills: ["sql"], skill_logic: "all", importance: "high", section: "must", evidence_tier: "inferred" },
        { text: "c", skills: [], skill_logic: "all", importance: "preferred", section: "nice", evidence_tier: "inferred" },
        { text: "d", skills: ["Excel"], skill_logic: "all", importance: "critical", section: "must", evidence_tier: "stated" },
        { text: "e", skills: ["Git"], skill_logic: "all", importance: "high", section: "must", evidence_tier: "structural" },
      ],
    });
    const job = await tagJob(input);
    expect(job.requirements.map((r) => r.importance)).toEqual(["meaningful", "meaningful", "preferred", "critical", "high"]);
    expect(job.requirements.map((r) => r.evidenceTier)).toEqual(["inferred", "inferred", "inferred", "stated", "structural"]);
  });

  it("canonicalises known skills, keeps unknown ones verbatim, and maps empty skill to null", async () => {
    gen.fn.mockResolvedValue({
      ...base,
      requirements: [
        { text: "a", skills: ["python"], skill_logic: "all", importance: "high", section: "must", evidence_tier: "stated" },
        { text: "b", skills: ["financial modeling"], skill_logic: "all", importance: "high", section: "must", evidence_tier: "stated" },
        { text: "c", skills: ["  JS "], skill_logic: "all", importance: "high", section: "must", evidence_tier: "stated" },
        { text: "d", skills: ["Underwater Basket Weaving"], skill_logic: "all", importance: "low_signal", section: "nice", evidence_tier: "stated" },
        { text: "e", skills: [""], skill_logic: "all", importance: "low_signal", section: "nice", evidence_tier: "stated" },
      ],
    });
    const job = await tagJob(input);
    expect(job.requirements.map((r) => r.skill)).toEqual(["Python", "Financial Modelling", "JavaScript", "Underwater Basket Weaving", null]);
  });

  it("keeps every skill of a multi-skill requirement (\"Excel and financial modelling\")", async () => {
    gen.fn.mockResolvedValue({
      ...base,
      requirements: [
        { text: "Strong Excel and financial modelling skills", skills: ["excel", "financial modeling"], skill_logic: "all", importance: "high", section: "must", evidence_tier: "stated" },
      ],
    });
    const job = await tagJob(input);
    expect(job.requirements.map((r) => r.skill)).toEqual(["Excel", "Financial Modelling"]);
    expect(job.requirements.every((r) => r.anyOf === undefined && r.text.startsWith("Strong Excel"))).toBe(true);
  });

  it("alternatives (\"Python or C++\") share one anyOf group; duplicates collapse", async () => {
    gen.fn.mockResolvedValue({
      ...base,
      requirements: [
        { text: "Python or C++ is required", skills: ["python", "C++", "Python"], skill_logic: "any", importance: "critical", section: "must", evidence_tier: "stated" },
        { text: "Java", skills: ["Java"], skill_logic: "any", importance: "high", section: "must", evidence_tier: "stated" },
      ],
    });
    const job = await tagJob(input);
    expect(job.requirements.map((r) => [r.skill, r.anyOf])).toEqual([
      ["Python", ["Python", "C++"]], ["C++", ["Python", "C++"]], ["Java", undefined],
    ]);
  });

  it("maps snake_case output to the camelCase TaggedJob with status ok", async () => {
    gen.fn.mockResolvedValue({ ...base, field_tags: ["fintech"], sponsors_visa: "yes", first_year_friendly: true });
    expect(await tagJob(input)).toMatchObject({ fieldTags: ["fintech"], sponsorsVisa: "yes", firstYearFriendly: true, yearEligibility: ["penultimate"], status: "ok" });
  });

  it("provider error -> heuristic fallback with status failed (never throws)", async () => {
    gen.fn.mockRejectedValue(new AiError(AI_REFUSAL));
    const job = await tagJob(input);
    expect(job.status).toBe("failed");
    expect(job.archetype).toBe("software_eng");
    expect(job.deadline).toBe("2026-11-30");
  });
});
