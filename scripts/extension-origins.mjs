// Origins the packed extension accepts. Always the packed origin first, then its localhost/127.0.0.1 twins (when
// loopback), then the dev (3000) and Mac app (3917 = DESKTOP_PORT in lib/desktop.ts) loopback origins, so one
// installed extension works however the student runs Placed.
const DEV_PORT = 3000;
const DESKTOP_PORT = 3917; // keep in sync with lib/desktop.ts (this .mjs cannot import TypeScript)
const LOOPBACK = ["localhost", "127.0.0.1"];

export function packOrigins(origin) {
  const u = new URL(origin);
  const twins = LOOPBACK.includes(u.hostname)
    ? LOOPBACK.map((h) => `${u.protocol}//${h}${u.port ? `:${u.port}` : ""}`) : [];
  const known = [DEV_PORT, DESKTOP_PORT].flatMap((p) => LOOPBACK.map((h) => `http://${h}:${p}`));
  return [...new Set([origin, ...twins, ...known])];
}
