import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isSealed, openVault, sealVault } from "@/lib/autopilot/vault-crypto";

const key = randomBytes(32).toString("base64");
const core = { email: "ayse.demir.demo@example.com", phone: "+44 7700 900123", rtw_uk: "citizen_or_settled" };

describe("vault encryption", () => {
  it("round-trips and never contains the plaintext", () => {
    const s = sealVault("core", "u1", core, key);
    expect(isSealed(s)).toBe(true);
    expect(s.$enc.startsWith("v1.")).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/ayse|7700|citizen/);
    expect(openVault("core", "u1", s, key)).toEqual(core);
  });
  it("uses a fresh IV each time", () => {
    expect(sealVault("core", "u1", core, key).$enc).not.toBe(sealVault("core", "u1", core, key).$enc);
  });
  it("is bound to its user and column", () => {
    const s = sealVault("core", "u1", core, key);
    expect(() => openVault("core", "u2", s, key)).toThrow();
    expect(() => openVault("extra", "u1", s, key)).toThrow();
  });
  it("rejects tampered ciphertext and the wrong key", () => {
    const parts = sealVault("core", "u1", core, key).$enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => openVault("core", "u1", { $enc: parts.join(".") }, key)).toThrow();
    expect(() => openVault("core", "u1", sealVault("core", "u1", core, key), randomBytes(32).toString("base64"))).toThrow();
  });
  it("reads legacy plaintext rows and empty rows as-is", () => {
    expect(openVault("core", "u1", core, key)).toEqual(core);
    expect(openVault("extra", "u1", null, key)).toEqual({});
  });
  it("refuses a key that is not 32 bytes", () => {
    expect(() => sealVault("core", "u1", core, Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});
