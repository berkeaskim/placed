"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { loginChangeMessage } from "@/lib/desktop";

const button = "min-h-11 rounded-[12px] border-2 border-border bg-white px-4 text-sm font-bold transition-colors hover:bg-muted disabled:opacity-60";
const noop = () => () => {};
// Server render: undefined (unknown yet), so the section is in the HTML. In the browser: the bridge or null.
const useBridge = () => useSyncExternalStore(noop, () => window.placedDesktop ?? null, () => undefined);

function updateText(r: PlacedDesktopUpdateResult, current: string): string {
  if (r.status === "error" || !r.latest) return "Couldn't check for updates (offline?)";
  if (r.status === "current") return `You're up to date (${current}).`;
  return `Placed ${r.latest.version} is available.`;
}

/** "Mac app" settings. The page renders it only in desktop mode; it hides itself without the Electron bridge. */
export function DesktopSettings() {
  const bridge = useBridge();
  const [atLogin, setAtLogin] = useState<boolean | null>(null);
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [folderMsg, setFolderMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    bridge.getOpenAtLogin().then(setAtLogin, () => setLoginMsg("Couldn't read the login setting."));
  }, [bridge]);

  if (bridge === null) return null;

  const toggleLogin = (next: boolean) => {
    if (!bridge) return;
    const before = atLogin;
    setAtLogin(next);
    setLoginMsg(null);
    bridge.setOpenAtLogin(next).then(
      (result) => {
        setAtLogin(result.openAtLogin);
        setLoginMsg(loginChangeMessage(next, result));
      },
      () => {
        setAtLogin(before);
        setLoginMsg("Couldn't change that.");
      },
    );
  };

  const check = () => {
    if (!bridge) return;
    setChecking(true);
    setUpdateMsg(null);
    bridge.checkForUpdates()
      .then((r) => setUpdateMsg(updateText(r, bridge.version)), () => setUpdateMsg("Couldn't check for updates (offline?)"))
      .finally(() => setChecking(false));
  };

  const showFolder = () => {
    if (!bridge) return;
    setFolderMsg(null);
    bridge.openPath(bridge.dataDir).then((err) => setFolderMsg(err || null), () => setFolderMsg("Couldn't open the data folder."));
  };

  return (
    <section className="card-quest flex flex-col gap-3 p-5" aria-labelledby="mac-app-heading">
      <h2 id="mac-app-heading" className="font-bold">Mac app</h2>
      <p className="text-sm text-muted-foreground">{bridge ? `Placed ${bridge.version} for Mac.` : "Placed for Mac."}</p>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-5 accent-[#16161D]" checked={atLogin ?? false} disabled={!bridge || atLogin === null}
          onChange={(e) => toggleLogin(e.target.checked)} />
        Open Placed at login
      </label>
      {loginMsg && <p role="status" className="text-xs font-semibold text-[#B42318]">{loginMsg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={!bridge || checking} onClick={check}>
          {checking ? "Checking…" : "Check for updates"}
        </button>
        <button type="button" className={button} disabled={!bridge} onClick={showFolder}>Show data folder</button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">{updateMsg}{updateMsg && folderMsg ? " " : null}{folderMsg}</p>
    </section>
  );
}
