import { describe, expect, it } from "vitest";
import { augmentPath, serverEnv } from "../../desktop/src/lib/server-env";

describe("augmentPath", () => {
  it("appends the common install dirs a Finder-launched app is missing", () => {
    expect(augmentPath("/usr/bin:/bin:/usr/sbin:/sbin", "/Users/x")).toBe(
      "/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:/Users/x/.npm-global/bin:/Users/x/.local/bin",
    );
  });

  it("does not duplicate dirs already on PATH and keeps the original order", () => {
    expect(augmentPath("/opt/homebrew/bin:/usr/bin", "/Users/x")).toBe(
      "/opt/homebrew/bin:/usr/bin:/usr/local/bin:/Users/x/.npm-global/bin:/Users/x/.local/bin",
    );
  });

  it("falls back to the system PATH when PATH is empty or missing", () => {
    expect(augmentPath(undefined, "/h")).toBe(
      "/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:/h/.npm-global/bin:/h/.local/bin",
    );
    expect(augmentPath("", "/h").startsWith("/usr/bin:/bin:/usr/sbin:/sbin:")).toBe(true);
  });
});

describe("serverEnv", () => {
  const env = serverEnv({
    baseEnv: { PATH: "/usr/bin:/bin", HOME: "/Users/x", PORT: "3000", HOSTNAME: "0.0.0.0", KEEP: "1", AI_MODE: "fixture" },
    home: "/Users/x",
    dataDir: "/d/data",
    serverDir: "/r/server",
    port: 3917,
  });

  it("sets the desktop server contract", () => {
    expect(env).toMatchObject({
      PORT: "3917",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PLACED_DESKTOP: "1",
      PLACED_AUTO_SETUP: "1",
      PLACED_DATA_DIR: "/d/data",
      PLACED_MIGRATIONS_DIR: "/r/server/drizzle",
      PLACED_PUBLIC_ORIGIN: "http://127.0.0.1:3917",
      NEXT_TELEMETRY_DISABLED: "1",
    });
  });

  it("never inherits a non-loopback HOSTNAME or another PORT, keeps the rest", () => {
    expect(env.HOSTNAME).toBe("127.0.0.1");
    expect(env.PORT).toBe("3917");
    expect(env.KEEP).toBe("1");
    expect(env.PATH).toContain("/opt/homebrew/bin");
  });

  it("drops AI_MODE so a terminal's AI_MODE=fixture never reaches the app's server", () => {
    expect("AI_MODE" in env).toBe(false);
  });
});
