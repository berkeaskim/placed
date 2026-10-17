import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Artifacts (results, report) live outside the repo so nothing needs .gitignore entries.
const OUT = path.join(os.tmpdir(), "placed-e2e");
const baseURL = `http://127.0.0.1:${PORT}`;

// A fresh temp data dir per run, never ./data, made at config load: Playwright starts the webServer BEFORE
// globalSetup. PLACED_DATA_DIR is set here too so e2e/global-setup.ts (and the workers, which re-read this config and
// inherit the env) use the same dir. Only the main process creates it and removes it on exit.
if (!process.env.PLACED_E2E_DATA_DIR) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "placed-e2e-data-"));
  process.env.PLACED_E2E_DATA_DIR = dir;
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
}
const DATA_DIR = process.env.PLACED_E2E_DATA_DIR;
process.env.PLACED_DATA_DIR = DATA_DIR;

export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(OUT, "results"),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one local user and one SQLite file: keep writes serial
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: path.join(OUT, "report"), open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run setup && npm run dev -- -p ${PORT}`,
    // Replays the recorded AI fixtures (deterministic, no API spend). AI_MODE=live in the shell exercises a real model.
    // SKIP_INGEST: setup never pulls live postings, so the suite runs offline.
    env: { PLACED_DATA_DIR: DATA_DIR, AI_MODE: process.env.AI_MODE || "fixture", SKIP_INGEST: "1" },
    url: baseURL,
    reuseExistingServer: false, // an already-running server would use someone's real ./data
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
