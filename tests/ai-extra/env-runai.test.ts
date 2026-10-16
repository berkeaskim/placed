import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { aiMode, aiProvider } from "@/lib/ai/config";
import { generateStructured, runAi, AiError } from "@/lib/ai/provider";
import { loadFixture } from "@/lib/ai/fixtures";

const KEYS = ["AI_MODE", "AI_PROVIDER", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
function setEnv(e: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, e);
}
beforeEach(() => setEnv({}));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("aiProvider / aiMode matrix", () => {
  const A = "a-test", G = "g-test";
  it.each([
    // [env, provider, mode]
    [{}, null, "fixture"],
    [{ AI_PROVIDER: "anthropic" }, null, "fixture"],
    [{ ANTHROPIC_API_KEY: A }, "anthropic", "live"],
    [{ GEMINI_API_KEY: G }, "gemini", "live"], // default wants anthropic, falls back to gemini
    [{ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: G }, "gemini", "live"], // the repo's .env.local shape
    [{ AI_PROVIDER: "gemini", GEMINI_API_KEY: G, ANTHROPIC_API_KEY: A }, "gemini", "live"],
    [{ AI_PROVIDER: "anthropic", GEMINI_API_KEY: G, ANTHROPIC_API_KEY: A }, "anthropic", "live"],
    [{ AI_PROVIDER: "gemini", ANTHROPIC_API_KEY: A }, "anthropic", "live"], // wanted provider has no key
    [{ AI_MODE: "fixture", GEMINI_API_KEY: G, ANTHROPIC_API_KEY: A }, "anthropic", "fixture"], // fixture forced, provider still resolvable
    [{ AI_MODE: "fixture", AI_PROVIDER: "gemini", GEMINI_API_KEY: G }, "gemini", "fixture"],
    [{ AI_MODE: "live" }, null, "fixture"], // "live" without any key cannot be honoured
    [{ AI_MODE: "", GEMINI_API_KEY: G }, "gemini", "live"],
  ] as const)("%j -> provider %s, mode %s", (env, provider, mode) => {
    setEnv(env);
    expect(aiProvider()).toBe(provider);
    expect(aiMode()).toBe(mode);
  });

  // BUG (low): lib/env.ts:18 compares AI_PROVIDER with === "gemini", so "Gemini"/"GEMINI"/" gemini" silently
  // select anthropic whenever both keys are set.
  // Fixed: aiProvider() trims and lower-cases AI_PROVIDER before comparing.
  it("AI_PROVIDER is case/whitespace-insensitive", () => {
    setEnv({ AI_PROVIDER: "Gemini ", GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    expect(aiProvider()).toBe("gemini");
  });
});

describe("runAi fixture-vs-live branching", () => {
  const FN = "__ai_extra_runAi__";
  const dir = path.join(process.cwd(), "fixtures", "ai", FN);
  const Raw = z.object({ v: z.number() });
  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "default.json"), JSON.stringify({ v: 1 }));
    writeFileSync(path.join(dir, "keyed.json"), JSON.stringify({ v: 2 }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const calls = { live: 0, fallback: 0 };
  const opts = (extra: object = {}) => ({
    fn: FN, schema: Raw,
    live: async () => { calls.live++; return { v: 99 }; },
    fallback: () => { calls.fallback++; return { v: -1 }; },
    ...extra,
  });
  beforeEach(() => { calls.live = 0; calls.fallback = 0; });

  it("AI_MODE=fixture with keys present: uses the keyed fixture, never live", async () => {
    setEnv({ AI_MODE: "fixture", GEMINI_API_KEY: "g" });
    await expect(runAi(opts({ fixtureKey: "keyed" }))).resolves.toEqual({ v: 2 });
    expect(calls).toEqual({ live: 0, fallback: 0 });
  });

  it("fixture mode falls back to default.json for an unknown key", async () => {
    setEnv({});
    await expect(runAi(opts({ fixtureKey: "missing" }))).resolves.toEqual({ v: 1 });
  });

  it("fixture mode with no fixture dir uses fallback()", async () => {
    setEnv({});
    await expect(runAi(opts({ fn: "__no_such_fn__" }))).resolves.toEqual({ v: -1 });
    expect(calls).toEqual({ live: 0, fallback: 1 });
  });

  it("fixture keys cannot escape fixtures/ai/<fn>/ (path traversal is sanitised)", () => {
    expect(loadFixture(FN, "../../../package")).toEqual({ v: 1 }); // sanitised name misses -> default
    expect(loadFixture("__no_such_fn__", "../../package")).toBeNull();
  });

  it("live mode calls live() only, without fixture or fallback", async () => {
    setEnv({ GEMINI_API_KEY: "g" });
    await expect(runAi(opts({ fixtureKey: "keyed" }))).resolves.toEqual({ v: 99 });
    expect(calls).toEqual({ live: 1, fallback: 0 });
  });

  it("live errors propagate (callers own the fallback decision)", async () => {
    setEnv({ GEMINI_API_KEY: "g" });
    await expect(runAi(opts({ live: async () => { throw new AiError("down"); } }))).rejects.toThrow("down");
    expect(calls.fallback).toBe(0);
  });

  it("generateStructured with no provider throws an AiError", async () => {
    setEnv({});
    await expect(generateStructured({ tier: "fast", system: "", parts: [], schema: Raw })).rejects.toBeInstanceOf(AiError);
  });
});
