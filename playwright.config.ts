import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Load .env.local so global setup can sign in the demo user (values never printed).
try { process.loadEnvFile(".env.local"); } catch { /* optional */ }

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Artifacts (results, report, auth state) live outside the repo so nothing needs .gitignore entries.
const OUT = path.join(os.tmpdir(), "placed-e2e");
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(OUT, "results"),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one shared demo user in a real Supabase project: keep writes serial
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
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
