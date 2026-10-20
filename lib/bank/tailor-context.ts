/**
 * Where tailoring gets its CV (spec §5 "Integration with tailoring"). A new tailoring selects a one-page `base` from
 * the Experience Bank; a stored one keeps its `base` frozen (it is what the student reviewed); an application saved
 * before the bank existed (`v: 1`) keeps using the active CV.
 */
import { createHash } from "node:crypto";
import { getActiveCv, type JobListItem } from "../db/queries";
import type { ParsedCV, TailoredCV } from "../types";
import type { TailorOutcome } from "../tailor/run";
import { ensureBank } from "./import";
import { fitSelection } from "./fit";
import type { Selection, SelectionReport } from "./select";
import { getBank, getSourceId } from "./store";
import { trackForJob } from "../tailor/track";
import { fixEducationForTrack } from "../tailor/education-fix";
import { jdRequirementSkills } from "../scoring/coverage";
import type { Bank } from "./types";

export type BankOverrides = { pinned: string[]; excluded: string[] };

/** What `applications.tailored_json` holds. v1: before the bank. v2: tailored from a per-job bank selection. */
export type StoredTailoring =
  | { v: 1; outcome: TailorOutcome; final: TailoredCV | null }
  | {
    v: 2; outcome: TailorOutcome; final: TailoredCV | null; base: ParsedCV; rawText: string; report: SelectionReport;
    scores: Record<string, number>; overrides: BankOverrides; bankStamp: string;
  };

export const NO_OVERRIDES: BankOverrides = { pinned: [], excluded: [] };

export const SECTIONS = ["experience", "projects", "leadership"] as const;

/** Every entry and bullet id in `base` (bank ids for a v2 base). */
function baseIds(base: ParsedCV): string[] {
  return SECTIONS.flatMap((s) => base[s].flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]));
}

/**
 * The gate's grounding text: the active CV's `raw_text`, plus the text and `sourceText` of each bank bullet in `base`,
 * so a claim from a bank row (LinkedIn, a post, an old CV) is traceable while everything that passes today still passes.
 */
export function groundingText(activeRaw: string, base: ParsedCV, bank: Bank): string {
  const bullets = new Map(bank.entries.flatMap((e) => e.bullets.map((b) => [b.id, b] as const)));
  const extra = SECTIONS.flatMap((s) => base[s].flatMap((e) => e.bullets.flatMap((b) => {
    const row = bullets.get(b.id);
    // 05 #24: an AI-worded bullet (from a post) grounds on the post excerpt it came from, not on its own wording,
    // unless the student edited it ("manual": their own claim). CV and LinkedIn rows have sourceText === text.
    if (!row) return [];
    return row.sourceText && !row.sourceIds.includes("manual") ? [row.sourceText] : [row.text, ...(row.sourceText ? [row.sourceText] : [])];
  })));
  return [activeRaw, ...extra].join("\n");
}

/** Max `updatedAt` over the bank rows in `base`, plus the sha1 of their sorted ids. */
export function bankStamp(bank: Bank, base: ParsedCV): string {
  const ids = new Set(baseIds(base));
  const rows = bank.entries.flatMap((e) => [e, ...e.bullets]).filter((r) => ids.has(r.id));
  const max = rows.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), "");
  const hash = createHash("sha1").update(rows.map((r) => r.id).sort().join(",")).digest("hex");
  return `${max}|${hash}`;
}

/** True when a bank row in the stored `base` was edited, deleted or hidden since tailoring. Never for v1. */
export function isStale(userId: string, stored: StoredTailoring | null): boolean {
  if (stored?.v !== 2) return false;
  const bank = getBank(userId);
  const rows = new Map<string, { hidden: boolean }>(bank.entries.flatMap((e) => [[e.id, e] as const, ...e.bullets.map((b) => [b.id, b] as const)]));
  for (const id of baseIds(stored.base)) {
    const row = rows.get(id);
    if (!row || row.hidden) return true;
  }
  return bankStamp(bank, stored.base) !== stored.bankStamp;
}

export type CvForJob = { parsed: ParsedCV; rawText: string; selection: Selection | null; newCvSuggestions: number };

/**
 * The CV to tailor `job` with:
 * - `overrides` given, or nothing stored: ensureBank, then a fresh one-page selection (fitSelection, which may throw
 *   "Could not fit your CV on one page");
 * - a stored v2: its frozen `base` and `rawText`;
 * - a stored v1: the active CV (Review Focus 3);
 * - an empty bank after ensureBank (the student cleared it): the active CV, like v1 (selection null), never an empty CV.
 * Null when the active CV is needed and there is none.
 */
export async function cvForJob(userId: string, job: JobListItem, stored: StoredTailoring | null, overrides?: BankOverrides): Promise<CvForJob | null> {
  if (!overrides && stored?.v === 2) return { parsed: stored.base, rawText: stored.rawText, selection: null, newCvSuggestions: 0 };
  const cv = await getActiveCv(userId);
  if (!cv) return null;
  if (!overrides && stored?.v === 1) return { parsed: cv.parsed, rawText: cv.rawText ?? "", selection: null, newCvSuggestions: 0 };
  const { newCvSuggestions } = await ensureBank(userId);
  const bank = getBank(userId);
  if (bank.entries.length === 0) return { parsed: cv.parsed, rawText: cv.rawText ?? "", selection: null, newCvSuggestions };
  const o = overrides ?? NO_OVERRIDES;
  // Spring weeks and placements (spring 07 §3.3, placement 05 §4b): the education is tidied first (a GCSE summary frees
  // lines for activities), then the selection runs in the job's mode.
  const mode = trackForJob(job);
  const terms = [...jdRequirementSkills(job.textLines ?? [], job.requirements ?? []).map((r) => r.skill), ...(job.archetype ? job.archetype.split("_") : [])];
  const edu = fixEducationForTrack(cv.parsed, mode, { terms, todayYear: new Date().getFullYear() });
  const selection = await fitSelection(bank, edu.cv, job, {
    pinnedForJob: o.pinned, excludedForJob: o.excluded, activeCvSourceId: getSourceId(userId, "cv", cv.id), mode,
  });
  if (edu.changes.length) selection.report.education = edu.changes;
  return { parsed: selection.base, rawText: groundingText(cv.rawText ?? "", selection.base, bank), selection, newCvSuggestions };
}
