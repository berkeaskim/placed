import { isEeoLabel, type VaultKey } from "./vault";
import type { FieldType } from "./forms/types";
import { isMotivationLabel } from "../cover-letter/mode";

export type Classified =
  | { kind: "vault"; key: VaultKey } | { kind: "eeo" } | { kind: "consent" } | { kind: "freeText" } | { kind: "motivation" }
  | { kind: "file"; which: "cv" | "cover" } | { kind: "yours" } | { kind: "extra" };

const CONSENT = /^privacy|terms (&|and) conditions|personal data|ai policy|information provided in this application|\bi confirm\b|name is your legal name|privacy (notice|policy)|candidate data|data protection|gdpr|i (consent|agree|acknowledge|confirm that|have read)|acknowledg|declaration|conduct policy|confidentiality agreement|terms and conditions/i;
const YOURS = /previously (been )?(employed|worked|applied)|ever (worked|applied)|reasonable adjustment|accommodation|salary|compensation|expected pay|additional information|anything else|referr(ed|al) (to|by)|related to anyone|^if (you )?(have )?(selected|answered|chose)|^if ('?yes|other)|not listed|please specify/i;
// Right-to-work / sponsorship answers in the Vault are UK-only: a question about another jurisdiction needs the student's own confirmation.
const OTHER_JURISDICTION = /united states|netherlands|germany|france|spain|ireland|paris|madrid|\beu\b|europe|canada|singapore|hong kong/i;
const OTHER_US = /\bU\.?S\.?A?\b/; // case-sensitive so "let us know" is not a jurisdiction
const SCORE_TEST = /\b(SAT|ACT)\b|maximum possible/;
const NOT_A_VALUE = /transcript|agreement|campus event|career fair|1st year|2nd year|sandwich|^are you (currently )?enrolled|\bsign\b/i;

/**
 * Placement-year questions (placement 05 §4d), checked before the general list so "length of the placement" is not read
 * as an internship length and "Is your course a sandwich course?" fills from setup instead of being re-asked.
 */
const PLACEMENT_VAULT: [RegExp, VaultKey][] = [
  [/\b(?:available|availability)\b.*\b(?:from|to|until)\b.*\b(?:from|to|until)\b|\bdates? (?:you are|you're) available\b/i, "placement_window"],
  [/available (?:until|to)\b|latest (?:end|finish) date|(?:placement|availability) end date|until when are you available|when (?:must|do) you return/i, "available_to"],
  [/available from\b|placement start date|earliest (?:placement )?start date for (?:the|a|your) placement/i, "available_from"],
  [/return(?:ing)? to (?:full[- ]time )?(?:study|studies|university|your (?:studies|degree|course))|go back to university/i, "returning_to_study"],
  [/(?:length|duration) of (?:the |your )?placement|placement (?:length|duration)|how (?:long|many months).*placement|months? (?:are you|can you) available/i, "placement_duration"],
  [/minimum (?:number of )?weeks|university(?:'s)? minimum/i, "placement_min_weeks"],
  [/(?:academic|which) year (?:is|of|will) (?:your |the )?placement|placement (?:academic )?year (?:is|will be)|year of (?:your )?placement/i, "placement_academic_year"],
  [/(?:does|will) your (?:course|degree) (?:include|have|require) (?:a |an )?(?:placement|industrial|sandwich|year in industry)|sandwich (?:course|degree)|placement year (?:as )?part of|year in industry/i, "placement_included"],
  [/(?:year 1|first[- ]year|1st[- ]year) (?:average|result|mark|grade)s?|(?:average|result|mark)s? (?:in|from|for) (?:your )?(?:year 1|first year|1st year)/i, "year1_result"],
  [/predicted (?:degree )?(?:class|classification|grade|result)|expected (?:degree )?classification/i, "predicted_class"],
  [/relocat|willing to (?:move|work in another)|location preference|preferred (?:office|site|location)/i, "relocation"],
  [/placement (?:office|officer|tutor|coordinator)|university placement (?:contact|team)/i, "placement_office"],
];

// Order matters: first match wins. Anchored patterns avoid "Name" swallowing "company name".
const VAULT: [RegExp, VaultKey][] = [
  [/^first name|^given name|^forename/i, "first_name"],
  [/^(last|family) name|^surname/i, "last_name"],
  [/^preferred name|preferred first name/i, "preferred_name"],
  [/^(full )?name\s*\*?$/i, "full_name"],
  [/^(your |personal |contact )?e-?mail( address)?\s*\*?$|^email\b(?!.*employee)/i, "email"],
  [/phone|contact number|mobile/i, "phone"],
  [/linkedin/i, "linkedin"],
  [/^.{0,60}github/i, "github"],
  [/^.{0,60}(portfolio|personal (web)?site)|^website/i, "portfolio"],
  [/(?<!without )sponsor|require a visa|need a visa/i, "needs_sponsorship"],
  [/right to work|work authori[sz]|authori[sz]ed (lawfully )?to work|legally (authori[sz]ed|entitled|permitted|eligible)|eligib\w* to work|work permit/i, "rtw_uk"],
  [/year (does )?your (course|degree) (finish|end)|graduat\w* (year|month|date)|expected graduation|when do you graduate|graduating|plan on finishing|what year.*graduat|when (do|did) you.*graduate|year of graduation|expected to graduate|complete your (university )?studies/i, "grad_year"],
  [/what year of (your )?stud|current year of stud|year of study|year of your stud/i, "year_of_study"],
  [/grade|classification|gpa|academic (performance|result)/i, "grades"],
  [/which universit|name of your universit|universit\w* (do you|you) (currently )?attend|institution (you|do you)|where do you study|^universit|^school|what school/i, "university"],
  [/what degree|degree (are you|subject|discipline|type|level)|course (are you|you are) studying|fields? of study|discipline|highest (academic )?qualification|^major|subjects?\b|level of education|masters degree qualification|receive.*degree/i, "degree"],
  [/start date|when can you start|earliest start|your availability|available to start|notice period|when are you available|\b(when|what date) (can|would|will|are) you\b.*(start|available)|from what date can you start|prefer to start/i, "start_date"],
  [/length of (the |your )?(internship|placement|contract)|how long.*(available|internship)/i, "internship_length"],
  [/outstanding offers|other (offers|deadlines)|existing interview|offer deadline|accepted an? .*offer/i, "outstanding_offers"],
  [/hear about|how did you (find|hear)|where did you (see|find)|learn about|connect with us/i, "heard_about"],
  [/pronouns/i, "pronouns"],
  [/which languages|languages? (do you )?speak|language\(s\).*fluent/i, "languages"],
  [/^location$|^city|where (are you|will you be) (based|living)|current location|where are you (currently )?(based|located)|country (are you|do you) (currently )?liv/i, "location"],
];

export function classify(label: string, type: FieldType): Classified {
  const l = label.trim();
  if (CONSENT.test(l)) return { kind: "consent" }; // before EEO: "I consent to my diversity data being processed" is a declaration
  if (isEeoLabel(l)) return { kind: "eeo" };
  if (type === "file") {
    // Only a CV/resume upload gets the student's CV; transcripts, writing samples, proof of right to work etc. stay hers.
    if (/cover/i.test(l)) return { kind: "file", which: "cover" };
    return /resume|\bcv\b|curriculum/i.test(l) ? { kind: "file", which: "cv" } : { kind: "yours" };
  }
  if (YOURS.test(l)) return { kind: "yours" };
  if (type === "location") return { kind: "vault", key: "location" };
  // RTW / sponsorship / visa questions are never drafted: the answer comes only from the student's own Vault (or from them directly), whatever the length or type.
  for (const [re, key] of VAULT) {
    if (key !== "needs_sponsorship" && key !== "rtw_uk") continue;
    if (!re.test(l)) continue;
    return OTHER_JURISDICTION.test(l) || OTHER_US.test(l) ? { kind: "yours" } : { kind: "vault", key };
  }
  if (type === "textarea" && isMotivationLabel(l)) return { kind: "motivation" };
  if (SCORE_TEST.test(l)) return type === "textarea" ? { kind: "freeText" } : { kind: "extra" };
  // Long free-text prompts mention words like "GitHub" or "degree" in passing ("…projects or experiences… GitHub"): never map them to a vault field.
  if (type === "textarea" && l.length > 80) return { kind: "freeText" };
  if (type !== "textarea") {
    for (const [re, key] of PLACEMENT_VAULT) if (re.test(l)) return { kind: "vault", key };
  }
  if (type !== "textarea" && NOT_A_VALUE.test(l)) return { kind: "extra" };
  for (const [re, key] of VAULT) {
    if (!re.test(l)) continue;
    return { kind: "vault", key };
  }
  if (type === "textarea") return { kind: "freeText" };
  return { kind: "extra" };
}
