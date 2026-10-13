import { describe, it, expect, vi } from "vitest";
import gh from "../fixtures/ats/greenhouse.json";
import lever from "../fixtures/ats/lever.json";
import ashby from "../fixtures/ats/ashby.json";
import { normalizeGreenhouse, normalizeLever, normalizeAshby, fetchJobs, endpointFor } from "@/lib/ingest/providers";

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
  });
});
