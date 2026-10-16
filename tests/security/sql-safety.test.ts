import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["app", "lib", "scripts", "components"];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx|mjs)$/.test(name)) yield p;
  }
}
const files = DIRS.flatMap((d) => [...sources(path.join(ROOT, d))]).map((f) => ({ rel: path.relative(ROOT, f), text: readFileSync(f, "utf8") }));

/** Drizzle binds every value in `sql\`...\``, eq(), like() etc. as a parameter. These are the escape hatches that don't. */
describe("SQL is never built from strings", () => {
  it("sql.raw only in the schema (constant enum lists for CHECK constraints)", () => {
    const hits = files.filter((f) => /\bsql\.raw\s*\(/.test(f.text)).map((f) => f.rel);
    expect(hits).toEqual([path.join("lib", "db", "schema.ts")]);
  });

  it("raw better-sqlite3 exec/prepare only inside lib/db, and never with an interpolated template", () => {
    const raw = files.filter((f) => /\$client\.(exec|prepare)\s*\(/.test(f.text));
    expect(raw.filter((f) => !f.rel.startsWith(path.join("lib", "db"))).map((f) => f.rel)).toEqual([]);
    for (const f of raw) expect(f.text, f.rel).not.toMatch(/\$client\.(exec|prepare)\s*\(\s*`[^`]*\$\{/);
  });

  it("no string-built queries through db.run / db.all / db.get", () => {
    const bad = files.filter((f) => /\bdb\.(run|all|get|values)\s*\(\s*(`|["'][^"']*["']\s*\+)/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });
});
