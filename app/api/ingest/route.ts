import { revalidateTag } from "next/cache";
import { IngestBusyError, ingestRunning, lastIngestAt, runIngest } from "@/lib/ingest/local";
import { JOBS_TAG } from "@/lib/feed/jobs-cache";

export const dynamic = "force-dynamic";

/** Another site's page in the user's browser must not be able to start a run (no auth locally, so check the origin). */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    return new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

export async function GET() {
  return Response.json({ running: ingestRunning(), lastRun: lastIngestAt() }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * The feed's "Refresh jobs" button: runs the ingest pipeline (same as `npm run ingest`) and streams NDJSON, one
 * `{ type: "progress", ... }` line per company and a final `{ type: "done", ... }` or `{ type: "error", ... }`.
 * 409 when a run is already going.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (ingestRunning()) return Response.json({ error: new IngestBusyError().message }, { status: 409 });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => {
        try { controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`)); } catch { /* client went away; the run continues */ }
      };
      try {
        const summary = await runIngest({ onProgress: (p) => send({ type: "progress", ...p }) });
        try { revalidateTag(JOBS_TAG, { expire: 0 }); } catch { /* the feed's refresh action (updateTag) covers it */ }
        send({ type: "done", ...summary });
      } catch (e) {
        if (!(e instanceof IngestBusyError)) console.error("ingest: run failed", e instanceof Error ? e.message : e);
        send({ type: "error", error: e instanceof IngestBusyError ? e.message : "The refresh failed. Try again." });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
