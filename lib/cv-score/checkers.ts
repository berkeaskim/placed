import type { ParsedCV, Year } from "@/lib/types";
import type { CheckerId, CvRule, Track } from "@/lib/cv-rules/types";
import type { Archetype } from "@/lib/types";
import { adjustFor, resolvedMaxPages, resolvedThreshold } from "@/lib/cv-rules/adjust";
import { extractSkills, canonicalize } from "@/lib/skills/extract";
import { escapeRegex } from "@/lib/text/regex";
import { isImageOnly } from "@/lib/cv/image-only";
import { clicheDensity, countWords } from "@/lib/cv/cliches";
import type { SafetyReport } from "@/lib/cv/safety";
import { GRADE_POLICY } from "@/lib/conventions";
import type { CvContext, RuleResult } from "./context";

type Out = Omit<RuleResult, "ruleId">;
const ok = (): Out => ({ status: "pass", evidenceLine: null, fix: null });
const na = (): Out => ({ status: "not_applicable", evidenceLine: null, fix: null });
const bad = (status: "fail" | "partial", evidenceLine: string | null, fix: string): Out => ({ status, evidenceLine, fix });

export function allBullets(cv: ParsedCV) {
  return [...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => e.bullets);
}

export function thresholdFor(rule: CvRule, year: Year, fallback: number, track: Track = "standard", sector?: Archetype) {
  return resolvedThreshold(rule, sector, year, track) ?? fallback;
}

/** Education text: degree, grade and detail lines (where A-levels and GCSEs are parsed to). */
const eduText = (c: CvContext) => c.cv.education.map((e) => [e.degree, e.grade ?? "", ...e.details.map((d) => d.text)].join("\n")).join("\n");
const Y1 = /\b(year\s*1|first[- ]year|1st[- ]year|stage\s*1|level\s*4)\b/i;
const Y1_MARK = /\b\d{2}(?:\.\d)?\s*%|\b(First|1st|2[:.]1|2[:.]2|Upper Second|Lower Second)\b/;
const MODULE_MARK = /[A-Z][A-Za-z&,\s]{3,40}[:(–-]\s*\d{2}(?:\.\d)?\s*%?\)?/g;
const PLACEMENT_MARK = /(with\s+(an?\s+)?(industrial\s+|professional\s+)?placement|sandwich|year in industry|industrial (training|experience)|professional (training|experience) year|placement year)/i;
const PRE_UNI = /\bA[\s-]?levels?\b|\bIB\b|International Baccalaureate|\bHighers?\b|\bBTEC\b|\bPre-U\b|\bAbitur\b|\bBaccalaur[ée]at\b|\bCBSE\b|\bISC\b|\bWAEC\b|\bLeaving Cert/i;
const PRE_UNI_GRADE = /A\*|\b[A-E]\b(?!-level)|\bD\*|\bDistinction\*?|\bMerit\b|\b\d{2}\s*\/\s*45\b|\b\d{2,3}(?:\.\d)?%|\b[1-7]\b|\b[1-4][.,]\d\b/;

/** UK/US spelling variants are both correct (06 R12 / T14): never count them as spelling errors. */
const VARIANT_PATTERNS: RegExp[] = [
  /^[a-z]{3,}(is|iz)(e|es|ed|ing|er|ers|ation|ations)$/, // organise/organize, -isation/-ization
  /^[a-z]{2,}(ys|yz)(e|es|ed|ing)$/, // analyse/analyze
  /^(colo|behavio|favo|hono|neighbo|labo|humo|rumo|harbo|flavo|savo|vigo|endeavo|rigo|splendo|armo)u?r(s|ed|ing|ite|ites|able|ful|less)?$/, // colour/color, behaviour/behavior
  /^(cent|met|lit|fib|theat|calib|sab|sombr)(re|er)s?$/, // centre/center
  /^(catalog|dialog|analog|monolog|prolog|epilog)(ue|ues|s)?$/, // catalogue/catalog, dialogue/dialog
  /(licen|defen|offen|pretens|pretenc)[sc]e$/, // licence/license, defence/defense
  /^(travel|model|label|cancel|level|signal|total|counsel|channel|fuel|marshal|quarrel)(led|ling|ler|lers)$/, // travelled
  /^(travel|model|label|cancel|level|signal|total|counsel|channel|fuel|marshal|quarrel)(ed|ing|er|ers)$/, // traveled
  /^programm?e?s?$/, // programme/program
  /^(grey|gray|ageing|aging|judgement|judgment|cheque|check|tyre|tire|plough|plow|mould|mold|sceptic|skeptic|artefact|artifact)s?$/,
];
export function isSpellingVariant(word: string): boolean {
  const w = word.trim().toLowerCase();
  return w.length > 2 && VARIANT_PATTERNS.some((p) => p.test(w));
}

