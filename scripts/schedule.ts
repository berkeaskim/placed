import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../lib/db/paths";
import { LAUNCHD_CHECK_SECONDS, LAUNCHD_LABEL, launchAgentPath, launchAgentPlist } from "../lib/ingest/launchd";

/**
 * `npm run schedule:install` / `schedule:uninstall` / `schedule:status`: a macOS LaunchAgent that keeps the job search
 * on its schedule (Settings → Job search) while Placed is closed.
 */
const domain = `gui/${process.getuid?.() ?? 501}`;
const plist = launchAgentPath();

function launchctl(...args: string[]): boolean {
  try {
    execFileSync("launchctl", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function install() {
  const bin = path.dirname(process.execPath);
  const npm = path.join(bin, "npm");
  if (!existsSync(npm)) throw new Error(`npm not found next to node (${npm})`);
  const log = path.join(dataDir(), "logs", "ingest.log");
  mkdirSync(path.dirname(log), { recursive: true });
  mkdirSync(path.dirname(plist), { recursive: true });
  launchctl("bootout", `${domain}/${LAUNCHD_LABEL}`); // reinstall cleanly
  writeFileSync(plist, launchAgentPlist({ npm, repo: process.cwd(), pathEnv: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`, log }));
  if (!launchctl("bootstrap", domain, plist)) throw new Error(`launchctl couldn't load ${plist}`);
  console.log(`Installed. Every ${LAUNCHD_CHECK_SECONDS / 60} min (and when the Mac wakes) it runs the job search if it's due.`);
  console.log(`Change when in Settings → Job search. Log: ${log}`);
}

function uninstall() {
  launchctl("bootout", `${domain}/${LAUNCHD_LABEL}`);
  rmSync(plist, { force: true });
  console.log("Removed. The job search now only runs while Placed is open.");
}

function status() {
  const loaded = launchctl("print", `${domain}/${LAUNCHD_LABEL}`);
  console.log(existsSync(plist) ? `Installed (${plist})${loaded ? ", loaded" : ", not loaded: run schedule:install again"}.` : "Not installed.");
}

const cmd = process.argv[2];
if (process.platform !== "darwin") {
  console.log("The background agent is macOS only. Elsewhere, run this from cron every 30 minutes:");
  console.log(`  */30 * * * * cd ${process.cwd()} && npm run --silent ingest -- --if-due`);
} else if (cmd === "install") install();
else if (cmd === "uninstall") uninstall();
else status();
