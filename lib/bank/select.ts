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
import { LEADERSHIP } from "@/lib/cv-score/checkers";
import type { Track } from "@/lib/cv-rules/types";
import type { EducationChange } from "@/lib/tailor/education-fix";
import type { Bank, BankBullet, BankEntry, BankSection } from "./types";
import { entryLabel } from "./label";

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
/**
 * Spring and placement modes (spring 07 §3.3, placement 05 §4b). Spring adverts name almost no skills, so selection
 * would degrade to "quantified + recent" and under-select the society, school and interest items spring screeners want.
 */
/** Spring: an entry that shows responsibility (a role, or training others, handling money, organising). */
export const W_RESPONSIBILITY = 2;
/** Spring: an entry that shows interest in the job's sector (insight days, Forage, societies, competitions). */
export const W_INTEREST = 2;
/** Placement: a bullet that names a tool or skill from the advert. */
export const W_TOOL = 1.5;
/** Spring recency: falls by this much per year, floored at RECENCY_FLOOR_SPRING for entries ended within 30 months. */
export const RECENCY_DROP_PER_YEAR_SPRING = 0.1;
export const RECENCY_FLOOR_SPRING = 0.5;
const RECENCY_FLOOR_MONTHS = 30;
/** Most school-era entries a page keeps on each track. */
export const SCHOOL_ERA_CAP: Record<Track, number | null> = { standard: null, spring: 2, placement: 1 };

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
  /** The job's track (trackForJob). Omitted = "standard", exactly as before the spring and placement modes. */
  mode?: Track;
};
export type ScoreParts = {
  must: string[]; nice: string[]; quantified: boolean; actionVerb: boolean; cliche: boolean; recency: number;
  /** Spring/placement only (absent on the standard track). */
  responsibility?: boolean; interest?: boolean; tool?: boolean;
};
export type SelItem = { kind: "entry" | "bullet"; id: string; entryId: string; label: string; reason: string };
/** `education`: spring/placement education lines reformatted for this page (lib/tailor/education-fix), if any. */
export type SelectionReport = { added: SelItem[]; leftOut: SelItem[]; pinnedOverflow: boolean; education?: EducationChange[] };
export type Selection = { base: ParsedCV; report: SelectionReport; scores: Record<string, number>; lineBudget: number };

const SECTIONS: BankSection[] = ["experience", "projects", "leadership"];
const LEFT_OUT_REASON = "lower match for this role than the items kept";
export const PINNED_NO_ROOM_REASON = "pinned, but there was no room on one page";
export const FIT_DROPPED_REASON = "dropped to fit one page";
export const REMOVED_FOR_JOB_REASON = "you removed this for this role";
export const schoolCapReason = (n: number) => `older school-era item: kept the ${n === 1 ? "strongest one" : n === 2 ? "two strongest" : `${n} strongest`}`;
const QUOTA_REASON: Record<Quota, string> = {
  work: "a job", responsibility: "responsibility", interest: "interest in the sector", project: "a project",
};
const quotaReason = (mode: Track, q: Quota) => `kept: ${mode === "spring" ? "spring weeks" : "placement screeners"} look for ${QUOTA_REASON[q]}`;

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

function recencyOf(e: Pick<BankEntry, "startYm" | "endYm">, nowYm: string, mode: Track = "standard"): number {
  if (!e.endYm) return e.startYm ? 1 : RECENCY_UNKNOWN; // no end with a start = present
  const months = Math.max(0, ymToMonths(nowYm) - ymToMonths(e.endYm));
  if (mode === "spring") {
    // Sixth-form items (ended last July) still compete: they are a first-year's recent past.
    const r = 1 - RECENCY_DROP_PER_YEAR_SPRING * (months / 12);
    return Math.max(months <= RECENCY_FLOOR_MONTHS ? RECENCY_FLOOR_SPRING : 0, Math.min(1, r));
  }
  return Math.max(0, Math.min(1, 1 - RECENCY_DROP_PER_YEAR * (months / 12)));
}

