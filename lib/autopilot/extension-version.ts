// The Autopilot extension version this build ships (public/placed-autopilot.zip is packed from extension/), read from
// the manifest at build time, and the copy for an installed extension that is older than that.
import manifest from "@/extension/manifest.json";

export const SHIPPED_EXTENSION_VERSION: string = manifest.version;

export type ExtensionStatus = "missing" | "outdated" | "installed";

/** Chrome extension versions are 1-4 dot-separated integers; anything else counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** installed: the data-placed-autopilot stamp hello.js puts on <html>, or null when there is none. */
export function extensionStatus(installed: string | null, shipped: string = SHIPPED_EXTENSION_VERSION): ExtensionStatus {
  if (installed == null) return "missing";
  return compareVersions(installed || "0", shipped) < 0 ? "outdated" : "installed";
}

export function outdatedNotice(installed: string, shipped: string = SHIPPED_EXTENSION_VERSION): string {
  return `Your Placed extension is out of date (${installed || "unknown"} → ${shipped}). Download the new version`;
}
