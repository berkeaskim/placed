/**
 * Per-job selection (spec §5): from everything in the Experience Bank, pick the one-page subset that best
 * represents the student for one job. Pure and deterministic, no AI and no DB, so it works with AI off.
 *
 * A bullet scores on job fit (must/nice coverage), strength (a number, an action verb, no clichés) and recency.
 * Strength is weighted so a strong quantified bullet can beat a weak keyword-only one: the guard against underselling.
 */
import type { CvEntry, ParsedCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import { computeCoverage, jdRequirementSkills, type JdSkill } from "@/lib/scoring/coverage";
import { clicheDensity } from "@/lib/cv/cliches";
import type { Bank, BankBullet, BankEntry, BankSection } from "./types";

// ---------- tunable constants ----------

/**
 * Lines on one A4 page of cv-document. Calibrated (Task 7) against real renders of a synthetic 10-entry/30-bullet
 * student bank (two-line bullets, tests/bank/fit.test.ts) and the fixtures/ai/parseCV CV: est 38/42/45 lines filled
 * 0.81/0.88/0.93 of the page, est 50 spilled to 2 pages, so a page holds about 48 estimated lines. 46 stays under that
 * with a margin; fitSelection grows by 4 when the page is under 85% full and trims when it overflows.
 */
export const DEFAULT_LINE_BUDGET = 46;
/** Characters per rendered line, used for every line estimate. */
export const CHARS_PER_LINE = 95;
/** Contact block (name line + contact line). */
export const CONTACT_LINES = 2;
/** Every rendered section heading. */
export const SECTION_HEADING_LINES = 1;
/** Education entry: institution/date header line + degree line, before its details. */
export const EDUCATION_ENTRY_LINES = 2;

export const W_MUST = 3;
export const W_NICE = 1;
/**
 * Brief starting value was 2. Raised to 3 so a quantified bullet with an action verb (3 + 1) beats a bullet that only
 * names one must-have skill (3); at 2 they tied and the keyword-only bullet could undersell the student.
 */
export const W_QUANTIFIED = 3;
export const W_ACTION_VERB = 1;
export const W_CLICHE = -2;
/** Recency: present = 1, falling by this much per year since the entry ended, floored at 0. */
export const RECENCY_DROP_PER_YEAR = 0.2;
/** Recency for an entry with no dates at all: neutral, neither rewarded nor buried. */
export const RECENCY_UNKNOWN = 0.5;
/** Entry score = sum of this many top bullet scores. */
export const ENTRY_TOP_BULLETS = 3;
/** Each included entry gets at least this many bullets (or all it has). */
export const MIN_BULLETS_PER_ENTRY = 2;
/** Left-out report: this many non-CV rows, besides every left-out active-CV row. */
export const LEFT_OUT_EXTRA = 5;
/** recency at or above this reads as "recent experience" in a reason. */
const RECENT_REASON_MIN = 0.8;

// ---------- types ----------

export type SelectOpts = {
  pinnedForJob: string[]; excludedForJob: string[]; lineBudget?: number; activeCvSourceId: string | null;
  /** "YYYY-MM" used for recency; defaults to the current month. Tests pass it for determinism. */
  nowYm?: string;
  /** Internal, set by fitSelection: ids dropped to make the render one page. Excluded like excludedForJob, but still reported as left out. */
  fitExcluded?: string[];
};
export type ScoreParts = { must: string[]; nice: string[]; quantified: boolean; actionVerb: boolean; cliche: boolean; recency: number };
export type SelItem = { kind: "entry" | "bullet"; id: string; entryId: string; label: string; reason: string };
export type SelectionReport = { added: SelItem[]; leftOut: SelItem[]; pinnedOverflow: boolean };
export type Selection = { base: ParsedCV; report: SelectionReport; scores: Record<string, number>; lineBudget: number };

const SECTIONS: BankSection[] = ["experience", "projects", "leadership"];
const LEFT_OUT_REASON = "lower match for this role than the items kept";
const PINNED_NO_ROOM_REASON = "pinned, but there was no room on one page";
export const FIT_DROPPED_REASON = "dropped to fit one page";

// ---------- line estimates ----------

const textLines = (text: string) => Math.max(1, Math.ceil(text.trim().length / CHARS_PER_LINE));

/** 1 header line + ceil(chars / CHARS_PER_LINE) per bullet. */
export function estimateLines(entry: { bullets: { text: string }[] }): number {
  return 1 + entry.bullets.reduce((n, b) => n + textLines(b.text), 0);
}

/** Lines that selection cannot change: contact, summary, education, skills, interests (with their headings). */
export function fixedLines(cv: ParsedCV): number {
  let n = CONTACT_LINES;
  if (cv.summary?.trim()) n += SECTION_HEADING_LINES + textLines(cv.summary);
  if (cv.education.length > 0) {
    n += SECTION_HEADING_LINES;
    for (const e of cv.education) n += EDUCATION_ENTRY_LINES + e.details.reduce((k, d) => k + textLines(d.text), 0);
  }
  if (cv.skills.length > 0) {
    n += SECTION_HEADING_LINES;
    for (const g of cv.skills) n += textLines(`${g.group}: ${g.items.join(", ")}`);
  }
  if (cv.interests?.trim()) n += SECTION_HEADING_LINES + textLines(cv.interests);
  return n;
}

/** Estimated lines of a whole CV: fixed lines plus each non-empty entry section. */
export function cvLines(cv: ParsedCV): number {
  let n = fixedLines(cv);
  for (const s of SECTIONS) {
    if (cv[s].length === 0) continue;
    n += SECTION_HEADING_LINES + cv[s].reduce((k, e) => k + estimateLines(e), 0);
  }
  return n;
}

// ---------- scoring ----------

const QUANTIFIED_RE = /\d|%|£|\$/;
/** Duty phrases and fillers that are not an action verb even though some end in -ed. */
const WEAK_STARTS = new Set(["responsible", "helped", "assisted", "involved", "worked", "participated", "tasked", "duties", "was", "were", "is", "am", "i", "we", "my", "our", "the", "a", "an"]);
const IRREGULAR_VERBS = new Set([
  "built", "led", "ran", "won", "wrote", "made", "taught", "grew", "drove", "cut", "sold", "set", "took", "gave", "began", "chose", "found",
  "held", "kept", "met", "rebuilt", "rewrote", "spoke", "brought", "bought", "caught", "fought", "sought", "thought", "oversaw",
  "undertook", "overcame", "shot", "spun", "split", "upheld", "co-led", "co-founded", "founded", "launched", "raised",
]);

function startsWithActionVerb(text: string): boolean {
  const first = text.trim().replace(/^[^\p{L}]+/u, "").split(/[\s,;:]+/)[0]?.toLowerCase() ?? "";
  if (!first || WEAK_STARTS.has(first)) return false;
  return IRREGULAR_VERBS.has(first) || (/ed$/.test(first) && first.length > 3);
}

/** "YYYY-MM" to a month count. */
const ymToMonths = (ym: string) => { const [y, m] = ym.split("-").map(Number); return y * 12 + ((m || 1) - 1); };

function recencyOf(e: Pick<BankEntry, "startYm" | "endYm">, nowYm: string): number {
  if (!e.endYm) return e.startYm ? 1 : RECENCY_UNKNOWN; // no end with a start = present
  const years = Math.max(0, (ymToMonths(nowYm) - ymToMonths(e.endYm)) / 12);
  return Math.max(0, Math.min(1, 1 - RECENCY_DROP_PER_YEAR * years));
}

function scoreParts(text: string, reqs: JdSkill[], recency: number): ScoreParts {
  const cov = reqs.length ? computeCoverage(reqs, { skillsList: [], bulletText: text, otherText: "" }) : null;
  const covered = (s: "must" | "nice") => (cov?.items ?? []).filter((i) => i.section === s && i.status !== "gap").map((i) => i.skill);
  return {
    must: covered("must"), nice: covered("nice"),
    quantified: QUANTIFIED_RE.test(text), actionVerb: startsWithActionVerb(text),
    cliche: clicheDensity(text, { minWords: 1 }).hits.length > 0, recency,
  };
}

export function scoreOf(p: ScoreParts): number {
  return W_MUST * p.must.length + W_NICE * p.nice.length + (p.quantified ? W_QUANTIFIED : 0) + (p.actionVerb ? W_ACTION_VERB : 0)
    + (p.cliche ? W_CLICHE : 0) + p.recency;
}

// ---------- ordering ----------

/** Newest first: present (start, no end) first, then by end then start month, undated last; ties keep bank order. */
function dateKey(e: BankEntry): number {
  if (!e.startYm && !e.endYm) return -Infinity;
  if (!e.endYm) return Infinity;
  return ymToMonths(e.endYm) * 100_000 + (e.startYm ? ymToMonths(e.startYm) : 0);
}
const byNewest = (a: BankEntry, b: BankEntry) => {
  const ka = dateKey(a), kb = dateKey(b);
  return ka === kb ? 0 : kb > ka ? 1 : -1;
};

// ---------- reasons ----------

const quoted = (xs: string[]) => xs.map((x) => `'${x}'`).join(", ");
function reasonFor(parts: ScoreParts[], pinned: boolean): string {
  if (pinned) return "pinned";
  const uniq = (xs: string[]) => [...new Set(xs)];
  const must = uniq(parts.flatMap((p) => p.must));
  if (must.length) return `covers ${quoted(must)} (must-have${must.length > 1 ? "s" : ""})`;
  const nice = uniq(parts.flatMap((p) => p.nice));
  if (nice.length) return `covers ${quoted(nice)} (nice-to-have${nice.length > 1 ? "s" : ""})`;
  if (parts.some((p) => p.quantified)) return "kept for a quantified result";
  if (parts.some((p) => p.recency >= RECENT_REASON_MIN)) return "recent experience";
  return "adds to a full page";
}

const entryLabel = (e: BankEntry) => [e.title, e.org].filter((s) => s.trim()).join(" · ") || "Untitled entry";
const bulletLabel = (b: BankBullet) => (b.text.length > 80 ? `${b.text.slice(0, 77).trimEnd()}...` : b.text);

// ---------- selection ----------

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function selectForJob(bank: Bank, activeCv: ParsedCV, job: JobListItem, opts: SelectOpts): Selection {
  const lineBudget = opts.lineBudget ?? DEFAULT_LINE_BUDGET;
  const nowYm = opts.nowYm ?? currentYm();
  const pinnedForJob = new Set(opts.pinnedForJob);
  const fitExcluded = new Set(opts.fitExcluded ?? []);
  const excluded = new Set([...opts.excludedForJob, ...fitExcluded]);
  const src = opts.activeCvSourceId;
  const inCv = (ids: string[]) => src !== null && ids.includes(src);
  const reqs = jdRequirementSkills(job.textLines ?? [], job.requirements ?? []);

  // Eligible rows: never hidden, never excluded for this job.
  type Cand = { entry: BankEntry; bullets: BankBullet[]; forced: boolean; forcedBullets: Set<string>; score: number };
  const parts = new Map<string, ScoreParts>();
  const scores: Record<string, number> = {};
  const cands: Cand[] = [];
  for (const entry of bank.entries) {
    if (entry.hidden || excluded.has(entry.id) || !SECTIONS.includes(entry.section)) continue;
    const recency = recencyOf(entry, nowYm);
    const bullets = entry.bullets.filter((b) => !b.hidden && !excluded.has(b.id)).sort((a, b) => a.position - b.position);
    for (const b of bullets) {
      const p = scoreParts(b.text, reqs, recency);
      parts.set(b.id, p);
      scores[b.id] = scoreOf(p);
    }
    const ranked = [...bullets].sort((a, b) => scores[b.id] - scores[a.id] || a.position - b.position);
    const score = ranked.slice(0, ENTRY_TOP_BULLETS).reduce((n, b) => n + scores[b.id], 0);
    scores[entry.id] = score;
    const forcedBullets = new Set(bullets.filter((b) => b.pinned || pinnedForJob.has(b.id)).map((b) => b.id));
    const forced = entry.pinned || pinnedForJob.has(entry.id) || forcedBullets.size > 0;
    cands.push({ entry, bullets: ranked, forced, forcedBullets, score });
  }

  // Greedy fill under the line budget.
  let used = fixedLines(activeCv);
  const chosen = new Map<string, Set<string>>(); // entryId -> bullet ids
  const sectionUsed = new Set<BankSection>();
  const byId = new Map(cands.map((c) => [c.entry.id, c]));
  const bulletCost = (c: Cand, id: string) => textLines(c.bullets.find((b) => b.id === id)!.text);
  const entryCost = (c: Cand, ids: string[]) =>
    (sectionUsed.has(c.entry.section) ? 0 : SECTION_HEADING_LINES) + 1 + ids.reduce((n, id) => n + bulletCost(c, id), 0);
  const topUp = (c: Cand, start: string[]) => {
    const ids = [...start];
    for (const b of c.bullets) if (ids.length < Math.min(MIN_BULLETS_PER_ENTRY, c.bullets.length) && !ids.includes(b.id)) ids.push(b.id);
    return ids;
  };
  const tryAddEntry = (c: Cand, ids: string[]) => {
    const cost = entryCost(c, ids);
    if (used + cost > lineBudget) return false;
    used += cost;
    sectionUsed.add(c.entry.section);
    chosen.set(c.entry.id, new Set(ids));
    return true;
  };

  // 1. Pinned first, newest first so an overflow keeps the most recent.
  let pinnedOverflow = false;
  for (const c of cands.filter((x) => x.forced).sort((a, b) => byNewest(a.entry, b.entry))) {
    const pinnedIds = c.bullets.filter((b) => c.forcedBullets.has(b.id)).map((b) => b.id);
    if (tryAddEntry(c, topUp(c, pinnedIds))) continue;
    if (pinnedIds.length > 0 && tryAddEntry(c, pinnedIds)) continue;
    pinnedOverflow = true;
  }

  // 2. Entries by score, each with its top min(2, n) bullets. Ties: newer first.
  for (const c of cands.filter((x) => !x.forced).sort((a, b) => b.score - a.score || byNewest(a.entry, b.entry))) {
    tryAddEntry(c, topUp(c, []));
  }

  // 3. Remaining bullets of included entries, by score, while they fit.
  const rest = [...chosen.keys()].flatMap((eid) => byId.get(eid)!.bullets.filter((b) => !chosen.get(eid)!.has(b.id)).map((b) => ({ c: byId.get(eid)!, b })));
  rest.sort((x, y) => scores[y.b.id] - scores[x.b.id] || byNewest(x.c.entry, y.c.entry) || x.b.position - y.b.position);
  for (const { c, b } of rest) {
    const cost = bulletCost(c, b.id);
    if (used + cost > lineBudget) continue;
    used += cost;
    chosen.get(c.entry.id)!.add(b.id);
  }

  // Build base: sections in date order, bullets in bank position order, bank ids as CV ids.
  const sectionEntries = (s: BankSection): CvEntry[] =>
    cands.filter((c) => c.entry.section === s && chosen.has(c.entry.id)).map((c) => c.entry).sort(byNewest).map((e) => ({
      id: e.id, org: e.org, title: e.title, dates: e.dates, location: e.location,
      bullets: byId.get(e.id)!.bullets.filter((b) => chosen.get(e.id)!.has(b.id)).sort((a, b) => a.position - b.position).map((b) => ({ id: b.id, text: b.text })),
    }));
  const experience = sectionEntries("experience"), projects = sectionEntries("projects"), leadership = sectionEntries("leadership");
  const sectionOrder = [...activeCv.sectionOrder];
  for (const [s, rows] of [["experience", experience], ["projects", projects], ["leadership", leadership]] as const) {
    if (rows.length === 0 || sectionOrder.includes(s)) continue;
    const skillsAt = sectionOrder.indexOf("skills");
    sectionOrder.splice(skillsAt === -1 ? sectionOrder.length : skillsAt, 0, s);
  }
  const base: ParsedCV = { ...activeCv, experience, projects, leadership, sectionOrder };

  // Report.
  const added: SelItem[] = [];
  const cvLeftOut: SelItem[] = [];
  const otherLeftOut: { item: SelItem; score: number }[] = [];
  for (const c of cands) {
    const e = c.entry;
    const isPinned = (id: string) => (id === e.id ? e.pinned || pinnedForJob.has(e.id) : c.forcedBullets.has(id));
    const sel = chosen.get(e.id);
    if (sel) {
      if (!inCv(e.sourceIds)) {
        const ps = c.bullets.filter((b) => sel.has(b.id)).map((b) => parts.get(b.id)!);
        added.push({ kind: "entry", id: e.id, entryId: e.id, label: entryLabel(e), reason: reasonFor(ps, isPinned(e.id) || [...sel].some(isPinned)) });
      } else {
        for (const b of c.bullets) {
          if (sel.has(b.id) && !inCv(b.sourceIds)) added.push({ kind: "bullet", id: b.id, entryId: e.id, label: bulletLabel(b), reason: reasonFor([parts.get(b.id)!], isPinned(b.id)) });
        }
      }
      for (const b of c.bullets) {
        if (sel.has(b.id)) continue;
        const item: SelItem = { kind: "bullet", id: b.id, entryId: e.id, label: bulletLabel(b), reason: isPinned(b.id) ? PINNED_NO_ROOM_REASON : LEFT_OUT_REASON };
        if (inCv(b.sourceIds)) cvLeftOut.push(item);
        else otherLeftOut.push({ item, score: scores[b.id] });
      }
    } else {
      const item: SelItem = { kind: "entry", id: e.id, entryId: e.id, label: entryLabel(e), reason: c.forced ? PINNED_NO_ROOM_REASON : LEFT_OUT_REASON };
      if (inCv(e.sourceIds)) cvLeftOut.push(item);
      else otherLeftOut.push({ item, score: c.score });
    }
  }
  otherLeftOut.sort((a, b) => b.score - a.score);
  // Items dropped by the render-and-count loop: always reported (an entry drop covers its bullets).
  const fitDropped: SelItem[] = [];
  for (const e of bank.entries) {
    if (fitExcluded.has(e.id)) fitDropped.push({ kind: "entry", id: e.id, entryId: e.id, label: entryLabel(e), reason: FIT_DROPPED_REASON });
    else for (const b of e.bullets) if (fitExcluded.has(b.id)) fitDropped.push({ kind: "bullet", id: b.id, entryId: e.id, label: bulletLabel(b), reason: FIT_DROPPED_REASON });
  }
  const leftOut = [...fitDropped, ...cvLeftOut, ...otherLeftOut.slice(0, LEFT_OUT_EXTRA).map((x) => x.item)];

  return { base, report: { added, leftOut, pinnedOverflow }, scores, lineBudget };
}
