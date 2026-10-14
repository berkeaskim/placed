import { describe, it, expect, vi } from "vitest";
import { getJson, RETRY_DELAYS_MS } from "@/lib/ingest/providers/http";

const noSleep = vi.fn(async () => {});

describe("getJson", () => {
  it("retries a timed-out request, then succeeds", async () => {
    let n = 0;
    const impl = vi.fn(async () => {
      if (n++ === 0) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return Response.json({ ok: 1 });
    }) as unknown as typeof fetch;
    expect(await getJson("https://x", impl, undefined, noSleep)).toEqual({ ok: 1 });
    expect(impl).toHaveBeenCalledTimes(2);
  });
  it("gives up after the retry budget on persistent network errors", async () => {
    const impl = vi.fn(async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    await expect(getJson("https://x", impl, undefined, noSleep)).rejects.toThrow(/ECONNRESET/);
    expect(impl).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });
  it("does not retry a 404", async () => {
    const impl = vi.fn(async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(getJson("https://x", impl, undefined, noSleep)).rejects.toThrow(/404/);
    expect(impl).toHaveBeenCalledTimes(1);
  });
});
