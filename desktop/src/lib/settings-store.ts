import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Shell-only preferences in `<userData>/desktop.json` (the app's own settings live in its SQLite database). */
export interface DesktopSettings {
  skippedVersion?: string;
}

const fileIn = (userData: string) => join(userData, "desktop.json");

export function readDesktopSettings(userData: string): DesktopSettings {
  try {
    const parsed: unknown = JSON.parse(readFileSync(fileIn(userData), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as DesktopSettings) : {};
  } catch {
    return {};
  }
}

export function updateDesktopSettings(userData: string, patch: Partial<DesktopSettings>): DesktopSettings {
  const next = { ...readDesktopSettings(userData), ...patch };
  mkdirSync(userData, { recursive: true });
  const tmp = `${fileIn(userData)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, fileIn(userData));
  return next;
}
