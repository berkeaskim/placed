/** What the settings page needs after a login-item change. */
export interface LoginItemResult {
  openAtLogin: boolean;
  /** macOS 13+ registered the item but the user must approve it in System Settings → General → Login Items. */
  needsApproval: boolean;
}

/** Map app.getLoginItemSettings() (status is macOS 13+ only) to the IPC result. Pure. */
export function toLoginItemResult(settings: { openAtLogin: boolean; status?: string }): LoginItemResult {
  return { openAtLogin: settings.openAtLogin, needsApproval: settings.status === "requires-approval" };
}
