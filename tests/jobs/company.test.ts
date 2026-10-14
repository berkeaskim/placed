import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { companyDisplay, COMPANY_FALLBACK } from "@/lib/jobs/company";
import { CompanyMark } from "@/components/company-mark";

describe("companyDisplay", () => {
  it("uses the stored company name, trimmed", () => {
    expect(companyDisplay({ company: "  Monzo ", url: "https://jobs.lever.co/other/1" })).toEqual({ name: "Monzo", initial: "M", fallback: false });
  });

  it("initial skips leading punctuation and digits-only names still get an initial", () => {
    expect(companyDisplay({ company: "(Wise)", url: "" }).initial).toBe("W");
    expect(companyDisplay({ company: "3M", url: "" }).initial).toBe("3");
  });

  it("initial handles non-ASCII names", () => {
    expect(companyDisplay({ company: "ünilever", url: "" }).initial).toBe("Ü");
  });

  describe("missing name falls back to the ATS board slug in the job URL", () => {
    const cases: [string, string][] = [
      ["https://boards.greenhouse.io/deepmind/jobs/123", "Deepmind"],
      ["https://job-boards.eu.greenhouse.io/wise-careers/jobs/9", "Wise Careers"],
      ["https://jobs.lever.co/palantir/abc-123", "Palantir"],
      ["https://jobs.ashbyhq.com/ElevenLabs/uuid", "ElevenLabs"],
      ["https://jpmc.wd5.myworkdayjobs.com/en-US/careers/job/London/Intern_R1", "Jpmc"],
    ];
    for (const [url, name] of cases) {
      it(url, () => expect(companyDisplay({ company: "", url })).toEqual({ name, initial: name[0].toUpperCase(), fallback: true }));
    }
  });

  it("Greenhouse embed links read the board from ?for=", () => {
    expect(companyDisplay({ company: "", url: "https://boards.greenhouse.io/embed/job_app?for=monzo&token=1" }).name).toBe("Monzo");
  });

  it("never guesses from route segments, job boards or careers domains (would show the wrong company)", () => {
    for (const url of [
      "https://boards.greenhouse.io/embed/job_app?token=1",
      "https://jobs.ashbyhq.com/api/x",
      "https://careers.monzo.com/jobs/1",
      "https://apply.workable.com/acme",
      "https://uk.indeed.com/viewjob?jk=1",
      "https://www.linkedin.com/jobs/view/1",
      "http://10.0.0.1/jobs",
    ]) {
      expect(companyDisplay({ company: "", url }).name).toBe(COMPANY_FALLBACK);
    }
  });

  it("a malformed %-escape in the URL does not throw", () => {
    expect(() => companyDisplay({ company: "", url: "https://jobs.lever.co/%E0%A4%A" })).not.toThrow();
    expect(companyDisplay({ company: "", url: "https://jobs.lever.co/%E0%A4%A" }).name).toBe(COMPANY_FALLBACK);
  });

  it("ATS host without a slug, junk or non-http URLs give the generic fallback", () => {
    for (const url of ["https://boards.greenhouse.io/", "not a url", "javascript:alert(1)", "", "https://localhost/x"]) {
      expect(companyDisplay({ company: "", url })).toEqual({ name: COMPANY_FALLBACK, initial: "?", fallback: true });
    }
  });

  it("whitespace-only name counts as missing", () => {
    expect(companyDisplay({ company: "   ", url: "" }).name).toBe(COMPANY_FALLBACK);
  });
});

describe("CompanyMark", () => {
  it("renders the company name as visible text with an avatar initial", () => {
    const html = renderToStaticMarkup(createElement(CompanyMark, { company: "Monzo", url: "" }));
    expect(html).toContain(">Monzo<");
    expect(html).toContain(">M<");
    expect(html).toMatch(/aria-hidden="true"[^>]*>M</);
  });

  it("renders the fallback name for a job with no company", () => {
    const html = renderToStaticMarkup(createElement(CompanyMark, { company: "", url: "https://jobs.lever.co/palantir/1" }));
    expect(html).toContain(">Palantir<");
    const none = renderToStaticMarkup(createElement(CompanyMark, { company: "", url: "" }));
    expect(none).toContain(`>${COMPANY_FALLBACK}<`);
    expect(none).toContain(">?<");
  });

  it("the large job-page size still renders the name and initial", () => {
    const html = renderToStaticMarkup(createElement(CompanyMark, { company: "Monzo", url: "", size: "lg" }));
    expect(html).toContain(">Monzo<");
    expect(html).toMatch(/aria-hidden="true"[^>]*>M</);
  });
});
