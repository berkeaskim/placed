import { describe, expect, it } from "vitest";
import { bulletJaccard, isDupBullet, matchEntry, normOrg, parseYm, rangesOverlap, sameEntry, titleOverlap } from "@/lib/bank/match";
import type { BankEntry } from "@/lib/bank/types";

const e = (org: string, title: string, startYm: string | null, endYm: string | null) => ({ org, title, startYm, endYm });

describe("normOrg", () => {
  it("strips suffixes and punctuation", () => {
    expect(normOrg("Goldman Sachs Group, Inc.")).toBe(normOrg("goldman sachs"));
  });
});

describe("titleOverlap / rangesOverlap", () => {
  it("jaccard on words of length >= 2", () => {
    expect(titleOverlap("Data Analyst", "data analyst")).toBe(1);
    expect(titleOverlap("a b", "c d")).toBe(0);
  });
  it("null end means present; null start is false", () => {
    expect(rangesOverlap({ startYm: "2024-01", endYm: null }, { startYm: "2025-01", endYm: "2025-03" })).toBe(true);
    expect(rangesOverlap({ startYm: null, endYm: null }, { startYm: "2025-01", endYm: null })).toBe(false);
    expect(rangesOverlap({ startYm: "2020-01", endYm: "2020-03" }, { startYm: "2021-01", endYm: "2021-03" })).toBe(false);
  });
});

describe("sameEntry", () => {
  it("matches via date overlap despite different titles", () => {
    expect(sameEntry(e("Acme Ltd", "Software Engineering Intern", "2024-06", "2024-08"), e("ACME", "SWE Intern", "2024-07", "2024-09"))).toBe(true);
  });
  it("different orgs are not the same", () => {
    expect(sameEntry(e("Acme", "Analyst", "2024-06", "2024-08"), e("Globex", "Analyst", "2024-06", "2024-08"))).toBe(false);
  });
  it("same org, disjoint dates, no title overlap", () => {
    expect(sameEntry(e("Acme", "Analyst", "2020-01", "2020-03"), e("Acme", "Barista", "2022-01", "2022-03"))).toBe(false);
  });
  it("empty org never matches", () => {
    expect(sameEntry(e("", "Analyst", "2020-01", null), e("", "Analyst", "2020-01", null))).toBe(false);
  });
});

describe("bullets", () => {
  it("detects near-duplicates", () => {
    expect(isDupBullet("Built a Python ETL pipeline cutting load time 40%", ["Built Python ETL pipeline, cutting load time by 40%"])).toBe(true);
  });
  it("different claim is not a dup", () => {
    expect(isDupBullet("Led a team of five analysts on pricing", ["Built Python ETL pipeline, cutting load time by 40%"])).toBe(false);
    expect(bulletJaccard("", "")).toBe(0);
  });
});

describe("matchEntry", () => {
  it("returns all matching bank entries", () => {
    const mk = (id: string, org: string, title: string, s: string, en: string): BankEntry => ({
      id, section: "experience", org, title, dates: "", startYm: s, endYm: en, location: "", pinned: false, hidden: false, sourceIds: [], bullets: [], updatedAt: "",
    });
    const bank = [mk("1", "Acme Ltd", "SWE Intern", "2024-07", "2024-09"), mk("2", "Globex", "SWE Intern", "2024-07", "2024-09")];
    const cand = { org: "ACME", title: "Software Engineering Intern", startYm: "2024-06", endYm: "2024-08" };
    expect(matchEntry(cand, bank).map((x) => x.id)).toEqual(["1"]);
  });
});

describe("parseYm", () => {
  it.each([
    ["June 2025 - August 2025 (3 months)", "2025-06", "2025-08"],
    ["Sep 2024 – Present", "2024-09", null],
    ["Jun 2024 – Aug 2024", "2024-06", "2024-08"],
    ["2023 - Present", "2023-01", null],
    ["Summer 2024", "2024-06", "2024-08"],
    ["", null, null],
  ])("%s", (s, a, b) => {
    expect(parseYm(s)).toEqual({ startYm: a, endYm: b });
  });
});
