import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveKeyAction, clearKeyAction, setOllamaModelsAction, setProviderAction, setOllamaHostAction } from "@/app/(app)/settings/ai/actions";
import { aiProvider } from "@/lib/ai/config";
import { getSecret, getSetting, setSecret, setSetting } from "@/lib/settings/store";

beforeEach(() => {
  for (const k of ["AI_PROVIDER", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OLLAMA_MODEL"]) delete process.env[k];
  for (const k of ["ai.provider", "ai.ollama.model", "ai.ollama.model.fast", "ai.ollama.model.smart", "ai.ollama.host"]) setSetting(k, null);
  setSecret("ai.anthropic.key", null);
  setSecret("ai.gemini.key", null);
});

describe("AI settings actions", () => {
  it("saves and clears a key as a secret, never returning it", async () => {
    const r = await saveKeyAction("gemini", "  AIzaTestValue1234  ");
    expect(r).toEqual({ ok: true, message: "Key saved." });
    expect(JSON.stringify(r)).not.toContain("1234");
    expect(getSecret("ai.gemini.key")).toBe("AIzaTestValue1234");
    await clearKeyAction("gemini");
    expect(getSecret("ai.gemini.key")).toBeNull();
  });

  it("rejects junk keys and unknown providers", async () => {
    expect((await saveKeyAction("gemini", "short")).ok).toBe(false);
    expect((await saveKeyAction("openai", "sk-1234567890")).ok).toBe(false);
    expect((await setProviderAction("openai")).ok).toBe(false);
    expect((await setOllamaModelsAction("bad tag;", "")).ok).toBe(false);
    expect((await setOllamaHostAction("ftp://x")).ok).toBe(false);
  });

  it("adding a cloud key does not switch away from a working Ollama setup", async () => {
    await setOllamaModelsAction("qwen3.5:9b", "");
    expect(getSetting("ai.provider")).toBe("ollama");
    expect(getSetting("ai.ollama.model")).toBe("qwen3.5:9b");
    await saveKeyAction("anthropic", "sk-ant-test-1234567890");
    expect(aiProvider()).toBe("ollama");
    await setProviderAction("anthropic");
    expect(aiProvider()).toBe("anthropic");
  });

  it("the first configured provider becomes the chosen one", async () => {
    await saveKeyAction("gemini", "AIzaTestValue1234");
    expect(getSetting("ai.provider")).toBe("gemini");
  });
});
