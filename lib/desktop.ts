export const DESKTOP_PORT = 3917;
/** True inside the Mac app: the Electron shell sets PLACED_DESKTOP=1 on the server it spawns. */
export const isDesktop = (env: Record<string, string | undefined> = process.env) => env.PLACED_DESKTOP === "1";

/** The note under "Open Placed at login" after a change, or null when macOS applied it. Pure. */
export function loginChangeMessage(wanted: boolean, result: { openAtLogin: boolean; needsApproval: boolean }): string | null {
  if (wanted && result.needsApproval) return "Approve Placed in System Settings → General → Login Items.";
  if (result.openAtLogin !== wanted) return "macOS didn't accept that change.";
  return null;
}
