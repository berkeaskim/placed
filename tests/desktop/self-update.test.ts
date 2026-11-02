import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleFor, SWAP_SCRIPT, whyCannotSelfUpdate } from "../../desktop/src/lib/self-update";

describe("bundleFor", () => {
  it("finds the .app around the main executable", () => {
    expect(bundleFor("/Applications/Placed.app/Contents/MacOS/Placed")).toBe("/Applications/Placed.app");
    expect(bundleFor("/Users/me/Apps/My Placed.app/Contents/MacOS/Placed")).toBe("/Users/me/Apps/My Placed.app");
  });
  it("is null when unpackaged", () => {
    expect(bundleFor("/repo/desktop/node_modules/electron/dist/Electron")).toBeNull();
  });
});

describe("whyCannotSelfUpdate", () => {
  const yes = () => true;
  it("allows a normal install in a writable folder", () => {
    expect(whyCannotSelfUpdate("/Applications/Placed.app", yes)).toBeNull();
  });
  it("refuses translocated, DMG-mounted, unwritable or unpackaged copies", () => {
    expect(whyCannotSelfUpdate("/private/var/folders/x/AppTranslocation/ABC/d/Placed.app", yes)).toMatch(/Applications/);
    expect(whyCannotSelfUpdate("/Volumes/Placed 1.2.0/Placed.app", yes)).toMatch(/disk image/);
    expect(whyCannotSelfUpdate("/Applications/Placed.app", () => false)).toMatch(/can't write/);
    expect(whyCannotSelfUpdate(null, yes)).toMatch(/installed/);
  });
});

describe.runIf(process.platform === "darwin")("SWAP_SCRIPT", () => {
  it("swaps the bundle once the old process is gone and cleans up", () => {
    const root = mkdtempSync(join(tmpdir(), "swap-test-"));
    const target = join(root, "Apps", "Placed.app");
    const work = join(root, "work");
    const staged = join(work, "Placed.app");
    mkdirSync(target, { recursive: true });
    mkdirSync(staged, { recursive: true });
    writeFileSync(join(target, "v"), "old");
    writeFileSync(join(staged, "v"), "new");
    // `open` is stubbed out via PATH so the test doesn't launch anything.
    const bin = join(root, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "open"), `#!/bin/sh\necho "$1" > "${join(root, "opened")}"\n`, { mode: 0o755 });
    execFileSync("/bin/sh", ["-c", SWAP_SCRIPT, "sh", "999999", target, staged, work], {
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    });
    expect(readFileSync(join(target, "v"), "utf8")).toBe("new");
    expect(existsSync(work)).toBe(false);
    expect(readFileSync(join(root, "opened"), "utf8").trim()).toBe(target);
  });
});
