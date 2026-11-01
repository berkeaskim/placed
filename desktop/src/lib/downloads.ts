import { Notification, shell, type Session } from "electron";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { uniqueDownloadPath } from "./download-path";

/** Downloads go straight to ~/Downloads (no save dialog, never overwriting) with a notification when done. */
export function handleDownloads(session: Session, downloadsDir: string, log: (line: string) => void): void {
  session.on("will-download", (_event, item) => {
    const savePath = uniqueDownloadPath(downloadsDir, item.getFilename(), existsSync);
    item.setSavePath(savePath);
    item.once("done", (_e, state) => {
      log(`download ${state}: ${savePath}`);
      if (state !== "completed" || !Notification.isSupported()) return;
      const note = new Notification({ title: "Download complete", body: `${basename(savePath)} is in Downloads.` });
      note.on("click", () => shell.showItemInFolder(savePath));
      note.show();
    });
  });
}
