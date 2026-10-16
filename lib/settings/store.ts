// TEMP STUB: replaced by foundation
/** In-memory stand-in for the SQLite-backed settings store (same synchronous signatures). */
const settings = new Map<string, string>();
const secrets = new Map<string, string>();

export function getSetting(key: string): string | null {
  return settings.get(key) ?? null;
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) settings.delete(key);
  else settings.set(key, value);
}

export function getSecret(key: string): string | null {
  return secrets.get(key) ?? null;
}

export function setSecret(key: string, value: string | null): void {
  if (value === null) secrets.delete(key);
  else secrets.set(key, value);
}
