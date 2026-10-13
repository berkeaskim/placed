import { describe, it, expect } from "vitest";
import { isUuid, toSaveResult } from "@/lib/feed/save-result";

const award = { xpGained: 5, newXp: 5, level: 1, levelName: "Explorer", levelUp: false, streakDays: 1, newBadges: [] };
describe("toSaveResult", () => {
  it("failed upsert is ok=false with an error", () => {
    const r = toSaveResult(true, null);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/try again/);
  });
  it("saved with an award", () => expect(toSaveResult(false, award)).toEqual({ ok: true, award }));
  it("duplicate / capped save (no award) is still ok", () => expect(toSaveResult(false, null)).toEqual({ ok: true, award: null }));
});
describe("isUuid", () => {
  it("accepts uuids only", () => {
    expect(isUuid("3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b")).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
