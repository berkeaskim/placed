export const OUTREACH_TARGETS = ["alumni", "recent_joiner", "team", "recruiter"] as const;
export type OutreachTarget = (typeof OUTREACH_TARGETS)[number];

const META: Record<OutreachTarget, { label: string; why: string }> = {
  alumni: { label: "UCL alumni at the firm", why: "You share a university, so they're the people most likely to reply." },
  recent_joiner: { label: "Joined in the last 1–2 years", why: "They went through this exact process recently and remember what mattered." },
  team: { label: "Someone in the team", why: "They can tell you what the work is really like day to day." },
  recruiter: { label: "Early careers recruiter", why: "Best for process questions: timelines, assessments and deadlines." },
};

/** Words that say what kind of programme it is, not which team: removed to leave the division. */
const PROGRAMME = new Set([
  "intern", "interns", "internship", "internships", "summer", "spring", "autumn", "winter", "insight", "week", "weeks",
  "analyst", "associate", "graduate", "grad", "programme", "program", "placement", "placements", "year", "industrial",
  "off", "cycle", "off-cycle", "early", "careers", "student", "students", "trainee", "junior", "entry", "level", "scheme",
  "london", "uk", "emea", "europe", "remote", "hybrid", "the", "and", "of", "in", "for", "with", "a", "an",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "werkstudent", "werkstudentin", "working", "volunteer", "fellowship", "fellows", "coordinator", "academy",
  "undergraduate", "experience", "apprentice", "apprenticeship", "penultimate", "degree",
]);

/** The team/division part of a job title ("Credit Analyst Intern (June 2027)" → "Credit"), or null if none is left. */
export function divisionKeyword(title: string): string | null {
  const words = title.replace(/\([^)]*\)/g, " ").split(/[\s,–—\-/|:]+/).filter(Boolean);
  const kept = words.filter((w) => !PROGRAMME.has(w.toLowerCase()) && !/^\d+$/.test(w));
  return kept.length ? kept.join(" ") : null;
}

const q = (company: string) => `"${company.replace(/"/g, "").replace(/\s+/g, " ").trim()}"`;

export function searchKeywords(target: OutreachTarget, company: string, title: string): string {
  const div = divisionKeyword(title);
  switch (target) {
    case "alumni": return `${q(company)} UCL`;
    case "team": return div ? `${q(company)} ${div}` : q(company);
    case "recruiter": return `${q(company)} ("early careers" OR "campus recruiter" OR "graduate recruitment")`;
    case "recent_joiner": return `${q(company)}${div ? ` ${div}` : ""} (graduate OR analyst)`;
  }
}

/** Search only: Placed never names people or reads profiles; the student sees whatever LinkedIn shows them. */
export function linkedinSearchUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export function peopleToReach(company: string, title: string) {
  return OUTREACH_TARGETS.map((key) => ({ key, ...META[key], url: linkedinSearchUrl(searchKeywords(key, company, title)) }));
}
