import { describe, it, expect, vi } from "vitest";
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

describe("completeAction", () => {
  type Opts = { prevStatus?: string | null; factError?: boolean; profile?: Record<string, unknown> };
  function fake(o: Opts = {}) {
    const writes: [string, string, unknown][] = [];
    const from = (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b; b.eq = () => b;
      b.maybeSingle = async () => table === "profiles"
        ? { data: o.profile ?? { target_archetype: "data_analytics", year: "2nd", archetypes: [] }, error: null }
        : { data: o.prevStatus ? { status: o.prevStatus } : null, error: null };
      b.upsert = async (row: unknown) => { writes.push([table, "upsert", row]); return { error: null }; };
      b.insert = async (row: unknown) => {
        writes.push([table, "insert", row]);
        return { error: table === "confirmed_facts" && o.factError ? { message: "boom" } : null };
      };
      return b;
    };
    return { supabase: { from } as never, writes };
  }
  const NOTE = "Finished the course and the notebook exercises";

  it("stores ONLY the student's words as the fact (never the action title), then marks done and awards XP", async () => {
    const f = fake({ prevStatus: "planned" });
    const r = await completeAction(f.supabase, "u1", "PB-DAT-C01", NOTE, "https://github.com/a/tableau-sql");
    expect(r).toMatchObject({ award: { xpGained: 40 }, firstTime: true });
    expect(f.writes.map(([t, op]) => `${op}:${t}`)).toEqual(["insert:confirmed_facts", "upsert:playbook_progress"]);
    expect(f.writes[0][2]).toEqual({ user_id: "u1", claim: NOTE, source: "user-stated" });
    expect(f.writes[1][2]).toMatchObject({ status: "done", evidence_note: NOTE, evidence_url: "https://github.com/a/tableau-sql" });
  });

  it("re-completing updates the note without a second fact or XP", async () => {
    const f = fake({ prevStatus: "done" });
    const r = await completeAction(f.supabase, "u1", "PB-DAT-C01", "Finished the course again", undefined);
    expect(r).toEqual({ award: null, firstTime: false });
    expect(f.writes.some(([t]) => t === "confirmed_facts")).toBe(false);
  });

  it("if the fact can't be saved, the action is NOT marked done (so a retry still adds it)", async () => {
    const f = fake({ prevStatus: null, factError: true });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", NOTE, undefined)).toMatchObject({ error: expect.any(String) });
    expect(f.writes.some(([t]) => t === "playbook_progress")).toBe(false);
  });

  it("an XP failure doesn't fail a saved action", async () => {
    const { awardXP } = await import("@/lib/gamify/award");
    vi.mocked(awardXP).mockRejectedValueOnce(new Error("rpc down"));
    const f = fake({ prevStatus: null });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", NOTE, undefined)).toEqual({ award: null, firstTime: true });
  });

  it("only accepts actions from the student's target-role playbook, open to their year", async () => {
    const f = fake({ profile: { target_archetype: "consulting", year: "2nd" } });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", NOTE, undefined)).toMatchObject({ error: expect.stringMatching(/target role/) });
    const g = fake({ profile: { target_archetype: "data_analytics", year: "1st" } });
    expect(await completeAction(g.supabase, "u1", "PB-DAT-P04", NOTE, undefined)).toMatchObject({ error: expect.stringMatching(/target role/) }); // 2nd-year action
    expect([...f.writes, ...g.writes]).toEqual([]);
  });

  it("rejects unknown actions, weak notes, bad links and non-string input without writing", async () => {
    const f = fake();
    expect(await completeAction(f.supabase, "u1", "PB-XXX-Z99", NOTE, undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", "ok", undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", NOTE, `https://x.io/${"a".repeat(400)}`)).toMatchObject({ error: expect.stringMatching(/300/) });
    expect(await completeAction(f.supabase, "u1", 42 as never, NOTE, undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", { x: 1 } as never, undefined)).toMatchObject({ error: expect.any(String) });
    expect(f.writes).toEqual([]);
  });
});

describe("planAction", () => {
  it("refuses actions outside the student's target role", async () => {
    const from = (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b; b.eq = () => b;
      b.maybeSingle = async () => ({ data: table === "profiles" ? { target_archetype: "consulting", year: "2nd" } : null, error: null });
      b.upsert = async () => { throw new Error("must not write"); };
      return b;
    };
    expect(await planAction({ from } as never, "u1", "PB-DAT-C01")).toMatchObject({ error: expect.any(String) });
  });
});

describe("confirmSkill", () => {
  function fake(existing: boolean) {
    const writes: [string, unknown][] = [];
    const likes: string[] = [];
    const from = (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b; b.eq = () => b; b.limit = () => b;
      b.like = (_c: string, v: string) => { likes.push(v); return b; };
      b.maybeSingle = async () => ({ data: existing ? { id: "f1" } : null, error: null });
      b.insert = async (row: unknown) => { writes.push([table, row]); return { error: null }; };
      return b;
    };
    return { supabase: { from } as never, writes, likes };
  }

  it("stores the student's own words under the canonical skill, never XP", async () => {
    const f = fake(false);
    const r = await confirmSkill(f.supabase, "u1", "tableau", "Built two Tableau dashboards for the netball society", undefined);
    expect(r).toEqual({ ok: true, stored: "Tableau: Built two Tableau dashboards for the netball society" });
    expect(f.writes).toEqual([["confirmed_facts", { user_id: "u1", claim: "Tableau: Built two Tableau dashboards for the netball society", source: "user-stated" }]]);
  });

  it("keeps the link out of the claim, so a URL path can't confirm extra skills", async () => {
    const f = fake(false);
    const r = await confirmSkill(f.supabase, "u1", "SQL", "Wrote SQL queries in my dissertation", "https://github.com/me/python-tableau");
    expect(r).toEqual({ ok: true, stored: "SQL: Wrote SQL queries in my dissertation" });
  });

  it("is idempotent per skill", async () => {
    const f = fake(true);
    expect(await confirmSkill(f.supabase, "u1", "SQL", "Wrote SQL queries in my dissertation", undefined)).toEqual({ ok: true, stored: null });
    expect(f.writes).toEqual([]);
    expect(f.likes).toEqual(["SQL: %"]);
  });

  it("rejects non-vocab skills and empty notes without writing", async () => {
    const f = fake(false);
    expect(await confirmSkill(f.supabase, "u1", "Underwater basket weaving", "I did it for ten years", undefined)).toMatchObject({ error: "Unknown skill." });
    expect(await confirmSkill(f.supabase, "u1", "SQL", "yes", undefined)).toMatchObject({ error: expect.stringMatching(/where you used SQL/) });
    expect(await confirmSkill(f.supabase, "u1", "SQL", "Wrote SQL at my placement", "http://x")).toMatchObject({ error: expect.stringMatching(/https/) });
    expect(f.writes).toEqual([]);
  });
});
