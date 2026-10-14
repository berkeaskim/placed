export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "1",
  autopilot: process.env.NEXT_PUBLIC_AUTOPILOT === "1",
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
