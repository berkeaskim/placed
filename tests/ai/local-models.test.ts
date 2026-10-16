import { describe, it, expect } from "vitest";
import { LOCAL_MODELS, LOCAL_TIERS, recommendFor, bytesToGb, SMOKE_TEST_MODEL } from "@/lib/ai/local-models";
import { OLLAMA_TAG_RE } from "@/lib/ai/ollama";

describe("LOCAL_MODELS", () => {
  it("has ~4 tiers, each with exactly one recommended model", () => {
    expect(LOCAL_TIERS).toEqual([8, 16, 32, 64]);
    for (const t of LOCAL_TIERS) expect(LOCAL_MODELS.filter((m) => m.minRamGb === t && m.recommended)).toHaveLength(1);
  });
  it("every tag is a valid Ollama tag and fits its tier with headroom", () => {
    for (const m of LOCAL_MODELS) {
      expect(m.tag).toMatch(OLLAMA_TAG_RE);
      expect(m.sizeGb).toBeLessThanOrEqual(m.minRamGb * 0.6);
    }
    expect(SMOKE_TEST_MODEL.sizeGb).toBeLessThan(1);
  });
});

describe("recommendFor", () => {
  it.each([
    [4, 8, true],
    [8, 8, false],
    [12, 8, false],
    [16, 16, false],
    [24, 16, false], // Berke's 24 GB Mac
    [32, 32, false],
    [48, 32, false],
    [64, 64, false],
    [128, 64, false],
  ])("%d GB -> %d GB tier (tight: %s)", (ram, tier, tight) => {
    const r = recommendFor(ram);
    expect(r.tierGb).toBe(tier);
    expect(r.tight).toBe(tight);
    expect(r.recommended.minRamGb).toBe(tier);
    expect(r.recommended.recommended).toBe(true);
    expect(r.models.every((m) => m.minRamGb === tier)).toBe(true);
  });
  it("recommends qwen3.5:9b on a 24 GB machine", () => {
    expect(recommendFor(24).recommended.tag).toBe("qwen3.5:9b");
  });
  it("bytesToGb rounds os.totalmem() to whole GB", () => {
    expect(bytesToGb(25769803776)).toBe(24);
    expect(bytesToGb(8 * 1024 ** 3 - 50_000_000)).toBe(8);
  });
});
