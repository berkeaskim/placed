import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "@/lib/db/migrate";

/** Builds a DB migrated up to (but excluding) the tags starting with `skipPrefix` and later; returns handles. */
function oldDb(tmp: string, keepBefore: string) {
  const old = path.join(tmp, "old");
  cpSync("drizzle", old, { recursive: true });
  const journalPath = path.join(old, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const cut = journal.entries.findIndex((e: { tag: string }) => e.tag.startsWith(keepBefore));
  journal.entries = journal.entries.slice(0, cut);
  writeFileSync(journalPath, JSON.stringify(journal));
  const sqlite = new Database(path.join(tmp, "t.db"));
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: old });
  return { sqlite, db };
}

describe("runMigrations table rebuilds", () => {
  it("keeps jobs and every companies column when 0006 widens the ats values", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "placed-mig-"));
    try {
      const { sqlite, db } = oldDb(tmp, "0006");
      sqlite.prepare("insert into companies (slug,name,ats,api_host,employer,transport,enabled,source,added_at) values ('uk','Amazon','amazon','h','amazon','stealth',0,'discovered','2026-01-01')").run();
      sqlite.prepare("insert into jobs (id,company_id,ext_id,title,url,first_seen,last_seen) values ('j1',1,'e','T','u','x','y')").run();
      runMigrations(db);
      expect(sqlite.prepare("select count(*) n from jobs").get()).toEqual({ n: 1 });
      expect(sqlite.prepare("select slug,name,ats,api_host,employer,transport,enabled,source,added_at from companies").get()).toEqual({
        slug: "uk", name: "Amazon", ats: "amazon", api_host: "h", employer: "amazon", transport: "stealth", enabled: 0, source: "discovered", added_at: "2026-01-01",
      });
      sqlite.prepare("insert into companies (slug,name,ats) values ('x','GS','goldmansachs')").run();
      expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      sqlite.close();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps jobs when 0005 rebuilds companies, and leaves foreign keys on", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "placed-mig-"));
    try {
      const { sqlite, db } = oldDb(tmp, "0005");
      sqlite.prepare("insert into companies (slug,name,ats) values ('a','A','lever')").run();
      sqlite.prepare("insert into jobs (id,company_id,ext_id,title,url,first_seen,last_seen) values ('j1',1,'e','T','u','x','y')").run();

      runMigrations(db);

      expect(sqlite.prepare("select count(*) n from jobs").get()).toEqual({ n: 1 });
      expect(sqlite.prepare("select employer, transport from companies").get()).toEqual({ employer: null, transport: null });
      expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      sqlite.close();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("throws when the drizzle handle has no $client instead of silently migrating with foreign keys on", () => {
    expect(() => runMigrations({} as never)).toThrow(/\$client/);
  });

  it("an old foreign key violation does not block startup when no migration ran", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "placed-mig-"));
    try {
      const sqlite = new Database(path.join(tmp, "t.db"));
      sqlite.pragma("foreign_keys = ON");
      const db = drizzle(sqlite);
      runMigrations(db);
      sqlite.pragma("foreign_keys = OFF");
      sqlite.prepare("insert into jobs (id,company_id,ext_id,title,url,first_seen,last_seen) values ('orphan',999,'e','T','u','x','y')").run();
      sqlite.pragma("foreign_keys = ON");
      expect(() => runMigrations(db)).not.toThrow();
      expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      sqlite.close();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("still fails a run that applied migrations when a violation is present", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "placed-mig-"));
    try {
      const { sqlite, db } = oldDb(tmp, "0006");
      sqlite.pragma("foreign_keys = OFF");
      sqlite.prepare("insert into jobs (id,company_id,ext_id,title,url,first_seen,last_seen) values ('orphan',999,'e','T','u','x','y')").run();
      sqlite.pragma("foreign_keys = ON");
      expect(() => runMigrations(db)).toThrow(/foreign key violation/);
      expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      sqlite.close();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
