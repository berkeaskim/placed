import { describe, it, expect } from "vitest";
import { seedCompanyRows } from "@/lib/ingest/seed";

describe("seedCompanyRows", () => {
  it("maps employer and transport", () => {
    const rows = seedCompanyRows([{ slug: "x", name: "X", ats: "oracle", apiHost: "h", employer: "jpmorgan", transport: "stealth" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: "x", name: "X", ats: "oracle", api_host: "h", employer: "jpmorgan", transport: "stealth", enabled: true });
  });

  it("nulls an unknown transport and missing optional fields", () => {
    const rows = seedCompanyRows([{ slug: "y", name: "Y", ats: "lever", transport: "foo" }]);
    expect(rows[0]).toMatchObject({ api_host: null, employer: null, transport: null, enabled: true });
  });

  it("drops unknown ats rows and honours enabled: false", () => {
    const rows = seedCompanyRows([{ slug: "a", name: "A", ats: "nope" }, { slug: "b", name: "B", ats: "ashby", enabled: false }]);
    expect(rows.map((r) => r.slug)).toEqual(["b"]);
    expect(rows[0].enabled).toBe(false);
  });
});
