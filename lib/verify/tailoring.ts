/**
 * verifyTailoring — the deterministic anti-fabrication gate (spec §7.3, amendments A3, research 05 §3). No LLM.
 *
 * Tailoring may reorder, rephrase and emphasise. It may never add skills, numbers, employers, titles or tools
 * that are absent from the source CV ∪ confirmed_facts. The JD is never a fact source: it is only used for
 * coverage and gaps. A PDF is never rendered while the verdict is `block`.
 *
 * Fact corpus (C7): CONTENT ONLY — raw CV text, bullet/detail texts, org/title/dates/location, degree/grade/
 * institution, skills, summary, interests — plus confirmedFacts. Never ids, archetypes, sectionOrder, yearGuess
 * or any serialised JSON. Employer/title/tool presence is whole-token matching.
 */
import type { ParsedCV, TailoredCV, TailoredEntry, TailoredBullet, TailorChangeType, CvEntry } from "@/lib/types";
import { extractSkills } from "@/lib/skills/extract";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import { clicheDensity } from "@/lib/cv/cliches";
import { runExtraChecks, extractMetrics, authorshipLevel, type SourceRole, type TailoredRole, type Issue as ExtraIssue } from "./checks-extra";

export type IssueType =
  | "inventedMetrics" | "unsupportedFacts" | "authorshipEscalation" | "skillInjection" | "orphanBullets"
  | "perBulletDrift" | "forbiddenPhrases" | "coverage"
  | "siblingContamination" | "qualifierDrop" | "structuralLoss" | "temporal" | "clicheDensity";
/** `check` names the fine-grained rule when it differs from `type` (e.g. scoped metrics report as inventedMetrics). */
export type Issue = { type: IssueType; severity: "block" | "warn"; bulletId?: string; entryId?: string; claim: string; reason: string; check?: string };
export type VerifyReport = {
  verdict: "pass" | "warn" | "block";
  issues: Issue[];
  keywordCoverage?: { before: number; after: number; missing: string[] };
  gapsStillOpen?: string[];
};
export type VerifyInput = {
  source: ParsedCV; sourceText: string; confirmedFacts: string[]; tailored: TailoredCV;
  jdKeywords: string[]; coverageBefore: number | null; coverageAfter: number | null;
};

// ---------- text helpers ----------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Whole-token phrase match on normalised text ("lead" does not match "leadership"). */
const hasToken = (hayNorm: string, needle: string) => { const n = norm(needle); return n !== "" && ` ${hayNorm} `.includes(` ${n} `); };

const NUM = /\d+(?:[.,]\d+)*(?:\s?(?:%|k\b|m\b|bn\b|x\b))?/gi;
const MULT: Record<string, number> = { k: 1e3, m: 1e6, bn: 1e9 };
/** Numeric values a token stands for: "1,200" → 1200; "2k" → 2 and 2000. */
function numValues(raw: string): string[] {
  const d = raw.match(/\d+(?:[.,]\d+)*/)?.[0];
  if (!d) return [];
  const v = parseFloat(d.replace(/,/g, ""));
  const sfx = raw.toLowerCase().match(/(k|m|bn)\s*$/)?.[1];
  return sfx ? [String(v), String(Math.round(v * MULT[sfx] * 1000) / 1000)] : [String(v)];
}
const GLOBAL = (re: RegExp) => new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
/** Contact details are content but never claims; strip them so a phone number can't license a metric. */
const stripContacts = (t: string) => t.replace(GLOBAL(EMAIL_RE), " ").replace(/https?:\/\/\S+|www\.\S+/gi, " ").replace(GLOBAL(PHONE_RE), " ");

function numberSet(text: string): Set<string> {
  const out = new Set<string>();
  const clean = stripContacts(text);
  for (const m of clean.match(NUM) ?? []) numValues(m).forEach((v) => out.add(v));
  for (const m of extractMetrics(clean)) for (const v of m.value.replace(/%$/, "").split("-")) out.add(v);
  return out;
}

const STOP = new Set(("a an the and or but of to in on at by for from with into over under via per as is are was were be been this that these those it its " +
  "their them they our who which what while when where than then so such also very more most less each every all both other across within during after " +
  "before through about using used use based including weekly daily monthly").split(" "));
