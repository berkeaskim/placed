import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadFixture(fn: string, key?: string): unknown | null {
  const dir = path.join(process.cwd(), "fixtures", "ai", fn);
  for (const name of [key, "default"].filter(Boolean) as string[]) {
    const file = path.join(dir, `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  }
  return null;
}

/** Plain-text sibling of loadFixture: `<fn>/<key|default>.txt`, or null. */
export function loadTextFixture(fn: string, key?: string): string | null {
  const dir = path.join(process.cwd(), "fixtures", "ai", fn);
  for (const name of [key, "default"].filter(Boolean) as string[]) {
    const file = path.join(dir, `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`);
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  return null;
}
