import { describe, expect, it, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({ calls: [] as { fn: string; args: Record<string, unknown> }[], result: { data: true as boolean | null, error: null as { message: string } | null } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: async (fn: string, args: Record<string, unknown>) => { h.calls.push({ fn, args }); return h.result; } }) }));
import { allow, clientIp, limitKey, LIMITS } from "@/lib/auth/rate-limit";

describe("rate limit", () => {
  beforeEach(() => { h.calls.length = 0; h.result = { data: true, error: null }; });
  it("takes the client from the first forwarded hop", async () => {
    expect(await clientIp()).toBe("203.0.113.7");
  });
  it("stores only a hash of the email, case-insensitively", () => {
    const k = limitKey("loginEmail", "Ayse@Example.com");
    expect(k).toMatch(/^loginEmail:[0-9a-f]{64}$/);
    expect(k).not.toContain("ayse");
    expect(k).toBe(limitKey("loginEmail", "ayse@example.com"));
  });
  it("passes the configured window to hit_rate_limit and honours a refusal", async () => {
    expect(await allow("loginEmail", "a@b.com")).toBe(true);
    expect(h.calls[0]).toMatchObject({ fn: "hit_rate_limit", args: { p_max: LIMITS.loginEmail.max, p_window_seconds: LIMITS.loginEmail.windowSeconds } });
    h.result = { data: false, error: null };
    expect(await allow("loginEmail", "a@b.com")).toBe(false);
  });
  it("fails open when the function is missing (migration not applied)", async () => {
    h.result = { data: null, error: { message: "function public.hit_rate_limit does not exist" } };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await allow("saveIp", "1.2.3.4")).toBe(true);
  });
});
