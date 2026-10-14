import { afterEach, describe, expect, it, vi } from "vitest";
import { GMAIL_SCOPE, consentUrl, refreshAccessToken, statesMatch } from "@/lib/gmail/oauth";
import { GmailAuthError } from "@/lib/gmail/search";

describe("consentUrl", () => {
  it("asks for read-only Gmail, offline access and forced consent", () => {
    const u = new URL(consentUrl({ clientId: "cid", redirectUri: "http://localhost:3200/api/gmail/callback", state: "s1" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("s1");
    expect(u.searchParams.get("response_type")).toBe("code");
  });
});

describe("statesMatch", () => {
  it("needs a non-empty, identical state", () => {
    expect(statesMatch("abc", "abc")).toBe(true);
    expect(statesMatch("abc", "abd")).toBe(false);
    expect(statesMatch(undefined, "abc")).toBe(false);
    expect(statesMatch("", "")).toBe(false);
    expect(statesMatch("abc", null)).toBe(false);
  });
  it("returns false (never throws) for same-length strings with different byte lengths", () => {
    expect(() => statesMatch("abé", "abc")).not.toThrow();
    expect(statesMatch("abé", "abc")).toBe(false);
    expect(statesMatch("abé", "abé")).toBe(true);
  });
});

describe("refreshAccessToken", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("treats invalid_grant as disconnected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })));
    await expect(refreshAccessToken("rt")).rejects.toBeInstanceOf(GmailAuthError);
  });
  it("returns the access token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ access_token: "at" }), { status: 200 })));
    await expect(refreshAccessToken("rt")).resolves.toBe("at");
  });
});
