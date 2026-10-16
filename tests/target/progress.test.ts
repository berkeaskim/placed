import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import { db, resetDbForTests } from "@/lib/db/client";
import { confirmedFacts, playbookProgress, profiles } from "@/lib/db/schema";
import { validateCompletion, findAction, completeAction, confirmSkill, planAction } from "@/lib/target/progress";

vi.mock("@/lib/gamify/award", () => ({ awardXP: vi.fn(async () => ({ xpGained: 40, newBadges: ["gap_closer"] })) }));

describe("validateCompletion", () => {
  it("requires a real sentence about what the student did", () => {
    expect(validateCompletion("done", undefined)).toMatchObject({ error: expect.stringMatching(/sentence/) });
    expect(validateCompletion("   built   ", undefined)).toMatchObject({ error: expect.any(String) });
    expect(validateCompletion("  Built a SQL dashboard of TfL data  ", undefined)).toEqual({ note: "Built a SQL dashboard of TfL data", url: null });
  });
  it("accepts only https links and caps lengths", () => {
    expect(validateCompletion("Built a SQL dashboard", "http://x.org")).toMatchObject({ error: expect.stringMatching(/https/) });
    expect(validateCompletion("Built a SQL dashboard", "javascript:alert(1)")).toMatchObject({ error: expect.any(String) });
    expect(validateCompletion("Built a SQL dashboard", " https://github.com/a/b ")).toEqual({ note: "Built a SQL dashboard", url: "https://github.com/a/b" });
    expect(validateCompletion("x".repeat(501), undefined)).toMatchObject({ error: expect.stringMatching(/500/) });
  });
});

describe("findAction", () => {
  it("finds real playbook actions and rejects unknown ids", () => {
    expect(findAction("PB-DAT-C01")?.id).toBe("PB-DAT-C01");
    expect(findAction("PB-XXX-Z99")).toBeNull();
  });
});

let dir: string;
const prevDir = process.env.PLACED_DATA_DIR;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-target-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});

const U = "u1";
function setup(o: { prevStatus?: "planned" | "done"; profile?: Partial<typeof profiles.$inferInsert> } = {}) {
  db.delete(profiles).run();
  db.delete(confirmedFacts).run();
  db.delete(playbookProgress).run();
  db.insert(profiles).values({ user_id: U, target_archetype: "data_analytics", year: "2nd", archetypes: [], ...o.profile }).run();
  if (o.prevStatus) {
    db.insert(playbookProgress).values({ user_id: U, action_id: "PB-DAT-C01", status: o.prevStatus, evidence_note: o.prevStatus === "done" ? "An earlier note here" : null }).run();
  }
}
const facts = () => db.select({ user_id: confirmedFacts.user_id, claim: confirmedFacts.claim, source: confirmedFacts.source }).from(confirmedFacts).all();
const progress = () => db.select().from(playbookProgress).all();

beforeEach(async () => {
  const { awardXP } = await import("@/lib/gamify/award");
  vi.mocked(awardXP).mockClear();
});

