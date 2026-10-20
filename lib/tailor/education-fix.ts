/**
 * Deterministic education formatting for spring weeks and placements (spring 07 §3.2d, placement 05 §4b). Not an AI
 * change: it only reorders, merges or condenses the student's own education lines, and each rewrite is verified
 * against its source (the grade tokens survive exactly, the module list is a subset) or the line is left as it was.
 * Education never reaches the tailoring model's output (normalizeTailored copies it from the base CV), so this is the
 * only place education wording changes, and it never adds a subject, grade, school, date or UCAS points.
 *
 * Spring: A-levels on one line with grades in brackets, GCSEs as one summary line, AS-levels dropped, EPQ as
 * "EPQ (grade): title", IB as "IB Diploma: NN/45 (...)", and an unlabelled class on a degree in progress marked
 * predicted. Placement: the module list cut to the 3–6 most relevant (marks kept) and "Year 1: NN% (class)".
 */
import type { CvBullet, ParsedCV } from "@/lib/types";
import type { Track } from "@/lib/cv-rules/types";

type Edu = ParsedCV["education"][number];
export type EducationChange = { before: string; after: string | null; why: string };
export type EducationFix = { cv: ParsedCV; changes: EducationChange[] };

// ---------- grade tokens ----------

/** One A-level/IB/GCSE grade: A*, A–G, 9–1, or an IB 1–7. */
const GRADE = String.raw`(?:A\*|[A-G]|[1-9])`;
const PAIR = new RegExp(String.raw`([A-Z][A-Za-z&'.]*(?:\s+(?:[A-Z][A-Za-z&'.]*|of|and|&|\d))*?)\s*(?:[:(–—-]\s*)?(${GRADE})\)?(?=\s*(?:[,;/|]|and\b|$))`, "g");

type Pair = { subject: string; grade: string };

/** "Mathematics A*, Economics (A); History - A" → pairs; null when the text is not only subject-grade pairs. */
export function parsePairs(text: string): Pair[] | null {
  const pairs: Pair[] = [];
  let rest = text;
  for (const m of text.matchAll(PAIR)) {
    pairs.push({ subject: m[1].trim(), grade: m[2] });
    rest = rest.replace(m[0], " ");
  }
  // Anything left besides separators means the line says more than pairs (a school name, a note): don't touch it.
  if (!pairs.length || rest.replace(/[\s,;/|]|\band\b/g, "").length > 0) return null;
  return pairs;
}

const gradeBag = (s: string) => [...s.matchAll(new RegExp(String.raw`(?<![A-Za-z0-9])${GRADE}(?![A-Za-z0-9])`, "g"))].map((m) => m[0]).sort().join(",");

// ---------- spring lines ----------

const A_LEVEL_HEAD = /^\s*(?:A[\s-]?levels?|A2s?)\b\s*(?:\(([^)]*)\))?\s*[:–—-]?\s*/i;
const ONE_A_LEVEL = /^\s*A[\s-]?level\s+(.+?)\s*[:–—-]\s*(A\*|[A-E])\s*$/i;
const AS_LEVEL = /^\s*AS[\s-]?[Ll]evels?\b|^\s*AS:\s/; // case-sensitive "AS"
const GCSE_HEAD = /^\s*(?:\d+\s+)?I?GCSEs?\b\s*(?:\([^)]*\))?\s*[:–—-]?\s*/i;
const EPQ = /^\s*(?:Extended Project(?: Qualification)?\s*(?:\(EPQ\))?|EPQ)\s*[:–—-]?\s*\(?\s*(A\*|[A-E])\)?\s*(?:[:–—-]\s*|,\s*)?(.*)$/i;
const IB = /^\s*(?:International Baccalaureate|IB)(?:\s+Diploma)?\s*[:–—-]?\s*(\d{2})\s*(?:\/\s*45|points?|pts)\s*[,;:(–—-]?\s*(.*?)\)?\s*$/i;

const gradeOrder = (g: string) => (/^\d$/.test(g) ? Number(g) : g === "A*" ? 10 : 10 - "ABCDEFG".indexOf(g) - 1);
const MATHS = /^(?:maths?|mathematics)$/i;
const ENGLISH = /^english(?: language)?$/i;

function aLevelLine(pairs: Pair[], note?: string): string {
  return `A-levels${note ? ` (${note})` : ""}: ${pairs.map((p) => `${p.subject} (${p.grade})`).join(", ")}`;
}

