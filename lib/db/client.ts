import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { runMigrations } from "./migrate";
import { dataDir } from "./paths";
import * as schema from "./schema";

/** No "server-only" import: scripts (tsx) and vitest use this too. */
export { dataDir } from "./paths";
export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };
/** The transaction handle passed to `db.transaction(tx => ...)`. The callback must be synchronous. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

type Holder = { db: DB; file: string };
const g = globalThis as typeof globalThis & { __placedDb?: Holder };

function open(): Holder {
  const file = path.join(dataDir(), "placed.db");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  runMigrations(db);
  return { db, file };
}

/** The real Drizzle instance, opened (and migrated) on first use. Kept on globalThis so dev HMR reuses it. */
export function getDb(): DB {
  g.__placedDb ??= open();
  return g.__placedDb.db;
}

/** Lazy singleton: nothing touches the disk until the first query. */
export const db: DB = new Proxy({} as DB, {
  get(_, prop) {
    const real = getDb();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});

/** Path of the open SQLite file (opens it if needed). */
export const dbFile = () => (getDb(), g.__placedDb!.file);

/** Closes the connection so the next `db` use reopens at the current PLACED_DATA_DIR. For tests and scripts. */
export function resetDbForTests(): void {
  g.__placedDb?.db.$client.close();
  g.__placedDb = undefined;
}
