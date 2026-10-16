/** Starts the background job search (lib/ingest/scheduler.ts) in the Node.js server; never in edge or during `next build`. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startIngestScheduler } = await import("./lib/ingest/scheduler");
  startIngestScheduler();
}
