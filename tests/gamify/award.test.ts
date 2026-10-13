import { describe, it, expect, vi } from "vitest";
import { awardXP } from "@/lib/gamify/award";

type R = { data?: unknown; error?: { code?: string; message: string } | null; count?: number | null };
function fake(opts: { insertError?: { code: string; message: string } }) {
  const calls: string[] = [];
  const results: Record<string, R> = {
    "profiles.select": { data: { xp: 40, streak_days: 2, last_active_date: "2026-01-01" } },
    "badges.select": { data: [] },
    "xp_events.select": { count: 0 },
    "xp_events.insert": { error: opts.insertError ?? null },
    "profiles.update": { error: null },
    "badges.upsert": { error: null },
  };
  const from = (table: string) => {
    let op = "";
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "upsert"]) b[m] = () => { op = m; calls.push(`${table}.${m}`); return b; };
    for (const m of ["eq", "gte"]) b[m] = () => b;
    b.single = () => Promise.resolve(results[`${table}.${op}`]);
    b.then = (res: (v: R) => unknown) => Promise.resolve(results[`${table}.${op}`]).then(res);
    return b;
  };
  const rpc = vi.fn(async () => ({ data: 90, error: null }));
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) }, from, rpc };
  return { supabase: supabase as never, rpc, calls };
}

describe("awardXP", () => {
  it("awards once and increments atomically", async () => {
    const f = fake({});
    const r = await awardXP(f.supabase, "u1", { type: "job_saved" }, "j1");
    expect(r.xpGained).toBe(5);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenCalledWith("increment_xp", { p_delta: 5 });
    expect(r.newXp).toBe(90);
  });
  it("returns zero XP on a duplicate (unique violation) without incrementing", async () => {
    const f = fake({ insertError: { code: "23505", message: "dup" } });
    const r = await awardXP(f.supabase, "u1", { type: "job_saved" }, "j1");
    expect(r).toMatchObject({ xpGained: 0, newXp: 40, newBadges: [] });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("throws on unexpected insert errors, missing jobId, and foreign userId", async () => {
    await expect(awardXP(fake({ insertError: { code: "XX", message: "boom" } }).supabase, "u1", { type: "job_saved" }, "j1")).rejects.toThrow(/boom/);
    await expect(awardXP(fake({}).supabase, "u1", { type: "applied" })).rejects.toThrow(/jobId/);
    await expect(awardXP(fake({}).supabase, "other", { type: "quiz_done" })).rejects.toThrow(/session user/);
  });
});
