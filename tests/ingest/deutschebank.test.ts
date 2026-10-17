import { describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/ats/deutschebank-search.json";
import { normalizeDeutscheBank, fetchDeutscheBank, deutscheBankUrl } from "@/lib/ingest/providers/deutschebank";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const items = fixture.SearchResult.SearchResultItems.map((i) => i.MatchedObjectDescriptor);
const item = (i: number, country = "Großbritannien und Nordirland") => ({
  MatchedObjectId: String(700 + i),
  MatchedObjectDescriptor: {
    PositionID: String(700 + i), PositionTitle: i % 2 ? "Experienced Hire" : `Internship Programme ${i}`,
    PositionURI: `https://db.recsolu.com/external/requisitions/t${i}`, PositionLocation: [{ CityName: "London", CountryName: country }],
    PublicationStartDate: "2026-10-05", PublicationEndDate: "2026-10-18", CareerLevel: [{ Name: "Analyst" }], JobCategory: [{ Name: "IB" }], PositionHiringYear: "2027",
  },
});
/** Fake beesite: serves slices of `all` by FirstItem/CountItem from the `data` query param and records each request. */
function fake(all: ReturnType<typeof item>[], opts: { total?: number; totalAfter?: number } = {}) {
  const calls: { first: number; count: number; criteria: unknown }[] = [];
  const impl = vi.fn(async (url: string) => {
    const d = JSON.parse(new URL(url).searchParams.get("data") as string);
    const first = d.SearchParameters.FirstItem as number, count = d.SearchParameters.CountItem as number;
    calls.push({ first, count, criteria: d.SearchCriteria });
    const total = calls.length > 1 && opts.totalAfter !== undefined ? opts.totalAfter : opts.total ?? all.length;
    return Response.json({ SearchResult: { SearchResultCount: Math.min(count, all.length - first + 1), SearchResultCountAll: total, SearchResultItems: all.slice(first - 1, first - 1 + count) } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const serve = (body: unknown, status = 200) => vi.fn(async () => status === 200 ? Response.json(body) : new Response("x", { status })) as unknown as typeof fetch;

describe("deutschebank", () => {
  it("normalizes a recorded item", () => {
    const j = normalizeDeutscheBank(items[0])!;
    expect(j.extId).toBe(items[0].PositionID);
    expect(j.title).toBe(items[0].PositionTitle);
    expect(j.url).toBe(items[0].PositionURI);
    expect(j.location).toBe("London, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.postedAt).toBe(items[0].PublicationStartDate);
    expect(j.deadline).toBe(items[0].PublicationEndDate);
    expect(j.html).toContain(items[0].CareerLevel[0].Name);
    expect(j.html).toContain(items[0].JobCategory[0].Name);
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("tolerates a bad end date and missing fields", () => {
    expect(normalizeDeutscheBank({ ...items[0], PublicationEndDate: "garbage" })!.deadline).toBeNull();
    expect(normalizeDeutscheBank({ PositionTitle: "T" })).toBeNull();
    expect(normalizeDeutscheBank(null)).toBeNull();
  });

  it("asks the API for UK (country id 71) with 1-based paging", () => {
    const d = JSON.parse(new URL(deutscheBankUrl("uk", 101)).searchParams.get("data") as string);
    expect(d.SearchParameters.FirstItem).toBe(101);
    expect(d.SearchCriteria).toEqual([{ CriterionName: "PositionLocation.Country", CriterionValue: ["71"] }]);
    expect(() => deutscheBankUrl("fr", 1)).toThrow(/country/);
  });

  it("pages through the listing and keeps passing titles", async () => {
    const all = Array.from({ length: 5 }, (_, i) => item(i));
    const { impl, calls } = fake(all);
    const r = await fetchDeutscheBank("uk", (t) => /internship/i.test(t), impl, async () => {}, 2);
    expect(calls.map((c) => c.first)).toEqual([1, 3, 5]);
    expect(r.listed).toBe(5);
    expect(r.jobs.map((j) => j.extId)).toEqual(["700", "702", "704"]);
  });

  it("fails on partial list", async () => {
    await expect(fetchDeutscheBank("uk", () => true, fake([item(0), item(1)], { total: 9 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchDeutscheBank("uk", () => true, fake([item(0), item(0)]).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("fails when the total changes mid-run", async () => {
    const all = Array.from({ length: 4 }, (_, i) => item(i));
    await expect(fetchDeutscheBank("uk", () => true, fake(all, { totalAfter: 5 }).impl, async () => {}, 2)).rejects.toThrow(/changed/);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchDeutscheBank("uk", () => true, fake([]).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("refuses a non-empty listing with no UK rows", async () => {
    const rows = [item(0, "Japan"), item(1, "Japan")];
    await expect(fetchDeutscheBank("uk", () => true, fake(rows).impl, async () => {})).rejects.toThrow(/no United Kingdom rows/);
  });

  it("rejects a response without SearchResult counts", async () => {
    await expect(fetchDeutscheBank("uk", () => true, serve({ ok: 1 }), async () => {})).rejects.toThrow(/SearchResultCountAll/);
  });

  it("wraps failures as ProviderError starting deutschebank/", async () => {
    const err = await fetchJobs({ ats: "deutschebank", slug: "uk", name: "Deutsche Bank" }, serve({}, 404)).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^deutschebank\//);
    expect(endpointFor({ ats: "deutschebank", slug: "uk", name: "Deutsche Bank" })).toContain("beesite.de");
  });

  it("fails the board when a kept UK row has no PositionURI instead of dropping it", async () => {
    const bad = item(2);
    delete (bad.MatchedObjectDescriptor as { PositionURI?: string }).PositionURI;
    await expect(fetchDeutscheBank("uk", () => true, fake([item(0), bad]).impl, async () => {})).rejects.toThrow(/PositionURI/);
  });
});
