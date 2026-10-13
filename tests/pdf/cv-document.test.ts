import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { renderCvPdf, CV_FONT_FILES } from "@/lib/pdf/cv-document";
import { toTailored } from "@/lib/verify/tailoring";
import type { ParsedCV } from "@/lib/types";

const cv: ParsedCV = {
  name: "Ayşe Demir", email: "ayse@example.com", phone: "07700 900123", location: "London", links: ["github.com/ayse"],
  summary: "Economics student → analytics",
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "2:1", details: [{ id: "e0-d0", text: "Modules: Econometrics (Stata)" }] }],
  experience: [{ id: "x0", org: "Société Générale", title: "Spring Insight", dates: "2025", location: "London", bullets: [
    { id: "x0-b0", text: "Worked with Zoë on a pricing case → presented to 30 staff" },
    { id: "x0-b1", text: "This bullet was dropped", },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel", "Stata"] }], interests: "Chess", sectionOrder: [], yearGuess: null, archetypes: [],
};

async function pdfText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text as string;
}

describe("renderCvPdf (C22: Unicode font, ATS-safe)", () => {
  it("vendors OFL-licensed Noto Sans TTFs", () => {
    for (const f of CV_FONT_FILES) expect(readFileSync(f).subarray(0, 4).toString("hex")).toBe("00010000");
    expect(readFileSync(path.join(process.cwd(), "public/fonts/OFL.txt"), "utf8")).toMatch(/SIL Open Font License/);
  });

  it("keeps non-ASCII names, puts contact in the body, uses standard headings, skips dropped bullets", async () => {
    const t = toTailored(cv);
    t.experience[0].bullets[1] = { ...t.experience[0].bullets[1], changeType: "dropped" };
    const buf = await renderCvPdf(t, cv);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = await pdfText(buf);
    expect(text).toContain("Ayşe");
    expect(text).toContain("Zoë");
    expect(text).toContain("pricing case -> presented"); // no arrow glyph in Noto Sans: rendered as ASCII, never a blank box
    expect(text).toContain("Société Générale");
    expect(text).toContain("ayse@example.com");
    for (const h of ["EDUCATION", "EXPERIENCE", "SKILLS"]) expect(text).toContain(h);
    expect(text).not.toContain("This bullet was dropped");
    expect(text).not.toContain("NEEDS_NUMBER");
  }, 30_000);
});
