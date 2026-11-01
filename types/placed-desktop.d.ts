/** The bridge desktop/src/preload.ts exposes inside the Mac app. Absent in a normal browser. */
export {};

declare global {
  interface PlacedDesktopUpdateResult {
    status: "current" | "available" | "skipped" | "error";
    latest?: { version: string; url: string; publishedAt: string };
  }

  interface PlacedDesktop {
    version: string;
    platform: string;
    dataDir: string;
    getOpenAtLogin(): Promise<boolean>;
    setOpenAtLogin(openAtLogin: boolean): Promise<boolean>;
    checkForUpdates(): Promise<PlacedDesktopUpdateResult>;
    /** Resolves to "" on success, otherwise an error message. */
    openPath(path: string): Promise<string>;
  }

  interface Window {
    placedDesktop?: PlacedDesktop;
  }
}
