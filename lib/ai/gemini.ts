import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AiError, type StructuredRequest } from "./provider";

const MODELS = { fast: "gemini-3.8-flash", smart: "gemini-3.1-pro-preview" } as const;
let ai: GoogleGenAI | null = null;

export async function geminiStructured<T>(req: StructuredRequest<T>): Promise<T> {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // server only
  const parts = req.parts.map((p) =>
    p.type === "pdf" ? { inlineData: { mimeType: "application/pdf", data: p.base64 } } : { text: p.text },
  );
  const jsonSchema = z.toJSONSchema(req.schema);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ai.models.generateContent({
      model: MODELS[req.tier],
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: req.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        maxOutputTokens: req.maxTokens ?? 16000,
      },
    });
    try {
      const parsed = req.schema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) return parsed.data;
    } catch {
      // invalid JSON: retry once
    }
  }
  throw new AiError("Model output did not match the expected format.");
}
