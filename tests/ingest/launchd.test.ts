import { describe, expect, it } from "vitest";
import { LAUNCHD_LABEL, launchAgentPath, launchAgentPlist } from "@/lib/ingest/launchd";

describe("launch agent", () => {
  it("runs the due-check from the repo every 30 minutes, with escaped paths", () => {
    const xml = launchAgentPlist({ npm: "/usr/local/bin/npm", repo: "/Users/me/R&D/placed", pathEnv: "/usr/local/bin:/usr/bin", log: "/tmp/i.log" });
    expect(xml).toContain(`<string>${LAUNCHD_LABEL}</string>`);
    expect(xml).toContain("<string>--if-due</string>");
    expect(xml).toContain("<string>/Users/me/R&amp;D/placed</string>");
    expect(xml).toContain("<integer>1800</integer>");
    expect(launchAgentPath("/Users/me")).toBe("/Users/me/Library/LaunchAgents/dev.placed.ingest.plist");
  });
});