const stem = (w: string) => {
  let s = w.toLowerCase();
  if (s.length > 5) s = s.replace(/(ations?|ings?|edly|ed|es|ly|s)$/, "");
  if (s.length > 4) s = s.replace(/e$/, "");
  return s;
};
const contentStems = (t: string) => new Set((t.toLowerCase().match(/[a-z][a-z0-9+#]*/g) ?? []).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem));

// ---------- corpus ----------

const sections = <T extends { experience: E[]; projects: E[]; leadership: E[] }, E>(c: T) => [...c.experience, ...c.projects, ...c.leadership];

/** The fact corpus (C7): content only, plus confirmed facts. Exported for tests and Task 23. */
export function buildFactCorpus(cv: ParsedCV, sourceText: string, confirmedFacts: string[]): string {
  const parts: (string | null)[] = [sourceText, cv.name, cv.location, cv.summary, cv.interests];
  for (const e of cv.education) parts.push(e.institution, e.degree, e.dates, e.grade, ...e.details.map((d) => d.text));
  for (const e of sections<ParsedCV, CvEntry>(cv)) parts.push(e.org, e.title, e.dates, e.location, ...e.bullets.map((b) => b.text));
  for (const g of cv.skills) parts.push(g.group, ...g.items);
  parts.push(...confirmedFacts);
  return parts.filter((p): p is string => !!p && p.trim() !== "").join("\n");
}

/** JD keywords that name a credential, tool or qualification (not a soft word like "stakeholder"). */
const isHardTerm = (kw: string) => /\d/.test(kw) || /[A-Z]{2,}/.test(kw) || /\b(level|certif\w*|chartered|licen[cs]\w*|qualif\w*|accredit\w*|degree|diploma)\b/i.test(kw);

/** JD requirements/keywords the student's CV (∪ confirmed facts) does not evidence. The tailored CV is never consulted. */
export function gapsStillOpen(i: { source: ParsedCV; sourceText: string; confirmedFacts: string[]; jdKeywords: string[] }): string[] {
  const corpus = buildFactCorpus(i.source, i.sourceText, i.confirmedFacts);
  const cNorm = norm(corpus);
  const srcSkills = new Set(extractSkills(corpus));
  return i.jdKeywords.filter((kw) => {
    const sk = extractSkills(kw);
    return sk.length ? sk.some((s) => !srcSkills.has(s)) : !hasToken(cNorm, kw);
  });
}

// ---------- identity tailoring ----------

export function toTailored(cv: ParsedCV): TailoredCV {
  const map = (es: CvEntry[]): TailoredEntry[] => es.map((e) => ({
    id: e.id, org: e.org, title: e.title, dates: e.dates, location: e.location,
    bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, sourceRefs: [b.id], changeType: "kept" as const })),
  }));
  return {
    summary: cv.summary, education: cv.education.map((e) => ({ ...e, details: e.details.map((d) => ({ ...d })) })),
    experience: map(cv.experience), projects: map(cv.projects), leadership: map(cv.leadership),
    skills: cv.skills.map((g) => ({ ...g, items: [...g.items] })), interests: cv.interests, changes: [],
  };
}

// ---------- verifyTailoring ----------

const FORBIDDEN: [string, RegExp][] = [
  ["proven track record", /\bproven track record\b/i], ["world-class", /\bworld[- ]class\b/i], ["rockstar", /\brock ?stars?\b/i],
  ["ninja", /\bninjas?\b/i], ["guru", /\bgurus?\b/i], ["thought leader", /\bthought[- ]leader\w*/i], ["synergy", /\bsynerg\w*/i],
  ["seasoned", /\bseasoned\b/i], ["visionary", /\bvisionary\b/i], ["best-in-class", /\bbest[- ]in[- ]class\b/i], ["unparalleled", /\bunparalleled\b/i],
  ["expert in", /\bexpert(?:ise)? (?:in|at|with)\b/i],
];
const WARN_PHRASES: [string, RegExp][] = [
  ["passionate about", /\bpassionate about\b/i], ["results-driven", /\bresults?[- ]driven\b/i], ["dynamic", /\bdynamic\b/i],
  ["detail-oriented", /\bdetail[- ]oriented\b/i], ["team player", /\bteam[- ]player\b/i], ["hard-working", /\bhard[- ]?working\b/i],
  ["self-starter", /\bself[- ]starter\b/i], ["go-getter", /\bgo[- ]getter\b/i],
];
/** Capitalised words that are never a tool/employer claim on their own. */
const PROPER_ALLOW = new Set(("i kpi kpis roi uk us usa eu b2b b2c q1 q2 q3 q4 cv " +
  "january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec " +
  "monday tuesday wednesday thursday friday saturday sunday").split(" "));
/** Inflected ladder forms checked anywhere in a bullet (bare forms like "lead"/"head"/"design" are too often nouns). */
const IRREGULAR = new Set(["built", "led", "ran", "wrote", "drove", "oversaw", "founded", "owned"]);
const DRIFT_K = 3;
/** A source with no ladder verb at all is treated as direct work (matches checks-extra UNLADDERED_SOURCE_LEVEL). */
const UNLADDERED = 2;

type Unit = { text: string; cited: string; bulletId?: string; entryId?: string };

function parseDates(d: string): { start?: string; end?: string } {
  const parts = d.split(/\s*(?:–|—|-|\bto\b)\s*/i).filter(Boolean);
  return { start: parts[0], end: parts[parts.length - 1] };
}

function inferChange(b: TailoredBullet, src: Map<string, string>): TailorChangeType {
  if (b.changeType) return b.changeType;
  if (b.sourceRefs.length >= 2) return "merged";
  const s = src.get(b.sourceRefs[0] ?? "");
  return s !== undefined && norm(s) === norm(b.text) ? "kept" : "rephrased";
}

function mapExtra(i: ExtraIssue): Issue {
  const type = (i.check === "scopedMetrics" ? "inventedMetrics" : i.check) as IssueType;
  return { type, severity: i.severity, bulletId: i.bulletId, entryId: i.roleId, claim: i.evidence ?? "", reason: i.message, check: i.check };
}

/** Tokens in `text` that take part in a skill match (removing them changes extractSkills). */
function partOfSkill(text: string, index: number, len: number): boolean {
  const before = extractSkills(text);
  if (!before.length) return false;
  const blanked = text.slice(0, index) + " ".repeat(len) + text.slice(index + len);
  const after = new Set(extractSkills(blanked));
  return before.some((s) => !after.has(s));
}

export function verifyTailoring(i: VerifyInput): VerifyReport {
  const issues: Issue[] = [];
  const corpus = buildFactCorpus(i.source, i.sourceText, i.confirmedFacts);
  const cNorm = norm(corpus);
  const corpusNums = numberSet(corpus);
  const srcSkills = new Set(extractSkills(corpus));
  const jdStems = new Set(i.jdKeywords.flatMap((k) => [...contentStems(k)]));
  const hardJd = i.jdKeywords.filter((k) => isHardTerm(k) && extractSkills(k).length === 0 && !hasToken(cNorm, k));

  // source bullet lookup: id → text and id → owning entry id
  const srcText = new Map<string, string>();
  const srcOwner = new Map<string, string>();
  for (const e of sections<ParsedCV, CvEntry>(i.source)) for (const b of e.bullets) { srcText.set(b.id, b.text); srcOwner.set(b.id, e.id); }
  for (const e of i.source.education) for (const d of e.details) { srcText.set(d.id, d.text); srcOwner.set(d.id, e.id); }
  const srcEntries = new Map(sections<ParsedCV, CvEntry>(i.source).map((e) => [e.id, e]));

  // ---- #2 unsupportedFacts: entry headers are immutable; unknown entries must be whole-token in the corpus ----
  const tEntries = sections<TailoredCV, TailoredEntry>(i.tailored);
  for (const e of tEntries) {
    const se = srcEntries.get(e.id);
    for (const field of ["org", "title", "dates", "location"] as const) {
      const v = e[field];
      if (!v) continue;
      const ok = se ? norm(se[field]) === norm(v) || (field === "location" && hasToken(cNorm, v))
        : field === "dates" ? (v.match(NUM) ?? []).every((n) => numValues(n).some((x) => corpusNums.has(x))) : hasToken(cNorm, v);
      if (!ok) issues.push({ type: "unsupportedFacts", severity: "block", entryId: e.id, claim: v,
        reason: se ? `Your CV says "${se[field]}" here — tailoring can't change your ${field === "org" ? "employer" : field}` : `"${v}" does not appear in your original CV` });
    }
  }
  const srcEdu = new Map(i.source.education.map((e) => [e.id, e]));
  for (const e of i.tailored.education) {
    const se = srcEdu.get(e.id);
    for (const field of ["institution", "degree", "dates", "grade"] as const) {
      const v = e[field];
      if (!v) continue;
      const ok = se ? norm(se[field] ?? "") === norm(v) : hasToken(cNorm, v);
      if (!ok) issues.push({ type: "unsupportedFacts", severity: "block", entryId: e.id, claim: v,
        reason: se ? `Your CV says "${se[field] ?? ""}" — education details can't change` : `"${v}" does not appear in your original CV` });
    }
  }

  // ---- build text units ----
  const units: Unit[] = [];
  if (i.tailored.summary) units.push({ text: i.tailored.summary, cited: corpus, entryId: "summary" });
  if (i.tailored.interests) units.push({ text: i.tailored.interests, cited: corpus, entryId: "interests" });
  for (const e of i.tailored.education) for (const d of e.details) units.push({ text: d.text, cited: srcText.get(d.id) ?? corpus, bulletId: d.id, entryId: e.id });

  const tailoredRoles: TailoredRole[] = [];
  for (const e of tEntries) {
    const role: TailoredRole = { id: e.id, bullets: [] };
    tailoredRoles.push(role);
    for (const b of e.bullets) {
      const changeType = inferChange(b, srcText);
      role.bullets.push({ id: b.id, text: b.text, sourceRefs: b.sourceRefs, changeType, dropReason: b.dropReason });
      if (changeType === "dropped") continue;
      // ---- #5 orphanBullets ----
      const refs = b.sourceRefs ?? [];
      const reason = refs.length === 0 ? "This bullet isn't linked to anything in your original CV"
        : refs.some((r) => !srcText.has(r)) ? "This bullet cites a line that isn't in your original CV"
        : refs.some((r) => srcOwner.get(r) !== e.id) ? "This bullet borrows a line from a different role — it must stay with the role it happened in"
        : changeType === "merged" && new Set(refs).size < 2 ? "A merged bullet has to cite at least two original bullets"
        : null;
      if (reason) { issues.push({ type: "orphanBullets", severity: "block", bulletId: b.id, entryId: e.id, claim: b.text, reason }); continue; }
      units.push({ text: b.text, cited: refs.map((r) => srcText.get(r)!).join("\n"), bulletId: b.id, entryId: e.id });

      // ---- #6 perBulletDrift: too many new content words ----
      const citedStems = contentStems(units[units.length - 1].cited);
      const fresh = [...contentStems(b.text)].filter((w) => !citedStems.has(w) && !jdStems.has(w));
      if (fresh.length > DRIFT_K) issues.push({ type: "perBulletDrift", severity: "warn", bulletId: b.id, entryId: e.id, claim: fresh.slice(0, 4).join(", "),
        reason: "Lots of new wording — check it still says what you actually did" });
    }
  }

  // ---- per-unit checks: #1 numbers, #4 skills, JD terms, #2 proper nouns, #7 phrases, #3 mid-sentence authorship ----
  const where = (u: Unit) => ({ bulletId: u.bulletId, entryId: u.entryId });
  const invented = new Map<string, Set<string>>(); // unit key → invented values
  const injectedByUnit = new Map<string, Set<string>>();
  const key = (u: { bulletId?: string; entryId?: string }) => u.bulletId ?? `@${u.entryId}`;
  for (const u of units) {
    const k = key(u);
    // #1 inventedMetrics (global): every number must exist in source ∪ confirmed facts
    for (const raw of u.text.match(NUM) ?? []) {
      const vals = numValues(raw);
      if (vals.some((v) => corpusNums.has(v))) continue;
      vals.forEach((v) => (invented.get(k) ?? invented.set(k, new Set()).get(k)!).add(v));
      issues.push({ type: "inventedMetrics", severity: "block", ...where(u), claim: raw.trim(), reason: "This number isn't in your CV — confirm it or we'll leave it out" });
    }
    // #4 skillInjection: canonical skills absent from source ∪ confirmed facts (the JD never counts)
    const inj = new Set<string>();
    for (const s of extractSkills(u.text)) {
      if (srcSkills.has(s)) continue;
      inj.add(s);
      issues.push({ type: "skillInjection", severity: "block", ...where(u), claim: s, reason: `${s} isn't anywhere in your CV — we never add skills you don't have` });
    }
    // JD credentials/tools that aren't skills in the vocab ("CFA Level I")
    const uNorm = norm(u.text);
    const jdHits = hardJd.filter((kw) => hasToken(uNorm, kw));
    for (const kw of jdHits) {
      inj.add(kw);
      issues.push({ type: "skillInjection", severity: "block", ...where(u), claim: kw, reason: `"${kw}" comes from the job description, not your CV — it stays a gap` });
    }
    injectedByUnit.set(k, inj);
    // #2 proper nouns / acronyms (employers, tools) not whole-token in the corpus
    const flagged = new Set<string>();
    for (const m of u.text.matchAll(/[A-Za-z][A-Za-z0-9+#&-]*/g)) {
      const tok = m[0].replace(/-+$/, "");
      const lower = tok.toLowerCase();
      if (tok.length < 2 || PROPER_ALLOW.has(lower) || flagged.has(lower)) continue;
      const allCaps = /^[A-Z0-9&+#-]+$/.test(tok) && /[A-Z].*[A-Z]|[A-Z]\d/.test(tok);
      const before = u.text.slice(0, m.index).trimEnd();
      const sentenceStart = before === "" || /[.!?:;•▪|–—]$/.test(before) || /\s-$/.test(` ${before}`);
      if (!(allCaps || (/^[A-Z]/.test(tok) && !sentenceStart))) continue;
      if (hasToken(cNorm, tok) || jdHits.some((kw) => hasToken(norm(kw), tok)) || [...inj].some((s) => hasToken(norm(s), tok))) continue;
      if (partOfSkill(u.text, m.index!, m[0].length)) continue;
      flagged.add(lower);
      issues.push({ type: "unsupportedFacts", severity: "block", ...where(u), claim: tok, reason: `"${tok}" isn't in your original CV — we don't add employers, tools or credentials` });
    }
    // #7 forbiddenPhrases: block if new, warn if the source already said it (reverting couldn't remove it)
    for (const [label, re] of FORBIDDEN) {
      if (!re.test(u.text)) continue;
      const pre = label === "expert in" ? /\bexpert/i.test(u.cited) : re.test(u.cited);
      issues.push({ type: "forbiddenPhrases", severity: pre ? "warn" : "block", ...where(u), claim: label,
        reason: label === "expert in" ? "Your CV doesn't claim expertise" : "Empty buzzword recruiters discount" });
    }
    for (const [label, re] of WARN_PHRASES) {
      if (re.test(u.text)) issues.push({ type: "forbiddenPhrases", severity: "warn", ...where(u), claim: label, reason: "Generic phrase — show it instead of saying it" });
    }
  }

  // ---- skills list: every item must be a source skill or whole-token in the corpus ----
  const skillClaims = new Set<string>();
  for (const g of i.tailored.skills) for (const item of g.items) {
    const sk = extractSkills(item);
    const missing = sk.length ? sk.filter((s) => !srcSkills.has(s)) : hasToken(cNorm, item) ? [] : [item];
    for (const s of missing) {
      if (skillClaims.has(s)) continue;
      skillClaims.add(s);
      issues.push({ type: "skillInjection", severity: "block", entryId: "skills", claim: s, reason: `${s} isn't anywhere in your CV — we never add skills you don't have` });
    }
  }

  // ---- extra checks (checks-extra): sibling swaps, qualifier drops, ladder escalation, scoped metrics, structure, temporal ----
  const sourceRoles: SourceRole[] = sections<ParsedCV, CvEntry>(i.source).map((e) => ({ id: e.id, org: e.org, title: e.title, dates: parseDates(e.dates), bullets: e.bullets }));
  const orphaned = new Set(issues.filter((x) => x.type === "orphanBullets").map((x) => x.bulletId));
  const extra = runExtraChecks({ sourceRoles, tailoredRoles, confirmedFacts: i.confirmedFacts })
    .filter((x) => !x.bulletId || !orphaned.has(x.bulletId)) // orphanBullets owns uncited bullets
    .map(mapExtra)
    .filter((x) => {
      if (!x.bulletId) return true;
      // scoped metric already reported as a globally invented number → don't double-report
      if (x.check === "scopedMetrics") {
        const vals = numValues(x.claim);
        const inv = invented.get(x.bulletId);
        return !(vals.length && inv && vals.every((v) => inv.has(v)));
      }
      // sibling swap of a tool that's absent from the whole CV → skillInjection already says it
      if (x.check === "siblingContamination") {
        const inj = injectedByUnit.get(x.bulletId);
        const canon = extractSkills(x.claim)[0] ?? x.claim;
        return !inj?.has(canon);
      }
      return true;
    });
  issues.push(...extra);

  // ---- #3 authorshipEscalation, anywhere in the bullet (checks-extra covers the lead verb) ----
  const escalated = new Set(extra.filter((x) => x.type === "authorshipEscalation").map((x) => x.bulletId));
  for (const u of units) {
    if (!u.bulletId || escalated.has(u.bulletId) || u.entryId === undefined || !srcEntries.has(u.entryId)) continue;
    const citedWords = new Set(u.cited.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? []);
    const srcLevels = [...citedWords].map((w) => authorshipLevel(w)).filter((l): l is number => l !== null);
    const srcMax = srcLevels.length ? Math.max(...srcLevels) : UNLADDERED;
    const hit = (u.text.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [])
      .filter((w) => !citedWords.has(w) && (IRREGULAR.has(w) || /(?:ed|ing)$/.test(w)))
      .map((w) => ({ w, l: authorshipLevel(w) }))
      .find((x) => x.l !== null && x.l > srcMax);
    if (hit) issues.push({ type: "authorshipEscalation", severity: "block", bulletId: u.bulletId, entryId: u.entryId, claim: hit.w, check: "authorshipLadder",
      reason: `"${hit.w}" claims more ownership than your original bullet` });
  }

  // ---- #13 AU-01 cliché density on the tailored output ----
  const outText = units.map((u) => u.text).join("\n");
  const cd = clicheDensity(outText);
  if (cd.severity !== "ok") issues.push({ type: "clicheDensity", severity: "warn", claim: `${cd.per100Words.toFixed(1)} per 100 words`,
    reason: `Reads generic (${cd.hits.slice(0, 3).map((h) => h.match).join(", ")}) — say what you did instead` });

  // ---- #8 coverage diagnostic: never a silent pass ----
  if (i.coverageBefore === null || i.coverageAfter === null) {
    issues.push({ type: "coverage", severity: "warn", claim: "unmeasured", reason: "We couldn't measure keyword coverage — check the result against the job yourself" });
  } else if (i.coverageAfter <= i.coverageBefore) {
    issues.push({ type: "coverage", severity: "warn", claim: `${Math.round(i.coverageBefore * 100)}% → ${Math.round(i.coverageAfter * 100)}%`, reason: "Tailoring didn't improve keyword coverage" });
  }
  for (const u of units) {
    if (!u.bulletId) continue;
    const countShaped = (u.text.match(/\b\d[\d,.]*\s+[a-z]/gi) ?? []).length;
    if (countShaped >= 2 && extractMetrics(u.text).length === 0) issues.push({ type: "coverage", severity: "warn", bulletId: u.bulletId, entryId: u.entryId, claim: u.text,
      reason: "This bullet has figures our checker couldn't read — double-check them" });
  }

  const verdict = issues.some((x) => x.severity === "block") ? "block" : issues.length ? "warn" : "pass";
  const report: VerifyReport = { verdict, issues, gapsStillOpen: gapsStillOpen(i) };
  if (i.coverageBefore !== null && i.coverageAfter !== null) {
    const allNorm = norm([outText, ...i.tailored.skills.flatMap((g) => g.items)].join("\n"));
    const tSkills = new Set(extractSkills(outText + "\n" + i.tailored.skills.flatMap((g) => g.items).join(", ")));
    const missing = i.jdKeywords.filter((kw) => { const sk = extractSkills(kw); return sk.length ? sk.some((s) => !tSkills.has(s)) : !hasToken(allNorm, kw); });
    report.keywordCoverage = { before: i.coverageBefore, after: i.coverageAfter, missing };
  }
  return report;
}

// ---------- revertBlocked ----------

export function revertBlocked(tailored: TailoredCV, source: ParsedCV, issues: Issue[]): {
  tailored: TailoredCV; reverted: { bulletId: string; reason: string }[]; removedSkills: string[];
} {
  const srcText = new Map<string, string>();
  const srcOwner = new Map<string, string>();
  for (const e of sections<ParsedCV, CvEntry>(source)) for (const b of e.bullets) { srcText.set(b.id, b.text); srcOwner.set(b.id, e.id); }
  const srcEntries = new Map(sections<ParsedCV, CvEntry>(source).map((e) => [e.id, e]));
  const eduIds = new Set([...source.education.map((e) => e.id), ...tailored.education.map((e) => e.id)]);

  const blocks = issues.filter((x) => x.severity === "block");
  const injected = blocks.filter((x) => x.type === "skillInjection").map((x) => x.claim);
  const injectedSkills = new Set(injected.filter((c) => extractSkills(c).length).map((c) => extractSkills(c)[0]));
  const mentionsInjected = (text: string) => {
    const n = norm(text);
    return extractSkills(text).some((s) => injectedSkills.has(s)) || injected.some((c) => hasToken(n, c));
  };
  const reasonFor = (pred: (x: Issue) => boolean, fallback: string) => blocks.find(pred)?.reason ?? fallback;
  const badBullets = new Set(blocks.filter((x) => x.bulletId).map((x) => x.bulletId!));
  const orphans = new Set(blocks.filter((x) => x.type === "orphanBullets").map((x) => x.bulletId!));
  const badHeads = new Set(blocks.filter((x) => !x.bulletId && x.entryId).map((x) => x.entryId!));
  const reverted: { bulletId: string; reason: string }[] = [];

  const fixEntries = (es: TailoredEntry[]): TailoredEntry[] => es.flatMap((e) => {
    const se = srcEntries.get(e.id);
    if (!se) { // a whole entry that isn't in the CV
      if (!badHeads.has(e.id) && !e.bullets.some((b) => badBullets.has(b.id))) return [e];
      e.bullets.forEach((b) => reverted.push({ bulletId: b.id, reason: reasonFor((x) => x.entryId === e.id, "This entry isn't in your CV") }));
      return [];
    }
    const head = badHeads.has(e.id) ? { org: se.org, title: se.title, dates: se.dates, location: se.location } : {};
    const present = new Set(e.bullets.map((b) => b.id));
    const bullets = e.bullets.flatMap((b): TailoredBullet[] => {
      if (b.changeType === "dropped") return [b];
      const bad = badBullets.has(b.id) || mentionsInjected(b.text);
      if (!bad) return [b];
      const reason = reasonFor((x) => x.bulletId === b.id, "Mentioned a skill that isn't in your CV");
      reverted.push({ bulletId: b.id, reason });
      if (orphans.has(b.id)) return [];
      const refs = [...new Set(b.sourceRefs)].filter((r) => srcText.has(r) && srcOwner.get(r) === e.id);
      return refs.flatMap((r, n) => {
        if (n > 0 && present.has(r)) return [];
        return [{ id: n === 0 ? b.id : r, text: srcText.get(r)!, sourceRefs: [r], changeType: "kept" as const }];
      });
    });
    return [{ ...e, ...head, bullets }];
  });

  const revertField = (field: "summary" | "interests") => {
    const v = tailored[field];
    if (!v || (!badHeads.has(field) && !mentionsInjected(v))) return v;
    reverted.push({ bulletId: field, reason: reasonFor((x) => x.entryId === field, "Mentioned something that isn't in your CV") });
    return source[field];
  };
  const eduBad = tailored.education.some((e) => badHeads.has(e.id) || e.details.some((d) => badBullets.has(d.id) || mentionsInjected(d.text)))
    || [...badHeads].some((id) => eduIds.has(id) && !srcEntries.has(id));
  if (eduBad) reverted.push({ bulletId: "education", reason: reasonFor((x) => !!x.entryId && eduIds.has(x.entryId), "Education details can't change") });

  const removedSkills: string[] = [];
  const skills = tailored.skills.map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      const drop = injected.includes(it) || extractSkills(it).some((s) => injectedSkills.has(s));
      if (drop) removedSkills.push(it);
      return !drop;
    }),
  }));

  const out: TailoredCV = {
    ...tailored,
    summary: revertField("summary"),
    interests: revertField("interests"),
    education: eduBad ? source.education.map((e) => ({ ...e, details: e.details.map((d) => ({ ...d })) })) : tailored.education,
    experience: fixEntries(tailored.experience), projects: fixEntries(tailored.projects), leadership: fixEntries(tailored.leadership),
    skills,
    changes: [],
  };
  const revertedIds = new Set(reverted.map((r) => r.bulletId));
  out.changes = tailored.changes.filter((c) => !revertedIds.has(c.bulletId));
  return { tailored: out, reverted, removedSkills };
}
