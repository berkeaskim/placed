import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import {
  employerCoverage, enabledSources, summarize, unknownSources, type BenchmarkEmployer, type SeedCompany,
} from "@/lib/ingest/coverage";

const bench: BenchmarkEmployer[] = [
  { name: "Lloyds", sector: "bank", ats: "workday", sources: ["workday:lbg/LBG_Careers", "workday:lbg/graduate_careers"] },
  { name: "Goldman", sector: "bank", ats: "custom", sources: [] },
  { name: "Clifford Chance", sector: "law", ats: "smartrecruiters", sources: ["smartrecruiters:cliffordchance"] },
];
const companies: SeedCompany[] = [
  { ats: "workday", slug: "lbg/LBG_Careers", enabled: false },
  { ats: "workday", slug: "lbg/graduate_careers", enabled: true },
  { ats: "smartrecruiters", slug: "cliffordchance" }, // enabled defaults to true, as in seed.ts
];

describe("coverage", () => {
  it("only counts enabled boards", () => {
    expect(enabledSources(bench[0], companies)).toEqual(["workday:lbg/graduate_careers"]);
    expect(enabledSources(bench[0], [companies[0]])).toEqual([]);
  });

  it("summarizes per sector with an 'all' row (offline)", () => {
    const s = summarize(employerCoverage(bench, companies));
    expect(s).toEqual([
      { sector: "bank", total: 2, configured: 1 },
      { sector: "law", total: 1, configured: 1 },
      { sector: "all", total: 3, configured: 2 },
    ]);
  });

  it("live: sums kept/uk over enabled boards and keeps errors apart", () => {
    const live = new Map([
      ["workday:lbg/graduate_careers", { kept: 33, uk: 33 }],
      ["workday:lbg/LBG_Careers", { kept: 99, uk: 99 }], // disabled: must not count
      ["smartrecruiters:cliffordchance", { error: "HTTP 500" }],
    ]);
    const rows = employerCoverage(bench, companies, live);
    expect(rows[0]).toMatchObject({ kept: 33, uk: 33, errors: [] });
    expect(rows[2]).toMatchObject({ configured: true, kept: 0, errors: ["smartrecruiters:cliffordchance: HTTP 500"] });
    expect(summarize(rows).at(-1)).toEqual({ sector: "all", total: 3, configured: 2, live: 1, liveUk: 1 });
  });

  it("flags benchmark sources that don't exist in the companies file", () => {
    expect(unknownSources([...bench, { name: "X", sector: "tech", ats: "greenhouse", sources: ["greenhouse:typo"] }], companies))
      .toEqual(["greenhouse:typo"]);
  });

  it("the real benchmark only references boards that exist in seed/companies.yml", () => {
    const realBench = YAML.parse(readFileSync("seed/coverage-benchmark.yml", "utf8")) as BenchmarkEmployer[];
    const realCompanies = YAML.parse(readFileSync("seed/companies.yml", "utf8")) as SeedCompany[];
    expect(unknownSources(realBench, realCompanies)).toEqual([]);
    expect(new Set(realBench.map((e) => e.name)).size).toBe(realBench.length);
  });
});
