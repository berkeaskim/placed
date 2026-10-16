import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // SQL/PostgREST injection guard: Supabase filter strings (.or/.filter/.not/.textSearch/.match) are parsed by
    // PostgREST, so user input spliced into them can rewrite the query. Pass values as arguments (.eq, .in, .ilike), never
    // as part of the filter string. Plain array .filter() takes a function, so it never matches these selectors.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "CallExpression[callee.property.name=/^(or|filter|not|textSearch|match)$/] > TemplateLiteral[expressions.length>0]",
          message: "Don't build a Supabase filter string with ${...}: pass the value as an argument (.eq/.in/.ilike) instead.",
        },
        {
          selector: "CallExpression[callee.property.name=/^(or|filter|not|textSearch|match)$/] > BinaryExpression[operator='+']",
          message: "Don't concatenate a Supabase filter string: pass the value as an argument (.eq/.in/.ilike) instead.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
