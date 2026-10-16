import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type GroundedRequest, type GroundedResult, type StructuredRequest } from "./provider";
import { GEMINI_MODELS as MODELS } from "./models";

type ModelsClient = Pick<GoogleGenAI, "models">;
let ai: GoogleGenAI | null = null;

/** Finish reasons that mean the model/policy refused, not that the output was malformed. */
const REFUSAL_FINISH = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

/** Google advises keeping Gemini 3 models at their default temperature, so a requested one is dropped for gemini-3+ ids. */
export const geminiAcceptsTemperature = (model: string) => !/^gemini-([3-9]|\d{2,})/.test(model);

function client(c?: ModelsClient): ModelsClient {
  return c ?? (ai ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 240_000, retryOptions: { attempts: 3, initialDelay: 2, maxDelay: 8, httpStatusCodes: [429, 500, 502, 503, 504] } },
  }));
}

export async function geminiStructured<T>(req: StructuredRequest<T>, c?: ModelsClient): Promise<T> {
  // server only. Transient 429/5xx (Gemini Pro returns 503 under load) are retried with backoff instead of failing straight
  // to the reorder-only fallback; the timeout stops a hung request from holding the function until the platform limit.
  const api = client(c);
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
          thinkingConfig: { thinkingLevel: req.thinking === "high" ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
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

/**
 * Research call with Google Search grounding. No JSON schema: with a schema in the same call Gemini 3.8 Flash answered
 * without searching (no groundingMetadata, probe 2026-10-16), so structure is a separate generateStructured call.
 */
export async function geminiGrounded(req: GroundedRequest, c?: ModelsClient): Promise<GroundedResult> {
  let res: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
  try {
    res = await client(c).models.generateContent({
      model: MODELS.fast,
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      config: { systemInstruction: req.system, tools: [{ googleSearch: {} }], maxOutputTokens: 12000, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
  } catch (cause) {
    throw new AiError(AI_UNAVAILABLE, { cause });
  }
  const cand = res.candidates?.[0];
  if (res.promptFeedback?.blockReason || (cand?.finishReason && REFUSAL_FINISH.has(cand.finishReason))) throw new AiError(AI_REFUSAL);
  const text = (res.text ?? "").trim();
  if (!text) throw new AiError(AI_BAD_FORMAT);
  const chunks = (cand?.groundingMetadata?.groundingChunks ?? [])
    .flatMap((ch) => (ch.web?.uri ? [{ uri: ch.web.uri, title: ch.web.title ?? "" }] : []));
  return { text, chunks };
}
