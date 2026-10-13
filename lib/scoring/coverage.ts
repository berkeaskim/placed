import type { ParsedCV, Requirement } from "@/lib/types";
import { tagSections } from "@/lib/text/jd";
import { extractSkills, canonicalize } from "@/lib/skills/extract";

export type CoverageStatus = "existing" | "supportedByResume" | "gap";
export type CoverageItem = { skill: string; section: "must" | "nice"; anyOf?: string[]; status: CoverageStatus };
export type JdSkill = { skill: string; section: "must" | "nice"; anyOf?: string[] };
export type CoverageResult = {
  readable: boolean; weighted: number | null;
  must: { matched: number; total: number }; nice: { matched: number; total: number }; items: CoverageItem[];
};
export type CvSkillSource = { skillsList: string[]; bulletText: string; otherText: string };

const CREDIT: Record<CoverageStatus, number> = { existing: 1, supportedByResume: 0.75, gap: 0 };
const WEIGHT = { must: 2, nice: 1 } as const;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Skills the JD asks for. "Python or Java" (a tagged anyOf group) becomes ONE item that any member satisfies,
 * and the line it came from is not also scanned skill-by-skill (that would demand both).
 */
export function jdRequirementSkills(textLines: string[], tagged: Requirement[]): JdSkill[] {
  // keyed case/whitespace-insensitively; the first spelling seen is kept, and "must" always wins over "nice"
  const map = new Map<string, { skill: string; section: "must" | "nice" }>();
  const add = (raw: string, section: "must" | "nice") => {
    const skill = raw.replace(/\s+/g, " ").trim();
    if (!skill) return;
    const key = skill.toLowerCase();
    const prev = map.get(key);
    if (!prev) map.set(key, { skill, section });
    else if (section === "must") prev.section = "must";
  };
  const groups = new Map<string, JdSkill>();
  for (const r of tagged) {
    if (!r.skill || !r.anyOf || r.anyOf.length < 2) continue;
    const anyOf = r.anyOf.map((s) => canonicalize(s) ?? s);
    const key = [...anyOf].map((s) => s.toLowerCase()).sort().join("|");
    const prev = groups.get(key);
    groups.set(key, { skill: anyOf.join(" or "), anyOf, section: prev?.section === "must" ? "must" : r.section });
  }
  const groupTexts = tagged.filter((r) => r.anyOf && r.anyOf.length > 1).map((r) => norm(r.text)).filter(Boolean);
  for (const l of tagSections(textLines)) {
    if (l.isHeader || l.section === "other") continue;
    const t = norm(l.text);
    if (groupTexts.some((g) => t.includes(g) || (t.length >= 12 && g.includes(t)))) continue;
    for (const s of extractSkills(l.text)) add(s, l.section);
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
    otherText: [cv.summary ?? "", cv.interests ?? "", ...(cv.education ?? []).flatMap((e) => [e.degree, ...e.details.map((d) => d.text)])].join("\n"),
  };
}

export function profileSkillSource(skills: string[]): CvSkillSource {
  return { skillsList: skills, bulletText: "", otherText: "" };
}

export function computeCoverage(reqs: JdSkill[], cv: CvSkillSource): CoverageResult {
  const listed = new Set(cv.skillsList.map((s) => s.toLowerCase()));
  const inBullets = new Set(extractSkills(cv.bulletText).map((s) => s.toLowerCase()));
  const inOther = new Set(extractSkills(cv.otherText).map((s) => s.toLowerCase()));
  const statusOf = (skill: string): CoverageStatus => {
    const k = skill.toLowerCase();
    return listed.has(k) || inBullets.has(k) ? "existing" : inOther.has(k) ? "supportedByResume" : "gap";
  };
  const items: CoverageItem[] = reqs.map((r) => {
    // an anyOf group takes the best status among its alternatives
    const statuses = (r.anyOf?.length ? r.anyOf : [r.skill]).map(statusOf);
    const status = statuses.reduce((best, s) => (CREDIT[s] > CREDIT[best] ? s : best), "gap" as CoverageStatus);
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
