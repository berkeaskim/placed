import type { ParsedCV, Year } from "@/lib/types";
import type { CheckerId, CvRule } from "@/lib/cv-rules/types";
import { extractSkills, canonicalize } from "@/lib/skills/extract";
import { escapeRegex } from "@/lib/text/regex";
import { isImageOnly } from "@/lib/cv/image-only";
import type { CvContext, RuleResult } from "./context";

type Out = Omit<RuleResult, "ruleId">;
const pending = (): Out => ({ status: "not_applicable", evidenceLine: null, fix: null, detail: "pending cv-modules" });
const ok = (): Out => ({ status: "pass", evidenceLine: null, fix: null });
const na = (): Out => ({ status: "not_applicable", evidenceLine: null, fix: null });
const bad = (status: "fail" | "partial", evidenceLine: string | null, fix: string): Out => ({ status, evidenceLine, fix });

export function allBullets(cv: ParsedCV) {
  return [...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => e.bullets);
}

export function thresholdFor(rule: CvRule, year: Year, fallback: number) {
  return rule.yearAdjust?.[year]?.threshold ?? rule.params?.threshold ?? fallback;
}

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
function hasQuantity(text: string): boolean {
  let t = text
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)?\d{2}|present|now)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\bQ[1-4]\b/gi, " ")
    .replace(/\bv\d+(?:\.\d+)*\b|\b\d+\.\d+\.\d+\b/gi, " ");
  for (const sk of extractSkills(text)) t = t.replace(new RegExp(`${escapeRegex(sk)}\\s?\\d+(?:\\.\\d+)*(?![\\d%])`, "gi"), sk);
  return /\d/.test(t);
}

function ratingOutOf10(c: CvContext): RegExpMatchArray | null {
  const re = /(?<![\d/.])\b\d{1,2}\s*\/\s*10\b(?!\s*\/\s*\d)/g;
  const own = new Set(c.cv.skills.flatMap((g) => g.items).map((i) => i.toLowerCase()));
  let m: RegExpExecArray | null;
  while ((m = re.exec(c.text)) !== null) {
    const before = c.text.slice(Math.max(0, m.index - 30), m.index);
    const near = extractSkills(before).length > 0 || [...own].some((i) => i.length > 2 && before.toLowerCase().includes(i));
    if (near) return m;
  }
  return null;
}

const GENERIC = /^(reading|travel(l)?ing|socialising|socializing|music|films?|movies|sports?|cooking|gym|going out|friends|netflix|gaming)$/i;

