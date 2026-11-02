import { join } from "node:path";

const SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";

/**
 * An app started from Finder gets launchd's bare PATH, so CLIs the server shells out to (ollama, codex, claude)
 * are invisible. Append the usual install dirs that are missing; never reorder what is already there. Pure.
 */
export function augmentPath(path: string | undefined, home: string): string {
  const parts = (path || SYSTEM_PATH).split(":").filter(Boolean);
  const extras = ["/opt/homebrew/bin", "/usr/local/bin", join(home, ".npm-global", "bin"), join(home, ".local", "bin")];
  for (const dir of extras) if (!parts.includes(dir)) parts.push(dir);
  return parts.join(":");
}

export interface ServerEnvInputs {
  baseEnv: Record<string, string | undefined>;
  home: string;
  dataDir: string;
  serverDir: string;
  port: number;
}

/** Environment for the forked Next standalone server. Loopback only, desktop mode, first-run setup on, no AI_MODE. Pure. */
export function serverEnv({ baseEnv, home, dataDir, serverDir, port }: ServerEnvInputs): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) if (value !== undefined) env[key] = value;
  delete env.AI_MODE; // AI_MODE=fixture is for tests only; a terminal launch must never pass it to the app
  return {
    ...env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PLACED_DESKTOP: "1",
    PLACED_AUTO_SETUP: "1",
    PLACED_DATA_DIR: dataDir,
    PLACED_MIGRATIONS_DIR: join(serverDir, "drizzle"),
    PLACED_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    NEXT_TELEMETRY_DISABLED: "1",
    PATH: augmentPath(baseEnv.PATH, home),
  };
}
