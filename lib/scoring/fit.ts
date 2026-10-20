import type { Archetype, FitLabel, JobForScoring, Region, StudentProfile, WorkAuth, Year } from "@/lib/types";
import { classifyRegion } from "@/lib/ingest/filter";
import { canonicalize } from "@/lib/skills/extract";
import type { CoverageResult } from "./coverage";
import { daysUntil } from "./dates";
import { springWeekGradYear } from "@/lib/profile/cycle";
import {
  DEGREE_RANK, academicEndYear, cvDegreeClass, formatWindow, parseEligibility, studentGradYears, studentYearLabels,
  subjectFamilies, summerCycleYear, type EligibilitySignals,
} from "./eligibility";
import { urgencyOf, type Urgency } from "./urgency";

/**
 * Fit = 0.40 archetype + 0.40 requirement fit + 0.20 location (10#4). The deadline is not a fit input: it is urgency,
 * a sort key and a chip. Requirement fit is must-haves first, as Workday HiredScore grades ("basic qualifications
 * determine whether a candidate is graded A/B or C/D"); nice-to-haves only break ties (10#5).
 */
export const FIT_WEIGHTS = { archetype: 0.4, requirements: 0.4, location: 0.2 } as const;
const GATE_CAP = 2.5;
const SOFT_FLAG_PENALTY = 0.5;
/** Any stated must-have missing caps the label at Stretch. */
const MUST_CAP = 3.9;
const NICE_TIEBREAK = 0.2;

const ADJACENT: [Archetype, Archetype][] = [
  ["software_eng", "data_analytics"], ["data_analytics", "quant_trading"], ["quant_trading", "finance_banking"],
  ["finance_banking", "consulting"], ["consulting", "product"], ["product", "software_eng"],
  ["marketing_growth", "product"], ["research", "data_analytics"], ["research", "quant_trading"],
  // research/placement-year/07 §1.2 row 16: embedded/controls, chemical/process and biomedical, biometrics and QC data.
  ["engineering", "software_eng"], ["engineering", "science_pharma"], ["engineering", "research"],
  ["science_pharma", "research"], ["science_pharma", "data_analytics"],
];
const isAdjacent = (a: Archetype, b: Archetype) => ADJACENT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const YEAR_LABEL: Record<Year, string> = { "1st": "1st year", "2nd": "2nd year", penultimate: "penultimate year", final: "final year", masters: "masters" };

export type GateKey = "year" | "permanent" | "location" | "visa" | "experience";
/** `quote`: the posting sentence that triggered the gate, so the student can judge it. `overridden`: they said it's wrong. */
export type Gate = { key: GateKey; passed: boolean; reason?: string; quote?: string | null; overridden?: boolean };
export type Eligibility = "ok" | "check" | "overridden";
export type FitResult = {
  global: number; label: FitLabel; gates: Gate[]; capped: boolean;
  /** "check": a gate failed, shown as "Check eligibility" with the quote and a "This is wrong" override (10#3). */
  eligibility: Eligibility;
  sub: { archetype: number; requirements: number; location: number }; softFlags: string[];
  /** Information only: never changes the score. */
  notes: string[];
  /** Set when a stated must-have is missing: the label is capped at Stretch. */
  mustCap: string | null;
  urgency: Urgency;
};
export type FitJob = JobForScoring & { rolling?: boolean; opensOn?: string | null };
export type FitContext = {
  /** Pre-parsed posting signals (the feed drops textLines); parsed from `job.textLines` when absent. */
  signals?: EligibilitySignals;
  /** The degree grade on the CV ("Predicted 2:1"); a 2:1-floor flag needs it. */
  cvGrade?: string | null;
  /** The student's course, for degree-subject flags. */
  course?: string | null;
  /** The student marked this job's eligibility check as wrong. */
  overridden?: boolean;
};

/**
 * Roles that need a work visa after the course ends. Student-visa holders can work "Full time outside term time
 * ... which includes in vacations", and "can usually do a work placement as part of your course" (UKCISA, Student
 * work, accessed 2026-10-18), so internships, spring weeks and placements are never visa-gated.
 */
