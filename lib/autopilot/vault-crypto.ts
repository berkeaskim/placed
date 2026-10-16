import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * At-rest encryption for autopilot_vault.core / .extra (email, phone, right-to-work, remembered answers).
 * Stored in the existing jsonb columns as { "$enc": "v1.<iv>.<tag>.<ciphertext>" } (AES-256-GCM, base64url parts).
 * The AAD binds each ciphertext to its column and user, so a row copied onto another user (or core pasted into extra)
 * fails to decrypt. Rows written before encryption are plain objects and are read as-is until scripts/encrypt-vault.ts
 * rewrites them. Not "server-only": scripts/reset-demo.ts seeds the vault through this too.
 */
export type VaultColumn = "core" | "extra";
export type Sealed = { $enc: string };

/** VAULT_ENC_KEY: 32 random bytes, base64 (`openssl rand -base64 32`). */
function key(keyB64 = process.env.VAULT_ENC_KEY ?? ""): Buffer {
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32) throw new Error("VAULT_ENC_KEY must be 32 bytes, base64-encoded");
  return k;
}

const aad = (column: VaultColumn, userId: string) => Buffer.from(`autopilot_vault/${column}/${userId}`, "utf8");

export function isSealed(v: unknown): v is Sealed {
  return typeof v === "object" && v !== null && typeof (v as Sealed).$enc === "string";
}

export function sealVault(column: VaultColumn, userId: string, value: Record<string, unknown>, keyB64?: string): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(keyB64), iv);
  c.setAAD(aad(column, userId));
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return { $enc: ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".") };
}

/** Decrypts a sealed value; a legacy plaintext object passes through; null/undefined becomes {}. Throws on tampering or a wrong key. */
export function openVault(column: VaultColumn, userId: string, stored: unknown, keyB64?: string): Record<string, unknown> {
  if (stored == null) return {};
  if (!isSealed(stored)) return stored as Record<string, unknown>;
  const [v, iv, tag, ct] = stored.$enc.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised vault ciphertext format");
  const d = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  d.setAAD(aad(column, userId));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8"));
}
