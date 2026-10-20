import { ARCHETYPES, type Archetype, type ArchetypeScore, type CvEntry, type ParsedCV, type Requirement, type Year } from "@/lib/types";
import { EMAIL_RE, PHONE_RE, escapeRegex } from "@/lib/text/regex";
import { listShape, type CoverageResult, type CoverageStatus } from "@/lib/scoring/coverage";
export { listShape } from "@/lib/scoring/coverage";
import { CHECK_KINDS, requirementKind, type Explanation, type RequirementRow } from "@/lib/scoring/requirements";
import { tagSections } from "@/lib/text/jd";
import { detectEmploymentType, detectSponsorship } from "@/lib/ingest/filter";
import { extractSkills } from "@/lib/skills/extract";
import type { TaggedJob } from "./tagJob";
import type { TailorChange, TailoredCV, TailoredEntry } from "@/lib/types";
import { toTailored } from "@/lib/verify/tailoring";

const KEYWORDS: Record<Archetype, RegExp> = {
  // No bare "engineer(ing)": it filed every mechanical, civil and electrical role under software (placement-year/07 §4.1).
  software_eng: /\b(software|developer|backend|frontend|full[- ]stack|swe|devops|mobile|(back[- ]?end|front[- ]?end|platform|cloud|web|ios|android|site reliability|ml|machine learning|data platform|embedded software|firmware|test automation) engineer(ing|s)?)\b/gi,
  // phrases, not bare words: "data", "product", "research" and "markets" appear in every kind of posting and CV (10#28)
  data_analytics: /\b(data (analyst|analytics|analysis|engineer\w*|scien\w*|visuali[sz]ation)|analytics|business intelligence|bi analyst|machine learning)\b/gi,
  quant_trading: /\b(quant\w*|trading|trader|systematic|market making|algorithmic)\b/gi,
  consulting: /\b(consult\w*|advisory|strategy|transformation)\b/gi,
  product: /\b(product (manager|management|intern|analyst|owner|designer)|apm)\b/gi,
  finance_banking: /\b(investment banking|banking|global markets|capital markets|financial markets|m&a|asset management|equity research|summer analyst|corporate finance|private equity|finance)\b/gi,
  marketing_growth: /\b(marketing|growth|brand|content|social media|communications|seo)\b/gi,
  // No bare "scientist" or "laboratory": industry lab roles are science_pharma now (placement-year/07 §4.1).
  research: /\b(research (assistant|scientist|engineer|intern\w*|fellow|associate|programme|placement)|researcher|phd|publications?)\b/gi,
  // Never bare "plc" (Barclays PLC) or "ice" (the Institution is matched by its full name).
  engineering: /\b((mechanical|electrical|electronic|electronics|civil|structural|aerospace|aeronautical|automotive|chemical|process|manufacturing|production|mechatronics?|materials|nuclear|geotechnical|building services|biomedical|rail|power|propulsion|avionics|airframe|stress) engineer(ing|s)?|engineering (placement|industrial placement|undergraduate|year in industry)|solidworks|catia|siemens nx|autocad|revit|ansys|abaqus|simulink|labview|plc (programming|ladder)|ladder logic|finite element|fea|cfd|gd&t|formula student|imeche|institution of (mechanical|civil) engineers|istructe|icheme|eurocodes?|aircraft|v-model|rig test\w*|lean manufacturing|six sigma)\b/gi,
  // Never bare "scientist": "Data Scientist" is data_analytics.
  science_pharma: /\b(pharma\w*|biopharm\w*|biotech\w*|drug (discovery|development|product|substance)|medicinal chemistry|analytical (chemist\w*|science|development)|synthetic (organic )?chemistry|formulation (scientist|science|development)|(qc|qa|quality control|quality assurance) (analyst|scientist|associate|placement)|regulatory affairs|clinical (operations|trials?|development)|pharmacovigilance|bioprocess\w*|microbiolog\w*|biochemist\w*|toxicolog\w*|cell biology|molecular biology|(lab|laboratory) (scientist|technician|analyst|placement)|lab-based|(analytical|formulation|bench|r&d|development|qc|associate) scientist|gmp|glp|gxp|hplc|uplc|lc-ms|gc-ms|nmr|qpcr|pcr|elisa|cell culture|aseptic|coshh)\b/gi,
};