/** Money, people or keys the student was trusted with, on top of the CV checker's leadership words. */
const TRUSTED = /\b(trained|supervis\w*|handled £|cash|key[- ]?holder|organis\w*|organiz\w*|captain\w*|chair\w*|treasurer)\b/i;
export const showsResponsibility = (text: string) => LEADERSHIP.test(text) || TRUSTED.test(text);

/** Evidence of interest in the job's sector, by archetype (spring 07 §3.3). Sectors with no lexicon get none. */
const INTEREST: Partial<Record<string, RegExp>> = {
  finance_banking: /(invest|stock|equit|trading|markets?\b|forage|job simulation|bloomberg|\bbmc\b|insight (?:day|programme|week)|spring week|portfolio|fintech|economics society|finance society)/i,
  quant_trading: /(invest|stock|trading|markets?\b|olympiad|ukmt|forage|job simulation|bloomberg|\bbmc\b|insight (?:day|programme|week)|spring week|portfolio|quant)/i,
  consulting: /(case comp|consult|180 degrees|insight (?:day|programme|week)|spring week|forage|job simulation)/i,
  software_eng: /(hackathon|github|\bbuilt\b|\bapp\b|insight (?:day|programme|week)|spring week|forage|job simulation)/i,
  data_analytics: /(hackathon|kaggle|dashboard|\bsql\b|python|insight (?:day|programme|week)|spring week|forage|job simulation)/i,
  product: /(hackathon|\bbuilt\b|\bapp\b|product|insight (?:day|programme|week)|spring week|forage|job simulation)/i,
  marketing_growth: /(campaign|social media|content|brand|insight (?:day|programme|week)|spring week|forage|job simulation)/i,
  research: /(research|paper|olympiad|lab\b|insight (?:day|programme|week)|spring week)/i,
};
export const showsInterest = (text: string, archetype: string | null | undefined) => {
  const re = archetype ? INTEREST[archetype] : undefined;
  return re ? re.test(text) : /(insight (?:day|programme|week)|spring week|forage|job simulation)/i.test(text);
};

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
    + (p.cliche ? W_CLICHE : 0) + p.recency
    + (p.responsibility ? W_RESPONSIBILITY : 0) + (p.interest ? W_INTEREST : 0) + (p.tool ? W_TOOL : 0);
}

// ---------- spring and placement helpers ----------

type Quota = "work" | "responsibility" | "interest" | "project";
const QUOTAS: Record<Track, [Quota, number][]> = {
  standard: [],
  spring: [["work", 1], ["responsibility", 2], ["interest", 1]],
  placement: [["project", 1], ["work", 1], ["responsibility", 1]],
};
const SCHOOL_ORG = /\b(school|academy|college|sixth form|grammar)\b/i;

/** The month university started, from the first education entry's dates ("2025–2028" → 2025-09), or null. */
export function uniStartYm(cv: ParsedCV): string | null {
  const uni = cv.education[0];
  const y = uni?.dates.match(/\b(20\d{2})\b/);
  return y ? `${y[1]}-09` : null;
}

/** Before university: ended by the month it started, or at a school (never the university itself). Never reads school type. */
export function isSchoolEra(e: Pick<BankEntry, "org" | "endYm">, cv: ParsedCV): boolean {
  const start = uniStartYm(cv);
  if (start && e.endYm && ymToMonths(e.endYm) <= ymToMonths(start)) return true;
  const uni = (cv.education[0]?.institution ?? "").trim().toLowerCase();
  return SCHOOL_ORG.test(e.org) && (!uni || e.org.trim().toLowerCase() !== uni);
}

/** Section order for the page on spring and placement tracks; null keeps the active CV's own order. */
function trackSectionOrder(mode: Track, archetype: string | null | undefined): string[] | null {
  if (mode === "spring") return ["education", "experience", "leadership", "projects", "skills", "interests"];
  if (mode === "placement") {
    return archetype && ["finance_banking", "consulting", "marketing_growth"].includes(archetype)
      ? ["education", "experience", "leadership", "projects", "skills", "interests"]
      : ["education", "projects", "experience", "skills", "leadership", "interests"];
  }
  return null;
}

// ---------- ordering ----------

