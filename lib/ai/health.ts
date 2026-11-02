import { getSetting, setSetting } from "@/lib/settings/store";
import type { AiProvider } from "./config";
import type { Tier } from "./models";

/**
 * The last real test call per provider and tier, so Settings → AI can say whether the chosen model actually answers
 * (not only whether a key is saved). Written by testConnectionAction; cleared when the key or model changes.
 */
export type AiHealth = { ok: boolean; model: string; ms: number; at: string; error?: string };

const settingKey = (p: AiProvider, tier: Tier) => `ai.health.${p}.${tier}`;

export function readHealth(p: AiProvider, tier: Tier): AiHealth | null {
  try {
    const raw = getSetting(settingKey(p, tier));
    return raw ? (JSON.parse(raw) as AiHealth) : null;
  } catch {
    return null;
  }
}

export function writeHealth(p: AiProvider, tier: Tier, h: AiHealth | null): void {
  setSetting(settingKey(p, tier), h ? JSON.stringify(h) : null);
}

export function clearHealth(p: AiProvider): void {
  writeHealth(p, "fast", null);
  writeHealth(p, "smart", null);
}
