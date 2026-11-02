import type { AiProvider } from "./config";

/** Display names for the AI providers (Settings, score footers). Safe to import from client components. */
export const PROVIDER_LABEL: Record<AiProvider, string> = {
  openrouter: "OpenRouter",
  anthropic: "Claude",
  gemini: "Gemini",
  ollama: "Ollama (on this Mac)",
  codex: "ChatGPT (Codex CLI)",
};

/** "anthropic/claude-sonnet-5.5" → "claude-sonnet-5.5": the part after the vendor slash, for compact labels. */
export const shortModel = (id: string) => id.split("/").pop() ?? id;
