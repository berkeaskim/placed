import type { VerifyReport } from "@/lib/verify/tailoring";
import { renderCvPdf } from "@/lib/pdf/cv-document";
import { renderView, reverifyEdits, type GateInput, type ReverifyResult } from "./run";
import type { TailoredCV } from "@/lib/types";

/** Thrown instead of rendering: a PDF is never rendered while the verdict is `block` (spec §7.3). */
export class BlockedCvError extends Error {
  constructor(readonly report: VerifyReport) {
    super("The tailored CV did not pass the fabrication check, so no PDF was made.");
    this.name = "BlockedCvError";
  }
}

/**
 * The only path to a tailored PDF: re-runs the gate on exactly what will be rendered (amendment item 6) and
 * refuses on block. Contact details come from the source CV, never from the tailored JSON.
 */
export async function renderVerifiedPdf(i: GateInput & { tailored: TailoredCV }): Promise<ReverifyResult & { pdf: Buffer }> {
  const r = reverifyEdits(i);
  if (!r.renderable) throw new BlockedCvError(r.report);
  const pdf = await renderCvPdf(renderView(r.tailored, i.cv), i.cv);
  return { ...r, pdf };
}
