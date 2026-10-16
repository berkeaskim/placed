import { z } from "zod";
import { extractPdf } from "@/lib/cv/pdf-text";
import { AiError, AI_BAD_FORMAT, AI_UNAVAILABLE, type Part, type StructuredRequest } from "./provider";
import { ollamaHost, ollamaModel } from "./config";
import { httpFetch } from "./http-fetch";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Local models are slow (CPU or a small GPU can take minutes on a CV tailor), so the per-call budget is generous. */
export const OLLAMA_TIMEOUT_MS = 10 * 60_000;
/**
 * Context window requested per call. Ollama's default (4k on many installs) silently truncates a CV plus a job
 * description plus our prompts; 16k fits our largest prompts while staying affordable on 16 GB machines.
 */
export const OLLAMA_NUM_CTX = 16_384;

/**
 * Ollama answers one request per loaded model at a time by default; extra requests wait inside Ollama with no response
 * headers, so callers' timers (and Node fetch's 300 s headers timeout) run out while they queue. Queue them here
 * instead: each call's timeout starts when it is actually sent. OLLAMA_PARALLEL raises the limit for a server started
 * with OLLAMA_NUM_PARALLEL.
 */
let active = 0;
/** Interactive calls (a user is waiting) always go before background ones (job tagging during ingest). */
const waiting = { interactive: [] as (() => void)[], background: [] as (() => void)[] };

function parallelLimit(): number {
  const n = Number(process.env.OLLAMA_PARALLEL);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

async function withSlot<T>(background: boolean, run: () => Promise<T>): Promise<T> {
  if (active >= parallelLimit()) {
    await new Promise<void>((resolve) => waiting[background ? "background" : "interactive"].push(resolve));
  } else {
    active++;
  }
  try {
    return await run();
  } finally {
    // Hand the slot straight to the next caller (active stays the same), or free it.
    const next = waiting.interactive.shift() ?? waiting.background.shift();
    if (next) next();
    else active--;
  }
}

type ChatChunk = { message?: { content?: string }; done?: boolean; done_reason?: string; error?: string };

async function partsToText(parts: Part[]): Promise<string> {
  const out: string[] = [];
  for (const p of parts) {
    if (p.type === "text") {
      out.push(p.text);
      continue;
    }
    // Local models take no PDFs: extract the text layer (unpdf) and send it as text.
    try {
      const { text } = await extractPdf(Uint8Array.from(Buffer.from(p.base64, "base64")));
      out.push(`<document type="pdf">\n${text.trim()}\n</document>`);
    } catch (cause) {
      throw new AiError(AI_BAD_FORMAT, { cause });
    }
  }
  return out.join("\n\n");
}

/**
 * Reads an /api/chat body. We ask for `stream: true` so the response headers arrive at once: with `stream: false` a long
 * local generation trips Node fetch's (undici) 300 s headers timeout before Ollama answers. A single non-streamed JSON
 * object is accepted too.
 */
function readChat(body: string): { content: string; doneReason?: string } {
  let content = "";
  let doneReason: string | undefined;
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    const chunk = JSON.parse(line) as ChatChunk;
    if (chunk.error) throw new Error(chunk.error);
    content += chunk.message?.content ?? "";
    if (chunk.done) doneReason = chunk.done_reason;
  }
  return { content, doneReason };
}

/** Pulls the JSON out of a local model's answer: drops a leading <think> block and Markdown code fences. */
export function extractJson(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();
  return t;
}

export function ollamaStructured<T>(req: StructuredRequest<T>, f: FetchLike = httpFetch): Promise<T> {
  return withSlot(Boolean(req.background), () => structured(req, f));
}

