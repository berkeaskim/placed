import type { ParsedCV, Requirement } from "@/lib/types";
import { tagSections } from "@/lib/text/jd";
import { extractSkills, canonicalize, impliedSkills, SOFT_SKILLS } from "@/lib/skills/extract";

export type CoverageStatus = "existing" | "supportedByResume" | "gap";
/** `mentioned`: a gap the CV only names in its summary or interests, worth a little credit but never "matched". */
export type CoverageItem = { skill: string; section: "must" | "nice"; anyOf?: string[]; status: CoverageStatus; mentioned?: true };
export type JdSkill = { skill: string; section: "must" | "nice"; anyOf?: string[] };
export type CoverageResult = {
  readable: boolean; weighted: number | null;
  must: { matched: number; total: number }; nice: { matched: number; total: number }; items: CoverageItem[];
};
/**
 * `otherText`: education lines (degree, modules), credited 0.75. `mentionText`: summary and interests, credited 0.25:
 * "Interests: Python meetups" is not evidence of Python (10#16; the docs' EV-03 rule wants skills in a bullet).
 */
export type CvSkillSource = { skillsList: string[]; bulletText: string; otherText: string; mentionText?: string };

const CREDIT: Record<CoverageStatus, number> = { existing: 1, supportedByResume: 0.75, gap: 0 };
const MENTION_CREDIT = 0.25;
const isSoft = (skill: string) => SOFT_SKILLS.has(canonicalize(skill) ?? skill);
const WEIGHT = { must: 2, nice: 1 } as const;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const EXAMPLES = /\b(such as|e\.g\.?|for example|for instance|including|like)\b/i;
const ALTERNATIVES = /\b(any of|one of|either|at least one|one or more of)\b/i;

/** "Python, Java or C++" accepts any one; "such as Python, SQL" gives examples; otherwise every skill is asked for (10#15). */
export function listShape(text: string, skillCount: number): "alternatives" | "examples" | "all" {
  if (skillCount < 2) return "all";
  if (ALTERNATIVES.test(text)) return "alternatives";
  if (EXAMPLES.test(text)) return "examples";
  return /\bor\b/i.test(text) && !/\band\b|&/i.test(text) ? "alternatives" : "all";
}

/**
 * Skills the JD asks for. "Python or Java" (a tagged anyOf group) becomes ONE item that any member satisfies,
 * and the line it came from is not also scanned skill-by-skill (that would demand both).
 */
export function jdRequirementSkills(textLines: string[], tagged: Requirement[]): JdSkill[] {
  // keyed case/whitespace-insensitively; the first spelling seen is kept, and "must" always wins over "nice"
  const map = new Map<string, { skill: string; section: "must" | "nice" }>();
  const add = (raw: string, section: "must" | "nice") => {
    const skill = raw.replace(/\s+/g, " ").trim();
    if (!skill || isSoft(skill)) return;
    const key = skill.toLowerCase();
    const prev = map.get(key);
    if (!prev) map.set(key, { skill, section });
    else if (section === "must") prev.section = "must";
  };
  const groups = new Map<string, JdSkill>();
  for (const r of tagged) {
    if (!r.skill || !r.anyOf || r.anyOf.length < 2) continue;
    const anyOf = r.anyOf.map((s) => canonicalize(s) ?? s).filter((s) => !isSoft(s));
    if (anyOf.length < 2) continue;
    const key = [...anyOf].map((s) => s.toLowerCase()).sort().join("|");
    const prev = groups.get(key);
    groups.set(key, { skill: anyOf.join(" or "), anyOf, section: prev?.section === "must" ? "must" : r.section });
  }
  const groupTexts = tagged.filter((r) => r.anyOf && r.anyOf.length > 1).map((r) => norm(r.text)).filter(Boolean);
  for (const l of tagSections(textLines)) {
    if (l.isHeader || l.section === "other") continue;
    const t = norm(l.text);
    if (groupTexts.some((g) => t.includes(g) || (t.length >= 12 && g.includes(t)))) continue;
    const skills = extractSkills(l.text).filter((s) => !isSoft(s));
    const shape = listShape(l.text, skills.length);
    if (shape === "alternatives") {
      const key = [...skills].map((s) => s.toLowerCase()).sort().join("|");
      const prev = groups.get(key);
      groups.set(key, { skill: skills.join(" or "), anyOf: skills, section: prev?.section === "must" ? "must" : l.section });
      continue;
    }
    // "such as / e.g." lists are examples of what helps, not separate demands
    for (const s of skills) add(s, shape === "examples" ? "nice" : l.section);
  }
  for (const r of tagged) if (r.skill && !(r.anyOf && r.anyOf.length > 1)) add(canonicalize(r.skill.trim()) ?? r.skill, r.section);
  const single = [...map.values()].map(({ skill, section }) => ({ skill, section }));
  return [...single, ...groups.values()];
}

