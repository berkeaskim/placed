import { shell, type WebContents } from "electron";
import { canOpenExternally, isAppUrl } from "./urls";

function openOutside(url: string): void {
  if (canOpenExternally(url)) void shell.openExternal(url);
}

/** Keep every Placed window on the app's origin; any other web link opens in the default browser. */
export function applyLinkPolicy(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: "allow" };
    openOutside(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openOutside(url);
  });
}
