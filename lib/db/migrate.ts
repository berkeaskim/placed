import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { migrationsDir } from "./paths";

/** Applies every pending migration in `drizzle/`. Synchronous (better-sqlite3); safe to run repeatedly. */
export function runMigrations(db: BetterSQLite3Database<Record<string, unknown>>): void {
  migrate(db, { migrationsFolder: migrationsDir() });
}
