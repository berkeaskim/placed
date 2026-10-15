// Packs extension/ into public/placed-autopilot.zip, pointed at the origin this build will serve from, so students can
// download it from /autopilot/setup instead of cloning the repo. Runs before `next build` and `next dev`.
//   Origin: PLACED_PUBLIC_ORIGIN, else Vercel's production domain, else the local dev server.
//   --store: writes dist/placed-autopilot-store.zip instead, files at the zip root, for the Chrome Web Store upload.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { zipSync, strToU8 } from "fflate";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "extension");
const STORE = process.argv.includes("--store");
const OUT = STORE ? join(ROOT, "dist", "placed-autopilot-store.zip") : join(ROOT, "public", "placed-autopilot.zip");
const DIR = STORE ? "" : "placed-autopilot/";
const LOCAL = "http://localhost:3200";

const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null;
const origin = (process.env.PLACED_PUBLIC_ORIGIN || fromVercel || LOCAL).replace(/\/+$/, "");

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = {};
for (const path of walk(SRC)) {
  const rel = relative(SRC, path);
  if (rel === "README.md" || rel.startsWith(".")) continue;
  files[`${DIR}${rel}`] = readFileSync(path);
}

// config.js: the one place the extension learns where Placed runs.
files[`${DIR}config.js`] = strToU8(
  `// config.js — where the Placed app runs (set when this copy was packed).\nglobalThis.PLACED_ORIGIN = ${JSON.stringify(origin)};\n`,
);

// manifest: allow fetches to that origin and let the site see the extension is installed.
const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
const pattern = `${origin}/*`;
if (!manifest.host_permissions.includes(pattern)) manifest.host_permissions.unshift(pattern);
const hello = manifest.content_scripts.find((c) => c.js.includes("hello.js"));
if (hello && !hello.matches.includes(pattern)) hello.matches.unshift(pattern);
// The store copy talks only to production; dev copies keep localhost too.
if (STORE) {
  const prod = (list) => list.filter((m) => !m.startsWith(LOCAL));
  manifest.host_permissions = prod(manifest.host_permissions);
  for (const c of manifest.content_scripts) c.matches = prod(c.matches);
}
files[`${DIR}manifest.json`] = strToU8(JSON.stringify(manifest, null, 2) + "\n");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, zipSync(files, { level: 9 }));
console.log(`pack-extension: ${Object.keys(files).length} files → ${relative(ROOT, OUT)} (origin ${origin})`);
