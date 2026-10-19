import type { JobForScoring } from "@/lib/types";

/**
 * Placement-year detection (UK industrial placement / sandwich year / year in industry: 9–15 months between the 2nd
 * and final year). Duration decides: 8 months or less is an internship, 9–15 a placement, mixed ranges ("3, 6 and 12
 * months") wait for the posting body. Vetoes catch the other senses of "placement" (insurance placing, private
 * placements, clinical/teaching placements, office names), fixed-term contracts, apprenticeships and pre-university
 * schemes. Built and checked against ~370 live titles and bodies: research/placement-year/02-employer-ats.md §3.4.
 */
export type Kind = "placement" | "internship" | "graduate" | "apprenticeship" | "not_student" | null;

const N = String.raw`(?:\d{1,2}(?:\.5)?|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|one|two|three|four|five|six|seven|eight)`;
const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
const num = (s: string) => WORDNUM[s.toLowerCase()] ?? parseFloat(s);

/** Every "N month(s)" / "N-M months" in a string, as [min,max]. "one year"/"year-long" count as 12. */
export function durations(s: string): [number, number][] {
  const out: [number, number][] = [];
  const re = new RegExp(String.raw`\b(${N})\s*(?:(?:-|–|to|or|and|,)\s*(?:${N}\s*(?:,|and|or)\s*)*(${N}))?\s*[- ]?\s*months?\b`, "gi");
  for (const m of s.matchAll(re)) { const a = num(m[1]); const b = m[2] ? num(m[2]) : a; out.push([Math.min(a, b), Math.max(a, b)]); }
  if (/\b(one|1)[- ]year\b|\byear[- ]long\b|\bfull[- ]year\b/i.test(s)) out.push([12, 12]);
  return out;
}
const isLong = ([a, b]: [number, number]) => a >= 9 && b <= 15;
const isShort = ([, b]: [number, number]) => b <= 8;
const isMixed = ([a, b]: [number, number]) => a <= 8 && b >= 9;

// --- Title rules -------------------------------------------------------------------------------------------------
/** Strong: one is enough. */
export const PL_TITLE = /\b(industrial|industry)\s+placements?\b|\bplacement\s+(year|student|scheme|programme|program)\b|\bstudent\s+placement\b|\bplacement\s+(analyst\s+)?intern(ship)?\b|\byear\s+in\s+industry\b|\bsandwich\s+(year|placement|student|degree|course)\b|\bundergraduate\s+(work\s+)?placement\b|\b(work|year[- ]long|professional)\s+placement\b|\bprofessional\s+training\s+year\b|\bintegrated\s+placement\b|\bindustrial\s+(trainee(ship)?|year)\b|\bplacement\s+(scheme|programme)\b|\bplacement\s*[,\-–]?\s*20(27|28)\b/i;
/** Weak: a programme word that needs a 9-15 month duration (title or body) or sandwich wording in the body. */
export const PL_WEAK = /\bplacements?\b|\bundergraduate\b|\boff[- ]?cycle\b|\bintern(ship)?s?\b|\bstudent\b|\btrainee\b/i;

