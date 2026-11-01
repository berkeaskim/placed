import { describe, expect, it, vi } from "vitest";
import { checkForUpdates, compareVersions, createReleaseSource, latestRelease, RELEASES_API } from "../../desktop/src/lib/updates";

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/berkeaskim/placed/releases/tag/${tag}`,
  published_at: "2026-11-01T10:00:00Z",
  ...extra,
});
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

describe("compareVersions", () => {
  it.each([
    ["1.0.0", "1.0.0", 0],
    ["v1.0.0", "1.0.0", 0],
    ["1.0.1", "1.0.0", 1],
    ["1.0.0", "1.0.1", -1],
    ["1.10.0", "1.9.9", 1],
    ["2.0.0", "1.99.99", 1],
    ["1.2", "1.2.0", 0],
    ["v0.9.0", "v1.0.0", -1],
    ["1.2.3-beta.1", "1.2.3", 0],
  ])("%s vs %s → %i", (a, b, want) => {
    expect(Math.sign(compareVersions(a, b))).toBe(want);
  });
});

describe("latestRelease", () => {
  it("reads version, url and publishedAt from the GitHub API with the right headers", async () => {
    const fetchImpl = ok(release("v1.2.0"));
    expect(await latestRelease(fetchImpl, "1.0.0")).toEqual({
      version: "1.2.0",
      url: "https://github.com/berkeaskim/placed/releases/tag/v1.2.0",
      publishedAt: "2026-11-01T10:00:00Z",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RELEASES_API);
    expect(init.headers).toEqual({ Accept: "application/vnd.github+json", "User-Agent": "placed-desktop/1.0.0" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to the releases page when html_url is not a GitHub https URL", async () => {
    const r = await latestRelease(ok(release("v1.2.0", { html_url: "file:///Applications/Calculator.app" })), "1.0.0");
    expect(r?.url).toBe("https://github.com/berkeaskim/placed/releases/latest");
  });

  it("returns null on a network error, a non-200, malformed JSON or a bad tag", async () => {
    expect(await latestRelease(vi.fn(async () => { throw new TypeError("fetch failed"); }), "1.0.0")).toBeNull();
    expect(await latestRelease(vi.fn(async () => new Response("rate limited", { status: 403 })), "1.0.0")).toBeNull();
    expect(await latestRelease(vi.fn(async () => new Response("{not json", { status: 200 })), "1.0.0")).toBeNull();
    expect(await latestRelease(ok({ message: "Not Found" }), "1.0.0")).toBeNull();
    expect(await latestRelease(ok(release("nightly")), "1.0.0")).toBeNull();
    expect(await latestRelease(ok([1, 2]), "1.0.0")).toBeNull();
  });

  it("gives up after the timeout", async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    expect(await latestRelease(hang, "1.0.0", 20)).toBeNull();
  });
});

describe("checkForUpdates", () => {
  it("is available when GitHub has a newer version", async () => {
    const r = await checkForUpdates({ current: "1.0.0", fetchImpl: ok(release("v1.1.0")) });
    expect(r.status).toBe("available");
    expect(r.latest?.version).toBe("1.1.0");
  });

  it("is current when GitHub has the same or an older version", async () => {
    expect((await checkForUpdates({ current: "1.1.0", fetchImpl: ok(release("v1.1.0")) })).status).toBe("current");
    expect((await checkForUpdates({ current: "1.2.0", fetchImpl: ok(release("v1.1.0")) })).status).toBe("current");
  });

  it("is skipped when the newer version is the one the user skipped", async () => {
    const r = await checkForUpdates({ current: "1.0.0", skipped: "1.1.0", fetchImpl: ok(release("v1.1.0")) });
    expect(r.status).toBe("skipped");
    // A newer release than the skipped one is offered again.
    expect((await checkForUpdates({ current: "1.0.0", skipped: "1.1.0", fetchImpl: ok(release("v1.2.0")) })).status).toBe("available");
  });

  it("is error on a network failure or malformed JSON, with no latest", async () => {
    const offline = await checkForUpdates({ current: "1.0.0", fetchImpl: vi.fn(async () => { throw new TypeError("fetch failed"); }) });
    expect(offline).toEqual({ status: "error" });
    const garbled = await checkForUpdates({ current: "1.0.0", fetchImpl: vi.fn(async () => new Response("<html>", { status: 200 })) });
    expect(garbled).toEqual({ status: "error" });
  });
});

describe("createReleaseSource", () => {
  it("shares one in-flight request between concurrent callers", async () => {
    const fetchImpl = ok(release("v1.1.0"));
    const source = createReleaseSource(fetchImpl, "1.0.0");
    const [a, b] = await Promise.all([
      checkForUpdates({ current: "1.0.0", source }),
      checkForUpdates({ current: "1.0.0", skipped: "1.1.0", source }),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.status).toBe("available");
    expect(b.status).toBe("skipped");
  });

  it("reuses the answer (errors too) for the TTL, then asks GitHub again", async () => {
    let t = 0;
    const fetchImpl = vi.fn(async () => { throw new TypeError("fetch failed"); });
    const source = createReleaseSource(fetchImpl, "1.0.0", { ttlMs: 60_000, now: () => t });
    expect(await source()).toBeNull();
    t = 59_999;
    expect(await source()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 60_000;
    await source();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
