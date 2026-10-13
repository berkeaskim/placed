import type { JobForScoring, Region } from "@/lib/types";
import { escapeRegex } from "@/lib/text/regex";

export const TITLE_POSITIVE = [
  "word:intern", "Internship", "Interns", "Vacation Scheme", "Summer Programme", "Summer Program",
  "Summer Scheme", "Summer Student", "Undergraduate", "Placement", "Industrial Placement", "Sandwich Year",
  "Year in Industry", "Summer Analyst", "Summer Associate", "Off-Cycle", "Offcycle", "Off Cycle",
  "Working Student", "Werkstudent", "Spring Week", "Spring Insight", "Insight Programme", "Insight Program",
  "Insight Week", "Insight Day", "Discovery Day", "Discovery Programme", "Taster", "Penultimate",
  "Graduate Scheme", "Graduate Programme", "Graduate Program", "Early Careers", "Early Career",
  "Early Talent", "Emerging Talent", "Analyst Programme", "Analyst Program", "Apprentice", "Apprenticeship",
  "Fellowship", "Fellows Program", "Fellows Programme", "Residency", "Co-Op", "Externship",
];

export const TITLE_NEGATIVE = [
  "Senior", "Staff Engineer", "Staff Software", "Staff Product", "Staff Data", "Staff Designer",
  "Staff Research", "Staff Scientist", "Staff Machine Learning", "Principal", "Tech Lead", "Team Lead",
  "Lead Engineer", "Lead Developer", "Lead Designer", "Lead Analyst", "Lead Data", "Lead Product",
  "Lead Software", "Director", "Head of", "VP ", "Vice President", "Chief ", "Managing Partner",
  "Years of Experience", "Sales Representative", "Account Executive", "Recruiter", "Recruitment Consultant",
  "Training Contract", "Talent Acquisition", "Nurse", "Teacher", "Driver", "Warehouse", "Customer Care",
  "Customer Support", "Call Center", "Call Centre",
];

const COHORT_CLASH = [/winter 20\d\d/i, /\(winter/i];

export function matchKeyword(title: string, kw: string): boolean {
  const t = title.toLowerCase();
  if (kw.startsWith("word:")) return new RegExp(`\\b${escapeRegex(kw.slice(5).toLowerCase())}\\b`).test(t);
  if (kw.startsWith("stem:")) return new RegExp(`\\b${escapeRegex(kw.slice(5).toLowerCase())}`).test(t);
  if (/^[A-Za-z]{2,3}$/.test(kw)) return new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`).test(t);
  return t.includes(kw.toLowerCase());
}

export function passesTitleFilter(title: string): boolean {
  const pos = TITLE_POSITIVE.some((k) => matchKeyword(title, k));
  const neg = TITLE_NEGATIVE.some((k) => matchKeyword(title, k));
  return pos && !neg;
}

export function detectCohortClash(title: string): boolean {
  return COHORT_CLASH.some((r) => r.test(title));
}

const LONDON = /\blondon\b/i;
const UK = /\b(united kingdom|uk|england|gbr|great britain|scotland|wales|northern ireland|manchester|birmingham|edinburgh|glasgow|bristol|leeds|cambridge|oxford|belfast|cardiff|reading|milton keynes)\b/i;
const EUROPE = /\b(europe|emea|eu|amsterdam|dublin|ireland|paris|france|berlin|munich|frankfurt|hamburg|germany|zurich|geneva|switzerland|madrid|barcelona|spain|milan|italy|stockholm|sweden|copenhagen|denmark|warsaw|poland|lisbon|portugal|brussels|belgium|netherlands|vienna|austria|oslo|helsinki|prague|istanbul|t[uü]rkiye|turkey)\b/i;
const REMOTE = /\b(remote|anywhere|distributed)\b/i;
const BLOCK = /\b(united states|usa|u\.s\.|new york|ny|san francisco|ca|chicago|boston|seattle|austin|los angeles|denver|miami|toronto|canada|vancouver|india|bangalore|bengaluru|hyderabad|mumbai|singapore|hong kong|sydney|melbourne|tokyo|shanghai|beijing|s[aã]o paulo|mexico)\b/i;

export function classifyRegion(location: string, remote: boolean): Region {
  if (LONDON.test(location)) return "london";
  if (UK.test(location)) return "uk";
  if (EUROPE.test(location)) return "europe";
  if (remote || REMOTE.test(location)) return "remote";
  return "other";
}

const EXCLUSIONARY = [
  "must be located in the united states", "us-based candidates only", "authorized to work in the us without sponsorship",
  "authorised to work in the us without sponsorship", "must be based in the us", "us residents only",
];
const INCLUSIVE = ["united kingdom", "uk-based", "london", "europe", "emea", "visa sponsorship available", "we sponsor"];

export function passesLocationFilter(location: string, remote: boolean, jdText: string): { pass: boolean; reason?: string } {
  const text = jdText.toLowerCase();
  const usOnly = EXCLUSIONARY.some((p) => text.includes(p)) && !INCLUSIVE.some((p) => text.includes(p));
  if (!location.trim()) return usOnly ? { pass: false, reason: "US work authorisation required" } : { pass: true };
  if (LONDON.test(location) || /united kingdom/i.test(location)) return { pass: true };
  if (usOnly) return { pass: false, reason: "US work authorisation required" };
  const region = classifyRegion(location, remote);
  if (region !== "other") return { pass: true };
  if (BLOCK.test(location)) return { pass: false, reason: `Location outside UK/Europe: ${location}` };
  return { pass: false, reason: `Location not in UK/Europe/remote: ${location}` };
}

const NO_SPONSOR = /(we (do not|don'?t|cannot|can'?t) (offer |provide )?(visa )?sponsor|unable to (provide |offer )?(visa )?sponsor|no (visa )?sponsorship|not able to sponsor)/i;
const YES_SPONSOR = /(visa sponsorship (is )?available|we (can |will |do )?sponsor|sponsorship (is )?(available|provided|offered))/i;

export function detectSponsorship(jdText: string): "yes" | "no" | "unknown" {
  if (NO_SPONSOR.test(jdText)) return "no";
  if (YES_SPONSOR.test(jdText)) return "yes";
  return "unknown";
}

export function detectEmploymentType(title: string): JobForScoring["employmentType"] {
  const t = title.toLowerCase();
  if (/spring (week|insight)/.test(t)) return "spring_week";
  if (/insight|discovery|taster/.test(t)) return "insight";
  if (/placement|sandwich|year in industry/.test(t)) return "placement";
  if (/graduate/.test(t)) return "graduate";
  if (/\bintern|internship|summer (analyst|associate|programme|program|scheme|student)|off[- ]?cycle|working student|werkstudent|vacation scheme|co-op|externship/.test(t)) return "internship";
  return "other";
}
