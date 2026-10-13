import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runAi } from "@/lib/ai/provider";

describe("runAi", () => {
  beforeEach(() => { process.env.AI_MODE = "fixture"; });
  it("uses the fallback in fixture mode when no fixture file exists", async () => {
    const out = await runAi({
      fn: "nonexistent_fn", schema: z.object({ a: z.number() }),
      live: async () => { throw new Error("must not be called"); },
      fallback: () => ({ a: 1 }),
    });
    expect(out).toEqual({ a: 1 });
  });
});

describe("runAi fromFixture post-processor", () => {
  const FN = "__runAi_fromFixture_test__";
  const dir = path.join(process.cwd(), "fixtures", "ai", FN);
  const Raw = z.object({ snake_value: z.number() });
  const toCamel = (r: z.infer<typeof Raw>) => ({ camelValue: r.snake_value * 10 });
  const saved = { AI_MODE: process.env.AI_MODE, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "default.json"), JSON.stringify({ snake_value: 4 }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("applies fromFixture to schema-parsed fixture data", async () => {
    process.env.AI_MODE = "fixture";
    const out = await runAi({
      fn: FN, schema: Raw, fromFixture: toCamel,
      live: async () => { throw new Error("must not be called"); },
      fallback: () => ({ camelValue: -1 }),
    });
    expect(out).toEqual({ camelValue: 40 });
  });

  it("rejects a fixture that does not match the schema", async () => {
    process.env.AI_MODE = "fixture";
    writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ wrong: true }));
    await expect(runAi({
      fn: FN, fixtureKey: "bad", schema: Raw, fromFixture: toCamel,
      live: async () => ({ camelValue: 0 }),
      fallback: () => ({ camelValue: -1 }),
    })).rejects.toThrow();
  });

  it("does not apply fromFixture to live output", async () => {
    delete process.env.AI_MODE;
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
    let calls = 0;
    const out = await runAi({
      fn: FN, schema: Raw,
      fromFixture: (r) => { calls++; return toCamel(r); },
      live: async () => ({ camelValue: 7 }),
      fallback: () => ({ camelValue: -1 }),
    });
    expect(out).toEqual({ camelValue: 7 });
    expect(calls).toBe(0);
  });
});
