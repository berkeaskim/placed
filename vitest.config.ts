import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Every test file gets its own temp PLACED_DATA_DIR (fresh SQLite), never ./data.
    setupFiles: ["tests/setup/temp-data-dir.ts"],
    // VAULT_ENC_KEY: a throwaway all-zero test key (32 bytes, base64) so vault writes can be sealed in unit tests.
    env: { VAULT_ENC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
  },
  resolve: {
    // Prefer .ts over .json so "@/lib/cover-letter/rules" is rules.ts, not rules.json.
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
