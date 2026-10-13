import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type StructuredRequest } from "./provider";
import { ANTHROPIC_MODELS as MODELS } from "./models";

type MessagesClient = Pick<Anthropic, "messages">;
let client: Anthropic | null = null;

/**
 * Uses `messages.create` (not `.parse`): in SDK 0.133 `.parse` throws a raw AnthropicError on invalid
 * JSON / schema mismatch, which would skip our retry and the refusal check. We check `stop_reason`
 * first, then validate the text with the same Zod schema ourselves.
 */
export async function anthropicStructured<T>(req: StructuredRequest<T>, c?: MessagesClient): Promise<T> {
  const api: MessagesClient = c ?? (client ??= new Anthropic()); // reads ANTHROPIC_API_KEY (server only)
  const content: Anthropic.ContentBlockParam[] = req.parts.map((p) =>
    p.type === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } }
      : { type: "text", text: p.text },
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Anthropic.Message;
    try {
      res = await api.messages.create({
        model: MODELS[req.tier],
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
