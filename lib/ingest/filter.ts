import type { JobForScoring, Region } from "@/lib/types";
import { escapeRegex } from "@/lib/text/regex";
import { baseEmploymentType, classifySpringWeek, isProgrammeTitle } from "./spring-week";

export const TITLE_POSITIVE = [
  "word:intern", "Internship", "Interns", "Vacation Scheme", "Summer Programme", "Summer Program",
  "Summer Scheme", "Summer Student", "Undergraduate", "stem:placement", "Industrial Placement", "Sandwich Year",
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
  // Staff who run early-careers programmes, not the programmes themselves.
  "Programme Coordinator", "Program Coordinator", "Talent Delivery",
  // Insurance-broking "placement" (placing policies), not student placements.
  "Placement Specialist", "Placement Broker", "Courtier",
];

const COHORT_CLASH = [/winter 20\d\d/i, /\(winter/i];

export function matchKeyword(title: string, kw: string): boolean {
  const t = title.toLowerCase();
  if (kw.startsWith("word:")) return new RegExp(`\\b${escapeRegex(kw.slice(5).toLowerCase())}\\b`).test(t);
  if (kw.startsWith("stem:")) return new RegExp(`\\b${escapeRegex(kw.slice(5).toLowerCase())}`).test(t);
  if (/^[A-Za-z]{2,3}$/.test(kw)) return new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`).test(t);
  return t.includes(kw.toLowerCase());
}

/** Experienced grades ("Analyst II", "Software Engineer III"); a bare numeral ("Intern II", "Phase II") is fine. */
const EXPERIENCED_GRADE = /\b(analyst|associate|engineer|developer|scientist|consultant|specialist|accountant|manager|designer|researcher)\s+(ii|iii|iv)\b/i;

export function passesTitleFilter(title: string): boolean {
  // isProgrammeTitle: first-year programmes with no keyword ("Black Talent in Business – Audit", "FutureFocus", "Discover EY").
  const pos = TITLE_POSITIVE.some((k) => matchKeyword(title, k)) || isProgrammeTitle(title);
  const neg = TITLE_NEGATIVE.some((k) => matchKeyword(title, k)) || EXPERIENCED_GRADE.test(title);
  return pos && !neg;
}

export function detectCohortClash(title: string): boolean {
  return COHORT_CLASH.some((r) => r.test(title));
}

const LONDON = /\blondon\b/i;
const UK = /\b(united kingdom|uk|england|gbr|great britain|scotland|wales|northern ireland|manchester|birmingham|edinburgh|glasgow|bristol|leeds|cambridge|oxford|belfast|cardiff|reading|milton keynes|sheffield|newcastle|liverpool|nottingham|southampton|coventry|leicester|bath|exeter|aberdeen|dundee|swansea|warwick|guildford|hatfield|stevenage|slough|swindon|derby|northampton|knutsford|hertfordshire|surrey|berkshire)\b/i;
// Country-level UK terms: unlike a city name ("Cambridge, MA", "Newcastle, NSW"), these never need a BLOCK check.
const UK_COUNTRY = /\b(united kingdom|uk|england|gbr|great britain|scotland|wales|northern ireland)\b/i;
const EUROPE = /\b(europe|emea|eu|amsterdam|dublin|ireland|paris|france|berlin|munich|frankfurt|hamburg|germany|zurich|geneva|switzerland|madrid|barcelona|spain|milan|italy|stockholm|sweden|copenhagen|denmark|warsaw|poland|lisbon|portugal|brussels|belgium|netherlands|vienna|austria|oslo|helsinki|prague|istanbul|t[uü]rkiye|turkey|luxembourg|norway|finland|czechia|czech republic|greece|athens|romania|bucharest|hungary|budapest|estonia|tallinn|latvia|riga|lithuania|vilnius|croatia|zagreb|slovakia|bratislava|slovenia|bulgaria|sofia|serbia|belgrade|cyprus|malta|iceland)\b/i;
const REMOTE = /\b(remote|anywhere|distributed)\b/i;
const BLOCK = /\b(united states|usa|u\.s\.|new york|ny|san francisco|ca|chicago|boston|seattle|austin|los angeles|denver|miami|toronto|canada|vancouver|india|bangalore|bengaluru|hyderabad|mumbai|singapore|hong kong|sydney|melbourne|tokyo|shanghai|beijing|s[aã]o paulo|mexico|australia|japan|china|korea|seoul|taiwan|taipei|indonesia|jakarta|malaysia|kuala lumpur|philippines|manila|vietnam|thailand|bangkok|pakistan|brazil|argentina|chile|colombia|south africa|johannesburg|nigeria|kenya|egypt|cairo|uae|dubai|abu dhabi|saudi|riyadh|qatar|doha|israel|tel aviv|jamaica|us|costa rica|new zealand|auckland|peru|lima|uruguay|guatemala|panama|puerto rico|nepal|sri lanka|bangladesh|morocco|tunisia|ghana)\b/i;

// London, Ontario (e.g. BDO Canada, "London, Canada") is not London.
const LONDON_ONTARIO = /\blondon\s*,\s*(on|ontario|canada)(?=\s*(?:[,;()]|$))/gi;
const withoutLondonOntario = (location: string) => location.replace(LONDON_ONTARIO, "Ontario");

// "Cambridge, MA", "Birmingham, AL", "Newcastle, NSW", "Surrey, BC": a UK city name followed by a US/AU/CA state code.
const FOREIGN_STATE = /,\s*(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY]|NSW|VIC|QLD|WA|SA|TAS|ACT|BC|AB|SK|MB|QC|NS|NB|NL|PE)\b/;
const SEGMENT = /;|\||\/|\bor\b/i;
const RANK: Record<Region, number> = { london: 0, uk: 1, europe: 2, remote: 3, other: 4 };

/** One location segment ("Edinburgh", "New York, NY"): a UK city counts only if nothing in the segment says abroad. */
function segmentRegion(seg: string): Region {
  if (LONDON.test(seg)) return "london";
  if (UK.test(seg) && (UK_COUNTRY.test(seg) || (!BLOCK.test(seg) && !FOREIGN_STATE.test(seg)))) return "uk";
  if (EUROPE.test(seg)) return "europe";
  if (REMOTE.test(seg)) return "remote";
  return "other";
}

/** Best region across ";"/"|"/"or"-separated segments, so "Edinburgh; New York" is still UK. */
export function classifyRegion(rawLocation: string, remote: boolean): Region {
  const location = withoutLondonOntario(rawLocation);
  const best = location.split(SEGMENT).map(segmentRegion).reduce<Region>((a, b) => (RANK[b] < RANK[a] ? b : a), "other");
  return best === "other" && remote ? "remote" : best;
}

const EXCLUSIONARY = [
  "must be located in the united states", "us-based candidates only", "authorized to work in the us without sponsorship",
  "authorised to work in the us without sponsorship", "must be based in the us", "us residents only",
];
const INCLUSIVE = ["united kingdom", "uk-based", "london", "europe", "emea", "visa sponsorship available", "we sponsor"];

export function passesLocationFilter(rawLocation: string, remote: boolean, jdText: string): { pass: boolean; reason?: string } {
  const location = withoutLondonOntario(rawLocation);
  const text = jdText.toLowerCase();
  const usOnly = EXCLUSIONARY.some((p) => text.includes(p)) && !INCLUSIVE.some((p) => text.includes(p));
  if (!location.trim()) return usOnly ? { pass: false, reason: "US work authorisation required" } : { pass: true };
  if (LONDON.test(location) || /united kingdom/i.test(location)) return { pass: true };
  if (usOnly) return { pass: false, reason: "US work authorisation required" };
  const placeRegion = classifyRegion(location, false);
  if (placeRegion === "london" || placeRegion === "uk" || placeRegion === "europe") return { pass: true };
  // A remote flag (or "Remote - US") on a role pinned to a place outside UK/Europe means remote within that country,
  // not open to UK students. Unnamed places ("Hybrid", "Multiple Locations", "Remote - International") still pass.
  if (BLOCK.test(location)) return { pass: false, reason: `Location outside UK/Europe: ${location}` };
  if (remote || REMOTE.test(location)) return { pass: true };
  return { pass: false, reason: `Location not in UK/Europe/remote: ${location}` };
}

// "no sponsorship required/needed" means the opposite of a refusal, so it must not match
const NO_SPONSOR = /(we (do not|don'?t|cannot|can'?t) (offer |provide )?(visa )?sponsor|unable to (provide |offer )?(visa )?sponsor|no (visa )?sponsorship(?!\s+(is\s+)?(required|needed))|not able to sponsor)/i;
const YES_SPONSOR = /(visa sponsorship (is )?available|we (can |will |do )?sponsor|sponsorship (is )?(available|provided|offered))/i;

/** The posting line that refuses sponsorship, for the "Check eligibility" quote; null when nothing refuses. */
export function sponsorshipRefusalLine(lines: string[]): string | null {
  return lines.find((l) => NO_SPONSOR.test(l)) ?? null;
}

export function detectSponsorship(jdText: string): "yes" | "no" | "unknown" {
  if (NO_SPONSOR.test(jdText)) return "no";
  if (YES_SPONSOR.test(jdText)) return "yes";
  return "unknown";
}

/** Pass the posting body when available: some first-year programmes are only recognisable from it. */
export function detectEmploymentType(title: string, body = ""): JobForScoring["employmentType"] {
  return classifySpringWeek(title, body).kind ?? baseEmploymentType(title);
}
