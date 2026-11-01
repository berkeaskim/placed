import { utilityProcess, type UtilityProcess } from "electron";
import { createWriteStream, existsSync } from "node:fs";
import { homedir } from "node:os";
import { serverEnv } from "./server-env";

export { waitForServer } from "./net";

export interface StartServerOptions {
  /** server.js of the Next standalone bundle. */
  entry: string;
  /** The standalone folder: the server resolves seed/, drizzle/, fixtures/ and public/ from its cwd. */
  cwd: string;
  port: number;
  dataDir: string;
  /** Inherited environment; serverEnv() layers the desktop contract on top. */
  env: Record<string, string | undefined>;
  /** server.log: the child's stdout and stderr are appended here. */
  logFile: string;
  log: (line: string) => void;
}

export interface ServerHandle {
  child: UtilityProcess;
  /** Resolves with the exit code whenever the child exits, for any reason. */
  exited: Promise<number>;
}

let current: UtilityProcess | null = null;

/** Fork the Next standalone server with Electron's own Node (no separate Node install). */
export function startServer({ entry, cwd, port, dataDir, env, logFile, log }: StartServerOptions): ServerHandle {
  if (!existsSync(entry)) log(`server bundle missing: ${entry} (build it with npm run desktop:build)`);
  const out = createWriteStream(logFile, { flags: "a" });
  const child = utilityProcess.fork(entry, [], {
    cwd,
    env: serverEnv({ baseEnv: env, home: homedir(), dataDir, serverDir: cwd, port }),
    stdio: "pipe",
    serviceName: "Placed Server",
  });
  child.stdout?.pipe(out, { end: false });
  child.stderr?.pipe(out, { end: false });
  current = child;
  log(`server starting: ${entry}`);
  const exited = new Promise<number>((resolve) => {
    child.once("exit", (code) => {
      if (current === child) current = null;
      log(`server exited with code ${code}`);
      resolve(code);
    });
  });
  return { child, exited };
}

export function stopServer(): void {
  current?.kill();
  current = null;
}
