import { relative, resolve, isAbsolute } from "node:path";

/** Mirrors DESKTOP_PORT in lib/desktop.ts (the shell cannot import app code; a test keeps them equal). */
export const APP_PORT = 3917;
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
export const APP_URL = `${APP_ORIGIN}/`;

/** Only the app's own origin stays in a Placed window. Pure. */
export function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

/** Links handed to the default browser/mail app: never file:, custom schemes or javascript:. Pure. */
export function canOpenExternally(url: string): boolean {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** True when `path` is `parent` or inside it (after resolving `..`). Pure. */
export function isInside(parent: string, path: string): boolean {
  const rel = relative(resolve(parent), resolve(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
