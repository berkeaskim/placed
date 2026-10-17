import { describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/ats/goldmansachs-search.json";
import { normalizeGoldman, fetchGoldman, goldmanBody, GS_PAGE } from "@/lib/ingest/providers/goldmansachs";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

/** Fake GS gateway: `total` roles, `pageSize` at a time; titles alternate internship / senior. */
function fakeGs(total: number, opts: { reportedTotal?: number; dup?: boolean; shrinkAfterFirst?: boolean; status?: number } = {}) {
  const bodies: { page: { pageSize: number; pageNumber: number }; experiences: string[] }[] = [];
  const impl = vi.fn(async (_url: string, init?: RequestInit) => {
    if (opts.status) return new Response("x", { status: opts.status });
    const input = JSON.parse(String(init?.body)).variables.searchQueryInput;
    bodies.push(input);
    const { pageSize, pageNumber } = input.page;
    const offset = pageSize * pageNumber;
    const totalCount = opts.shrinkAfterFirst && pageNumber > 0 ? total - 1 : (opts.reportedTotal ?? total);
    const items = Array.from({ length: Math.max(0, Math.min(pageSize, total - offset)) }, (_, k) => {
      const i = opts.dup ? 0 : offset + k;
      return { roleId: `${100 + i}_GS_CAMPUS`, jobTitle: i % 2 ? "Senior Manager" : `2027 Summer Analyst ${i}`, status: "POSTED",
        externalSource: { sourceId: String(100 + i) }, locations: [{ primary: true, city: "London", country: "United Kingdom" }],
        descriptionHtml: "<p>D</p>", lastPostedDate: "2026-10-06T10:36:15.341Z", endDate: null };
    });
    return Response.json({ data: { roleSearch: { totalCount, items } } });
  }) as unknown as typeof fetch;
  return { impl, bodies };
}

describe("goldmansachs", () => {
  const items = fixture.data.roleSearch.items;

  it("normalizes a recorded item", () => {
    const j = normalizeGoldman(items[0])!;
    expect(j.extId).toBe(items[0].roleId);
    expect(j.title).toBe(items[0].jobTitle);
    expect(j.url).toBe(`https://higher.gs.com/roles/${items[0].externalSource.sourceId}`);
    expect(j.location).toBe("London, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.html).toContain("About the program");
    expect(j.postedAt).toBe("2026-10-06");
    expect(j.deadline ?? null).toBeNull();
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("takes a deadline from endDate and tolerates missing fields", () => {
    expect(normalizeGoldman({ ...items[0], endDate: "2026-11-27T23:00:00Z" })!.deadline).toBe("2026-11-27");
    expect(normalizeGoldman({ ...items[0], lastPostedDate: null })!.postedAt).toBe("2026-10-07");
    expect(normalizeGoldman({ jobTitle: "T" })).toBeNull();
    expect(normalizeGoldman(null)).toBeNull();
  });

  it("asks for UK CAMPUS roles", () => {
    const b = JSON.parse(goldmanBody("uk", 2)).variables.searchQueryInput;
    expect(b.experiences).toEqual(["CAMPUS"]);
    expect(b.page).toEqual({ pageSize: GS_PAGE, pageNumber: 2 });
    expect(b.filters[0].filters[0].filter).toBe("United Kingdom");
    expect(() => goldmanBody("fr", 0)).toThrow(/country/);
  });

  it("pages until totalCount is reached and keeps only passing titles", async () => {
    const { impl, bodies } = fakeGs(GS_PAGE * 2 + 5);
    const r = await fetchGoldman("uk", (t) => /analyst/i.test(t), impl, async () => {});
    expect(r.listed).toBe(GS_PAGE * 2 + 5);
    expect(bodies).toHaveLength(3);
    expect(r.jobs).toHaveLength(Math.ceil((GS_PAGE * 2 + 5) / 2));
  });

  it("fails on partial list", async () => {
    await expect(fetchGoldman("uk", () => true, fakeGs(30, { reportedTotal: 45 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchGoldman("uk", () => true, fakeGs(30, { dup: true }).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchGoldman("uk", () => true, fakeGs(0).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("fails when totalCount changes between pages", async () => {
    await expect(fetchGoldman("uk", () => true, fakeGs(GS_PAGE + 5, { shrinkAfterFirst: true }).impl, async () => {})).rejects.toThrow(/changed/);
  });

  it("wraps failures as ProviderError starting goldmansachs/", async () => {
    const err = await fetchJobs({ ats: "goldmansachs", slug: "uk", name: "Goldman Sachs" }, fakeGs(10, { status: 404 }).impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^goldmansachs\//);
    expect(endpointFor({ ats: "goldmansachs", slug: "uk", name: "Goldman Sachs" })).toContain("api-higher.gs.com");
  });
});
