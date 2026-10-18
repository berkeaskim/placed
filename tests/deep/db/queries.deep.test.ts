import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { db, resetDbForTests } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { getProfile, toStudent, type ProfileRow } from "@/lib/db/queries";

const row: ProfileRow = {
  user_id: "u1", display_name: "Sam", year: null, grad_year: null, field: null, course: null, location_pref: null as never, needs_visa: true,
  target_archetype: null, archetypes: null as never, skills: null as never, onboarded: false, xp: 0, level: 1, streak_days: 0, last_active_date: null,
};

describe("toStudent", () => {
  it("defaults nulls safely", () => {
    expect(toStudent(row)).toEqual({ year: "2nd", gradYear: null, locationPref: [], needsVisa: true, workAuth: "student_visa", archetypes: [], skills: [] });
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
  let dir: string;
  const prevDir = process.env.PLACED_DATA_DIR;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "placed-q-"));
    process.env.PLACED_DATA_DIR = dir;
    resetDbForTests();
  });
  afterAll(() => {
    resetDbForTests();
    process.env.PLACED_DATA_DIR = prevDir;
    rmSync(dir, { recursive: true, force: true });
  });
  it("scopes the read to the given user id", async () => {
    db.insert(profiles).values([{ user_id: "u1", display_name: "Sam" }, { user_id: "u2", display_name: "Other" }]).run();
    expect(await getProfile("u1")).toMatchObject({ user_id: "u1", display_name: "Sam" });
  });
  it("throws for a missing row", async () => {
    await expect(getProfile("nobody")).rejects.toThrow(/not found/);
  });
});
