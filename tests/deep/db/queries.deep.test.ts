import { describe, it, expect } from "vitest";
import { getProfile, toStudent, type ProfileRow } from "@/lib/db/queries";

const row: ProfileRow = {
  user_id: "u1", display_name: "Sam", year: null, field: null, location_pref: null as never, needs_visa: true,
  target_archetype: null, archetypes: null as never, skills: null as never, onboarded: false, xp: 0, level: 1, streak_days: 0, last_active_date: null,
};

describe("toStudent", () => {
  it("defaults nulls safely", () => {
    expect(toStudent(row)).toEqual({ year: "2nd", locationPref: [], needsVisa: true, archetypes: [], skills: [] });
  });
  it("sorts archetypes by score desc without mutating the row", () => {
    const archetypes = [{ key: "research", score: 10, why: [] }, { key: "software_eng", score: 90, why: [] }, { key: "product", score: 50, why: [] }];
    const r = { ...row, archetypes: archetypes as never };
    const out = toStudent(r);
    expect(out.archetypes.map((a) => a.key)).toEqual(["software_eng", "product", "research"]);
    expect(archetypes.map((a) => a.key)).toEqual(["research", "software_eng", "product"]);
  });
});

describe("getProfile", () => {
  const client = (res: { data: unknown; error: unknown }, seen: unknown[]) => ({
    from: (t: string) => ({ select: (c: string) => ({ eq: (k: string, v: string) => { seen.push([t, c, k, v]); return { single: async () => res }; } }) }),
  }) as never;
  it("scopes the read to the given user id", async () => {
    const seen: unknown[] = [];
    expect(await getProfile(client({ data: row, error: null }, seen), "u1")).toBe(row);
    expect(seen).toEqual([["profiles", "*", "user_id", "u1"]]);
  });
  it("throws the Supabase error (e.g. RLS-filtered / missing row)", async () => {
    const err = { code: "PGRST116", message: "0 rows" };
    await expect(getProfile(client({ data: null, error: err }, []), "u1")).rejects.toBe(err);
  });
});
