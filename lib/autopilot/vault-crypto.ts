import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { localSecretKey } from "../settings/secret-key";

/**
 * At-rest encryption for autopilot_vault.core / .extra (email, phone, right-to-work, remembered answers).
 * Stored in the json columns as { "$enc": "v1.<iv>.<tag>.<ciphertext>" } (AES-256-GCM, base64url parts).
 * The AAD binds each ciphertext to its column and user, so a row copied onto another user (or core pasted into extra)
 * fails to decrypt. Plain objects (legacy rows) are read as-is. Not "server-only": scripts use this too.
 */
export type VaultColumn = "core" | "extra";
export type Sealed = { $enc: string };

/** Key: explicit arg → VAULT_ENC_KEY env (32 bytes base64) → the local `data/secret.key`. */
function key(keyB64 = process.env.VAULT_ENC_KEY): Buffer {
  if (!keyB64) return localSecretKey();
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32) throw new Error("VAULT_ENC_KEY must be 32 bytes, base64-encoded");
  return k;
}

/** AES-256-GCM over a string, bound to `aad`. Returns "v1.<iv>.<tag>.<ct>" (base64url parts). */
export function sealText(plain: string, aad: string, keyB64?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(keyB64), iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Inverse of sealText. Throws on tampering, a wrong key or a different `aad`. */
export function openText(sealed: string, aad: string, keyB64?: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised ciphertext format");
  const d = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

const aad = (column: VaultColumn, userId: string) => `autopilot_vault/${column}/${userId}`;

export function isSealed(v: unknown): v is Sealed {
  return typeof v === "object" && v !== null && typeof (v as Sealed).$enc === "string";
}

export function sealVault(column: VaultColumn, userId: string, value: Record<string, unknown>, keyB64?: string): Sealed {
  return { $enc: sealText(JSON.stringify(value), aad(column, userId), keyB64) };
}

/** Decrypts a sealed value; a legacy plaintext object passes through; null/undefined becomes {}. Throws on tampering or a wrong key. */
export function openVault(column: VaultColumn, userId: string, stored: unknown, keyB64?: string): Record<string, unknown> {
  if (stored == null) return {};
  if (!isSealed(stored)) return stored as Record<string, unknown>;
  return JSON.parse(openText(stored.$enc, aad(column, userId), keyB64));
}