async function structured<T>(req: StructuredRequest<T>, f: FetchLike): Promise<T> {
  const model = ollamaModel(req.tier);
  if (!model) throw new AiError(AI_UNAVAILABLE);
  const schema = z.toJSONSchema(req.schema);
  // Ollama recommends restating the schema in the prompt as well as passing it in `format`.
  const system = `${req.system}\n\nRespond with a single JSON object only, no prose, matching this JSON schema:\n${JSON.stringify(schema)}`;
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: await partsToText(req.parts) },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    let content: string;
    let doneReason: string | undefined;
    try {
      const res = await f(`${ollamaHost()}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          format: schema,
          think: false, // thinking models would spend minutes reasoning before the JSON; ignored by models without it
          keep_alive: "15m",
          options: { num_ctx: OLLAMA_NUM_CTX, num_predict: req.maxTokens ?? 16000, temperature: req.temperature ?? 0.2 },
        }),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      ({ content, doneReason } = readChat(await res.text()));
    } catch (cause) {
      throw new AiError(AI_UNAVAILABLE, { cause });
    }
    if (doneReason !== "length") {
      try {
        const parsed = req.schema.safeParse(JSON.parse(extractJson(content)));
        if (parsed.success) return parsed.data;
      } catch {
        // invalid JSON: retry once below
      }
    }
    // Small models often fix their answer when told what went wrong.
    messages.push(
      { role: "assistant", content: content.slice(0, 4000) },
      { role: "user", content: "That answer was not valid JSON for the schema. Reply again with only the complete JSON object." },
    );
  }
  throw new AiError(AI_BAD_FORMAT);
}

export type OllamaModelInfo = { name: string; sizeBytes: number; parameterSize?: string; quantization?: string };
export type OllamaStatus = { running: true; host: string; version?: string; models: OllamaModelInfo[] } | { running: false; host: string; error: string };

/** Detects a running Ollama (GET /api/tags) and lists its installed models. Never throws. */
export async function ollamaStatus(f: FetchLike = fetch, host = ollamaHost()): Promise<OllamaStatus> {
  try {
    const res = await f(`${host}/api/tags`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!res.ok) return { running: false, host, error: `Ollama answered ${res.status}` };
    const data = (await res.json()) as { models?: { name: string; size?: number; details?: { parameter_size?: string; quantization_level?: string } }[] };
    let version: string | undefined;
    try {
      const v = await f(`${host}/api/version`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
      if (v.ok) version = ((await v.json()) as { version?: string }).version;
    } catch {
      // version is optional
    }
    const models = (data.models ?? [])
      .map((m) => ({ name: m.name, sizeBytes: m.size ?? 0, parameterSize: m.details?.parameter_size, quantization: m.details?.quantization_level }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { running: true, host, version, models };
  } catch (e) {
    return { running: false, host, error: e instanceof Error ? e.message : String(e) };
  }
}

/** True when an installed model name satisfies a library tag ("qwen3" matches "qwen3:latest"). */
export function isInstalled(tag: string, installed: { name: string }[]): boolean {
  const norm = (t: string) => (t.includes(":") ? t : `${t}:latest`);
  return installed.some((m) => norm(m.name) === norm(tag));
}

/** Ollama library tag: "name" or "name:tag", optionally "namespace/name". Rejects anything else before it reaches the host. */
export const OLLAMA_TAG_RE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?(:[a-z0-9][a-z0-9._-]*)?$/i;

export type PullProgress = { status: string; total?: number; completed?: number; error?: string };

/**
 * Starts `POST /api/pull` (streamed) and returns its NDJSON body: one PullProgress per line, ending with
 * `{"status":"success"}` or a line with `error`. Throws AiError(AI_UNAVAILABLE) when Ollama can't be reached.
 */
export async function ollamaPull(tag: string, f: FetchLike = httpFetch, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  if (!OLLAMA_TAG_RE.test(tag)) throw new AiError("Not a valid Ollama model tag.");
  let res: Response;
  try {
    res = await f(`${ollamaHost()}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: tag, stream: true }),
      signal,
    });
  } catch (cause) {
    throw new AiError(AI_UNAVAILABLE, { cause });
  }
  if (!res.ok || !res.body) throw new AiError(AI_UNAVAILABLE, { cause: new Error(`ollama pull ${res.status}`) });
  return res.body;
}
