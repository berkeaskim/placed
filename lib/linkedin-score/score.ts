import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import { LI_SECTOR_IMPORTANCE, checkableFromPdf, liRulesFor, type LiResolvedRule } from "@/lib/linkedin-rules";
import { redactCv } from "@/lib/cv/redact";
import { renderCvContent, stripPii } from "@/lib/cv-score/pii";
import { isJudged, type LiJudgeInput, type LiJudgeResult } from "@/lib/ai/judgeLinkedIn";
import { runLiCodeChecks } from "./checkers";
import { crossCheckDates } from "./cross-check";
import { aggregateLiScore, type LiScore } from "./aggregate";
import type { LiContext, ScoredRuleResult } from "./context";

export type PresenceTip = { ruleId: string; statement: string };
export type LiScoreResult = LiScore & {
  importance: (typeof LI_SECTOR_IMPORTANCE)[Archetype];
  /** Advisory rules: shown on the "These don't affect your score" card. */
  tips: PresenceTip[];
  aiUnavailable: boolean;
  parseWarnings: string[];
};

/** Section-by-section rendering of the parsed export for the judge (redacted before use). */
export function renderLinkedIn(li: ParsedLinkedIn): string {
  const out = ["LINKEDIN PROFILE", "HEADLINE", li.headline ?? "(none)", "LOCATION", li.location ?? "(none)", "ABOUT", li.about ?? "(none)", "EXPERIENCE"];
  if (!li.experience.length) out.push("(none)");
  for (const e of li.experience) {
    out.push(`- ${[e.title, e.company, e.dates].filter(Boolean).join(" | ")}`);
    if (e.description) out.push(...e.description.split("\n").map((l) => `  ${l}`));
  }
  out.push("EDUCATION");
  if (!li.education.length) out.push("(none)");
  for (const e of li.education) {
    out.push(`- ${[e.school, e.degree, e.startYear && e.endYear ? `${e.startYear}-${e.endYear}` : e.endYear ?? ""].filter(Boolean).join(" | ")}`);
    if (e.details) out.push(...e.details.split("\n").map((l) => `  ${l}`));
  }
  const list = (h: string, xs: string[]) => out.push(h, xs.length ? xs.join(", ") : "(none)");
  if (li.warnings.includes("public_view_no_skills")) out.push("TOP SKILLS", "(not visible on the public profile: treat rules about the skills list as not_applicable)");
  else if (li.warnings.includes("skills_partial")) out.push("TOP SKILLS", `${li.topSkills.join(", ")} (only the first few were read: do not judge how many skills there are)`);
  else list("TOP SKILLS", li.topSkills);
  list("CERTIFICATIONS", li.certifications);
  list("HONORS-AWARDS", li.honors);
  list("PUBLICATIONS", li.publications);
  list("LANGUAGES", li.languages);
  out.push("LINKS", li.links.length ? li.links.map((l) => `[link: ${l.match(/github|gitlab|kaggle|tableau|orcid|scholar|behance/i)?.[0].toLowerCase() ?? "personal website"}]`).join(", ") : "(none)");
  return out.join("\n");
}

/** Playbook §3.4: no About, no Experience description of 15+ words, and a headline that is just "Student at …". */
export function isNearlyEmpty(li: ParsedLinkedIn): boolean {
  const longDesc = li.experience.some((e) => e.description.split(/\s+/).filter(Boolean).length >= 15);
  return !li.about?.trim() && !longDesc && (!li.headline || /^student at\b/i.test(li.headline.trim()));
}

const CV_RULES = new Set(["LI-GEN-01", "LI-GEN-04"]);

/**
 * Score one parsed export for one sector. Pure apart from the injected judge, so tests run without AI.
 * Order: code checks → judge (llm + hybrid) → deterministic CV date cross-check overrides LI-GEN-01 on a mismatch.
 */
export async function scoreLinkedIn(i: {
  li: ParsedLinkedIn; rawText: string; cv: ParsedCV | null; sector: Archetype; year: Year; today: Date;
  judge: (input: LiJudgeInput) => Promise<LiJudgeResult>; fixtureKey?: string;
}): Promise<LiScoreResult> {
  const rules: LiResolvedRule[] = liRulesFor(i.sector);
  const ctx: LiContext = { li: i.li, text: i.rawText, cv: i.cv, sector: i.sector, year: i.year, today: i.today };

  const code = runLiCodeChecks(rules.filter((r) => checkableFromPdf(r)), ctx);
  const uncovered: ScoredRuleResult[] = rules
    .filter((r) => !r.advisory && !checkableFromPdf(r))
    .map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null, detail: `input:${r.input}` }));

  const opts = { knownName: i.li.name ?? i.cv?.name ?? undefined, knownEmail: i.li.email ?? i.cv?.email ?? undefined };
  const redactedText = redactCv(i.rawText, opts).redacted;
  const judge = await i.judge({
    redactedText,
    structuredText: redactCv(renderLinkedIn(i.li), opts).redacted,
    cvText: i.cv ? redactCv(renderCvContent(stripPii(i.cv)), opts).redacted : null,
    rules: rules.filter(isJudged),
    fixtureKey: i.fixtureKey,
  });

  let llm = judge.results;
  if (!i.cv) {
    llm = llm.map((r) => (CV_RULES.has(r.ruleId) ? { ruleId: r.ruleId, status: "not_applicable", evidenceLine: null, fix: null, detail: "no CV on file" } : r));
  } else {
    const mism = crossCheckDates(i.cv, i.li.experience);
    if (mism.length) {
      const m = mism[0];
      const fix = `Your CV says ${m.cv} for ${m.company}; LinkedIn says ${m.linkedin}. Which is right? Make both match.`;
      const hit: ScoredRuleResult = { ruleId: "LI-GEN-01", status: "fail", evidenceLine: m.evidenceLine, fix, detail: `${mism.length} date mismatch(es)` };
      llm = llm.some((r) => r.ruleId === "LI-GEN-01") ? llm.map((r) => (r.ruleId === "LI-GEN-01" ? hit : r)) : [...llm, hit];
    }
  }

  const score = aggregateLiScore({ rules, results: [...code, ...llm, ...uncovered], sector: i.sector, year: i.year, facts: { nearlyEmpty: isNearlyEmpty(i.li) } });
  return {
    ...score,
    importance: LI_SECTOR_IMPORTANCE[i.sector],
    tips: rules.filter((r) => r.advisory && !r.yearAdjust?.[i.year]?.skip).map((r) => ({ ruleId: r.id, statement: r.statement.replace(/^Advisory \(weight 0\):\s*/i, "") })),
    aiUnavailable: judge.aiUnavailable === true,
    parseWarnings: i.li.warnings,
  };
}
