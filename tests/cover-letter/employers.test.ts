/** Audit 09 #2: the wrong-employer list comes from the student's own tracker, so it works with no research key. */
import { describe, it, expect } from "vitest";
import { companyNames, otherEmployerNames, STATIC_EMPLOYERS } from "@/lib/cover-letter/employers";

describe("otherEmployerNames", () => {
  const base = { company: "Citi", cvOrgs: ["Finance Society", "Tesco"], jdLines: ["Analyst programme in London"], rivals: [] };
  it("includes the student's other tracked companies with no research rivals", () => {
    expect(otherEmployerNames({ ...base, tracked: ["Barclays", "Citi", "Lendable"] })).toEqual(expect.arrayContaining(["Barclays", "Lendable"]));
  });
  it("never lists the company itself (any alias), a CV org or a name the advert uses", () => {
    const names = otherEmployerNames({ company: "JPMorgan Chase & Co.", cvOrgs: ["Tesco"], jdLines: ["You will work with Goldman Sachs alumni"], rivals: [], tracked: ["Tesco"] });
    for (const n of ["J.P. Morgan", "JPMorgan", "JPMC", "Tesco", "Goldman Sachs"]) expect(names).not.toContain(n);
    expect(names).toContain("Morgan Stanley");
  });
  it("leaves ordinary-word and tool names out of the static list", () => {
    for (const n of ["Next", "Wise", "Apple", "Bloomberg", "Tableau"]) expect(STATIC_EMPLOYERS).not.toContain(n);
    expect(STATIC_EMPLOYERS).toEqual(expect.arrayContaining(["Barclays", "Goldman Sachs", "Deloitte"]));
  });
  it("knows aliases", () => expect(companyNames("J.P. Morgan")).toContain("JPMorgan"));
});
