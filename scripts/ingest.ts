import { IngestBusyError, runIngest } from "../lib/ingest/local";

/** `npm run ingest [-- <ats>]`: the same pipeline as the feed's Refresh button. */
async function main() {
  const s = await runIngest({
    ats: process.argv[2],
    onProgress: (p) => console.log(`[${String(p.done).padStart(3)}/${p.total}] ${p.slug.padEnd(28)} ${p.line}`),
  });
  const secs = Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000);
  console.log(`\n${s.companies} companies (${s.failed} failed) in ${secs}s: ${s.kept} live early-career jobs, ${s.newJobs} new, ${s.dead} closed.`);
  if (!s.aiTagging) console.log("No AI provider set up: jobs were tagged heuristically and will be re-tagged once one is.");
}

main().catch((e) => {
  console.error(e instanceof IngestBusyError ? e.message : e);
  process.exit(1);
});
