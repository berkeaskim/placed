import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiError, type StructuredRequest } from "./provider";

const MODELS = { fast: "claude-haiku-4-5", smart: "claude-sonnet-5-5" } as const;
let client: Anthropic | null = null;

export async function anthropicStructured<T>(req: StructuredRequest<T>): Promise<T> {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY (server only)
  const content: Anthropic.ContentBlockParam[] = req.parts.map((p) =>
    p.type === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } }
      : { type: "text", text: p.text },
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.parse({
      model: MODELS[req.tier],
      max_tokens: req.maxTokens ?? 16000,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(req.schema) },
    });
    if (res.stop_reason === "refusal") throw new AiError("The model declined this request.");
    if (res.parsed_output) return res.parsed_output;
  }
  throw new AiError("Model output did not match the expected format.");
}
