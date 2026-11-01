import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import { ensureLocalSetup } from "../lib/setup/first-run";
import { runIngest } from "../lib/ingest/local";

/** One-time local setup: data dir, secret key, migrations, the local profile, and the seed companies/jobs. Re-runnable. */
async function main() {
  ensureLocalSetup({ log: (line) => console.log(line) });
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
