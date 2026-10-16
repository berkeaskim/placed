// config.js — where the Placed app runs. scripts/pack-extension.mjs rewrites this file for the packed zip.
globalThis.PLACED_ORIGIN = "http://localhost:3000";
// Placed origins allowed to hand the extension a LinkedIn scoring ticket. The ticket is posted back to the origin
// that issued it; manifest.json's host_permissions cover every localhost / 127.0.0.1 port.
globalThis.PLACED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
