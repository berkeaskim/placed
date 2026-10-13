import { describe, it, expect, vi, afterEach } from "vitest";
import { awardXP } from "@/lib/gamify/award";

// awardXP writes through the service-role client; route it to the same fake as the session client.
const admin = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.current }));

/**
 * In-memory fake of the slice of Supabase that awardXP touches. It models:
 * - the partial unique indexes from 0002_gamify_hardening.sql (23505 on duplicates)
 * - award_xp as an atomic `xp = xp + delta` returning the new value
 * - badges upsert with ignoreDuplicates + .select(): ON CONFLICT DO NOTHING RETURNING yields only inserted rows
 * Each awaited call yields a macrotask so concurrent awardXP calls interleave.
 */
type Ev = { user_id: string; type: string; xp: number; job_id: string | null; created_at: string };
const ONCE_PER_USER = new Set(["onboarding_complete", "cv_uploaded", "quiz_done"]);
const tick = () => new Promise((r) => setTimeout(r, 0));

function makeDb(init?: { xp?: number; streak?: number; last?: string | null; badges?: string[]; events?: Ev[]; userId?: string }) {
  const userId = init?.userId ?? "u1";
  const db = {
    profile: { xp: init?.xp ?? 0, level: 1, streak_days: init?.streak ?? 0, last_active_date: init?.last ?? null as string | null },
    events: [...(init?.events ?? [])] as Ev[],
    badges: (init?.badges ?? []).map((badge_key) => ({ user_id: userId, badge_key })),
    rpcCalls: [] as number[],
    insertsAttempted: 0,
  };
  const from = (table: string) => {
    const filters: [string, string, unknown][] = [];
    let op = "";
    let payload: unknown;
    let head = false;
    const b: Record<string, unknown> = {};
    b.select = (_c: string, o?: { head?: boolean }) => { if (!op) op = "select"; head = !!o?.head; return b; };
    b.insert = (p: unknown) => { op = "insert"; payload = p; return b; };
    b.update = (p: unknown) => { op = "update"; payload = p; return b; };
    b.upsert = (p: unknown) => { op = "upsert"; payload = p; return b; };
    b.eq = (c: string, v: unknown) => { filters.push(["eq", c, v]); return b; };
    b.gte = (c: string, v: unknown) => { filters.push(["gte", c, v]); return b; };
    const exec = async () => {
      await tick();
      if (table === "profiles" && op === "select") return { data: { ...db.profile }, error: null };
      if (table === "profiles" && op === "update") { Object.assign(db.profile, payload); return { error: null }; }
      if (table === "badges" && op === "select") return { data: db.badges.map((x) => ({ badge_key: x.badge_key })), error: null };
      if (table === "badges" && op === "upsert") {
        const inserted: { badge_key: string }[] = [];
        for (const row of payload as { user_id: string; badge_key: string }[]) {
          if (db.badges.some((x) => x.user_id === row.user_id && x.badge_key === row.badge_key)) continue;
          db.badges.push(row);
          inserted.push({ badge_key: row.badge_key });
        }
        return { data: inserted, error: null };
      }
      if (table === "xp_events" && op === "select" && head) {
        const n = db.events.filter((e) => filters.every(([k, c, v]) => k === "eq" ? (e as Record<string, unknown>)[c] === v : String((e as Record<string, unknown>)[c]) >= String(v))).length;
        return { count: n, error: null };
      }
      if (table === "xp_events" && op === "insert") {
        db.insertsAttempted++;
        const row = payload as Omit<Ev, "created_at">;
        const dup = db.events.some((e) => e.user_id === row.user_id && e.type === row.type &&
          ((row.job_id !== null && e.job_id === row.job_id) || (ONCE_PER_USER.has(row.type))));
        if (dup) return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        db.events.push({ ...row, created_at: new Date().toISOString() });
        return { error: null };
      }
      throw new Error(`unexpected ${table}.${op}`);
    };
    b.single = exec;
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => exec().then(res, rej);
    return b;
  };
  const rpc = vi.fn(async (_n: string, { p_delta }: { p_delta: number }) => {
    await tick();
    db.rpcCalls.push(p_delta);
    db.profile.xp += p_delta; // atomic in Postgres
    return { data: db.profile.xp, error: null };
  });
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: userId } } }) }, from, rpc };
  admin.current = supabase;
  return { db, supabase: supabase as never, rpc };
}

