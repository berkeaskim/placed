import { existsSync, readFileSync } from "node:fs";
import { count, sql } from "drizzle-orm";
import YAML from "yaml";
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from "../lib/auth/local-user";
import { dataDir, db, dbFile } from "../lib/db/client";
import { ensureProfile } from "../lib/db/functions";
import { ATS_VALUES, companies, jobs, type AtsKind, type NewJob } from "../lib/db/schema";
import { localSecretKey } from "../lib/settings/secret-key";

/** One-time local setup: data dir, secret key, migrations, the local profile, and the seed companies/jobs. Re-runnable. */
function main() {
  const dir = dataDir();
  localSecretKey();
  console.log(`data:     ${dir}`);
  console.log(`database: ${dbFile()} (migrated)`);
  ensureProfile(LOCAL_USER_ID, LOCAL_USER_EMAIL);

  type SeedCompany = { slug: string; name: string; ats: string; apiHost?: string; enabled?: boolean };
  const rows = (YAML.parse(readFileSync("seed/companies.yml", "utf8")) as SeedCompany[])
    .filter((r) => (ATS_VALUES as readonly string[]).includes(r.ats))
    .map((r) => ({ slug: r.slug, name: r.name, ats: r.ats as AtsKind, api_host: r.apiHost ?? null, enabled: r.enabled !== false }));
  db.transaction((tx) => {
    for (const r of rows) {
      tx.insert(companies).values(r).onConflictDoUpdate({
        target: [companies.ats, companies.slug],
        set: { name: r.name, api_host: r.api_host, enabled: r.enabled },
      }).run();
    }
  });
  console.log(`companies: ${rows.length}`);

  const jobCount = db.select({ n: count() }).from(jobs).get()?.n ?? 0;
  if (jobCount === 0 && existsSync("seed/jobs.json")) {
    const snap = JSON.parse(readFileSync("seed/jobs.json", "utf8")) as ({ company_slug: string; company_ats: string } & Omit<NewJob, "company_id">)[];
    const idOf = new Map(db.select({ id: companies.id, slug: companies.slug, ats: companies.ats }).from(companies).all().map((c) => [`${c.ats}/${c.slug}`, c.id]));
    let inserted = 0;
    db.transaction((tx) => {
      for (const { company_slug, company_ats, ...j } of snap) {
        const company_id = idOf.get(`${company_ats}/${company_slug}`);
        if (!company_id) continue;
        inserted += tx.insert(jobs).values({ ...j, company_id }).onConflictDoNothing().run().changes;
      }
    });
    console.log(`jobs from snapshot: ${inserted}`);
  } else {
    console.log(`jobs: ${jobCount} already there (seed skipped)`);
  }
  db.run(sql`pragma optimize`);
  console.log("\nnext: npm run dev");
}

main();
