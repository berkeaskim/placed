/**
 * Employers that ban AI during interviews or assessments. Interview prep for them is coach-only: the same practice,
 * with a stronger notice up front. Pure.
 */
import { employerAiPolicy } from "@/lib/employer-policy";

/**
 * Employers the research found banning AI during interviews or assessments, beyond lib/employer-policy's curated table
 * (Goldman Sachs, McKinsey, Bain). Re-check every September with the other cycle data.
 */
export const INTERVIEW_AI_BANS: { employer: string; aliases: string[]; source: string }[] = [
  { employer: "Barclays", aliases: ["barclays"], source: "research/spring-weeks/05-application-content.md §2 (Barclays bans third-party AI tools in interviews)" },
  { employer: "Bank of England", aliases: ["bank of england"], source: "research/placement-year/05-application-content.md §4c (no AI during interviews or group exercises)" },
];

/** Whether the employer bans AI during interviews or assessments (curated policy, the advert, or the research list). */
export function bansAiInInterviews(company: string, jdText: string): boolean {
  const p = employerAiPolicy({ company, jdText });
  if (p.entry?.assessments === "not_permitted" || p.policy === "banned_in_assessments" || p.policy === "not_permitted") return true;
  const c = company.toLowerCase().trim();
  return INTERVIEW_AI_BANS.some((b) => b.aliases.some((a) => c === a || c.startsWith(`${a} `) || c.includes(` ${a}`)));
}

/** The coach-only notice for an employer that bans AI in interviews and assessments. */
export const coachOnlyNotice = (company: string) =>
  `${company} doesn't allow AI tools during its interviews and assessments. Use this to practise beforehand only, in your own words, and never have Placed or any AI open during the real video interview, test or assessment centre.`;
