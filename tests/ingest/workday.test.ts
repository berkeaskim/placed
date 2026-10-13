import { describe, it, expect, vi } from "vitest";
import list from "../fixtures/ats/workday-list.json";
import detail from "../fixtures/ats/workday-detail.json";
import { normalizeWorkdayDetail, fetchWorkday, parseWorkdaySlug, WD_PAGE } from "@/lib/ingest/providers/workday";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter, passesTitleFilter } from "@/lib/ingest/filter";

const HOST = "barclays.wd3.myworkdayjobs.com";
const SLUG = "barclays/External_Career_Site_Barclays";

/** Fake Workday: `total` postings across pages; titles alternate intern / non-intern. */
function fakeWorkday(total: number, opts: { failDetailOnce?: boolean; failDetailAlways?: boolean; status?: number } = {}) {
  let detailFails = 0;
  const calls: string[] = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.endsWith("/jobs")) {
      const { offset } = JSON.parse(String(init?.body));
      const n = Math.max(0, Math.min(WD_PAGE, total - offset));
      const jobPostings = Array.from({ length: n }, (_, k) => {
        const i = offset + k;
        return { title: i % 2 ? "Senior Engineer" : `Summer Internship ${i}`, externalPath: `/job/x/${i}`, locationsText: "London" };
      });
      // Real Workday only reports total on the first page.
      return Response.json({ total: offset === 0 ? total : 0, jobPostings });
    }
    const id = url.split("/").pop();
    if (opts.failDetailAlways || (opts.failDetailOnce && detailFails++ === 0)) return new Response("x", { status: opts.status ?? 503 });
    return Response.json({
      jobPostingInfo: {
        id: `id-${id}`, title: `Summer Internship ${id}`, jobDescription: "<p>Hi</p>", location: "London",
        externalUrl: `https://${HOST}/x/job/${id}`, startDate: "2026-10-06", endDate: "2026-11-01",
        country: { descriptor: "United Kingdom" },
      },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("workday", () => {
  it("normalizes a recorded real detail with structured dates", () => {
    const j = normalizeWorkdayDetail(detail)!;
    expect(j.title).toMatch(/Summer Internship/);
    expect(j.url).toMatch(/^https:\/\/barclays\.wd3\.myworkdayjobs\.com\//);
    expect(j.deadline).toBe("2026-11-01");
    expect(j.postedAt).toBe("2026-10-06T00:00:00Z");
  });

  it("appends the structured country so UK sites outside the city list pass the location filter", () => {
    const j = normalizeWorkdayDetail(detail)!;
    expect(j.location).toBe("Knutsford, Radbroke Hall, United Kingdom");
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("returns null for malformed details and rejects bad slugs", () => {
    expect(normalizeWorkdayDetail({})).toBeNull();
    expect(normalizeWorkdayDetail(null)).toBeNull();
    expect(() => parseWorkdaySlug("barclays")).toThrow();
  });

  it("recorded list titles include real early-career programmes", () => {
    expect(list.jobPostings.some((j) => passesTitleFilter(j.title))).toBe(true);
  });

  it("pages the whole board, then fetches details only for titles that pass", async () => {
    const { impl, calls } = fakeWorkday(45);
    const r = await fetchWorkday(SLUG, HOST, passesTitleFilter, impl);
    expect(calls.filter((u) => u.endsWith("/jobs"))).toHaveLength(3); // 20 + 20 + 5
    expect(r.listed).toBe(45);
    expect(r.jobs).toHaveLength(23); // even indices only
    expect(calls.filter((u) => !u.endsWith("/jobs"))).toHaveLength(23);
    expect(r.truncated).toBe(false);
  });

  const noSleep = vi.fn(async () => {});

  it("backs off and retries on 429", async () => {
    const { impl } = fakeWorkday(2, { failDetailOnce: true, status: 429 });
    expect((await fetchWorkday(SLUG, HOST, passesTitleFilter, impl, noSleep)).jobs).toHaveLength(1);
    expect(noSleep).toHaveBeenCalled();
  });

  it("fails the board (rather than silently dropping postings) when a detail keeps failing", async () => {
    const { impl } = fakeWorkday(2, { failDetailAlways: true });
    await expect(fetchWorkday(SLUG, HOST, passesTitleFilter, impl, noSleep)).rejects.toThrow(/HTTP 503/);
  });

  it("does not retry non-transient errors and surfaces them as ProviderError", async () => {
    const { impl, calls } = fakeWorkday(2, { failDetailAlways: true, status: 404 });
    await expect(fetchJobs({ slug: SLUG, name: "Barclays", ats: "workday", apiHost: HOST }, impl)).rejects.toBeInstanceOf(ProviderError);
    expect(calls.filter((u) => !u.endsWith("/jobs"))).toHaveLength(1);
  });

  it("endpointFor requires apiHost", () => {
    expect(endpointFor({ slug: SLUG, name: "B", ats: "workday", apiHost: HOST }))
      .toBe(`https://${HOST}/wday/cxs/barclays/External_Career_Site_Barclays/jobs`);
    expect(() => endpointFor({ slug: SLUG, name: "B", ats: "workday" })).toThrow(ProviderError);
  });

  it("fetchJobs returns RawJobs with the structured deadline", async () => {
    const { impl } = fakeWorkday(3);
    const jobs = await fetchJobs({ slug: SLUG, name: "Barclays", ats: "workday", apiHost: HOST }, impl);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].deadline).toBe("2026-11-01");
  });
});
