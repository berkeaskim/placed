/**
 * CV redaction (amendments Task 18 / A5, research 06 R10, rule G-37).
 *
 * Pure and deterministic: plain CV text in, redacted text out. The judge only ever
 * sees the redacted text. University and school names are deliberately KEPT
 * (product decision, docs/superpowers/plans/2026-10-13-cv-amendments.md).
 *
 * Placeholders carry no per-person information (no counters, no hashes), so two CVs
 * that differ only in a redacted element produce byte-identical output
 * (tests/fairness/redaction.test.ts).
 */

export type RedactionKind =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "profile_url"
  | "personal"
  | "work_authorisation"
  | "language_label"
  | "special_category";

export interface Replacement {
  placeholder: string;
  kind: RedactionKind;
  original: string;
}

export interface RedactOptions {
  knownName?: string;
  knownEmail?: string;
}

export interface RedactResult {
  redacted: string;
  replacements: Replacement[];
}

export const PLACEHOLDER = {
  name: "[NAME]",
  email: "[EMAIL]",
  phone: "[PHONE]",
  address: "[ADDRESS]",
  handle: "[HANDLE]",
  portfolio: "[PORTFOLIO]",
  personal: "[REDACTED_PERSONAL]",
  workAuth: "[WORK_AUTHORISATION_STATEMENT]",
  society: "[SOCIETY]",
  award: "[AWARD]",
  /** A stated language level such as "native" or "mother tongue": kept as a level so FIN-09 can pass (audit 02#10). */
  level: "[LEVEL]",
} as const;

type Rec = Replacement[];

const L = "A-Za-zÀ-ÖØ-öø-ÿ"; // letters used in names
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------- names

const TITLE_LINE = /^(?:curriculum\s+vitae|cv|r[eé]sum[eé])$/i;
const HEADINGS =
  /^(?:education|experience|work experience|profile|personal (?:details|profile|statement)|summary|contact|skills|projects|leadership|interests|references|about me)$/i;
const PARTICLES = new Set(["van", "von", "de", "da", "del", "der", "di", "du", "la", "le", "bin", "binti", "al", "el", "ibn", "dos", "das"]);
// Single name tokens that are also everyday words, tech, places or employers: only ever
// redacted as part of the full name, never on their own.
const COMMON_WORD_NAMES = new Set(
  (
    "january february march april may june july august september october november december " +
    "will mark grace hope joy faith rose young long king bill summer sunny dean price banks hall hill lane " +
    "green white black brown wood ford bell marshall major ray max penny sage reed stone hunt mills cash gates wade field " +
    "ruby julia grant chase morgan york kent lincoln rust swift jordan paris florence chester victoria sydney austin " +
    "dallas phoenix georgia virginia carolina savannah devon cardiff durham lancaster warwick bath essex"
  ).split(" "),
);
const POST_NOMINALS =
  /(?:\s+|,\s*)(?:BSc|BA|BEng|MEng|MSc|MSci|MA|MMath|MPhys|MChem|MPhil|MRes|MBA|LLB|LLM|PhD|DPhil|ACA|ACCA|CIMA|CFA|FHEA|\(Hons\)|Hons)\.?$/;
const PRONOUNS = /\s*[(\[]\s*(?:she|he|they|ze|xe)\s*\/\s*\w+(?:\s*\/\s*\w+)?\s*[)\]]/gi;
const NAME_LABEL = /^(?:full\s+)?name\s*:\s*/i;
const NAME_RE = new RegExp(
  `^[A-ZÀ-ÖØ-Þ][${L}'’.\\-]*(?:\\s+(?:(?:${[...PARTICLES].join("|")})\\s+)*[A-ZÀ-ÖØ-Þ][${L}'’.\\-]*){0,4}$`,
);

export function cleanNameCandidate(raw: string): string {
  let c = raw.replace(PRONOUNS, "").replace(NAME_LABEL, "").trim();
  while (POST_NOMINALS.test(c)) c = c.replace(POST_NOMINALS, "").trim();
  return c;
}

