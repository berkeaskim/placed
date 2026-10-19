import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  cleanApplyUrl, employerFor, fetchTargetJobs, normalizeTargetJobs, targetjobsQuery, TARGETJOBS_URL, type TjDoc,
} from "@/lib/ingest/providers/targetjobs";

// Five live placement records (2026-10-19) plus edge cases: doubleclick redirect, scraped Workday job, closed, no link.
const page = JSON.parse(readFileSync("tests/ingest/fixtures/targetjobs-placements.json", "utf8")) as { search: { result_count: number; documents: TjDoc[] } };
const docs = page.search.documents;
const byNid = (nid: string) => docs.find((d) => String(d.nid) === nid)!;

describe("cleanApplyUrl", () => {
  it("cuts a URL that was pasted twice (MSD)", () => {
    const u = cleanApplyUrl(byNid("248797").applicationUrl!, byNid("248797").path);
    expect(u).toBe("https://jobs.msd.com/gb/en/job/R418983/Student-Placement-Pharmaceutical-Business-Operations-Project-Management");
  });
  it("replaces ad redirects with the TargetJobs page", () => {
    expect(cleanApplyUrl(byNid("1").applicationUrl!, byNid("1").path)).toBe("https://targetjobs.co.uk/jobs/audit-placement-2027-1");
  });
  it("falls back to the TargetJobs page without a link", () => {
    expect(cleanApplyUrl(null, "/jobs/finance-placement-4")).toBe("https://targetjobs.co.uk/jobs/finance-placement-4");
  });
});

describe("employerFor", () => {
  it.each([
    ["248797", "MSD"],          // organisation field
    ["1", "Deloitte"],          // organisation field
    ["244739", "Savills"],      // scraped: savillsgraduates.teamtailor.com + title casing
    ["2", "MBDA"],              // scraped: Workday tenant, short name upper-cased
    ["4", null],                // nothing to go on
  ])("%s → %s", (nid, name) => {
    expect(employerFor(byNid(nid))).toBe(name);
  });
});

describe("normalizeTargetJobs", () => {
  it("maps a record onto a RawJob", () => {
    const j = normalizeTargetJobs(byNid("244739"))!;
    expect(j).toMatchObject({
      extId: "244739",
      title: "2027 Savills Sandwich Placement - Building and Project Consultancy",
      url: "https://savillsgraduates.teamtailor.com/jobs/8260513-2027-savills-sandwich-placement-building-and-project-consultancy",
      location: "London", remote: false, employerName: "Savills", sourceType: "placement", deadline: "2026-10-19",
    });
    expect(j.html).toContain("Sandwich Placement Student");
  });
  it("drops closed applications", () => {
    expect(normalizeTargetJobs(byNid("3"))).toBeNull();
  });
  it("keeps a record with no deadline", () => {
    expect(normalizeTargetJobs(byNid("4"))?.deadline).toBeNull();
  });
});

describe("fetchTargetJobs", () => {
  it("pages through results with the Origin/Referer headers and a polite delay", async () => {
    const all = docs.filter((d) => d.applicationOpen !== false);
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body)) as { offset: number; limit: number };
      const slice = docs.slice(body.offset, body.offset + body.limit);
      return new Response(JSON.stringify({ search: { result_count: docs.length, documents: slice } }), { status: 200 });
    });
    const sleep = vi.fn(async () => {});
    const jobs = await fetchTargetJobs("placement", fetchImpl as unknown as typeof fetch, sleep, 4);
    expect(jobs.map((j) => j.extId).sort()).toEqual(all.map((d) => String(d.nid)).sort());
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 9 records at 4 per page
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(TARGETJOBS_URL);
    expect((init!.headers as Record<string, string>).origin).toBe("https://targetjobs.co.uk");
    expect((init!.headers as Record<string, string>).referer).toBe("https://targetjobs.co.uk/search/jobs");
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  it("a 200 with zero results on the first page is an error, not an empty board (missing headers look like this)", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ search: { result_count: 0, documents: [] } }), { status: 200 }));
    await expect(fetchTargetJobs("placement", fetchImpl as unknown as typeof fetch, async () => {})).rejects.toThrow(/0 results/);
  });
  it("only known opportunity types", async () => {
    await expect(fetchTargetJobs("spaceship", fetch, async () => {})).rejects.toThrow(/opportunity type/);
    expect(targetjobsQuery("Placement", 0, 100, "2026-10-19T00:00:00.000Z")).toMatchObject({ limit: 100, offset: 0 });
  });
});

describe("live dry-run fixes (2026-10-19)", () => {
  it("names the employer from a known name in the title, or a tenant alias", () => {
    expect(employerFor({ nid: "x", title: "2027 Software Engineer Program - JPMorgan Chase - Glasgow", path: "/jobs/x", applicationUrl: "https://jpmc.fa.oraclecloud.com/x" })).toBe("JPMorgan");
    expect(employerFor({ nid: "y", title: "Supply Chain Placement", path: "/jobs/y", applicationUrl: "https://pg.wd5.myworkdayjobs.com/en-US/1000/job/y" })).toBe("Procter & Gamble");
    expect(employerFor({ nid: "z", title: "Placement Student - Supply Chain", path: "/jobs/z", applicationUrl: "https://fa-espx-saasfaprod1.fa.ocs.oraclecloud.com/z", body: "<p>Cummins is a global power leader.</p>" })).toBe("Cummins");
  });
});

describe("employer names from links (live, 2026-10-19)", () => {
  it.each([
    ["Year Out Placement", "http://www.willmottdixon.co.uk/careers/x", "Willmott Dixon is recruiting a placement student.", "Willmott Dixon"],
    ["2027 Warrington Industrial Placement Programme", "https://careers.sellafieldsite.co.uk/jobs/x", "Join Sellafield and help create a clean and safe environment.", "Sellafield"],
    ["Product Engineer Placement Opportunities 2027", "https://allstateinsurance.contacthr.com/1", "At Allstate, great things happen.", "Allstate"],
    ["Placement Student - Supply Chain", "https://fa-espx-saasfaprod1.fa.ocs.oraclecloud.com/z", "We are looking for a student.", "Cummins"],
    ["Purchasing Placement (F1)", "https://careersmanager.pageuppeople.com/920/cw/en/job/1", "VACANCIES", null],
  ])("%s <%s> → %s", (title, url, body, name) => {
    expect(employerFor({ nid: "n", title, path: "/jobs/n", applicationUrl: url, body })).toBe(name);
  });
});
