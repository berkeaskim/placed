import { describe, it, expect, vi } from "vitest";
import search from "../fixtures/ats/eightfold-search.json";
import detail from "../fixtures/ats/eightfold-detail.json";
import { normalizeEightfold, fetchEightfold, eightfoldSearchUrl, EF_PAGE } from "@/lib/ingest/providers/eightfold";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const HOST = "apply.careers.microsoft.com";
const SLUG = "microsoft.com";

/** Fake PCSX: `total` UK positions, EF_PAGE per page; even indexes are interns, odd are senior. */
function fakeEf(total: number, opts: { reportedTotal?: number; hide?: number; drift?: boolean; shrinkAfterFirst?: boolean; status?: number; nonUk?: boolean } = {}) {
  const calls: string[] = [];
  const row = (i: number) => ({
    id: 1000 + i, name: i % 2 ? `Senior Engineer ${i}` : `Software Engineer Intern ${i}`,
    locations: [opts.nonUk ? "France, Paris, Paris" : "United Kingdom, London, London"], postedTs: 1792050565, workLocationOption: "onsite", positionUrl: `/careers/job/${1000 + i}`,
  });
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    if (opts.status) return new Response("x", { status: opts.status });
    const u = new URL(url);
    if (u.pathname.endsWith("/position_details")) {
      const id = u.searchParams.get("position_id")!;
      return Response.json({ data: { ...detail.data, id: Number(id), positionUrl: `/careers/job/${id}` } });
    }
    const start = Number(u.searchParams.get("start"));
    const count = start > 0 && opts.shrinkAfterFirst ? total - 1 : (opts.reportedTotal ?? total);
    const ids = Array.from({ length: total }, (_, i) => i).filter((i) => i !== opts.hide);
    const shift = opts.drift && start > 0 ? 1 : 0;
    const positions = ids.slice(start + shift, start + shift + EF_PAGE).map(row);
    return Response.json({ status: 200, error: null, data: { count, positions } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("eightfold", () => {
  const items = search.data.positions;

  it("normalizes a recorded item with its detail text", () => {
    const intern = items.find((p) => /Intern/.test(p.name))!;
    const j = normalizeEightfold(intern, HOST, detail.data.jobDescription)!;
    expect(j.extId).toBe(String(intern.id));
    expect(j.title).toBe("Applied Sciences Intern");
    expect(j.url).toBe(`https://apply.careers.microsoft.com/careers/job/${intern.id}`);
    expect(j.location).toBe("London, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.html).toContain("University interns");
    expect(j.postedAt).toBe(new Date(intern.postedTs * 1000).toISOString());
    expect(j.deadline ?? null).toBeNull();
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("picks the UK location of a multi-country row and tolerates missing fields", () => {
    const multi = items.find((p) => p.locations.length > 1 && !/^United Kingdom/.test(p.locations[0]))!;
    expect(normalizeEightfold(multi, HOST, "")!.location).toMatch(/United Kingdom/);
    const unnamed = items.find((p) => /Multiple Locations/.test(p.locations[0]) && /^United Kingdom/.test(p.locations[0]))!;
    expect(normalizeEightfold(unnamed, HOST, "")!.location).toBe("United Kingdom");
    expect(normalizeEightfold({ name: "T" }, HOST, "")).toBeNull();
    expect(normalizeEightfold(null, HOST, "")).toBeNull();
    expect(normalizeEightfold({ ...items[0], workLocationOption: "remote" }, HOST, "")!.remote).toBe(true);
  });

  it("asks for UK rows only and sends no unrecognised filter params", () => {
    const u = new URL(eightfoldSearchUrl(SLUG, HOST, 20));
    expect(u.host).toBe(HOST);
    expect(u.searchParams.get("domain")).toBe("microsoft.com");
    expect(u.searchParams.get("location")).toBe("United Kingdom");
    expect(u.searchParams.get("start")).toBe("20");
    expect([...u.searchParams.keys()].sort()).toEqual(["domain", "location", "query", "start"]);
  });

  it("pages until count is reached, title-filters before detail calls, and fetches details only for kept rows", async () => {
    const { impl, calls } = fakeEf(EF_PAGE * 2 + 4);
    const r = await fetchEightfold(SLUG, HOST, (t) => /intern/i.test(t), impl, async () => {});
    expect(r.listed).toBe(EF_PAGE * 2 + 4);
    expect(r.jobs).toHaveLength(Math.ceil((EF_PAGE * 2 + 4) / 2));
    expect(calls.filter((u) => u.includes("/search"))).toHaveLength(3);
    expect(calls.filter((u) => u.includes("position_details"))).toHaveLength(r.jobs.length);
    expect(r.jobs[0].html).toContain("University interns");
  });

  it("fails on partial list", async () => {
    await expect(fetchEightfold(SLUG, HOST, () => false, fakeEf(30, { reportedTotal: 45 }).impl, async () => {})).rejects.toThrow(/partial/);
    await expect(fetchEightfold(SLUG, HOST, () => false, fakeEf(30, { hide: 5, drift: true }).impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("accepts a one-row phantom total only after two identical listings", async () => {
    const { impl, calls } = fakeEf(25, { reportedTotal: 26 });
    const r = await fetchEightfold(SLUG, HOST, () => false, impl, async () => {});
    expect(r.listed).toBe(25);
    expect(calls.filter((u) => /start=0(&|$)/.test(u))).toHaveLength(2);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchEightfold(SLUG, HOST, () => true, fakeEf(0).impl, async () => {})).rejects.toThrow(/empty listing/);
  });

  it("fails when count changes between pages", async () => {
    await expect(fetchEightfold(SLUG, HOST, () => true, fakeEf(EF_PAGE + 5, { shrinkAfterFirst: true }).impl, async () => {})).rejects.toThrow(/changed/);
  });

  it("refuses a non-empty listing with no UK rows", async () => {
    await expect(fetchEightfold(SLUG, HOST, () => true, fakeEf(5, { nonUk: true }).impl, async () => {})).rejects.toThrow(/no UK rows in a non-empty listing; refusing to close the board/);
  });

  it("wraps failures as ProviderError starting eightfold/", async () => {
    const err = await fetchJobs({ ats: "eightfold", slug: SLUG, name: "Microsoft", apiHost: HOST }, fakeEf(10, { status: 404 }).impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^eightfold\//);
    expect(() => endpointFor({ ats: "eightfold", slug: SLUG, name: "Microsoft" })).toThrow(/apiHost/);
    expect(endpointFor({ ats: "eightfold", slug: SLUG, name: "Microsoft", apiHost: HOST })).toContain(HOST);
  });
});
