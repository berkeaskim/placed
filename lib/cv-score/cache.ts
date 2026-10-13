import "server-only";
import { createHash } from "node:crypto";
import type { Archetype } from "@/lib/types";
import { RULES } from "@/lib/cv-rules";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Whitespace-normalised so a re-export of the same CV text hashes identically (06 T18). */
export function textHash(redactedText: string): string {
  return sha256(redactedText.replace(/\s+/g, " ").trim());
}

/**
 * Version of everything the judge is asked: the judge-facing fields of every llm rule. Code-rule
 * changes and weight/severity changes don't invalidate cached verdicts (they are recomputed on every score).
 */
export const RULES_VERSION =
  "r-" +
  sha256(
    JSON.stringify(
      RULES.filter((r) => r.check === "llm").map((r) => [r.id, r.sectors, r.llmGuidance, r.passExample, r.failExample, r.allowPartial ?? false]),
    ),
  ).slice(0, 16);

export type CacheKeyParts = { textHash: string; sector: Archetype; rulesVersion: string; modelId: string; promptVersion: string };

/** 06 R2: sha256(normalised redacted text) + sector + rules_version + model_id + prompt_version. */
export function cvScoreCacheKey(p: CacheKeyParts): string {
  return [p.textHash, p.sector, p.rulesVersion, p.modelId, p.promptVersion].join(":");
}
