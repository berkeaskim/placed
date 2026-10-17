import { existsSync, readFileSync } from "node:fs";
import { count, sql } from "drizzle-orm";
import YAML from "yaml";
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from "../lib/auth/local-user";
import { dataDir, db, dbFile } from "../lib/db/client";
import { ensureProfile } from "../lib/db/functions";
import { companies, jobs, type NewJob } from "../lib/db/schema";
import { localSecretKey } from "../lib/settings/secret-key";
import { seedCompanyRows, seedCuratedCompanies } from "../lib/ingest/seed";
import { loadProgrammes } from "../lib/ingest/curated";
import { runIngest } from "../lib/ingest/local";

/** One-time local setup: data dir, secret key, migrations, the local profile, and the seed companies/jobs. Re-runnable. */
async function main() {
  const dir = dataDir();
  localSecretKey();
  console.log(`data:     ${dir}`);
  console.log(`database: ${dbFile()} (migrated)`);
  ensureProfile(LOCAL_USER_ID, LOCAL_USER_EMAIL);

  const programmesFile = process.env.PLACED_PROGRAMMES_FILE || "seed/programmes.yml";
  const curated = existsSync(programmesFile) ? seedCuratedCompanies(loadProgrammes(readFileSync(programmesFile, "utf8"))) : [];
  const rows = [...seedCompanyRows(YAML.parse(readFileSync("seed/companies.yml", "utf8")) as unknown[]), ...curated];
  db.transaction((tx) => {
    for (const r of rows) {
      tx.insert(companies).values(r).onConflictDoUpdate({
        target: [companies.ats, companies.slug],
        set: { name: r.name, api_host: r.api_host, employer: r.employer, transport: r.transport, enabled: r.enabled },
      }).run();
    }
  });
  console.log(`companies: ${rows.length} (${curated.length} curated)`);

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
  await ingestLive();
  db.run(sql`pragma optimize`);
  console.log("\nnext: npm run dev");
}

/** Pulls live postings with the real ingest pipeline. Skipped with --no-ingest or SKIP_INGEST=1; never fails setup. */
async function ingestLive() {
  if (process.argv.includes("--no-ingest") || process.env.SKIP_INGEST === "1") {
    console.log("live jobs: skipped (run `npm run ingest` or press Refresh jobs in the feed later)");
    return;
  }
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // AI keys, if any, for job tagging
  console.log("\nlive jobs: fetching from every company's careers site (a few minutes; Ctrl-C is safe, the seed is already in)");
  try {
    const s = await runIngest({
      onProgress: (p) => console.log(`  [${String(p.done).padStart(3)}/${p.total}] ${p.slug.padEnd(28)} ${p.line}`),
    });
    const secs = Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000);
    console.log(`live jobs: ${s.kept} live, ${s.newJobs} new, from ${s.companies - s.failed}/${s.companies} companies in ${secs}s`);
    if (!s.aiTagging) console.log("  no AI provider yet: jobs were tagged heuristically and get re-tagged on the first refresh after you add one");
  } catch (e) {
    console.log(`live jobs: failed (${e instanceof Error ? e.message : e}); the seed jobs are still there. Retry with \`npm run ingest\`.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
