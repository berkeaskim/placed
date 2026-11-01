import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import YAML from "yaml";
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from "../auth/local-user";
import { dataDir, db, dbFile } from "../db/client";
import { ensureProfile } from "../db/functions";
import { companies, jobs, type NewJob } from "../db/schema";
import { localSecretKey } from "../settings/secret-key";
import { seedCompanyRows, seedCuratedCompanies } from "../ingest/seed";
import { loadProgrammes } from "../ingest/curated";

/**
 * First-run setup shared by `npm run setup` and the desktop server (PLACED_AUTO_SETUP=1): data dir, secret key,
 * migrations, the local profile, seed companies (+ curated programmes) and, into an empty jobs table, the job snapshot.
 * Idempotent. Seed paths resolve against `root` (default the cwd).
 */
export function ensureLocalSetup(opts: { root?: string; log?: (line: string) => void } = {}): { companies: number; curated: number; jobsInserted: number } {
  const root = opts.root ?? process.cwd();
  const log = opts.log ?? (() => {});
  const at = (p: string) => path.resolve(/*turbopackIgnore: true*/ root, p);
  const dir = dataDir();
  localSecretKey();
  log(`data:     ${dir}`);
  log(`database: ${dbFile()} (migrated)`);
  ensureProfile(LOCAL_USER_ID, LOCAL_USER_EMAIL);

  const programmesFile = at(process.env.PLACED_PROGRAMMES_FILE || "seed/programmes.yml");
  const curated = existsSync(programmesFile) ? seedCuratedCompanies(loadProgrammes(readFileSync(programmesFile, "utf8"))) : [];
  const rows = [...seedCompanyRows(YAML.parse(readFileSync(at("seed/companies.yml"), "utf8")) as unknown[]), ...curated];
  db.transaction((tx) => {
    for (const r of rows) {
      tx.insert(companies).values(r).onConflictDoUpdate({
        target: [companies.ats, companies.slug],
        set: { name: r.name, api_host: r.api_host, employer: r.employer, transport: r.transport, enabled: r.enabled },
      }).run();
    }
  });
  log(`companies: ${rows.length} (${curated.length} curated)`);

  let jobsInserted = 0;
  const jobCount = db.select({ n: count() }).from(jobs).get()?.n ?? 0;
  const snapshot = at("seed/jobs.json");
  if (jobCount === 0 && existsSync(snapshot)) {
    const snap = JSON.parse(readFileSync(snapshot, "utf8")) as ({ company_slug: string; company_ats: string } & Omit<NewJob, "company_id">)[];
    const idOf = new Map(db.select({ id: companies.id, slug: companies.slug, ats: companies.ats }).from(companies).all().map((c) => [`${c.ats}/${c.slug}`, c.id]));
    db.transaction((tx) => {
      for (const { company_slug, company_ats, ...j } of snap) {
        const company_id = idOf.get(`${company_ats}/${company_slug}`);
        if (!company_id) continue;
        jobsInserted += tx.insert(jobs).values({ ...j, company_id }).onConflictDoNothing().run().changes;
      }
    });
    log(`jobs from snapshot: ${jobsInserted}`);
  } else {
    log(`jobs: ${jobCount} already there (seed skipped)`);
  }
  return { companies: rows.length, curated: curated.length, jobsInserted };
}
