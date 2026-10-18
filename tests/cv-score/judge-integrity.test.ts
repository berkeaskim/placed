import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CvRule } from "@/lib/cv-rules/types";

vi.mock("@/lib/ai/provider", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/provider")>();
  return { ...actual, generateStructured: vi.fn() };
});

import { AiError, generateStructured } from "@/lib/ai/provider";
import { buildJudgePrompt, judgeCvRules, mapCvVerdicts } from "@/lib/ai/judgeCvRules";
import { SYSTEM_JUDGE } from "@/lib/ai/prompts";
import { RULES_BY_ID, rulesFor } from "@/lib/cv-rules";

// Audit 2026-10-18: 04#1, #4, #9, #18, #20, #21; 03#5, #23; 01#4, #11, #20.

const llm = (id: string, over: Partial<CvRule> = {}): CvRule => ({
  id, sectors: "all", dimension: "impact", statement: `Statement ${id}.`, check: "llm", severity: "major", evidence: "B", citations: [],
  llmGuidance: `Question ${id}?`, passExample: "p", failExample: "f", ...over,
}) as CvRule;
const text = "EXPERIENCE\nTreasurer, Finance Society\nManaged a £2,000 budget for 12 events";
const structured = "CV\nSUMMARY\n(none)\nEDUCATION\n- U | BSc\nEXPERIENCE\n- Treasurer | Finance Society\nPROJECTS\n(none)\nSKILLS\n(none)";
const v = (rule_id: string, status: string, evidence_line: string | null = null, fix: string | null = null) => ({ rule_id, status, evidence_line, fix });
const ctx = { year: "2nd" as const, sector: "consulting" as const, track: "standard" as const, jdPresent: false };

describe("mapCvVerdicts: dodges become could_not_assess (04#1)", () => {
  const rules = [llm("L1"), llm("L2", { naAllowed: true }), llm("L3"), llm("L4")];
  const out = mapCvVerdicts({ verdicts: [v("L1", "not_applicable"), v("L2", "not_applicable"), v("L3", "maybe")], spelling_errors: [] }, rules, text, structured);
  const by = Object.fromEntries(out.map((r) => [r.ruleId, r.status]));
  it("not_applicable is kept only where the rule allows it", () => {
    expect(by.L1).toBe("could_not_assess");
    expect(by.L2).toBe("not_applicable");
  });
  it("an unknown status and a missing verdict are could_not_assess, not not_applicable", () => {
    expect(by.L3).toBe("could_not_assess");
    expect(by.L4).toBe("could_not_assess");
  });
});

describe("mapCvVerdicts: a fail needs a quote or an 'absent' justification (04#21)", () => {
  const rules = [llm("L1"), llm("L2"), llm("L3"), llm("L4")];
  const out = mapCvVerdicts({
    verdicts: [
      v("L1", "fail", "ABSENT: PROJECTS, EXPERIENCE", "Add a project"),
      v("L2", "fail", null, "Add a project"),
      v("L3", "fail", "ABSENT: HOBBIES", "x"),
      v("L4", "fail", "Treasurer, Finance Society", "Say what changed"),
    ],
    spelling_errors: [],
  }, rules, text, structured);
  const by = Object.fromEntries(out.map((r) => [r.ruleId, r]));
  it("an absence fail naming real sections stands, with no quote", () => {
    expect(by.L1).toMatchObject({ status: "fail", evidenceLine: null, detail: "absent: PROJECTS, EXPERIENCE" });
  });
  it("a fail with no quote and no justification is could_not_assess", () => {
    expect(by.L2.status).toBe("could_not_assess");
  });
  it("an absence claim about a section that doesn't exist is could_not_assess", () => {
    expect(by.L3.status).toBe("could_not_assess");
  });
  it("a quoted fail stands", () => {
    expect(by.L4).toMatchObject({ status: "fail", evidenceLine: "Treasurer, Finance Society" });
  });
});

describe("buildJudgePrompt sends context and the resolved statement (03#5, 03#23, 04#20)", () => {
  const rule = RULES_BY_ID.get("G-25")!; // code rule: never sent
  const p = buildJudgePrompt({ redactedText: text, structuredText: structured, rules: [llm("L1"), rule], context: { ...ctx, sector: "finance_banking", year: "1st" } });
  it("includes year, sector, track and whether a job advert is present", () => {
    expect(p).toMatch(/<target>[\s\S]*Year of study: 1st[\s\S]*Target sector: Finance[\s\S]*Track: standard[\s\S]*Job advert: not provided[\s\S]*<\/target>/i);
  });
  it("sends each rule's statement as well as its question", () => {
    expect(p).toContain("Statement L1.");
    expect(p).toContain("Question L1?");
    expect(p).not.toContain("[G-25]");
  });
  it("uses the sector's statement for a merged rule", () => {
    const g11 = RULES_BY_ID.get("G-32")!;
    const fin = buildJudgePrompt({ redactedText: text, structuredText: structured, rules: [{ ...g11, check: "llm", llmGuidance: "Q?", passExample: "p", failExample: "f" } as CvRule], context: { ...ctx, sector: "finance_banking" } });
    expect(fin).toContain("additional-information box");
  });
  it("the system prompt explains the context block and the ABSENT convention", () => {
    expect(SYSTEM_JUDGE).toMatch(/<target>/);
    expect(SYSTEM_JUDGE).toMatch(/ABSENT:/);
    expect(SYSTEM_JUDGE).toMatch(/\[LEVEL\]/);
  });
});

