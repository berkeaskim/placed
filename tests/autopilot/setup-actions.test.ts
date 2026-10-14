import { describe, it, expect, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({ upserts: [] as unknown[], award: vi.fn(async () => ({ xpGained: 50 })), completed: null as string | null }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "u1", email: "ayse@example.com" } }) }));
vi.mock("@/lib/gamify/award", () => ({ awardXP: h.award }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.completed ? { completed_at: h.completed } : null }) }) }),
    upsert: async (row: unknown) => { h.upserts.push(row); return { error: null }; },
  }),
}) }));
import { saveVault } from "@/app/(app)/autopilot/setup/actions";
import { AYSE_CORE } from "./fixtures";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe("saveVault", () => {
  beforeEach(() => { h.upserts.length = 0; h.award.mockClear(); h.completed = null; });
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
    expect(JSON.stringify(h.upserts[0])).not.toMatch(/gender|ethnicity/);
  });
});
