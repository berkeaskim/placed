import { describe, it, expect, vi } from "vitest";

// judgeGold wiring only: the judge and the AI mode are mocked, so no live AI is ever called.
vi.mock("@/lib/ai/judgeCvRules", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/judgeCvRules")>();
  return {
    ...actual,
    judgeCvRules: vi.fn(async (i: { rules: { id: string; check: string }[] }) => ({
      results: i.rules.filter((r) => r.check === "llm").map((r) => ({ ruleId: r.id, status: "pass", evidenceLine: null, fix: null })),
      spellingErrors: [], modelId: "test:judge", cacheable: true,
    })),
  };
});
const mode = vi.hoisted(() => ({ value: "live" }));
vi.mock("@/lib/ai/config", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/config")>()), aiMode: () => mode.value }));

import { judgeCvRules } from "@/lib/ai/judgeCvRules";
import { loadGold } from "@/lib/cv-score/gold";
import { judgeGold } from "@/lib/cv-score/validate-live";

const gold = loadGold("docs/validation/gold/synthetic-example.json");

describe("judgeGold (--live wiring)", () => {
  it("judges every gold CV once, redacted, with the CV's own target context", async () => {
    const out = await judgeGold(gold);
    expect(out.size).toBe(gold.cvs.length);
    expect(judgeCvRules).toHaveBeenCalledTimes(gold.cvs.length);
    const first = vi.mocked(judgeCvRules).mock.calls[0][0];
    expect(first.context).toEqual({ year: "2nd", sector: "finance_banking", track: "standard", jdPresent: false });
    expect(first.redactedText).not.toContain("alex.taylor@example.com");
    expect(out.get("syn-01")!.get("G-18")).toBe("pass");
  });
  it("refuses to run without a live provider", async () => {
    mode.value = "fixture";
    await expect(judgeGold(gold)).rejects.toThrow(/--live needs a live AI provider/);
    mode.value = "live";
  });
});
