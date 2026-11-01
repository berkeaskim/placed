import { app, ipcMain, shell, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import type { UpdateCheckResult } from "./updates";
import { isAppUrl, isOpenableFolder } from "./urls";

export interface IpcOptions {
  dataDir: string;
  logsDir: string;
  checkForUpdates: () => Promise<UpdateCheckResult>;
}

/** Channel names shared with preload.ts. */
export const CHANNELS = {
  info: "placed:info",
  getOpenAtLogin: "placed:getOpenAtLogin",
  setOpenAtLogin: "placed:setOpenAtLogin",
  checkForUpdates: "placed:checkForUpdates",
  openPath: "placed:openPath",
} as const;

/** Only pages served by the local Placed server may use the bridge. */
const fromApp = (event: IpcMainEvent | IpcMainInvokeEvent) => isAppUrl(event.senderFrame?.url ?? "");

function guard<A extends unknown[], R>(handler: (...args: A) => R) {
  return (event: IpcMainInvokeEvent, ...args: A): R => {
    if (!fromApp(event)) throw new Error("placedDesktop is only available to the Placed app");
    return handler(...args);
  };
}

export function registerIpc({ dataDir, logsDir, checkForUpdates }: IpcOptions): void {
  ipcMain.on(CHANNELS.info, (event) => {
    event.returnValue = fromApp(event)
      ? { version: app.getVersion(), platform: process.platform, dataDir }
      : { version: "", platform: process.platform, dataDir: "" };
  });
  ipcMain.handle(CHANNELS.getOpenAtLogin, guard(() => app.getLoginItemSettings().openAtLogin));
  ipcMain.handle(
    CHANNELS.setOpenAtLogin,
    guard((openAtLogin: unknown) => {
      app.setLoginItemSettings({ openAtLogin: openAtLogin === true });
      return app.getLoginItemSettings().openAtLogin;
    }),
  );
  ipcMain.handle(CHANNELS.checkForUpdates, guard(() => checkForUpdates()));
  // Opening a path can launch a program, so only the data and logs folders themselves are allowed.
  ipcMain.handle(
    CHANNELS.openPath,
    guard(async (path: unknown) => {
      if (!isOpenableFolder(path, [dataDir, logsDir])) {
        return "Placed can only open its own data and logs folders.";
      }
      return shell.openPath(path);
    }),
  );
}
