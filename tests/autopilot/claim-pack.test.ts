import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken } from "@/lib/autopilot/handoff";

vi.mock("server-only", () => ({}));
const fake = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.db }));
import { claimPack } from "@/lib/autopilot/server";

const TOKEN = "a".repeat(43);
const UID = "user-1";
const form = { ats: "greenhouse", url: "https://x/apply", fields: [
  { key: "first_name", label: "First name", type: "text", required: true, options: [], target: "#first_name" },
] };
type Tables = Record<string, { select?: unknown; update?: unknown[] }>;

function makeDb(t: Tables, signed: { signedUrl: string } | null = { signedUrl: "https://signed" }) {
  const calls: { table: string; op: string; filters: [string, unknown[]][] }[] = [];
  const from = (table: string) => {
    let op = "select"; const filters: [string, unknown[]][] = [];
    const b: Record<string, unknown> = {};
    const chain = (n: string) => (...a: unknown[]) => { filters.push([n, a]); return b; };
    for (const n of ["select", "eq", "is", "gt"]) b[n] = chain(n);
    b.update = (...a: unknown[]) => { op = "update"; filters.push(["update", a]); return b; };
    b.maybeSingle = async () => ({ data: t[table]?.select ?? null });
    b.then = (res: (v: unknown) => unknown) => { calls.push({ table, op, filters }); return Promise.resolve({ data: op === "update" ? (t[table]?.update ?? []) : null }).then(res); };
    return b;
  };
  const storage = { from: (bucket: string) => ({ createSignedUrl: async (path: string) => { (storage as { last?: unknown }).last = [bucket, path]; return { data: signed }; } }) };
  return { db: { from, storage }, calls, storage };
}
const pack = (over = {}) => ({ id: "p1", user_id: UID, job_id: "j1", form, answers: {}, token_expires_at: new Date(Date.now() + 60_000).toISOString(), token_used_at: null, ...over });
const base = (over: Tables = {}): Tables => ({
  autopilot_packs: { select: pack(), update: [{ id: "p1" }] },
  autopilot_vault: { select: { core: { first_name: "Ayşe", last_name: "Yılmaz", secret_key: "SHOULD-NOT-LEAK" }, extra: {}, completed_at: "x" } },
  applications: { select: { tailored_cv_path: `${UID}/j1.pdf` } },
  cvs: { select: { storage_path: `${UID}/cv.pdf` } },
  ...over,
});

describe("claimPack", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  it("404 for an unknown hash", async () => {
    fake.db = makeDb(base({ autopilot_packs: {} })).db;
    expect(await claimPack(TOKEN)).toEqual({ status: 404 });
  });
  it("410 when already used or expired", async () => {
    fake.db = makeDb(base({ autopilot_packs: { select: pack({ token_used_at: "x" }) } })).db;
    expect(await claimPack(TOKEN)).toEqual({ status: 410 });
    fake.db = makeDb(base({ autopilot_packs: { select: pack({ token_expires_at: new Date(Date.now() - 1000).toISOString() }) } })).db;
    expect(await claimPack(TOKEN)).toEqual({ status: 410 });
  });
  it("410 when the conditional update matches no rows, and binds hash/unused/unexpired", async () => {
    const m = makeDb(base({ autopilot_packs: { select: pack(), update: [] } }));
    fake.db = m.db;
    expect(await claimPack(TOKEN)).toEqual({ status: 410 });
    const upd = m.calls.find((c) => c.op === "update")!;
    const names = upd.filters.map(([n, a]) => `${n}:${a[0]}`);
    expect(names).toContain("eq:token_hash"); expect(names).toContain("is:token_used_at"); expect(names).toContain("gt:token_expires_at");
    expect(upd.filters.find(([n, a]) => n === "eq" && a[0] === "token_hash")![1][1]).toBe(hashToken(TOKEN));
  });
  it("cv is null when the storage path is not under the user's prefix", async () => {
    fake.db = makeDb(base({ applications: { select: { tailored_cv_path: "other-user/x.pdf" } }, cvs: { select: { storage_path: "other-user/y.pdf" } } })).db;
    const r = await claimPack(TOKEN);
    expect(r.status === 200 && r.body.cv).toBeNull();
  });
  it("cv is null (and logs, no token) when signing fails", async () => {
    fake.db = makeDb(base(), null).db;
    const r = await claimPack(TOKEN);
    expect(r.status === 200 && r.body.cv).toBeNull();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
  });
  it("happy path returns only this form's fill plan and a 60s CV url", async () => {
    const m = makeDb(base()); fake.db = m.db;
    const r = await claimPack(TOKEN);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(Object.keys(r.body).sort()).toEqual(["ats", "cv", "fields", "url"]);
    expect(r.body.fields).toHaveLength(1);
    expect(r.body.fields[0]).toMatchObject({ target: "#first_name", value: "Ayşe" });
    expect(r.body.cv).toEqual({ url: "https://signed", filename: "Ayşe-Yılmaz-CV.pdf" });
    expect((m.storage as { last?: unknown }).last).toEqual(["tailored", `${UID}/j1.pdf`]);
    expect(JSON.stringify(r.body)).not.toContain("SHOULD-NOT-LEAK");
  });
});
