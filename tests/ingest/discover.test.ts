import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { companies } from "@/lib/db/schema";
import type { CompanySuggestion, DiscoverInput } from "@/lib/ai/discoverCompanies";
import { candidateSlugs, discoveredCompanies, dropDiscovered, lastDiscovery, probeBoard, resolveBoard, runDiscovery, sameCompany } from "@/lib/ingest/discover";

/** A fake fetch serving `routes` (URL prefix → JSON body); everything else 404s. */
function fakeFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const hit = Object.entries(routes).find(([k]) => u === k || u.startsWith(`${k}?`));
    return hit ? new Response(JSON.stringify(hit[1]), { status: 200 }) : new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("names and slugs", () => {
  it("builds slugs from the AI guess and the name", () => {
    expect(candidateSlugs("Jane Street", null)).toEqual(["jane-street", "janestreet"]);
    expect(candidateSlugs("Monzo Bank Ltd", "monzo")).toEqual(["monzo", "monzo-bank", "monzobank"]);
    expect(candidateSlugs("Bad", "../x y")).toEqual(["bad"]);
  });
  it("matches board names loosely but not different companies", () => {
    expect(sameCompany("Monzo", "Monzo Bank Ltd")).toBe(true);
    expect(sameCompany("Wise", "Wise plc")).toBe(true);
    expect(sameCompany("Apex Fintech", "Atlas Labs")).toBe(false);
  });
});

describe("probeBoard", () => {
  it("needs open postings, and a matching Greenhouse board name", async () => {
    const f = fakeFetch({
      "https://boards-api.greenhouse.io/v1/boards/monzo": { name: "Monzo" },
      "https://boards-api.greenhouse.io/v1/boards/monzo/jobs": { jobs: [{}, {}] },
      "https://boards-api.greenhouse.io/v1/boards/apex": { name: "Apex Clearing" },
      "https://boards-api.greenhouse.io/v1/boards/apex/jobs": { jobs: [{}] },
      "https://api.eu.lever.co/v0/postings/eulever": [{}],
      "https://api.smartrecruiters.com/v1/companies/empty/postings": { totalFound: 0 },
    });
    expect(await probeBoard("Monzo", "greenhouse", "monzo", null, f)).toEqual({ ats: "greenhouse", slug: "monzo", apiHost: null, postings: 2 });
    expect(await probeBoard("Apex Fintech", "greenhouse", "apex", null, f)).toBeNull();
    expect(await probeBoard("EU", "lever", "eulever", null, f)).toEqual({ ats: "lever", slug: "eulever", apiHost: "api.eu.lever.co", postings: 1 });
    expect(await probeBoard("Empty", "smartrecruiters", "empty", null, f)).toBeNull();
    expect(await probeBoard("Bad", "workday", "x/y", "evil.example.com", f)).toBeNull();
  });
  it("resolveBoard falls back across ATSs when the AI's guess is wrong", async () => {
    const f = fakeFetch({ "https://api.ashbyhq.com/posting-api/job-board/janestreet": { jobs: [{}] } });
    expect(await resolveBoard({ name: "Jane Street", ats: "lever", slug: "js", workday_host: null }, f))
      .toMatchObject({ ats: "ashby", slug: "janestreet" });
  });
});

describe("runDiscovery", () => {
  it("stores only verified, new companies and can drop them", async () => {
    db.insert(companies).values({ slug: "acme", name: "Acme", ats: "lever" }).run();
    const discover = vi.fn<(i: DiscoverInput) => Promise<CompanySuggestion[]>>(async () => [
      { name: "Acme", ats: "lever" as const, slug: "acme", workday_host: null },
      { name: "Monzo", ats: "greenhouse" as const, slug: "monzo", workday_host: null },
      { name: "Made Up Co", ats: "unknown" as const, slug: null, workday_host: null },
    ]);
    const f = fakeFetch({
      "https://boards-api.greenhouse.io/v1/boards/monzo": { name: "Monzo" },
      "https://boards-api.greenhouse.io/v1/boards/monzo/jobs": { jobs: [{}] },
    });
    const s = await runDiscovery({ discover, fetch: f });
    expect(discover.mock.calls[0]![0].known).toContain("Acme");
    expect(s.suggested).toBe(2);
    expect(s.added).toEqual([{ name: "Monzo", ats: "greenhouse" }]);
    expect(lastDiscovery()?.added).toHaveLength(1);
    const [row] = discoveredCompanies();
    expect(row).toMatchObject({ name: "Monzo", enabled: true });
    expect(dropDiscovered(row.id)).toBe(true);
    expect(discoveredCompanies()[0].enabled).toBe(false);
    // dropped companies stay known, so they're never suggested again
    await runDiscovery({ discover, fetch: f });
    expect(discover.mock.calls[1]![0].known).toContain("Monzo");
  });
});
