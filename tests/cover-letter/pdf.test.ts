import { describe, it, expect } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { renderLetterPdf, letterFilename } from "@/lib/cover-letter/pdf";
import { safeNamePart } from "@/lib/autopilot/handoff";

const body = [
  "Dear Hiring Team,",
  "I am applying for the Spring Insight role because your rates desk work stood out to me. I led a pricing case at UCL.",
  "In my society I ran a 30-person project, and I would bring the same care to the desk.",
  "Yours faithfully,\nAlex Morgan",
].join("\n\n");

const input = {
  name: "Alex Morgan", email: "alex@example.com", phone: "07700 900123", linkedin: "linkedin.com/in/alexmorgan",
  date: new Date("2026-10-17T12:00:00Z"), company: "Goldman Sachs", ref: "REQ-1234", role: "Spring Insight Analyst", body,
};

async function parse(buf: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: text as string, pages: totalPages };
}

describe("renderLetterPdf", () => {
  it("renders a one-page PDF with header, date, ref and the body", async () => {
    const buf = await renderLetterPdf(input);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const { text, pages } = await parse(buf);
    expect(pages).toBe(1);
    expect(text).toContain("17 October 2026");
    expect(text).toContain("I am applying for the Spring Insight role because your rates desk work stood out to me.");
    expect(text).toContain("alex@example.com");
    expect(text).toContain("Ref: Spring Insight Analyst (REQ-1234)");
    expect(text).toContain("Yours faithfully");
    expect(text.match(/Alex Morgan/g)?.length).toBe(2); // header + the body's own sign-off, no extra signature
  });

  it("omits empty contact parts and the ref number", async () => {
    const { text } = await parse(await renderLetterPdf({ ...input, phone: null, linkedin: null, ref: null }));
    expect(text).toContain("Ref: Spring Insight Analyst");
    expect(text).not.toContain("(");
    expect(text).not.toContain("null");
  });
});

describe("letterFilename", () => {
  it("applies safeNamePart to each part with the fixed pattern", () => {
    const d = new Date("2026-10-17");
    const expected = `${safeNamePart("Berke", "Name")}-${safeNamePart("Askım", "Name")}_Cover-Letter_${safeNamePart("Goldman Sachs", "Company")}_2026-10.pdf`;
    expect(letterFilename("Berke", "Askım", "Goldman Sachs", d)).toBe(expected);
    expect(letterFilename("Berke", "Askım", "Goldman Sachs", d)).toContain("_Goldman-Sachs_");
  });
});
