"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { loginChangeMessage } from "@/lib/desktop";
import { Group, Note, Row, Spinner, Switch, btn } from "@/components/ui/apple";

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
    <Group title="Mac app" footer={bridge ? `Placed ${bridge.version} for Mac.` : "Placed for Mac."}>
      <Row
        title="Open Placed at login"
        subtitle={loginMsg ? <Note tone="error">{loginMsg}</Note> : "Keeps the morning job refresh running."}
        trailing={<Switch label="Open Placed at login" checked={atLogin ?? false} disabled={!bridge || atLogin === null} onChange={toggleLogin} />}
      />
      <Row
        title="Updates"
        subtitle={updateMsg ? <span role="status">{updateMsg}</span> : "Placed updates itself when a new version is out."}
        trailing={
          <button type="button" className={btn} disabled={!bridge || checking} onClick={check}>
            {checking ? <Spinner /> : null}
            {checking ? "Checking" : "Check now"}
          </button>
        }
      />
      <Row
        title="Data folder"
        subtitle={folderMsg ? <Note tone="error">{folderMsg}</Note> : "Your database, CVs and keys, on this Mac."}
        trailing={<button type="button" className={btn} disabled={!bridge} onClick={showFolder}>Show in Finder</button>}
      />
    </Group>
  );
}
