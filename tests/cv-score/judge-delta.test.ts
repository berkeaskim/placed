import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CvRule } from "@/lib/cv-rules/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";

vi.mock("@/lib/ai/provider", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/provider")>();
  return { ...actual, generateStructured: vi.fn() };
});

import { generateStructured } from "@/lib/ai/provider";
import { judgeCvRules } from "@/lib/ai/judgeCvRules";

// Audit 04#9: reused verdicts are not sent to the judge again.

const llm = (id: string, over: Partial<CvRule> = {}): CvRule => ({
  id, sectors: "all", dimension: "impact", statement: `Statement ${id}.`, check: "llm", severity: "major", evidence: "B", citations: [],
  llmGuidance: `Question ${id}?`, passExample: "p", failExample: "f", ...over,
}) as CvRule;
const text = "EXPERIENCE\nTreasurer, Finance Society\nManaged a £2,000 budget for 12 events";
const structured = "CV\nSUMMARY\n(none)\nEDUCATION\n- U | BSc\nEXPERIENCE\n- Treasurer | Finance Society\nPROJECTS\n(none)\nSKILLS\n(none)";
const ctx = { year: "2nd" as const, sector: "consulting" as const, track: "standard" as const, jdPresent: false };
const kept: ScoredRuleResult = { ruleId: "L1", status: "pass", evidenceLine: "Treasurer, Finance Society", fix: null };
const sent = () => vi.mocked(generateStructured).mock.calls.map((c) => { const p = c[0].parts[0]; return p.type === "text" ? p.text : ""; }).join("\n");

describe("judgeCvRules with reused verdicts (live, mocked provider)", () => {
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

  it("sends only the rules that need re-judging and returns reused verdicts unchanged, in rule order", async () => {
    vi.mocked(generateStructured).mockResolvedValue({ verdicts: [{ rule_id: "L2", status: "pass", evidence_line: "Managed a £2,000 budget for 12 events", fix: null }], spelling_errors: [] });
    const out = await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1"), llm("L2")], context: ctx, reuse: [kept] });
    expect(sent()).toContain("[L2]");
    expect(sent()).not.toContain("[L1]");
    expect(out.results.map((r) => r.ruleId)).toEqual(["L1", "L2"]);
    expect(out.results[0]).toEqual(kept);
    expect(out.reused).toBe(1);
    expect(out.cacheable).toBe(true);
  });

  it("makes no call when every rule is reused, and keeps only earlier misspellings still in the text", async () => {
    const out = await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1")], context: ctx, reuse: [kept], reuseSpelling: ["Manged", "Treasurer"] });
    expect(generateStructured).not.toHaveBeenCalled();
    expect(out.results).toEqual([kept]);
    // "Manged" was fixed, so it's gone; the word still present stays for the spelling checker to confirm.
    expect(out.spellingErrors).toEqual(["Treasurer"]);
    expect(out.cacheable).toBe(true);
  });

  it("never reuses a could_not_assess verdict, and context presets win over reuse", async () => {
    vi.mocked(generateStructured).mockResolvedValue({ verdicts: [], spelling_errors: [] });
    const out = await judgeCvRules({
      redactedText: text, structuredText: structured, rules: [llm("L1"), llm("JD", { needs: ["jd"] })], context: ctx,
      reuse: [{ ...kept, status: "could_not_assess" }, { ruleId: "JD", status: "pass", evidenceLine: "Treasurer, Finance Society", fix: null }],
    });
    expect(sent()).toContain("[L1]");
    expect(out.results.find((r) => r.ruleId === "JD")).toMatchObject({ status: "not_applicable", detail: "needs: jd" });
  });

  it("if the AI fails, reused verdicts survive and only the re-judged rules are could_not_assess", async () => {
    const { AiError } = await import("@/lib/ai/provider");
    vi.mocked(generateStructured).mockRejectedValue(new AiError("down"));
    const out = await judgeCvRules({ redactedText: text, structuredText: structured, rules: [llm("L1"), llm("L2")], context: ctx, reuse: [kept] });
    expect(out.results[0]).toEqual(kept);
    expect(out.results[1].status).toBe("could_not_assess");
    expect(out.aiUnavailable).toBe(true);
    expect(out.cacheable).toBe(false);
  });
});
