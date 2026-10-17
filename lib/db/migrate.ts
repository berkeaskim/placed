import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { migrationsDir } from "./paths";

/**
 * Applies every pending migration in `drizzle/`. Synchronous (better-sqlite3); safe to run repeatedly.
 *
 * Foreign keys are switched off for the run: the migrator wraps everything in a transaction, where the
 * `PRAGMA foreign_keys=OFF` that drizzle-kit emits for table rebuilds is a no-op, so dropping a rebuilt
 * parent table (companies) would otherwise cascade-delete its children (jobs and everything under them).
 * Integrity is re-checked afterwards.
 */
export function runMigrations(db: BetterSQLite3Database<Record<string, unknown>>): void {
  const client = (db as unknown as { $client?: { pragma(s: string, o?: { simple: boolean }): unknown } }).$client;
  const fkWasOn = client ? client.pragma("foreign_keys", { simple: true }) === 1 : false;
  if (fkWasOn) client!.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder: migrationsDir() });
    if (fkWasOn) {
      const bad = client!.pragma("foreign_key_check") as unknown[];
      if (bad.length) throw new Error(`migration left ${bad.length} foreign key violation(s)`);
    }
  } finally {
    if (fkWasOn) client!.pragma("foreign_keys = ON");
  }
}
