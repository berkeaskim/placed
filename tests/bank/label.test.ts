import { describe, expect, it } from "vitest";
import { entryLabel } from "@/lib/bank/label";

describe("entryLabel", () => {
  it("is 'title · org'", () => expect(entryLabel({ title: "Analyst", org: "Acme" })).toBe("Analyst · Acme"));
  it("drops the separator when a part is empty", () => {
    expect(entryLabel({ title: "Hackathon", org: "" })).toBe("Hackathon");
    expect(entryLabel({ title: " ", org: "UCL" })).toBe("UCL");
    expect(entryLabel({ title: null, org: undefined })).toBe("");
  });
});
