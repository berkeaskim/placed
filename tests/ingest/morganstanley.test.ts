import { describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/ats/morganstanley-resultset.json";
import { normalizeMorganStanley, fetchMorganStanley, morganStanleyUrl } from "@/lib/ingest/providers/morganstanley";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const row = (i: number, country = "United Kingdom") => ({
  jobNumber: String(500 + i), jobTitle: i % 2 ? "Senior Manager" : `2027 Summer Analyst ${i}`, city: "London", country,
  location: `London, ${country}`, url: `https://morganstanley.tal.net/vx/candidate/so/pm/1/pl/1/opp/${500 + i}`,
  applicationDate: "Nov 27, 2026", jobHtmlDescription: "<p>D</p>",
});
const serve = (body: unknown, status = 200) => vi.fn(async () => status === 200 ? Response.json(body) : new Response("x", { status })) as unknown as typeof fetch;

describe("morganstanley", () => {
  const uk = fixture.resultSet.filter((r) => r.country === "United Kingdom");

  it("normalizes a recorded item", () => {
    const j = normalizeMorganStanley(uk[0])!;
    expect(j.extId).toBe(uk[0].jobNumber);
    expect(j.title).toBe(uk[0].jobTitle);
    expect(j.url).toBe(uk[0].url);
    expect(j.location).toBe(uk[0].location);
    expect(j.remote).toBe(false);
    expect(j.html).toBe(uk[0].jobHtmlDescription);
    expect(j.postedAt ?? null).toBeNull();
    expect(j.deadline).toBe("2027-03-31");
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("parses applicationDate and tolerates missing fields", () => {
    expect(normalizeMorganStanley({ ...uk[0], applicationDate: "Nov 27, 2026" })!.deadline).toBe("2026-11-27");
    expect(normalizeMorganStanley({ ...uk[0], applicationDate: "Sept 5, 2026" })!.deadline).toBe("2026-09-05");
    expect(normalizeMorganStanley({ ...uk[0], applicationDate: "garbage" })!.deadline).toBeNull();
    expect(normalizeMorganStanley({ jobTitle: "T" })).toBeNull();
    expect(normalizeMorganStanley(null)).toBeNull();
  });

  it("keeps only UK rows with passing titles from the single worldwide response", async () => {
    const rows = [row(0), row(1), row(2), row(3, "Japan"), row(4, "Japan")];
    const r = await fetchMorganStanley("uk", (t) => /analyst/i.test(t), serve({ totalResults: 5, resultSet: rows }), async () => {});
    expect(r.listed).toBe(3);
    expect(r.jobs.map((j) => j.extId)).toEqual(["500", "502"]);
    expect(() => morganStanleyUrl("fr")).toThrow(/country/);
    expect(morganStanleyUrl("uk")).toContain("opportunity=sg");
  });

  it("fails on partial list", async () => {
    await expect(fetchMorganStanley("uk", () => true, serve({ totalResults: 9, resultSet: [row(0), row(1)] }), async () => {})).rejects.toThrow(/partial/);
    await expect(fetchMorganStanley("uk", () => true, serve({ totalResults: 2, resultSet: [row(0), row(0)] }), async () => {})).rejects.toThrow(/partial/);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchMorganStanley("uk", () => true, serve({ totalResults: 0, resultSet: [] }), async () => {})).rejects.toThrow(/empty listing/);
  });

  it("rejects a response without totalResults/resultSet", async () => {
    await expect(fetchMorganStanley("uk", () => true, serve({ status: "ok" }), async () => {})).rejects.toThrow(/totalResults/);
  });

  it("wraps failures as ProviderError starting morganstanley/", async () => {
    const err = await fetchJobs({ ats: "morganstanley", slug: "uk", name: "Morgan Stanley" }, serve({}, 404)).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^morganstanley\//);
    expect(endpointFor({ ats: "morganstanley", slug: "uk", name: "Morgan Stanley" })).toContain("morganstanley.com");
  });
});
