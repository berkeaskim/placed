import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { makePdf, REALISTIC_CV } from "./fixtures/make-pdf";

// Everything lives outside the repo: generated fixtures, an empty storage state (there is no login) and the local data.
const TMP = path.join(os.tmpdir(), "placed-e2e");
const AUTH_FILE = path.join(TMP, "e2e-auth.json");
const FIX_DIR = path.join(TMP, "generated");
/** The e2e app's data dir. playwright.config must pass the same PLACED_DATA_DIR to the webServer. */
export const E2E_DATA_DIR = path.join(TMP, "data");

export default async function globalSetup() {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIX_DIR, "realistic-cv.pdf"), makePdf(REALISTIC_CV));
  fs.writeFileSync(path.join(FIX_DIR, "image-only-cv.pdf"), makePdf([], { textless: true }));
  fs.writeFileSync(path.join(FIX_DIR, "not-a-pdf.txt"), "This is my CV as plain text. Python, SQL, Excel.\n");
  // A .pdf name + application/pdf type but not real PDF bytes (magic-number check).
  fs.writeFileSync(path.join(FIX_DIR, "fake.pdf"), "Hello, I am definitely a PDF.\n");
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));

  const dataDir = process.env.PLACED_DATA_DIR || E2E_DATA_DIR;
  if (dataDir === E2E_DATA_DIR) fs.rmSync(dataDir, { recursive: true, force: true }); // fresh install each run
  process.env.PLACED_DATA_DIR = dataDir;
  execFileSync("npx", ["tsx", "scripts/setup.ts"], { env: { ...process.env, PLACED_DATA_DIR: dataDir }, stdio: "inherit" });
}
