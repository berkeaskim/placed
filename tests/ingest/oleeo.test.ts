import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fetchOleeo, oleeoBoardUrl, parseOleeoDetail, parseOleeoList, parseUkDate } from "@/lib/ingest/providers/oleeo";
import { detectEmploymentType } from "@/lib/ingest/filter";

// Trimmed live pages (2026-10-20): Nomura campus (table layout), Rothschild (tile layout), Morgan Stanley (50 + next page).
const fx = (f: string) => readFileSync(`tests/ingest/fixtures/oleeo/${f}`, "utf8");

describe("oleeoBoardUrl", () => {
  it("maps tenant/list to the public job board", () => {
    expect(oleeoBoardUrl("nomuracampus/1")).toBe("https://nomuracampus.tal.net/vx/candidate/jobboard/vacancy/1/adv/");
    expect(oleeoBoardUrl("rothschildandco/2", 50)).toBe("https://rothschildandco.tal.net/vx/candidate/jobboard/vacancy/2/adv/?start=50");
  });
  it("rejects anything but a tenant and a list number", () => {
    expect(() => oleeoBoardUrl("nomura")).toThrow();
    expect(() => oleeoBoardUrl("evil.com/1")).toThrow();
  });
});

describe("parseOleeoList", () => {
  it("reads the table layout: id, full title, link, location and deadline columns", () => {
    const rows = parseOleeoList(fx("nomura-list.html"));
    const discover = rows.find((r) => r.id === "1478")!;
    expect(discover).toMatchObject({
      title: "2027 - Discover Nomura Programme - Insight Programme",
      location: "London",
      deadline: "2027-01-10",
    });
    expect(discover.url).toMatch(/^https:\/\/nomuracampus\.tal\.net\/.*\/opp\/1478-/);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length); // de-duplicated
    expect(rows.find((r) => r.id === "1477")?.title).toBe("2027 - Women’s Immersion Programme - Global Markets & Investment Banking - London");
  });
  it("reads the tile layout (deadline in a labelled field)", () => {
    const rows = parseOleeoList(fx("rothschild-tiles.html"));
    expect(rows.length).toBe(32);
    const hk = rows.find((r) => r.id === "1024")!;
    expect(hk).toMatchObject({ title: "2027 Global Advisory Summer Internship Programme - Hong Kong", deadline: "2026-10-25" });
  });
  it("sees a next page", () => {
    expect(parseOleeoList(fx("ms-page1.html")).length).toBe(50);
  });
});

describe("parseOleeoDetail", () => {
  it("reads the labelled fields and the description", () => {
    const d = parseOleeoDetail(fx("nomura-1478.html"));
    expect(d.fields).toMatchObject({ Location: "London", "Program type": "Internship" });
    expect(d.html).toMatch(/first year of university or second year of a four-year course/);
    // The labelled fields are kept as readable lines for the tagger (minus the description label itself).
    expect(d.html).toMatch(/Program type: Internship/);
  });
  it("Discover Nomura becomes a spring week from its body, despite 'Program type: Internship'", () => {
    const d = parseOleeoDetail(fx("nomura-1478.html"));
    const text = d.html.replace(/<[^>]+>/g, " ");
    expect(detectEmploymentType("2027 - Discover Nomura Programme - Insight Programme", text)).toBe("spring_week");
  });
});

describe("parseUkDate", () => {
  it.each([["10 Jan 2027", "2027-01-10"], ["25 October 2026", "2026-10-25"], ["Rolling", null], ["", null], ["31 Feb 2027", null]] as const)("%s → %s", (s, d) => {
    expect(parseUkDate(s)).toBe(d);
  });
});

describe("fetchOleeo", () => {
  it("pages with ?start=, fetches details only for kept titles, and builds RawJobs", async () => {
    const page1 = fx("nomura-list.html");
    const detail = fx("nomura-1478.html");
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/jobboard/")) return new Response(url.includes("start=") ? "<html></html>" : page1, { status: 200 });
      return new Response(detail, { status: 200 });
    });
    const keep = (t: string) => /Discover Nomura|Industrial Placement/.test(t);
    const jobs = await fetchOleeo("nomuracampus/1", keep, fetchImpl as unknown as typeof fetch, async () => {});
    expect(jobs.map((j) => j.extId).sort()).toEqual(["1478", "1521"]);
    const discover = jobs.find((j) => j.extId === "1478")!;
    expect(discover).toMatchObject({ location: "London", deadline: "2027-01-10", programme: "Internship", remote: false });
    // List page + one detail per kept title; no next page without a "?start=" link.
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes("/opp/")).length).toBe(2);
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes("/jobboard/")).length).toBe(1);
  });
  it("follows the next-page link and stops on a page with nothing new", async () => {
    const page1 = fx("ms-page1.html");
    const fetchImpl = vi.fn(async (url: string) =>
      new Response(String(url).includes("start=50") ? page1 /* same rows again: nothing new */ : page1, { status: 200 }));
    const jobs = await fetchOleeo("morganstanley/1", () => false, fetchImpl as unknown as typeof fetch, async () => {});
    expect(jobs).toEqual([]);
    expect(fetchImpl.mock.calls.length).toBe(2);
  });
  it("a board with no rows is an error, not an empty board", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>maintenance</html>", { status: 200 }));
    await expect(fetchOleeo("nomuracampus/1", () => true, fetchImpl as unknown as typeof fetch, async () => {})).rejects.toThrow(/no postings/i);
  });
});

describe("deadline from the detail page", () => {
  it("uses a closing-date field when the list has no date column", async () => {
    const list = `<table><tr class="opp_7 search_res" data-oppid="7" data-title="2027 Investment Banking Spring Week Programme - London"><td><a class="subject" href="https://jefferies.tal.net/x/opp/7-a/en-GB">x</a></td></tr></table>`;
    const detail = `<div class="form-group type_text"><span class="hform_lbl_text" >Closing Date</span><div class="form-control-static" > 30 Nov 2026 </div></div>`;
    const fetchImpl = vi.fn(async (url: string) => new Response(String(url).includes("/opp/") ? detail : list, { status: 200 }));
    const [job] = await fetchOleeo("jefferies/2", () => true, fetchImpl as unknown as typeof fetch, async () => {});
    expect(job.deadline).toBe("2026-11-30");
  });
});
