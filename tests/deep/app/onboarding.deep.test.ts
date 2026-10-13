import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingInput, FIELDS } from "@/lib/validation/onboarding";
import { YEARS } from "@/lib/types";

const s = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  eqs: [] as [string, unknown][],
  updateError: null as null | { message: string },
  award: null as null | ((...a: unknown[]) => Promise<unknown>),
  requireUserCalls: 0,
}));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: async () => {
    s.requireUserCalls++;
    const supabase = {
      from: () => ({
        update: (p: Record<string, unknown>) => {
          s.updates.push(p);
          return { eq: async (c: string, v: unknown) => { s.eqs.push([c, v]); return { error: s.updateError }; } };
        },
      }),
    };
    return { supabase, user: { id: "u1" } };
  },
}));
vi.mock("@/lib/gamify/award", () => ({ awardXP: (...a: unknown[]) => s.award!(...a) }));

import { saveOnboarding } from "@/app/onboarding/actions";

const valid = { year: "2nd", field: "Economics", locationPref: ["london"], needsVisa: false } as const;
const ok = (x: unknown) => OnboardingInput.safeParse(x).success;

beforeEach(() => {
  s.updates = []; s.eqs = []; s.updateError = null; s.requireUserCalls = 0;
  s.award = vi.fn(async () => ({ xpGained: 50 }));
});

describe("OnboardingInput — boundaries", () => {
  it("accepts every allowed year and field", () => {
    for (const year of YEARS) expect(ok({ ...valid, year })).toBe(true);
    for (const field of FIELDS) expect(ok({ ...valid, field })).toBe(true);
  });
  it("locationPref: 1..4 items, enum-only", () => {
    expect(ok({ ...valid, locationPref: [] })).toBe(false);
    expect(ok({ ...valid, locationPref: ["london", "uk", "europe", "remote"] })).toBe(true);
    expect(ok({ ...valid, locationPref: ["london", "uk", "europe", "remote", "london"] })).toBe(false);
    expect(ok({ ...valid, locationPref: ["London"] })).toBe(false); // case-sensitive
    expect(ok({ ...valid, locationPref: ["mars"] })).toBe(false);
    expect(ok({ ...valid, locationPref: "london" })).toBe(false);
    expect(ok({ ...valid, locationPref: [null] })).toBe(false);
  });
  it("needsVisa must be a real boolean", () => {
    for (const v of ["true", "false", 1, 0, null, undefined, "on"]) expect(ok({ ...valid, needsVisa: v })).toBe(false);
  });
  it("rejects case/whitespace variants of enums", () => {
    expect(ok({ ...valid, year: "2ND" })).toBe(false);
    expect(ok({ ...valid, year: " 2nd" })).toBe(false);
    expect(ok({ ...valid, field: "economics" })).toBe(false);
    expect(ok({ ...valid, field: "Economics " })).toBe(false);
  });
  it("rejects non-object inputs", () => {
    for (const v of [null, undefined, "x", 42, [], [valid]]) expect(ok(v)).toBe(false);
  });
  it("XSS / injection strings never validate (enums only)", () => {
    const payloads = ["<script>alert(1)</script>", "\"><img src=x onerror=alert(1)>", "'; drop table profiles; --", "javascript:alert(1)", "Economics\u0000", "Economics<svg/onload=alert(1)>"];
    for (const p of payloads) {
      expect(ok({ ...valid, field: p })).toBe(false);
      expect(ok({ ...valid, year: p })).toBe(false);
      expect(ok({ ...valid, locationPref: [p] })).toBe(false);
    }
  });
  it("strips unexpected fields (mass-assignment) from the parsed output", () => {
    const r = OnboardingInput.safeParse({ ...valid, xp: 99999, level: 99, user_id: "victim", onboarded: false, __proto__: { admin: true }, constructor: "x" });
    expect(r.success).toBe(true);
    expect(Object.keys(r.data!).sort()).toEqual(["field", "locationPref", "needsVisa", "year"]);
    expect((r.data as Record<string, unknown>).admin).toBeUndefined();
  });
  it("JSON-borne __proto__ keys don't pollute Object.prototype", () => {
    const evil = JSON.parse(`{"year":"2nd","field":"Economics","locationPref":["uk"],"needsVisa":true,"__proto__":{"polluted":"yes"}}`);
    OnboardingInput.safeParse(evil);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("saveOnboarding action", () => {
  it("invalid input → error without auth lookup or DB write", async () => {
    expect(await saveOnboarding({ ...valid, field: "<script>" } as never)).toEqual({ error: "Please answer every step." });
    expect(s.requireUserCalls).toBe(0);
    expect(s.updates).toEqual([]);
  });
  it("writes only whitelisted columns, scoped to the session user, and dedupes locations", async () => {
    const r = await saveOnboarding({ ...valid, locationPref: ["uk", "uk", "remote"], xp: 1e9, user_id: "victim", level: 99 } as never);
    expect(r).toEqual({ award: { xpGained: 50 } });
    expect(s.updates).toEqual([{ year: "2nd", field: "Economics", location_pref: ["uk", "remote"], needs_visa: false, onboarded: true }]);
    expect(s.eqs).toEqual([["user_id", "u1"]]);
  });
  it("awards onboarding_complete for the session user", async () => {
    await saveOnboarding(valid as never);
    expect(s.award).toHaveBeenCalledWith(expect.anything(), "u1", { type: "onboarding_complete" });
  });
  it("profile save failure → friendly error and no award", async () => {
    s.updateError = { message: "rls" };
    expect(await saveOnboarding(valid as never)).toEqual({ error: "Couldn't save — try again." });
    expect(s.award).not.toHaveBeenCalled();
  });
  it("an XP failure never blocks onboarding", async () => {
    s.award = vi.fn(async () => { throw new Error("db down"); });
    expect(await saveOnboarding(valid as never)).toEqual({ award: null });
  });
});
