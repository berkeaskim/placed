import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type StreamRequest, type StructuredRequest } from "./provider";
import { anthropicModel } from "./models";
import { aiApiKey } from "./config";

type MessagesClient = Pick<Anthropic, "messages">;
let cached: { key: string; client: Anthropic } | null = null;

/** One client per API key: the key is read on every call (env, then Settings → AI), so a key saved in the UI applies without a restart. */
function defaultClient(): Anthropic {
  const key = aiApiKey("anthropic");
  if (!key) throw new AiError(AI_UNAVAILABLE);
  if (cached?.key !== key) cached = { key, client: new Anthropic({ apiKey: key }) };
  return cached.client;
}

/**
 * Uses `messages.create` (not `.parse`): in SDK 0.133 `.parse` throws a raw AnthropicError on invalid
 * JSON / schema mismatch, which would skip our retry and the refusal check. We check `stop_reason`
 * first, then validate the text with the same Zod schema ourselves.
 */
export async function anthropicStructured<T>(req: StructuredRequest<T>, c?: MessagesClient): Promise<T> {
  const api: MessagesClient = c ?? defaultClient(); // server only
  const content: Anthropic.ContentBlockParam[] = req.parts.map((p) =>
    p.type === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } }
      : { type: "text", text: p.text },
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Anthropic.Message;
    try {
      res = await api.messages.create({
        model: anthropicModel(req.tier),
        max_tokens: req.maxTokens ?? 16000,
        // never `temperature`: models released after Claude Opus 4.6 (our pinned Sonnet 5.5 / Haiku 4.5 tiers) reject it with a 400
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(req.schema) },
      });
    } catch (cause) {
      throw new AiError(AI_UNAVAILABLE, { cause });
    }
    if (res.stop_reason === "refusal") throw new AiError(AI_REFUSAL);
    if (res.stop_reason === "max_tokens") continue; // truncated JSON: retry once
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      const parsed = req.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {
      // invalid JSON: retry once
    }
  }
  throw new AiError(AI_BAD_FORMAT);
}

/** Streams the answer as text deltas (`text_delta` events). An aborted signal ends the stream quietly. */
export async function* anthropicStream(req: StreamRequest, c?: MessagesClient): AsyncGenerator<string> {
  const api: MessagesClient = c ?? defaultClient();
  try {
    const stream = api.messages.stream(
      {
        model: anthropicModel(req.tier),
        max_tokens: req.maxTokens ?? 8000,
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.prompt }],
      },
      { signal: req.signal },
    );
    for await (const ev of stream) {
      if (req.signal?.aborted) return;
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
      else if (ev.type === "message_delta" && ev.delta.stop_reason === "refusal") throw new AiError(AI_REFUSAL);
    }
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    if (req.signal?.aborted) return;
    throw new AiError(AI_UNAVAILABLE, { cause });
  }
}
