/**
 * Parser for LinkedIn's "Save to PDF" profile export (docs/research/linkedin/00-playbook.md §2).
 *
 * The export has a left sidebar (Contact, Top Skills, Languages, Certifications, Honors-Awards, Publications)
 * and a main column (name, headline, location, Summary, Experience, Education). Text extraction may emit the
 * sidebar before or after the main column, so sections are found by their headings, not by position.
 *
 * Built WITHOUT real exports (playbook §10: ≥5 fixtures still needed). Every field is best-effort and
 * `warnings` records what could not be found, so the scorer can mark dependent rules not_applicable.
 */

export type LiLine = {
  text: string;
  page?: number;
  /** Left edge in PDF points; lets us split sidebar from main column when available. */
  x?: number;
  /** Font size; the name is the largest text on page 1. */
  size?: number;
};

export type LiExperience = {
  company: string;
  title: string;
  /** Date line as printed, e.g. "June 2025 - August 2025 (3 months)". */
  dates: string;
  start: { year: number; month: number | null } | null;
  /** null = "Present". */
  end: { year: number; month: number | null } | null;
  location: string | null;
  description: string;
};

export type LiEducation = {
  school: string;
  /** "Bachelor of Science - BS, Computer Science · (2024 - 2027)" without the trailing years. */
  degree: string | null;
  startYear: number | null;
  endYear: number | null;
  /** Lines after the degree line (grade, activities, modules) when present. */
  details: string;
};

export type ParsedLinkedIn = {
  name: string | null;
  headline: string | null;
  location: string | null;
  profileUrl: string | null;
  /** Non-LinkedIn links from Contact (GitHub, portfolio, ORCID…), as printed. */
  links: string[];
  email: string | null;
  topSkills: string[];
  languages: string[];
  certifications: string[];
  honors: string[];
  publications: string[];
  about: string | null;
  experience: LiExperience[];
  education: LiEducation[];
  /** Section headings that were present in the export. */
  sections: string[];
  warnings: string[];
};

const SIDEBAR = ["Contact", "Top Skills", "Languages", "Certifications", "Honors-Awards", "Publications", "Patents"] as const;
const MAIN = ["Summary", "Experience", "Education", "Volunteer Experience", "Projects", "Recommendations"] as const;
const HEADINGS = new Set<string>([...SIDEBAR, ...MAIN]);

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const POINT = `(?:${MONTH_RE}\\s+)?(?:19|20)\\d{2}`;
/** "June 2025 - August 2025 (3 months)", "2024 - Present", "September 2023 - Present (1 year 2 months)". */
export const DATE_LINE_RE = new RegExp(`^(${POINT})\\s*[-–—]\\s*(${POINT}|Present)(?:\\s*\\(([^)]*)\\))?$`, "i");
/** Company-level total for grouped roles: "2 years 3 months", "11 months". */
const DURATION_RE = /^(?:\d+\s+years?)?\s*(?:\d+\s+months?)?$/i;
const PAGE_FOOTER_RE = /^Page \d+ of \d+$/i;
const LINKEDIN_URL_RE = /(?:www\.)?linkedin\.com\/in\/[^\s)]+/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const URL_RE = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?(?:\s*\([^)]*\))?$/i;
const EDU_YEARS_RE = /·?\s*\(((?:[A-Za-z]+\s+)?(?:19|20)\d{2})?\s*[-–—]?\s*((?:[A-Za-z]+\s+)?(?:19|20)\d{2})?\)\s*$/;

function parsePoint(s: string): { year: number; month: number | null } | null {
  const y = s.match(/(19|20)\d{2}/);
  if (!y) return null;
  const m = s.match(new RegExp(MONTH_RE, "i"));
  const month = m ? MONTHS.findIndex((x) => x.startsWith(m[0].toLowerCase().slice(0, 3))) + 1 : null;
  return { year: Number(y[0]), month: month || null };
}

const isDuration = (t: string) => t.trim() !== "" && DURATION_RE.test(t.trim());
const clean = (t: string) => t.replace(/\s+/g, " ").trim();

/** Sidebar column = the lines left of a third of the widest x seen (only when x positions exist). */
function splitColumns(lines: LiLine[]): { sidebar: LiLine[]; main: LiLine[] } {
  const xs = lines.map((l) => l.x).filter((x): x is number => typeof x === "number");
  if (xs.length < lines.length * 0.8) return { sidebar: [], main: lines };
  const cut = Math.max(...xs) * 0.33;
  return { sidebar: lines.filter((l) => l.x! < cut), main: lines.filter((l) => l.x! >= cut) };
}

