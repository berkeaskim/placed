import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import { db, resetDbForTests } from "@/lib/db/client";
import { ensureProfile } from "@/lib/db/functions";
import { companies, cvs, jobs } from "@/lib/db/schema";
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from "@/lib/auth/local-user";

/** Points PLACED_DATA_DIR at a fresh temp dir for this test file (SQLite + files), with the local profile row. */
export function withTempDb(): { dir: () => string } {
  let dir = "";
  const prev = process.env.PLACED_DATA_DIR;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "placed-cv-"));
    process.env.PLACED_DATA_DIR = dir;
    resetDbForTests();
    ensureProfile(LOCAL_USER_ID, LOCAL_USER_EMAIL);
  });
  afterAll(() => {
    resetDbForTests();
    if (prev === undefined) delete process.env.PLACED_DATA_DIR;
    else process.env.PLACED_DATA_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir: () => dir };
}

export function seedJob(over: Partial<typeof jobs.$inferInsert> = {}, company: Partial<typeof companies.$inferInsert> = {}) {
  const c = db.insert(companies).values({ slug: `co-${crypto.randomUUID().slice(0, 8)}`, name: "Acme", ats: "greenhouse", ...company }).returning().get();
  return db.insert(jobs).values({ company_id: c.id, ext_id: crypto.randomUUID(), title: "Intern", url: "https://job-boards.greenhouse.io/acme/jobs/1", ...over }).returning().get();
}

export function seedCv(over: Partial<typeof cvs.$inferInsert> = {}) {
  return db.insert(cvs).values({
    user_id: LOCAL_USER_ID, storage_path: `${LOCAL_USER_ID}/cv.pdf`, file_size: 1, page_count: 1, raw_text: "x", parsed_json: {} as never, ...over,
  }).returning().get();
}
