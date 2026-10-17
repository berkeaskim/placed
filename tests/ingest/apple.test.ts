import { describe, it, expect, vi } from "vitest";
import search from "../fixtures/ats/apple-search.json";
import detail from "../fixtures/ats/apple-detail.json";
import { normalizeApple, fetchApple, appleSearchUrl, extractApplePage, APPLE_PAGE } from "@/lib/ingest/providers/apple";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

/** The page embeds its data the way jobs.apple.com does: window.__staticRouterHydrationData = JSON.parse("<json string literal>"). */
const html = (data: unknown) =>
  `<html><head></head><body><script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify(data))});</script><div id="portal"></div></body></html>`;
const page = (rows: unknown[], total: number) => html({ loaderData: { search: { searchResults: rows, totalRecords: total } } });
const detailPage = (id: string, over: Record<string, unknown> = {}) =>
  html({ loaderData: { jobDetails: { jobsData: { ...detail.loaderData.jobDetails.jobsData, positionId: id, jobNumber: id, ...over } } } });
const ok = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } });

const rows = search.loaderData.search.searchResults;

/** Fake jobs.apple.com: `total` UK rows, APPLE_PAGE per page; even indexes are early-career, odd are senior. */
function fakeApple(total: number, opts: { reportedTotal?: number; hide?: number; drift?: boolean; shrinkAfterFirst?: boolean; status?: number; badDetail?: "soft" | "nomarker"; nonUk?: boolean; noMarker?: boolean; dupLocations?: boolean; flakyPage?: number; deadPage?: number } = {}) {
  const calls: string[] = [];
  const row = (i: number) => ({
    ...rows[1], id: String(7000 + i), positionId: String(7000 + i),
    postingTitle: i % 2 ? `Senior Engineer ${i}` : `Early Career Engineer ${i}`, transformedPostingTitle: `title-${i}`,
    locations: [{ postLocationId: "postLocation-LOND", city: "", countryName: opts.nonUk ? "France" : "United Kingdom", metro: "", name: "London Metro Area", countryID: "iso-country-GBR", level: 4 }],
  });
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    if (opts.status) return new Response("x", { status: opts.status });
    const u = new URL(url);
    if (u.pathname.includes("/details/")) {
      if (opts.badDetail === "soft") return ok("<html><body>Please try again later</body></html>");
      if (opts.badDetail === "nomarker") return ok(html({ loaderData: { jobDetails: {} } }));
      return ok(detailPage(u.pathname.split("/")[3]));
    }
    if (opts.noMarker) return ok("<html><body>Access denied</body></html>");
    const p = Number(u.searchParams.get("page"));
    if (p === opts.deadPage || (p === opts.flakyPage && !calls.slice(0, -1).some((c) => c.includes(`page=${p}`)))) return ok(page([], 0));
    const reported = p > 1 && opts.shrinkAfterFirst ? total - 1 : (opts.reportedTotal ?? total);
    const ids = Array.from({ length: total }, (_, i) => i).filter((i) => i !== opts.hide);
    const shift = opts.drift && p > 1 ? 1 : 0;
    const slice = ids.slice((p - 1) * APPLE_PAGE + shift, p * APPLE_PAGE + shift).map(row);
    return ok(page(slice, reported));
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("apple", () => {
  it("normalizes a recorded row with its detail text", () => {
    const r = rows.find((x) => /Early Career/.test(x.postingTitle))!;
    const d = detail.loaderData.jobDetails.jobsData;
    const j = normalizeApple(r, d)!;
    expect(j.extId).toBe(r.positionId);
    expect(j.title).toBe(r.postingTitle);
    expect(j.url).toBe(`https://jobs.apple.com/en-gb/details/${r.positionId}/${r.transformedPostingTitle}`);
    expect(j.location).toBe("Cambridge, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.html).toContain(d.description.slice(0, 40));
    expect(j.html).toContain("BSc/MSEE/MEng/PhD");
    expect(j.postedAt).toBe(new Date(r.postDateInGMT).toISOString());
    expect(j.deadline ?? null).toBeNull();
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("merges the per-location rows of one position and falls back to list text without a detail", () => {
    const multi = rows.filter((x) => x.positionId === "200679847");
    expect(multi.length).toBeGreaterThan(1);
    const j = normalizeApple(multi, null)!;
    expect(j.location.split("; ").length).toBe(multi.length);
    expect(j.location).toContain("Birmingham, United Kingdom");
    expect(j.html).toContain(multi[0].jobSummary.slice(0, 30));
    expect(normalizeApple([], null)).toBeNull();
    expect(normalizeApple([{ positionId: "1" }], null)).toBeNull();
  });

  it("escapes ids in the url and rejects non-numeric position ids", () => {
    expect(normalizeApple([{ ...rows[0], positionId: "12 3/4" }], null)).toBeNull();
    expect(normalizeApple([{ ...rows[0], transformedPostingTitle: "../../x?y" }], null)!.url).toBe(`https://jobs.apple.com/en-gb/details/${rows[0].positionId}`);
  });

  it("builds a UK search url and rejects unknown country slugs", () => {
    const u = new URL(appleSearchUrl("uk", 3));
    expect(u.host).toBe("jobs.apple.com");
    expect(u.searchParams.get("location")).toBe("united-kingdom-GBR");
    expect(u.searchParams.get("page")).toBe("3");
    expect(() => appleSearchUrl("../x", 1)).toThrow();
  });

  it("extracts only the hydration literal and fails when it or the expected keys are missing", () => {
    expect(extractApplePage(page(rows, 5), "search").totalRecords).toBe(5);
    expect(extractApplePage(detailPage("1"), "jobDetails").jobsData.jobSummary).toBe(detail.loaderData.jobDetails.jobsData.jobSummary);
    expect(() => extractApplePage("<html>Access denied</html>", "search")).toThrow(/hydration/);
    expect(() => extractApplePage(html({ loaderData: {} }), "search")).toThrow(/search/);
    expect(() => extractApplePage(html({ loaderData: { search: { searchResults: "x", totalRecords: 1 } } }), "search")).toThrow(/search/);
    expect(() => extractApplePage(html({ loaderData: { search: { searchResults: [], totalRecords: "1" } } }), "search")).toThrow(/search/);
    expect(() => extractApplePage('<script>window.__staticRouterHydrationData = JSON.parse("{not json");</script>', "search")).toThrow(/hydration/);
  });

  it("pages until total is reached, title-filters before detail calls, and fetches details only for kept rows", async () => {
    const total = APPLE_PAGE * 2 + 4;
    const { impl, calls } = fakeApple(total);
    const r = await fetchApple("uk", (t) => /early career/i.test(t), impl, async () => {});
    expect(r.listed).toBe(total);
    expect(r.jobs).toHaveLength(Math.ceil(total / 2));
    expect(calls.filter((u) => u.includes("/search"))).toHaveLength(3);
    expect(calls.filter((u) => u.includes("/details/"))).toHaveLength(r.jobs.length);
    expect(r.jobs[0].html).toContain("BSc/MSEE/MEng/PhD");
    expect(r.jobs.every((j) => j.url.startsWith("https://jobs.apple.com/en-gb/details/"))).toBe(true);
  });

  it("fails on partial list", async () => {
    await expect(fetchApple("uk", () => false, fakeApple(30, { reportedTotal: 45 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchApple("uk", () => false, fakeApple(30, { hide: 5, drift: true }).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("accepts a one-row phantom total only after two identical listings", async () => {
    const { impl, calls } = fakeApple(25, { reportedTotal: 26 });
    const r = await fetchApple("uk", () => false, impl, async () => {});
    expect(r.listed).toBe(25);
    expect(calls.filter((u) => /page=1(&|$)/.test(u))).toHaveLength(2);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchApple("uk", () => true, fakeApple(0).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("retries a page that answers HTTP 200 with total 0, and fails the board when it keeps doing so", async () => {
    const total = APPLE_PAGE * 2;
    const flaky = fakeApple(total, { flakyPage: 2 });
    const r = await fetchApple("uk", () => false, flaky.impl, async () => {});
    expect(r.listed).toBe(total);
    expect(flaky.calls.filter((u) => /page=2(&|$)/.test(u))).toHaveLength(2);
    await expect(fetchApple("uk", () => false, fakeApple(total, { deadPage: 2 }).impl, async () => {})).rejects.toThrow(/soft error/);
  });

  it("fails when the total changes between pages", async () => {
    await expect(fetchApple("uk", () => true, fakeApple(APPLE_PAGE + 5, { shrinkAfterFirst: true }).impl, async () => {})).rejects.toThrow(/changed/);
  });

  it("refuses a non-empty listing with no UK rows", async () => {
    await expect(fetchApple("uk", () => true, fakeApple(5, { nonUk: true }).impl, async () => {})).rejects.toThrow(/no UK rows in a non-empty listing; refusing to close the board/);
  });

  it("fails the board (not zero jobs) when the page has no hydration marker", async () => {
    await expect(fetchApple("uk", () => true, fakeApple(5, { noMarker: true }).impl, async () => {})).rejects.toThrow(/hydration/);
  });

  it("fails the board when a detail page is a soft error or lacks the expected keys", async () => {
    await expect(fetchApple("uk", (t) => /early career/i.test(t), fakeApple(4, { badDetail: "soft" }).impl, async () => {})).rejects.toThrow(/hydration/);
    await expect(fetchApple("uk", (t) => /early career/i.test(t), fakeApple(4, { badDetail: "nomarker" }).impl, async () => {})).rejects.toThrow(/jobDetails/);
  });

  it("fails the board on a persistent 429 after the backoffs (no-op sleep)", async () => {
    const { impl, calls } = fakeApple(10, { status: 429 });
    await expect(fetchApple("uk", () => true, impl, async () => {})).rejects.toThrow(/HTTP 429/);
    expect(calls).toHaveLength(4);
  });

  it("wraps failures as ProviderError starting apple/", async () => {
    const err = await fetchJobs({ ats: "apple", slug: "uk", name: "Apple" }, fakeApple(10, { status: 404 }).impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^apple\//);
    expect(() => endpointFor({ ats: "apple", slug: "zz", name: "Apple" })).toThrow(/^apple\//);
    expect(endpointFor({ ats: "apple", slug: "uk", name: "Apple" })).toContain("jobs.apple.com");
  });
});
