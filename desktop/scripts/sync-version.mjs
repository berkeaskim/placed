// Copies the root package.json "version" into desktop/package.json so the app version has one source of truth.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootPkg = JSON.parse(readFileSync(join(desktopDir, "..", "package.json"), "utf8"));
const desktopPkgPath = join(desktopDir, "package.json");
const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, "utf8"));

if (desktopPkg.version !== rootPkg.version) {
  desktopPkg.version = rootPkg.version;
  writeFileSync(desktopPkgPath, `${JSON.stringify(desktopPkg, null, 2)}\n`);
  console.log(`desktop/package.json version -> ${rootPkg.version}`);
}
