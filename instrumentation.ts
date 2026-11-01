/**
 * Starts the background job search (lib/ingest/scheduler.ts) in the Node.js server; never in edge or during `next build`.
 * With PLACED_AUTO_SETUP=1 (the Mac app) it first runs the idempotent first-run setup; a failure is logged, never thrown,
 * so the server still comes up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.PLACED_AUTO_SETUP === "1") {
    try {
      const { ensureLocalSetup } = await import("./lib/setup/first-run");
      const r = ensureLocalSetup();
      console.log(`[placed] first-run setup: ${r.companies} companies (${r.curated} curated), ${r.jobsInserted} jobs added`);
    } catch (e) {
      console.error(`[placed] first-run setup failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  const { startIngestScheduler } = await import("./lib/ingest/scheduler");
  startIngestScheduler();
}
