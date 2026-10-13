import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type StructuredRequest } from "./provider";

const MODELS = { fast: "gemini-3.8-flash", smart: "gemini-3.1-pro-preview" } as const;
type ModelsClient = Pick<GoogleGenAI, "models">;
let ai: GoogleGenAI | null = null;

/** Finish reasons that mean the model/policy refused, not that the output was malformed. */
const REFUSAL_FINISH = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

export async function geminiStructured<T>(req: StructuredRequest<T>, c?: ModelsClient): Promise<T> {
  const api: ModelsClient = c ?? (ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })); // server only
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
