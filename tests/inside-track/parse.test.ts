import { describe, expect, it } from "vitest";
import { parseResult } from "@/lib/inside-track/parse";

const r = (title: string, link = "https://uk.linkedin.com/in/jane-doe-123", snippet = "") => ({ title, link, snippet });

describe("parseResult", () => {
  it("parses hyphen, en-dash and em-dash titles and normalises the URL", () => {
    expect(parseResult(r("Jane Doe - Talent Partner - Monzo Bank | LinkedIn"), "Monzo"))
      .toEqual({ name: "Jane Doe", headline: "Talent Partner · Monzo Bank", url: "https://www.linkedin.com/in/jane-doe-123" });
    expect(parseResult(r("Jane Doe – Monzo | LinkedIn"), "Monzo")?.headline).toBe("Monzo");
    expect(parseResult(r("Jane Doe — Data Analyst at Monzo"), "Monzo")?.name).toBe("Jane Doe");
  });
  it("accepts the company only in the snippet", () => {
    expect(parseResult(r("Jane Doe - Recruiter | LinkedIn", undefined, "Experience: Monzo Bank · London"), "Monzo Bank")?.name).toBe("Jane Doe");
  });
  it("rejects non-profile links", () => {
    for (const link of ["https://www.linkedin.com/pub/jane/1/2/3", "https://www.linkedin.com/posts/jane_x", "https://www.linkedin.com/company/monzo",
      "https://www.linkedin.com/in/jane?trk=x", "https://evil.com/in/jane", "http://www.linkedin.com/in/jane", "https://evillinkedin.com/in/jane"]) {
      expect(parseResult(r("Jane Doe - Monzo | LinkedIn", link), "Monzo")).toBeNull();
    }
  });
  it("rejects truncated, numeric, one-word, company-named and off-company results", () => {
    expect(parseResult(r("Jane Do… - Monzo | LinkedIn"), "Monzo")).toBeNull();
    expect(parseResult(r("Jane Doe 2 - Monzo | LinkedIn"), "Monzo")).toBeNull();
    expect(parseResult(r("Jane - Monzo | LinkedIn"), "Monzo")).toBeNull();
    expect(parseResult(r("Monzo Bank - Banking | LinkedIn"), "Monzo Bank")).toBeNull();
    expect(parseResult(r("Jane Doe - Recruiter - Wise | LinkedIn"), "Monzo")).toBeNull();
    expect(parseResult(r("Jane Doe - Monzonite Mining | LinkedIn"), "Monzo")).toBeNull();
  });
  it("keeps apostrophes, hyphens and accents in names", () => {
    expect(parseResult(r("Seán O'Brien-Smith - Monzo | LinkedIn"), "Monzo")?.name).toBe("Seán O'Brien-Smith");
  });
  it("matches a company with or without a Bank/Ltd/Group suffix", () => {
    expect(parseResult(r("Jane Doe - Analyst at Monzo | LinkedIn"), "Monzo Bank")?.name).toBe("Jane Doe");
  });
});

describe("parseResult — company evidence", () => {
  it("needs the company in the headline for short or common-word names; the snippet alone is not enough", () => {
    expect(parseResult(r("Jane Doe - Student at UCL | LinkedIn", undefined, "Bloomberg Market Concepts certificate"), "Bloomberg")).toBeNull();
    expect(parseResult(r("Jane Doe - Student | LinkedIn", undefined, "a wise investment"), "Wise")).toBeNull();
    expect(parseResult(r("Jane Doe - Analyst at Wise | LinkedIn"), "Wise")?.name).toBe("Jane Doe");
  });
  it("does not count a mention inside the person's own name", () => {
    expect(parseResult(r("Tom Wise - Student | LinkedIn"), "Wise")).toBeNull();
  });
  it("strips honorifics and rejects names over 60 characters", () => {
    expect(parseResult(r("Dr. Jane Doe - Monzo | LinkedIn"), "Monzo")?.name).toBe("Jane Doe");
    expect(parseResult(r(`${"Abcdefghijklmnopq ".repeat(4).trim()} - Monzo | LinkedIn`), "Monzo")).toBeNull();
  });
});

describe("parseResult — real-world titles (Serper, 2026-10-16)", () => {
  it("drops a bracketed former surname from the name", () => {
    expect(parseResult(r("Katie Brown (Gormley) - Hiring @ Monzo"), "Monzo")?.name).toBe("Katie Brown");
  });
  it("cleans emoji and the search engine's trailing ellipsis from the headline", () => {
    expect(parseResult(r("Sophie Walker - Senior Recruiter @ Monzo Bank 🚀 🚨 ..."), "Monzo")?.headline).toBe("Senior Recruiter @ Monzo Bank");
    expect(parseResult(r("Anna Bee - Technical Recruiter at Monzo I ex- ..."), "Monzo")?.headline).toBe("Technical Recruiter at Monzo I ex-");
  });
});
