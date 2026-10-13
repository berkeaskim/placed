import type { ParsedCV, Requirement } from "@/lib/types";
import { tagSections } from "@/lib/text/jd";
import { extractSkills, canonicalize } from "@/lib/skills/extract";

export type CoverageStatus = "existing" | "supportedByResume" | "gap";
export type CoverageItem = { skill: string; section: "must" | "nice"; status: CoverageStatus };
export type CoverageResult = {
  readable: boolean; weighted: number | null;
  must: { matched: number; total: number }; nice: { matched: number; total: number }; items: CoverageItem[];
};
export type CvSkillSource = { skillsList: string[]; bulletText: string; otherText: string };

const CREDIT: Record<CoverageStatus, number> = { existing: 1, supportedByResume: 0.75, gap: 0 };
const WEIGHT = { must: 2, nice: 1 } as const;

export function jdRequirementSkills(textLines: string[], tagged: Requirement[]) {
  const map = new Map<string, "must" | "nice">();
  const add = (skill: string, section: "must" | "nice") => {
    if (map.get(skill) !== "must") map.set(skill, section);
  };
  for (const l of tagSections(textLines)) {
    if (l.isHeader || l.section === "other") continue;
    for (const s of extractSkills(l.text)) add(s, l.section);
  }
  for (const r of tagged) if (r.skill) add(canonicalize(r.skill) ?? r.skill, r.section);
  return [...map.entries()].map(([skill, section]) => ({ skill, section }));
}

/** Structural subset of a CV that cvSkillSource reads; satisfied by ParsedCV and a later TailoredCV. */
export type SkillSourceCv = Pick<ParsedCV, "skills" | "experience" | "projects"> &
  Partial<Pick<ParsedCV, "leadership" | "summary" | "interests" | "education">>;

export function cvSkillSource(cv: SkillSourceCv): CvSkillSource {
  const entries = [...cv.experience, ...cv.projects, ...(cv.leadership ?? [])];
  return {
    skillsList: cv.skills.flatMap((g) => g.items.map((i) => canonicalize(i) ?? i)),
    bulletText: entries.flatMap((e) => [e.title, ...e.bullets.map((b) => b.text)]).join("\n"),
    otherText: [cv.summary ?? "", cv.interests ?? "", ...(cv.education ?? []).flatMap((e) => [e.degree, ...e.details.map((d) => d.text)])].join("\n"),
  };
}

export function profileSkillSource(skills: string[]): CvSkillSource {
  return { skillsList: skills, bulletText: "", otherText: "" };
}

export function computeCoverage(reqs: { skill: string; section: "must" | "nice" }[], cv: CvSkillSource): CoverageResult {
  const listed = new Set(cv.skillsList.map((s) => s.toLowerCase()));
  const inBullets = new Set(extractSkills(cv.bulletText).map((s) => s.toLowerCase()));
  const inOther = new Set(extractSkills(cv.otherText).map((s) => s.toLowerCase()));
  const items: CoverageItem[] = reqs.map((r) => {
    const k = r.skill.toLowerCase();
    const status: CoverageStatus = listed.has(k) || inBullets.has(k) ? "existing" : inOther.has(k) ? "supportedByResume" : "gap";
    return { ...r, status };
  });
  if (items.length === 0) return { readable: false, weighted: null, must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 }, items };
  let num = 0, den = 0;
  for (const i of items) { num += WEIGHT[i.section] * CREDIT[i.status]; den += WEIGHT[i.section]; }
  const count = (section: "must" | "nice") => ({
    matched: items.filter((i) => i.section === section && i.status !== "gap").length,
    total: items.filter((i) => i.section === section).length,
  });
  return { readable: true, weighted: num / den, must: count("must"), nice: count("nice"), items };
}

export function coverageLabel(r: CoverageResult): string {
  if (!r.readable || r.weighted === null) return "Couldn't read the requirements";
  let pct = Math.round(r.weighted * 100);
  if (pct >= 100 && r.items.some((i) => i.status !== "existing")) pct = 99; // never display 100% with a gap
  return `You match ${r.must.matched}/${r.must.total} must-haves, ${r.nice.matched}/${r.nice.total} nice-to-haves (${pct}%)`;
}
