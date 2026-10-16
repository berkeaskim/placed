import { existsSync, readFileSync } from "node:fs";
import { count, sql } from "drizzle-orm";
import YAML from "yaml";
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from "../lib/auth/local-user";
import { dataDir, db, dbFile } from "../lib/db/client";
import { ensureProfile } from "../lib/db/functions";
import { ATS_VALUES, companies, jobs, type AtsKind, type NewJob } from "../lib/db/schema";
import { localSecretKey } from "../lib/settings/secret-key";
import { runIngest } from "../lib/ingest/local";

/** One-time local setup: data dir, secret key, migrations, the local profile, and the seed companies/jobs. Re-runnable. */
async function main() {
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
