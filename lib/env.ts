export const env = {
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  autopilot: process.env.NEXT_PUBLIC_AUTOPILOT === "1",
  // Chrome Web Store listing for the Autopilot extension; until it is set, the site offers the packed zip instead.
  autopilotStoreUrl: process.env.NEXT_PUBLIC_AUTOPILOT_STORE_URL ?? "",
};

export type AiProvider = "anthropic" | "gemini";

function hasKey(p: AiProvider) {
  return p === "anthropic" ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(process.env.GEMINI_API_KEY);
}

export function aiProvider(): AiProvider | null {
  const wanted: AiProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase() === "gemini" ? "gemini" : "anthropic";
  if (hasKey(wanted)) return wanted;
  const other: AiProvider = wanted === "anthropic" ? "gemini" : "anthropic";
  return hasKey(other) ? other : null;
}

export function aiMode(): "live" | "fixture" {
  if (process.env.AI_MODE === "fixture") return "fixture";
  return aiProvider() ? "live" : "fixture";
}