export const CHECKERS: Record<CheckerId, (ctx: CvContext, rule: CvRule) => Out> = {
  text_layer: (c) =>
    isImageOnly(c.pageTexts) ? bad("fail", null, "Export your CV as a text PDF from Word/Google Docs — this one looks like an image, so ATS can't read it.") : ok(),
  file_size: (c) => (c.fileSize <= 2.5 * 1024 * 1024 ? ok() : bad("fail", null, "Compress the PDF under 2.5 MB — larger files fail to parse in Greenhouse.")),
  page_count: (c, r) => {
    const max = r.params?.maxPages ?? 2;
    if (c.pageCount <= max) return ok();
    if (c.pageCount === max + 1 && max === 1) return bad("partial", null, "Cut to one full page — trim older or less relevant bullets.");
    return bad("fail", null, `Cut to ${max} page${max > 1 ? "s" : ""}.`);
  },
  section_headings: (c) => {
    const has = [c.cv.education.length > 0, c.cv.experience.length + c.cv.projects.length > 0, c.cv.skills.length > 0].filter(Boolean).length;
    return has === 3 ? ok() : bad(has === 2 ? "partial" : "fail", null, "Use standard headings: Education, Experience, Projects, Skills.");
  },
  education_first: (c) => {
    const i = c.cv.sectionOrder.indexOf("education");
    return i >= 0 && i <= 1 ? ok() : bad("fail", null, "Move Education to the top — students are screened on it first.");
  },
  contact_present: (c) => {
    const n = [c.cv.email, c.cv.phone].filter(Boolean).length;
    return n === 2 ? ok() : bad(n === 1 ? "partial" : "fail", null, "Add your email and UK mobile number at the top.");
  },
  uk_personal_details: (c) => {
    const m = c.text.match(/(date of birth|d\.o\.b\.?|\bdob\b|marital status|nationality|\bage:\s*\d{2})/i);
    return m ? bad("fail", m[0], "Remove date of birth, age, nationality and marital status — UK employers don't want them.") : ok();
  },
  quantified_bullets: (c, r) => {
    const bullets = allBullets(c.cv);
    if (bullets.length === 0) return na();
    const withNum = bullets.filter((b) => hasQuantity(b.text));
    const share = withNum.length / bullets.length;
    const t = thresholdFor(r, c.year, 0.4);
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
    const m = c.text.match(/[★☆●○■□◼◻▮▯]{2,}/) ?? ratingOutOf10(c);
    return m ? bad("fail", m[0], "Replace rating bars/scores with plain labels like 'Proficient' or 'Familiar'.") : ok();
  },
  uk_grades: (c) => {
    const g = [c.cv.education.map((e) => `${e.grade ?? ""} ${e.details.map((d) => d.text).join(" ")}`).join(" ")].join(" ");
    return /(\bfirst\b(?![- ](year|aid|term|team|lecture|module|semester))|\b1st\b(?![- ]year)|\b2:1\b|\b2\.1\b|\b2:2\b|upper second|\bpredicted\b|\b\d{2}(\.\d)?%|a\*|\baaa\b|a-levels?|\bib\b\s*\d{2})/i.test(g)
      ? ok() : bad("fail", null, "State your (predicted) degree classification and A-level/IB grades.");
  },
  github_link: (c) =>
    /(github\.com|gitlab\.com|\.dev\b|\.io\b|portfolio)/i.test(c.text + " " + c.cv.links.join(" "))
      ? ok() : bad("fail", null, "Add your GitHub or portfolio link next to your contact details."),
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
  summary_length: (c) => (!c.cv.summary ? na() : c.cv.summary.length > 400 ? bad("partial", c.cv.summary.slice(0, 80) + "…", "Cut your profile to two lines, or remove it.") : ok()),
  interests_present: (c) => (c.cv.interests ? ok() : bad("fail", null, "Add a short, specific Interests line — recruiters read it.")),
  generic_interests: (c) => {
    if (!c.cv.interests) return na();
    const parts = c.cv.interests.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    const specific = parts.filter((p) => !GENERIC.test(p) || /\d|\(/.test(p));
    return specific.length > 0 ? ok() : bad("fail", c.cv.interests, "Make interests specific: 'Half-marathon (1:52, 2025)' beats 'sports'.");
  },
  leadership_lexicon: (c) => {
    const text = [...c.cv.leadership, ...c.cv.experience].map((e) => `${e.title} ${e.bullets.map((b) => b.text).join(" ")}`).join(" ");
    return /(president|captain|founder|co-founder|head of|\bled\b|chair|treasurer|secretary|committee|officer|organis(ed|er)|organiz(ed|er)|mentor)/i.test(text)
      ? ok() : bad("fail", null, "Show a position of responsibility — a society role, captaincy, or something you organised.");
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
    const errs = c.spellingErrors.filter((w) => !isSpellingVariant(w));
    const n = errs.length;
    if (n === 0) return ok();
    return bad(n >= 3 ? "fail" : "partial", errs.slice(0, 3).join(", "), "Fix these spelling errors — even two typos measurably cut interview chances.");
  },
  experience_present: (c) =>
    c.cv.experience.length > 0 ? ok() : bad("fail", null, "Add any experience: part-time work, volunteering, society roles and internships all count."),
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
    const detail = unevidenced.length ? `Unevidenced skills: ${unevidenced.join(", ")}` : undefined;
    if (share >= t) return { ...ok(), detail };
    return { ...bad(share >= t / 2 ? "partial" : "fail", unevidenced.slice(0, 3).join(", "), "Show these skills in action: mention each in a bullet or project, or drop it from your skills list."), detail };
  },
  read_time: (c) => {
    const page = c.pageTexts[0];
    if (!page || !page.trim()) return na();
    const head = page.slice(0, Math.ceil(page.length / 3)).toLowerCase();
    const has = (s: string | null | undefined) => !!s && s.trim().length > 0 && head.includes(s.trim().toLowerCase());
    const role = c.cv.experience[0];
    const checks = [has(c.cv.name), has(role?.title), has(role?.dates), has(c.cv.education[0]?.institution)];
    const n = checks.filter(Boolean).length;
    if (n === checks.length) return ok();
    return bad(n >= 3 ? "partial" : "fail", null, "Put your name, latest role, dates and education in the top third of page one — recruiters decide in seconds.");
  },
  // TODO(cv-modules): wire clicheDensity() (lib/cv/cliches.ts) once feat/cv-modules lands.
  cliche_density: () => pending(),
  // TODO(cv-modules): wire scanCvSafety() (lib/cv/safety.ts) hidden-text findings once feat/cv-modules lands.
  hidden_text: () => pending(),
  // TODO(cv-modules): wire scanCvSafety() (lib/cv/safety.ts) prompt-injection findings once feat/cv-modules lands.
  prompt_injection: () => pending(),
};

export function runCodeChecks(rules: CvRule[], ctx: CvContext): RuleResult[] {
  return rules
    .filter((r) => r.check === "code" && r.checker)
    .map((r) => (r.yearAdjust?.[ctx.year]?.skip ? { ruleId: r.id, ...na() } : { ruleId: r.id, ...CHECKERS[r.checker!](ctx, r) }));
}