function gcseLine(pairs: Pair[]): string {
  const sorted = [...pairs].sort((a, b) => gradeOrder(b.grade) - gradeOrder(a.grade));
  const hi = sorted[0].grade, lo = sorted.at(-1)!.grade;
  const range = hi === lo ? hi : `${hi}–${lo}`;
  const named = [pairs.find((p) => MATHS.test(p.subject)), pairs.find((p) => ENGLISH.test(p.subject))].filter((p): p is Pair => Boolean(p));
  const incl = named.length ? `, including ${named.map((p) => `${p.subject} (${p.grade})`).join(" and ")}` : "";
  return `${pairs.length} GCSEs (${range})${incl}`;
}

/** The spring rewrite of one education entry's details. Lines it can't verify stay as they were. */
export function springEducationLines(details: CvBullet[]): { lines: CvBullet[]; changes: EducationChange[] } {
  const out: CvBullet[] = [];
  const changes: EducationChange[] = [];
  // Per-subject A-level lines ("A-level Mathematics: A*") merge into one line at the first one's place.
  const singles = details.map((d) => ONE_A_LEVEL.exec(d.text)).filter(Boolean) as RegExpExecArray[];
  const mergeSingles = singles.length >= 2;
  let merged = false;
  for (const d of details) {
    const text = d.text.trim();
    if (AS_LEVEL.test(text)) {
      changes.push({ before: d.text, after: null, why: "AS-levels are left off: your A-level grades supersede them." });
      continue;
    }
    if (mergeSingles && ONE_A_LEVEL.test(text)) {
      if (merged) continue;
      merged = true;
      const pairs = singles.map((m) => ({ subject: m[1].trim(), grade: m[2].toUpperCase() === "A*" ? "A*" : m[2].toUpperCase() }));
      const after = aLevelLine(pairs);
      const before = singles.map((m) => m[0].trim()).join("; ");
      if (gradeBag(after.replace(/^A-levels: /, "")) === gradeBag(singles.map((m) => m[2]).join(" "))) {
        out.push({ id: d.id, text: after });
        changes.push({ before, after, why: "A-levels on one line, subject then grade." });
      } else out.push(...details.filter((x) => ONE_A_LEVEL.test(x.text)));
      continue;
    }
    const head = A_LEVEL_HEAD.exec(text);
    if (head && !/GCSE/i.test(text)) {
      const body = text.slice(head[0].length);
      const pairs = parsePairs(body);
      const after = pairs ? aLevelLine(pairs, head[1]?.trim() || undefined) : null;
      if (after && after !== text && gradeBag(pairs!.map((p) => p.grade).join(" ")) === gradeBag(body)) {
        out.push({ id: d.id, text: after });
        changes.push({ before: d.text, after, why: "A-levels on one line, subject then grade." });
        continue;
      }
    }
    const g = GCSE_HEAD.exec(text);
    if (g) {
      const pairs = parsePairs(text.slice(g[0].length));
      if (pairs && pairs.length >= 4) {
        const after = gcseLine(pairs);
        out.push({ id: d.id, text: after });
        changes.push({ before: d.text, after, why: "GCSEs as one summary line." });
        continue;
      }
    }
    const e = EPQ.exec(text);
    if (e && /\bEPQ\b|Extended Project/i.test(text)) {
      const title = e[2].trim().replace(/^["“]|["”]$/g, "");
      const after = `EPQ (${e[1].toUpperCase()})${title ? `: ${title}` : ""}`;
      if (after !== text) {
        out.push({ id: d.id, text: after });
        changes.push({ before: d.text, after, why: "EPQ with its grade, then the title." });
        continue;
      }
    }
    const ib = IB.exec(text);
    if (ib) {
      const subjects = ib[2].replace(/^\(|\)$/g, "").trim();
      const after = `IB Diploma: ${ib[1]}/45${subjects ? ` (${subjects})` : ""}`;
      if (after !== text && gradeBag(after.replace(/^IB Diploma: \d{2}\/45/, "")) === gradeBag(subjects)) {
        out.push({ id: d.id, text: after });
        changes.push({ before: d.text, after, why: "IB total out of 45, then the subjects." });
        continue;
      }
    }
    out.push(d);
  }
  return { lines: out, changes };
}

// ---------- degree class ----------

const CLASS = /^\s*(First(?:[- ]class)?(?: Honours)?|1st|2[:.]1|2[:.]2|Upper Second(?:[- ]class)?|Lower Second(?:[- ]class)?|Third)\s*$/i;