describe("rules the judge can't observe are not scored by it (04#14, #18, 01#4, #11)", () => {
  it("G-37, G-03, G-09, G-10, G-28, G-35 and GEN-11 are gone", () => {
    for (const id of ["G-37", "G-03", "G-09", "G-10", "G-28", "G-35", "GEN-11"]) expect(RULES_BY_ID.has(id), id).toBe(false);
  });
  it("no llm rule asks to always answer one way", () => {
    for (const r of RULES_BY_ID.values()) if (r.check === "llm") expect(r.llmGuidance, r.id).not.toMatch(/always answer/i);
  });
  it("no llm rule judges 'against the sector profile' without a job advert (01#20)", () => {
    for (const r of RULES_BY_ID.values()) if (r.check === "llm") expect(r.llmGuidance, r.id).not.toMatch(/sector profile/i);
  });
  it("G-30 needs a job advert", () => {
    expect(RULES_BY_ID.get("G-30")?.needs).toEqual(["jd"]);
  });
});

describe("judgeCvRules (live, mocked provider)", () => {
  const saved = { AI_MODE: process.env.AI_MODE, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
  beforeEach(() => {
    vi.mocked(generateStructured).mockReset();
    delete process.env.AI_MODE;
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  });
  afterEach(() => {
    for (const [k, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[k];
      else process.env[k] = val;
    }
  });

  it("rules that need a job advert are not applicable and never sent when there is none", async () => {
    vi.mocked(generateStructured).mockResolvedValue({ verdicts: [], spelling_errors: [] });
    const out = await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1"), llm("JD", { needs: ["jd"] })], context: ctx });
    expect(out.results.find((r) => r.ruleId === "JD")).toMatchObject({ status: "not_applicable", detail: "needs: jd" });
    const prompt = vi.mocked(generateStructured).mock.calls[0][0].parts[0];
    expect(prompt.type === "text" && prompt.text).not.toContain("[JD]");
  });

  it("asks for temperature 0 (providers drop it where unsupported) (04#9)", async () => {
    vi.mocked(generateStructured).mockResolvedValue({ verdicts: [], spelling_errors: [] });
    await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1")], context: ctx });
    expect(vi.mocked(generateStructured).mock.calls[0][0].temperature).toBe(0);
  });

  it("a failed first batch leaves spelling unknown instead of passing it (04#4)", async () => {
    const rules = Array.from({ length: 24 }, (_, i) => llm(`L${i}`));
    vi.mocked(generateStructured)
      .mockRejectedValueOnce(new AiError("batch 0 timed out"))
      .mockResolvedValueOnce({ verdicts: [], spelling_errors: ["Managd"] });
    const out = await judgeCvRules({ redactedText: `${text}\nManagd`, structuredText: structured, rules, context: ctx });
    expect(out.spellingErrors).toEqual(["Managd"]);
    expect(out.aiUnavailable).toBe(true);
    // Rules from the failed batch are could_not_assess, not not_applicable.
    expect(out.results.filter((r) => r.status === "could_not_assess").length).toBeGreaterThanOrEqual(12);
  });

  it("a total AI failure marks every llm rule could_not_assess", async () => {
    vi.mocked(generateStructured).mockRejectedValue(new AiError("down"));
    const out = await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1"), llm("L2")], context: ctx });
    expect(out.results.map((r) => r.status)).toEqual(["could_not_assess", "could_not_assess"]);
    expect(out.aiUnavailable).toBe(true);
    expect(out.spellingErrors).toBeNull();
  });

  it("rules skipped for the year are never sent", async () => {
    vi.mocked(generateStructured).mockResolvedValue({ verdicts: [], spelling_errors: [] });
    await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1"), llm("SK", { yearAdjust: { "1st": { skip: true } } })], context: { ...ctx, year: "1st" } });
    const prompt = vi.mocked(generateStructured).mock.calls[0][0].parts[0];
    expect(prompt.type === "text" && prompt.text).not.toContain("[SK]");
  });
});

it("every sector still sends a reasonable set of rules to the judge", () => {
  for (const s of ["software_eng", "finance_banking", "consulting", "quant_trading"] as const) {
    expect(rulesFor(s).filter((r) => r.check === "llm" && !r.needs).length, s).toBeGreaterThan(10);
  }
});