/**
 * Weak signals, counted once even in the title: "systems/test/design engineer" is engineering at BAE and software at a
 * cloud firm, so the body decides. Degree acronyms are case-sensitive so the surname "Meng" never counts.
 */
const WEAK_KEYWORDS: Partial<Record<Archetype, RegExp>> = {
  engineering: /(?<![Ss]oftware |[Dd]ata |[Cc]loud |[Ww]eb |ML |[Pp]latform )\b(?:[Ss]ystems|[Dd]esign|[Tt]est|[Qq]uality|[Cc]ontrols?|[Ii]ntegration) [Ee]ngineer(?:ing|s)?\b|\b[BM]Eng\b/g,
  software_eng: /\b(kubernetes|docker|aws|azure|gcp|microservices|ci\/cd)\b/gi,
};

const DISCIPLINE = /\b(mechanical|electrical|electronic|civil|structural|aerospace|aeronautical|automotive|chemical|manufacturing|materials|nuclear|airframe|avionics|biomedical)\b/i;
const PHARMA_CUE = /\b(gmp|glp|qc|regulatory|pharma\w*)\b/i;

/** On a tied raw score, prefer the industry sector when the text says so (placement-year/07 §4.1 tie-break). */
function tieBreak(a: Archetype, b: Archetype, text: string, title: string): number {
  const pair = (x: Archetype, y: Archetype) => (a === x && b === y ? -1 : a === y && b === x ? 1 : 0);
  if (PHARMA_CUE.test(text) || PHARMA_CUE.test(title)) { const p = pair("science_pharma", "research"); if (p) return p; }
  if (DISCIPLINE.test(title)) { const p = pair("engineering", "software_eng"); if (p) return p; }
  return 0;
}

