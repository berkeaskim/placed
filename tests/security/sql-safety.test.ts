import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

describe("migrations never build SQL from values", () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));
  it.each(files)("%s: dynamic EXECUTE uses only %%I/%%L or USING", (f) => {
    const sql = readFileSync(path.join(MIGRATIONS, f), "utf8").replace(/--.*$/gm, "");
    for (const m of sql.matchAll(/\bexecute\s+(?!function\b)([^;]+);/gi)) {
      const stmt = m[1];
      expect(stmt, `${f}: EXECUTE with %s splices raw text into SQL`).not.toMatch(/%s/);
      expect(stmt, `${f}: EXECUTE built with || concatenation`).not.toMatch(/\|\|/);
    }
  });
});

describe("lint blocks Supabase filter-string injection", () => {
  const lint = async (code: string) => {
    const [r] = await new ESLint({ cwd: path.resolve(__dirname, "../..") }).lintText(code, { filePath: "lib/x.ts" });
    return r.messages.filter((m) => m.ruleId === "no-restricted-syntax").length;
  };
  it("flags interpolated and concatenated filter strings", async () => {
    expect(await lint("declare const q: any, s: string; q.or(`name.ilike.%${s}%`);")).toBe(1);
    expect(await lint("declare const q: any, s: string; q.filter('name.eq.' + s);")).toBe(1);
    expect(await lint("declare const q: any, s: string; q.textSearch(`${s}`);")).toBe(1);
  });
  it("allows argument-style filters and plain array .filter", async () => {
    expect(await lint("declare const q: any, s: string; q.eq('name', s).ilike('name', `%${s}%`);")).toBe(0);
    expect(await lint("const xs = [1, 2]; xs.filter((x) => x > 1);")).toBe(0);
  });
}, 30_000);

describe("pgInList", () => {
  it("keeps hostile ATS ids as single quoted literals", async () => {
    const { pgInList, isoDay } = await import("@/lib/db/postgrest");
    expect(pgInList(["123", "abc"])).toBe('("123","abc")');
    expect(pgInList(['a"),id.neq.(x'])).toBe('("a\\"),id.neq.(x")');
    expect(pgInList(["back\\slash"])).toBe('("back\\\\slash")');
    expect(isoDay("2026-10-16")).toBe("2026-10-16");
    expect(() => isoDay("2026-10-16,id.neq.0")).toThrow();
  });
});
