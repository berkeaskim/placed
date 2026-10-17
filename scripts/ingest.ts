import { IngestBusyError, runIngest } from "../lib/ingest/local";
import { ingestDue } from "../lib/ingest/scheduler";
import { discoverIfDue } from "../lib/ingest/discover";

/**
 * `npm run ingest [-- <ats>]`: the same pipeline as the feed's Refresh button.
 * `--if-due` (the background agent, scripts/schedule.ts): run only when the schedule says so, quietly otherwise.
 */
async function main() {
  const args = process.argv.slice(2);
  const ifDue = args.includes("--if-due");
  const ats = args.find((a) => !a.startsWith("--"));
  if (ifDue && !ingestDue()) return;
  if (ifDue) {
    console.log(`[${new Date().toISOString()}] scheduled run`);
    await discoverIfDue();
  }
  const s = await runIngest({
    ats,
    onProgress: (p) => { if (!ifDue || p.error) console.log(`[${String(p.done).padStart(3)}/${p.total}] ${p.slug.padEnd(28)} ${p.line}`); },
  });
  const secs = Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000);
  console.log(`\n${s.companies} companies (${s.failed} failed) in ${secs}s: ${s.kept} live early-career jobs, ${s.newJobs} new, ${s.dead} closed.`);
  if (!s.aiTagging) console.log("No AI provider set up: jobs were tagged heuristically and will be re-tagged once one is.");
}

main().catch((e) => {
  if (e instanceof IngestBusyError && process.argv.includes("--if-due")) return; // the app is already on it
  console.error(e instanceof IngestBusyError ? e.message : e);
  process.exit(1);
});
