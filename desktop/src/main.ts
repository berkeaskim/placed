import { app, BrowserWindow, dialog, Menu, session, shell } from "electron";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { handleDownloads } from "./lib/downloads";
import { prepareDataFolder } from "./lib/first-run";
import { registerIpc, type UpdateCheckResult } from "./lib/ipc";
import { applyLinkPolicy } from "./lib/links";
import { appendLogLine, prepareLogFile, readLogTail } from "./lib/log-file";
import { buildAppMenu } from "./lib/menu";
import { isPortFree } from "./lib/net";
import { resolvePaths } from "./lib/paths";
import { startServer, stopServer, waitForServer } from "./lib/server";
import { APP_PORT, APP_URL } from "./lib/urls";
import { createMainWindow } from "./lib/window";

// QA and tests point the whole app (data, logs, desktop.json, single-instance lock) at a scratch folder.
if (process.env.PLACED_USER_DATA_DIR) app.setPath("userData", resolve(process.env.PLACED_USER_DATA_DIR));

// Replaced by the GitHub release check in Task 5.
const checkForUpdates = async (): Promise<UpdateCheckResult> => ({ status: "unavailable" });

let win: BrowserWindow | null = null;
let serverReady = false;
let quitting = false;

function showWindow(): void {
  win = createMainWindow();
  win.on("closed", () => (win = null));
  if (serverReady) void win.loadURL(APP_URL);
}

async function failAndQuit(message: string, logFile: string): Promise<void> {
  stopServer();
  const { response } = await dialog.showMessageBox({
    type: "error",
    message,
    detail: readLogTail(logFile, 20) || "The log is empty.",
    buttons: ["Open Log File", "Quit"],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0) await shell.openPath(logFile);
  app.quit();
}

async function boot(): Promise<void> {
  const paths = resolvePaths({
    userData: app.getPath("userData"),
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    env: process.env,
  });
  const logFile = prepareLogFile(paths.logsDir, "server.log");
  const log = (line: string) => appendLogLine(logFile, line);
  log(`Placed ${app.getVersion()} starting; data: ${paths.dataDir}`);

  const openFolder = (dir: string) => () => {
    mkdirSync(dir, { recursive: true });
    void shell.openPath(dir);
  };
  Menu.setApplicationMenu(
    buildAppMenu({
      checkForUpdates: () => {
        void checkForUpdates().then(() =>
          dialog.showMessageBox({ type: "info", message: "Update checks aren't available in this version yet." }),
        );
      },
      openDataFolder: openFolder(paths.dataDir),
      openLogsFolder: openFolder(paths.logsDir),
    }),
  );
  registerIpc({ dataDir: paths.dataDir, logsDir: paths.logsDir, checkForUpdates });
  handleDownloads(session.defaultSession, app.getPath("downloads"), log);

  if (!(await isPortFree(APP_PORT))) {
    log(`port ${APP_PORT} is in use`);
    await dialog.showMessageBox({
      type: "error",
      message: `Placed can't start: port ${APP_PORT} is in use (is another copy of Placed, or \`npm run dev -- -p ${APP_PORT}\`, running?)`,
      buttons: ["Quit"],
    });
    app.quit();
    return;
  }

  await prepareDataFolder({ dataDir: paths.dataDir, env: process.env, log });

  const server = startServer({
    entry: paths.serverEntry,
    cwd: paths.serverDir,
    port: APP_PORT,
    dataDir: paths.dataDir,
    env: process.env,
    logFile,
    log,
  });
  showWindow();

  const abort = new AbortController();
  const outcome = await Promise.race([
    waitForServer(APP_URL, 60_000, 250, abort.signal).then((up) => (up ? "ready" : "timeout")),
    server.exited.then(() => "exited" as const),
  ]);
  abort.abort();

  if (outcome !== "ready") {
    const why = outcome === "exited" ? "stopped before it was ready" : "did not start within 60 seconds";
    await failAndQuit(`Placed can't start: its server ${why}.`, logFile);
    return;
  }

  serverReady = true;
  log("server is up");
  void win?.loadURL(APP_URL);
  void server.exited.then(() => {
    if (!quitting) void failAndQuit("Placed's server stopped unexpectedly.", logFile);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on("web-contents-created", (_event, contents) => applyLinkPolicy(contents));
  app.on("window-all-closed", () => app.quit());
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverReady) showWindow();
  });
  app.on("before-quit", () => {
    quitting = true;
    stopServer();
  });
  app.on("will-quit", () => stopServer());
  app
    .whenReady()
    .then(boot)
    .catch((err: unknown) => {
      stopServer();
      dialog.showErrorBox("Placed can't start", err instanceof Error ? err.stack ?? err.message : String(err));
      app.quit();
    });
}