const SPONSOR_NEEDED: JobForScoring["employmentType"][] = ["graduate", "permanent"];
const STUDENT_VISA_NOTE =
  "Says no visa sponsorship. On a Student visa you can usually still work full-time in vacations and on a placement that is part of your course: check the dates fall outside term.";
const GRADUATE_VISA_NOTE =
  "Sponsorship isn't stated. The Graduate visa lasts 18 months if you apply from 1 January 2027 (2 years before), so ask whether they sponsor a Skilled Worker visa after that.";
const GRADUATE_VISA_NO_SPONSOR_NOTE =
  "Says no visa sponsorship. Your Graduate visa lets you start without it, but check the role can outlast your visa or will move you to a Skilled Worker visa.";
const SPONSOR_UNKNOWN_NOTE = "Sponsorship isn't stated: ask the employer before you apply.";

/** Older profiles only carry needsVisa; on means a Student visa (the migration backfills the same way). */
const workAuthFor = (s: StudentProfile): WorkAuth => s.workAuth ?? (s.needsVisa ? "student_visa" : "uk_rtw");
const EARLY_CAREERS: JobForScoring["employmentType"][] = ["internship", "spring_week", "insight", "placement", "graduate"];

export function labelFor(g: number): FitLabel {
  if (g >= 4.5) return "Strong fit";
  if (g >= 4.0) return "Good fit";
  if (g >= 3.5) return "Stretch";
  return "Not recommended";
}

/** What the badge says: a failed gate reads "Check eligibility", never a verdict on the student. */
export function displayLabel(fit: Pick<FitResult, "label" | "eligibility">): FitLabel | "Check eligibility" {
  return fit.eligibility === "check" ? "Check eligibility" : fit.label;
}

function archetypeSub(student: StudentProfile, job: JobForScoring): number {
  if (!job.archetype || student.archetypes.length === 0) return 3;
  const keys = student.archetypes.map((a) => a.key);
  if (keys[0] === job.archetype) return 5;
  if (keys.slice(0, 2).includes(job.archetype)) return 4;
  if (keys.slice(0, 2).some((k) => isAdjacent(k, job.archetype!))) return 3;
  // 2.5, not 1.5: the archetype comes from a keyword classifier when AI is off, so skill fit must be able to outweigh it (10#28)
  return 2.5;
}

const GENERIC_AREA = /^\W*(europe|emea|european union|eu|multiple locations|various)\b/i;

function locationSub(region: Region, job: JobForScoring, prefs: Region[], mentionsUk: boolean): number {
  if (prefs.length === 0) return 4;
  // No location published is absence of signal, not a mismatch: neutral, and it passes the gate.
  if (!job.location.trim() && !job.remote) return 3.5;
  if (prefs.includes(region)) return 5;
  if ((job.remote || region === "remote") && prefs.includes("remote")) return 5;
  if (region === "london" && prefs.includes("uk")) return 5;
  if (region === "uk" && prefs.includes("london")) return 3.5;
  if (job.remote || region === "remote") return 4;
  // "Europe" / "EMEA" postings that name the UK are UK-eligible; a bare region isn't a non-UK location (10#17)
  if (region === "europe" && mentionsUk) return 3.5;
  if (region === "europe" && GENERIC_AREA.test(job.location)) return 3;
  if (/hybrid/i.test(job.location)) return 3;
  return 2;
}

/** Must-haves decide; nice-to-haves only nudge (±0.2). No must-haves: the weighted coverage. Unreadable: neutral 3. */
export function requirementFit(c: CoverageResult): number {
  if (!c.readable || c.weighted === null) return 3;
  const must = c.items.filter((i) => i.section === "must");
  const nice = c.items.filter((i) => i.section === "nice");
  if (must.length === 0) return 1 + 4 * c.weighted;
  const met = must.filter((i) => i.status === "existing").length;
  const partial = must.filter((i) => i.status === "supportedByResume").length;
  let s = 1 + (4 * (met + 0.5 * partial)) / must.length;
  if (nice.length) {
    const niceCredit = nice.reduce((n, i) => n + (i.status === "existing" ? 1 : i.status === "supportedByResume" ? 0.75 : i.mentioned ? 0.25 : 0), 0) / nice.length;
    s += 2 * NICE_TIEBREAK * (niceCredit - 0.5);
  }
  return Math.min(5, Math.max(1, s));
}