function guessName(text: string): string | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(2, lines.length); i++) {
    const first = lines[i].replace(PRONOUNS, "").split(/\s*[|•·,]\s*|\s+[–—-]\s+|\t|\s{2,}/)[0];
    const cand = cleanNameCandidate(first);
    if (TITLE_LINE.test(cand)) continue;
    if (HEADINGS.test(cand) || cand.length > 80 || !NAME_RE.test(cand)) return undefined;
    return cand;
  }
  return undefined;
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'’\-])([a-zà-öø-ÿ])/g, (_, a: string, b: string) => a + b.toUpperCase());
const variants = (s: string) => [...new Set([s, s.toUpperCase(), titleCase(s)])];
const namePattern = (s: string) => escapeRe(s).replace(/['’]/g, "['’]").replace(/\s+/g, "\\s+");

function nameTokens(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    for (const raw of n.split(/\s+/)) {
      const t = raw.replace(/^[.,]+|[.,]+$/g, "");
      if (t.length < 2 || PARTICLES.has(t.toLowerCase()) || /^[A-Z]\.?$/.test(t)) continue;
      out.add(t);
      if (t.includes("-")) for (const p of t.split("-")) if (p.length >= 3) out.add(p);
    }
  }
  return [...out]
    .filter((t) => !COMMON_WORD_NAMES.has(t.toLowerCase()))
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}

// A single token is never redacted inside an institution or employer phrase.
const ORG_BEFORE =
  /(?:University|College|School|Institute|Academy|Hospital|Trust|Bank|Council|Museum|Library|Duke|Duchess)\s+(?:of\s+(?:the\s+)?)?$/;
const ORG_AFTER =
  /^\s*(?:University|College|School|Institute|Academy|Stanley|Chase|Capital|Partners|Group|LLP|Ltd|Limited|plc|PLC|Inc|Bank|Securities|Asset|Consulting|Solutions|Technologies|Labs|Hospital|Trust|Council|Foundation|Street|Road|&\s*Co)\b/;

function redactNames(text: string, rec: Rec, names: string[], tokens: string[]): string {
  let out = text.replace(PRONOUNS, (m) => {
    rec.push({ placeholder: "", kind: "personal", original: m.trim() });
    return "";
  });
  const B = `(^|[^${L}\\-])`;
  const A = `(?![${L}\\-])`;
  const run = (forms: string[], single: boolean) => {
    for (const form of forms) {
      const re = new RegExp(`${B}(${single ? "(?:[A-Z]\\.\\s?)*" : ""}${namePattern(form)})${A}`, "g");
      out = out.replace(re, (m, pre: string, orig: string, off: number, whole: string) => {
        const at = off + pre.length;
        if (single && (ORG_BEFORE.test(whole.slice(Math.max(0, at - 40), at)) || ORG_AFTER.test(whole.slice(at + orig.length, at + orig.length + 30))))
          return m;
        rec.push({ placeholder: PLACEHOLDER.name, kind: "name", original: orig });
        return pre + PLACEHOLDER.name;
      });
    }
  };
  const full = [...new Set(names.flatMap(variants))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  run(full, false);
  // Single tokens: exact case and Title Case only (an all-caps form like "SAM" is usually an acronym).
  run([...new Set(tokens.flatMap((t) => [t, titleCase(t)]))], true);
  return out.replace(/\[NAME\](?:[ \t\-]+\[NAME\])+/g, PLACEHOLDER.name);
}

// ---------------------------------------------------------------- contact details

// Bounded quantifiers keep this linear on pathological input (e.g. 40 KB of "a.a.a.").
const EMAIL_RE = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}/g;

function redactEmails(text: string, rec: Rec, knownEmail?: string): string {
  let out = text;
  if (knownEmail?.trim()) {
    out = out.replace(new RegExp(escapeRe(knownEmail.trim()), "gi"), (m) => {
      rec.push({ placeholder: PLACEHOLDER.email, kind: "email", original: m });
      return PLACEHOLDER.email;
    });
  }
  return out.replace(EMAIL_RE, (m) => {
    rec.push({ placeholder: PLACEHOLDER.email, kind: "email", original: m });
    return PLACEHOLDER.email;
  });
}