describe("completeAction", () => {
  const NOTE = "Finished the course and the notebook exercises";

  it("stores ONLY the student's words as the fact (never the action title), then marks done and awards XP", async () => {
    setup({ prevStatus: "planned" });
    const r = await completeAction(U, "PB-DAT-C01", NOTE, "https://github.com/a/tableau-sql");
    expect(r).toMatchObject({ award: { xpGained: 40 }, firstTime: true });
    expect(facts()).toEqual([{ user_id: U, claim: NOTE, source: "user-stated" }]);
    expect(progress()).toEqual([expect.objectContaining({ status: "done", evidence_note: NOTE, evidence_url: "https://github.com/a/tableau-sql" })]);
    const { awardXP } = await import("@/lib/gamify/award");
    expect(awardXP).toHaveBeenCalledWith(U, { type: "playbook_done", ref: "PB-DAT-C01" });
  });

  it("re-completing updates the note without a second fact or XP", async () => {
    setup({ prevStatus: "done" });
    const r = await completeAction(U, "PB-DAT-C01", "Finished the course again", undefined);
    expect(r).toEqual({ award: null, firstTime: false });
    expect(facts()).toEqual([]);
    expect(progress()[0]).toMatchObject({ evidence_note: "Finished the course again" });
  });

  it("if the fact can't be saved, the action is NOT marked done (so a retry still adds it)", async () => {
    setup({ prevStatus: "planned" });
    db.$client.exec("create trigger no_facts before insert on confirmed_facts begin select raise(abort, 'boom'); end");
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await completeAction(U, "PB-DAT-C01", NOTE, undefined)).toMatchObject({ error: expect.any(String) });
      expect(progress()[0]).toMatchObject({ status: "planned" });
    } finally {
      db.$client.exec("drop trigger no_facts");
    }
  });

  it("an XP failure doesn't fail a saved action", async () => {
    setup();
    const { awardXP } = await import("@/lib/gamify/award");
    vi.mocked(awardXP).mockRejectedValueOnce(new Error("rpc down"));
    expect(await completeAction(U, "PB-DAT-C01", NOTE, undefined)).toEqual({ award: null, firstTime: true });
    expect(progress()[0]).toMatchObject({ status: "done" });
  });

  it("only accepts actions from the student's target-role playbook, open to their year", async () => {
    setup({ profile: { target_archetype: "consulting" } });
    expect(await completeAction(U, "PB-DAT-C01", NOTE, undefined)).toMatchObject({ error: expect.stringMatching(/target role/) });
    setup({ profile: { year: "1st" } });
    expect(await completeAction(U, "PB-DAT-P04", NOTE, undefined)).toMatchObject({ error: expect.stringMatching(/target role/) }); // 2nd-year action
    expect([...facts(), ...progress()]).toEqual([]);
  });

  it("rejects unknown actions, weak notes, bad links and non-string input without writing", async () => {
    setup();
    expect(await completeAction(U, "PB-XXX-Z99", NOTE, undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(U, "PB-DAT-C01", "ok", undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(U, "PB-DAT-C01", NOTE, `https://x.io/${"a".repeat(400)}`)).toMatchObject({ error: expect.stringMatching(/300/) });
    expect(await completeAction(U, 42 as never, NOTE, undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(U, "PB-DAT-C01", { x: 1 } as never, undefined)).toMatchObject({ error: expect.any(String) });
    expect([...facts(), ...progress()]).toEqual([]);
  });
});

describe("planAction", () => {
  it("refuses actions outside the student's target role", async () => {
    setup({ profile: { target_archetype: "consulting" } });
    expect(await planAction(U, "PB-DAT-C01")).toMatchObject({ error: expect.any(String) });
    expect(progress()).toEqual([]);
  });
  it("plans an action but never downgrades a done one", async () => {
    setup();
    expect(await planAction(U, "PB-DAT-C01")).toEqual({ ok: true });
    expect(progress()[0]).toMatchObject({ status: "planned" });
    setup({ prevStatus: "done" });
    expect(await planAction(U, "PB-DAT-C01")).toEqual({ ok: true });
    expect(progress()[0]).toMatchObject({ status: "done" });
  });
});

describe("confirmSkill", () => {
  it("stores the student's own words under the canonical skill, never XP", async () => {
    setup();
    const r = await confirmSkill(U, "tableau", "Built two Tableau dashboards for the netball society", undefined);
    expect(r).toEqual({ ok: true, stored: "Tableau: Built two Tableau dashboards for the netball society" });
    expect(facts()).toEqual([{ user_id: U, claim: "Tableau: Built two Tableau dashboards for the netball society", source: "user-stated" }]);
    const { awardXP } = await import("@/lib/gamify/award");
    expect(awardXP).not.toHaveBeenCalled();
  });

  it("keeps the link out of the claim, so a URL path can't confirm extra skills", async () => {
    setup();
    const r = await confirmSkill(U, "SQL", "Wrote SQL queries in my dissertation", "https://github.com/me/python-tableau");
    expect(r).toEqual({ ok: true, stored: "SQL: Wrote SQL queries in my dissertation" });
  });

  it("is idempotent per skill (exact, case-sensitive prefix; LIKE wildcards are literal)", async () => {
    setup();
    db.insert(confirmedFacts).values([{ user_id: U, claim: "sql: lower-case is a different claim" }, { user_id: "u2", claim: "SQL: someone else" }]).run();
    expect(await confirmSkill(U, "SQL", "Wrote SQL queries in my dissertation", undefined)).toMatchObject({ stored: expect.any(String) });
    expect(await confirmSkill(U, "SQL", "Wrote SQL queries again, elsewhere", undefined)).toEqual({ ok: true, stored: null });
    expect(facts().filter((f) => f.user_id === U)).toHaveLength(2);
  });

  it("rejects non-vocab skills and empty notes without writing", async () => {
    setup();
    expect(await confirmSkill(U, "Underwater basket weaving", "I did it for ten years", undefined)).toMatchObject({ error: "Unknown skill." });
    expect(await confirmSkill(U, "SQL", "yes", undefined)).toMatchObject({ error: expect.stringMatching(/where you used SQL/) });
    expect(await confirmSkill(U, "SQL", "Wrote SQL at my placement", "http://x")).toMatchObject({ error: expect.stringMatching(/https/) });
    expect(facts()).toEqual([]);
  });
});
