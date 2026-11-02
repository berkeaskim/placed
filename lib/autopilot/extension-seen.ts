import "server-only";
import { getSetting, setSetting } from "@/lib/settings/store";

// The browser extension can't stamp the Mac app's own window (that's Electron, not Chrome), so its service worker
// also reports in to the local server: on install, on Chrome start-up and every 30 minutes.

const KEY = "extension.lastSeen";
/** A report older than this means the extension was probably removed (Chrome closed for a week counts too). */
export const SEEN_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const VERSION = /^\d{1,5}(\.\d{1,5}){0,3}$/;

export type ExtensionSeen = { version: string; at: string };

export function isExtensionVersion(v: unknown): v is string {
  return typeof v === "string" && VERSION.test(v);
}

export function recordExtensionSeen(version: string, now = new Date()): void {
  setSetting(KEY, JSON.stringify({ version, at: now.toISOString() } satisfies ExtensionSeen));
}

/** The last report, or null when there is none or it is older than SEEN_FOR_MS. */
export function lastExtensionSeen(now = Date.now()): ExtensionSeen | null {
  try {
    const v = JSON.parse(getSetting(KEY) ?? "null") as Partial<ExtensionSeen> | null;
    if (!v || !isExtensionVersion(v.version) || typeof v.at !== "string") return null;
    const at = Date.parse(v.at);
    return Number.isFinite(at) && now - at < SEEN_FOR_MS ? { version: v.version, at: v.at } : null;
  } catch {
    return null;
  }
}
