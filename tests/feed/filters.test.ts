import { describe, it, expect } from "vitest";
import { applyFilters, parseFilters, type FeedFilters } from "@/lib/feed/filters";
import type { Ranked } from "@/lib/feed/rank";

const r = (id: string, over: { location?: string; remote?: boolean; archetype?: string | null; deadline?: string | null; curated?: boolean } = {}) =>
  ({ job: { id, location: "London", remote: false, archetype: "data_analytics", deadline: null, ...over } }) as unknown as Ranked;
const ids = (xs: Ranked[]) => xs.map((x) => x.job.id);
const none: FeedFilters = { a: null, loc: null, soon: false };
const today = "2026-10-13";

describe("applyFilters", () => {
  const rows = [
    r("ldn", { location: "London, UK" }),
    r("man", { location: "Manchester, UK" }),
    r("ber", { location: "Berlin, Germany" }),
    r("rem", { location: "Remote", remote: true }),
  ];
  it("no filter keeps everything in order", () => expect(ids(applyFilters(rows, none, today))).toEqual(["ldn", "man", "ber", "rem"]));
  it("filters by region via classifyRegion", () => {
    expect(ids(applyFilters(rows, { ...none, loc: "london" }, today))).toEqual(["ldn"]);
    expect(ids(applyFilters(rows, { ...none, loc: "uk" }, today))).toEqual(["man"]);
    expect(ids(applyFilters(rows, { ...none, loc: "europe" }, today))).toEqual(["ber"]);
    expect(ids(applyFilters(rows, { ...none, loc: "remote" }, today))).toEqual(["rem"]);
  });
  it("filters by archetype", () => {
    const xs = [r("a"), r("b", { archetype: "consulting" })];
    expect(ids(applyFilters(xs, { ...none, a: "consulting" }, today))).toEqual(["b"]);
  });
  it("closing soon = valid deadline within 7 London days, including today; excludes missing deadlines", () => {
    const xs = [r("today", { deadline: "2026-10-13" }), r("d7", { deadline: "2026-10-20" }), r("d8", { deadline: "2026-10-21" }), r("none"), r("junk", { deadline: "TBC" })];
    expect(ids(applyFilters(xs, { ...none, soon: true }, today))).toEqual(["today", "d7"]);
  });
  it("closing soon never includes curated cards, even with a near deadline", () => {
    const xs = [r("live", { deadline: "2026-10-16" }), r("cur", { deadline: "2026-10-16", curated: true })];
    expect(ids(applyFilters(xs, { ...none, soon: true }, today))).toEqual(["live"]);
  });
  it("combines filters", () => {
    const xs = [r("a", { location: "London", deadline: "2026-10-14" }), r("b", { location: "Paris, France", deadline: "2026-10-14" })];
    expect(ids(applyFilters(xs, { a: "data_analytics", loc: "london", soon: true }, today))).toEqual(["a"]);
  });
});

describe("parseFilters", () => {
  it("accepts only known values", () => {
    expect(parseFilters({ a: "consulting", loc: "uk", soon: "1" })).toEqual({ a: "consulting", loc: "uk", soon: true });
    expect(parseFilters({ a: "bogus", loc: "mars", soon: "0" })).toEqual(none);
    expect(parseFilters({ a: ["consulting"], loc: undefined })).toEqual(none);
  });
});
