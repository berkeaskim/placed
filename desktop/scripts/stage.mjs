// Assembles desktop/stage/server from a `PLACED_DESKTOP_BUILD=1 next build` (run `npm run desktop:build:next` first):
// the standalone server, its static assets and public/, then proves the native SQLite addon loads under Electron's Node.
// better-sqlite3 >= 12 ships Node-API prebuilds, which are ABI-stable across Node and Electron, so there is nothing to
// rebuild; the load check below is what guards that assumption. Any failure exits non-zero with the reason.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, readdirSync, readlinkSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(desktopDir, "..");
const standalone = join(root, ".next", "standalone");
const stage = join(desktopDir, "stage");
const server = join(stage, "server");

function fail(msg) {
  console.error(`stage: ${msg}`);
  process.exit(1);
}

if (!existsSync(join(standalone, "server.js"))) {
  fail(".next/standalone/server.js is missing. Run `npm run desktop:build:next` (PLACED_DESKTOP_BUILD=1 next build) first.");
}

rmSync(stage, { recursive: true, force: true });
// verbatimSymlinks: Turbopack links .next/node_modules/<pkg>-<hash> -> ../../node_modules/<pkg>; plain cpSync would
// rewrite those to absolute paths into this checkout, which breaks codesign and the app on any other machine.
cpSync(standalone, server, { recursive: true, verbatimSymlinks: true });
cpSync(join(root, ".next", "static"), join(server, ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(server, "public"), { recursive: true });

for (const rel of ["server.js", "seed", "drizzle", "fixtures", "public/fonts", ".next/static", "public/placed-autopilot.zip"]) {
  if (!existsSync(join(server, rel))) fail(`expected ${rel} in the stage but it is missing`);
}
for (const entry of readdirSync(server, { recursive: true })) {
  const path = join(server, entry);
  if (!lstatSync(path).isSymbolicLink()) continue;
  const target = readlinkSync(path);
  const inside = !isAbsolute(target) && !relative(server, resolve(dirname(path), target)).startsWith("..");
  if (!inside || !existsSync(path)) fail(`symlink ${entry} -> ${target} must stay inside the stage and resolve`);
}
// Never ship a developer's data or secrets.
for (const name of readdirSync(server)) {
  if (name === "data" || name.startsWith(".env")) fail(`refusing to stage ${name}: it must not ship in the app`);
}

const electron = join(desktopDir, "node_modules", ".bin", "electron");
if (!existsSync(electron)) fail("desktop/node_modules/.bin/electron is missing. Run `npm --prefix desktop ci` first.");
const sqlite = join(server, "node_modules", "better-sqlite3");
const probe = `const db = require(${JSON.stringify(sqlite)})(":memory:");` +
  `console.log("better-sqlite3 OK under Electron " + process.versions.electron + " (SQLite " + db.prepare("select sqlite_version() v").get().v + ")");`;
try {
  execFileSync(electron, ["-e", probe], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "inherit" });
} catch {
  fail("better-sqlite3 in the stage does not load under Electron's Node (see the error above).");
}
console.log(`stage: ${server} is ready`);