const lc = (s: string) => (canonicalize(s) ?? s).toLowerCase();

/** A must-have the posting states outright ("must", "required", "essential") that the CV doesn't show. */
function missingStatedMust(job: JobForScoring, c: CoverageResult): string | null {
  const stated = new Set(job.requirements
    .filter((r) => r.evidenceTier === "stated" && (r.section === "must" || r.importance === "critical" || r.importance === "high"))
    .flatMap((r) => (r.anyOf?.length ? r.anyOf : r.skill ? [r.skill] : []).map(lc)));
  if (!stated.size) return null;
  const miss = c.items.find((i) => i.section === "must" && i.status === "gap" && (i.anyOf?.length ? i.anyOf : [i.skill]).some((s) => stated.has(lc(s))));
  return miss ? miss.skill : null;
}

type Check = { gate: Gate; flags: string[]; notes: string[] };
const pass = (key: GateKey, notes: string[] = [], flags: string[] = []): Check => ({ gate: { key, passed: true }, flags, notes });
const fail = (key: GateKey, reason: string, quote: string | null = null): Check => ({ gate: { key, passed: false, reason, quote }, flags: [], notes: [] });

/**
 * Year eligibility. Order: a graduation-year window the posting states (always wins, quoted); spring weeks by the
 * cycle's graduating class; year-of-study labels (with the grad year settling "2nd" vs "penultimate"); then
 * programme-type defaults, which only flag (internships, placements) or gate when the student would still be
 * studying when a graduate role starts. An unknown grad year never fails a gate on ambiguity (10#2, #14).
 */
function yearCheck(student: StudentProfile, job: JobForScoring, sig: EligibilitySignals, today: string): Check {
  const known = student.gradYear != null;
  const cands = studentGradYears(student, today);
  const w = sig.gradWindow;
  if (w) {
    const inW = (y: number) => y >= w.min && y <= w.max;
    if (!cands.some(inW)) return fail("year", `Asks for students graduating in ${formatWindow(w)}${known ? `; you graduate in ${student.gradYear}` : ""}`, w.quote);
    return pass("year", known || cands.every(inW) ? [] : [`Asks for students graduating in ${formatWindow(w)}. Add your graduation year in Settings to check it.`]);
  }
  if (job.employmentType === "spring_week") {
    const target = springWeekGradYear(today);
    const reason = `Spring weeks this cycle are for students graduating in ${target}`;
    if (known) return student.gradYear === target ? pass("year") : fail("year", reason, sig.yearQuote);
    if (!cands.includes(target)) return fail("year", reason, sig.yearQuote);
  }
  if (job.yearEligibility.length) {
    const mine = studentYearLabels(student, today);
    const theirs = new Set(job.yearEligibility);
    // "2nd" next to "penultimate" is the 3-year-degree alias; a known grad year says whether this 2nd year is penultimate
    if (known && theirs.has("penultimate") && !/\b(second|2nd)[- ]year/i.test(sig.yearQuote ?? "")) theirs.delete("2nd");
    return [...theirs].some((y) => mine.has(y))
      ? pass("year")
      : fail("year", `Open to ${job.yearEligibility.filter((y) => theirs.has(y)).map((y) => YEAR_LABEL[y]).join(" / ")} only`, sig.yearQuote);
  }
  const start = sig.startYear ?? summerCycleYear(today);
  if (job.employmentType === "graduate" && cands.every((y) => y > start)) {
    return fail("year", `Graduate roles starting in ${start} are for students who have graduated by then`, null);
  }
  if (known && (job.employmentType === "internship" || job.employmentType === "placement")) {
    const expected = job.employmentType === "internship" ? start + 1 : start + 2;
    if (student.gradYear !== expected) {
      const kind = job.employmentType === "internship" ? `${start} summer internships` : `Placements starting in ${start}`;
      // a note, not a penalty: postings often take other years, and the gate already covers stated windows
      return pass("year", [`${kind} usually recruit students graduating in ${expected}: check this one takes your year`]);
    }
  }
  return pass("year");
}

