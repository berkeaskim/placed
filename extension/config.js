// config.js — where the Placed app runs. Change for a deployed demo.
globalThis.PLACED_ORIGIN = "http://localhost:3200";
// Placed origins allowed to hand the extension a LinkedIn scoring ticket. The ticket is posted back to the origin
// that issued it, so each origin here also needs a host_permissions entry in manifest.json.
globalThis.PLACED_ORIGINS = ["http://localhost:3200", "http://localhost:3000", "https://placed-lovat.vercel.app"];
