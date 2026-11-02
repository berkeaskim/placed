import { execFile, spawn } from "node:child_process";
import { accessSync, constants, createWriteStream, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import type { Release } from "./updates";

/**
 * In-app updates for the ad-hoc signed app. Squirrel.Mac (electron-updater) needs a Developer ID, so instead:
 * download the release DMG, copy Placed.app out of it, check it, then after Placed quits a small shell script swaps
 * the bundle and reopens it. The data folder lives outside the bundle, so it is untouched.
 */

export const BUNDLE_ID = "dev.placed.app";

const run = promisify(execFile);

/** `/…/Placed.app` for `/…/Placed.app/Contents/MacOS/Placed`, else null (unpackaged `electron .`). Pure. */
export function bundleFor(execPath: string): string | null {
  const m = /^(.+?\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath);
  return m ? m[1] : null;
}

/**
 * Why this copy can't replace itself (null when it can). Pure apart from the injected writability check.
 * A quarantined app opened from Downloads runs from a read-only App Translocation path, and one opened straight
 * from the DMG runs from /Volumes: both have to be moved to Applications first.
 */
export function whyCannotSelfUpdate(bundle: string | null, writable: (dir: string) => boolean): string | null {
  if (!bundle) return "Placed isn't running as an installed app.";
  if (bundle.includes("/AppTranslocation/")) return "Move Placed to your Applications folder first, then reopen it.";
  if (bundle.startsWith("/Volumes/")) return "Placed is running from the disk image. Drag it to Applications first.";
  if (!writable(dirname(bundle)) || !writable(bundle)) return `Placed can't write to ${dirname(bundle)}.`;
  return null;
}

export const isWritable = (path: string): boolean => {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Runs as `sh -c SWAP_SCRIPT sh <pid> <target> <staged> <workdir>` after Placed starts quitting: waits (≤60 s) for
 * the old process and its server to exit, swaps the bundles (putting the old one back if the move fails), clears
 * quarantine and reopens Placed.
 */
export const SWAP_SCRIPT = `
pid="$1"; target="$2"; staged="$3"; work="$4"
i=0
while kill -0 "$pid" 2>/dev/null; do
  i=$((i+1)); [ "$i" -gt 300 ] && exit 1
  sleep 0.2
done
sleep 1
backup="$target.updating-$$"
if mv "$target" "$backup"; then
  if mv "$staged" "$target"; then rm -rf "$backup"; else mv "$backup" "$target"; fi
fi
xattr -dr com.apple.quarantine "$target" 2>/dev/null
rm -rf "$work"
open "$target"
`;

export interface StagedUpdate {
  /** The checked Placed.app, ready to swap in. */
  app: string;
  /** Scratch folder holding it; the swap script deletes it. */
  work: string;
}

const plist = async (app: string, key: string) =>
  (await run("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", join(app, "Contents", "Info.plist")])).stdout.trim();

/** Download the release DMG, copy its Placed.app out and verify it. Throws with a short reason on any failure. */
export async function stageUpdate(
  release: Release,
  { onProgress, log, fetchImpl = globalThis.fetch }: {
    onProgress?: (fraction: number) => void;
    log: (line: string) => void;
    fetchImpl?: typeof fetch;
  },
): Promise<StagedUpdate> {
  const { dmg } = release;
  if (!dmg) throw new Error("This release has no Mac download.");
  const work = mkdtempSync(join(tmpdir(), "placed-update-"));
  const file = join(work, "Placed.dmg");
  const mount = join(work, "mnt");
  let mounted = false;
  try {
    log(`update: downloading ${dmg.url}`);
    const res = await fetchImpl(dmg.url, { signal: AbortSignal.timeout(15 * 60_000) });
    if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}).`);
    let got = 0;
    const counted = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).on("data", (chunk: Buffer) => {
      got += chunk.length;
      onProgress?.(Math.min(got / dmg.size, 1));
    });
    await pipeline(counted, createWriteStream(file));
    if (statSync(file).size !== dmg.size) throw new Error("The download was incomplete.");

    await run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-noautoopen", "-mountpoint", mount, file]);
    mounted = true;
    const app = join(work, "Placed.app");
    await run("/usr/bin/ditto", [join(mount, "Placed.app"), app]);

    const id = await plist(app, "CFBundleIdentifier");
    const version = await plist(app, "CFBundleShortVersionString");
    if (id !== BUNDLE_ID) throw new Error(`The download isn't Placed (${id}).`);
    if (version !== release.version) throw new Error(`The download is ${version}, expected ${release.version}.`);
    await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
    log(`update: staged ${version} at ${app}`);
    return { app, work };
  } catch (err) {
    rmSync(work, { recursive: true, force: true });
    throw err;
  } finally {
    if (mounted) await run("/usr/bin/hdiutil", ["detach", "-force", mount]).catch(() => undefined);
  }
}

/** Start the detached swap script; the caller then quits Placed. */
export function launchSwap({ pid, target, staged }: { pid: number; target: string; staged: StagedUpdate }): void {
  const child = spawn("/bin/sh", ["-c", SWAP_SCRIPT, "sh", String(pid), target, staged.app, staged.work], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
