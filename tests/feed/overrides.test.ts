import { describe, it, expect } from "vitest";
import { withTempDb, seedJob, U } from "../gamify/temp-db";
import { eligibilityOverrideIds, hasEligibilityOverride, setEligibilityOverride } from "@/lib/feed/overrides";

withTempDb();

describe("eligibility overrides (audit 10#3 'This is wrong')", () => {
  it("stores, lists and clears a per-job override; repeating is harmless", () => {
    const a = seedJob(), b = seedJob();
    expect(hasEligibilityOverride(U, a)).toBe(false);
    setEligibilityOverride(U, a, true);
    setEligibilityOverride(U, a, true);
    expect(hasEligibilityOverride(U, a)).toBe(true);
    expect([...eligibilityOverrideIds(U)]).toEqual([a]);
    expect(hasEligibilityOverride(U, b)).toBe(false);
    setEligibilityOverride(U, a, false);
    expect(eligibilityOverrideIds(U).size).toBe(0);
  });
  it("is per user", () => {
    const a = seedJob();
    setEligibilityOverride(U, a, true);
    expect(hasEligibilityOverride("someone-else", a)).toBe(false);
  });
});