/** A stated class on a degree still in progress, with no "predicted/expected/on track": label it predicted. Never upgrades. */
export function predictedGrade(edu: Edu, todayYear: number): string | null {
  if (!edu.grade || !CLASS.test(edu.grade)) return null;
  const years = (edu.dates.match(/\b20\d{2}\b/g) ?? []).map(Number);
  const end = years.length ? Math.max(...years) : null;
  if (end === null || end < todayYear) return null;
  return `${edu.grade.trim()} (predicted)`;
}

// ---------- placement lines ----------

const MODULES_HEAD = /^\s*((?:Relevant |Key |Core |Year 1 |First[- ]year )?Modules?(?: include| taken)?)\s*[:–—-]\s*/i;
const YEAR1 = /^\s*(?:Year\s*1|First[- ]year|1st[- ]year|Stage\s*1|Level\s*4)(?:\s+(?:average|result|mark|grade))?\s*[:–—-]?\s*(\d{2}(?:\.\d)?)\s*%(?:\s*(?:average|avg\.?))?\s*[,;(–—-]?\s*(First(?:[- ]class)?|2[:.]1|2[:.]2|Upper Second|Lower Second|Third)?\)?\s*$/i;
const MIN_MODULES = 3, MAX_MODULES = 6;

function splitModules(body: string): string[] | null {
  // Split on commas/semicolons outside brackets, so "Programming (Python, 80%)" stays one module.
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch;
  }
  parts.push(cur.trim());
  const mods = parts.filter(Boolean);
  return mods.length ? mods : null;
}

/**
 * Placement rewrite of one entry's details: a module list longer than 6 is cut to the modules matching `terms` first
 * (job skills and the archetype's words), source order kept, at least 3 and at most 6; a Year-1 average line becomes
 * "Year 1: NN% (class)". The kept modules are always a subset of the source's, marks included.
 */
export function placementEducationLines(details: CvBullet[], terms: string[]): { lines: CvBullet[]; changes: EducationChange[] } {
  const words = terms.map((t) => t.toLowerCase().trim()).filter((t) => t.length >= 3);
  const relevant = (m: string) => words.some((w) => m.toLowerCase().includes(w));
  const out: CvBullet[] = [];
  const changes: EducationChange[] = [];
  for (const d of details) {
    const head = MODULES_HEAD.exec(d.text);
    const mods = head ? splitModules(d.text.slice(head[0].length)) : null;
    if (head && mods && mods.length > MAX_MODULES) {
      const hits = mods.filter(relevant);
      if (hits.length) {
        const keep = new Set(hits.slice(0, MAX_MODULES));
        for (const m of mods) if (keep.size < MIN_MODULES && !keep.has(m)) keep.add(m);
        const kept = mods.filter((m) => keep.has(m));
        const after = `Relevant modules: ${kept.join(", ")}`;
        out.push({ id: d.id, text: after });
        changes.push({ before: d.text, after, why: `The ${kept.length} modules closest to this placement, with their marks.` });
        continue;
      }
    }
    const y = YEAR1.exec(d.text);
    if (y) {
      const cls = y[2] ? y[2].replace(/[- ]class$/i, "").replace(/^upper second$/i, "2:1").replace(/^lower second$/i, "2:2").replace(".", ":") : null;
      const after = `Year 1: ${y[1]}%${cls ? ` (${cls})` : ""}`;
      if (after !== d.text.trim()) {
        out.push({ id: d.id, text: after });
        changes.push({ before: d.text, after, why: "Year-1 result in the form screeners scan for." });
        continue;
      }
    }
    out.push(d);
  }
  return { lines: out, changes };
}

// ---------- whole CV ----------

/**
 * The CV with its education rewritten for `track`, plus what changed. The standard track, and any CV with nothing to
 * fix, come back unchanged (the same object). `terms`: the job's skills and archetype words (placement module pick).
 */
export function fixEducationForTrack(cv: ParsedCV, track: Track, opts: { terms?: string[]; todayYear: number }): EducationFix {
  if (track === "standard" || cv.education.length === 0) return { cv, changes: [] };
  const changes: EducationChange[] = [];
  const education = cv.education.map((e) => {
    const r = track === "spring" ? springEducationLines(e.details) : placementEducationLines(e.details, opts.terms ?? []);
    changes.push(...r.changes);
    let grade = e.grade;
    if (track === "spring") {
      const p = predictedGrade(e, opts.todayYear);
      if (p) {
        changes.push({ before: e.grade!, after: p, why: "A class on a degree you haven't finished is a prediction: say so." });
        grade = p;
      }
    }
    return r.changes.length || grade !== e.grade ? { ...e, grade, details: r.lines } : e;
  });
  return changes.length ? { cv: { ...cv, education }, changes } : { cv, changes };
}
