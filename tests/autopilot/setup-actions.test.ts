import { describe, it, expect, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({ upserts: [] as unknown[], award: vi.fn(async () => ({ xpGained: 50 })), on: true, completed: null as string | null, core: null as Record<string, unknown> | null }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "u1", email: "ayse@example.com" } }) }));
vi.mock("@/lib/env", () => ({ env: { get autopilot() { return h.on; } } }));
vi.mock("@/lib/gamify/award", () => ({ awardXP: h.award }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.completed || h.core ? { completed_at: h.completed, core: h.core } : null }) }) }),
    upsert: async (row: unknown) => { h.upserts.push(row); return { error: null }; },
  }),
}) }));
import { saveVault, deleteVault } from "@/app/(app)/autopilot/setup/actions";
import { AYSE_CORE } from "./fixtures";
import { isSealed, openVault } from "@/lib/autopilot/vault-crypto";

const savedCore = () => openVault("core", "u1", (h.upserts[0] as { core: unknown }).core) as Record<string, string>;
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe("saveVault", () => {
  beforeEach(() => { h.on = true; h.upserts.length = 0; h.award.mockClear(); h.completed = null; h.core = null; });
  it("saves partial progress and reports what's missing", async () => {
    const r = await saveVault(null, fd({ first_name: "Ayşe" }));
    expect(r).toMatchObject({ ok: true, unlocked: false });
    expect(r!.missing).toContain("rtw_uk");
    expect(h.award).not.toHaveBeenCalled();
  });
  it("unlocks once and awards XP once", async () => {
    const r = await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>));
    expect(r).toMatchObject({ ok: true, unlocked: true, xp: 50 });
    expect(h.award).toHaveBeenCalledWith({}, "u1", { type: "autopilot_ready" });
    expect((h.upserts[0] as { completed_at?: string }).completed_at).toBeTruthy();
    h.completed = "2026-10-14T00:00:00Z";
    await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>));
    expect(h.award).toHaveBeenCalledTimes(1);
  });
  it("never stores EEO fields even if posted", async () => {
    await saveVault(null, fd({ ...(AYSE_CORE as unknown as Record<string, string>), gender: "x", ethnicity: "y" }));
    expect(JSON.stringify(savedCore())).not.toMatch(/gender|ethnicity/);
  });
  it("stores the core encrypted: no email or phone in the row", async () => {
    await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>));
    const row = h.upserts[0] as { core: unknown };
    expect(isSealed(row.core)).toBe(true);
    expect(JSON.stringify(row)).not.toContain(AYSE_CORE.email);
    expect(JSON.stringify(row)).not.toContain(AYSE_CORE.phone);
    expect(savedCore().email).toBe(AYSE_CORE.email);
  });
  it("keeps a prior valid value when a posted one is rejected, and reports it in invalid", async () => {
    h.core = { ...AYSE_CORE }; h.completed = "2026-10-14T00:00:00Z";
    const r = await saveVault(null, fd({ grad_year: "28", phone: "123" }));
    expect(r!.invalid.sort()).toEqual(["grad_year", "phone"]);
    const saved = savedCore();
    expect(saved.grad_year).toBe(AYSE_CORE.grad_year);
    expect(saved.phone).toBe(AYSE_CORE.phone);
    expect(r!.values).toMatchObject({ grad_year: "28", phone: "123" }); // typed input is handed back
    expect(r!.unlocked).toBe(true); // merged core is still complete
  });
  it("an explicitly cleared required field is removed; unlocked is false even with completed_at set; XP not re-awarded", async () => {
    h.core = { ...AYSE_CORE }; h.completed = "2026-10-14T00:00:00Z";
    const r = await saveVault(null, fd({ phone: "" }));
    expect(r).toMatchObject({ ok: true, unlocked: false, invalid: [] });
    expect(r!.missing).toContain("phone");
    expect(savedCore().phone).toBeUndefined();
    expect((h.upserts[0] as { completed_at: string }).completed_at).toBe("2026-10-14T00:00:00Z");
    expect(h.award).not.toHaveBeenCalled();
  });
  it("fields not posted keep their saved value", async () => {
    h.core = { ...AYSE_CORE };
    await saveVault(null, fd({ city: "Leeds" }));
    const saved = savedCore();
    expect(saved).toMatchObject({ city: "Leeds", first_name: "Ayşe" });
  });
});

describe("getVault completed semantics", () => {
  const dbWith = (row: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) }) as never;
  it("is true only when completed_at is set AND the core is complete", async () => {
    const { getVault } = await import("@/lib/autopilot/server");
    expect((await getVault(dbWith({ core: AYSE_CORE, extra: {}, completed_at: "x" }), "u1")).completed).toBe(true);
    expect((await getVault(dbWith({ core: { ...AYSE_CORE, phone: undefined }, extra: {}, completed_at: "x" }), "u1")).completed).toBe(false);
    expect((await getVault(dbWith({ core: AYSE_CORE, extra: {}, completed_at: null }), "u1")).completed).toBe(false);
    expect((await getVault(dbWith(null), "u1")).completed).toBe(false);
  });
});

describe("env.autopilot guard", () => {
  it("saveVault and deleteVault refuse and touch nothing while the feature is off", async () => {
    h.on = false; h.upserts.length = 0;
    expect(await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>))).toMatchObject({ ok: false, unlocked: false });
    expect(await deleteVault()).toMatchObject({ ok: false });
    expect(h.upserts).toEqual([]);
    expect(h.award).not.toHaveBeenCalled();
  });
});
