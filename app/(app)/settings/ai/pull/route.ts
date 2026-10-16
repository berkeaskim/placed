import { ollamaPull, OLLAMA_TAG_RE } from "@/lib/ai/ollama";
import { AiError } from "@/lib/ai/provider";

/**
 * POST { tag } → streams Ollama's /api/pull progress back as NDJSON (one {status,total,completed,error} per line).
 * Single-user local app, so no auth; but a JSON content type is required and a cross-site Origin is refused, so another
 * website open in the browser can't start multi-GB downloads.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Cross-site request refused." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Expected JSON." }, { status: 415 });
  let tag: unknown;
  try {
    tag = ((await request.json()) as { tag?: unknown }).tag;
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (typeof tag !== "string" || !OLLAMA_TAG_RE.test(tag)) return Response.json({ error: "Not a valid Ollama model tag." }, { status: 400 });
  try {
    const body = await ollamaPull(tag, fetch, request.signal); // the client closing the request cancels the pull stream
    return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
  } catch (e) {
    const msg = e instanceof AiError ? "Couldn't reach Ollama. Is it running?" : "Download failed to start.";
    return Response.json({ error: msg }, { status: 502 });
  }
}
