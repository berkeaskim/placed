import { dialog, shell, type BrowserWindow, type MessageBoxOptions } from "electron";
import { readDesktopSettings, updateDesktopSettings } from "./settings-store";
import { checkForUpdates, createReleaseSource, type UpdateCheckResult } from "./updates";

export interface UpdatePromptOptions {
  current: string;
  userData: string;
  getWindow: () => BrowserWindow | null;
  log: (line: string) => void;
}

const FIRST_CHECK_MS = 15_000;
const EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * The one update check behind the menu item, the Settings button and the background timer.
 * Background checks are silent unless a new, unskipped version exists; manual checks always answer
 * (and ignore a skipped version, since the user asked).
 */
export function createUpdateChecker({ current, userData, getWindow, log }: UpdatePromptOptions) {
  let dialogOpen = false;
  const source = createReleaseSource(globalThis.fetch, current);

  const show = async (options: MessageBoxOptions) => {
    const win = getWindow();
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
  };

  // Dialogs are fire-and-forget so the Settings button gets its inline result straight away.
  const prompt = async (result: UpdateCheckResult, manual: boolean) => {
    if (dialogOpen) return;
    dialogOpen = true;
    try {
      if (result.status === "available" && result.latest) {
        const { latest } = result;
        const { response } = await show({
          type: "info",
          message: `Placed ${latest.version} is available (you have ${current}).`,
          buttons: ["Download", "Later", "Skip this version"],
          defaultId: 0,
          cancelId: 1,
        });
        if (response === 0) await shell.openExternal(latest.url);
        if (response === 2) updateDesktopSettings(userData, { skippedVersion: latest.version });
      } else if (manual && result.status === "current") {
        await show({ type: "info", message: `You're up to date (${current})` });
      } else if (manual && result.status === "error") {
        await show({ type: "warning", message: "Couldn't check for updates (offline?)" });
      }
    } finally {
      dialogOpen = false;
    }
  };

  /**
   * Always resolves with the status, even when a dialog is already open (then no second dialog is shown, but the
   * Settings button still gets its inline result).
   */
  async function check(manual: boolean): Promise<UpdateCheckResult> {
    const skipped = manual ? undefined : readDesktopSettings(userData).skippedVersion;
    const result = await checkForUpdates({ current, skipped, source });
    log(`update check (${manual ? "manual" : "background"}): ${result.status}${result.latest ? ` ${result.latest.version}` : ""}`);
    void prompt(result, manual).catch((err: unknown) => log(`update dialog failed: ${String(err)}`));
    return result;
  }

  const background = () => {
    check(false).catch((err: unknown) => log(`update check failed: ${String(err)}`));
  };

  let first: NodeJS.Timeout | null = null;
  let daily: NodeJS.Timeout | null = null;
  let scheduled = false;
  /** First background check 15 s after the window shows, then every 24 h. Never blocks startup or quitting. */
  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    first = setTimeout(() => {
      first = null;
      background();
      daily = setInterval(background, EVERY_MS);
      daily.unref();
    }, FIRST_CHECK_MS);
    first.unref();
  }

  function stop(): void {
    if (first) clearTimeout(first);
    if (daily) clearInterval(daily);
    first = daily = null;
  }

  return { check, schedule, stop };
}