/** Structural subset of a CV that cvSkillSource reads; satisfied by ParsedCV and a later TailoredCV. */
export type SkillSourceCv = Pick<ParsedCV, "skills" | "experience" | "projects"> &
  Partial<Pick<ParsedCV, "leadership" | "summary" | "interests" | "education">>;

export function cvSkillSource(cv: SkillSourceCv): CvSkillSource {
  const entries = [...cv.experience, ...cv.projects, ...(cv.leadership ?? [])];
  return {
    // "Python (Pandas, NumPy)" or "Python, SQL" in one item must still count each skill
    skillsList: [...new Set(cv.skills.flatMap((g) => g.items.flatMap((i) => [canonicalize(i) ?? i, ...extractSkills(i)])))],
    bulletText: entries.flatMap((e) => [e.title, ...e.bullets.map((b) => b.text)]).join("\n"),
    otherText: (cv.education ?? []).flatMap((e) => [e.degree, ...e.details.map((d) => d.text)]).join("\n"),
    mentionText: [cv.summary ?? "", cv.interests ?? ""].join("\n"),
  };
}

export function profileSkillSource(skills: string[]): CvSkillSource {
  return { skillsList: skills, bulletText: "", otherText: "" };
}

type SourceSets = { listed: Set<string>; inBullets: Set<string>; inOther: Set<string>; implied: Set<string>; mentioned: Set<string> };
/** Per-source skill sets: the feed scores every live job against one source, and extractSkills over the CV text was most of that time. */
const sourceSets = new WeakMap<CvSkillSource, SourceSets>();
function setsFor(cv: CvSkillSource): SourceSets {
  let sets = sourceSets.get(cv);
  if (!sets) {
    const listed = cv.skillsList, inBullets = extractSkills(cv.bulletText), inOther = extractSkills(cv.otherText);
    const lower = (xs: string[]) => new Set(xs.map((s) => s.toLowerCase()));
    sets = {
      listed: lower(listed), inBullets: lower(inBullets), inOther: lower(inOther),
      implied: lower(impliedSkills([...listed, ...inBullets, ...inOther].map((s) => canonicalize(s) ?? s))),
      mentioned: lower(cv.mentionText ? extractSkills(cv.mentionText) : []),
    };
    sourceSets.set(cv, sets);
  }
  return sets;
}

export function computeCoverage(reqs: JdSkill[], cv: CvSkillSource): CoverageResult {
  const { listed, inBullets, inOther, implied, mentioned } = setsFor(cv);
  // implied (pandas ⇒ Python) is credited like a prose mention: shown, but not named (10#11)
  const statusOf = (skill: string): CoverageStatus => {
    const k = skill.toLowerCase();
    return listed.has(k) || inBullets.has(k) ? "existing" : inOther.has(k) || implied.has(k) ? "supportedByResume" : "gap";
  };
  const items: CoverageItem[] = reqs.map((r) => {
    // an anyOf group takes the best status among its alternatives
    const names = r.anyOf?.length ? r.anyOf : [r.skill];
    const status = names.map(statusOf).reduce((best, s) => (CREDIT[s] > CREDIT[best] ? s : best), "gap" as CoverageStatus);
    return status === "gap" && names.some((n) => mentioned.has(n.toLowerCase())) ? { ...r, status, mentioned: true as const } : { ...r, status };
  });
  if (items.length === 0) return { readable: false, weighted: null, must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 }, items };
  let num = 0, den = 0;
  for (const i of items) { num += WEIGHT[i.section] * (i.mentioned ? MENTION_CREDIT : CREDIT[i.status]); den += WEIGHT[i.section]; }
  const count = (section: "must" | "nice") => ({
    matched: items.filter((i) => i.section === section && i.status !== "gap").length,
    total: items.filter((i) => i.section === section).length,
  });
  return { readable: true, weighted: num / den, must: count("must"), nice: count("nice"), items };
}

import type { JobForScoring } from "@/lib/types";

/** Coverage of one job against the student's CV (or, with no CV, their profile skills). Shared by feed, job detail, apply and tracker. */
export function coverageFor(job: JobForScoring, cv: SkillSourceCv | null, studentSkills: string[]): CoverageResult {
  return computeCoverage(jdRequirementSkills(job.textLines, job.requirements), cv ? cvSkillSource(cv) : profileSkillSource(studentSkills));
}

export function coverageLabel(r: CoverageResult): string {
  if (!r.readable || r.weighted === null) return "Couldn't read the requirements";
  let pct = Math.round(r.weighted * 100);
  if (pct >= 100 && r.items.some((i) => i.status !== "existing")) pct = 99; // never display 100% with a gap
  return `You match ${r.must.matched}/${r.must.total} must-haves, ${r.nice.matched}/${r.nice.total} nice-to-haves (${pct}%)`;
}
