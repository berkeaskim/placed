import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/local-user";
import { isUuid } from "@/lib/feed/save-result";
import { parseBody, precheck, runGeneration } from "@/lib/cover-letter/generate";

// A local Ollama draft plus its checks and repairs can take minutes.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Streams a cover letter draft or a targeted edit as Server-Sent Events (`phase`, `delta`, `done`, `error`). A route,
 * not a server action, so the words can stream and Next's one-at-a-time server actions are not held up. POST only:
 * a prefetch must never start a paid generation. Closing the request stops the model and marks the draft interrupted.
 */
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { user } = await requireUser();
  const body = parseBody(await request.json().catch(() => null));
  if (!isUuid(jobId) || !body) return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const blocked = precheck(user.id, jobId, body);
  if (blocked) return NextResponse.json({ error: blocked.message }, { status: blocked.status, headers: NO_STORE });

  const ac = new AbortController();
  const stop = () => ac.abort();
  request.signal.addEventListener("abort", stop, { once: true });
  const events = runGeneration(user.id, jobId, body, ac.signal);
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) {
          request.signal.removeEventListener("abort", stop);
          controller.close();
          return;
        }
        controller.enqueue(enc.encode(`event: ${value.event}\ndata: ${JSON.stringify(value.data)}\n\n`));
      } catch (e) {
        console.error("[cover-letter] stream:", e instanceof Error ? e.message : "unknown error");
        controller.close();
      }
    },
    async cancel() {
      ac.abort();
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    headers: { ...NO_STORE, "Content-Type": "text/event-stream; charset=utf-8", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