/** Other senses of "placement"/"sandwich", fixed-term contracts and non-university schemes. Checked first. */
export const PL_VETO_OTHER = new RegExp([
  String.raw`placements?\s+(specialist|broker|executive|agent|officer|co-?ordinator|manager|lead|facilitator|consultant|advisor|adviser|support|team|director|partner|administrator|assistant|marketing)`,
  String.raw`(early\s+careers|industrial|student|careers)\s+placements?\s+(co-?ordinator|manager|officer|lead|administrator|advisor)`,
  String.raw`\b(private|debt\s+private|equity|product|media|ad|advert|brand|data|chip|cell|component)[- ]placements?\b`,
  String.raw`placement\s+de\b|\bcourtier\b`,
  String.raw`\(\s*placement\s*:|\(\s*(?!industrial|industry|student|year|work|summer|sandwich|\d)[A-Z][a-z]+\s+placement\s*\)|placement\s+(yogyakarta|jakarta|surabaya)\b|placement\s+\w+\s+office\b`,
  String.raw`(analyst|associate)\s+(i{2,3}|iv)\s*-\s*placement`,
  String.raw`\bteacher\s+training\b|\b(clinical|practice|nursing|midwifery|teaching|teacher|school\s+direct|pgce|foster(ing)?|residential|care|social\s+work|supported\s+living)\s+placements?\b|\bstudent\s+(nurse|midwife|paramedic|social\s+worker)\b`,
  String.raw`\bsandwich\s+(artist|maker|shop|bar|production|assistant|chef|operative|packer)\b|\bsubway\b`,
  String.raw`student\s+(housing|accommodation|loans?|finance\s+officer|recruitment|movement|services|support)`,
].join("|"), "i");
/** Fixed-term contracts and cover roles: a staff job, unless the title also says intern ("Maternity Replacement Intern"). */
export const PL_VETO_CONTRACT = /\b(fixed[- ]term|ftc|cdd|befristet|maternity|paternity|parental\s+leave|cover|secondment|replacement|temporary|interim|contractor|contract)\b/i;
/** German/Austrian/Swiss gender marker "(m/f/d)": the role is not in the UK, whatever the location field says. */
const NON_UK_MARKER = /\(\s*[mfw]\s*\/\s*[fwm]\s*\/\s*[dx]\s*\)/i;
export const PL_VETO_PREUNI = /\bt[- ]?levels?\b|\bgap[- ]year\b|\bpre[- ]?university\b|\bschool[- ]leavers?\b|\byear\s*1[0-3]\b|\bsixth[- ]form\b|\bwork\s+experience\s+(week|placement)\b|\bkickstart\b|\bsupported\s+internship\b|\bapprentic|\bausbildung\b|\bapprenti\b|\balternance\b/i;
export const PL_VETO_GRAD = /\bgraduate\s+(placement|programme|program|scheme|analyst|engineer|trainee)\b/i;
export const PL_SHORT_KIND = /\bsummer\b|\bco-?op\b|\bwork\s+term\b|\bsemester\b|\b(winter|fall|autumn)\s+20\d\d\b|\bworking\s+student\b|\bwerkstudent\b|\bstudent\s+worker\b|\bpraktik|\bstage\b|\bstagiaire\b|\blong[- ]term\s+internship\b|\bvacation\b|\bspring\s+(week|insight)\b|\binsight\b/i;