afterEach(() => { vi.useRealTimers(); });

describe("awardXP idempotency", () => {
  it("same once-per-user event twice → XP awarded once, second is a zero no-op", async () => {
    const f = makeDb();
    const a = await awardXP(f.supabase, "u1", { type: "onboarding_complete" });
    const b = await awardXP(f.supabase, "u1", { type: "onboarding_complete" });
    expect(a.xpGained).toBe(50);
    expect(b).toMatchObject({ xpGained: 0, newXp: 50, levelUp: false, newBadges: [] });
    expect(f.db.profile.xp).toBe(50);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.db.events.filter((e) => e.type === "onboarding_complete")).toHaveLength(1);
  });
  it("same (type, job) twice → once; different job → pays again", async () => {
    const f = makeDb();
    await awardXP(f.supabase, "u1", { type: "applied", fitLabel: "Strong fit" }, "j1");
    const dup = await awardXP(f.supabase, "u1", { type: "applied", fitLabel: "Strong fit" }, "j1");
    const other = await awardXP(f.supabase, "u1", { type: "applied", fitLabel: "Strong fit" }, "j2");
    expect(dup.xpGained).toBe(0);
    expect(other.xpGained).toBe(50);
    expect(f.db.profile.xp).toBe(100);
  });
  it("concurrent duplicate awards (double click) → exactly one pays", async () => {
    const f = makeDb();
    const rs = await Promise.all(Array.from({ length: 5 }, () => awardXP(f.supabase, "u1", { type: "quiz_done", profileComplete: true })));
    expect(rs.map((r) => r.xpGained).sort()).toEqual([0, 0, 0, 0, 100]);
    expect(f.db.profile.xp).toBe(100);
    expect(f.db.badges).toHaveLength(1);
    expect(rs.filter((r) => r.newBadges.includes("profile_pro"))).toHaveLength(1);
  });
  it("concurrent distinct awards never lose XP (atomic increment)", async () => {
    const f = makeDb({ xp: 0 });
    await Promise.all(Array.from({ length: 8 }, (_, i) => awardXP(f.supabase, "u1", { type: "job_saved" }, `j${i}`)));
    expect(f.db.profile.xp).toBe(40);
    expect(f.db.rpcCalls).toEqual(Array(8).fill(5));
  });
  it("the day's 11th save inserts an event but does not call award_xp", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const events: Ev[] = Array.from({ length: 10 }, (_, i) => ({ user_id: "u1", type: "job_saved", xp: 5, job_id: `s${i}`, created_at: "2026-10-13T09:00:00.000Z" }));
    const f = makeDb({ xp: 50, last: "2026-10-13", events });
    const r = await awardXP(f.supabase, "u1", { type: "job_saved" }, "s10");
    expect(r.xpGained).toBe(0);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("saves made before London midnight don't count toward today's cap (BST)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-02T08:00:00Z")); // London 2026-07-02
    // 10 saves at 22:30Z on 07-01 = 23:30 BST on 07-01 (yesterday in London)
    const events: Ev[] = Array.from({ length: 10 }, (_, i) => ({ user_id: "u1", type: "job_saved", xp: 5, job_id: `s${i}`, created_at: "2026-07-01T22:30:00.000Z" }));
    const f = makeDb({ xp: 50, last: "2026-07-01", events });
    const r = await awardXP(f.supabase, "u1", { type: "job_saved" }, "new");
    expect(r.xpGained).toBe(5);
    expect(r.streakDays).toBe(1); // streak 0 stored → 0+1
  });
  it("saves made after London midnight but before UTC midnight count toward today (BST)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-02T08:00:00Z"));
    // 23:30Z on 07-01 = 00:30 BST on 07-02 (today in London)
    const events: Ev[] = Array.from({ length: 10 }, (_, i) => ({ user_id: "u1", type: "job_saved", xp: 5, job_id: `s${i}`, created_at: "2026-07-01T23:30:00.000Z" }));
    const f = makeDb({ xp: 50, last: "2026-07-02", events });
    expect((await awardXP(f.supabase, "u1", { type: "job_saved" }, "new")).xpGained).toBe(0);
  });
  it("persists streak and last_active_date using the London day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-01T23:05:00Z")); // 00:05 BST 07-02
    const f = makeDb({ streak: 3, last: "2026-07-01" });
    const r = await awardXP(f.supabase, "u1", { type: "cv_tailored" }, "j1");
    expect(r.streakDays).toBe(4);
    expect(f.db.profile).toMatchObject({ streak_days: 4, last_active_date: "2026-07-02" });
  });
  it("level written to the profile matches the XP returned by award_xp", async () => {
    const f = makeDb({ xp: 95 });
    const r = await awardXP(f.supabase, "u1", { type: "job_saved" }, "j1");
    expect(r).toMatchObject({ newXp: 100, level: 2, levelName: "Applicant", levelUp: true });
    expect(f.db.profile.level).toBe(2);
  });

  // BUG: levelUp is computed from the pre-read XP, not from what award_xp returned. If a concurrent award
  // already crossed the boundary, both callers report levelUp → double "level up" confetti.
  // Fixed: levelUp is derived from award_xp's returned XP (newXp - xpGained → newXp).
  it("levelUp reflects the atomic increment result under concurrency", async () => {
    const f = makeDb({ xp: 95 });
    const rs = await Promise.all([
      awardXP(f.supabase, "u1", { type: "job_saved" }, "a"),
      awardXP(f.supabase, "u1", { type: "job_saved" }, "b"),
    ]);
    expect(f.db.profile.xp).toBe(105);
    expect(rs.filter((r) => r.levelUp)).toHaveLength(1);
  });

  // BUG: concurrent first applications both read appliedCount=0 and both return newBadges:["first_shot"]
  // (DB dedupes via upsert, but the UI shows the unlock toast twice).
  // Fixed: only badges this call's upsert actually inserted (RETURNING rows) are reported as new.
  it("first_shot is reported as newly unlocked to exactly one of two concurrent applications", async () => {
    const f = makeDb();
    const rs = await Promise.all([
      awardXP(f.supabase, "u1", { type: "applied", fitLabel: "Good fit" }, "a"),
      awardXP(f.supabase, "u1", { type: "applied", fitLabel: "Good fit" }, "b"),
    ]);
    expect(f.db.badges).toHaveLength(1);
    expect(rs.filter((r) => r.newBadges.includes("first_shot"))).toHaveLength(1);
  });

  // BUG: cv_uploaded is once-per-user (unique index). If the first upload is image-only (profileComplete=false),
  // it burns the one-time event; a later readable CV hits 23505 → noAward → profile_pro can never be earned via CV.
  // Fixed: an image-only upload records no event and awards nothing; the readable one pays.
  it("a readable CV after an image-only first upload still unlocks profile_pro", async () => {
    const f = makeDb();
    await awardXP(f.supabase, "u1", { type: "cv_uploaded", profileComplete: false });
    expect(f.db.events).toHaveLength(0);
    expect(f.rpc).not.toHaveBeenCalled();
    const second = await awardXP(f.supabase, "u1", { type: "cv_uploaded", profileComplete: true });
    expect(second.newBadges).toContain("profile_pro");
    expect(second.xpGained).toBe(100);
  });

  it("never increments XP or writes when the session user differs", async () => {
    const f = makeDb({ userId: "attacker" });
    await expect(awardXP(f.supabase, "victim", { type: "offer" }, "j1")).rejects.toThrow(/session user/);
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.db.insertsAttempted).toBe(0);
  });
  it("rejects job events without a jobId before any write", async () => {
    const f = makeDb();
    for (const type of ["job_saved", "cv_tailored", "applied", "interview", "rejected", "offer"] as const) {
      await expect(awardXP(f.supabase, "u1", { type })).rejects.toThrow(/jobId/);
    }
    expect(f.db.insertsAttempted).toBe(0);
  });
});
