import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/(app)/settings/ai/pull/route";

const url = "http://localhost:3000/settings/ai/pull";
const req = (body: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers: { host: "localhost:3000", "content-type": "application/json", ...headers }, body });

afterEach(() => vi.unstubAllGlobals());

describe("POST /settings/ai/pull", () => {
  it("streams Ollama's pull progress back as NDJSON", async () => {
    const ndjson = '{"status":"pulling manifest"}\n{"status":"pulling abc","digest":"sha256:abc","total":10,"completed":5}\n{"status":"success"}\n';
    const f = vi.fn(async () => new Response(ndjson, { status: 200 }));
    vi.stubGlobal("fetch", f);
    const res = await POST(req('{"tag":"qwen3.5:9b"}', { origin: "http://localhost:3000" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    expect(await res.text()).toBe(ndjson);
    const [calledUrl, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toMatch(/\/api\/pull$/);
    expect(JSON.parse(String(init.body))).toEqual({ model: "qwen3.5:9b", stream: true });
  });

  it("refuses cross-site requests, non-JSON bodies and bad tags without calling Ollama", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await POST(req('{"tag":"qwen3.5:9b"}', { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(req('{"tag":"qwen3.5:9b"}', { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(req('{"tag":"bad tag; rm"}'))).status).toBe(400);
    expect((await POST(req("not json"))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("answers 502 with a readable error when Ollama is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await POST(req('{"tag":"qwen3.5:9b"}'));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Ollama/);
  });
});