/** Cut a run of lines into { heading → lines } using the known headings. */
function sectionize(lines: string[]): { pre: string[]; sections: Map<string, string[]>; order: string[] } {
  const sections = new Map<string, string[]>();
  const order: string[] = [];
  const pre: string[] = [];
  let cur: string[] | null = null;
  for (const t of lines) {
    if (HEADINGS.has(t)) {
      cur = sections.get(t) ?? [];
      if (!sections.has(t)) { sections.set(t, cur); order.push(t); }
      continue;
    }
    (cur ?? pre).push(t);
  }
  return { pre, sections, order };
}

/**
 * Experience entries are anchored on their date lines. Header = the 2 lines before (company, title), or 3 when
 * the line before the title is a company-level duration ("2 years 1 month": several roles at one company).
 * Known gap: the 2nd+ role inside such a group has no company line, so its "company" is the last line of the
 * previous description. Fix once real grouped-role exports exist (fixtures).
 */
function parseExperience(lines: string[]): LiExperience[] {
  const out: LiExperience[] = [];
  const dateIdx = lines.map((t, i) => (DATE_LINE_RE.test(t) ? i : -1)).filter((i) => i >= 0);
  const headerLen = (i: number) => (isDuration(lines[i - 2] ?? "") ? 3 : 2);
  dateIdx.forEach((i, k) => {
    const company = headerLen(i) === 3 ? lines[i - 3] ?? "" : lines[i - 2] ?? "";
    const m = lines[i].match(DATE_LINE_RE)!;
    const next = dateIdx[k + 1];
    const stop = next === undefined ? lines.length : next - headerLen(next);
    let j = i + 1;
    let location: string | null = null;
    if (j < stop && /,/.test(lines[j]) && lines[j].length < 80 && !/[.!?]$/.test(lines[j])) location = lines[j++];
    out.push({
      company: clean(company), title: clean(lines[i - 1] ?? ""), dates: lines[i], start: parsePoint(m[1]),
      end: /present/i.test(m[2]) ? null : parsePoint(m[2]), location,
      description: lines.slice(j, Math.max(j, stop)).join("\n").trim(),
    });
  });
  return out;
}

function parseEducation(lines: string[]): LiEducation[] {
  const out: LiEducation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(EDU_YEARS_RE);
    const isDegree = m && (m[1] || m[2]);
    if (!isDegree) continue;
    const school = lines[i - 1] ?? "";
    const degree = clean(lines[i].replace(EDU_YEARS_RE, "").replace(/·\s*$/, "")) || null;
    const start = m![1] ? parsePoint(m![1])?.year ?? null : null;
    const end = m![2] ? parsePoint(m![2])?.year ?? null : null;
    out.push({ school: clean(school), degree, startYear: start, endYear: end ?? (m![2] ? null : start), details: "" });
  }
  // A school with no years at all ("University College London" alone) still counts as an entry.
  if (out.length === 0 && lines.length) out.push({ school: clean(lines[0]), degree: lines[1] ? clean(lines[1]) : null, startYear: null, endYear: null, details: "" });
  // Lines between one entry's degree line and the next school become details.
  const degreeIdx = lines.map((t, i) => (EDU_YEARS_RE.test(t) ? i : -1)).filter((i) => i >= 0);
  degreeIdx.forEach((d, k) => {
    const nextSchool = degreeIdx[k + 1] === undefined ? lines.length : degreeIdx[k + 1] - 1;
    if (out[k]) out[k].details = lines.slice(d + 1, nextSchool).join("\n").trim();
  });
  return out;
}

/** Name / headline / location block: the main-column lines before the first main heading. */
function parseTopCard(pre: string[], all: LiLine[], knownName?: string): { name: string | null; headline: string | null; location: string | null } {
  const lines = pre.filter((t) => t);
  if (!lines.length) return { name: null, headline: null, location: null };
  let nameIdx = -1;
  if (knownName) nameIdx = lines.findIndex((t) => t.toLowerCase() === knownName.trim().toLowerCase());
  if (nameIdx < 0) {
    const sized = all.filter((l) => (l.page ?? 1) === 1 && typeof l.size === "number" && lines.includes(clean(l.text)));
    if (sized.length) {
      const biggest = sized.reduce((a, b) => (b.size! > a.size! ? b : a));
      nameIdx = lines.indexOf(clean(biggest.text));
    }
  }
  if (nameIdx < 0) nameIdx = 0;
  const rest = lines.slice(nameIdx + 1);
  const looksLikeLocation = (t: string) => /,/.test(t) && t.length < 70 && !/[|•·@]/.test(t);
  let location: string | null = null;
  if (rest.length >= 2 && looksLikeLocation(rest[rest.length - 1])) location = rest.pop()!;
  else if (rest.length === 1 && looksLikeLocation(rest[0]) && /(United Kingdom|England|Scotland|Wales|Ireland|Area)/i.test(rest[0])) location = rest.pop()!;
  return { name: lines[nameIdx] ?? null, headline: rest.length ? clean(rest.join(" ")) : null, location };
}