/** Permanent roles: blocked only while the student would still be enrolled (UKCISA: the bar is a permanent job in term time) (10#8). */
function permanentCheck(student: StudentProfile, job: JobForScoring, sig: EligibilitySignals, today: string): Check {
  if (job.employmentType !== "permanent") return pass("permanent");
  const start = sig.startYear ?? summerCycleYear(today);
  const note = "Permanent role: check it starts after you graduate.";
  if (student.gradYear != null) {
    return student.gradYear > start ? fail("permanent", `Permanent role starting by ${start}, before you graduate in ${student.gradYear}`) : pass("permanent", [note]);
  }
  return student.year === "final" || student.year === "masters" ? pass("permanent", [note]) : fail("permanent", "Permanent full-time role: you'd still be studying when it starts");
}

function experienceCheck(student: StudentProfile, sig: EligibilitySignals, today: string): Check {
  const e = sig.minYearsExperience;
  const graduated = student.gradYear != null && student.gradYear < academicEndYear(today);
  if (!e || e.years < 1 || graduated) return pass("experience");
  return fail("experience", `Asks for ${e.years}+ year${e.years === 1 ? "" : "s"}' experience`, e.quote);
}

const CLASS_TEXT = { first: "First", "2:1": "2:1", "2:2": "2:2", third: "Third" } as const;

/** 2:1 floors are soft: about half of ISE employers set one, predicted grades change, and many firms recruit contextually (10#6). */
function degreeCheck(sig: EligibilitySignals, cvGrade: string | null | undefined): { flags: string[]; notes: string[] } {
  const req = sig.minDegreeClass;
  if (!req) return { flags: [], notes: [] };
  const mine = cvDegreeClass(cvGrade);
  const routes = sig.contextualOffers ? "They mention contextual recruitment, so check how it applies to you." : "Check for contextual offers or mitigating-circumstances routes before ruling it out.";
  if (mine && (mine === "third" || DEGREE_RANK[mine] < DEGREE_RANK[req.cls])) {
    return { flags: [`Asks for at least a ${CLASS_TEXT[req.cls]}; your CV shows a ${CLASS_TEXT[mine]}. ${routes}`], notes: [] };
  }
  return mine ? { flags: [], notes: [] } : { flags: [], notes: [`Asks for at least a ${CLASS_TEXT[req.cls]}.`] };
}

const FAMILY_TEXT: Record<string, string> = {
  computing: "computer science", maths: "maths or statistics", physics: "physics", engineering: "engineering", science: "a science",
  economics: "economics", business: "business or finance", law: "law", humanities: "a humanities subject", social: "a social science",
};

function subjectCheck(sig: EligibilitySignals, course: string | null | undefined): { flags: string[]; notes: string[] } {
  const s = sig.degreeSubjects;
  if (!s || !course?.trim()) return { flags: [], notes: [] };
  const mine = subjectFamilies(course);
  if (!mine.length || mine.some((f) => s.families.includes(f))) return { flags: [], notes: [] };
  const want = [...new Set(s.families.map((f) => FAMILY_TEXT[f]))].slice(0, 3).join(", ");
  return s.related
    ? { flags: [], notes: [`Asks for ${want} or a related degree: check your course counts.`] }
    : { flags: [`Asks for a degree in ${want}.`], notes: [] };
}

/** Soft, never a gate: some employers take students on a year out, and course rules change (DECISIONS.md §1). */
function placementFlags(s: StudentProfile): string[] {
  if (s.placementStatus === "none") return ["Usually for students whose degree includes a placement year (or who take a year out)"];
  if (s.placementStatus === "completed") return ["You've already done your placement year"];
  return [];
}