// Separators are spaces/tabs only, never newlines, so a number cannot swallow the next line.
const PHONE_RE = /(^|[^\w+])((?:\+\d{1,3}[ \t.-]?(?:\(0\)[ \t.-]?)?|\(?0)(?:[ \t.-]?\(?\d\)?){8,14})(?!\d)/g;

function redactPhones(text: string, rec: Rec): string {
  return text.replace(PHONE_RE, (m, pre: string, num: string) => {
    const digits = num.replace(/\D/g, "").length;
    if (digits < 10 || digits > 15) return m;
    rec.push({ placeholder: PLACEHOLDER.phone, kind: "phone", original: num });
    return pre + PLACEHOLDER.phone;
  });
}

const PRE = "(^|[^\\w.@-])";
const PROTO = "(?:https?:\\/\\/)?(?:www\\.)?";
const PLATFORMS =
  "linkedin\\.com\\/(?:in|pub)\\/|github\\.com\\/|gitlab\\.com\\/|bitbucket\\.org\\/|kaggle\\.com\\/|behance\\.net\\/|dribbble\\.com\\/|(?:twitter|x|instagram|tiktok)\\.com\\/@?|medium\\.com\\/@?|dev\\.to\\/|leetcode\\.com\\/(?:u\\/)?|hackerrank\\.com\\/(?:profile\\/)?|huggingface\\.co\\/|linktr\\.ee\\/|codepen\\.io\\/|stackoverflow\\.com\\/users\\/\\d+\\/";
const PLATFORM_RE = new RegExp(`${PRE}(${PROTO}(?:${PLATFORMS}))([A-Za-z0-9_.\\-]{1,100})`, "gi");
// Personal sites on a hosting platform become [PORTFOLIO] (like personal domains), so the
// hosting choice does not distinguish two otherwise identical CVs.
const SUBDOMAIN_RE = new RegExp(
  `${PRE}(${PROTO}[A-Za-z0-9-]{1,63}\\.(?:github\\.io|vercel\\.app|netlify\\.app|wixsite\\.com|wordpress\\.com|carrd\\.co|notion\\.site|substack\\.com|framer\\.website|webflow\\.io|pages\\.dev)(?:\\/[^\\s|,;)]*)?)`,
  "gi",
);
const DOMAIN_RE = new RegExp(
  `${PRE}(${PROTO}([A-Za-z0-9-]{1,63})\\.(?:co\\.uk|org\\.uk|com|uk|dev|io|me|net|org|app|xyz|tech|site|page|ai|codes|design|website|online|info)(?![A-Za-z0-9-])(?:\\/[^\\s|,;)]*)?)`,
  "gi",
);
const PLATFORM_HOSTS = /^(?:linkedin|github|gitlab|bitbucket|kaggle|behance|dribbble|twitter|x|instagram|tiktok|medium|leetcode|hackerrank|huggingface|codepen|stackoverflow|google|gmail|outlook|hotmail|yahoo)$/i;

function redactProfileUrls(text: string, rec: Rec, slugs: string[]): string {
  const handle = (original: string) => {
    rec.push({ placeholder: PLACEHOLDER.handle, kind: "profile_url", original });
    return PLACEHOLDER.handle;
  };
  let out = text.replace(PLATFORM_RE, (_m, pre: string, base: string, slug: string) => pre + base + handle(slug));
  out = out.replace(SUBDOMAIN_RE, (_m, pre: string, url: string) => {
    rec.push({ placeholder: PLACEHOLDER.portfolio, kind: "profile_url", original: url });
    return pre + PLACEHOLDER.portfolio;
  });
  out = out.replace(DOMAIN_RE, (m, pre: string, url: string, label: string) => {
    // A name in the domain label (jamessmith.dev) or anywhere in the path (example.com/james-smith) is a personal link.
    const fold = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");
    const norm = fold(label);
    const path = fold(url.replace(/^[^/]*(?:\/\/[^/]*)?/, ""));
    if (PLATFORM_HOSTS.test(label) || !slugs.some((s) => norm.includes(s) || (path && path.includes(s)))) return m;
    rec.push({ placeholder: PLACEHOLDER.portfolio, kind: "profile_url", original: url });
    return pre + PLACEHOLDER.portfolio;
  });
  return out;
}

// ---------------------------------------------------------------- line segments

const SEP_RE = /(\s*[|•·▪●◦]\s*|\t+|\s{3,}|\s+[–—]\s+)/;

const SECTION_HEADING = /^[A-Z][A-Z &\/,'’-]{2,}$/;

/** Index of the first section heading: lines before it are the contact header. */
function headerEnd(lines: string[]): number {
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || TITLE_LINE.test(t)) continue;
    if (HEADINGS.test(t) || SECTION_HEADING.test(t)) return i;
  }
  return Math.min(lines.length, 6);
}

