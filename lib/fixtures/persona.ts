/**
 * Fixture keys for the fictional persona "Ayşe" (spec §12, Task 25), used by fixture mode. No server-only import: scripts
 * (tsx) and the tests share this. Each key mirrors the app path exactly:
 *   parseCV       -> app/(app)/profile/build/actions.ts: contentHash(base64 of the PDF).slice(0, 12)
 *   judgeCvRules  -> lib/cv-score/run.ts: `${textHash(redactedText).slice(0, 16)}-${sector}`
 * textHash lives in lib/cv-score/cache.ts (server-only), so it is restated here; tests/fixtures asserts they agree.
 */
import { createHash } from "node:crypto";
import type { Archetype, ParsedCV } from "@/lib/types";
import { contentHash } from "@/lib/ingest/fingerprint";
import { extractPdf } from "@/lib/cv/pdf-text";
import { scanCvSafety, stripFlaggedSpans } from "@/lib/cv/safety";
import { prepareJudgeInput } from "@/lib/cv-score/pii";

export * from "./persona-constants";

export function parseFixtureKey(pdf: Uint8Array): string {
  return contentHash(Buffer.from(pdf).toString("base64")).slice(0, 12);
}

/** Same as lib/cv-score/cache.ts textHash. */
export function demoTextHash(redactedText: string): string {
  return createHash("sha256").update(redactedText.replace(/\s+/g, " ").trim()).digest("hex");
}

export function judgeFixtureKey(parsed: ParsedCV, rawText: string, sector: Archetype): string {
  return `${demoTextHash(prepareJudgeInput(parsed, rawText).redactedText).slice(0, 16)}-${sector}`;
}

/** The text the upload action stores as cvs.raw_text: extracted text, with any flagged safety spans removed. */
export async function uploadedRawText(pdf: Uint8Array): Promise<{ text: string; pageTexts: string[]; pageCount: number; flagged: boolean }> {
  const x = await extractPdf(pdf.slice());
  const safety = await scanCvSafety({ text: x.text, pdfBytes: pdf.slice() });
  const flagged = safety.verdict === "flag";
  return {
    text: flagged ? stripFlaggedSpans(x.text, safety) : x.text,
    pageTexts: flagged ? x.pageTexts.map((t) => stripFlaggedSpans(t, safety)) : x.pageTexts,
    pageCount: x.pageCount,
    flagged,
  };
}
