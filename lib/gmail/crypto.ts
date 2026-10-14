import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** GMAIL_TOKEN_KEY: 32 random bytes, base64 (`openssl rand -base64 32`). */
function key(keyB64 = process.env.GMAIL_TOKEN_KEY ?? ""): Buffer {
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32) throw new Error("GMAIL_TOKEN_KEY must be 32 bytes, base64-encoded");
  return k;
}

/** AES-256-GCM. Format: v1.<iv>.<tag>.<ciphertext>, each base64url. */
export function encryptToken(plain: string, keyB64?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(keyB64), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptToken(enc: string, keyB64?: string): string {
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised token format");
  const d = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
