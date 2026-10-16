import { eq } from "drizzle-orm";
import { openText, sealText } from "../autopilot/vault-crypto";
import { db } from "../db/client";
import { appSettings } from "../db/schema";
import { localSecretKey } from "./secret-key";

/** Plain settings over `app_settings`. Synchronous (better-sqlite3). */
export function getSetting(key: string): string | null {
  return db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).get()?.value ?? null;
}

/** null deletes the setting. */
export function setSetting(key: string, value: string | null): void {
  if (value === null) {
    db.delete(appSettings).where(eq(appSettings.key, key)).run();
    return;
  }
  const updated_at = new Date().toISOString();
  db.insert(appSettings).values({ key, value, updated_at })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at } }).run();
}

/** Secrets (API keys) are stored as `secret.<key>`, AES-256-GCM sealed with data/secret.key (never VAULT_ENC_KEY). */
const secretRow = (key: string) => `secret.${key}`;
const secretAad = (key: string) => `app_settings/${key}`;

export function getSecret(key: string): string | null {
  const sealed = getSetting(secretRow(key));
  return sealed === null ? null : openText(sealed, secretAad(key), localSecretKey());
}

export function setSecret(key: string, value: string | null): void {
  setSetting(secretRow(key), value === null ? null : sealText(value, secretAad(key), localSecretKey()));
}
