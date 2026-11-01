import { shell, type WebContents } from "electron";
import { canOpenExternally, isAppUrl, newWindowTarget } from "./urls";

function openOutside(url: string): void {
  if (canOpenExternally(url)) void shell.openExternal(url);
}

/** Keep every Placed window on the app's origin; any other web link opens in the default browser. */
export function applyLinkPolicy(contents: WebContents): void {
  // Never open a second window: Placed links load here, web links go to the browser (see newWindowTarget).
  contents.setWindowOpenHandler(({ url }) => {
    const target = newWindowTarget(url);
    if (target === "same-window") void contents.loadURL(url);
    else if (target === "browser") void shell.openExternal(url);
    return { action: "deny" };
  });
  const keepOnApp = (event: { preventDefault(): void }, url: string) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openOutside(url);
  };
  contents.on("will-navigate", (event, url) => keepOnApp(event, url));
  // A server redirect (30x) of the page itself to another origin must not load inside the app either.
  contents.on("will-redirect", (event, url) => {
    if (event.isMainFrame) keepOnApp(event, url);
  });
}
