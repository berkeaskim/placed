import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // VAULT_ENC_KEY: a throwaway all-zero test key (32 bytes, base64) so vault writes can be sealed in unit tests.
  test: { include: ["tests/**/*.test.ts"], environment: "node", env: { VAULT_ENC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
