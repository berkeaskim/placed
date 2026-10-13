import { describe, it, expect, vi } from "vitest";
import gh from "../fixtures/ats/greenhouse.json";
import lever from "../fixtures/ats/lever.json";
import ashby from "../fixtures/ats/ashby.json";
import { normalizeGreenhouse, normalizeLever, normalizeAshby, fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";

function assertRawJobs(jobs: ReturnType<typeof normalizeLever>) {
  expect(jobs.length).toBeGreaterThan(0);
  for (const j of jobs) {
    expect(j.extId).toBeTruthy();
    expect(j.title).toBeTruthy();
    expect(j.url).toMatch(/^https:\/\//);
    expect(typeof j.location).toBe("string");
    expect(typeof j.remote).toBe("boolean");
    expect(typeof j.html).toBe("string");
  }
}

describe("provider normalizers (recorded real responses)", () => {
  it("greenhouse", () => assertRawJobs(normalizeGreenhouse(gh, "marshallwace")));
  it("lever", () => assertRawJobs(normalizeLever(lever)));
  it("ashby", () => assertRawJobs(normalizeAshby(ashby)));
  it("returns [] for malformed payloads instead of throwing", () => {
    expect(normalizeGreenhouse({ nope: 1 }, "x")).toEqual([]);
    expect(normalizeLever({})).toEqual([]);
    expect(normalizeAshby(null)).toEqual([]);
  });
});

describe("endpointFor", () => {
  it("uses the EU host when configured", () => {
    expect(endpointFor({ slug: "mangroup", name: "Man", ats: "greenhouse", apiHost: "boards-api.eu.greenhouse.io" }))
      .toBe("https://boards-api.eu.greenhouse.io/v1/boards/mangroup/jobs?content=true");
  });
});

describe("fetchJobs", () => {
  it("throws ProviderError on non-2xx", async () => {
    const fake = vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchJobs({ slug: "x", name: "X", ats: "lever" }, fake)).rejects.toThrow(/404/);
    await expect(fetchJobs({ slug: "x", name: "X", ats: "lever" }, fake)).rejects.toBeInstanceOf(ProviderError);
  });
  it("throws ProviderError on a 200 with a non-JSON body", async () => {
    const fake = vi.fn(async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch;
    const p = fetchJobs({ slug: "x", name: "X", ats: "ashby" }, fake);
    await expect(p).rejects.toBeInstanceOf(ProviderError);
    await expect(p).rejects.toThrow(/ashby\/x/);
  });
  it("throws ProviderError when fetch itself rejects", async () => {
    const fake = vi.fn(async () => { throw new Error("boom"); }) as unknown as typeof fetch;
    await expect(fetchJobs({ slug: "x", name: "X", ats: "greenhouse" }, fake)).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("malformed entries are skipped, not thrown on", () => {
  it("greenhouse", () => {
    const out = normalizeGreenhouse({ jobs: [...gh.jobs, null, { id: 1 }, { title: "t" }] }, "x");
    expect(out).toHaveLength(gh.jobs.length);
  });
  it("lever", () => {
    const out = normalizeLever([...lever, null, { id: "a" }, { text: "t" }]);
    expect(out).toHaveLength(lever.length);
  });
  it("ashby", () => {
    const out = normalizeAshby({ jobs: [...ashby.jobs, null, { id: "a" }, { title: "t" }] });
    expect(out).toHaveLength(ashby.jobs.length);
  });
});
