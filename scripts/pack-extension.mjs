// Packs extension/ into public/placed-autopilot.zip, pointed at the origin this app serves from, so students can
// download it from /autopilot/setup instead of loading the repo folder. Runs before `next build` and `next dev`.
//   Origin: PLACED_PUBLIC_ORIGIN, else http://localhost:$PORT (default 3000).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { zipSync, strToU8 } from "fflate";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "extension");
const OUT = join(ROOT, "public", "placed-autopilot.zip");
const DIR = "placed-autopilot/";

const origin = (process.env.PLACED_PUBLIC_ORIGIN || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");
const u = new URL(origin);
const origins = [...new Set([origin, ...(["localhost", "127.0.0.1"].includes(u.hostname)
  ? [`${u.protocol}//localhost${u.port ? `:${u.port}` : ""}`, `${u.protocol}//127.0.0.1${u.port ? `:${u.port}` : ""}`] : [])])];

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
  `// config.js — where the Placed app runs (set when this copy was packed).\nglobalThis.PLACED_ORIGIN = ${JSON.stringify(origin)};\n` +
  `globalThis.PLACED_ORIGINS = ${JSON.stringify(origins)};\n`,
);

// manifest: allow fetches to that origin and let the site see the extension is installed (localhost is already covered).
const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
const pattern = `${u.protocol}//${u.hostname}/*`;
if (!manifest.host_permissions.includes(pattern)) manifest.host_permissions.unshift(pattern);
for (const c of manifest.content_scripts) {
  if ((c.js.includes("hello.js") || c.js.includes("placed-bridge.js")) && !c.matches.includes(pattern)) c.matches.unshift(pattern);
}
files[`${DIR}manifest.json`] = strToU8(JSON.stringify(manifest, null, 2) + "\n");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, zipSync(files, { level: 9 }));
console.log(`pack-extension: ${Object.keys(files).length} files → ${relative(ROOT, OUT)} (origin ${origin})`);
