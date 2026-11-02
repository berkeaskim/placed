import { contextBridge, ipcRenderer } from "electron";

// Keep channel names in sync with CHANNELS in lib/ipc.ts (a sandboxed preload cannot require local modules).
const info = ipcRenderer.sendSync("placed:info") as { version: string; platform: string; dataDir: string };

contextBridge.exposeInMainWorld("placedDesktop", {
  version: info.version,
  platform: info.platform,
  dataDir: info.dataDir,
  getOpenAtLogin: (): Promise<boolean> => ipcRenderer.invoke("placed:getOpenAtLogin"),
  setOpenAtLogin: (openAtLogin: boolean): Promise<{ openAtLogin: boolean; needsApproval: boolean }> =>
    ipcRenderer.invoke("placed:setOpenAtLogin", openAtLogin),
  checkForUpdates: (): Promise<{ status: string; latest?: { version: string; url: string; publishedAt: string } }> =>
    ipcRenderer.invoke("placed:checkForUpdates"),
  openPath: (path: string): Promise<string> => ipcRenderer.invoke("placed:openPath", path),
});
