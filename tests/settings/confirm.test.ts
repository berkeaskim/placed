import { describe, it, expect, vi, beforeEach } from "vitest";
import { isDeleteConfirmed } from "@/lib/settings/confirm";

describe("isDeleteConfirmed", () => {
  it("accepts DELETE and trimmed DELETE", () => {
    expect(isDeleteConfirmed("DELETE")).toBe(true);
    expect(isDeleteConfirmed(" DELETE ")).toBe(true);
  });
  it.each(["delete", "Delete", "DELETE!", "DELETE ME", "", "  ", null, undefined, 1, {}])("rejects %j", (v) => {
    expect(isDeleteConfirmed(v)).toBe(false);
  });
});

const requireUser = vi.fn();
const resetUserData = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("@/lib/supabase/server", () => ({ requireUser: () => requireUser() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const dropConnection = vi.fn();
vi.mock("@/lib/gmail/connection", () => ({ dropConnection: (...a: unknown[]) => dropConnection(...a) }));
vi.mock("@/lib/db/reset", () => ({ resetUserData: (...a: unknown[]) => resetUserData(...a) }));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => (redirect as (...x: unknown[]) => never)(...a) }));

function fd(confirm?: string) {
  const f = new FormData();
  if (confirm !== undefined) f.set("confirm", confirm);
  return f;
}

describe("deleteMyData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: { id: "u1" } });
    resetUserData.mockResolvedValue(undefined);
    dropConnection.mockResolvedValue(undefined);
  });

  it("returns an error and deletes nothing when unconfirmed", async () => {
    const { deleteMyData } = await import("@/app/(app)/settings/actions");
    for (const f of [fd("delete"), fd(""), fd()]) {
      expect(await deleteMyData(null, f)).toEqual({ error: "Type DELETE to confirm." });
    }
    expect(resetUserData).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns a friendly error when reset throws", async () => {
    resetUserData.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deleteMyData } = await import("@/app/(app)/settings/actions");
    expect(await deleteMyData(null, fd("DELETE"))).toEqual({ error: "We couldn't delete everything — please try again." });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("resets for the session user and redirects when confirmed", async () => {
    const { deleteMyData } = await import("@/app/(app)/settings/actions");
    await expect(deleteMyData(null, fd(" DELETE "))).rejects.toThrow("NEXT_REDIRECT");
    expect(dropConnection).toHaveBeenCalledWith({}, "u1", true);
    expect(resetUserData).toHaveBeenCalledWith({}, "u1");
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });
});
