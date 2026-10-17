import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["app", "components", "lib"];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

/** Modules that reach SQLite or Node built-ins. A value import of one from a client component makes Turbopack fail the
 *  route (dev only shows a 500 with a missing build-manifest.json; `next build` shows "Can't resolve 'fs'"). */
const SERVER_ONLY = [/^@\/lib\/db(\/|$)/, /^@\/lib\/ai\/(provider|config)$/, /^@\/lib\/settings\/store$/, /^better-sqlite3$/, /^node:/, /^(fs|path|crypto|child_process)$/];

describe("client components never import server-only modules", () => {
  it("no value import of lib/db, lib/ai/provider|config, lib/settings/store or Node built-ins under \"use client\"", () => {
    const bad: string[] = [];
    for (const d of DIRS) {
      for (const f of sources(path.join(ROOT, d))) {
        const text = readFileSync(f, "utf8");
        if (!/^\s*["']use client["']/.test(text)) continue;
        for (const m of text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)) {
          if (!m[1] && SERVER_ONLY.some((re) => re.test(m[2]))) bad.push(`${path.relative(ROOT, f)} -> ${m[2]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
