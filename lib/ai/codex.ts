import { spawn, execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { AiError, AI_BAD_FORMAT, AI_UNAVAILABLE, type StreamRequest, type StructuredRequest } from "./provider";
import { codexBin } from "./config";
import { codexModel } from "./models";
import { partsToText } from "./ollama";
import { dropOptionalNulls, toStrictSchema } from "./strict-schema";

/**
 * ChatGPT through the OpenAI Codex CLI (`codex exec`), signed in with the user's ChatGPT account: no API key. Each call
 * is one non-interactive run in an empty temp folder with a read-only sandbox, the user's Codex config ignored (its MCP
 * servers and tools would slow every call), and the session not saved.
 */

export const CODEX_TIMEOUT_MS = 10 * 60_000;
const MAX_PARALLEL = 3;

/** Told up front so the agent answers instead of exploring its (empty) working folder. */
const NO_TOOLS = "Answer directly from the text in this message. Do not run commands, read files or use any tools.";

export type CodexRun = { args: string[]; stdin: string; cwd: string; signal?: AbortSignal; onLine?: (line: string) => void };
export type CodexRunner = (run: CodexRun) => Promise<{ code: number | null; stderr: string }>;

let running = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await run();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const spawnCodex: CodexRunner = ({ args, stdin, cwd, signal, onLine }) =>
  new Promise((resolve, reject) => {
    const child = spawn(codexBin(), args, { cwd, signal, stdio: ["pipe", "pipe", "pipe"], timeout: CODEX_TIMEOUT_MS });
    let stderr = "";
    let buf = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        onLine?.(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr = (stderr + d).slice(-4000)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (buf) onLine?.(buf);
      resolve({ code, stderr });
    });
    child.stdin.end(stdin);
  });

function baseArgs(dir: string, tier: "fast" | "smart", thinking?: "low" | "high"): string[] {
  const model = codexModel(tier);
  return [
    "exec", "--json", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules",
    "--sandbox", "read-only", "--color", "never", "-C", dir,
    "-c", `model_reasoning_effort="${thinking === "high" ? "medium" : "low"}"`,
    ...(model ? ["-m", model] : []),
  ];
}

/** The last error event's message, for the AiError cause (not logged in, unknown model, usage limit...). */
function errorFrom(lines: string[], stderr: string): Error {
  for (const l of [...lines].reverse()) {
    try {
      const ev = JSON.parse(l) as { type?: string; message?: string; error?: { message?: string } };
      if (ev.type === "error" || ev.type === "turn.failed") return new Error((ev.message ?? ev.error?.message ?? l).slice(0, 300));
    } catch {
      // not JSON
    }
  }
  return new Error(stderr.trim().split("\n").slice(-3).join(" ").slice(0, 300) || "codex exited without an answer");
}

/** `agent_message` texts from `codex exec --json` events. */
function agentText(line: string): string | null {
  try {
    const ev = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string } };
    return ev.type === "item.completed" && ev.item?.type === "agent_message" ? (ev.item.text ?? "") : null;
  } catch {
    return null;
  }
}

async function inTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "placed-codex-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function codexStructured<T>(req: StructuredRequest<T>, runner: CodexRunner = spawnCodex): Promise<T> {
  return withSlot(() => inTempDir((dir) => structured(req, dir, runner)));
}

async function structured<T>(req: StructuredRequest<T>, dir: string, runner: CodexRunner): Promise<T> {
  const jsonSchema = z.toJSONSchema(req.schema);
  const schemaFile = path.join(dir, "schema.json");
  await writeFile(schemaFile, JSON.stringify(toStrictSchema(jsonSchema)));
  const prompt = `${req.system}\n\n${NO_TOOLS}\n\n${await partsToText(req.parts)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const lines: string[] = [];
    let text: string | null = null;
    try {
      const { code, stderr } = await runner({
        args: [...baseArgs(dir, req.tier, req.thinking), "--output-schema", schemaFile, "-"],
        stdin: prompt,
        cwd: dir,
        onLine: (l) => {
          lines.push(l);
          text = agentText(l) ?? text;
        },
      });
      if (code !== 0 || text === null) throw errorFrom(lines, stderr);
    } catch (cause) {
      throw new AiError(AI_UNAVAILABLE, { cause });
    }
    try {
      const raw = JSON.parse(text) as unknown;
      const parsed = req.schema.safeParse(dropOptionalNulls(raw, jsonSchema));
      if (parsed.success) return parsed.data;
    } catch {
      // invalid JSON: retry once
    }
  }
  throw new AiError(AI_BAD_FORMAT);
}

/**
 * Free text (cover letters). `codex exec` reports a message once it is complete, not token by token, so the text
 * arrives in one piece. An aborted signal kills the process and ends the stream quietly.
 */
export async function* codexStream(req: StreamRequest, runner: CodexRunner = spawnCodex): AsyncGenerator<string> {
  const texts = await withSlot(() =>
    inTempDir(async (dir) => {
      const lines: string[] = [];
      const out: string[] = [];
      try {
        const { code, stderr } = await runner({
          args: [...baseArgs(dir, req.tier), "-"],
          stdin: `${req.system}\n\n${NO_TOOLS} Reply with the requested text only.\n\n${req.prompt}`,
          cwd: dir,
          signal: req.signal,
          onLine: (l) => {
            lines.push(l);
            const t = agentText(l);
            if (t) out.push(t);
          },
        });
        if (req.signal?.aborted) return [];
        if (code !== 0 || out.length === 0) throw errorFrom(lines, stderr);
      } catch (cause) {
        if (req.signal?.aborted) return [];
        if (cause instanceof AiError) throw cause;
        throw new AiError(AI_UNAVAILABLE, { cause });
      }
      return out;
    }),
  );
  if (texts.length) yield texts[texts.length - 1];
}

export type CodexStatus = { installed: true; bin: string; version: string; loggedIn: boolean; account: string } | { installed: false; bin: string; error: string };

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(bin, args, { timeout: 10_000 }, (err, stdout, stderr) => (err ? reject(err) : resolve(`${stdout}\n${stderr}`.trim()))),
  );
}

/** Whether the CLI runs here and is signed in (`codex login status`), for Settings → AI. */
export async function codexStatus(bin = codexBin()): Promise<CodexStatus> {
  let version: string;
  try {
    version = (await run(bin, ["--version"])).replace(/^codex-cli\s*/i, "").split("\n")[0];
  } catch (e) {
    return { installed: false, bin, error: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
  try {
    const out = await run(bin, ["login", "status"]);
    return { installed: true, bin, version, loggedIn: /logged in/i.test(out), account: out.split("\n")[0] };
  } catch {
    return { installed: true, bin, version, loggedIn: false, account: "Not signed in" };
  }
}
