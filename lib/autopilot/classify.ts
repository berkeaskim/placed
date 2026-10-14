import { isEeoLabel, type VaultKey } from "./vault";
import type { FieldType } from "./forms/types";

export type Classified =
  | { kind: "vault"; key: VaultKey } | { kind: "eeo" } | { kind: "consent" } | { kind: "freeText" }
  | { kind: "file"; which: "cv" | "cover" } | { kind: "yours" } | { kind: "extra" };

const CONSENT = /^privacy|terms (&|and) conditions|personal data|ai policy|information provided in this application|\bi confirm\b|name is your legal name|privacy (notice|policy)|candidate data|data protection|gdpr|i (consent|agree|acknowledge|confirm that)|acknowledg|declaration|conduct policy|confidentiality agreement|terms and conditions/i;
const YOURS = /previously (been )?(employed|worked|applied)|ever (worked|applied)|reasonable adjustment|accommodation|salary|compensation|expected pay|additional information|anything else|referr(ed|al) (to|by)|related to anyone|^if (you )?(have )?(selected|answered|chose)|^if ('?yes|other)/i;
// Extra family-background wording the shared EEO regex does not cover: still a protected-characteristic proxy, never filled.
const EEO_EXTRA = /first (of|in) (your|the|my) family|first[- ]gen|family to (attend|go)|diverse and inclusive|diversity|equal opportunit|self-describe|household earner|type of school|military|nationality|choose to share/i;
// Right-to-work / sponsorship answers in the Vault are UK-only: a question about another jurisdiction needs the student's own confirmation.
const OTHER_JURISDICTION = /united states|\bu\.?s\.?a?\b|netherlands|germany|france|spain|ireland|paris|madrid|\beu\b|europe|canada|singapore|hong kong/i;
const NOT_A_VALUE = /transcript|agreement|campus event|career fair|1st year|2nd year|sandwich|^are you (currently )?enrolled|\bsign\b/i;

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
  [/grade|classification|gpa|score|academic (performance|result)/i, "grades"],
  [/which universit|name of your universit|universit\w* (do you|you) (currently )?attend|institution (you|do you)|where do you study|^universit|^school|what school/i, "university"],
  [/what degree|degree (are you|subject|discipline|type|level)|course (are you|you are) studying|fields? of study|discipline|highest (academic )?qualification|^major|subjects?\b|level of education|masters degree qualification|receive.*degree/i, "degree"],
  [/start date|when can you start|earliest start|your availability|available to start|notice period|when are you available|(when|what date).*(can|would|will|are) you.*(start|available)|from what date can you start|prefer to start/i, "start_date"],
  [/length of (the |your )?(internship|placement|contract)|how long.*(available|internship)/i, "internship_length"],
  [/outstanding offers|other (offers|deadlines)|existing interview|offer deadline|accepted an? .*offer/i, "outstanding_offers"],
  [/hear about|how did you (find|hear)|where did you (see|find)|learn about|connect with us/i, "heard_about"],
  [/pronouns/i, "pronouns"],
  [/which languages|languages? (do you )?speak|language\(s\).*fluent/i, "languages"],
  [/^location$|^city|where (are you|will you be) (based|living)|current location|where are you (currently )?(based|located)|country (are you|do you) (currently )?liv/i, "location"],
];

export function classify(label: string, type: FieldType): Classified {
  const l = label.trim();
  if (isEeoLabel(l) || EEO_EXTRA.test(l)) return { kind: "eeo" };
  if (CONSENT.test(l)) return { kind: "consent" };
  if (type === "file") return /cover/i.test(l) ? { kind: "file", which: "cover" } : { kind: "file", which: "cv" };
  if (YOURS.test(l)) return { kind: "yours" };
  if (type === "location") return { kind: "vault", key: "location" };
  // Long free-text prompts mention words like "GitHub" or "degree" in passing ("…projects or experiences… GitHub"): never map them to a vault field.
  if (type === "textarea" && l.length > 80) return { kind: "freeText" };
  if (type !== "textarea" && NOT_A_VALUE.test(l)) return { kind: "extra" };
  for (const [re, key] of VAULT) {
    if (!re.test(l)) continue;
    if ((key === "rtw_uk" || key === "needs_sponsorship") && OTHER_JURISDICTION.test(l)) return { kind: "yours" };
    return { kind: "vault", key };
  }
  if (type === "textarea") return { kind: "freeText" };
  return { kind: "extra" };
}
