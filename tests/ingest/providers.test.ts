import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { passesTitleFilter, passesLocationFilter } from "@/lib/ingest/filter";
import { htmlToLines } from "@/lib/text/jd";
import gh from "../fixtures/ats/greenhouse.json";
import lever from "../fixtures/ats/lever.json";
import ashby from "../fixtures/ats/ashby.json";
import { normalizeGreenhouse, normalizeLever, normalizeAshby, fetchJobs, endpointFor, ProviderError } from "@/lib/ingest/providers";

function assertRawJobs(jobs: ReturnType<typeof normalizeLever>) {
  expect(jobs.length).toBeGreaterThan(0);
  for (const j of jobs) {
    expect(j.extId).toBeTruthy();
    expect(j.title).toBeTruthy();
    expect(j.url).toMatch(/^https:\/\//);
    expect(typeof j.location).toBe("string");
    expect(typeof j.remote).toBe("boolean");
    expect(typeof j.html).toBe("string");
  }
}

describe("provider normalizers (recorded real responses)", () => {
  it("greenhouse", () => assertRawJobs(normalizeGreenhouse(gh, "marshallwace")));
  it("lever", () => assertRawJobs(normalizeLever(lever)));
  it("ashby", () => assertRawJobs(normalizeAshby(ashby)));
  it("returns [] for malformed payloads instead of throwing", () => {
    expect(normalizeGreenhouse({ nope: 1 }, "x")).toEqual([]);
    expect(normalizeLever({})).toEqual([]);
    expect(normalizeAshby(null)).toEqual([]);
  });
});

describe("endpointFor", () => {
  it("uses the EU host when configured", () => {
    expect(endpointFor({ slug: "mangroup", name: "Man", ats: "greenhouse", apiHost: "boards-api.eu.greenhouse.io" }))
      .toBe("https://boards-api.eu.greenhouse.io/v1/boards/mangroup/jobs?content=true");
  });
});

describe("fetchJobs", () => {
  it("throws ProviderError on non-2xx", async () => {
    const fake = vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchJobs({ slug: "x", name: "X", ats: "lever" }, fake)).rejects.toThrow(/404/);
    await expect(fetchJobs({ slug: "x", name: "X", ats: "lever" }, fake)).rejects.toBeInstanceOf(ProviderError);
  });
  it("throws ProviderError on a 200 with a non-JSON body", async () => {
    const fake = vi.fn(async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch;
    const p = fetchJobs({ slug: "x", name: "X", ats: "ashby" }, fake);
    await expect(p).rejects.toBeInstanceOf(ProviderError);
    await expect(p).rejects.toThrow(/ashby\/x/);
  });
  it("throws ProviderError when fetch itself rejects", async () => {
    const fake = vi.fn(async () => { throw new Error("boom"); }) as unknown as typeof fetch;
    await expect(fetchJobs({ slug: "x", name: "X", ats: "greenhouse" }, fake)).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("malformed entries are skipped, not thrown on", () => {
  it("greenhouse", () => {
    const out = normalizeGreenhouse({ jobs: [...gh.jobs, null, { id: 1 }, { title: "t" }] }, "x");
    expect(out).toHaveLength(gh.jobs.length);
  });
  it("lever", () => {
    const out = normalizeLever([...lever, null, { id: "a" }, { text: "t" }]);
    expect(out).toHaveLength(lever.length);
  });
  it("ashby", () => {
    const out = normalizeAshby({ jobs: [...ashby.jobs, null, { id: "a" }, { title: "t" }] });
    expect(out).toHaveLength(ashby.jobs.length);
  });
});

describe("curated provider", () => {
  const dirs: string[] = [];
  afterEach(() => { delete process.env.PLACED_PROGRAMMES_FILE; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const prog = (employer: string, title: string, over: Record<string, unknown> = {}) =>
    `- ${Object.entries({ employer, name: employer, title, url: `https://example.com/${employer}`, location: "London, UK", opens: "2026-12", season: 2027, kind: "graduate", description: "A scheme.", ...over }).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n  ")}`;
  const withProgrammesFile = (yml: string) => {
    const d = mkdtempSync(path.join(tmpdir(), "placed-prog-"));
    dirs.push(d);
    writeFileSync(path.join(d, "programmes.yml"), yml);
    process.env.PLACED_PROGRAMMES_FILE = path.join(d, "programmes.yml");
  };

  it("curated fetchJobs returns only that employer's visible programmes", async () => {
    withProgrammesFile([
      prog("barclays", "Spring Week"),
      prog("barclays", "Old Graduate Programme", { season: 2000 }),
      prog("deloitte", "Graduate Programme"),
    ].join("\n"));
    const jobs = await fetchJobs({ ats: "curated", slug: "barclays", name: "Barclays" });
    expect(jobs.map((j) => j.title)).toEqual(["Spring Week"]);
    expect(jobs[0]!.opensOn).toBe("2026-12-01");
  });

  it("curated fails the board (never returns a partial list) when the file has a bad row, a non-list or a YAML error", async () => {
    for (const yml of [
      [prog("barclays", "Spring Week"), prog("barclays", "Graduate Programme", { opens: "Sept" })].join("\n"),
      [prog("barclays", "Spring Week"), prog("deloitte", "Graduate Programme", { closes: "2026-13-45" })].join("\n"),
      "employer: barclays",
      "- employer: [unclosed",
    ]) {
      withProgrammesFile(yml);
      await expect(fetchJobs({ ats: "curated", slug: "barclays", name: "Barclays" }), yml).rejects.toThrow(ProviderError);
    }
  });

  it("curated rows with reasonable titles pass the ingest filters", async () => {
    const titles = ["Spring Week", "Graduate Programme", "Summer Internship"];
    withProgrammesFile(titles.map((t, i) => prog("bank", t, { kind: ["spring-week", "graduate", "internship"][i] })).join("\n"));
    const jobs = await fetchJobs({ ats: "curated", slug: "bank", name: "Bank" });
    expect(jobs).toHaveLength(3);
    for (const j of jobs) {
      expect(passesTitleFilter(j.title), j.title).toBe(true);
      expect(passesLocationFilter(j.location, j.remote, htmlToLines(j.html).join("\n")).pass, j.title).toBe(true);
    }
  });
});
