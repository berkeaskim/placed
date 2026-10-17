import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { migrationsDir } from "./paths";

type Client = { pragma(s: string, o?: { simple: boolean }): unknown; prepare(s: string): { get(): unknown } };

function appliedCount(client: Client): number {
  try {
    return (client.prepare("select count(*) as n from __drizzle_migrations").get() as { n: number }).n;
  } catch {
    return 0; // fresh database: the migrations table doesn't exist yet
  }
}

/**
 * Applies every pending migration in `drizzle/`. Synchronous (better-sqlite3); safe to run repeatedly.
 *
 * Foreign keys are switched off for the run: the migrator wraps everything in a transaction, where the
 * `PRAGMA foreign_keys=OFF` that drizzle-kit emits for table rebuilds is a no-op, so dropping a rebuilt
 * parent table (companies) would otherwise cascade-delete its children (jobs and everything under them).
 * Integrity is re-checked afterwards, only when a migration actually ran, so an unrelated old violation
 * can't block startup.
 */
export function runMigrations(db: BetterSQLite3Database<Record<string, unknown>>): void {
  const client = (db as unknown as { $client?: Client }).$client;
  // Without the raw client the FK toggle is impossible, and a rebuild would cascade-delete jobs: refuse.
  if (!client) throw new Error("runMigrations: drizzle handle has no $client (better-sqlite3); cannot disable foreign keys");
  const fkWasOn = client.pragma("foreign_keys", { simple: true }) === 1;
  if (fkWasOn) client.pragma("foreign_keys = OFF");
  try {
    const before = appliedCount(client);
    migrate(db, { migrationsFolder: migrationsDir() });
    if (fkWasOn && appliedCount(client) !== before) {
      const bad = client.pragma("foreign_key_check") as unknown[];
      if (bad.length) throw new Error(`migration left ${bad.length} foreign key violation(s)`);
    }
  } finally {
    if (fkWasOn) client.pragma("foreign_keys = ON");
  }
}
