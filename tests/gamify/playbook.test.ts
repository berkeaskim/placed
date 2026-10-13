import { describe, it, expect, vi } from "vitest";
import { computeAward, xpFor, BADGES, type GamifyState } from "@/lib/gamify/core";
import { awardXP } from "@/lib/gamify/award";

const admin = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.current }));

const base: GamifyState = { xp: 0, streakDays: 0, lastActiveDate: null, badges: [], savesToday: 0, appliedCount: 0, rejectedCount: 0 };
const today = "2026-10-13";

describe("playbook_done XP", () => {
  it("gives 40 XP for the first three per day, then 0", () => {
    expect(xpFor({ type: "playbook_done", ref: "A" }, { ...base, playbookDoneToday: 2, lastActiveDate: today })).toBe(40);
    expect(xpFor({ type: "playbook_done", ref: "A" }, { ...base, playbookDoneToday: 3, lastActiveDate: today })).toBe(0);
  });

  it("awards Gap Closer on the first one only", () => {
    const first = computeAward(base, { type: "playbook_done", ref: "A" }, today);
    expect(first.result).toMatchObject({ xpGained: 40, newBadges: ["gap_closer"] });
    const second = computeAward(first.next, { type: "playbook_done", ref: "B" }, today);
    expect(second.result.newBadges).toEqual([]);
    expect(second.next.playbookDoneToday).toBe(2);
    expect(BADGES.gap_closer.name).toBe("Gap Closer");
  });

  it("resets the daily cap on a new day", () => {
    const s = { ...base, playbookDoneToday: 3, lastActiveDate: "2026-10-12" };
    expect(computeAward(s, { type: "playbook_done", ref: "A" }, today).result.xpGained).toBe(40);
  });
});

describe("awardXP for playbook_done", () => {
  function fake() {
    const inserts: unknown[] = [];
    const counts: string[] = [];
    const from = (table: string) => {
      let op = "";
      const b: Record<string, unknown> = {};
      for (const m of ["select", "update", "upsert"]) b[m] = () => { op = m; return b; };
      b.insert = (row: unknown) => { op = "insert"; inserts.push(row); return b; };
      b.eq = (col: string, v: string) => { if (table === "xp_events" && col === "type") counts.push(v); return b; };
      b.gte = () => b;
      const res = () => ({
        "profiles.select": { data: { xp: 0, streak_days: 0, last_active_date: null } },
        "badges.select": { data: [] }, "xp_events.select": { count: 0 }, "xp_events.insert": { error: null },
        "profiles.update": { error: null }, "badges.upsert": { error: null },
      } as Record<string, unknown>)[`${table}.${op}`];
      b.single = () => Promise.resolve(res());
      b.then = (r: (v: unknown) => unknown) => Promise.resolve(res()).then(r);
      return b;
    };
    const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) }, from, rpc: vi.fn(async () => ({ data: 40, error: null })) };
    admin.current = supabase;
    return { supabase: supabase as never, inserts, counts };
  }

  it("requires a ref and records it on the event row", async () => {
    const f = fake();
    await expect(awardXP(f.supabase, "u1", { type: "playbook_done" })).rejects.toThrow(/ref/);
    const r = await awardXP(f.supabase, "u1", { type: "playbook_done", ref: "PB-DAT-P01" });
    expect(r.xpGained).toBe(40);
    expect(f.inserts).toContainEqual(expect.objectContaining({ type: "playbook_done", ref: "PB-DAT-P01", xp: 40 }));
    expect(f.counts).toContain("playbook_done");
  });
});
