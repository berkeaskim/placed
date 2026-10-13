import { describe, it, expect, afterEach } from "vitest";
import { ARCHETYPES, YEARS } from "@/lib/types";
import { aiMode, aiProvider } from "@/lib/env";

describe("shared types", () => {
  it("has the 8 archetypes and 5 years from the spec", () => {
    expect(ARCHETYPES).toHaveLength(8);
    expect(YEARS).toEqual(["1st", "2nd", "penultimate", "final", "masters"]);
  });
});

describe("aiMode", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it("is fixture when no key is configured", () => {
    delete process.env.AI_MODE;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(aiMode()).toBe("fixture");
    expect(aiProvider()).toBeNull();
  });
  it("falls back to the provider that has a key", () => {
    delete process.env.AI_MODE;
    process.env.AI_PROVIDER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = "test";
    expect(aiProvider()).toBe("gemini");
    expect(aiMode()).toBe("live");
  });
  it("respects AI_MODE=fixture", () => {
    process.env.AI_MODE = "fixture";
    expect(aiMode()).toBe("fixture");
  });
});