/**
 * Parse export lines into a profile. `knownName` (from the user's CV) makes the top card reliable when the
 * extraction has no font sizes.
 */
export function parseLinkedInExport(input: LiLine[] | string, opts: { knownName?: string } = {}): ParsedLinkedIn {
  const raw: LiLine[] = typeof input === "string" ? input.split(/\r?\n/).map((text) => ({ text })) : input;
  const lines = raw.map((l) => ({ ...l, text: clean(l.text) })).filter((l) => l.text && !PAGE_FOOTER_RE.test(l.text));
  const { sidebar, main } = splitColumns(lines);
  const warnings: string[] = [];

  // Without columns, sidebar sections come first and their last section runs into the top card. Cut it at the
  // known name or at the first main heading's top card (the 3-ish lines before it).
  const mainText = main.map((l) => l.text);
  const side = sectionize(sidebar.map((l) => l.text));
  const body = sectionize(mainText);

  let pre = body.pre;
  const sectionsSide = sidebar.length ? side.sections : body.sections;
  if (!sidebar.length) {
    // Single stream: the top card sits right before the first MAIN heading, after the sidebar sections.
    const firstMain = mainText.findIndex((t) => (MAIN as readonly string[]).includes(t));
    const before = firstMain < 0 ? mainText : mainText.slice(0, firstMain);
    const nameAt = opts.knownName ? before.findIndex((t) => t.toLowerCase() === opts.knownName!.trim().toLowerCase()) : -1;
    const lastSideHeading = Math.max(-1, ...before.map((t, i) => ((SIDEBAR as readonly string[]).includes(t) ? i : -1)));
    if (nameAt >= 0) {
      pre = before.slice(nameAt);
      // Trim the sidebar section that swallowed the top card.
      const owner = [...body.order].reverse().find((h) => (SIDEBAR as readonly string[]).includes(h) && before.indexOf(h) < nameAt);
      if (owner) body.sections.set(owner, before.slice(before.indexOf(owner) + 1, nameAt));
    } else if (lastSideHeading >= 0) {
      // Unknown name: assume the top card is the last 3 lines (name, headline, location) before the first main heading.
      const tail = before.slice(lastSideHeading + 1);
      const take = Math.min(tail.length, 3);
      pre = tail.slice(tail.length - take);
      const owner = before[lastSideHeading];
      body.sections.set(owner, tail.slice(0, tail.length - take));
      warnings.push("top_card_guessed");
    } else {
      pre = before;
    }
  }
  const top = parseTopCard(pre, lines, opts.knownName);
  const get = (h: string) => (sectionsSide.get(h) ?? body.sections.get(h) ?? []).filter(Boolean);

  const contact = get("Contact");
  const profileUrl = contact.map((t) => t.match(LINKEDIN_URL_RE)?.[0] ?? null).find(Boolean) ?? lines.map((l) => l.text.match(LINKEDIN_URL_RE)?.[0] ?? null).find(Boolean) ?? null;
  const email = contact.map((t) => t.match(EMAIL_RE)?.[0] ?? null).find(Boolean) ?? null;
  const links = contact.filter((t) => !LINKEDIN_URL_RE.test(t) && !EMAIL_RE.test(t) && URL_RE.test(t)).map((t) => t.replace(/\s*\([^)]*\)$/, ""));

  const summary = get("Summary");
  const about = summary.length ? summary.join("\n") : null;
  const experience = parseExperience(get("Experience"));
  const education = parseEducation(get("Education"));

  if (!top.headline) warnings.push("no_headline");
  if (!get("Experience").length) warnings.push("no_experience_section");
  if (!get("Education").length) warnings.push("no_education_section");
  if (get("Experience").length && !experience.length) warnings.push("experience_unparsed");

  return {
    name: top.name, headline: top.headline, location: top.location, profileUrl, links, email,
    topSkills: get("Top Skills"), languages: get("Languages"), certifications: get("Certifications"), honors: get("Honors-Awards"),
    publications: get("Publications"), about, experience, education,
    sections: [...new Set([...side.order, ...body.order])], warnings,
  };
}
