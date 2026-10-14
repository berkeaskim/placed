import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resetUserData, USER_TABLES, USER_BUCKETS } from "@/lib/db/reset";

function fake(opts: { files?: Record<string, string[]>; failTable?: string } = {}) {
  const calls: { deletes: { table: string; col: string; val: string }[]; updates: { table: string; patch: Record<string, unknown>; col: string; val: string }[]; lists: { bucket: string; prefix: string; offset: number }[]; removes: { bucket: string; paths: string[] }[] } =
    { deletes: [], updates: [], lists: [], removes: [] };
  const order: string[] = []; // every call, in order: "row:<table>", "update:<table>", "list:<bucket>", "remove:<bucket>"
  const store = structuredClone(opts.files ?? {});
  const client = {
    from: (table: string) => ({
      delete: () => ({ eq: async (col: string, val: string) => { calls.deletes.push({ table, col, val }); order.push(`row:${table}`); return { error: table === opts.failTable ? { message: "boom" } : null }; } }),
      update: (patch: Record<string, unknown>) => ({ eq: async (col: string, val: string) => { calls.updates.push({ table, patch, col, val }); order.push(`update:${table}`); return { error: null }; } }),
    }),
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string, o: { limit: number; offset: number }) => {
          calls.lists.push({ bucket, prefix, offset: o.offset }); order.push(`list:${bucket}`);
          const names = (store[`${bucket}/${prefix}`] ?? []).slice(o.offset, o.offset + o.limit);
          return { data: names.map((name) => ({ name })), error: null };
        },
        remove: async (paths: string[]) => {
          calls.removes.push({ bucket, paths }); order.push(`remove:${bucket}`);
          const key = Object.keys(store).find((k) => k.startsWith(`${bucket}/`));
          if (key) store[key] = store[key].filter((n) => !paths.includes(`${key.split("/")[1]}/${n}`));
          return { data: [], error: null };
        },
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls, store, order };
}

describe("resetUserData", () => {
  it("deletes every user table scoped to the user id", async () => {
    const { client, calls } = fake();
    await resetUserData(client, "u1");
    expect(calls.deletes.map((d) => d.table).sort()).toEqual([...USER_TABLES].sort());
    for (const t of ["cv_scores", "cvs", "confirmed_facts", "matches", "applications", "xp_events", "badges", "cv_feedback"]) expect(USER_TABLES).toContain(t);
    expect(calls.deletes.every((d) => d.col === "user_id" && d.val === "u1")).toBe(true);
    // cv_scores must go before cvs
    expect(calls.deletes.findIndex((d) => d.table === "cv_scores")).toBeLessThan(calls.deletes.findIndex((d) => d.table === "cvs"));
  });

  it("resets profile gamification fields for that user only", async () => {
    const { client, calls } = fake();
    await resetUserData(client, "u1");
    expect(calls.updates).toHaveLength(1);
    const u = calls.updates[0];
    expect(u).toMatchObject({ table: "profiles", col: "user_id", val: "u1" });
    expect(u.patch).toMatchObject({ onboarded: false, xp: 0, level: 1, streak_days: 0, last_active_date: null, skills: [] });
  });

  it("removes every object under {userId}/ in both buckets, paginating", async () => {
    const many = Array.from({ length: 250 }, (_, i) => `f${i}.pdf`);
    const { client, calls, store } = fake({ files: { "cvs/u1": many, "tailored/u1": ["a.pdf"] } });
    await resetUserData(client, "u1");
    expect([...USER_BUCKETS].sort()).toEqual(["cvs", "tailored"]);
    expect(calls.lists.every((l) => l.prefix === "u1")).toBe(true);
    expect(new Set(calls.lists.map((l) => l.bucket))).toEqual(new Set(["cvs", "tailored"]));
    const removedCvs = calls.removes.filter((r) => r.bucket === "cvs").flatMap((r) => r.paths);
    expect(removedCvs).toHaveLength(250);
    expect(removedCvs.every((p) => p.startsWith("u1/"))).toBe(true);
    expect(calls.removes.filter((r) => r.bucket === "tailored").flatMap((r) => r.paths)).toEqual(["u1/a.pdf"]);
    expect(store["cvs/u1"]).toEqual([]);
  });

  it("deletes rows (and resets the profile) before touching storage, so a DB failure never leaves rows pointing at deleted files", async () => {
    const { client, order } = fake({ files: { "cvs/u1": ["a.pdf"], "tailored/u1": ["b.pdf"] } });
    await resetUserData(client, "u1");
    const lastRow = Math.max(...order.flatMap((o, i) => (o.startsWith("row:") || o.startsWith("update:") ? [i] : [])));
    const firstStorage = order.findIndex((o) => o.startsWith("list:") || o.startsWith("remove:"));
    expect(firstStorage).toBeGreaterThan(-1);
    expect(lastRow).toBeLessThan(firstStorage);
  });

  it("a failed row delete leaves storage untouched", async () => {
    const { client, calls, store } = fake({ failTable: "cvs", files: { "cvs/u1": ["a.pdf"] } });
    await expect(resetUserData(client, "u1")).rejects.toThrow(/cvs/);
    expect(calls.lists).toHaveLength(0);
    expect(calls.removes).toHaveLength(0);
    expect(store["cvs/u1"]).toEqual(["a.pdf"]);
  });

  it("throws, and does not report success, when a delete fails", async () => {
    const { client } = fake({ failTable: "badges" });
    await expect(resetUserData(client, "u1")).rejects.toThrow(/badges/);
  });

  it("rejects an empty user id (would otherwise list the whole bucket)", async () => {
    const { client, calls } = fake();
    await expect(resetUserData(client, "")).rejects.toThrow();
    expect(calls.lists).toHaveLength(0);
  });
});
