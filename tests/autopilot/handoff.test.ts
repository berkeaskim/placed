import { describe, it, expect, afterEach } from "vitest";
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
  it("does NOT allow ATS page origins (R9: page scripts must not be able to claim a leftover #placed token)", () => {
    for (const o of ["https://job-boards.greenhouse.io", "https://boards.greenhouse.io", "https://jobs.ashbyhq.com", "https://jobs.lever.co", "https://evil.example"])
      expect(corsHeaders(o)["access-control-allow-origin"]).toBeUndefined();
  });
  describe("PLACED_EXTENSION_ID", () => {
    const prev = process.env.PLACED_EXTENSION_ID;
    afterEach(() => { if (prev === undefined) delete process.env.PLACED_EXTENSION_ID; else process.env.PLACED_EXTENSION_ID = prev; });
    it("pins the exact extension id when set", () => {
      const id = "abcdefghijklmnopabcdefghijklmnop", other = "ponmlkjihgfedcbaponmlkjihgfedcba";
      process.env.PLACED_EXTENSION_ID = id;
      expect(corsHeaders(`chrome-extension://${id}`)["access-control-allow-origin"]).toBe(`chrome-extension://${id}`);
      expect(corsHeaders(`chrome-extension://${other}`)["access-control-allow-origin"]).toBeUndefined();
      expect(corsHeaders("https://jobs.lever.co")["access-control-allow-origin"]).toBeUndefined();
    });
    it("accepts any well-formed extension id when unset", () => {
      delete process.env.PLACED_EXTENSION_ID;
      expect(corsHeaders("chrome-extension://" + "p".repeat(32))["access-control-allow-origin"]).toBeDefined();
    });
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
