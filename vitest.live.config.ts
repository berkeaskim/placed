import { defineConfig } from "vitest/config";
import path from "node:path";
import { existsSync } from "node:fs";

// Live AI integration suite: hits the real provider (Gemini today). Run with
//   npx vitest run -c vitest.live.config.ts
// The default config (vitest.config.ts) also matches tests/live/*.live.test.ts by glob, so every
// live file is guarded with describe.skipIf(!process.env.LIVE_AI); this config sets LIVE_AI=1.
const envFile = path.resolve(__dirname, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.LIVE_AI = "1";

export default defineConfig({
  test: {
    include: ["tests/live/**/*.live.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false, // sequential: realistic latency numbers, gentle on rate limits
    env: { LIVE_AI: "1" },
    silent: false, // always print the latency + raw-output logs
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
