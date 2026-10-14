import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { update?: unknown; eq: [string, unknown][] } = { eq: [] };
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "user-1", email: "a@ucl.ac.uk" } }) }));
vi.mock("@/app/(app)/tracker/actions", () => ({ updateStatus: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const q = { eq: (col: string, v: unknown) => { calls.eq.push([col, v]); return q; }, then: (r: (x: { error: null }) => void) => r({ error: null }) };
    return { from: () => ({ update: (u: unknown) => { calls.update = u; return q; } }) };
  },
}));

const { dismissInboxSuggestion } = await import("@/app/(app)/tracker/inbox-actions");
const ID = "0b6f2b1e-3c1a-4c55-9d7e-2f7a1c9b8e01";

describe("dismissInboxSuggestion", () => {
  beforeEach(() => { calls.update = undefined; calls.eq = []; revalidatePath.mockClear(); });

  it("sets a suggested event of this user to none and revalidates the tracker", async () => {
    expect(await dismissInboxSuggestion(ID)).toEqual({ ok: true });
    expect(calls.update).toEqual({ effect: "none" });
    expect(calls.eq).toEqual([["id", ID], ["user_id", "user-1"], ["effect", "suggested"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/tracker");
  });

  it("rejects a non-uuid without touching the database", async () => {
    expect(await dismissInboxSuggestion("1; drop table")).toEqual({ ok: false });
    expect(calls.update).toBeUndefined();
  });
});