export function scoreFit(student: StudentProfile, job: FitJob, coverage: CoverageResult, today: string, ctx: FitContext = {}): FitResult {
  const sig = ctx.signals ?? parseEligibility(job.title, job.textLines);
  const region = classifyRegion(job.location, job.remote);
  const loc = locationSub(region, job, student.locationPref, sig.mentionsUk);
  const year = yearCheck(student, job, sig, today);
  const perm = permanentCheck(student, job, sig, today);
  const exp = experienceCheck(student, sig, today);
  const auth = workAuthFor(student);
  // Needs a visa for this role: always without UK right to work; on a Student visa only after the course (10#1)
  const needsSponsor = job.sponsorsVisa === "no" &&
    (auth === "needs_sponsorship" || (auth === "student_visa" && SPONSOR_NEEDED.includes(job.employmentType)));
  let gates: Gate[] = [
    year.gate,
    perm.gate,
    loc <= 2 ? { key: "location", passed: false, reason: `Outside your locations (${job.location || "unknown"})`, quote: null } : { key: "location", passed: true },
    needsSponsor ? { key: "visa", passed: false, reason: "No visa sponsorship", quote: sig.sponsorQuote } : { key: "visa", passed: true },
    exp.gate,
  ];

  const softFlags: string[] = [...year.flags];
  // Term-time cohorts clash with term, but a course placement is full-time in term by design (UKCISA) (10#31)
  if (job.cohortClash && job.employmentType !== "placement") softFlags.push("Term-time cohort (e.g. Winter)");
  if (job.employmentType === "placement") softFlags.push(...placementFlags(student));
  const degree = degreeCheck(sig, ctx.cvGrade);
  const subject = subjectCheck(sig, ctx.course);
  softFlags.push(...degree.flags, ...subject.flags);

  const notes: string[] = [...year.notes, ...perm.notes, ...degree.notes, ...subject.notes];
  for (const l of sig.languages) notes.push(`Asks for ${l.lang}: "${l.quote}"`);
  if (auth === "student_visa" && job.sponsorsVisa === "no" && !SPONSOR_NEEDED.includes(job.employmentType)) notes.push(STUDENT_VISA_NOTE);
  if (auth === "graduate_visa" && job.sponsorsVisa === "no" && SPONSOR_NEEDED.includes(job.employmentType)) notes.push(GRADUATE_VISA_NO_SPONSOR_NOTE);
  if ((auth === "student_visa" || auth === "graduate_visa") && job.sponsorsVisa === "unknown" && job.employmentType === "graduate") notes.push(GRADUATE_VISA_NOTE);
  if (auth === "needs_sponsorship" && job.sponsorsVisa === "unknown") notes.push(SPONSOR_UNKNOWN_NOTE);
  // Posting age is no fit signal for early-careers roles: summer requisitions posted Jun–Aug stay open into Dec (10#9)
  if (!EARLY_CAREERS.includes(job.employmentType) && job.postedAt) {
    const age = daysUntil(today, job.postedAt.slice(0, 10));
    if (age > 60) notes.push(`Posted ${age} days ago`);
  }

  const sub = { archetype: archetypeSub(student, job), requirements: requirementFit(coverage), location: loc };
  let g = FIT_WEIGHTS.archetype * sub.archetype + FIT_WEIGHTS.requirements * sub.requirements + FIT_WEIGHTS.location * sub.location -
    SOFT_FLAG_PENALTY * softFlags.length;
  g = Math.min(5, Math.max(1, g));
  const missing = missingStatedMust(job, coverage);
  const mustCap = missing ? `"${missing}" is a stated must-have and your CV doesn't show it yet` : null;
  if (mustCap) g = Math.min(g, MUST_CAP);

  let eligibility: Eligibility = gates.some((x) => !x.passed) ? "check" : "ok";
  if (eligibility === "check" && ctx.overridden) {
    gates = gates.map((x) => (x.passed ? x : { ...x, passed: true, overridden: true }));
    eligibility = "overridden";
    notes.unshift("You marked the eligibility check as wrong for this role, so it's scored as if you can apply.");
  }
  const capped = eligibility === "check";
  if (capped) g = Math.min(g, GATE_CAP);
  const global = Math.round((g + 1e-9) * 10) / 10; // epsilon: 4.655 must round to 4.7, not 4.6
  return { global, label: labelFor(global), gates, capped, eligibility, sub, softFlags, notes, mustCap, urgency: urgencyOf(job, today) };
}
