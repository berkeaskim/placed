import { mkdirSync } from "node:fs";
import path from "node:path";

/** Where everything local lives: PLACED_DATA_DIR, default `<cwd>/data`. Created if missing. */
export function dataDir(): string {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.PLACED_DATA_DIR || path.join(process.cwd(), "data"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Generated Drizzle migrations (`npx drizzle-kit generate`). PLACED_MIGRATIONS_DIR overrides for odd cwds. */
export const migrationsDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.PLACED_MIGRATIONS_DIR || path.join(process.cwd(), "drizzle"));