function mapSegments(text: string, fn: (seg: string, inHeader: boolean) => string): string {
  const lines = text.split("\n");
  const end = headerEnd(lines);
  return lines
    .map((line, n) => line.split(SEP_RE).map((part, i) => (i % 2 === 1 ? part : fn(part, n < end))).join(""))
    .join("\n");
}

const PERSONAL_RES = [
  /^(?:(?:date|place) of birth|d\.?\s?o\.?\s?b\.?|marital status|gender|sex|religion|pronouns?)\s*[:\-–]/i,
  /^(?:born\b|aged?\s*:?\s*\d{1,2}\b)/i,
  /\b\d{1,2}\s*(?:years old|y\.?o\.?)(?![A-Za-z])/i,
  /^(?:married|single|divorced|widowed|engaged)\.?$/i,
];
const POSTCODE = String.raw`(?:GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})`;
const POSTCODE_RE = new RegExp(String.raw`\b${POSTCODE}\b`);
// Outside the header a postcode only counts after a town ("Middlesbrough TS1 5AH"), so
// "an M1 8GB MacBook" is not an address.
const TOWN_POSTCODE_RE = new RegExp(String.raw`\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)*,?\s+${POSTCODE}\b`);
const STREET_RE =
  /^(?:(?:Flat|Apartment|Apt|Room)\s+\w+,?\s*)?\d+[A-Za-z]?,?\s+(?:[A-Z][A-Za-z'’\-]*\s+){1,4}(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Close|Court|Ct|Drive|Way|Place|Pl|Gardens|Gdns|Crescent|Cres|Terrace|Square|Sq|Grove|Mews|Row|Walk|Rise|Parade|Hill)\b/;
const ADDRESS_LABEL = /^(address|home address|location|home)\s*:\s*/i;

// Work-authorisation statements need status framing ("I am", "holder of", "requires", a label…),
// so achievement lines that merely mention citizens, sponsors, tiers or visas survive verbatim.
const VISA_NOT = String.raw`(?!\s+(?:applications?|processing|support|advice|advisers?|checks?|team|queries|cases?|caseworkers?)\b)`;
const WORK_AUTH_RES: RegExp[] = [
  new RegExp(String.raw`\b(?:Student|Tier\s?[245]|Work|Graduate|Skilled Worker|Dependant|Global Talent|High Potential|Youth Mobility|Spouse|Family)\s+visa\b` + VISA_NOT, "i"),
  new RegExp(String.raw`\b(?:on|hold|holds|holding|holder of|have|has|with|requires?|required|need|needs|my|current)\s+(?:a\s+|an\s+|the\s+)?(?:[A-Za-z0-9-]+\s+){0,2}visa\b` + VISA_NOT, "i"),
  /\bvisa\s+(?:status|holder|sponsorship|required|type)\b/i,
  /^\s*(?:full\s+|unrestricted\s+)?right[\s-]to[\s-]work\b(?![\s-]+checks?)/i,
  /\b(?:have|has|hold|holds|with)\s+(?:the\s+|full\s+|unrestricted\s+)*right[\s-]to[\s-]work\b(?![\s-]+checks?)/i,
  /\b(?:eligible|entitled|authori[sz]ed|permitted)\s+to\s+work\b/i,
  /^\s*(?:(?:I am|I'm)\s+(?:a\s+|an\s+)?)?(?:dual\s+)?(?:[A-Z][A-Za-z]+(?:[\/ -][A-Z][A-Za-z]+)?\s+)?citizen(?:ship)?\b/i,
  /\bcitizen(?:ship)?\s+of\b/i,
  /^\s*(?:nationality|citizenship|visa status|immigration status|work authori[sz]ation)\b/i,
  /\b(?:nationality|citizenship)\s*[:\-–]/i,
  /\bgraduate route\b|\b(?:pre-)?settled status\b|\bindefinite leave\b|\bILR\b|\bwork permit\b|\bBRP\b|\bimmigration status\b|\bpassport holder\b|\bSkilled Worker route\b/i,
  /\b(?:requires?|required|requiring|need|needs|needed|needing|without|no|not|will)\s+(?:require\s+)?(?:any\s+|visa\s+|work\s+)?sponsorship\b/i,
  /\b(?:visa|work)\s+sponsorship\b/i,
  /\bsponsorship\s+(?:is\s+)?(?:not\s+)?(?:required|needed)\b/i,
];

function isWorkAuth(sentence: string): boolean {
  // "Visa" capitalised on its own is usually the employer; only lowercase "visa" or "<Type> Visa" count.
  const s = sentence
    .replace(/\bVisa\b(?!\s+(?:status|holder|type|required|sponsorship))/g, (m, off: number) =>
      /(?:Student|Tier\s?[245]|Work|Graduate|Skilled Worker|Dependant|Global Talent)\s+$/.test(sentence.slice(0, off)) ? m : "Employer",
    )
    .replace(/National Citizen(?:['’]s)? Service/gi, "NCS");
  return WORK_AUTH_RES.some((re) => re.test(s));
}

function redactSegment(seg: string, rec: Rec, inHeader: boolean): string {
  const lead = seg.match(/^\s*/)![0];
  const trail = seg.slice(lead.length).match(/\s*$/)![0];
  const core = seg.slice(lead.length, seg.length - trail.length);
  if (!core) return seg;

  if (PERSONAL_RES.some((re) => re.test(core))) {
    rec.push({ placeholder: PLACEHOLDER.personal, kind: "personal", original: core });
    return lead + PLACEHOLDER.personal + trail;
  }
  const hasLabel = ADDRESS_LABEL.test(core);
  if (
    (POSTCODE_RE.test(core) && (inHeader || hasLabel || TOWN_POSTCODE_RE.test(core))) ||
    STREET_RE.test(core.replace(ADDRESS_LABEL, ""))
  ) {
    const label = core.match(ADDRESS_LABEL)?.[0] ?? "";
    rec.push({ placeholder: PLACEHOLDER.address, kind: "address", original: core.slice(label.length) });
    return lead + label + PLACEHOLDER.address + trail;
  }
  // Work authorisation: replace each contiguous run of matching sentences with one placeholder.
  const chunks = core.match(/(?:[^.!?;]|[.!?;](?!\s|$))+(?:[.!?;]+(?=\s|$))?\s*/g) ?? [core];
  if (!chunks.some(isWorkAuth)) return seg;
  let out = "";
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    const original = run.join("");
    rec.push({ placeholder: PLACEHOLDER.workAuth, kind: "work_authorisation", original: original.trim() });
    out += PLACEHOLDER.workAuth + original.match(/\s*$/)![0];
    run = [];
  };
  for (const c of chunks) {
    if (isWorkAuth(c)) run.push(c);
    else {
      flush();
      out += c;
    }
  }
  flush();
  return lead + out + trail;
}

// ---------------------------------------------------------------- language labels

const LANG_LINE = /\blanguages?\b|mother[\s-]tongue|first language|\bfluent\b|\bbilingual\b|\b[ABC][12]\b|\bIELTS\b|\bspoken\b/i;
const LABEL = "(?:native|mother[\\s-]tongue|first language)(?:\\s+(?:speaker|language|proficiency|level))?";

/**
 * "native", "mother tongue" and "first language" hint at origin, so the judge never sees them, but they are a language
 * level: they become [LEVEL] rather than disappearing, so a native speaker isn't marked down for an unlabelled language.
 */
function stripLanguageLabels(text: string, rec: Rec): string {
  const log = (m: string) => rec.push({ placeholder: PLACEHOLDER.level, kind: "language_label", original: m.trim() });
  return text
    .split("\n")
    .map((line) => {
      // "(native)" is unambiguous anywhere; bare labels only on language lines.
      let l = line.replace(new RegExp(`\\s*[(\\[]\\s*${LABEL}\\s*[)\\]]`, "gi"), (m) => (log(m), ` (${PLACEHOLDER.level})`));
      if (!LANG_LINE.test(l)) return l;
      const notReact = (m: string, off: number, whole: string) => /\bReact\s*$/.test(whole.slice(0, off) + m.slice(0, m.search(/native/i)));
      l = l.replace(/\b[Nn]ative\s+([A-Z][a-z]+)\s+speaker\b/g, (m, lang: string) => (log(m), `${lang} (${PLACEHOLDER.level})`));
      l = l.replace(new RegExp(`\\b${LABEL}\\s*[:\\-–—]\\s*`, "gi"), (m, off: number, whole: string) =>
        notReact(m, off, whole) ? m : (log(m), `${PLACEHOLDER.level}: `),
      );
      l = l.replace(new RegExp(`\\s*[,\\-–—:]\\s*${LABEL}\\b(?=\\s*(?:[,;)]|$))`, "gi"), (m, off: number, whole: string) =>
        notReact(m, off, whole) ? m : (log(m), ` (${PLACEHOLDER.level})`),
      );
      return l;
    })
    .join("\n");
}

// ---------------------------------------------------------------- special-category terms

const SOC_NOUN =
  "Society|Soc|Union|Students?|Student['’]?s?|Association|Network|Fellowship|Group|Forum|Council|Club|Chaplaincy|Centre|Center|Community|Alliance|Collective";
const ETHNIC =
  "Nigerian|Ghanaian|African|Caribbean|West African|East African|Somali|Eritrean|Ethiopian|Pakistani|Indian|Bangladeshi|Sri Lankan|Tamil|Punjabi|Bengali|Nepalese|Chinese|Hong Kong|Malaysian|Singaporean|Korean|Japanese|Vietnamese|Filipino|Thai|Indonesian|Turkish|Kurdish|Arab|Persian|Iranian|Afghan|Palestinian|Lebanese|Egyptian|Polish|Romanian|Bulgarian|Lithuanian|Ukrainian|Russian|Greek|Cypriot|Italian|Spanish|Portuguese|Brazilian|Latin American|Hispanic|Latinx|Irish|Asian|South Asian|East Asian|Middle Eastern|Roma|Gypsy|Traveller";

interface Core {
  re: RegExp;
  when?: (line: string) => boolean;
}
const CORES: Core[] = [
  { re: /\bDisabled Students['’]? Allowance/gi },
  { re: /\bDSA\b/g, when: (line) => /allowance|disab|recipient|student finance/i.test(line) },
  // Nouns only: "disabled 3 feature flags" is a verb.
  { re: /\bdisabilit(?:y|ies)\b|\bdisabled\s+(?:students?['’]?|people|persons?|access|support|athletes?|veterans?|children|adults|community|staff|members?)\b/gi },
  { re: /\bneuro-?diver\w*/gi },
  { re: /\bautis\w*/gi },
  { re: /\bdys(?:lex|prax|calcul)\w*/gi },
  { re: /\bADHD\b/g },
  { re: /\bwheelchair\b/gi },
  { re: /\bparalymp\w*/gi },
  {
    re: new RegExp(
      `\\b(?:Islamic|Christian|Jewish|Hindu|Sikh|Muslim|Catholic|Buddhist|Orthodox|Baptist|Methodist|Anglican|Ahmadiyya|Hillel)(?=\\s+(?:${SOC_NOUN}|Prayer)\\b)`,
      "g",
    ),
  },
  { re: /\b(?:ISoc|JSoc|CathSoc|HinduSoc|SikhSoc|ChristSoc|IslamSoc|HSoc)\b/gi },
  { re: /\bChaplaincy\b/gi },
  { re: /\bLGBT[A-Z]*\+?/gi },
  { re: /\bQueer\b/gi },
  { re: /\bPride\b/g },
  { re: /\bAfro-?Caribbean\b|\bAfrican[\s-]Caribbean\b/gi },
  { re: /\bBAME\b/g },
  { re: /\bBME\b/g, when: (line) => /\b(?:Society|Soc|Network|Students?['’]?|Association|Forum|Committee|Staff|Officer|Rep|Group|Union)\b/.test(line.replace(/\(BME\)/, "")) },
  { re: /\bBlack(?=\s+(?:Students?|History|Excellence|Heritage|Women|Men|Professionals|Lives|British|Founders|Talent|Leaders)\b)/g },
  { re: new RegExp(`\\b(?:${ETHNIC})(?=\\s+(?:${SOC_NOUN}|Cultural)\\b)`, "g") },
  { re: /\bpregnan\w*|\bmaternity\b/gi },
  { re: /\b(?:young\s+)?carers?\b/gi },
  { re: /\bmental\s+health\b/gi },
];

const STOP_WORDS =
  "President|Vice|Treasurer|Secretary|Chair|Chairperson|Member|Officer|Ambassador|Volunteer|Founder|Co-founder|Captain|Lead|Head|Rep|Representative|Recipient|Organiser|Organizer|Coordinator|Director|Manager|Mentor|Trialist|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December|Present";
const RIGHT_EXT = new RegExp(`(?:\\s+(?:(?:and|&|of|for|with)\\s+)?(?!(?:${STOP_WORDS})\\b)[A-Z][A-Za-z'’+.\\-]*|\\+)`, "y");
const RIGHT_PAREN = /\s*\([A-Z][A-Za-z&+'’.\- ]{0,14}\)/y;
const LEFT_EXT = new RegExp(
  `((?:(?!(?:${STOP_WORDS})\\b)[A-Z][A-Za-z'’]*\\s+)?(?:Students?['’]?|Society|Network|Association|Group|Forum|Council|Union|Committee|Alliance)\\s+(?:with|for|of|on)\\s+)$`,
);
const AWARD_WORDS = /\b(?:Allowance|Award|Scholarship|Bursary|Prize|Grant|Fund|Medal|Trialist|Games|Squad|Certificate|Certified|First Aid)/i;
const SOC_WORDS = new RegExp(`\\b(?:${SOC_NOUN}|Committee|Month|Week|Hillel)\\b|Soc\\b`, "i");
const AWARD_CTX = /\b(?:recipient|awarded|won|winner|trialist|scholar|bursary|certif|allowance)/i;

function classify(phrase: string, line: string): string {
  if (AWARD_WORDS.test(phrase)) return PLACEHOLDER.award;
  if (SOC_WORDS.test(phrase)) return PLACEHOLDER.society;
  if (AWARD_CTX.test(line)) return PLACEHOLDER.award;
  return PLACEHOLDER.personal;
}

function lineAt(text: string, idx: number): string {
  const s = text.lastIndexOf("\n", idx - 1) + 1;
  const e = text.indexOf("\n", idx);
  return text.slice(s, e === -1 ? undefined : e);
}

function redactSpecialCategory(text: string, rec: Rec): string {
  let out = text;
  for (const { re, when } of CORES) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(out))) {
      let start = m.index;
      let end = start + m[0].length;
      const line = lineAt(out, start);
      if (when && !when(line)) continue;
      // extend right over the rest of the proper-noun phrase, plus a short "(ACRONYM)"
      for (;;) {
        RIGHT_EXT.lastIndex = end;
        const r = RIGHT_EXT.exec(out);
        if (!r || r[0].includes("\n")) break;
        end = RIGHT_EXT.lastIndex;
      }
      RIGHT_PAREN.lastIndex = end;
      const p = RIGHT_PAREN.exec(out);
      if (p && !p[0].includes("\n")) end = RIGHT_PAREN.lastIndex;
      // extend left for "Students with Disabilities", "Society for ..."
      const left = LEFT_EXT.exec(out.slice(Math.max(0, start - 60), start));
      if (left && !left[1].includes("\n")) start -= left[1].length;

      const original = out.slice(start, end);
      const placeholder = classify(original, line);
      rec.push({ placeholder, kind: "special_category", original });
      out = out.slice(0, start) + placeholder + out.slice(end);
      g.lastIndex = start + placeholder.length;
    }
  }
  return out;
}

// ---------------------------------------------------------------- entry point

function identitySlugs(names: string[], tokens: string[], knownEmail?: string): string[] {
  // Full-name concatenations plus distinctive tokens; common-word tokens ("ruby") alone would
  // wrongly hit domains like rubyonrails.org.
  const parts = [...tokens, ...names.map((n) => n.replace(/[^A-Za-z]/g, ""))];
  if (knownEmail) parts.push(...knownEmail.split("@")[0].split(/[._\-+\d]+/));
  return [...new Set(parts.map((p) => p.toLowerCase().replace(/[^a-z]/g, "")).filter((p) => p.length >= 3))];
}

export function redactCv(text: string, opts: RedactOptions = {}): RedactResult {
  const rec: Rec = [];
  let out = text.replace(/\r\n?/g, "\n");
  if (!out) return { redacted: out, replacements: rec };

  const names = [opts.knownName ? cleanNameCandidate(opts.knownName) : undefined, guessName(out)].filter((n): n is string => !!n && n.length >= 2);
  const tokens = nameTokens(names);

  out = redactEmails(out, rec, opts.knownEmail);
  out = redactProfileUrls(out, rec, identitySlugs(names, tokens, opts.knownEmail));
  out = redactPhones(out, rec);
  out = mapSegments(out, (seg, inHeader) => redactSegment(seg, rec, inHeader));
  out = stripLanguageLabels(out, rec);
  out = redactSpecialCategory(out, rec);
  out = redactNames(out, rec, [...new Set(names)], tokens);
  return { redacted: out, replacements: rec };
}
