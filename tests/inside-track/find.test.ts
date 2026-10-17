import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { findPeople, groupQuery, schoolNames } from "@/lib/inside-track/find";

const UCL = "University College London";

const hit = (name: string, slug: string, snippet = "UCL") => ({ title: `${name} - Monzo | LinkedIn`, link: `https://uk.linkedin.com/in/${slug}`, snippet });

describe("groupQuery", () => {
  it("builds site-restricted queries and skips team without a division", () => {
    expect(groupQuery("alumni", "Monzo", "Data Analyst Intern", UCL)).toBe('site:linkedin.com/in "Monzo" ("University College London" OR UCL)');
    expect(groupQuery("alumni", "Monzo", "Data Analyst Intern", "University of Bristol")).toBe('site:linkedin.com/in "Monzo" "University of Bristol"');
    expect(groupQuery("alumni", "Monzo", "Data Analyst Intern", null)).toBeNull();
    expect(groupQuery("team", "Monzo", "Data Analyst Intern")).toBe('site:linkedin.com/in "Monzo" Data');
    expect(groupQuery("team", "Monzo", "Summer Internship 2027")).toBeNull();
  });
});

describe("schoolNames", () => {
  it("adds an acronym but never a bare place name", () => {
    expect(schoolNames(UCL)).toEqual([UCL, "UCL"]);
    expect(schoolNames("The University of Manchester")).toEqual(["The University of Manchester"]);
    expect(schoolNames("University of Bristol")).toEqual(["University of Bristol"]);
  });
});

describe("findPeople", () => {
  it("caps groups at 2/2/1 and de-duplicates across groups, first group wins", async () => {
    const search = vi.fn(async (q: string) => q.includes("UCL")
      ? [hit("Ann Lee", "ann"), hit("Bob Ray", "bob"), hit("Cat Fox", "cat")]
      : [hit("Ann Lee", "ann"), hit("Dan Moe", "dan"), hit("Eve Poe", "eve"), hit("Fay Kim", "fay")]);
    const r = await findPeople("Monzo", "Data Analyst Intern", UCL, search);
    expect(r.searched).toBe(true);
    expect(r.groups.alumni.map((p) => p.name)).toEqual(["Ann Lee", "Bob Ray"]);
    expect(r.groups.team.map((p) => p.name)).toEqual(["Dan Moe", "Eve Poe"]);
    expect(r.groups.recruiter.map((p) => p.name)).toEqual(["Fay Kim"]);
  });
  it("a failing group stays empty without breaking the others", async () => {
    const search = vi.fn(async (q: string) => { if (q.includes("UCL")) throw new Error("500"); return [hit("Dan Moe", "dan")]; });
    const r = await findPeople("Monzo", "Data Analyst Intern", UCL, search);
    expect(r.groups.alumni).toEqual([]);
    expect(r.groups.team).toHaveLength(1);
  });
  it("only calls someone an alumnus when the result itself mentions UCL", async () => {
    const search = vi.fn(async (q: string) => q.includes("UCL")
      ? [hit("Ann Lee", "ann", "Studied at King's College London"), hit("Bob Ray", "bob", "University College London · BSc Economics")]
      : []);
    const r = await findPeople("Monzo", "Data Analyst Intern", UCL, search);
    expect(r.groups.alumni.map((p) => p.name)).toEqual(["Bob Ray"]);
  });
  it("checks alumni against the student's own university, and skips alumni without one", async () => {
    const search = vi.fn(async (q: string) => q.includes("Bristol")
      ? [hit("Ann Lee", "ann", "University College London"), hit("Bob Ray", "bob", "University of Bristol · BSc")]
      : []);
    expect((await findPeople("Monzo", "Data Analyst Intern", "University of Bristol", search)).groups.alumni.map((p) => p.name)).toEqual(["Bob Ray"]);
    search.mockClear();
    await findPeople("Monzo", "Data Analyst Intern", null, search);
    expect(search.mock.calls.map(([q]) => q).some((q) => q.includes("Bristol") || q.includes("UCL"))).toBe(false);
  });
  it("skips the team query when the title has no division", async () => {
    const search = vi.fn(async () => [hit("Dan Moe", "dan")]);
    await findPeople("Monzo", "Summer Internship 2027", UCL, search);
    expect(search).toHaveBeenCalledTimes(2);
  });
  it("without a key and without a fixture it reports searched: false", async () => {
    vi.stubEnv("SERPER_API_KEY", "");
    expect(await findPeople("Nowhere Ltd", "Analyst", UCL)).toEqual({ searched: false, groups: { alumni: [], team: [], recruiter: [] } });
    vi.unstubAllEnvs();
  });
  it("without a key it uses the company fixture", async () => {
    vi.stubEnv("SERPER_API_KEY", "");
    const r = await findPeople("Monzo", "Data Analyst Intern", UCL);
    expect(r.searched).toBe(true);
    expect(r.groups.alumni.map((p) => p.name)).toEqual(["Priya Shah", "Tom Okafor"]);
    vi.unstubAllEnvs();
  });
});
