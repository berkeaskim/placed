import { describe, it, expect, vi } from "vitest";
import search from "../fixtures/ats/mckinsey-search.json";
import { normalizeMckinsey, fetchMckinsey, mckinseySearchUrl, MK_PAGE } from "@/lib/ingest/providers/mckinsey";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const docs = search.docs;

/** Fake gateway: `total` UK docs, `pageSize` per request, `start` is the 1-based page; even ids are interns, odd are senior. */
function fakeMk(total: number, opts: { reportedTotal?: number; hide?: number; drift?: boolean; shrinkAfterFirst?: boolean; status?: number; nonUk?: boolean; soft?: boolean; nullDocs?: boolean } = {}) {
  const calls: string[] = [];
  const doc = (i: number) => ({
    ...docs[0], jobID: String(9000 + i), title: i % 2 ? `Senior Manager ${i}` : `Business Analyst Intern ${i}`, friendlyURL: `job-${9000 + i}`,
    cities: ["Paris", "London"], countries: [opts.nonUk ? "France" : "France", opts.nonUk ? "France" : "United Kingdom"],
  });
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    if (opts.status) return new Response("x", { status: opts.status });
    if (opts.soft) return Response.json({ httpStatus: "TOO_MANY_REQUESTS", statusMessage: "slow down", requestId: "r" });
    const u = new URL(url);
    const size = Number(u.searchParams.get("pageSize"));
    const page = Number(u.searchParams.get("start"));
    const numFound = page > 1 && opts.shrinkAfterFirst ? total - 1 : (opts.reportedTotal ?? total);
    const ids = Array.from({ length: total }, (_, i) => i).filter((i) => i !== opts.hide);
    const shift = opts.drift && page > 1 ? 1 : 0;
    const slice = ids.slice((page - 1) * size + shift, page * size + shift).map(doc);
    return Response.json({ numFound, start: 0, httpStatus: "OK", statusMessage: "Success", docs: slice.length || !opts.nullDocs ? slice : null });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("mckinsey", () => {
  it("normalizes a recorded item (UK city only, no date, full text from the list)", () => {
    const intern = docs.find((d) => d.title === "Associate Intern")!;
    const j = normalizeMckinsey(intern)!;
    expect(j.extId).toBe(intern.jobID);
    expect(j.title).toBe("Associate Intern");
    expect(j.url).toBe(`https://www.mckinsey.com/careers/search-jobs/jobs/${intern.friendlyURL}`);
    expect(j.location).toBe("London, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.html).toContain(intern.whatYouWillDo.slice(0, 30));
    expect(j.html).toContain(intern.yourBackground.slice(0, 30));
    expect(j.postedAt ?? null).toBeNull();
    expect(j.deadline ?? null).toBeNull();
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("matches cities to countries by position and tolerates missing fields", () => {
    expect(normalizeMckinsey({ ...docs[0], cities: ["Paris", "Leeds", "Cardiff"], countries: ["France", "United Kingdom", "United Kingdom"] })!.location)
      .toBe("Leeds, United Kingdom; Cardiff, United Kingdom");
    expect(normalizeMckinsey({ ...docs[0], cities: ["Paris"], countries: ["France"] })!.location).toBe("United Kingdom");
    expect(normalizeMckinsey({ title: "T" })).toBeNull();
    expect(normalizeMckinsey(null)).toBeNull();
  });

  it("validates the response-derived friendlyURL before putting it in a path", () => {
    expect(normalizeMckinsey({ ...docs[0], friendlyURL: "../../evil?x=1" })).toBeNull();
    expect(normalizeMckinsey({ ...docs[0], friendlyURL: "https://evil.example/x" })).toBeNull();
    expect(normalizeMckinsey({ ...docs[0], friendlyURL: undefined })).toBeNull();
  });

  it("asks for UK docs only", () => {
    const u = new URL(mckinseySearchUrl("uk", 2));
    expect(u.host).toBe("gateway.mckinsey.com");
    expect(u.searchParams.get("countries")).toBe("United Kingdom");
    expect(u.searchParams.get("start")).toBe("2");
    expect(u.searchParams.get("pageSize")).toBe(String(MK_PAGE));
    expect(() => mckinseySearchUrl("zz", 1)).toThrow();
  });

  it("pages until numFound is reached and keeps only titles that pass the filter", async () => {
    const { impl, calls } = fakeMk(MK_PAGE * 2 + 6);
    const r = await fetchMckinsey("uk", (t) => /intern/i.test(t), impl, async () => {});
    expect(r.listed).toBe(MK_PAGE * 2 + 6);
    expect(r.jobs).toHaveLength(Math.ceil((MK_PAGE * 2 + 6) / 2));
    expect(calls).toHaveLength(3);
    expect(r.jobs[0].location).toBe("London, United Kingdom");
  });

  it("fails on partial list", async () => {
    await expect(fetchMckinsey("uk", () => false, fakeMk(30, { reportedTotal: 45 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchMckinsey("uk", () => false, fakeMk(MK_PAGE + 10, { hide: 5, drift: true }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchMckinsey("uk", () => false, fakeMk(30, { reportedTotal: 45, nullDocs: true }).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("accepts a one-row phantom total only after two identical listings", async () => {
    const { impl, calls } = fakeMk(25, { reportedTotal: 26 });
    const r = await fetchMckinsey("uk", () => false, impl, async () => {});
    expect(r.listed).toBe(25);
    expect(calls.filter((u) => /start=1(&|$)/.test(u))).toHaveLength(2);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchMckinsey("uk", () => true, fakeMk(0).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("fails when numFound changes between pages", async () => {
    await expect(fetchMckinsey("uk", () => true, fakeMk(MK_PAGE + 5, { shrinkAfterFirst: true }).impl, async () => {})).rejects.toThrow(/changed/);
  });

  it("refuses a non-empty listing with no UK rows", async () => {
    await expect(fetchMckinsey("uk", () => true, fakeMk(5, { nonUk: true }).impl, async () => {})).rejects.toThrow(/no UK rows in a non-empty listing; refusing to close the board/);
  });

  it("fails the board on an HTTP 200 body that is a soft error", async () => {
    await expect(fetchMckinsey("uk", () => true, fakeMk(5, { soft: true }).impl, async () => {})).rejects.toThrow(/soft error|numFound/);
  });

  it("fails the board on a persistent 429 after the backoffs (no-op sleep)", async () => {
    const { impl, calls } = fakeMk(10, { status: 429 });
    await expect(fetchMckinsey("uk", () => true, impl, async () => {})).rejects.toThrow(/HTTP 429/);
    expect(calls).toHaveLength(4);
  });

  it("wraps failures as ProviderError starting mckinsey/", async () => {
    const err = await fetchJobs({ ats: "mckinsey", slug: "uk", name: "McKinsey" }, fakeMk(10, { status: 404 }).impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^mckinsey\//);
    expect(() => endpointFor({ ats: "mckinsey", slug: "zz", name: "McKinsey" })).toThrow(/^mckinsey\//);
    expect(endpointFor({ ats: "mckinsey", slug: "uk", name: "McKinsey" })).toContain("gateway.mckinsey.com");
  });
});
