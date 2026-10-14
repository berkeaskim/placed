import { describe, it, expect } from "vitest";
import { mintToken, hashToken, corsHeaders } from "@/lib/autopilot/handoff";

describe("handoff", () => {
  it("mints url-safe single tokens with a matching hash and 10-minute expiry", () => {
    const a = mintToken(), b = mintToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(hashToken(a.token)).toBe(a.hash);
    const mins = (Date.parse(a.expiresAt) - Date.now()) / 60000;
    expect(mins).toBeGreaterThan(9.9); expect(mins).toBeLessThanOrEqual(10);
  });
  it("allows only ATS origins", () => {
    expect(corsHeaders("https://job-boards.greenhouse.io")["access-control-allow-origin"]).toBe("https://job-boards.greenhouse.io");
    expect(corsHeaders("https://evil.example")["access-control-allow-origin"]).toBeUndefined();
  });
});
