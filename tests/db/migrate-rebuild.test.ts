import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "@/lib/db/migrate";

describe("runMigrations table rebuilds", () => {
  it("keeps jobs when 0005 rebuilds companies, and leaves foreign keys on", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "placed-mig-"));
    try {
      const old = path.join(tmp, "old");
      cpSync("drizzle", old, { recursive: true });
      const journalPath = path.join(old, "meta", "_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      journal.entries = journal.entries.filter((e: { tag: string }) => !e.tag.startsWith("0005"));
      writeFileSync(journalPath, JSON.stringify(journal));

      const sqlite = new Database(path.join(tmp, "t.db"));
      sqlite.pragma("foreign_keys = ON");
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: old });
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
});
