import { BrowserWindow } from "electron";
import { join } from "node:path";

export const BACKGROUND = "#F6F6FA"; // --background in app/globals.css

const STARTING_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Placed</title><style>
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:${BACKGROUND};color:#16161D;
font:600 15px -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;-webkit-user-select:none;cursor:default}
p{opacity:.7;margin:0}
</style></head><body><p>Starting Placed…</p></body></html>`;

export const STARTING_PAGE = `data:text/html;charset=utf-8,${encodeURIComponent(STARTING_HTML)}`;

/** The single Placed window, showing the "Starting Placed…" page until the server answers. */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Placed",
    titleBarStyle: "default",
    backgroundColor: BACKGROUND,
    show: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  void win.loadURL(STARTING_PAGE);
  return win;
}
