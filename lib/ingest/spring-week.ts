import type { JobForScoring, Year } from "@/lib/types";
import { placementType, type Region } from "./placement";

/**
 * Spring week / insight programme detection for UK first-year students.
 *
 * A title alone is not enough: PwC's first-year programmes are titled "Black Talent in Business – Audit", US firms post
 * "Intern – Spring 2027" semester roles, and "Insights" is also a job function. So the title and the posting body are
 * scored together. Signals and traps come from live employer feeds (research/spring-weeks/02-employer-ats.md).
 */

type EmploymentType = JobForScoring["employmentType"];

/** Unambiguous programme titles. One is enough on its own (the location filter already limits us to UK/Europe). */
const STRONG_TITLE = /\b(spring\s+(week|insights?|programme|program|into\s+\w+)|insights?\s+(programme|program|week|days?|event|evening|series|scheme)|first[- ]years?'?\s+(insight|programme|program|scheme|event|open\s+day|workshop)|early\s+insights?|taster\s+(day|days|week|programme|program))\b/i;
/** Programme-ish titles that need body support. */
const WEAK_TITLE = /\b(spring\s+(scheme|event|experience|workshop)|discover(y)?\s+(\w+\s+){0,2}(programme|program|day|days|week|series)|future\s*focus|pathfinder|immersion\s+(programme|program)|explore\s+\w+\s+(\w+\s+)?(programme|program))\b/i;
/** "Discover EY", "Discover Citadel": a capitalised employer name after Discover (case-sensitive on purpose). */
const DISCOVER_FIRM = /\bDiscover\s+[A-Z][\w&]*/;
/** Diversity programme families whose titles carry no spring keyword (PwC, Maven). */
const FAMILY_TITLE = /\b(black\s+talent\s+in\s+business|women\s+in\s+(business|trading|technology|tech|finance)|(advancing\s+)?social\s+mobility)\b/i;

/** Titles that are never a UK spring week: semester internships, tech stacks, place names, "Insights" job functions. */
const VETO_TITLE = /(spring\s*boot|spring\s+(framework|batch|mvc|cloud|security)|\bsprings\b|,\s*spring,?\s*tx|sinking\s+spring|(winter|fall|autumn|summer)\s*\/\s*spring|spring\s*\/\s*(summer|fall)|spring\s+(semester|term|quarter)|\bco-?op\b|\bsemester\b|off[- ]?cycle|fr[üu]hjahr|printemps|primavera|graduate\s+(programme|program|scheme)\s*[-–—]\s*spring|insights?\s+(lead|analyst|manager|director|specialist|engineer|platform|partner)|\b(analytics|data|client|business|market|competitive|commercial|product|consumer|customer|people|pricing|portfolio)\s*(&\s*|and\s+)?insights?\b|first[- ]year\s+(analyst|associate)|e-?discovery|drug\s+discovery|discovery\s+(engineer|team|technical|operations)|training\s+contract|talent\s+insight|graduate\s+insight|summer\s+analyst|summer\s+associate|summer\s+intern(ship)?s?\b|(one|1|two|2)[- ]year\s+internship|\d+[- ]month\s+internship|industrial\s+placement|\(m\/[fw]\/[dx]\))/i;

// Body signals for the 2026/27 cycle: spring 2027 targets the class of 2029.
const BODY_FIRST_YEAR = /(first[- ]year\s+(of\s+(a|an|your)\s+)?((three|3)[- ]year\s+|undergraduate\s+|university\s+)?(degree|course|study|students?|undergraduates?|of\s+university)|in\s+(your|their)\s+first\s+year|second\s+year\s+of\s+(a|an)\s+four[- ]year|1st[- ]year\s+(students?|undergraduates?)|graduat\w*(\s+date)?(\s*:)?\s*(in|between|by|of)?\s*([A-Za-z]+\s+)?2029|class\s+of\s+2029|2029\s+graduates?)/i;
const BODY_SHORT = /\b(one|two|three|four|five|1|2|3|4|5)[- ](day|week)s?\b|week[- ]long|insight\s+(day|week|event)/i;
const BODY_SPRING_DATES = /\b(march|april|easter)\b[^.]{0,20}2027|\b\d{1,2}(st|nd|rd|th)?\s*(-|–|to)\s*\d{1,2}(st|nd|rd|th)?\s+(march|april)\b/i;
const BODY_FAST_TRACK = /fast[- ]?track\w*[^.]{0,100}(2028|summer\s+(internship|analyst|programme))/i;
const BODY_NOT_FIRST_YEAR = /(penultimate[- ]year|final[- ]year\s+students?|graduat\w*\s+(in|by)\s+(2026|2027)\b|\b(9|10|nine|ten)[- ](to[- ](10|ten)[- ])?week|semester|co-?op\b|six[- ]month|6[- ]month)/i;

/** One-day formats (insight days, evenings, open days) are "insight"; multi-day first-year programmes are spring weeks. */
const ONE_DAY = /\b(day|evening|event|open\s+day)\b/i;

export const SPRING_WEEK_THRESHOLD = 4;

export type ProgrammeVerdict = {
  /** null: not a first-year programme (fall back to the ordinary title rules). */
  kind: "spring_week" | "insight" | null;
  score: number;
  /** The title is a known trap ("Spring Boot", "Intern – Spring 2027 co-op"): never a spring week whatever a tagger says. */
  vetoed: boolean;
};

function titleScore(title: string): number {
  if (STRONG_TITLE.test(title)) return 4;
  if (WEAK_TITLE.test(title) || DISCOVER_FIRM.test(title)) return 3;
  return 0;
}

/** True when the title names a first-year programme, even one the ordinary keyword list misses. */
export function isProgrammeTitle(title: string): boolean {
  if (VETO_TITLE.test(title)) return false;
  return titleScore(title) > 0 || FAMILY_TITLE.test(title);
}

export function classifySpringWeek(title: string, body = ""): ProgrammeVerdict {
  const vetoed = VETO_TITLE.test(title);
  if (vetoed) return { kind: null, score: -6, vetoed };
  const fromTitle = titleScore(title);
  const family = FAMILY_TITLE.test(title);
  // Body wording alone never makes a spring week: a "one year internship" can say "first year students" too.
  if (fromTitle === 0 && !family) return { kind: null, score: body && BODY_NOT_FIRST_YEAR.test(body) ? -6 : 0, vetoed };
  let score = fromTitle + (family ? 1 : 0);
  if (body) {
    const firstYear = BODY_FIRST_YEAR.test(body);
    if (firstYear) score += 3;
    if (BODY_SHORT.test(body)) score += 2;
    if (BODY_SPRING_DATES.test(body)) score += 1;
    if (BODY_FAST_TRACK.test(body)) score += 1;
    // "Penultimate year students" with no first-year wording rules a spring week out; alongside it ("first or
    // penultimate year") it only weakens the case.
    if (BODY_NOT_FIRST_YEAR.test(body)) score -= firstYear ? 3 : 6;
  }
  if (score >= SPRING_WEEK_THRESHOLD) {
    const oneDay = ONE_DAY.test(title) && !/\bspring\b/i.test(title);
    return { kind: oneDay ? "insight" : "spring_week", score, vetoed };
  }
  // A programme title whose body points elsewhere (e.g. a penultimate-year insight programme) is still an insight event.
  return { kind: fromTitle > 0 ? "insight" : null, score, vetoed };
}

/** Title rules for everything that is not a first-year programme. */
export function baseEmploymentType(title: string): EmploymentType {
  const t = title.toLowerCase();
  // Placements are decided by lib/ingest/placement.ts (duration, vetoes); a bare "placement" word is not enough.
  if (/(?<!under)graduate/.test(t)) return "graduate"; // "Undergraduate Summer Internship" is not a graduate role
  if (/\bintern|internship|summer (analyst|associate|programme|program|scheme|student)|off[- ]?cycle|working student|werkstudent|vacation scheme|co-op|externship/.test(t)) return "internship";
  return "other";
}

type Tagged = { employmentType: EmploymentType; yearEligibility: Year[]; firstYearFriendly: boolean };

/**
 * Applied to every tagger result (LLM or heuristic) so programme typing is deterministic: the classifier promotes
 * spring weeks a tagger missed and demotes trap titles a tagger fell for. A curated card's kind always wins.
 */
export function reconcileProgramme<T extends Tagged>(t: T, title: string, body: string, curatedType?: EmploymentType | null, region: Region = "uk"): T {
  let type = t.employmentType;
  if (curatedType) {
    type = curatedType;
  } else {
    const v = classifySpringWeek(title, body);
    const p = v.kind === "spring_week" ? null : placementType(title, body, region);
    if (v.kind === "spring_week") type = "spring_week";
    // The placement classifier is sure (a 12-month placement, or a "placement" that is really a working-student job,
    // an insurance broker or a graduate role): it wins over the tagger. Without a verdict the tagger stands.
    else if (p && (p === "placement" || type === "placement")) type = p;
    // Demote trap titles, and a tagger's spring week whose body says otherwise. An insight event the tagger found is
    // kept even with penultimate wording: it is still an insight event, just not a first-year one.
    else if ((type === "spring_week" || type === "insight") && v.vetoed) type = baseEmploymentType(title);
    else if (type === "spring_week" && v.score < 0) type = v.kind ?? baseEmploymentType(title);
  }
  if (type === "placement") {
    // Taggers call the year before a placement "penultimate"; on a sandwich degree that is the 2nd year too.
    const years = new Set<Year>(t.yearEligibility);
    if (years.size === 0 || years.has("penultimate") || years.has("2nd")) { years.add("2nd"); years.add("penultimate"); }
    return { ...t, employmentType: type, yearEligibility: [...years] };
  }
  if (type !== "spring_week") return type === t.employmentType ? t : { ...t, employmentType: type };
  return {
    ...t,
    employmentType: type,
    firstYearFriendly: true,
    yearEligibility: t.yearEligibility.length ? t.yearEligibility : (["1st", "2nd"] as Year[]),
  };
}