// --- Body rules (2027/28 cycle) ----------------------------------------------------------------------------------
export const B_SANDWICH = /\bsandwich\s+(course|degree|year|programme|placement|student)|\bplacement\s+year\b|\byear\s+in\s+industry\b|\bindustrial\s+placement\b|\byear[- ]out\b|\b(placement|year)\s+(as\s+)?part\s+of\s+(your|their|the)\s+(degree|course|studies)|\bas\s+part\s+of\s+(your|their)\s+(degree|course)[^.]{0,40}placement|\breturn\w*\s+to\s+(university|your\s+studies|study|full[- ]time\s+(study|education)|complete\s+your\s+degree|your\s+final\s+year)|\bbefore\s+(returning|you\s+return)\s+(to\s+)?(university|your\s+final\s+year)|\bintegrated\s+master/i;
export const B_PENULT = /\bpenultimate[- ]year\b|\bgraduat\w*\s+(in|by|during)\s+(summer\s+)?2029\b|\bclass\s+of\s+2029\b|\b2029\s+graduat/i;
export const B_START = /\b(june|july|august|september)\s+2027\b|\b\d{1,2}(st|nd|rd|th)?\s+(june|july|august|september)\s+2027\b/i;
export const B_SPAN = /\b(june|july|august|september)\s+2027\b[^.]{0,40}\b(june|july|august|september)\s+2028\b|\b2027\s*[-–\/]\s*(20)?28\b/i;
/** A duration attached to the programme, not "12 months of studies remaining" or "12 months' experience". */
export const B_DURATION = new RegExp(String.raw`(duration\s*:?\s*|for\s+(a\s+period\s+of\s+)?|runs?\s+(from\s+|for\s+)|running\s+for\s+|up\s+to\s+|lasts?\s+|spans?\s+|a\s+|an\s+|this\s+|our\s+|the\s+)(${N}(\.5)?\s*(-|–|to)?\s*(${N})?\s*[- ]?months?|one[- ]year|year[- ]long|twelve\s+months)(?!\s+(of\s+)?(studies|study|experience|remaining|left))`, "i");
/** Programme durations in the body, skipping "12 months of studies remaining", "at least 12 months' experience", "within 12 months". */
export function bodyDurations(body: string): [number, number][] {
  const out: [number, number][] = [];
  const re = new RegExp(String.raw`\b(${N})\s*(?:(?:-|–|to|or)\s*(${N}))?\s*[- ]?\s*months?\b|\b(one|1)[- ]year\b|\byear[- ]long\b`, "gi");
  for (const m of body.matchAll(re)) {
    const before = body.slice(Math.max(0, m.index! - 40), m.index!), after = body.slice(m.index! + m[0].length, m.index! + m[0].length + 30);
    if (/(at\s+least|minimum|min\.?|over\s+the\s+(last|past|next)|within|every|after|first|last|past|up\s+to\s+\d+\s+years?\s+and|>|more\s+than|been|spent|over)\s*$/i.test(before)) continue;
    // "a year in the associate role", "one year as an analyst": tenure, not the programme's length.
    if (/^\s*(in|as|at)\s+(the|a|an|our)\b/i.test(after)) continue;
    if (/^\s*('|’)?\s*(of\s+)?(studies|study|experience|remaining|left|notice|probation|salary|after|of\s+(your|the)\s+(degree|course))/i.test(after)) continue;
    if (/^\s*(fixed[- ]term|ftc|contract|maternity|secondment)/i.test(after)) continue;
    if (m[3] || /year/i.test(m[0])) { out.push([12, 12]); continue; }
    const a = num(m[1]), b = m[2] ? num(m[2]) : a; out.push([Math.min(a, b), Math.max(a, b)]);
  }
  return out;
}
export const B_NEG_CONTRACT = /\b(fixed[- ]term\s+contract|maternity\s+(leave\s+)?cover|ftc)\b(?![^.]{0,60}(placement|student|intern))/i;
export const B_NEG_SHORT = /\b(10|ten|11|eleven|12|twelve)[- ]week\b|\b(3|three|4|four|5|five|6|six)[- ]months?\s+(internship|placement|programme|program|period)\b|\bsummer\s+internship\b/i;
export const B_NEG_COOP = /\bco-?op\s+(term|student|program)|\bwork\s+term\b|\bsemester\b/i;
export const B_NEG_PREUNI = /\bgap\s+year\b(?![^.]{0,40}(or|and)\s+(year\s+in\s+industry|industrial\s+placement|placement\s+year))|\bbefore\s+(starting|going\s+to)\s+university\b|\bt[- ]level\b|\bsixth[- ]form\b/i;
export const B_NEG_PARTTIME = /\b(part[- ]time|\b(1[0-9]|2[0-9]|30)\s*h(ours)?\s*(per|\/|a)\s*week|werkstudent|working\s+student)\b/i;

/** Matches of `re` in the body that are not a graduation window ("graduating between August 2027 and July 2028"). */
function notGraduation(body: string, re: RegExp): boolean {
  for (const m of body.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) {
    if (!/graduat\w*[^.]{0,30}$/i.test(body.slice(Math.max(0, m.index! - 40), m.index!))) return true;
  }
  return false;
}

export type Region = "uk" | "ie" | "europe" | "other";
export type Verdict = { kind: Kind; score: number; months: [number, number] | null; needsBody: boolean; why: string[] };

export function classifyPlacement(title: string, body = "", structured?: { programme?: string | null }, region: Region = "uk"): Verdict {
  const why: string[] = [];
  if (PL_VETO_OTHER.test(title)) return { kind: "not_student", score: -9, months: null, needsBody: false, why: ["veto:other-sense"] };
  if (PL_VETO_CONTRACT.test(title)) {
    return /\bintern(ship)?s?\b/i.test(title)
      ? { kind: "internship", score: -9, months: null, needsBody: false, why: ["veto:contract-intern"] }
      : { kind: "not_student", score: -9, months: null, needsBody: false, why: ["veto:contract"] };
  }
  if (NON_UK_MARKER.test(title) && region === "uk") region = "europe";
  if (PL_VETO_PREUNI.test(title)) return { kind: "apprenticeship", score: -9, months: null, needsBody: false, why: ["veto:pre-uni/apprentice"] };
  if (PL_VETO_GRAD.test(title)) return { kind: "graduate", score: -9, months: null, needsBody: false, why: ["veto:graduate"] };

  const td = durations(title);
  const tLong = td.some(isLong), tShort = td.some(isShort) && !tLong, tMixed = td.some(isMixed) || (td.some(isShort) && tLong);
  let score = 0;
  if (structured?.programme && /industrial\s+placement|(one|1)\s+year\s+(work\s+)?placement|placement\s+year/i.test(structured.programme)) { score += 6; why.push("structured"); }
  const strong = PL_TITLE.test(title), weak = PL_WEAK.test(title);
  if (strong) { score += 4; why.push("title:strong"); } else if (weak) { score += 1; why.push("title:weak"); }
  if (tLong && !tMixed && (strong || weak)) { score += 4; why.push("title:9-15m"); }
  if (tShort) return { kind: "internship", score: -4, months: td[0], needsBody: false, why: [...why, "title:short"] };
  if (PL_SHORT_KIND.test(title) && !tLong) return { kind: "internship", score: -4, months: null, needsBody: false, why: [...why, "title:short-kind"] };

  let months: [number, number] | null = td.find(isLong) ?? td[0] ?? null;
  let bodyMixed = false;
  if (body) {
    const bd = bodyDurations(body);
    // "3–6 month internship or 12-month placement": the advert offers both, so the length says nothing either way.
    bodyMixed = bd.some(isMixed) || (bd.some(isLong) && bd.some(isShort));
    if (bodyMixed) why.push("body:mixed-durations");
    else if (bd.some(isLong)) { score += 3; why.push("body:9-15m"); months ??= bd.find(isLong)!; }
    else if (bd.some(isShort)) { score -= 4; why.push("body:short"); months ??= bd[0]; }
    if (notGraduation(body, B_SPAN)) { score += 2; why.push("body:2027-28 span"); }
    if (B_SANDWICH.test(body)) { score += 2; why.push("body:sandwich"); }
    if (B_PENULT.test(body)) { score += 1; why.push("body:penultimate/2029"); }
    if (notGraduation(body, B_START)) { score += 1; why.push("body:summer-2027 start"); }
    if (B_NEG_CONTRACT.test(body)) { score -= 6; why.push("body:FTC"); }
    if (B_NEG_SHORT.test(body) && !bd.some(isLong)) { score -= 3; why.push("body:short-programme"); }
    if (B_NEG_COOP.test(body)) { score -= 3; why.push("body:co-op"); }
    if (B_NEG_PREUNI.test(body)) { score -= 4; why.push("body:pre-uni"); }
    if (B_NEG_PARTTIME.test(body)) { score -= 3; why.push("body:part-time"); }
  }
  const THRESH = 4;
  if (tMixed && !body) return { kind: null, score, months, needsBody: true, why: [...why, "title:mixed-duration"] };
  // A weak title over a both-lengths advert ("Business Intelligence Intern: 3 or 12 months") is left to the tagger.
  if (bodyMixed && !strong && !tLong) return { kind: null, score, months, needsBody: false, why };
  // Outside the UK/Ireland a 12-month role is a long internship unless the body ties it to a sandwich degree.
  if (score >= THRESH && region !== "uk" && region !== "ie" && !(body && B_SANDWICH.test(body))) return { kind: "internship", score, months, needsBody: false, why: [...why, "region:non-UK"] };
  if (score >= THRESH && !tMixed) return { kind: "placement", score, months, needsBody: false, why };
  if (score >= THRESH + 2 && tMixed) return { kind: "placement", score, months, needsBody: false, why };
  // Weak-only titles ("Finance Undergraduate", "Placement Analyst") wait for a body; without one they stay unlabelled.
  const needsBody = !body && (strong || weak);
  return { kind: body && score < 0 && (strong || weak) ? "internship" : null, score, months, needsBody, why };
}

type EmploymentType = JobForScoring["employmentType"];
const KIND_TYPE: Record<Exclude<Kind, null>, EmploymentType> = {
  placement: "placement", internship: "internship", graduate: "graduate", apprenticeship: "other", not_student: "permanent",
};

/** The employment type the placement classifier is sure of, or null when it has no say (fall back to other rules). */
export function placementType(title: string, body = "", region: Region = "uk", structured?: { programme?: string | null }): EmploymentType | null {
  const v = classifyPlacement(title, body, structured, region);
  return v.kind ? KIND_TYPE[v.kind] : null;
}
