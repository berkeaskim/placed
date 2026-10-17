import { describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/ats/amazon-search.json";
import { normalizeAmazon, fetchAmazon, amazonSearchUrl, AMAZON_PAGE } from "@/lib/ingest/providers/amazon";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

/** Fake amazon.jobs: `total` rows served `result_limit` at a time; titles alternate intern / senior. */
function fakeAmazon(total: number, opts: { reportedHits?: number; dup?: boolean; shrinkAfterFirst?: boolean; status?: number } = {}) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    if (opts.status) return new Response("x", { status: opts.status });
    const u = new URL(url);
    const offset = Number(u.searchParams.get("offset"));
    const limit = Number(u.searchParams.get("result_limit"));
    const hits = opts.shrinkAfterFirst && offset > 0 ? total - 1 : (opts.reportedHits ?? total);
    const jobs = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, k) => {
      const i = opts.dup ? 0 : offset + k;
      return { id_icims: String(1000 + i), title: i % 2 ? "Senior Manager" : `Summer Intern ${i}`, job_path: `/en-gb/jobs/${1000 + i}/x`,
        normalized_location: "London, England, GBR", posted_date: "October  7, 2026", description: "<p>D</p>" };
    });
    return Response.json({ hits, jobs });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("amazon", () => {
  it("normalizes a recorded item", () => {
    const j = normalizeAmazon(fixture.jobs[0])!;
    expect(j.extId).toBe(fixture.jobs[0].id_icims);
    expect(j.title).toBe(fixture.jobs[0].title);
    expect(j.url).toBe(`https://www.amazon.jobs${fixture.jobs[0].job_path}`);
    expect(j.location).toBe("London, England, GBR");
    expect(j.remote).toBe(false);
    expect(j.html).toContain(fixture.jobs[0].description);
    expect(j.html).toContain(fixture.jobs[0].basic_qualifications);
    expect(j.postedAt).toBe("2026-10-16");
    expect(j.deadline ?? null).toBeNull();
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("parses the double-space posted date and tolerates missing fields", () => {
    expect(normalizeAmazon({ id_icims: "1", title: "T", job_path: "/p", posted_date: "October  7, 2026" })!.postedAt).toBe("2026-10-07");
    expect(normalizeAmazon({ id_icims: "1", title: "T", job_path: "/p", posted_date: "garbage" })!.postedAt).toBeNull();
    expect(normalizeAmazon({ title: "T" })).toBeNull();
    expect(normalizeAmazon(null)).toBeNull();
  });

  it("builds the recorded query", () => {
    const u = amazonSearchUrl("uk", 100);
    expect(u).toContain("https://www.amazon.jobs/en-gb/search.json?");
    expect(u).toContain("country=GBR");
    expect(u).toContain("business_category%5B%5D=studentprograms");
    expect(u).toContain("offset=100");
    expect(() => amazonSearchUrl("fr", 0)).toThrow(/country/);
  });

  it("pages until hits is reached and keeps only passing titles", async () => {
    const { impl, calls } = fakeAmazon(AMAZON_PAGE * 2 + 5);
    const r = await fetchAmazon("uk", (t) => /intern/i.test(t), impl, async () => {});
    expect(r.listed).toBe(AMAZON_PAGE * 2 + 5);
    expect(calls).toHaveLength(3);
    expect(r.jobs).toHaveLength(Math.ceil((AMAZON_PAGE * 2 + 5) / 2));
  });

  it("fails on partial list", async () => {
    await expect(fetchAmazon("uk", () => true, fakeAmazon(30, { reportedHits: 45 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchAmazon("uk", () => true, fakeAmazon(30, { dup: true }).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchAmazon("uk", () => true, fakeAmazon(0).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("fails when hits changes between pages", async () => {
    await expect(fetchAmazon("uk", () => true, fakeAmazon(AMAZON_PAGE + 5, { shrinkAfterFirst: true }).impl, async () => {})).rejects.toThrow(/changed|partial/);
  });

  it("wraps failures as ProviderError starting amazon/", async () => {
    const { impl } = fakeAmazon(10, { status: 404 });
    const err = await fetchJobs({ ats: "amazon", slug: "uk", name: "Amazon" }, impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^amazon\//);
    expect(endpointFor({ ats: "amazon", slug: "uk", name: "Amazon" })).toContain("amazon.jobs");
  });

  it("fails the board when a kept posting has no job_path instead of dropping it", async () => {
    const impl = vi.fn(async () => Response.json({ hits: 2, jobs: [
      { id_icims: "1", title: "Summer Intern", job_path: "/en-gb/jobs/1/x" }, { id_icims: "2", title: "Summer Intern 2" },
    ] })) as unknown as typeof fetch;
    await expect(fetchAmazon("uk", () => true, impl, async () => {})).rejects.toThrow(/job_path/);
  });
});
