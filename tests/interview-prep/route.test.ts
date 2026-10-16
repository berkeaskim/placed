import { describe, it, expect, vi, beforeEach } from "vitest";

let user: { id: string } | null = null;
const getInterviewPrep = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
vi.mock("@/app/(app)/jobs/[id]/prep-actions", () => ({ getInterviewPrep: (id: string) => getInterviewPrep(id) }));

const route = await import("@/app/api/interview-prep/[jobId]/route");
const call = (id: string) => route.POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ jobId: id }) });

describe("POST /api/interview-prep/[jobId]", () => {
  beforeEach(() => { getInterviewPrep.mockReset(); });

  it("401s without a session and never builds a pack", async () => {
    user = null;
    const res = await call("j1");
    expect(res.status).toBe(401);
    expect(getInterviewPrep).not.toHaveBeenCalled();
  });

  it("returns the prep result, uncached by the browser", async () => {
    user = { id: "u1" };
    getInterviewPrep.mockResolvedValue({ error: "Mark this role as applied to unlock interview prep." });
    const res = await call("j1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: "Mark this role as applied to unlock interview prep." });
    expect(getInterviewPrep).toHaveBeenCalledWith("j1");
  });

  it("has no GET, so a prefetch can never trigger a paid generation, and allows 300 s", () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
    expect(route.maxDuration).toBe(300);
  });
});
