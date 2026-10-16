import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { aiApiKey, aiMode, aiProvider, isProviderConfigured } from "@/lib/ai/config";
import { currentModelId, anthropicModel, geminiModel } from "@/lib/ai/models";
import { generateGrounded } from "@/lib/ai/provider";
import { setSecret, setSetting } from "@/lib/settings/store";

const ENV = ["AI_MODE", "AI_PROVIDER", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OLLAMA_MODEL", "OLLAMA_HOST"] as const;
const SETTINGS = ["ai.provider", "ai.ollama.model", "ai.ollama.model.fast", "ai.ollama.model.smart", "ai.anthropic.model.smart", "ai.gemini.model.fast"];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

beforeEach(() => {
  for (const k of ENV) delete process.env[k];
  for (const k of SETTINGS) setSetting(k, null);
  setSecret("ai.anthropic.key", null);
  setSecret("ai.gemini.key", null);
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("provider resolution", () => {
  it("nothing configured: no provider, fixture mode", () => {
    expect(aiProvider()).toBeNull();
    expect(aiMode()).toBe("fixture");
  });

  it("keys saved in settings count as configured (no env needed)", () => {
    setSecret("ai.gemini.key", "g-from-ui");
    expect(aiApiKey("gemini")).toBe("g-from-ui");
    expect(aiProvider()).toBe("gemini");
    expect(aiMode()).toBe("live");
  });

  it("env key wins over the saved key", () => {
    setSecret("ai.anthropic.key", "from-ui");
    process.env.ANTHROPIC_API_KEY = "from-env";
    expect(aiApiKey("anthropic")).toBe("from-env");
  });

  it("first configured order is anthropic, gemini, ollama", () => {
    setSetting("ai.ollama.model", "qwen3.5:9b");
    expect(aiProvider()).toBe("ollama");
    setSecret("ai.gemini.key", "g");
    expect(aiProvider()).toBe("gemini");
    setSecret("ai.anthropic.key", "a");
    expect(aiProvider()).toBe("anthropic");
  });

  it("setting ai.provider picks among configured providers", () => {
    setSecret("ai.anthropic.key", "a");
    setSetting("ai.ollama.model.fast", "qwen3.5:4b");
    setSetting("ai.provider", "ollama");
    expect(aiProvider()).toBe("ollama");
  });

  it("env AI_PROVIDER beats the setting", () => {
    setSecret("ai.anthropic.key", "a");
    setSecret("ai.gemini.key", "g");
    setSetting("ai.provider", "anthropic");
    process.env.AI_PROVIDER = " Gemini ";
    expect(aiProvider()).toBe("gemini");
  });

  it("a chosen provider that is not configured falls through to the first configured one", () => {
    setSecret("ai.gemini.key", "g");
    setSetting("ai.provider", "ollama"); // no ollama model chosen
    expect(isProviderConfigured("ollama")).toBe(false);
    expect(aiProvider()).toBe("gemini");
    setSetting("ai.provider", "nonsense");
    expect(aiProvider()).toBe("gemini");
  });

  it("OLLAMA_MODEL env alone configures ollama", () => {
    process.env.OLLAMA_MODEL = "qwen3.5:4b";
    expect(aiProvider()).toBe("ollama");
  });
});

describe("model ids", () => {
  it("per-provider overrides layer over the pinned defaults", () => {
    expect(anthropicModel("smart")).toBe("claude-sonnet-5-5");
    setSetting("ai.anthropic.model.smart", "claude-opus-5-5");
    expect(anthropicModel("smart")).toBe("claude-opus-5-5");
    expect(geminiModel("fast")).toBe("gemini-3.8-flash");
    setSetting("ai.gemini.model.fast", "gemini-3.8-flash-lite");
    expect(geminiModel("fast")).toBe("gemini-3.8-flash-lite");
  });

  it("currentModelId reports the ollama model per tier", () => {
    setSetting("ai.ollama.model", "qwen3.5:9b");
    setSetting("ai.ollama.model.smart", "qwen3.8:27b");
    expect(currentModelId("fast")).toBe("ollama:qwen3.5:9b");
    expect(currentModelId("smart")).toBe("ollama:qwen3.8:27b");
  });
});

describe("generateGrounded", () => {
  it("returns null for ollama (no web search)", async () => {
    setSetting("ai.ollama.model", "qwen3.5:9b");
    const f = vi.spyOn(globalThis, "fetch");
    await expect(generateGrounded({ system: "s", prompt: "p" })).resolves.toBeNull();
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
});
