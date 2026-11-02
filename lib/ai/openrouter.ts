import { z } from "zod";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type GroundedRequest, type GroundedResult, type StreamRequest, type StructuredRequest } from "./provider";
import { aiApiKey } from "./config";
import { openrouterModel } from "./models";
import { partsToText } from "./ollama";
import { dropOptionalNulls, toStrictSchema } from "./strict-schema";

/**
 * OpenRouter: one API key for Claude, Gemini, GPT and hundreds of other models, through an OpenAI-compatible
 * chat-completions API. PDFs are sent as their extracted text (same as Ollama/Codex), so every model can read a CV.
 */

export const OPENROUTER_API = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 4 * 60_000;
const HEADERS = { "HTTP-Referer": "https://github.com/berkeaskim/placed", "X-Title": "Placed" };

export type Fetch = typeof fetch;

type ChatMessage = { role: "system" | "user"; content: string };
type ChatResponse = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[];
  error?: { message?: string; code?: number | string };
};

function key(): string {
  const k = aiApiKey("openrouter");
  if (!k) throw new AiError(AI_UNAVAILABLE, { cause: new Error("No OpenRouter key saved") });
  return k;
}

/** The error message OpenRouter put in a non-2xx body, else the status line. */
async function httpError(res: Response): Promise<Error> {
  let detail = `${res.status} ${res.statusText}`.trim();
  try {
    const body = (await res.json()) as ChatResponse;
    if (body.error?.message) detail = `${res.status}: ${body.error.message}`;
  } catch {
    // not JSON
  }
  return new Error(detail.slice(0, 300));
}

async function post(body: unknown, f: Fetch, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return f(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...HEADERS },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
}

/** A model or route that cannot do strict JSON-schema output: fall back to JSON mode with the schema in the prompt. */
const NO_SCHEMA_SUPPORT = /no endpoints found|support.*(response_format|json_schema|structured)|response_format/i;

export async function openrouterStructured<T>(req: StructuredRequest<T>, f: Fetch = fetch): Promise<T> {
  const jsonSchema = z.toJSONSchema(req.schema);
  const strict = toStrictSchema(jsonSchema);
  const text = await partsToText(req.parts);
  const model = openrouterModel(req.tier);
  let schemaMode = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: ChatMessage[] = [
      { role: "system", content: schemaMode ? req.system : `${req.system}\n\nReply with one JSON object that matches this JSON schema exactly, and nothing else:\n${JSON.stringify(strict)}` },
      { role: "user", content: text },
    ];
    let res: Response;
    try {
      res = await post(
        {
          model,
          messages,
          max_tokens: req.maxTokens ?? 16000,
          ...(schemaMode
            ? { response_format: { type: "json_schema", json_schema: { name: "output", strict: true, schema: strict } }, provider: { require_parameters: true } }
            : { response_format: { type: "json_object" } }),
        },
        f,
      );
    } catch (cause) {
      throw new AiError(AI_UNAVAILABLE, { cause });
    }
    if (!res.ok) {
      const err = await httpError(res);
      if (schemaMode && (res.status === 400 || res.status === 404) && NO_SCHEMA_SUPPORT.test(err.message)) {
        schemaMode = false;
        attempt--;
        continue;
      }
      console.error("openrouter: request failed:", err.message);
      throw new AiError(AI_UNAVAILABLE, { cause: err });
    }
    const body = (await res.json().catch(() => ({}))) as ChatResponse;
    if (body.error?.message) throw new AiError(AI_UNAVAILABLE, { cause: new Error(body.error.message.slice(0, 300)) });
    const choice = body.choices?.[0];
    if (choice?.message?.refusal) throw new AiError(AI_REFUSAL);
    if (choice?.finish_reason === "length") continue; // truncated JSON: retry once
    const content = (choice?.message?.content ?? "").replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
    try {
      const parsed = req.schema.safeParse(dropOptionalNulls(JSON.parse(content), jsonSchema));
      if (parsed.success) return parsed.data;
    } catch {
      // invalid JSON: retry once
    }
  }
  throw new AiError(AI_BAD_FORMAT);
}

/**
 * Free text researched with OpenRouter's web search plugin (company research, interview prep), on the fast model.
 * Sources come back as `url_citation` annotations. A few cents per call, billed to the user's OpenRouter credits.
 */
