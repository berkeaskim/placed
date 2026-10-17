import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * macOS LaunchAgent that runs `npm run ingest -- --if-due` every 30 minutes, so the job search keeps to its schedule
 * while Placed itself is closed. The schedule (Settings → Job search) stays the single source of truth: the agent
 * only wakes the check, and launchd fires a missed check as soon as the Mac wakes up.
 */
export const LAUNCHD_LABEL = "dev.placed.ingest";
export const LAUNCHD_CHECK_SECONDS = 30 * 60;

export const launchAgentPath = (home = homedir()) => path.join(home, "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);

export function launchAgentInstalled(): boolean {
  try {
    return process.platform === "darwin" && existsSync(launchAgentPath());
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function launchAgentPlist(o: { npm: string; repo: string; pathEnv: string; log: string }): string {
  const args = [o.npm, "run", "--silent", "ingest", "--", "--if-due"].map((a) => `    <string>${esc(a)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${esc(o.repo)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${esc(o.pathEnv)}</string>
  </dict>
  <key>StartInterval</key>
  <integer>${LAUNCHD_CHECK_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>LowPriorityIO</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${esc(o.log)}</string>
  <key>StandardErrorPath</key>
  <string>${esc(o.log)}</string>
</dict>
</plist>
`;
}
