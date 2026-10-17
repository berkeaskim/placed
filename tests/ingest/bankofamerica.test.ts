import { describe, it, expect, vi } from "vitest";
import fixture from "../fixtures/ats/bankofamerica-search.json";
import { normalizeBankOfAmerica, fetchBankOfAmerica, bankOfAmericaUrl } from "@/lib/ingest/providers/bankofamerica";
import { fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";
import { passesLocationFilter } from "@/lib/ingest/filter";

const row = (i: number, country = "United Kingdom") => ({
  jobRequisitionId: String(900 + i), postingTitle: i % 2 ? "Vice President" : `2027 Summer Analyst ${i}`, city: "London", country,
  jcrURL: `/en-us/students/job-detail/${900 + i}/x`, postedDate: "09/23/2026", applyByDate: "Oct 22, 2026", jobDescriptionExternal: "<p>D</p>",
});
const serve = (body: unknown, status = 200) => vi.fn(async () => status === 200 ? Response.json(body) : new Response("x", { status })) as unknown as typeof fetch;

describe("bankofamerica", () => {
  const uk = fixture.jobsList.filter((r) => r.country === "United Kingdom");

  it("normalizes a recorded item", () => {
    const j = normalizeBankOfAmerica(uk[0])!;
    expect(j.extId).toBe(uk[0].jobRequisitionId);
    expect(j.title).toBe(uk[0].postingTitle);
    expect(j.url).toBe("https://careers.bankofamerica.com" + uk[0].jcrURL);
    expect(j.location).toBe("London, United Kingdom");
    expect(j.remote).toBe(false);
    expect(j.html).toBe(uk[0].jobDescriptionExternal);
    expect(j.postedAt).toBe("2026-09-23");
    expect(j.deadline).toBe("2026-10-22");
    expect(passesLocationFilter(j.location, j.remote, "").pass).toBe(true);
    expect(JSON.stringify(j)).not.toMatch(/recruiter/i);
  });

  it("tolerates bad dates and missing fields", () => {
    expect(normalizeBankOfAmerica({ ...uk[0], applyByDate: "garbage" })!.deadline).toBeNull();
    expect(normalizeBankOfAmerica({ ...uk[0], postedDate: null })!.postedAt).toBeNull();
    expect(normalizeBankOfAmerica({ postingTitle: "T" })).toBeNull();
    expect(normalizeBankOfAmerica(null)).toBeNull();
  });

  it("keeps only UK rows with passing titles from the single response", async () => {
    const rows = [row(0), row(1), row(2), row(3, "France"), row(4, "France")];
    const impl = serve({ totalMatches: 5, jobsList: rows });
    const r = await fetchBankOfAmerica("uk", (t) => /analyst/i.test(t), impl, async () => {});
    expect(r.listed).toBe(3);
    expect(r.jobs.map((j) => j.extId)).toEqual(["900", "902"]);
    expect(() => bankOfAmericaUrl("fr")).toThrow(/country/);
    expect(bankOfAmericaUrl("uk")).toContain("campusjobssearchservlet");
    expect(bankOfAmericaUrl("uk")).toContain("rows=500");
  });

  it("fails on partial list", async () => {
    await expect(fetchBankOfAmerica("uk", () => true, serve({ totalMatches: 9, jobsList: [row(0), row(1)] }), async () => {})).rejects.toThrow(/partial/);
    await expect(fetchBankOfAmerica("uk", () => true, serve({ totalMatches: 2, jobsList: [row(0), row(0)] }), async () => {})).rejects.toThrow(/partial/);
  });

  it("refuses an empty listing", async () => {
    await expect(fetchBankOfAmerica("uk", () => true, serve({ totalMatches: 0, jobsList: [] }), async () => {})).rejects.toThrow(/empty listing/);
  });

  it("refuses a non-empty listing with no UK rows", async () => {
    const rows = [row(0, "France"), row(1, "France")];
    await expect(fetchBankOfAmerica("uk", () => true, serve({ totalMatches: 2, jobsList: rows }), async () => {})).rejects.toThrow(/no United Kingdom rows/);
  });

  it("rejects a response without totalMatches/jobsList", async () => {
    await expect(fetchBankOfAmerica("uk", () => true, serve({ status: "ok" }), async () => {})).rejects.toThrow(/totalMatches/);
  });

  it("wraps failures as ProviderError starting bankofamerica/", async () => {
    const err = await fetchJobs({ ats: "bankofamerica", slug: "uk", name: "Bank of America" }, serve({}, 404)).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toMatch(/^bankofamerica\//);
    expect(endpointFor({ ats: "bankofamerica", slug: "uk", name: "Bank of America" })).toContain("bankofamerica.com");
  });

  it("fails the board when a kept UK row has no jcrURL instead of dropping it", async () => {
    const rows = [row(0), { ...row(2), jcrURL: undefined }];
    await expect(fetchBankOfAmerica("uk", () => true, serve({ totalMatches: 2, jobsList: rows }), async () => {})).rejects.toThrow(/jcrURL/);
  });
});
