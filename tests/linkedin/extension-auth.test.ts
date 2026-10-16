import { describe, expect, it } from "vitest";
import { isLoopbackRequest, verifyExtensionRequest } from "@/lib/extension-auth";
import { setSecret } from "@/lib/settings/store";
import { withTempDb } from "../gamify/temp-db";

withTempDb(() => setSecret("extension.token", null));
const EXT = `chrome-extension://${"b".repeat(32)}`;
const req = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers });

describe("verifyExtensionRequest", () => {
  it("accepts the extension origin and same-origin on a loopback host", () => {
    expect(verifyExtensionRequest(req("http://localhost:3000/x", { host: "localhost:3000", origin: EXT }))).toBe(true);
    expect(verifyExtensionRequest(req("http://127.0.0.1:3000/x", { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }))).toBe(true);
  });
  it("refuses other origins, a missing origin, and non-loopback hosts (DNS rebinding)", () => {
    expect(verifyExtensionRequest(req("http://localhost:3000/x", { host: "localhost:3000", origin: "https://evil.example" }))).toBe(false);
    expect(verifyExtensionRequest(req("http://localhost:3000/x", { host: "localhost:3000" }))).toBe(false);
    expect(verifyExtensionRequest(req("http://localhost:3000/x", { host: "evil.example:3000", origin: EXT }))).toBe(false);
    expect(isLoopbackRequest(req("http://placed.example/x", { host: "placed.example" }))).toBe(false);
  });
  it("accepts a matching Bearer token from anywhere once one is set", () => {
    const remote = (auth?: string) => req("http://placed.example/x", { host: "placed.example", ...(auth ? { authorization: auth } : {}) });
    expect(verifyExtensionRequest(remote("Bearer s3cret-token"))).toBe(false);
    setSecret("extension.token", "s3cret-token");
    expect(verifyExtensionRequest(remote("Bearer s3cret-token"))).toBe(true);
    expect(verifyExtensionRequest(remote("Bearer wrong"))).toBe(false);
    expect(verifyExtensionRequest(remote())).toBe(false);
  });
});
