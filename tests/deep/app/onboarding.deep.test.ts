import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { OnboardingInput, FIELDS } from "@/lib/validation/onboarding";
import { YEARS } from "@/lib/types";
import { db, resetDbForTests } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";

const s = vi.hoisted(() => ({ award: null as null | ((...a: unknown[]) => Promise<unknown>) }));
vi.mock("@/lib/gamify/award", () => ({ awardXP: (...a: unknown[]) => s.award!(...a) }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); } }));

import { saveOnboarding } from "@/app/onboarding/actions";
import Home from "@/app/page";

const valid = { year: "2nd", field: "Economics", locationPref: ["london"], needsVisa: false } as const;
const ok = (x: unknown) => OnboardingInput.safeParse(x).success;
const profile = () => db.select().from(profiles).where(eq(profiles.user_id, LOCAL_USER_ID)).get();

let dir: string;
const prevDir = process.env.PLACED_DATA_DIR;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-onb-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  db.delete(profiles).run();
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
  it("invalid input → error without a DB write", async () => {
    expect(await saveOnboarding({ ...valid, field: "<script>" } as never)).toEqual({ error: "Please answer every step." });
    expect(profile()).toBeUndefined();
  });
  it("writes only whitelisted columns for the local user, and dedupes locations", async () => {
    const r = await saveOnboarding({ ...valid, locationPref: ["uk", "uk", "remote"], xp: 1e9, user_id: "victim", level: 99 } as never);
    expect(r).toEqual({ award: { xpGained: 50 } });
    expect(profile()).toMatchObject({ year: "2nd", field: "Economics", location_pref: ["uk", "remote"], needs_visa: false, onboarded: true, xp: 0, level: 1 });
    expect(db.select().from(profiles).all()).toHaveLength(1);
  });
  it("awards onboarding_complete for the local user", async () => {
    await saveOnboarding(valid as never);
    expect(s.award).toHaveBeenCalledWith(LOCAL_USER_ID, { type: "onboarding_complete" });
  });
  it("profile save failure → friendly error and no award", async () => {
    db.$client.exec("create trigger no_upd before update on profiles begin select raise(abort, 'nope'); end");
    try {
      expect(await saveOnboarding(valid as never)).toEqual({ error: "Couldn't save — try again." });
    } finally {
      db.$client.exec("drop trigger no_upd");
    }
    expect(s.award).not.toHaveBeenCalled();
  });
  it("an XP failure never blocks onboarding", async () => {
    s.award = vi.fn(async () => { throw new Error("db down"); });
    expect(await saveOnboarding(valid as never)).toEqual({ award: null });
    expect(profile()?.onboarded).toBe(true);
  });
});

describe("landing → onboarding → app", () => {
  it("sends a fresh install to onboarding, then to the feed once onboarded", async () => {
    await expect(Home()).rejects.toThrow("REDIRECT /onboarding");
    expect(profile()?.onboarded).toBe(false);
    await saveOnboarding(valid as never);
    await expect(Home()).rejects.toThrow("REDIRECT /feed");
  });
});