/** True when the bullet has a real quantity, ignoring years, dates, quarters and tool versions. */
export function hasQuantity(text: string): boolean {
  let t = text
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b(?:19|20)\d{2}\s*\/\s*\d{2}\b/g, " ") // academic years: 2024/25
    .replace(/\b(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)?\d{2}|present|now)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\bQ[1-4]\b/gi, " ")
    .replace(/\b[A-Z]{3,4}\d{4}\b/g, " ") // module codes: COMP0002
    .replace(/\b(?:year|yr)\s*\d{1,2}\b/gi, " ") // "Year 2 project"
    .replace(/\b\d(?:st|nd|rd|th)[- ]years?\b/gi, " ") // "2nd-year cohort"
    .replace(/\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\s+(?:a|per)\s+(?:week|month|year)\b/gi, " ") // "1 day a week"
    .replace(/\bv\d+(?:\.\d+)*\b|\b\d+\.\d+\.\d+\b/gi, " ");
  for (const sk of extractSkills(text)) t = t.replace(new RegExp(`${escapeRegex(sk)}\\s?\\d+(?:\\.\\d+)*(?![\\d%])`, "gi"), sk);
  return /\d/.test(t);
}

/** "8/10", "4/5" or "90%" within 30 characters after a skill: a self-rating, not a result (01#25, 03#13). */
function ratingOutOf10(c: CvContext): RegExpMatchArray | null {
  const re = /(?<![\d/.])\b(?:\d{1,2}\s*\/\s*10|[0-5]\s*\/\s*5)\b(?!\s*\/\s*\d)|(?<![\d.])\b\d{2,3}\s*%/g;
  const own = new Set(c.cv.skills.flatMap((g) => g.items).map((i) => i.toLowerCase()));
  let m: RegExpExecArray | null;
  while ((m = re.exec(c.text)) !== null) {
    const before = c.text.slice(Math.max(0, m.index - 30), m.index);
    // The rating must follow the skill directly ("Python (90%)", "Java – 4/5"), not end a sentence about a result.
    const tail = before.match(/([A-Za-z][\w+#.]*)\s*[(:–—-]?\s*$/)?.[1]?.toLowerCase() ?? "";
    const near = tail.length > 0 && (extractSkills(tail).length > 0 || [...own].some((i) => i.length > 1 && i === tail));
    if (near) return m;
  }
  return null;
}

function safetyCheck(report: SafetyReport | undefined, ruleId: "ATS-HID-01" | "ATS-INJ-01", fix: string): Out {
  if (!report) return na();
  const issues = report.issues.filter((i) => i.ruleId === ruleId);
  if (issues.length === 0) return ok();
  const show = (t: string) => t.replace(/[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g, (ch) => `<U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}>`);
  const spans = issues.slice(0, 8).map((i) => show(i.span).slice(0, 120));
  return { ...bad("fail", spans[0], fix), detail: `${issues.length} finding(s): ${spans.join(" | ")}` };
}

const GENERIC = /^(reading|travel(l)?ing|socialising|socializing|music|films?|movies|sports?|cooking|gym|going out|friends|netflix|gaming)$/i;

/** Case-insensitive, Unicode-aware whole-token match for an identity field ("AYŞE DEMIR" matches "Ayşe Demir"). */
const wholeWord = (v: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(v)}(?![\\p{L}\\p{N}])`, "giu");

/** A last page under this share of a full page reads as spillover (01#16, grade D tunable). */
export const SPILLOVER_FILL = 0.25;

/**
 * Labelled personal data a UK CV leaves out (01#1): date of birth, age, marital status, gender, religion, ethnicity.
 * Label-anchored (at a line start or after a separator) so module names ("Nationality and Citizenship Law") and
 * societies don't match. Nationality is optional on a UK CV and is never flagged.
 */
const PERSONAL_LABEL = /(?:^|[|•·;,]\s*)(date of birth|birth ?date|d\.?\s?o\.?\s?b\.?|age|marital status|gender|sex|religion|ethnicity|ethnic origin)\s*(?::|–|-\s)\s*\S|(?:^|[|•·;,]\s*)(d\.o\.b\.?)\s*\d/gim;
const AGE_PHRASE = /\b\d{2}\s*years?\s*old\b/i;
export function personalDetail(text: string): string | null {
  for (const m of text.matchAll(PERSONAL_LABEL)) return m[0].replace(/^[|•·;,\s]+/, "").trim();
  return text.match(AGE_PHRASE)?.[0] ?? null;
}

/**
 * Any stated degree result or average (01#2, 02#2, 03#2): UK classes incl. 2:2 and Third, Master's Distinction/Merit,
 * GPA/CGPA, IB points, a year or overall average. A bare module mark ("Econometrics 72%"), "Predicted" alone, or
 * "First place" don't count. Never rewards a higher grade over a lower one.
 */
const DEGREE_RESULT: RegExp[] = [
  /\b(?:first|1st)[- ]class\b/i,
  /\b(?:first|1st|third|3rd)\b(?=\s*(?:$|[(),;]|class|honours|hons|\(?expected|\(?predicted))/i,
  /(?:on track for|on course for|predicted|expected|grade:?)\s+(?:a\s+)?(?:first|1st|third)\b/i,
  /(?<![\d.])\b(?:2[:.][12]|1:1)\b(?![\d.])/,
  /\b(?:upper|lower)\s+second\b/i,
  /\b(?:high\s+)?(?:distinction|merit)\b(?!\s*(?:scholarship|award|prize|bursary|list))/i,
  /\bpass with (?:merit|distinction)\b/i,
  /\bc?gpa\b\s*[:=]?\s*\d(?:[.,]\d{1,2})?/i,
  /\b\d{2}\s*\/\s*45\b|\bIB(?:\s+Diploma)?\s*[:\-–]?\s*\d{2}\b/i,
  /\b\d{2}(?:\.\d)?\s*%\s*(?:average|avg|overall|mean|weighted|aggregate)\b/i,
  /\b(?:average|avg|overall|mean|weighted|aggregate)\b[^%\n]{0,25}?\b\d{2}(?:\.\d)?\s*%/i,
  /(?<![\d.])\b\d{1,2}(?:[.,]\d{1,2})?\s*\/\s*20\b/,
];
export const hasDegreeResult = (line: string) => DEGREE_RESULT.some((re) => re.test(line));
/** A-level / IB / Highers line with at least one grade (first-years only; a bare "A-levels" never counts). */
export const hasPreUniGrades = (line: string) => PRE_UNI.test(line) && PRE_UNI_GRADE.test(line.replace(new RegExp(PRE_UNI.source, "gi"), " ").replace(/:\s*/, " "));

/**
 * A link to code or a portfolio (03#3): a known code/data host with a path, or a personal site from the parsed links
 * (or written with http(s):// or www.). Bare words ("portfolio", "Socket.io", "web.dev") never count.
 */
const CODE_HOST = /\b(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|kaggle\.com|huggingface\.co|public\.tableau\.com|observablehq\.com|devpost\.com|behance\.net|dribbble\.com)\/[\w@.~-]+|\b[\w-]+\.(?:streamlit\.app|github\.io|netlify\.app|vercel\.app|pages\.dev)\b/i;
const EXPLICIT_URL = /\b(?:https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}(?:\/\S*)?/gi;
const NOT_PORTFOLIO = /linkedin\.com|^mailto:|@|facebook\.com|instagram\.com|twitter\.com|x\.com\//i;
export function hasPortfolioLink(text: string, links: string[]): boolean {
  if (CODE_HOST.test(text) || links.some((l) => CODE_HOST.test(l))) return true;
  const candidates = [...links, ...(text.match(EXPLICIT_URL) ?? [])];
  return candidates.some((l) => /[\w-]+\.[a-z]{2,}/i.test(l) && !NOT_PORTFOLIO.test(l));
}

/** Positions of responsibility (02#16): society roles, founding or launching something, leading or managing people. */
export const LEADERSHIP = /(president|captain|(?:co-?)?found(?:ed|er|ing)\b|launched|head (?:of|girl|boy|student)|deputy head|\bl(?:ed|ead)\b|team lead|chair|treasurer|secretary|committee|officer|organis(?:ed|er)|organiz(?:ed|er)|mentor(?:ed)?|managed|supervis(?:or|ed)|coordinated|\bran\b|trained|prefect|ambassador|representative|\brep\b|coach(?:ed)?|young enterprise|duke of edinburgh|\bdofe\b)/i;

/** A likely headshot (02#4): on page 1, centred in its top 30%, at least 2 cm each way, portrait or square. */
const CM = 72 / 2.54;
export function isHeadshot(i: NonNullable<SafetyReport["images"]>[number]): boolean {
  if (i.page !== 1 || i.w < 2 * CM || i.h < 2 * CM) return false;
  const aspect = i.w / i.h;
  return aspect >= 0.6 && aspect <= 1.05 && i.y + i.h / 2 >= 0.7 * i.pageH;
}

/**
 * Spelling errors we're confident about (04#3): the LLM's list minus anything not in the text, UK/US variants,
 * capitalised words (names, places, organisations), all-caps acronyms, words with digits, and the CV's own skills.
 * TODO(handoff): verify against an en-GB/en-US dictionary once one is a dependency.
 */
export function confirmedSpellingErrors(words: string[], text: string, cv: Pick<ParsedCV, "skills">): string[] {
  const skills = new Set(cv.skills.flatMap((g) => g.items).flatMap((i) => i.toLowerCase().split(/[\s,/]+/)));
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.trim();
    if (!w || out.includes(w) || isSpellingVariant(w)) continue;
    if (/\d/.test(w) || /^[A-Z0-9&.-]{2,}$/.test(w) || skills.has(w.toLowerCase())) continue;
    const re = new RegExp(`(?<![\\p{L}])${escapeRegex(w)}(?![\\p{L}])`, "u");
    const at = text.search(re);
    if (at < 0) continue;
    // A capitalised word that isn't sentence-initial is a name or term, not a typo.
    if (/^\p{Lu}/u.test(w) && at > 0 && !/[.!?:\n]\s*$/.test(text.slice(Math.max(0, at - 3), at))) continue;
    out.push(w);
  }
  return out;
}

export const CHECKERS: Record<CheckerId, (ctx: CvContext, rule: CvRule) => Out> = {
  text_layer: (c) =>
    isImageOnly(c.pageTexts) ? bad("fail", null, "Export your CV as a text PDF from Word/Google Docs — this one looks like an image, so ATS can't read it.") : ok(),
  file_size: (c) => (c.fileSize <= 2.5 * 1024 * 1024 ? ok() : bad("fail", null, "Compress the PDF under 2.5 MB — larger files fail to parse in Greenhouse.")),
  page_count: (c, r) => {
    const max = resolvedMaxPages(r, c.sector, c.year, c.track) ?? 2;
    if (c.pageCount > max) {
      if (c.pageCount === max + 1 && max === 1) return bad("partial", null, "Cut to one full page — trim older or less relevant bullets.");
      return bad("fail", null, `Cut to ${max} page${max > 1 ? "s" : ""}.`);
    }
    // A last page with only a few lines reads as unedited (01#16, 03#1): fill it or cut back.
    if (c.pageCount >= 2 && c.pageTexts.length === c.pageCount) {
      const full = Math.max(1, ...c.pageTexts.slice(0, -1).map((t) => t.trim().length));
      if (c.pageTexts[c.pageCount - 1].trim().length / full < SPILLOVER_FILL) {
        return bad("partial", null, `Your last page is mostly empty — cut to ${c.pageCount - 1} page${c.pageCount > 2 ? "s" : ""} or fill it.`);
      }
    }
    return ok();
  },
  section_headings: (c) => {
    const has = [c.cv.education.length > 0, c.cv.experience.length + c.cv.projects.length > 0, c.cv.skills.length > 0].filter(Boolean).length;
    return has === 3 ? ok() : bad(has === 2 ? "partial" : "fail", null, "Use standard headings: Education, Experience, Projects, Skills.");
  },
  education_first: (c) => {
    const order = c.cv.sectionOrder ?? [];
    if (!order.length) return na();
    if (order[0] === "education") return ok();
    // G-13's exception: finalists and Master's students with substantial experience may lead with it.
    if ((c.year === "final" || c.year === "masters") && order[0] === "experience") {
      return bad("partial", null, "Students are usually screened on Education first; lead with Experience only if it's a long, relevant placement.");
    }
    return bad("fail", null, "Move Education to the top — students are screened on it first.");
  },
  contact_present: (c) => {
    const n = [c.cv.email, c.cv.phone].filter(Boolean).length;
    return n === 2 ? ok() : bad(n === 1 ? "partial" : "fail", null, "Add your email and UK mobile number at the top.");
  },
  uk_personal_details: (c) => {
    const m = personalDetail(c.text);
    return m ? bad("fail", m, "Remove date of birth, age, marital status, gender, religion and ethnicity — UK employers don't want them. Nationality is optional.") : ok();
  },
  quantified_bullets: (c, r) => {
    const bullets = allBullets(c.cv);
    if (bullets.length === 0) return na();
    const withNum = bullets.filter((b) => hasQuantity(b.text));
    const share = withNum.length / bullets.length;
    const t = thresholdFor(r, c.year, 0.4, c.track, c.sector);
    if (share >= t) return ok();
    const first = bullets.find((b) => !hasQuantity(b.text))?.text ?? null;
    return bad(share >= t / 2 ? "partial" : "fail", first, "Add a real number to this bullet: how many, how much, how often, or by how much it improved.");
  },
  we_vs_i: (c) => {
    const bullets = allBullets(c.cv);
    const we = bullets.filter((b) => /\b(we|our)\b/i.test(b.text));
    if (we.length === 0) return ok();
    return bad(we.length / Math.max(1, bullets.length) > 0.2 ? "fail" : "partial", we[0].text, "Say what you did, not what the team did — start with your own action verb.");
  },
  skill_rating_glyphs: (c) => {
    // Stars, dots, squares and block-character bars (█░ ▓▒ ▰▱), two or more in a row.
    const m = c.text.match(/[★☆●○■□◼◻▮▯█▓▒░▰▱](?:\s?[★☆●○■□◼◻▮▯█▓▒░▰▱])+/) ?? ratingOutOf10(c);
    return m ? bad("fail", m[0], "Replace rating bars/scores with plain labels like 'Proficient' or 'Familiar'.") : ok();
  },
  uk_grades: (c) => {
    const lines = c.cv.education.flatMap((e) => [e.grade ?? "", e.degree, ...e.details.map((d) => d.text)]).filter(Boolean);
    if (lines.some(hasDegreeResult)) return ok();
    if (c.year === "1st" && lines.some(hasPreUniGrades)) return ok();
    return bad("fail", null, c.year === "1st"
      ? "State your predicted grade or your A-level (or equivalent) grades, e.g. 'Predicted 2:1' or 'A-levels: Maths A*, Economics A'."
      : `State your degree result, average or predicted grade in your university's format, e.g. 'Predicted 2:1', 'Merit (expected)' or 'GPA 3.6/4.0'. ${GRADE_POLICY.cv.circumstances}`);
  },
  github_link: (c) =>
    hasPortfolioLink(c.text, c.cv.links ?? []) ? ok() : bad("fail", null, "Add a link to your code or portfolio (GitHub, Kaggle, Tableau Public, a demo or your own site) next to your contact details."),
  outdated_tools: (c) => {
    const m = c.text.match(/universal analytics/i);
    return m ? bad("fail", m[0], "Universal Analytics was shut down in July 2024 — say GA4 if that's what you used.") : ok();
  },
  skills_count: (c) => {
    const n = c.cv.skills.reduce((x, g) => x + g.items.length, 0);
    return n >= 5 && n <= 30 ? ok() : bad("partial", null, n < 5 ? "List the tools you actually use (aim for 8–20)." : "Trim your skills to the 8–20 most relevant.");
  },
  bullet_length: (c) => {
    const bullets = allBullets(c.cv);
    if (!bullets.length) return na();
    const long = bullets.filter((b) => b.text.split(/\s+/).length > 35);
    const share = long.length / bullets.length;
    return share <= 0.3 ? ok() : bad(share > 0.5 ? "fail" : "partial", long[0].text, "Split or tighten this bullet to one line or two.");
  },
  summary_length: (c) => {
    if (!c.cv.summary?.trim()) return na();
    const n = countWords(c.cv.summary);
    if (n <= 100) return ok();
    return bad(n <= 150 ? "partial" : "fail", c.cv.summary.slice(0, 80) + "…", `Cut your profile to about 100 words (it's ${n}), or remove it.`);
  },
  interests_present: (c) => (c.cv.interests ? ok() : bad("fail", null, "Add a short, specific Interests line — recruiters read it.")),
  generic_interests: (c) => {
    if (!c.cv.interests) return na();
    const parts = c.cv.interests.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    const specific = parts.filter((p) => !GENERIC.test(p) || /\d|\(/.test(p));
    return specific.length > 0 ? ok() : bad("fail", c.cv.interests, "Make interests specific: 'Half-marathon (1:52, 2025)' beats 'sports'.");
  },
  leadership_lexicon: (c) => {
    const text = [...c.cv.leadership, ...c.cv.experience, ...c.cv.projects].map((e) => `${e.title} ${e.bullets.map((b) => b.text).join(" ")}`).join(" ");
    return LEADERSHIP.test(text) ? ok() : bad("fail", null, "Show a position of responsibility — a society role, captaincy, or something you organised.");
  },
  projects_count: (c) => {
    const n = c.cv.projects.length;
    return n >= 2 && n <= 4 ? ok() : bad(n === 0 ? "fail" : "partial", null, "Show 2–4 projects with what you built and the result.");
  },
  project_stack: (c) => {
    if (!c.cv.projects.length) return na();
    const withStack = c.cv.projects.filter((p) => extractSkills(`${p.title} ${p.bullets.map((b) => b.text).join(" ")}`).length > 0);
    if (withStack.length === c.cv.projects.length) return ok();
    const missing = c.cv.projects.find((p) => !withStack.includes(p));
    return bad(withStack.length ? "partial" : "fail", missing?.org ?? null, "Name the tech stack for each project (e.g. Python, FastAPI, PostgreSQL).");
  },
  spelling: (c) => {
    if (c.spellingErrors === null) return na();
    const errs = confirmedSpellingErrors(c.spellingErrors, c.text, c.cv);
    const n = errs.length;
    if (n === 0) return ok();
    // Graded (04#3): 1–2 confirmed errors are partial, 3+ fail. No score cap.
    return { ...bad(n >= 3 ? "fail" : "partial", errs.slice(0, 3).join(", "), "Check these words — if they're typos, fix them; if they're names or terms, you can ignore this."), detail: `Flagged: ${errs.join(", ")}` };
  },
  experience_present: (c) => {
    const dated = (e: ParsedCV["experience"][number]) => Boolean(e.dates?.trim());
    return c.cv.experience.length > 0 || c.cv.leadership.length > 0 || c.cv.projects.some(dated)
      ? ok() : bad("fail", null, "Add any experience: part-time work, volunteering, society roles and internships all count.");
  },
  skills_evidenced: (c, r) => {
    const items = [...new Set(c.cv.skills.flatMap((g) => g.items).map((i) => i.trim()).filter(Boolean))];
    if (items.length === 0) return na();
    const evidenceText = [...c.cv.experience, ...c.cv.projects, ...c.cv.leadership]
      .map((e) => `${e.title} ${e.bullets.map((b) => b.text).join(" ")}`).join("\n");
    const found = new Set(extractSkills(evidenceText).map((s) => s.toLowerCase()));
    const lower = evidenceText.toLowerCase();
    const unevidenced = items.filter((i) => {
      const canon = (canonicalize(i) ?? i).toLowerCase();
      if (found.has(canon)) return false;
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(i)}(?![A-Za-z0-9+#])`, i.length <= 2 ? "" : "i");
      return !re.test(evidenceText);
    });
    const share = (items.length - unevidenced.length) / items.length;
    const t = r.params?.threshold ?? 0.5;
    // Stored in rule_results: never carry the candidate's name (a sign-off parsed as a "skill").
    const name = c.cv.name?.trim();
    const anon = (x: string) => (name ? x.replace(wholeWord(name), "your name") : x);
    const detail = unevidenced.length ? anon(`Unevidenced skills: ${unevidenced.join(", ")}`) : undefined;
    if (share >= t) return { ...ok(), detail };
    return { ...bad(share >= t / 2 ? "partial" : "fail", anon(unevidenced.slice(0, 3).join(", ")), "Show these skills in action: mention each in a bullet or project, or drop it from your skills list."), detail };
  },
  read_time: (c) => {
    const page = c.pageTexts[0];
    if (!page || !page.trim()) return na();
    // Fairness (T1): identity fields are swapped for fixed-length tokens before measuring the top third, so a longer
    // name, email or profile URL never pushes the first entry out of it.
    const NAME = "\u0001name\u0001";
    let neutral = page;
    // Case-insensitive and Unicode-aware: an all-caps header ("AYŞE DEMIR") still matches the parsed name.
    const swapOut = (s: string | null | undefined, token: string) => {
      const v = s?.trim();
      if (v) neutral = neutral.replace(wholeWord(v), token);
    };
    swapOut(c.cv.name, NAME);
    for (const s of [c.cv.email, c.cv.phone, ...(c.cv.links ?? [])]) swapOut(s, "\u0001id\u0001");
    const head = neutral.slice(0, Math.ceil(neutral.length / 3)).toLowerCase();
    const has = (s: string | null | undefined) => !!s && s.trim().length > 0 && head.includes(s.trim().toLowerCase());
    // The first section's first entry (01#6): Education-first layouts pass when the education entry is up top.
    const eduFirst = (c.cv.sectionOrder ?? [])[0] !== "experience" && c.cv.education.length > 0;
    const first = eduFirst ? c.cv.education[0]?.institution : c.cv.experience[0]?.title ?? c.cv.education[0]?.institution;
    const date = /\b(?:19|20)\d{2}\b|\bpresent\b/i.test(head);
    const checks = [!!c.cv.name?.trim() && head.includes(NAME), has(first), date];
    const n = checks.filter(Boolean).length;
    if (n === checks.length) return ok();
    return bad(n >= 2 ? "partial" : "fail", null, "Put your name, your first entry (education or latest role) and its dates in the top third of page one.");
  },
  cliche_density: (c, r) => {
    // The rule's own cut-offs (01#17); em-dashes and "not only… but also" are tailoring warnings, never scored.
    const d = clicheDensity(c.text, { minor: r.params?.threshold, major: r.params?.majorThreshold, structural: false });
    if (d.severity === "ok") return ok();
    const spans = [...new Set(d.hits.map((h) => h.match.trim().toLowerCase()))].slice(0, 12);
    const detail = `${d.severity === "major" ? "Major: " : "Minor: "}${d.per100Words.toFixed(1)} stock phrases per 100 words. Spans: ${spans.join("; ")}`;
    return { ...bad("fail", d.hits[0]?.match ?? null, "Replace stock phrases ('passionate', 'results-driven', 'spearheaded') with what you actually did and the result."), detail };
  },
  pre_uni_grades: (c) => {
    const lines = eduText(c).split("\n").filter((l) => PRE_UNI.test(l));
    if (!lines.length) return bad("fail", null, "Add your A-levels (or equivalent) with grades, on one line: 'A-levels: Mathematics (A*), Economics (A), History (A)'.");
    return lines.some((l) => PRE_UNI_GRADE.test(l.replace(PRE_UNI, " "))) ? ok()
      : bad("partial", lines[0], "Add the grade after each subject: 'Mathematics (A*), Economics (A)'.");
  },
  first_year_marks: (c) => {
    const t = eduText(c);
    // An average or class next to a year marker, or two or more "Module: 72%" pairs.
    if (t.split("\n").some((l) => Y1.test(l) && Y1_MARK.test(l))) return ok();
    if ((t.match(MODULE_MARK) ?? []).length >= 2) return ok();
    return /predicted|expected|on track/i.test(`${t} ${c.cv.education.map((e) => e.grade ?? "").join(" ")}`)
      ? bad("partial", null, "You've given a predicted class. Add your actual first-year average or 2–4 module marks: 'Year 1: 68% average (First)'.")
      : bad("fail", null, "Add your first-year result: 'Year 1: 68% average (First)'.");
  },
  placement_grad_date: (c) => {
    const text = `${eduText(c)}\n${c.cv.education.map((e) => e.dates).join("\n")}`;
    const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
    const cvGrad = years.length ? Math.max(...years) : null;
    if (c.gradYear && cvGrad && cvGrad !== c.gradYear) {
      return bad("fail", String(cvGrad), `Your profile says you graduate in ${c.gradYear}, but your CV says ${cvGrad}. Update it to include your placement year.`);
    }
    return PLACEMENT_MARK.test(text) || (c.gradYear && cvGrad === c.gradYear) ? ok()
      : bad("partial", null, "Say your course includes a placement year, e.g. '… with Industrial Placement' or 'Placement year: 2027–28'.");
  },
  gcse_summarised: (c) => {
    const t = eduText(c);
    const asLevel = t.match(/\bAS[\s-]?[Ll]evels?\b|\bAS:\s/); // case-sensitive "AS", so prose "as" never matches
    if (asLevel) return bad("fail", asLevel[0], "Leave AS-levels off. Your A-level grades supersede them.");
    const seg = t.split("\n").filter((l) => /GCSE|IGCSE/i.test(l)).join(" ");
    if (!seg) return na();
    // "Subject 9" / "Subject (A*)" pairs: a list of them means GCSEs are itemised.
    const pairs = seg.match(/\b[A-Z][A-Za-z&.]+(?:\s[A-Z][A-Za-z&.]+){0,3}\s*[:(–-]?\s*(?:[4-9]|A\*|[ABC])\)?(?=[,;\s)]|$)/g) ?? [];
    return pairs.length <= 3 ? ok() : bad(pairs.length <= 5 ? "partial" : "fail", seg.slice(0, 80),
      `Replace the list with one line: '${pairs.length} GCSEs (range), including Maths and English'.`);
  },
  photo_present: (c) => {
    // Only the upload scan can see images; CVs scanned before images were recorded are not applicable (02#4).
    const images = c.safety?.images;
    if (!images) return na();
    return images.some(isHeadshot) ? bad("fail", null, "Remove the photo — UK employers don't expect one and it takes space from your evidence.") : ok();
  },
  cv_title: (c) => {
    const first = (c.pageTexts[0] ?? c.text).split("\n").map((l) => l.trim()).find(Boolean) ?? "";
    return /^(?:curriculum\s+vitae|c\.?v\.?|r[ée]sum[ée])\s*[:.]?$/i.test(first)
      ? bad("fail", first, "Delete the \"Curriculum Vitae\" title and put your name at the top instead.") : ok();
  },
  hidden_text: (c) => safetyCheck(c.safety, "ATS-HID-01", "Remove the hidden text — ATS can read it even though people can't, and some reject CVs that contain it."),
  prompt_injection: (c) => safetyCheck(c.safety, "ATS-INJ-01", "Remove the instruction-style text aimed at an AI screener — it won't help you and can get your CV rejected."),
};

export function runCodeChecks(rules: CvRule[], ctx: CvContext): RuleResult[] {
  return rules
    .filter((r) => r.check === "code" && r.checker)
    .map((r) => (adjustFor(r, ctx.year, ctx.track, ctx.sector)?.skip ? { ruleId: r.id, ...na() } : { ruleId: r.id, ...CHECKERS[r.checker!](ctx, r) }));
}