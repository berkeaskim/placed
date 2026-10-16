import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AYSE_VAULT_CORE, seedAyseVault } from "@/lib/demo/autopilot-persona";
import { CoreSchema, isComplete } from "@/lib/autopilot/vault";
import { isSealed, openVault } from "@/lib/autopilot/vault-crypto";

const fake = (error: { message: string } | null = null) => {
  const calls: { table: string; row: Record<string, unknown>; opts: unknown }[] = [];
  const db = { from: (table: string) => ({ upsert: async (row: Record<string, unknown>, opts: unknown) => { calls.push({ table, row, opts }); return { error }; } }) };
  return { db: db as unknown as SupabaseClient, calls };
};

describe("seedAyseVault", () => {
  it("is a complete core with her own RTW and sponsorship answers", () => {
    expect(isComplete(AYSE_VAULT_CORE)).toBe(true);
    expect(CoreSchema.parse(AYSE_VAULT_CORE)).toMatchObject({ rtw_uk: "citizen_or_settled", needs_sponsorship: "no" });
    expect(JSON.stringify(AYSE_VAULT_CORE)).not.toMatch(/gender|ethnic/i);
  });
  it("upserts one row keyed by user with completed_at set (no XP on stage), twice without error", async () => {
    const { db, calls } = fake();
    await seedAyseVault(db, "u1", new Date("2026-10-15T09:00:00Z"));
    await seedAyseVault(db, "u1", new Date("2026-10-15T09:00:00Z"));
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ table: "autopilot_vault", opts: { onConflict: "user_id" }, row: { user_id: "u1", completed_at: "2026-10-15T09:00:00.000Z" } });
    expect(isSealed(calls[0].row.core)).toBe(true);
    expect(JSON.stringify(calls[0].row)).not.toContain(AYSE_VAULT_CORE.email);
    expect(openVault("core", "u1", calls[0].row.core)).toEqual(openVault("core", "u1", calls[1].row.core));
  });
  it("surfaces a database error", async () => {
    await expect(seedAyseVault(fake({ message: "boom" }).db, "u1")).rejects.toThrow(/boom/);
  });
});
