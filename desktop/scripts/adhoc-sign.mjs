// electron-builder afterPack hook. With no signing identity (mac.identity: null) electron-builder leaves the app
// unsigned, and an unsigned arm64 app will not launch on Apple Silicon. This ad-hoc signs Placed.app before the DMG is
// made from it, then verifies the signature. Fails the build loudly if either step fails.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export default async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  // Always re-sign: packing rewrites Info.plist and the bundle, so any signature Electron shipped with is stale.
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
  const out = execFileSync("sh", ["-c", 'codesign -dv "$1" 2>&1', "sh", app], { encoding: "utf8" });
  if (!/Signature=adhoc/.test(out)) throw new Error(`adhoc-sign: ${app} is not ad-hoc signed:\n${out}`);
  console.log(`adhoc-sign: ${app} ad-hoc signed and verified`);
}