export async function openrouterGrounded(req: GroundedRequest, f: Fetch = fetch): Promise<GroundedResult> {
  let res: Response;
  try {
    res = await post(
      {
        model: openrouterModel("fast"),
        max_tokens: 12000,
        plugins: [{ id: "web", max_results: 5 }],
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      },
      f,
    );
    if (!res.ok) throw await httpError(res);
  } catch (cause) {
    throw new AiError(AI_UNAVAILABLE, { cause });
  }
  const body = (await res.json().catch(() => ({}))) as ChatResponse & {
    choices?: { message?: { annotations?: { type?: string; url_citation?: { url?: string; title?: string } }[] } }[];
  };
  const msg = body.choices?.[0]?.message;
  if (msg?.refusal) throw new AiError(AI_REFUSAL);
  const text = (msg?.content ?? "").trim();
  if (!text) throw new AiError(AI_BAD_FORMAT);
  const seen = new Set<string>();
  const chunks = (msg?.annotations ?? []).flatMap((a) => {
    const url = a.type === "url_citation" ? a.url_citation?.url : undefined;
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ uri: url, title: a.url_citation?.title ?? "" }];
  });
  return { text, chunks };
}

/** Streams the answer as text deltas from the server-sent events. An aborted signal ends the stream quietly. */
export async function* openrouterStream(req: StreamRequest, f: Fetch = fetch): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await post(
      {
        model: openrouterModel(req.tier),
        stream: true,
        max_tokens: req.maxTokens ?? 8000,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      },
      f,
      req.signal,
    );
    if (!res.ok) throw await httpError(res);
  } catch (cause) {
    if (req.signal?.aborted) return;
    throw new AiError(AI_UNAVAILABLE, { cause });
  }
  const reader = res.body?.getReader();
  if (!reader) throw new AiError(AI_UNAVAILABLE);
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue; // ": OPENROUTER PROCESSING" keep-alives
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        let ev: ChatResponse & { choices?: { delta?: { content?: string | null; refusal?: string | null } }[] };
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.error?.message) throw new AiError(AI_UNAVAILABLE, { cause: new Error(ev.error.message) });
        const delta = ev.choices?.[0]?.delta;
        if (delta?.refusal) throw new AiError(AI_REFUSAL);
        if (delta?.content) yield delta.content;
      }
    }
  } catch (cause) {
    if (req.signal?.aborted) return;
    if (cause instanceof AiError) throw cause;
    throw new AiError(AI_UNAVAILABLE, { cause });
  } finally {
    reader.releaseLock();
  }
}

export type OpenRouterModel = { id: string; name: string; promptPerM: number; completionPerM: number; context: number };

let modelsCache: { at: number; models: OpenRouterModel[] } | null = null;

/** Text models that support structured outputs (Placed needs JSON), from the public model list. Cached for an hour. */
export async function openrouterModels(f: Fetch = fetch): Promise<OpenRouterModel[]> {
  if (modelsCache && Date.now() - modelsCache.at < 60 * 60_000) return modelsCache.models;
  const res = await f(`${OPENROUTER_API}/models`, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw await httpError(res);
  const body = (await res.json()) as {
    data?: { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[]; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }[];
  };
  const models = (body.data ?? [])
    .filter((m) => !m.id.endsWith(":batch") && (m.supported_parameters ?? []).includes("structured_outputs"))
    .filter((m) => (m.architecture?.output_modalities ?? ["text"]).includes("text") && (m.architecture?.input_modalities ?? ["text"]).includes("text"))
    .map((m) => ({
      id: m.id,
      name: (m.name ?? m.id).replace(/^[^:]+:\s*/, ""),
      promptPerM: Number(m.pricing?.prompt ?? 0) * 1e6,
      completionPerM: Number(m.pricing?.completion ?? 0) * 1e6,
      context: m.context_length ?? 0,
    }));
  modelsCache = { at: Date.now(), models };
  return models;
}

export type OpenRouterKeyInfo = { label: string | null; usage: number; limitRemaining: number | null };

/** Checks a key without spending credits (`GET /key`). Throws with OpenRouter's reason when the key is rejected. */
export async function openrouterKeyInfo(apiKey: string, f: Fetch = fetch): Promise<OpenRouterKeyInfo> {
  const res = await f(`${OPENROUTER_API}/key`, { headers: { Authorization: `Bearer ${apiKey}`, ...HEADERS }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw await httpError(res);
  const { data } = (await res.json()) as { data?: { label?: string; usage?: number; limit_remaining?: number | null } };
  return { label: data?.label ?? null, usage: data?.usage ?? 0, limitRemaining: data?.limit_remaining ?? null };
}
