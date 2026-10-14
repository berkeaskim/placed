/**
 * "Score after tailoring" (amendments Task 23 Screen): rules gained per dimension from the deterministic
 * content checks only, run on the original and on the student's version with the same text builder, so only
 * the edited content can flip a rule. Never a single before→after LLM number. Pure; server-side caller.
 */
import type { Archetype, ParsedCV, TailoredCV, Year } from "@/lib/types";
import type { CheckerId } from "@/lib/cv-rules/types";
import { rulesFor } from "@/lib/cv-rules";
import { runCodeChecks } from "@/lib/cv-score/checkers";
import { renderView } from "./run";
import { rulesGainedByDimension, type RuleCheck, type RulesGained } from "./view";

/** Checks that read bullets, skills or the summary: the parts tailoring can change. File/page/contact checks can't move. */
const CONTENT_CHECKERS = new Set<CheckerId>([
  "quantified_bullets", "we_vs_i", "bullet_length", "leadership_lexicon", "skills_evidenced", "cliche_density",
  "skills_count", "project_stack", "summary_length", "outdated_tools", "skill_rating_glyphs",
]);

function textOf(cv: ParsedCV): string {
  const entries = [...cv.experience, ...cv.projects, ...cv.leadership];
  return [
    cv.summary ?? "",
    ...entries.flatMap((e) => [`${e.title} ${e.org}`, ...e.bullets.map((b) => b.text)]),
    cv.skills.map((g) => `${g.group}: ${g.items.join(", ")}`).join("\n"),
  ].join("\n");
}

export function contentRuleChecks(cv: ParsedCV, sector: Archetype, year: Year): RuleCheck[] {
  const rules = rulesFor(sector).filter((r) => r.check === "code" && r.checker && CONTENT_CHECKERS.has(r.checker));
  const text = textOf(cv);
  const dim = new Map(rules.map((r) => [r.id, r.dimension]));
  return runCodeChecks(rules, { text, pageTexts: [text], pageCount: 1, fileSize: 0, cv, year, spellingErrors: null })
    .filter((r) => r.status !== "not_applicable")
    .map((r) => ({ ruleId: r.ruleId, dimension: dim.get(r.ruleId)!, passed: r.status === "pass" }));
}

/** The student's tailored version as a ParsedCV (dropped lines out, unresolved NEEDS_NUMBER lines at their original wording). */
export function tailoredAsParsed(t: TailoredCV, cv: ParsedCV): ParsedCV {
  const v = renderView(t, cv);
  const entries = (es: TailoredCV["experience"]) => es.map((e) => ({ ...e, bullets: e.bullets.map((b) => ({ id: b.id, text: b.text })) }));
  return { ...cv, summary: v.summary, experience: entries(v.experience), projects: entries(v.projects), leadership: entries(v.leadership), skills: v.skills };
}

export function rulesGained(cv: ParsedCV, t: TailoredCV, sector: Archetype, year: Year): RulesGained {
  return rulesGainedByDimension(contentRuleChecks(cv, sector, year), contentRuleChecks(tailoredAsParsed(t, cv), sector, year));
}
