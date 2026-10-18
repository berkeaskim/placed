import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import { LI_SECTOR_IMPORTANCE, checkableFromPdf, liEffectiveSeverity, liRulesFor, presenceTip, type LiInputSource, type LiResolvedRule, type Severity } from "@/lib/linkedin-rules";
import { redactCv } from "@/lib/cv/redact";
import { renderCvContent, stripPii } from "@/lib/cv-score/pii";
import { isJudged, type LiJudgeInput, type LiJudgeResult } from "@/lib/ai/judgeLinkedIn";
import { runLiCodeChecks } from "./checkers";
import { crossCheckDates, mismatchedOrgs } from "./cross-check";
import { CODE_DETAIL, aggregateLiScore, type LiScore } from "./aggregate";
import { FINFLUENCER_PROMO_RE } from "./detectors";
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
  if (li.projects.length) {
    out.push("PROJECTS");
    for (const p of li.projects) {
      out.push(`- ${[p.title, p.dates].filter(Boolean).join(" | ")}`);
      if (p.description) out.push(...p.description.split("\n").map((l) => `  ${l}`));
    }
  }
  if (li.skillsScope === "none") out.push("SKILLS", "(not visible from this input: treat rules about the skills list as not_applicable)");
  else if (li.skillsScope === "all") out.push("SKILLS (full list)", `${li.topSkills.join(", ") || "(none)"} (LinkedIn's order is not known to show which skills the student puts first: do not judge which are 'top')`);
  else if (li.warnings.includes("skills_partial")) out.push("TOP SKILLS", `${li.topSkills.join(", ")} (only the first few were read: do not judge how many skills there are)`);
  else out.push("TOP SKILLS (the ~3 the export shows; not the full list)", li.topSkills.length ? li.topSkills.join(", ") : "(none)");
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
 * pdfContested rules read sections the PDF export may not carry (full skills list, Projects, Volunteering). Until
 * real exports confirm them, they are not judged from the PDF (08 #29).
 */
const contestedHere = (r: LiResolvedRule, source: LiInputSource) => r.pdfContested === true && source === "pdf";

/**
 * Score one parsed export for one sector. Pure apart from the injected judge, so tests run without AI.
 * Order: code checks → judge (llm + hybrid) → deterministic CV date cross-check overrides LI-GEN-01 on a mismatch.
 */
export async function scoreLinkedIn(i: {
  li: ParsedLinkedIn; rawText: string; cv: ParsedCV | null; sector: Archetype; year: Year; today: Date;
  judge: (input: LiJudgeInput) => Promise<LiJudgeResult>; fixtureKey?: string; source?: LiInputSource;
}): Promise<LiScoreResult> {
  const source = i.source ?? "pdf";
  const rules: LiResolvedRule[] = liRulesFor(i.sector);
  const ctx: LiContext = { li: i.li, text: i.rawText, cv: i.cv, sector: i.sector, year: i.year, today: i.today, source };

  const readable = (r: LiResolvedRule) => checkableFromPdf(r) && !contestedHere(r, source);
  const code = runLiCodeChecks(rules.filter(readable), ctx);
  const uncovered: ScoredRuleResult[] = rules
    .filter((r) => !r.advisory && !readable(r))
    .map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null, detail: contestedHere(r, source) ? "input:pdf_contested" : `input:${r.input}` }));

  const opts = { knownName: i.li.name ?? i.cv?.name ?? undefined, knownEmail: i.li.email ?? i.cv?.email ?? undefined };
  const redactedText = redactCv(i.rawText, opts).redacted;
  const judge = await i.judge({
    redactedText,
    structuredText: redactCv(renderLinkedIn(i.li), opts).redacted,
    cvText: i.cv ? redactCv(renderCvContent(stripPii(i.cv)), opts).redacted : null,
    rules: rules.filter((r) => isJudged(r) && readable(r)),
    sector: i.sector, year: i.year, source,
    fixtureKey: i.fixtureKey,
  });
  let llm = judge.results;
  const severityOverrides: Partial<Record<string, Severity>> = {};
  /** Deterministic results replace the judge's verdict for the same rule. */
  const override = (hit: ScoredRuleResult) => (llm.some((r) => r.ruleId === hit.ruleId) ? llm.map((r) => (r.ruleId === hit.ruleId ? hit : r)) : [...llm, hit]);
  if (!i.cv) {
    llm = llm.map((r) => (CV_RULES.has(r.ruleId) ? { ruleId: r.ruleId, status: "not_applicable", evidenceLine: null, fix: null, detail: "no CV on file" } : r));
  } else {
    const mism = crossCheckDates(i.cv, i.li.experience);
    const gen01 = rules.find((r) => r.id === "LI-GEN-01");
    if (mism.length && gen01) {
      const m = mism[0];
      const orgs = mismatchedOrgs(mism);
      // One organisation's dates alone are a "check this", not a critical contradiction (08 #1).
      const fix = orgs >= 2
        ? `Your CV and LinkedIn give different dates for ${orgs} organisations, e.g. ${m.company}: CV ${m.cv}, LinkedIn ${m.linkedin}. Which is right? Make both match.`
        : `Check this: your CV says ${m.cv} for ${m.company}; LinkedIn says ${m.linkedin}. If both are right (a promotion, or roles LinkedIn lists separately), you can ignore this. Otherwise make them match.`;
      llm = override({ ruleId: "LI-GEN-01", status: "fail", evidenceLine: m.evidenceLine, fix, detail: `${CODE_DETAIL} ${mism.length} date mismatch(es) at ${orgs} organisation(s)` });
      if (orgs < 2 && liEffectiveSeverity(gen01, i.sector, i.year) === "critical") severityOverrides["LI-GEN-01"] = "major";
    }
  }

  // Affiliate/referral links, paid signals or paid groups invite others to invest: the one finfluencer case that stays critical (08 #14).
  if (rules.some((r) => r.id === "LI-FINANCE_BANKING-06")) {
    const promo = [i.li.headline ?? "", i.li.about ?? "", ...i.li.experience.map((e) => `${e.title}\n${e.description}`)].join("\n").split("\n").find((l) => FINFLUENCER_PROMO_RE.test(l));
    if (promo) {
      llm = override({ ruleId: "LI-FINANCE_BANKING-06", status: "fail", evidenceLine: promo.trim(), fix: "Remove referral links, signal offers and group invites from your profile. A recruiting profile shouldn't invite people to invest or trade.", detail: `${CODE_DETAIL} investment promotion` });
      severityOverrides["LI-FINANCE_BANKING-06"] = "critical";
    }
  }

  const score = aggregateLiScore({ rules, results: [...code, ...llm, ...uncovered], sector: i.sector, year: i.year, facts: { nearlyEmpty: isNearlyEmpty(i.li), severityOverrides } });
  return {
    ...score,
    importance: LI_SECTOR_IMPORTANCE[i.sector],
    tips: rules.filter((r) => r.advisory && !r.yearAdjust?.[i.year]?.skip).map((r) => ({ ruleId: r.id, statement: presenceTip(r) })),
    aiUnavailable: judge.aiUnavailable === true,
    parseWarnings: i.li.warnings,
  };
}
