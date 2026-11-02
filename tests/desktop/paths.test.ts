import { describe, expect, it } from "vitest";
import { isAbsolute, join, resolve } from "node:path";
import { resolvePaths } from "../../desktop/src/lib/paths";

const base = {
  userData: "/Users/x/Library/Application Support/Placed",
  resourcesPath: "/Applications/Placed.app/Contents/Resources",
  appPath: "/repo/desktop",
};

describe("resolvePaths", () => {
  it("packaged: server lives in Resources/server, data and logs under userData", () => {
    const p = resolvePaths({ ...base, isPackaged: true, env: {} });
    expect(p.dataDir).toBe(join(base.userData, "data"));
    expect(p.logsDir).toBe(join(base.userData, "logs"));
    expect(p.serverDir).toBe(join(base.resourcesPath, "server"));
    expect(p.serverEntry).toBe(join(base.resourcesPath, "server", "server.js"));
    expect(p.staticDir).toBe(join(base.resourcesPath, "server", ".next", "static"));
  });

  it("dev: server comes from <repo>/desktop/stage/server", () => {
    const p = resolvePaths({ ...base, isPackaged: false, env: {} });
    expect(p.serverDir).toBe(join("/repo", "desktop", "stage", "server"));
    expect(p.serverEntry).toBe(join("/repo", "desktop", "stage", "server", "server.js"));
  });

  it("PLACED_DATA_DIR overrides the data folder (logs stay under userData)", () => {
    const p = resolvePaths({ ...base, isPackaged: true, env: { PLACED_DATA_DIR: "/tmp/scratch-data" } });
    expect(p.dataDir).toBe("/tmp/scratch-data");
    expect(p.logsDir).toBe(join(base.userData, "logs"));
  });

  it("an empty PLACED_DATA_DIR is ignored", () => {
    const p = resolvePaths({ ...base, isPackaged: true, env: { PLACED_DATA_DIR: "" } });
    expect(p.dataDir).toBe(join(base.userData, "data"));
  });

  it("a relative PLACED_DATA_DIR is made absolute (never relative to the server's cwd in the bundle)", () => {
    const p = resolvePaths({ ...base, isPackaged: true, env: { PLACED_DATA_DIR: "scratch/data" } });
    expect(isAbsolute(p.dataDir)).toBe(true);
    expect(p.dataDir).toBe(resolve("scratch/data"));
  });
});
