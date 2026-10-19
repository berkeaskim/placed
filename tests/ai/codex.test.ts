import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { readFileSync } from "node:fs";
import { z } from "zod";
import { codexStream, codexStructured, type CodexRun, type CodexRunner } from "@/lib/ai/codex";
import { aiDeadline, aiProvider, codexBin, isProviderConfigured } from "@/lib/ai/config";
import { currentModelId } from "@/lib/ai/models";
import { AiError, AI_BAD_FORMAT, AI_UNAVAILABLE } from "@/lib/ai/provider";
import { dropOptionalNulls, toStrictSchema } from "@/lib/ai/strict-schema";
import { setCodexEnabledAction, setProviderAction } from "@/app/(app)/settings/ai/actions";
import { setSecret, setSetting, getSetting } from "@/lib/settings/store";

const message = (text: string) => JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } });

/** A fake `codex exec` that records each run and replies with the given event lines. */
function fakeRunner(replies: { lines: string[]; code?: number }[]) {
  const runs: (CodexRun & { schema?: unknown })[] = [];
  const runner: CodexRunner = async (run) => {
    const i = run.args.indexOf("--output-schema");
    runs.push({ ...run, schema: i >= 0 ? JSON.parse(readFileSync(run.args[i + 1], "utf8")) : undefined });
    const r = replies.shift()!;
    for (const l of r.lines) run.onLine?.(l);
    return { code: r.code ?? 0, stderr: "" };
  };
  return { runner, runs };
}

beforeEach(() => {
  for (const k of ["AI_PROVIDER", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OLLAMA_MODEL", "CODEX_BIN"]) delete process.env[k];
  for (const k of ["ai.provider", "ai.codex.enabled", "ai.codex.bin", "ai.codex.model.fast", "ai.codex.model.smart", "ai.ollama.model"]) setSetting(k, null);
  setSecret("ai.anthropic.key", null);
});

describe("toStrictSchema / dropOptionalNulls", () => {
  const schema = z.object({ a: z.string(), b: z.number().optional(), c: z.string().nullable(), list: z.array(z.object({ x: z.string(), y: z.string().optional() })) });
  const json = z.toJSONSchema(schema);

  it("lists every property as required, makes optional ones nullable and closes objects", () => {
    const s = toStrictSchema(json) as { required: string[]; additionalProperties: boolean; properties: Record<string, unknown>; $schema?: string };
    expect(s.required).toEqual(["a", "b", "c", "list"]);
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.b).toEqual({ anyOf: [{ type: "number" }, { type: "null" }] });
    expect(s.$schema).toBeUndefined();
    const item = (s.properties.list as { items: { required: string[]; additionalProperties: boolean } }).items;
    expect(item.required).toEqual(["x", "y"]);
    expect(item.additionalProperties).toBe(false);
  });

  it("drops nulls only where the original schema allowed the key to be absent", () => {
    const raw = { a: "1", b: null, c: null, list: [{ x: "x", y: null }] };
    const cleaned = dropOptionalNulls(raw, json);
    expect(cleaned).toEqual({ a: "1", c: null, list: [{ x: "x" }] });
    expect(schema.safeParse(cleaned).success).toBe(true);
  });
});

describe("codexStructured", () => {
  const schema = z.object({ ok: z.boolean(), note: z.string().optional() });
  const req = { tier: "fast" as const, system: "sys", parts: [{ type: "text" as const, text: "hi" }], schema };

  it("runs codex exec read-only with a strict schema and parses the last agent message", async () => {
    const { runner, runs } = fakeRunner([{ lines: ["{\"type\":\"turn.started\"}", message('{"ok":true,"note":null}')] }]);
    expect(await codexStructured(req, runner)).toEqual({ ok: true });
    const args = runs[0].args;
    expect(args.slice(0, 1)).toEqual(["exec"]);
    expect(args).toEqual(expect.arrayContaining(["--ephemeral", "--ignore-user-config", "--skip-git-repo-check", "--json"]));
    expect(args[args.indexOf("--sandbox") + 1]).toBe("read-only");
    expect(args).not.toContain("-m"); // no model set: the CLI's default
    expect(runs[0].schema).toMatchObject({ required: ["ok", "note"], additionalProperties: false });
    expect(runs[0].stdin).toContain("sys");
    expect(runs[0].stdin).toContain("hi");
  });

  it("passes the chosen model and a higher effort for thinking: high", async () => {
    setSetting("ai.codex.model.smart", "gpt-test");
    const { runner, runs } = fakeRunner([{ lines: [message('{"ok":true}')] }]);
    await codexStructured({ ...req, tier: "smart", thinking: "high" }, runner);
    expect(runs[0].args[runs[0].args.indexOf("-m") + 1]).toBe("gpt-test");
    expect(runs[0].args).toContain('model_reasoning_effort="medium"');
  });

  it("retries once on an invalid answer, then gives AI_BAD_FORMAT", async () => {
    const { runner, runs } = fakeRunner([{ lines: [message("not json")] }, { lines: [message('{"nope":1}')] }]);
    await expect(codexStructured(req, runner)).rejects.toThrow(AI_BAD_FORMAT);
    expect(runs).toHaveLength(2);
  });

  it("a failed run (not signed in, usage limit) is AI_UNAVAILABLE with the CLI's reason as the cause", async () => {
    const { runner } = fakeRunner([{ code: 1, lines: [JSON.stringify({ type: "error", message: "You've hit your usage limit." })] }]);
    const err = (await codexStructured(req, runner).catch((e) => e)) as AiError;
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_UNAVAILABLE);
    expect((err.cause as Error).message).toContain("usage limit");
  });
});

describe("codexStream", () => {
  it("yields the final message in one piece", async () => {
    const { runner } = fakeRunner([{ lines: [message("Dear Hiring Manager")] }]);
    const out: string[] = [];
    for await (const d of codexStream({ tier: "smart", system: "s", prompt: "p" }, runner)) out.push(d);
    expect(out).toEqual(["Dear Hiring Manager"]);
  });
});

describe("codex provider resolution", () => {
  it("an installed CLI alone does not turn AI on; turning it on does", async () => {
    expect(isProviderConfigured("codex")).toBe(false);
    expect(aiProvider()).toBeNull();
    await setCodexEnabledAction(true);
    expect(aiProvider()).toBe("codex");
    expect(getSetting("ai.provider")).toBe("codex");
    const mode = process.env.AI_MODE;
    delete process.env.AI_MODE; // vitest runs in fixture mode
    expect(currentModelId("fast")).toBe("codex:default");
    if (mode !== undefined) process.env.AI_MODE = mode;
    expect(aiDeadline(60_000)).toBe(5 * 60_000);
    await setCodexEnabledAction(false);
    expect(aiProvider()).toBeNull();
  });

  it("picking ChatGPT in the provider picker turns it on, and does not steal from a chosen provider when enabled later", async () => {
    setSecret("ai.anthropic.key", "sk-ant-test");
    setSetting("ai.provider", "anthropic");
    await setCodexEnabledAction(true);
    expect(aiProvider()).toBe("anthropic");
    await setProviderAction("codex");
    expect(aiProvider()).toBe("codex");
  });

  it("finds the binary from CODEX_BIN, then PATH and common install folders", () => {
    process.env.CODEX_BIN = "/x/codex";
    expect(codexBin()).toBe("/x/codex");
    delete process.env.CODEX_BIN;
    expect(codexBin("/home/u", (p) => p === "/home/u/.npm-global/bin/codex")).toBe("/home/u/.npm-global/bin/codex");
    expect(codexBin("/home/u", () => false)).toBe("codex");
  });
});
