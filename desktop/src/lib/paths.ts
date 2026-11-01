import { dirname, join } from "node:path";

export interface PathInputs {
  /** app.getPath("userData"), already redirected by PLACED_USER_DATA_DIR when set. */
  userData: string;
  /** process.resourcesPath (Contents/Resources in the packaged app). */
  resourcesPath: string;
  /** app.getAppPath(): the desktop/ folder when running unpackaged with `electron .`. */
  appPath: string;
  isPackaged: boolean;
  env: Record<string, string | undefined>;
}

export interface DesktopPaths {
  dataDir: string;
  logsDir: string;
  serverDir: string;
  serverEntry: string;
  staticDir: string;
}

/** Where Placed keeps its data and logs, and where the bundled Next standalone server lives. Pure. */
export function resolvePaths({ userData, resourcesPath, appPath, isPackaged, env }: PathInputs): DesktopPaths {
  const repoRoot = dirname(appPath);
  const serverDir = isPackaged ? join(resourcesPath, "server") : join(repoRoot, "desktop", "stage", "server");
  return {
    dataDir: env.PLACED_DATA_DIR || join(userData, "data"),
    logsDir: join(userData, "logs"),
    serverDir,
    serverEntry: join(serverDir, "server.js"),
    staticDir: join(serverDir, ".next", "static"),
  };
}
