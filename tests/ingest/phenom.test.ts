import { describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/ats/phenom-refinesearch.json";
import { normalizePhenom, fetchPhenom, phenomBody, phenomUrl, PHENOM_PAGE } from "@/lib/ingest/providers/phenom";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const HOST = "careers.bcg.com";
const SLUG = "external/page11";

/** Fake Phenom widgets endpoint: `total` UK jobs, PHENOM_PAGE per page; even indexes are internships, odd are senior. */
function fakePhenom(total: number, opts: { reportedTotal?: number; dup?: boolean; shrinkAfterFirst?: boolean; status?: number; nonUk?: boolean } = {}) {
  const bodies: { from: number; size: number; ddoKey: string; selected_fields: { country: string[] } }[] = [];
  const impl = vi.fn(async (_url: string, init?: RequestInit) => {
    if (opts.status) return new Response("x", { status: opts.status });
    const b = JSON.parse(String(init?.body));
    bodies.push(b);
    const totalHits = b.from > 0 && opts.shrinkAfterFirst ? total - 1 : (opts.reportedTotal ?? total);
    const jobs = Array.from({ length: Math.max(0, Math.min(b.size, total - b.from)) }, (_, k) => {
      const i = opts.dup ? 0 : b.from + k;
      const loc = opts.nonUk ? "Paris, France" : "London, United Kingdom";
      return { jobId: String(500 + i), title: i % 2 ? `Senior Manager ${i}` : `Consulting Internship ${i}`, location: loc, multi_location: [loc],
        postedDate: "2026-10-05T00:00:00.000+0000", descriptionTeaser: "<p>T</p>" };
    });
    return Response.json({ refineSearch: { status: 200, hits: jobs.length, totalHits, data: { jobs } } });
  }) as unknown as typeof fetch;
  return { impl, bodies };
}

describe("phenom", () => {
  const items = fixture.refineSearch.data.jobs;

  it("normalizes a recorded item", () => {
    const intern = items.find((j) => /Internship/.test(j.title))!;
    const j = normalizePhenom(intern, HOST)!;
    expect(j.extId).toBe(intern.jobId);
    expect(j.title).toBe(intern.title);
    expect(j.url).toBe(`https://careers.bcg.com/global/en/job/${intern.jobId}`);
    expect(j.location).toBe("London, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.html).toContain(intern.descriptionTeaser.slice(0, 30));
    expect(j.postedAt).toBe(intern.postedDate.slice(0, 10));
    expect(j.deadline ?? null).toBeNull();
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("uses the UK entry of a multi-location row whose primary location is abroad", () => {
    const multi = items.find((j) => !/United Kingdom/.test(j.location))!;
    expect(normalizePhenom(multi, HOST)!.location).toBe("London, United Kingdom");
    expect(normalizePhenom({ title: "T" }, HOST)).toBeNull();
    expect(normalizePhenom(null, HOST)).toBeNull();
  });

  it("never carries a hiring-manager field", () => {
    expect(JSON.stringify(items)).not.toMatch(/hiringManager/i);
    expect(Object.keys(normalizePhenom({ ...items[0], hiringManager: { name: "X" } }, HOST)!)).not.toContain("hiringManager");
  });

  it("asks for UK jobs from the slug's site", () => {
    const b = JSON.parse(phenomBody(SLUG, 100));
    expect(b.ddoKey).toBe("refineSearch");
    expect(b.siteType).toBe("external");
    expect(b.pageId).toBe("page11");
    expect(b.from).toBe(100);
    expect(b.size).toBe(PHENOM_PAGE);
    expect(b.selected_fields).toEqual({ country: ["United Kingdom"] });
    expect(() => phenomBody("nonsense", 0)).toThrow(/slug/);
    expect(phenomUrl(HOST)).toBe("https://careers.bcg.com/widgets");
  });

  it("pages until totalHits is reached and keeps only passing titles", async () => {
    const { impl, bodies } = fakePhenom(PHENOM_PAGE * 2 + 5);
    const r = await fetchPhenom(SLUG, HOST, (t) => /internship/i.test(t), impl, async () => {});
    expect(r.listed).toBe(PHENOM_PAGE * 2 + 5);
    expect(bodies.map((b) => b.from)).toEqual([0, PHENOM_PAGE, PHENOM_PAGE * 2]);
    expect(r.jobs).toHaveLength(Math.ceil((PHENOM_PAGE * 2 + 5) / 2));
  });

  it("fails on partial list", async () => {
    await expect(fetchPhenom(SLUG, HOST, () => true, fakePhenom(30, { reportedTotal: 45 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchPhenom(SLUG, HOST, () => true, fakePhenom(30, { dup: true }).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchPhenom(SLUG, HOST, () => true, fakePhenom(0).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("fails when totalHits changes between pages", async () => {
    await expect(fetchPhenom(SLUG, HOST, () => true, fakePhenom(PHENOM_PAGE + 5, { shrinkAfterFirst: true }).impl, async () => {})).rejects.toThrow(/changed/);
  });

  it("refuses a non-empty listing with no UK rows", async () => {
    await expect(fetchPhenom(SLUG, HOST, () => true, fakePhenom(5, { nonUk: true }).impl, async () => {})).rejects.toThrow(/no UK rows in a non-empty listing; refusing to close the board/);
  });

  it("wraps failures as ProviderError starting phenom/", async () => {
    const err = await fetchJobs({ ats: "phenom", slug: SLUG, name: "BCG", apiHost: HOST }, fakePhenom(10, { status: 404 }).impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^phenom\//);
    expect(() => endpointFor({ ats: "phenom", slug: SLUG, name: "BCG" })).toThrow(/apiHost/);
    expect(endpointFor({ ats: "phenom", slug: SLUG, name: "BCG", apiHost: HOST })).toBe("https://careers.bcg.com/widgets");
  });
});
