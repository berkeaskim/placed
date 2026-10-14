import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoCredentials, demoPreflight, findUserByEmail, isAlreadyRegistered, isMissingObject } from "@/lib/demo/admin";
import { reliabilityStats } from "@/lib/cv-score/reliability";

describe("demoCredentials", () => {
  it("returns the pair when both are set", () => {
    expect(demoCredentials({ DEMO_EMAIL: " demo@placed.test ", DEMO_PASSWORD: "correct-horse-battery" })).toEqual({ email: "demo@placed.test", password: "correct-horse-battery" });
  });
  it("fails clearly (and never echoes the password) when missing or weak", () => {
    expect(() => demoCredentials({})).toThrow(/DEMO_EMAIL is empty; DEMO_PASSWORD is empty/);
    expect(() => demoCredentials({ DEMO_EMAIL: "nope", DEMO_PASSWORD: "x".repeat(20) })).toThrow(/not an email/);
    let msg = "";
    try { demoCredentials({ DEMO_EMAIL: "a@b.co", DEMO_PASSWORD: "short-pw" }); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/at least 12/);
    expect(msg).not.toContain("short-pw");
  });
});

it("isAlreadyRegistered matches Supabase's duplicate-user messages", () => {
  expect(isAlreadyRegistered("A user with this email address has already been registered")).toBe(true);
  expect(isAlreadyRegistered("User already registered")).toBe(true);
  expect(isAlreadyRegistered("Database error creating new user")).toBe(false);
});

it("isMissingObject recognises missing table/column/function codes only", () => {
  for (const code of ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]) expect(isMissingObject({ code, message: "" })).toBe(true);
  expect(isMissingObject({ code: "P0001", message: "activate_cv: cv not found" })).toBe(false);
  expect(isMissingObject(null)).toBe(false);
});

function fakeDb(o: { missing?: Set<string>; jobs?: unknown[]; users?: { id: string; email: string }[][] }) {
  const result = (name: string, data: unknown = []) =>
    o.missing?.has(name) ? { data: null, error: { code: name === "activate_cv" ? "PGRST202" : "42P01", message: `${name} missing` } } : { data, error: null };
  const from = (t: string) => {
    const b = { select: () => b, limit: () => b, eq: () => b, then: (r: (v: unknown) => void) => r(result(t, t === "jobs" ? o.jobs ?? [{ id: "j" }] : [])) };
    return b;
  };
  let page = 0;
  return {
    from,
    rpc: async () => (o.missing?.has("activate_cv") ? result("activate_cv") : { data: null, error: { code: "P0001", message: "activate_cv: cv not found" } }),
    auth: { admin: { listUsers: async () => ({ data: { users: o.users?.[page++] ?? [] }, error: null }) } },
  } as unknown as SupabaseClient;
}

describe("demoPreflight", () => {
  it("is empty when the migrations and the demo job are there (activate_cv's own 'not found' is fine)", async () => {
    expect(await demoPreflight(fakeDb({}))).toEqual([]);
  });
  it("names the migration to run for each missing object, and the missing demo job", async () => {
    const p = await demoPreflight(fakeDb({ missing: new Set(["cv_feedback", "activate_cv"]), jobs: [] }));
    expect(p).toEqual([
      "table cv_feedback is missing: run supabase/migrations/0007_cv_score_cache.sql",
      "function activate_cv is missing: run supabase/migrations/0009_active_cv.sql",
      expect.stringMatching(/demo job .* npm run seed/),
    ]);
  });
});

it("findUserByEmail pages through users case-insensitively", async () => {
  const users = [Array.from({ length: 200 }, (_, i) => ({ id: `u${i}`, email: `x${i}@a.co` })), [{ id: "demo", email: "Demo@Placed.test" }]];
  expect(await findUserByEmail(fakeDb({ users }), "demo@placed.test")).toEqual({ id: "demo", email: "Demo@Placed.test" });
  expect(await findUserByEmail(fakeDb({ users: [[{ id: "a", email: "a@a.co" }]] }), "demo@placed.test")).toBeNull();
});

describe("reliabilityStats (T17 gate: SD ≤ 2, flips ≤ 10%)", () => {
  const v = (s: string) => new Map([["GEN-03", s], ["DAT-05", "fail"]]);
  it("passes identical runs", () => {
    const r = reliabilityStats([80, 80, 80, 80, 80], Array(5).fill(v("fail")));
    expect(r).toMatchObject({ mean: 80, sd: 0, flips: [], pass: true });
  });
  it("flags a rule that flips in 1 of 5 runs (20%) and an SD above 2", () => {
    const r = reliabilityStats([70, 80, 80, 80, 90], [v("pass"), v("fail"), v("fail"), v("fail"), v("fail")]);
    expect(r.flips).toEqual([{ ruleId: "GEN-03", rate: expect.closeTo(0.2, 5), counts: { pass: 1, fail: 4 } }]);
    expect(r.sd).toBeCloseTo(6.32, 1);
    expect(r.pass).toBe(false);
  });
});
