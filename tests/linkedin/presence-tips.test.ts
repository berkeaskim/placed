import { describe, expect, it } from "vitest";
import { LI_RULES, presenceTip, presenceTipFor } from "@/lib/linkedin-rules";

describe("presence tips", () => {
  const advisory = LI_RULES.filter((r) => r.advisory);

  it("every advisory rule has a student-facing tip, not scorer wording", () => {
    expect(advisory.length).toBeGreaterThan(0);
    for (const r of advisory) {
      expect(r.tip, r.id).toBeTruthy();
      expect(presenceTip(r), r.id).not.toMatch(/weight 0|never scored|the student|user's own answers/i);
    }
  });

  it("re-words a tip saved with an older score", () => {
    expect(presenceTipFor("LI-GEN-24", "Advisory (weight 0): old wording")).toBe(LI_RULES.find((r) => r.id === "LI-GEN-24")!.tip);
    expect(presenceTipFor("LI-NOPE-1", "kept as saved")).toBe("kept as saved");
  });

  it("falls back to the statement without its advisory prefix", () => {
    expect(presenceTip({ statement: "Advisory risk check (weight 0, shown prominently): keep it clean." })).toBe("keep it clean.");
  });
});
