import { ARCHETYPES, type Archetype, type ArchetypeScore, type Requirement, type Year } from "@/lib/types";
import { tagSections } from "@/lib/text/jd";
import { detectEmploymentType, detectSponsorship } from "@/lib/ingest/filter";
import { extractSkills } from "@/lib/skills/extract";
import type { TaggedJob } from "./tagJob";

const KEYWORDS: Record<Archetype, RegExp> = {
  software_eng: /\b(software|engineer(ing)?|developer|backend|frontend|full[- ]stack|swe|devops|mobile)\b/gi,
  data_analytics: /\b(data|analytics|business intelligence|bi analyst|data scien\w*|machine learning)\b/gi,
  quant_trading: /\b(quant\w*|trading|trader|systematic|market making|algorithmic)\b/gi,
  consulting: /\b(consult\w*|advisory|strategy|transformation)\b/gi,
  product: /\b(product (manager|management|intern|analyst)|apm|product)\b/gi,
  finance_banking: /\b(investment banking|banking|markets|m&a|asset management|equity research|summer analyst|corporate finance|private equity|finance)\b/gi,
  marketing_growth: /\b(marketing|growth|brand|content|social media|communications|seo)\b/gi,
  research: /\b(research(er)?|scientist|phd|laborator\w*|publication)\b/gi,
};

export function archetypeScores(text: string, title = ""): ArchetypeScore[] {
  const raw = ARCHETYPES.map((key) => {
    const t = (title.match(KEYWORDS[key]) ?? []).length * 3;
    const b = (text.match(KEYWORDS[key]) ?? []).length;
    return { key, raw: t + b };
  });
  const max = Math.max(1, ...raw.map((r) => r.raw));
  return raw
    .map((r) => ({ key: r.key, score: Math.round((r.raw / max) * 100), why: r.raw > 0 ? [`Matches ${r.key.replace("_", " ")} keywords`] : [] }))
    .sort((a, b) => b.score - a.score);
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const DEADLINE = new RegExp(`(deadline|closing date|applications? close[sd]?|apply by)[^0-9]{0,25}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\w*\\s+(20\\d\\d)`, "i");

function parseDeadline(text: string): string | null {
  const m = DEADLINE.exec(text);
  if (!m) return null;
  const d = new Date(`${m[2]} ${m[3]} ${m[4]} 12:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function yearsFrom(text: string, employmentType: TaggedJob["employmentType"]): Year[] {
  const t = text.toLowerCase();
  const out = new Set<Year>();
  if (/penultimate/.test(t)) { out.add("penultimate"); out.add("2nd"); }
  if (/final[- ]year|graduating in 202[6-8]|recent graduate/.test(t)) { out.add("final"); out.add("masters"); }
  if (/first[- ]year|1st[- ]year/.test(t)) out.add("1st");
  if (/second[- ]year|2nd[- ]year/.test(t)) out.add("2nd");
  if (out.size === 0 && (employmentType === "spring_week" || employmentType === "insight")) { out.add("1st"); out.add("2nd"); }
  if (out.size === 0 && employmentType === "graduate") { out.add("final"); out.add("masters"); }
  return [...out];
}

export function heuristicTagJob(input: { title: string; textLines: string[] }): TaggedJob {
  const text = input.textLines.join("\n");
  const employmentType = detectEmploymentType(input.title);
  const seen = new Set<string>();
  const requirements: Requirement[] = [];
  for (const line of tagSections(input.textLines)) {
    if (line.isHeader || line.section === "other") continue;
    for (const skill of extractSkills(line.text)) {
      if (seen.has(skill)) continue;
      seen.add(skill);
      requirements.push({
        text: line.text.replace(/^- /, ""),
        skill,
        importance: line.section === "must" ? "high" : "preferred",
        section: line.section,
        evidenceTier: "structural",
      });
    }
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
