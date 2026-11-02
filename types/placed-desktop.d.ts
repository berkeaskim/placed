/** The bridge desktop/src/preload.ts exposes inside the Mac app. Absent in a normal browser. */
export {};

declare global {
  interface PlacedDesktopUpdateResult {
    status: "current" | "available" | "skipped" | "error";
    latest?: { version: string; url: string; publishedAt: string };
  }

  /** Mirrors LoginItemResult in desktop/src/lib/login-item.ts. */
  interface PlacedDesktopLoginItemResult {
    openAtLogin: boolean;
    /** macOS 13+: the user must approve Placed in System Settings → General → Login Items. */
    needsApproval: boolean;
  }

  interface PlacedDesktop {
    version: string;
    platform: string;
    dataDir: string;
    getOpenAtLogin(): Promise<boolean>;
    setOpenAtLogin(openAtLogin: boolean): Promise<PlacedDesktopLoginItemResult>;
    checkForUpdates(): Promise<PlacedDesktopUpdateResult>;
    /** Resolves to "" on success, otherwise an error message. */
    openPath(path: string): Promise<string>;
  }

  interface Window {
    placedDesktop?: PlacedDesktop;
  }
}
