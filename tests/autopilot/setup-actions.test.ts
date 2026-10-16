import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
const h = vi.hoisted(() => ({ award: vi.fn(async () => ({ xpGained: 50 })), on: true }));
vi.mock("@/lib/env", () => ({ env: { get autopilot() { return h.on; } } }));
vi.mock("@/lib/gamify/award", () => ({ awardXP: h.award }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
import { saveVault, deleteVault, forgetAnswer } from "@/app/(app)/autopilot/setup/actions";
import { getVault } from "@/lib/autopilot/server";
import { AYSE_CORE } from "./fixtures";
import { isSealed, openVault, sealVault } from "@/lib/autopilot/vault-crypto";
import { db } from "@/lib/db/client";
import { autopilotPacks, autopilotVault } from "@/lib/db/schema";
import { LOCAL_USER_ID as UID } from "@/lib/auth/local-user";
import { seedJob, useTempDb } from "../cv/temp-db";

useTempDb();

const row = () => db.select().from(autopilotVault).where(eq(autopilotVault.user_id, UID)).get();
const savedCore = () => openVault("core", UID, row()?.core) as Record<string, string>;
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const prior = (core: Record<string, unknown> | null, completed: string | null) => {
  db.delete(autopilotVault).run();
  if (core || completed) db.insert(autopilotVault).values({ user_id: UID, core: sealVault("core", UID, core ?? {}), completed_at: completed }).run();
};

describe("saveVault", () => {
  beforeEach(() => { h.on = true; h.award.mockClear(); prior(null, null); });
  it("saves partial progress and reports what's missing", async () => {
    const r = await saveVault(null, fd({ first_name: "Ayşe" }));
    expect(r).toMatchObject({ ok: true, unlocked: false });
    expect(r!.missing).toContain("rtw_uk");
    expect(h.award).not.toHaveBeenCalled();
  });
  it("unlocks once and awards XP once", async () => {
    const r = await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>));
    expect(r).toMatchObject({ ok: true, unlocked: true, xp: 50 });
    expect(h.award).toHaveBeenCalledWith(UID, { type: "autopilot_ready" });
    expect(row()?.completed_at).toBeTruthy();
    await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>));
    expect(h.award).toHaveBeenCalledTimes(1);
  });
  it("never stores EEO fields even if posted", async () => {
    await saveVault(null, fd({ ...(AYSE_CORE as unknown as Record<string, string>), gender: "x", ethnicity: "y" }));
    expect(JSON.stringify(savedCore())).not.toMatch(/gender|ethnicity/);
  });
  it("stores the core encrypted: no email or phone in the row", async () => {
    await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>));
    expect(isSealed(row()?.core)).toBe(true);
    const raw = JSON.stringify(db.$client.prepare("select * from autopilot_vault").all());
    expect(raw).not.toContain(AYSE_CORE.email);
    expect(raw).not.toContain(AYSE_CORE.phone);
    expect(savedCore().email).toBe(AYSE_CORE.email);
  });
  it("keeps a prior valid value when a posted one is rejected, and reports it in invalid", async () => {
    prior({ ...AYSE_CORE }, "2026-10-14T00:00:00Z");
    const r = await saveVault(null, fd({ grad_year: "28", phone: "123" }));
    expect(r!.invalid.sort()).toEqual(["grad_year", "phone"]);
    const saved = savedCore();
    expect(saved.grad_year).toBe(AYSE_CORE.grad_year);
    expect(saved.phone).toBe(AYSE_CORE.phone);
    expect(r!.values).toMatchObject({ grad_year: "28", phone: "123" }); // typed input is handed back
    expect(r!.unlocked).toBe(true); // merged core is still complete
  });
  it("an explicitly cleared required field is removed; unlocked is false even with completed_at set; XP not re-awarded", async () => {
    prior({ ...AYSE_CORE }, "2026-10-14T00:00:00Z");
    const r = await saveVault(null, fd({ phone: "" }));
    expect(r).toMatchObject({ ok: true, unlocked: false, invalid: [] });
    expect(r!.missing).toContain("phone");
    expect(savedCore().phone).toBeUndefined();
    expect(row()?.completed_at).toBe("2026-10-14T00:00:00Z");
    expect(h.award).not.toHaveBeenCalled();
  });
  it("fields not posted keep their saved value", async () => {
    prior({ ...AYSE_CORE }, null);
    await saveVault(null, fd({ city: "Leeds" }));
    const saved = savedCore();
    expect(saved).toMatchObject({ city: "Leeds", first_name: "Ayşe" });
  });
});

describe("getVault completed semantics", () => {
  it("is true only when completed_at is set AND the core is complete", async () => {
    prior({ ...AYSE_CORE }, "x");
    expect((await getVault(UID)).completed).toBe(true);
    prior({ ...AYSE_CORE, phone: undefined }, "x");
    expect((await getVault(UID)).completed).toBe(false);
    prior({ ...AYSE_CORE }, null);
    expect((await getVault(UID)).completed).toBe(false);
    prior(null, null);
    expect((await getVault(UID)).completed).toBe(false);
  });
});

describe("deleteVault / forgetAnswer", () => {
  beforeEach(() => { h.on = true; });
  it("deletes the vault and every pack", async () => {
    prior({ ...AYSE_CORE }, "x");
    db.insert(autopilotPacks).values({ user_id: UID, job_id: seedJob().id, form: {} }).run();
    expect(await deleteVault()).toEqual({ ok: true });
    expect(row()).toBeUndefined();
    expect(db.select().from(autopilotPacks).all()).toEqual([]);
  });
  it("forgets one remembered answer and keeps the rest", async () => {
    prior({ ...AYSE_CORE }, "x");
    db.update(autopilotVault).set({ extra: sealVault("extra", UID, { a: "1", b: "2" }) }).run();
    expect(await forgetAnswer("a")).toEqual({ ok: true });
    expect(openVault("extra", UID, row()?.extra)).toEqual({ b: "2" });
  });
});

describe("env.autopilot guard", () => {
  it("saveVault and deleteVault refuse and touch nothing while the feature is off", async () => {
    h.on = false; prior(null, null);
    expect(await saveVault(null, fd(AYSE_CORE as unknown as Record<string, string>))).toMatchObject({ ok: false, unlocked: false });
    expect(await deleteVault()).toMatchObject({ ok: false });
    expect(row()).toBeUndefined();
    expect(h.award).not.toHaveBeenCalled();
  });
});
