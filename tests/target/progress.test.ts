import { describe, it, expect, vi } from "vitest";
import { validateCompletion, findAction, completeAction } from "@/lib/target/progress";

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
  function fake(prevStatus: string | null) {
    const writes: [string, string, unknown][] = [];
    const from = (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b; b.eq = () => b;
      b.maybeSingle = async () => ({ data: prevStatus ? { status: prevStatus } : null, error: null });
      b.upsert = async (row: unknown) => { writes.push([table, "upsert", row]); return { error: null }; };
      b.insert = async (row: unknown) => { writes.push([table, "insert", row]); return { error: null }; };
      return b;
    };
    return { supabase: { from } as never, writes };
  }

  it("records the note verbatim as a confirmed fact and awards XP once", async () => {
    const f = fake("planned");
    const r = await completeAction(f.supabase, "u1", "PB-DAT-C01", "Finished the course and the notebook exercises", undefined);
    expect(r).toMatchObject({ award: { xpGained: 40 } });
    expect(f.writes).toContainEqual(["playbook_progress", "upsert", expect.objectContaining({ status: "done", evidence_note: "Finished the course and the notebook exercises" })]);
    const fact = f.writes.find(([t]) => t === "confirmed_facts");
    expect(fact?.[2]).toMatchObject({ user_id: "u1", source: "user-stated" });
    expect((fact?.[2] as { claim: string }).claim).toContain("Finished the course and the notebook exercises");
  });

  it("does not re-award or duplicate the fact when already done", async () => {
    const f = fake("done");
    const r = await completeAction(f.supabase, "u1", "PB-DAT-C01", "Finished the course again", undefined);
    expect(r).toMatchObject({ award: null });
    expect(f.writes.some(([t]) => t === "confirmed_facts")).toBe(false);
  });

  it("rejects unknown actions and weak notes without writing", async () => {
    const f = fake(null);
    expect(await completeAction(f.supabase, "u1", "PB-XXX-Z99", "Finished something real", undefined)).toMatchObject({ error: expect.any(String) });
    expect(await completeAction(f.supabase, "u1", "PB-DAT-C01", "ok", undefined)).toMatchObject({ error: expect.any(String) });
    expect(f.writes).toEqual([]);
  });
});
