import { describe, it, expect, vi } from "vitest";
import list from "../fixtures/ats/smartrecruiters-list.json";
import detail from "../fixtures/ats/smartrecruiters-detail.json";
import {
  normalizeSmartRecruitersDetail, fetchSmartRecruiters, srLocation, SR_PAGE,
} from "@/lib/ingest/providers/smartrecruiters";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter, passesTitleFilter } from "@/lib/ingest/filter";

/** Fake SmartRecruiters: `total` postings across pages; titles alternate intern / non-intern. */
function fakeSr(total: number, opts: { failDetail?: number } = {}) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/postings")) {
      const offset = Number(u.searchParams.get("offset"));
      const n = Math.max(0, Math.min(SR_PAGE, total - offset));
      const content = Array.from({ length: n }, (_, k) => {
        const i = offset + k;
        return { id: String(i), name: i % 2 ? "Senior Associate" : `Summer Internship ${i}` };
      });
      return Response.json({ offset, limit: SR_PAGE, totalFound: total, content });
    }
    const id = u.pathname.split("/").pop();
    if (opts.failDetail !== undefined) return new Response("x", { status: opts.failDetail });
    return Response.json({
      id, name: `Summer Internship ${id}`, releasedDate: "2026-10-01T09:00:00.000Z",
      postingUrl: `https://jobs.smartrecruiters.com/Acme/${id}`,
      location: { city: "London", country: "gb", fullLocation: "London, , United Kingdom" },
      jobAd: { sections: { jobDescription: { title: "Job Description", text: "<p>Hi</p>" } } },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("smartrecruiters", () => {
  it("normalizes a recorded real detail", () => {
    const j = normalizeSmartRecruitersDetail(detail)!;
    expect(j.title).toBe("Junior Consultant Summer Internship 2027");
    expect(j.url).toMatch(/^https:\/\/jobs\.smartrecruiters\.com\/RolandBerger\//);
    expect(j.location).toBe("London, England, United Kingdom");
    expect(j.postedAt).toMatch(/^2026-/);
    expect(j.html).toContain("<h3>");
    expect(passesTitleFilter(j.title)).toBe(true);
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("leaves out the boilerplate company description", () => {
    const j = normalizeSmartRecruitersDetail(detail)!;
    const companyText = (detail as { jobAd: { sections: { companyDescription: { text: string } } } }).jobAd.sections.companyDescription.text;
    expect(j.html).not.toContain(companyText.slice(0, 60));
  });

  it("recorded list mixes early-career and other titles", () => {
    expect(list.content.map((c) => passesTitleFilter(c.name))).toEqual([true, false]);
  });

  it("cleans empty location parts and appends the country from its code", () => {
    expect(srLocation({ fullLocation: "Sydney, , Australia" })).toBe("Sydney, Australia");
    expect(srLocation({ city: "Knutsford", country: "gb" })).toBe("Knutsford, United Kingdom");
    expect(srLocation({ fullLocation: "London, , United Kingdom", country: "gb" })).toBe("London, United Kingdom");
    expect(srLocation(undefined)).toBe("");
  });

  it("returns null for malformed details", () => {
    expect(normalizeSmartRecruitersDetail({})).toBeNull();
    expect(normalizeSmartRecruitersDetail(null)).toBeNull();
  });

  it("pages the whole board, then fetches details only for titles that pass", async () => {
    const { impl, calls } = fakeSr(250);
    const r = await fetchSmartRecruiters("acme", passesTitleFilter, impl);
    expect(calls.filter((u) => u.includes("/postings?"))).toHaveLength(3); // 100 + 100 + 50
    expect(r.listed).toBe(250);
    expect(r.jobs).toHaveLength(125);
    expect(r.jobs[0].location).toBe("London, United Kingdom");
  });

  it("fails the board when a detail fails (a skipped posting would be marked dead)", async () => {
    const { impl } = fakeSr(2, { failDetail: 404 });
    await expect(fetchSmartRecruiters("acme", passesTitleFilter, impl)).rejects.toThrow(/404/);
  });

  it("is dispatched by fetchJobs and wraps errors in ProviderError", async () => {
    const { impl } = fakeSr(4);
    expect(await fetchJobs({ slug: "acme", name: "Acme", ats: "smartrecruiters" }, impl)).toHaveLength(2);
    const bad = vi.fn(async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchJobs({ slug: "acme", name: "Acme", ats: "smartrecruiters" }, bad)).rejects.toBeInstanceOf(ProviderError);
    expect(endpointFor({ slug: "CliffordChance", name: "CC", ats: "smartrecruiters" }))
      .toBe("https://api.smartrecruiters.com/v1/companies/CliffordChance/postings");
  });
});

describe("smartrecruiters partial listings fail the board", () => {
  it("missing totalFound", async () => {
    const impl = vi.fn(async () => Response.json({ content: [{ id: "1", name: "Summer Internship" }] })) as unknown as typeof fetch;
    await expect(fetchSmartRecruiters("acme", passesTitleFilter, impl)).rejects.toThrow(/totalFound/);
  });
  it("a page that comes back short", async () => {
    const impl = vi.fn(async () => Response.json({ totalFound: 150, content: [{ id: "1", name: "Summer Internship" }] })) as unknown as typeof fetch;
    await expect(fetchSmartRecruiters("acme", passesTitleFilter, impl)).rejects.toThrow(/listed 1 of 150/);
  });
  it("over the page cap", async () => {
    const impl = vi.fn(async () => Response.json({ totalFound: 999_999, content: [] })) as unknown as typeof fetch;
    await expect(fetchSmartRecruiters("acme", passesTitleFilter, impl)).rejects.toThrow(/cap/);
  });
});

describe("smartrecruiters shortfall re-check (review round 2)", () => {
  it("accepts the run when a posting closed between pages (totalFound shrank)", async () => {
    let call = 0;
    const impl = vi.fn(async (url: string) => {
      if (!new URL(url).pathname.endsWith("/postings")) return Response.json({ id: "1", name: "Summer Internship", postingUrl: "https://jobs.smartrecruiters.com/A/1", location: { city: "London", country: "gb" } });
      call++;
      return call === 1
        ? Response.json({ totalFound: 2, content: [{ id: "1", name: "Summer Internship" }] }) // 2nd posting vanished before paging
        : Response.json({ totalFound: 1, content: [{ id: "1", name: "Summer Internship" }] });
    }) as unknown as typeof fetch;
    expect((await fetchSmartRecruiters("acme", passesTitleFilter, impl)).jobs).toHaveLength(1);
  });
  it("duplicate ids don't hide a real gap", async () => {
    const dup = { id: "1", name: "Summer Internship" };
    const impl = vi.fn(async () => Response.json({ totalFound: 2, content: [dup, dup] })) as unknown as typeof fetch;
    await expect(fetchSmartRecruiters("acme", passesTitleFilter, impl)).rejects.toThrow(/listed 1 of 2/);
  });
});
