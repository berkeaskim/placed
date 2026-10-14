import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/gmail/crypto";

const key = randomBytes(32).toString("base64");

describe("refresh token encryption", () => {
  it("round-trips and never contains the plaintext", () => {
    const enc = encryptToken("1//refresh-token", key);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("refresh-token");
    expect(decryptToken(enc, key)).toBe("1//refresh-token");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });
  it("rejects tampered ciphertext and the wrong key", () => {
    const enc = encryptToken("secret", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => decryptToken(enc, randomBytes(32).toString("base64"))).toThrow();
  });
  it("refuses a key that is not 32 bytes", () => {
    expect(() => encryptToken("x", Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});