export function archetypeScores(text: string, title = ""): ArchetypeScore[] {
  const count = (s: string, re: RegExp | undefined) => (re ? (s.match(re) ?? []).length : 0);
  const raw = ARCHETYPES.map((key) => {
    const t = count(title, KEYWORDS[key]) * 3 + count(title, WEAK_KEYWORDS[key]);
    const b = count(text, KEYWORDS[key]) + count(text, WEAK_KEYWORDS[key]);
    return { key, raw: t + b };
  });
  const max = Math.max(1, ...raw.map((r) => r.raw));
  return raw
    .sort((a, b) => b.raw - a.raw || tieBreak(a.key, b.key, text, title))
    .map((r) => ({ key: r.key, score: Math.round((r.raw / max) * 100), why: r.raw > 0 ? [`Matches ${r.key.replace("_", " ")} keywords`] : [] }));
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const DEADLINE = new RegExp(`(deadline|closing date|applications? close[sd]?|apply by)[^0-9]{0,25}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\w*\\s+(20\\d\\d)`, "i");

function parseDeadline(text: string): string | null {
  const m = DEADLINE.exec(text);
  if (!m) return null;
  const d = new Date(`${m[2]} ${m[3]} ${m[4]} 12:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Year-of-study labels from explicit wording only. A graduation year ("graduating in 2028") is NOT turned into a label:
 * on a 2027 summer internship it means penultimate, not final, so fit reads the window from the text itself (10#2).
 * "2nd" next to "penultimate" is the 3-year-degree alias; a known graduation year settles it at scoring time.
 */
function yearsFrom(text: string, employmentType: TaggedJob["employmentType"]): Year[] {
  const t = text.toLowerCase();
  const out = new Set<Year>();
  if (/penultimate/.test(t)) { out.add("penultimate"); out.add("2nd"); }
  if (/final[- ]year (students?|undergraduates?)|in (your|their) final year|recent graduates?/.test(t)) { out.add("final"); out.add("masters"); }
  if (/first[- ]year|1st[- ]year/.test(t)) out.add("1st");
  if (/second[- ]year|2nd[- ]year/.test(t)) out.add("2nd");
  if (out.size === 0 && (employmentType === "spring_week" || employmentType === "insight")) { out.add("1st"); out.add("2nd"); }
  if (out.size === 0 && employmentType === "graduate") { out.add("final"); out.add("masters"); }
  // A placement is applied for the year before it: the 2nd year of a sandwich degree ("penultimate" in most adverts).
  if (employmentType === "placement" && (out.size === 0 || out.has("penultimate"))) { out.add("2nd"); out.add("penultimate"); }
  return [...out];
}

const HEURISTIC_HIGH_MAX = 5;

export function heuristicTagJob(input: { title: string; textLines: string[] }): TaggedJob {
  const text = input.textLines.join("\n");
  const employmentType = detectEmploymentType(input.title, text);
  const seen = new Set<string>();
  const requirements: Requirement[] = [];
  let highs = 0;
  for (const line of tagSections(input.textLines)) {
    if (line.isHeader || line.section === "other") continue;
    const skills = extractSkills(line.text).filter((s) => !seen.has(s));
    if (!skills.length) continue;
    skills.forEach((s) => seen.add(s));
    const text = line.text.replace(/^- /, "");
    const shape = listShape(text, skills.length);
    // "such as / e.g." lists are examples, not demands; past the first 5 must-haves the heuristic can't tell (10#15)
    const section = shape === "examples" ? "nice" : line.section;
    const importance = section === "must" && highs < HEURISTIC_HIGH_MAX ? "high" : section === "must" ? "meaningful" : "preferred";
    if (importance === "high") highs++;
    const anyOf = shape === "alternatives" ? skills : undefined;
    for (const skill of skills) requirements.push({ text, skill, ...(anyOf ? { anyOf } : {}), importance, section, evidenceTier: "structural" });
  }
  const firstProse = input.textLines.find((l) => !l.startsWith("## ") && l.length > 40) ?? "";
  return {
    archetype: archetypeScores(text, input.title)[0].key,
    fieldTags: [],
    yearEligibility: yearsFrom(text, employmentType),
    sponsorsVisa: detectSponsorship(text),
    employmentType,
    firstYearFriendly: /first[- ]year|1st[- ]year|any year/i.test(text) || employmentType === "spring_week" || employmentType === "insight",
    deadline: parseDeadline(text),
    summary: firstProse.slice(0, 200),
    requirements,
    status: "ok",
  };
}

const SECTION_RE: [string, RegExp][] = [
  ["education", /^(education|academic background)$/i],
  ["experience", /^(experience|work experience|professional experience|employment)$/i],
  ["projects", /^(projects|personal projects|technical projects)$/i],
  ["leadership", /^(leadership|activities|extracurricular( activities)?|positions of responsibility|leadership (&|and) activities)$/i],
  ["skills", /^(skills|technical skills|skills (&|and) interests)$/i],
  ["interests", /^(interests|hobbies|interests (&|and) hobbies)$/i],
  ["summary", /^(profile|summary|personal statement|about me)$/i],
];
// \uF0B7 is the Symbol-font bullet Word PDFs emit as a private-use char; ● is Word's default bullet.
const BULLET = /^\s*([•●▪■◦·*\-–\uF0B7]|\d+\.)\s+/;

export function heuristicParseCv(text: string): ParsedCV {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = text.match(PHONE_RE)?.[0]?.trim() ?? null;
  const links = [...text.matchAll(/\b((?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|linkedin\.com\/in)\/[\w-]+)/gi)].map((m) => m[1]);
  const sections: Record<string, string[]> = {};
  const order: string[] = [];
  let current = "header";
  for (const line of lines) {
    const hit = SECTION_RE.find(([, re]) => re.test(line.replace(/[:\s]+$/, "")));
    if (hit) { current = hit[0]; if (!order.includes(current)) order.push(current); sections[current] ??= []; continue; }
    (sections[current] ??= []).push(line);
  }
  const toEntries = (ls: string[] = []): CvEntry[] => {
    const out: CvEntry[] = [];
    for (const l of ls) {
      if (BULLET.test(l)) {
        if (!out.length) out.push({ id: "", org: "", title: "", dates: "", location: "", bullets: [] });
        out[out.length - 1].bullets.push({ id: "", text: l.replace(BULLET, "") });
      } else {
        const [head, ...rest] = l.split(/\s+[—–-]\s+|,\s+(?=\d{4})/);
        const dates = l.match(/(\d{4}\s*[–-]\s*(\d{4}|present))/i)?.[1] ?? "";
        out.push({ id: "", org: head ?? l, title: rest.join(", ").replace(dates, "").replace(/,\s*$/, "").trim(), dates, location: "", bullets: [] });
      }
    }
    return out;
  };
  const edu = (sections.education ?? []);
  const skillItems = (sections.skills ?? []).join(", ").split(/[,;|]/).map((s) => s.replace(/^.*?:\s*/, "").trim()).filter(Boolean);
  return {
    name: lines[0] ?? "",
    email, phone, location: /\blondon\b/i.test(lines.slice(0, 3).join(" ")) ? "London" : null, links,
    summary: sections.summary?.join(" ") ?? null,
    education: edu.length ? [{
      id: "", institution: edu[0].split(/\s+[—–-]\s+/)[0], degree: edu[0].split(/\s+[—–-]\s+/)[1] ?? "",
      dates: edu[0].match(/\d{4}\s*[–-]\s*\d{4}/)?.[0] ?? "",
      grade: edu.find((l) => /(2:1|2:2|first|predicted|\d{2}%|a\*|aaa)/i.test(l)) ?? null,
      details: edu.slice(1).map((t) => ({ id: "", text: t.replace(BULLET, "") })),
    }] : [],
    experience: toEntries(sections.experience),
    projects: toEntries(sections.projects),
    leadership: toEntries(sections.leadership),
    skills: skillItems.length ? [{ group: "Skills", items: skillItems }] : [],
    interests: sections.interests?.join(" ") ?? null,
    sectionOrder: order.filter((s) => s !== "summary"),
    yearGuess: null,
    archetypes: archetypeScores(text).filter((a) => a.score > 0).slice(0, 3),
  };
}

// ---------- explainMatch fallback (no AI, no CV-reading judgement beyond keyword coverage) ----------

const COVERAGE_TO_MATCH: Record<CoverageStatus, RequirementRow["match"]> = { existing: "strong", supportedByResume: "partial", gap: "missing" };

/**
 * Deterministic requirement table: skill requirements take their keyword-coverage status; requirements with no
 * skill (or no coverage item) stay "partial" because keywords cannot judge them. Strong rows quote a CV line
 * that names the skill (whole word), or are downgraded to partial when no such line exists.
 */
export function heuristicExplain(i: { requirements: Requirement[]; coverage: CoverageResult; cvText: string; archetypeMatch: boolean }): Explanation {
  const status = new Map(i.coverage.items.map((x) => [x.skill.toLowerCase(), x.status]));
  const lines = i.cvText.split("\n").map((l) => l.trim()).filter(Boolean);
  const lineFor = (skill: string) => {
    const re = new RegExp(`(?<![\\w+#])${escapeRegex(skill)}(?![\\w+#])`, "i");
    return lines.find((l) => re.test(l)) ?? null;
  };
  const statusOf = (r: Requirement): CoverageStatus | undefined => {
    if (r.anyOf && r.anyOf.length > 1) {
      const group = i.coverage.items.find((c) => c.anyOf && c.anyOf.some((a) => r.anyOf!.some((b) => a.toLowerCase() === b.toLowerCase())));
      if (group) return group.status;
    }
    return r.skill ? status.get(r.skill.toLowerCase()) : undefined;
  };
  const rows: RequirementRow[] = i.requirements.map((r) => {
    const s = statusOf(r);
    let match: RequirementRow["match"] = s ? COVERAGE_TO_MATCH[s] : "partial";
    const names = r.anyOf?.length ? r.anyOf : r.skill ? [r.skill] : [];
    const evidence = match === "missing" ? null : names.map(lineFor).find(Boolean) ?? null;
    if (match === "strong" && !evidence) match = "partial";
    return { text: r.text, skill: r.skill, importance: r.importance, evidenceTier: r.evidenceTier, match, cvEvidence: match === "strong" ? evidence : null };
  });
  const matched = [...new Set(rows.filter((r) => r.match === "strong" && r.skill).map((r) => r.skill as string))];
  const whyFit = [
    ...(i.archetypeMatch ? ["This role matches the kind of work your profile points to."] : []),
    ...(matched.length ? [`Your CV already shows ${matched.slice(0, 3).join(", ")}.`] : []),
  ];
  // Non-skill requirements (right to work, degree, language, years) are listed as checks by finalizeExplanation, not gaps (10#13)
  const gaps = rows.filter((r) => r.match !== "strong" && !CHECK_KINDS.has(requirementKind(r))).map((r) => ({
    requirement: r.text,
    blocking: (r.importance === "critical" || r.importance === "high") && r.evidenceTier !== "inferred",
    adjacentExperience: null,
    howToClose: requirementKind(r) === "behaviour"
      ? "Keywords can't judge this one. Point to a line on your CV that shows it, such as a team project, society role or job, and describe what you did."
      : r.skill
        ? `Not shown in your CV. If you've used ${r.skill}, add a line that shows it; if not, a small project, module or course can close it.`
        : "Not shown in your CV yet. If you have done this, add a line that shows it in your own words.",
  }));
  return { rows, whyFit, gaps };
}


// ---------- tailorCV fallback (Task 23) ----------

/**
 * Deterministic tailoring: reorder bullets so the ones naming allowed skills come first, and list
 * `supported` skills (already in the CV's prose) in Skills. It never rewrites a bullet, so it can't fabricate.
 */
export function heuristicTailor(i: { cv: ParsedCV; allowed: string[]; supported: string[] }): TailoredCV {
  const t = toTailored(i.cv);
  const allowed = new Set(i.allowed.map((s) => s.toLowerCase()));
  const hits = (text: string) => extractSkills(text).filter((s) => allowed.has(s.toLowerCase()));
  const changes: TailorChange[] = [];
  const reorder = (es: TailoredEntry[]): TailoredEntry[] => es.map((e) => {
    const sorted = e.bullets.map((b, n) => ({ b, n, h: hits(b.text).length })).sort((a, b) => b.h - a.h || a.n - b.n);
    const bullets = sorted.map(({ b, n }, at) => (at === n ? b : { ...b, changeType: "reordered" as const }));
    const top = sorted[0];
    if (top && top.n !== 0) {
      const named = hits(top.b.text);
      changes.push({ bulletId: top.b.id, before: top.b.text, after: top.b.text, reason: `Moved up: it shows ${named.join(", ")}, which this role asks for`, jdRequirement: named[0] ?? null, keywordsAdded: [] });
    }
    return { ...e, bullets };
  });
  t.experience = reorder(t.experience); t.projects = reorder(t.projects); t.leadership = reorder(t.leadership);
  const listed = new Set(t.skills.flatMap((g) => g.items.flatMap((x) => [x.toLowerCase(), ...extractSkills(x).map((s) => s.toLowerCase())])));
  const surface = [...new Set(i.supported)].filter((s) => !listed.has(s.toLowerCase()));
  if (surface.length) {
    t.skills = t.skills.length ? t.skills.map((g, n) => (n === 0 ? { ...g, items: [...g.items, ...surface] } : g)) : [{ group: "Skills", items: surface }];
    changes.push({
      bulletId: "skills", before: "", after: surface.join(", "),
      reason: `Listed ${surface.join(", ")} in Skills: your CV already mentions ${surface.length > 1 ? "them" : "it"} elsewhere`,
      jdRequirement: surface[0], keywordsAdded: surface,
    });
  }
  t.changes = changes;
  return t;
}
