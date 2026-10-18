import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { ParsedCV } from "@/lib/types";
import { renderCvPdf } from "@/lib/pdf/cv-document";
import { toTailored } from "@/lib/verify/tailoring";
import { DEMO_PERSONA_PATH } from "@/lib/fixtures/persona";
import { madeByPlacedTailor } from "@/lib/cv-score/provenance";

// Audit 04#28: a CV made by Placed's tailor is judged by the same AI family that rewrote it.

describe("madeByPlacedTailor", () => {
  it("recognises a PDF rendered by Placed's tailor (real @react-pdf output)", async () => {
    const cv = JSON.parse(readFileSync(DEMO_PERSONA_PATH, "utf8")) as ParsedCV;
    const pdf = await renderCvPdf(toTailored(cv), cv);
    expect(madeByPlacedTailor(new Uint8Array(pdf))).toBe(true);
  });
  it("accepts inline Info strings too", () => {
    expect(madeByPlacedTailor(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Creator (Placed) /Producer (Placed) >>\nendobj\n"))).toBe(true);
  });
  it("doesn't label other PDFs, a re-saved one, or nothing", () => {
    expect(madeByPlacedTailor(new TextEncoder().encode("%PDF-1.7\n<< /Creator (Microsoft Word) /Producer (macOS Quartz) >>"))).toBe(false);
    // Re-saved in another app: the producer changes.
    expect(madeByPlacedTailor(new TextEncoder().encode("%PDF-1.7\n<< /Creator (Placed) /Producer (Adobe PDF Library) >>"))).toBe(false);
    // A CV that merely mentions Placed in its text isn't stamped.
    expect(madeByPlacedTailor(new TextEncoder().encode("%PDF-1.7\nBT (Built the Placed app) Tj ET"))).toBe(false);
    expect(madeByPlacedTailor(new TextEncoder().encode("Creator (Placed) Producer (Placed)"))).toBe(false);
    expect(madeByPlacedTailor(null)).toBe(false);
  });
});
