import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type StructuredRequest } from "./provider";
import { GEMINI_MODELS as MODELS } from "./models";

type ModelsClient = Pick<GoogleGenAI, "models">;
let ai: GoogleGenAI | null = null;

/** Finish reasons that mean the model/policy refused, not that the output was malformed. */
const REFUSAL_FINISH = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

/** Google advises keeping Gemini 3 models at their default temperature, so a requested one is dropped for gemini-3+ ids. */
export const geminiAcceptsTemperature = (model: string) => !/^gemini-([3-9]|\d{2,})/.test(model);

export async function geminiStructured<T>(req: StructuredRequest<T>, c?: ModelsClient): Promise<T> {
  // server only. Transient 429/5xx (Gemini Pro returns 503 under load) are retried with backoff instead of failing straight
  // to the reorder-only fallback; the timeout stops a hung request from holding the function until the platform limit.
  const api: ModelsClient = c ?? (ai ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 240_000, retryOptions: { attempts: 3, initialDelay: 2, maxDelay: 8, httpStatusCodes: [429, 500, 502, 503, 504] } },
  }));
  const parts = req.parts.map((p) =>
    p.type === "pdf" ? { inlineData: { mimeType: "application/pdf", data: p.base64 } } : { text: p.text },
  );
  const jsonSchema = z.toJSONSchema(req.schema);
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
    try {
      res = await api.models.generateContent({
        model: MODELS[req.tier],
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: req.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          maxOutputTokens: req.maxTokens ?? 16000,
          ...(req.thinking === "low" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          ...(req.temperature !== undefined && geminiAcceptsTemperature(MODELS[req.tier]) ? { temperature: req.temperature } : {}),
        },
      });
    } catch (cause) {
      throw new AiError(AI_UNAVAILABLE, { cause });
    }
    const finish = res.candidates?.[0]?.finishReason;
    if (res.promptFeedback?.blockReason || (finish && REFUSAL_FINISH.has(finish))) throw new AiError(AI_REFUSAL);
    try {
      const parsed = req.schema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) return parsed.data;
    } catch {
      // invalid or truncated JSON (e.g. MAX_TOKENS): retry once
    }
  }
  throw new AiError(AI_BAD_FORMAT);
}
