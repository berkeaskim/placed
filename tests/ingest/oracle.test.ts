import { describe, it, expect, vi } from "vitest";
import list from "../fixtures/ats/oracle-list.json";
import detail from "../fixtures/ats/oracle-detail.json";
import { normalizeOracleDetail, fetchOracle, parseOracleSlug, ORACLE_PAGE } from "@/lib/ingest/providers/oracle";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const HOST = "jpmc.fa.oraclecloud.com";
const SLUG = "CX_1001/300000000289276";

/** Fake Oracle: `total` requisitions across pages; titles alternate intern / senior. */
function fakeOracle(total: number, opts: { failOffset?: number; reportedTotal?: number; dup?: boolean; hiddenOne?: boolean } = {}) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    // Without expand=requisitionList.* the live API returns the wrapper only (found by the live smoke check).
    if (u.pathname.endsWith("/recruitingCEJobRequisitions") && !u.searchParams.get("expand")?.includes("requisitionList")) {
      return Response.json({ items: [{ TotalJobsCount: total }] });
    }
    const finder = decodeURIComponent(u.searchParams.get("finder") ?? "");
    if (u.pathname.endsWith("/recruitingCEJobRequisitions")) {
      const offset = Number(/offset=(\d+)/.exec(finder)![1]);
      if (offset === opts.failOffset) return new Response("x", { status: 404 });
      const n = Math.max(0, Math.min(ORACLE_PAGE, total - offset - (opts.hiddenOne ? 1 : 0)));
      const requisitionList = Array.from({ length: n }, (_, k) => {
        const i = opts.dup ? 0 : offset + k;
        return { Id: String(i), Title: i % 2 ? "Senior Associate" : `Summer Internship ${i}`, PrimaryLocation: "LONDON, United Kingdom" };
      });
      return Response.json({ items: [{ TotalJobsCount: opts.reportedTotal ?? total, requisitionList }] });
    }
    const id = /Id="(\d+)"/.exec(finder)![1];
    return Response.json({ items: [{ Id: id, Title: `Summer Internship ${id}`, ExternalPostedStartDate: "2026-10-01T09:00:00+00:00",
      PrimaryLocation: "LONDON, United Kingdom", ExternalDescriptionStr: "<p>Hi</p>" }] });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("oracle", () => {
  it("parses slugs with and without a location id", () => {
    expect(parseOracleSlug("CX_1001")).toEqual({ siteNumber: "CX_1001", locationId: null });
    expect(parseOracleSlug(SLUG)).toEqual({ siteNumber: "CX_1001", locationId: "300000000289276" });
  });

  it("normalizes a recorded detail", () => {
    const j = normalizeOracleDetail(detail, HOST, SLUG)!;
    expect(j.extId).toBe("210799164");
    expect(j.title).toBe("Finance and Business Management Project Manager - Analyst");
    expect(j.url).toBe(`https://${HOST}/hcmUI/CandidateExperience/en/sites/CX_1001/job/210799164`);
    expect(j.location).toContain("United Kingdom");
    expect(j.html.length).toBeGreaterThan(0);
    expect(j.postedAt).toBe("2026-10-16T09:26:50+00:00");
    expect(j.remote).toBe(false);
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
  });

  it("reads the deadline from ExternalPostedEndDate and remote from the workplace type, never contacts", () => {
    const item = { ...(detail as { items: object[] }).items[0], ExternalPostedEndDate: "2026-11-01T23:55:00+00:00", WorkplaceType: "Remote", ExternalContactEmail: "a@b.c" };
    const j = normalizeOracleDetail({ items: [item] }, HOST, SLUG)!;
    expect(j.deadline).toBe("2026-11-01");
    expect(j.remote).toBe(true);
    expect(JSON.stringify(j)).not.toContain("a@b.c");
  });

  it("returns null for malformed details", () => {
    expect(normalizeOracleDetail({}, HOST, SLUG)).toBeNull();
    expect(normalizeOracleDetail({ items: [] }, HOST, SLUG)).toBeNull();
    expect(normalizeOracleDetail(null, HOST, SLUG)).toBeNull();
  });

  it("recorded list has the wrapper shape", () => {
    expect(list.items[0].requisitionList.length).toBe(3);
    expect(list.items[0].TotalJobsCount).toBe(3);
  });

  it("pages the list and fetches details only for kept titles", async () => {
    const { impl, calls } = fakeOracle(45);
    const r = await fetchOracle(SLUG, HOST, (t) => /intern/i.test(t), impl, async () => {});
    expect(r.listed).toBe(45);
    const detailCalls = calls.filter((u) => u.includes("Details"));
    expect(detailCalls).toHaveLength(23);
    expect(r.jobs).toHaveLength(23);
    expect(calls.filter((u) => !u.includes("Details")).length).toBeGreaterThan(1);
    expect(calls[0]).toContain("locationId=300000000289276");
  });

  it("fails the board when a list page errors", async () => {
    const { impl } = fakeOracle(45, { failOffset: ORACLE_PAGE });
    await expect(fetchOracle(SLUG, HOST, () => true, impl, async () => {})).rejects.toThrow();
  });

  it("fails when fewer unique ids than TotalJobsCount", async () => {
    const { impl } = fakeOracle(45, { reportedTotal: 60 });
    await expect(fetchOracle(SLUG, HOST, () => true, impl, async () => {})).rejects.toThrow(/partial/);
    const dup = fakeOracle(45, { dup: true });
    await expect(fetchOracle(SLUG, HOST, () => true, dup.impl, async () => {})).rejects.toThrow(/partial/);
  });

  it("tolerates the live one-row TotalJobsCount overshoot only when every earlier page is full", async () => {
    const ok = fakeOracle(45, { hiddenOne: true });
    expect((await fetchOracle(SLUG, HOST, () => false, ok.impl, async () => {})).listed).toBe(44);
  });

  it("wraps provider failures as ProviderError starting oracle/", async () => {
    const { impl } = fakeOracle(45, { failOffset: 0 });
    const err = await fetchJobs({ ats: "oracle", slug: SLUG, name: "JPMorgan", apiHost: HOST }, impl).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^oracle\//);
    expect(() => endpointFor({ ats: "oracle", slug: SLUG, name: "JPMorgan" })).toThrow(/apiHost/);
    expect(endpointFor({ ats: "oracle", slug: SLUG, name: "JPMorgan", apiHost: HOST })).toContain(HOST);
  });
});
