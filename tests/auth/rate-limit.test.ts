import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));
import { allow, clientIp, limitKey, LIMITS, resetRateLimitsForTests } from "@/lib/auth/rate-limit";

describe("rate limit", () => {
  beforeEach(() => resetRateLimitsForTests());
  it("takes the client from the first forwarded hop", async () => {
    expect(await clientIp()).toBe("203.0.113.7");
  });
  it("stores only a hash of the email, case-insensitively", () => {
    const k = limitKey("loginEmail", "Ayse@Example.com");
    expect(k).toMatch(/^loginEmail:[0-9a-f]{64}$/);
    expect(k).not.toContain("ayse");
    expect(k).toBe(limitKey("loginEmail", "ayse@example.com"));
  });
  it("allows max attempts per window, refuses the next, and frees up once the window slides", async () => {
    const { max, windowSeconds } = LIMITS.loginEmail;
    const t0 = 1_000_000;
    for (let i = 0; i < max; i++) expect(await allow("loginEmail", "a@b.com", t0 + i)).toBe(true);
    expect(await allow("loginEmail", "a@b.com", t0 + max)).toBe(false);
    expect(await allow("loginEmail", "other@b.com", t0 + max)).toBe(true);
    expect(await allow("loginIp", "a@b.com", t0 + max)).toBe(true);
    expect(await allow("loginEmail", "a@b.com", t0 + max + windowSeconds * 1000)).toBe(true);
  });
});
