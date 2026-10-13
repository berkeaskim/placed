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
