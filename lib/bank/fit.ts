/**
 * One-page guarantee (spec §5): selectForJob only estimates lines, so this renders the real PDF, counts pages and
 * trims until it is exactly one page. Slow (a render per attempt), so it runs at save/preview time, not while scoring.
 */
import { getDocumentProxy } from "unpdf";
import type { ParsedCV, TailoredCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import { renderCvPdf } from "@/lib/pdf/cv-document";
import { toTailored } from "@/lib/verify/tailoring";
import { renderView } from "@/lib/tailor/run";
import { extractPdf } from "@/lib/cv/pdf-text";
import { cvLines, DEFAULT_LINE_BUDGET, selectForJob, type Selection, type SelectOpts } from "./select";
import type { Bank } from "./types";

/** Re-selecting with a bigger budget only when page 1 is less than this full. */
export const MIN_FILL = 0.85;
/** Extra lines offered when a one-page result is under MIN_FILL. */
export const GROW_LINES = 4;
/** Most drops before giving up. */
export const MAX_DROPS = 5;

const render = (cv: TailoredCV, contact: ParsedCV) => renderCvPdf(renderView(cv, contact), contact);

export async function pageCount(cv: TailoredCV, contact: ParsedCV): Promise<number> {
  return (await extractPdf(new Uint8Array(await render(cv, contact)))).pageCount;
}

/**
 * Share of the last page in use: lowest text baseline against the usable area (page height minus the 36pt margins of
 * cv-document). Measured from text positions rather than text length, because short bullets leave blank space.
 * Above 1 when the content spilled onto a second page (the last page is then measured). Used only for the 85% check.
 */
export async function fillRatio(cv: TailoredCV, contact: ParsedCV): Promise<number> {
  const pdf = await getDocumentProxy(new Uint8Array(await render(cv, contact)));
  const page = await pdf.getPage(pdf.numPages);
  const height = page.view[3] - page.view[1];
  const margin = 36;
  const { items } = await page.getTextContent();
  const ys = items.filter((i) => "transform" in i && "str" in i && i.str.trim()).map((i) => (i as { transform: number[] }).transform[5]);
  if (ys.length === 0) return 0;
  const lowest = Math.min(...ys);
  const usable = height - 2 * margin;
  const used = Math.max(0, height - margin - lowest);
  return pdf.numPages > 1 ? 1 + used / usable : used / usable;
}

/** The 3 lowest-scoring rendered bullets, lowest first (Task 8's save refusal offers these to remove). */
export function overflowCandidates(tailored: TailoredCV, scores: Record<string, number>): { bulletId: string; text: string }[] {
  const rows = [tailored.experience, tailored.projects, tailored.leadership].flat()
    .flatMap((e) => e.bullets.filter((b) => b.changeType !== "dropped").map((b, i) => ({ bulletId: b.id, text: b.text, score: scores[b.id] ?? 0, i })));
  return rows.sort((a, b) => a.score - b.score || a.i - b.i).slice(0, 3).map(({ bulletId, text }) => ({ bulletId, text }));
}

type Drop = { id: string; lines: number };

/** Lowest-scoring unpinned bullet whose entry keeps another; else the lowest-scoring unpinned whole entry; else null. */
function nextDrop(bank: Bank, sel: Selection, opts: SelectOpts): Drop | null {
  const pinnedJob = new Set(opts.pinnedForJob);
  const byId = new Map(bank.entries.map((e) => [e.id, e]));
  const entries = [sel.base.experience, sel.base.projects, sel.base.leadership].flat();
  let bullet: { id: string; score: number; chars: number } | null = null;
  for (const e of entries) {
    if (e.bullets.length < 2) continue;
    const src = byId.get(e.id);
    for (const b of e.bullets) {
      const sb = src?.bullets.find((x) => x.id === b.id);
      if (sb?.pinned || pinnedJob.has(b.id)) continue;
      const score = sel.scores[b.id] ?? 0;
      if (!bullet || score < bullet.score) bullet = { id: b.id, score, chars: b.text.length };
    }
  }
  if (bullet) return { id: bullet.id, lines: Math.max(1, Math.ceil(bullet.chars / 95)) };
  let entry: { id: string; score: number; lines: number } | null = null;
  for (const e of entries) {
    const src = byId.get(e.id);
    if (!src || src.pinned || pinnedJob.has(e.id) || e.bullets.some((b) => src.bullets.find((x) => x.id === b.id)?.pinned || pinnedJob.has(b.id))) continue;
    const score = sel.scores[e.id] ?? 0;
    if (!entry || score < entry.score) entry = { id: e.id, score, lines: 1 + e.bullets.reduce((n, b) => n + Math.max(1, Math.ceil(b.text.length / 95)), 0) };
  }
  return entry ? { id: entry.id, lines: entry.lines } : null;
}

export async function fitSelection(bank: Bank, activeCv: ParsedCV, job: JobListItem, opts: SelectOpts): Promise<Selection & { pages: number }> {
  // A student whose one-page CV is all they have must never lose a bullet to an estimate error: if the active CV
  // itself renders to one page, its own estimated size is a floor for the budget.
  let lineBudget = opts.lineBudget ?? DEFAULT_LINE_BUDGET;
  if (opts.lineBudget === undefined && (await pageCount(toTailored(activeCv), activeCv)) === 1) lineBudget = Math.max(lineBudget, cvLines(activeCv));

  const fitExcluded = [...(opts.fitExcluded ?? [])];
  const run = (budget: number, extra: string[]) => selectForJob(bank, activeCv, job, { ...opts, lineBudget: budget, fitExcluded: [...fitExcluded, ...extra] });
  const pagesOf = (s: Selection) => pageCount(toTailored(s.base), s.base);

  let sel = run(lineBudget, []);
  let pages = await pagesOf(sel);
  for (let drops = 0; pages > 1 && drops < MAX_DROPS; drops++) {
    const drop = nextDrop(bank, sel, opts);
    if (!drop) break;
    fitExcluded.push(drop.id);
    // Lower the budget too, or the greedy fill would spend the freed lines on the next-best bullet.
    lineBudget = Math.min(lineBudget, cvLines(sel.base)) - drop.lines;
    sel = run(lineBudget, []);
    pages = await pagesOf(sel);
  }
  if (pages !== 1) throw new Error("Could not fit your CV on one page");

  // Under-filled page and unused bullets: offer a few more lines once.
  const used = new Set([sel.base.experience, sel.base.projects, sel.base.leadership].flat().flatMap((e) => e.bullets.map((b) => b.id)));
  const unused = bank.entries.some((e) => !e.hidden && e.bullets.some((b) => !b.hidden && !used.has(b.id) && !fitExcluded.includes(b.id) && !fitExcluded.includes(e.id) && !opts.excludedForJob.includes(b.id) && !opts.excludedForJob.includes(e.id)));
  if (unused && (await fillRatio(toTailored(sel.base), sel.base)) < MIN_FILL) {
    const bigger = run(sel.lineBudget + GROW_LINES, []);
    if ((await pagesOf(bigger)) === 1) sel = bigger;
  }
  return { ...sel, pages: 1 };
}
