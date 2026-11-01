import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling (git-ignored): plan/review notes and the recon Python venv.
    ".superpowers/**",
    "**/.venv*/**",
    // Mac app build output and the staged server bundle (desktop/src is linted).
    "desktop/node_modules/**",
    "desktop/dist/**",
    "desktop/stage/**",
    "desktop/out/**",
  ]),
]);

export default eslintConfig;
