import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  running: false,
  impl: null as null | ((o: { onProgress?: (p: unknown) => void }) => Promise<unknown>),
  runs: 0,
}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/ingest/local", () => {
  class IngestBusyError extends Error { constructor() { super("A job refresh is already running."); } }
  return {
    IngestBusyError,
    ingestRunning: () => s.running,
    lastIngestAt: () => "2026-10-16T09:00:00.000Z",
    runIngest: vi.fn(async (o: { onProgress?: (p: unknown) => void }) => { s.runs++; return s.impl!(o); }),
  };
});

import { revalidateTag } from "next/cache";
import { GET, POST } from "@/app/api/ingest/route";

const post = (headers: Record<string, string> = { origin: "http://localhost:3000", host: "localhost:3000", "sec-fetch-site": "same-origin" }) =>
  POST(new Request("http://localhost:3000/api/ingest", { method: "POST", headers }));
const lines = async (r: Response) => (await r.text()).trim().split("\n").map((l) => JSON.parse(l));

beforeEach(() => {
  s.running = false;
  s.runs = 0;
  s.impl = async (o) => {
    o.onProgress?.({ done: 1, total: 2, slug: "acme", line: "kept=1", error: false });
    o.onProgress?.({ done: 2, total: 2, slug: "boom", line: "ERROR x", error: true });
    return { companies: 2, failed: 1, kept: 1, newJobs: 1, dead: 0, aiTagging: false };
  };
  vi.mocked(revalidateTag).mockClear();
});

describe("/api/ingest", () => {
  it("GET reports whether a run is going and when the last one finished", async () => {
    s.running = true;
    expect(await (await GET()).json()).toEqual({ running: true, lastRun: "2026-10-16T09:00:00.000Z" });
  });

  it("POST streams progress then the summary, and expires the feed cache", async () => {
    const r = await post();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/ndjson/);
    const out = await lines(r);
    expect(out.map((l) => l.type)).toEqual(["progress", "progress", "done"]);
    expect(out[2]).toMatchObject({ newJobs: 1, failed: 1 });
    expect(revalidateTag).toHaveBeenCalledWith("jobs", { expire: 0 });
  });

  it.each([
    ["cross-site fetch", { origin: "https://evil.example", host: "localhost:3000", "sec-fetch-site": "cross-site" }],
    ["foreign origin without fetch metadata", { origin: "https://evil.example", host: "localhost:3000" }],
    ["no origin and no fetch metadata", { host: "localhost:3000" }],
    ["same-site but other port", { origin: "http://localhost:4000", host: "localhost:3000", "sec-fetch-site": "same-site" }],
  ])("%s → 403, no run", async (_n, headers) => {
    expect((await post(headers as Record<string, string>)).status).toBe(403);
    expect(s.runs).toBe(0);
  });

  it("409 while a run is going", async () => {
    s.running = true;
    const r = await post();
    expect(r.status).toBe(409);
    expect(s.runs).toBe(0);
  });

  it("a run that fails (or loses the lock race) ends the stream with an error line", async () => {
    s.impl = async () => { throw new Error("disk full"); };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await lines(await post())).at(-1)).toEqual({ type: "error", error: "The refresh failed. Try again." });
    const { IngestBusyError } = await import("@/lib/ingest/local");
    s.impl = async () => { throw new IngestBusyError(); };
    expect((await lines(await post())).at(-1)).toEqual({ type: "error", error: "A job refresh is already running." });
  });
});