/** Newest first: present (start, no end) first, then by end then start month, undated last; ties keep bank order. */
function dateKey(e: BankEntry): number {
  if (!e.startYm && !e.endYm) return -Infinity;
  if (!e.endYm) return Infinity;
  return ymToMonths(e.endYm) * 100_000 + (e.startYm ? ymToMonths(e.startYm) : 0);
}
export const byNewest = (a: BankEntry, b: BankEntry) => {
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

const entryLabelOf = (e: BankEntry) => entryLabel(e) || "Untitled entry";
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
  const removedForJob = new Set(opts.excludedForJob.filter((id) => !fitExcluded.has(id)));
  const src = opts.activeCvSourceId;
  const inCv = (ids: string[]) => src !== null && ids.includes(src);
  const reqs = jdRequirementSkills(job.textLines ?? [], job.requirements ?? []);
  const mode: Track = opts.mode ?? "standard";

  // Eligible rows: never hidden, never excluded for this job.
  type Cand = {
    entry: BankEntry; bullets: BankBullet[]; forced: boolean; forcedBullets: Set<string>; score: number;
    /** Spring/placement only: what the entry shows, for quotas and the school-era cap. */
    flags: { responsibility: boolean; interest: boolean; schoolEra: boolean };
  };
  const parts = new Map<string, ScoreParts>();
  const scores: Record<string, number> = {};
  const cands: Cand[] = [];
  for (const entry of bank.entries) {
    if (entry.hidden || excluded.has(entry.id) || !SECTIONS.includes(entry.section)) continue;
    const recency = recencyOf(entry, nowYm, mode);
    const bullets = entry.bullets.filter((b) => !b.hidden && !excluded.has(b.id)).sort((a, b) => a.position - b.position);
    const head = `${entry.title} ${entry.org}`;
    const flags = mode === "standard" ? { responsibility: false, interest: false, schoolEra: false } : {
      responsibility: entry.section === "leadership" || showsResponsibility(head) || bullets.some((b) => showsResponsibility(b.text)),
      interest: showsInterest(head, job.archetype) || bullets.some((b) => showsInterest(b.text, job.archetype)),
      schoolEra: isSchoolEra(entry, activeCv),
    };
    for (const b of bullets) {
      const p = scoreParts(b.text, reqs, recency);
      if (mode === "spring") {
        // Entry-level signals count on every bullet: a title like "Head Girl" makes each of its lines responsibility evidence.
        p.responsibility = showsResponsibility(head) || showsResponsibility(b.text);
        p.interest = showsInterest(head, job.archetype) || showsInterest(b.text, job.archetype);
      } else if (mode === "placement") {
        p.tool = p.must.length + p.nice.length > 0;
      }
      parts.set(b.id, p);
      scores[b.id] = scoreOf(p);
    }
    const ranked = [...bullets].sort((a, b) => scores[b.id] - scores[a.id] || a.position - b.position);
    const score = ranked.slice(0, ENTRY_TOP_BULLETS).reduce((n, b) => n + scores[b.id], 0);
    scores[entry.id] = score;
    const forcedBullets = new Set(bullets.filter((b) => b.pinned || pinnedForJob.has(b.id)).map((b) => b.id));
    const forced = entry.pinned || pinnedForJob.has(entry.id) || forcedBullets.size > 0;
    cands.push({ entry, bullets: ranked, forced, forcedBullets, score, flags });
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

  // School-era cap (spring 2, placement 1): pins count towards it but are never dropped for it.
  const cap = SCHOOL_ERA_CAP[mode];
  const capped = new Set<string>();
  const schoolUsed = () => [...chosen.keys()].filter((id) => byId.get(id)!.flags.schoolEra).length;
  const capAllows = (c: Cand) => {
    if (cap === null || !c.flags.schoolEra || schoolUsed() < cap) return true;
    capped.add(c.entry.id);
    return false;
  };
  const byScore = (a: Cand, b: Cand) => b.score - a.score || byNewest(a.entry, b.entry);

  // 1b. Spring/placement quotas: reserve the best entry of each kind the page needs, if the bank has one and it fits.
  const quotaFor = new Map<string, Quota>();
  const meets = (c: Cand, q: Quota) =>
    q === "work" ? c.entry.section === "experience" : q === "project" ? c.entry.section === "projects"
      : q === "responsibility" ? c.flags.responsibility : c.flags.interest;
  for (const [q, need] of QUOTAS[mode]) {
    let have = [...chosen.keys()].filter((id) => meets(byId.get(id)!, q)).length;
    for (const c of cands.filter((x) => !x.forced && !chosen.has(x.entry.id) && meets(x, q)).sort(byScore)) {
      if (have >= need) break;
      if (!capAllows(c)) continue;
      if (tryAddEntry(c, topUp(c, []))) { have++; quotaFor.set(c.entry.id, q); }
    }
  }

  // 2. Entries by score, each with its top min(2, n) bullets. Ties: newer first.
  for (const c of cands.filter((x) => !x.forced && !chosen.has(x.entry.id)).sort(byScore)) {
    if (!capAllows(c)) continue;
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
  let sectionOrder = [...activeCv.sectionOrder];
  for (const [s, rows] of [["experience", experience], ["projects", projects], ["leadership", leadership]] as const) {
    if (rows.length === 0 || sectionOrder.includes(s)) continue;
    const skillsAt = sectionOrder.indexOf("skills");
    sectionOrder.splice(skillsAt === -1 ? sectionOrder.length : skillsAt, 0, s);
  }
  const template = trackSectionOrder(mode, job.archetype);
  if (template) {
    // The track's order for the sections this page has; anything the template doesn't name keeps its place at the end.
    sectionOrder = [...template.filter((s) => sectionOrder.includes(s)), ...sectionOrder.filter((s) => !template.includes(s))];
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
        const pinned = isPinned(e.id) || [...sel].some(isPinned);
        const q = quotaFor.get(e.id);
        added.push({ kind: "entry", id: e.id, entryId: e.id, label: entryLabelOf(e), reason: q && !pinned ? quotaReason(mode, q) : reasonFor(ps, pinned) });
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
      const reason = c.forced ? PINNED_NO_ROOM_REASON : capped.has(e.id) ? schoolCapReason(cap!) : LEFT_OUT_REASON;
      const item: SelItem = { kind: "entry", id: e.id, entryId: e.id, label: entryLabelOf(e), reason };
      if (inCv(e.sourceIds)) cvLeftOut.push(item);
      else otherLeftOut.push({ item, score: c.score });
    }
  }
  otherLeftOut.sort((a, b) => b.score - a.score);
  // Items dropped by the render-and-count loop: always reported (an entry drop covers its bullets).
  // A dropped pin is reported with the pinned reason, not the generic fit one.
  const fitDropped: SelItem[] = [];
  for (const e of bank.entries) {
    if (fitExcluded.has(e.id)) fitDropped.push({ kind: "entry", id: e.id, entryId: e.id, label: entryLabelOf(e), reason: e.pinned || pinnedForJob.has(e.id) ? PINNED_NO_ROOM_REASON : FIT_DROPPED_REASON });
    else for (const b of e.bullets) if (fitExcluded.has(b.id)) fitDropped.push({ kind: "bullet", id: b.id, entryId: e.id, label: bulletLabel(b), reason: b.pinned || pinnedForJob.has(b.id) ? PINNED_NO_ROOM_REASON : FIT_DROPPED_REASON });
  }
  // Items the student removed for this role stay listed first so "Add back" is possible. They don't count against LEFT_OUT_EXTRA.
  const removed: SelItem[] = [];
  for (const e of bank.entries) {
    if (e.hidden || !SECTIONS.includes(e.section)) continue;
    if (removedForJob.has(e.id)) { removed.push({ kind: "entry", id: e.id, entryId: e.id, label: entryLabelOf(e), reason: REMOVED_FOR_JOB_REASON }); continue; }
    for (const b of e.bullets) if (!b.hidden && removedForJob.has(b.id)) removed.push({ kind: "bullet", id: b.id, entryId: e.id, label: bulletLabel(b), reason: REMOVED_FOR_JOB_REASON });
  }
  const leftOut = [...removed, ...fitDropped, ...cvLeftOut, ...otherLeftOut.slice(0, LEFT_OUT_EXTRA).map((x) => x.item)];

  return { base, report: { added, leftOut, pinnedOverflow }, scores, lineBudget };
}
