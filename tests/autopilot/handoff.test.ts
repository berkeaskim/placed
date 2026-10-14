import { describe, it, expect } from "vitest";
import { mintToken, hashToken, corsHeaders, safeNamePart } from "@/lib/autopilot/handoff";

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
  it("allows Chrome extension origins (R8: the extension service worker claims), nothing look-alike", () => {
    const ext = "chrome-extension://" + "abcdefghijklmnopabcdefghijklmnop";
    expect(corsHeaders(ext)["access-control-allow-origin"]).toBe(ext);
    expect(corsHeaders("chrome-extension://abc")["access-control-allow-origin"]).toBeUndefined();
    expect(corsHeaders("chrome-extension://" + "q".repeat(32))["access-control-allow-origin"]).toBeUndefined();
    expect(corsHeaders(ext + ".evil.example")["access-control-allow-origin"]).toBeUndefined();
    expect(corsHeaders("moz-extension://" + "a".repeat(32))["access-control-allow-origin"]).toBeUndefined();
  });
  it("always varies on Origin", () => {
    expect(corsHeaders("https://evil.example").vary).toBe("Origin");
    expect(corsHeaders(null).vary).toBe("Origin");
  });
  it("sanitises name parts", () => {
    expect(safeNamePart("Ayşe", "x")).toBe("Ayşe");
    expect(safeNamePart("Jean-Luc", "x")).toBe("Jean-Luc");
    expect(safeNamePart("O'Brien", "x")).toBe("O'Brien");
    expect(safeNamePart("van  der/Berg", "x")).toBe("van-der-Berg");
    expect(safeNamePart("../..", "CV")).toBe("CV");
    expect(safeNamePart(undefined, "My")).toBe("My");
  });
});
