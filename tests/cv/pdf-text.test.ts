import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { extractPdf, isImageOnly } from "@/lib/cv/pdf-text";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { assignIds } from "@/lib/cv/ids";

const LINES = [
  "Sam Patel",
  "sam.patel@example.com | +44 7700 900456 | London",
  "EDUCATION",
  "University College London — BSc Computer Science, 2025–2028",
  "EXPERIENCE",
  "Coding Society — Workshop Lead, 2025–present",
  "• Ran fortnightly Python workshops for 40 first-year students",
  "• Wrote beginner exercises on data structures and testing",
  "PROJECTS",
  "Tube Delay Tracker",
  "• Built a web app in TypeScript and React showing live TfL delays",
  "SKILLS",
  "Python, TypeScript, React, SQL, Git",
];

async function pdf(lines: string[]): Promise<Uint8Array> {
  const page = h(Page, { size: "A4" }, h(View, {}, ...lines.map((l, i) => h(Text, { key: i }, l))));
  return new Uint8Array(await renderToBuffer(h(Document, {}, page)));
}

describe("extractPdf on generated PDFs", () => {
  it("reads a text CV's layer and the heuristic parser structures it", async () => {
    const out = await extractPdf(await pdf(LINES));
    expect(out.pageCount).toBe(1);
    expect(isImageOnly(out.pageTexts)).toBe(false);
    const cv = assignIds(heuristicParseCv(out.text));
    expect(cv.email).toBe("sam.patel@example.com");
    expect(cv.experience[0].bullets[0]).toEqual({ id: "x0-b0", text: "Ran fortnightly Python workshops for 40 first-year students" });
    expect(cv.skills.flatMap((g) => g.items)).toEqual(expect.arrayContaining(["Python", "TypeScript"]));
  });

  it("flags a PDF with no text layer as image-only", async () => {
    const out = await extractPdf(await pdf([]));
    expect(out.pageCount).toBe(1);
    expect(isImageOnly(out.pageTexts)).toBe(true);
  });
}, 30_000);
