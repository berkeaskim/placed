/**
 * Runs a TypeScript script that renders PDFs. tsx compiles the app's .ts/.tsx files to CommonJS (the package has
 * no "type": "module"), and @react-pdf/renderer's ESM-only dependencies (@react-pdf/hyphenate) can't be required
 * from CommonJS. jiti resolves them through their "import" condition. Usage: node scripts/run-ts.mjs <script> [args]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, jsx: { runtime: "automatic" }, fsCache: false });
const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/run-ts.mjs <script.ts>");
  process.exit(1);
}
await jiti.import(path.resolve(target));
