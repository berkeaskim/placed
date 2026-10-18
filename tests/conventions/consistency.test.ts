import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CFA, CV_GRADE_HIDING, GRADE_POLICY, ONE_PAGE_SECTORS, PROFILE_WORDS, SIR_MADAM, VIRTUAL_WORK_EXPERIENCE, cvMaxPages,
} from "@/lib/conventions";
import { MYTHS, RULES, RULES_BY_ID, type CvRule } from "@/lib/cv-rules";
import { resolvedMaxPages, resolvedStatement } from "@/lib/cv-rules/adjust";
import { LI_RULES } from "@/lib/linkedin-rules";
import { lintParagraph } from "@/lib/cover-letter/rules";
import clRules from "@/lib/cover-letter/rules.json";
import clNotes from "@/lib/cover-letter/sector-notes.json";
import rolePlaybooks from "@/lib/playbooks/data.json";
import tailorPlaybooks from "@/lib/tailor/playbook-data.json";
import { CHECKERS } from "@/lib/cv-score/checkers";
import type { CvContext } from "@/lib/cv-score/context";
import type { Archetype, ParsedCV } from "@/lib/types";

/**
 * Audit 2026-10-18 theme T11: the CV, LinkedIn and cover-letter engines must not contradict each other.
 * lib/conventions.ts is the source of truth; this file scans every shipped rule statement, fix text, example and
 * playbook doc and fails when one of them reintroduces a contradiction.
 */

const SECTORS: Archetype[] = ["software_eng", "data_analytics", "quant_trading", "consulting", "product", "finance_banking", "marketing_growth", "research"];

type Text = { where: string; text: string };

/** Every string inside a JSON value, labelled with its path. */
function strings(v: unknown, where: string, out: Text[] = []): Text[] {
  if (typeof v === "string") out.push({ where, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${where}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, `${where}.${k}`, out);
  return out;
}

const cvRuleTexts = (r: CvRule): Text[] => [
  ...strings({ statement: r.statement, llmGuidance: r.llmGuidance, passExample: r.passExample, failExample: r.failExample }, r.id),
  ...Object.entries(r.sectorAdjust ?? {}).map(([s, a]) => ({ where: `${r.id}.sectorAdjust.${s}`, text: a?.statement ?? "" })),
];

const CV_TEXTS: Text[] = [...RULES.flatMap(cvRuleTexts), ...strings(MYTHS, "MYTHS")];
const LI_TEXTS: Text[] = LI_RULES.flatMap((r) => strings(r, r.id));
const CL_TEXTS: Text[] = [...strings(clRules.rules, "cover-letter.rules"), ...strings(clNotes, "cover-letter.sector-notes")];
const PLAYBOOK_TEXTS: Text[] = [...strings(rolePlaybooks, "playbooks/data.json"), ...strings(tailorPlaybooks, "tailor/playbook-data.json")];

/** The playbook docs the engines were built from (the audit reports themselves quote the wrong forms on purpose). */
const DOCS = [
  "docs/research/cv-rules-general.md", "docs/research/cv-rules-finance-consulting.md", "docs/research/cv-rules-tech-product.md",
  "docs/research/cover-letter/00-playbook.md", "docs/research/linkedin/00-playbook.md", "docs/research/role-playbooks-finance-consulting.md",
];
const DOC_TEXTS: Text[] = DOCS.flatMap((p) => {
  let body = "";
  try { body = readFileSync(p, "utf8"); } catch { return []; }
  return body.split("\n").map((text, i) => ({ where: `${p}:${i + 1}`, text }));
});

const ALL: Text[] = [...CV_TEXTS, ...LI_TEXTS, ...CL_TEXTS, ...PLAYBOOK_TEXTS, ...DOC_TEXTS];

const sentences = (t: string) => t.split(/(?<=[.!?;])\s+|\n+/);
/** A sentence that names a wrong form in order to warn against it. */
const NEGATED = /\b(?:not|never|no|don'?t|forbid\w*|prohibit\w*|breaks?|misuse|isn'?t|instead of|wrong|avoid|disallow\w*|bad|trap|rather than)\b|❌|→ (?:fail|gaps?)\b/i;

/** A wrong form named in order to warn against it: a negation before it, or "breaks…/forbids" shortly after it. */
const warnedAgainst = (re: RegExp) => (s: string) => {
  const m = s.match(re);
  if (!m || m.index === undefined) return false;
  const before = s.slice(0, m.index), after = s.slice(m.index + m[0].length, m.index + m[0].length + 120);
  return NEGATED.test(before) || /\b(?:breaks|forbids?|prohibits?|is not an? allowed|isn'?t allowed|is forbidden|is prohibited)\b/i.test(after);
};

function offenders(texts: Text[], re: RegExp, allow: (sentence: string) => boolean = (s) => NEGATED.test(s)): string[] {
  return texts.flatMap(({ where, text }) => sentences(text).filter((s) => re.test(s) && !allow(s)).map((s) => `${where}: ${s.trim().slice(0, 160)}`));
}

describe("CFA wording (08#10): only CFA Institute's approved forms", () => {
  it("no rule, example or doc teaches a forbidden form", () => {
    expect(offenders(ALL, CFA.forbidden, warnedAgainst(CFA.forbidden))).toEqual([]);
  });
  it("the CV rule's pass example uses the approved wording", () => {
    expect(RULES_BY_ID.get("FIN-11")!.passExample).toContain(CFA.passedLevelI);
    expect(RULES_BY_ID.get("FIN-11")!.statement).toContain(CFA.passedLevelI);
  });
  it("the LinkedIn rule allows 'CFA Program candidate' only with its condition", () => {
    const li = LI_RULES.find((r) => r.id === "LI-FINANCE_BANKING-04")!;
    expect(li.statement).toContain(CFA.candidate);
    expect(li.statement).toContain(CFA.passedLevelI);
  });
});

describe("virtual work experience naming (08#26)", () => {
  it("nothing calls it a 'virtual internship' except to warn against the label", () => {
    expect(offenders(ALL, VIRTUAL_WORK_EXPERIENCE.forbidden, warnedAgainst(VIRTUAL_WORK_EXPERIENCE.forbidden))).toEqual([]);
  });
  it("the finance commitment rule names it the shared way", () => {
    expect(RULES_BY_ID.get("FIN-04")!.llmGuidance).toContain(VIRTUAL_WORK_EXPERIENCE.label);
  });
});

describe("CV page length (PR #52): one page for finance, consulting and quant; one or two full pages elsewhere", () => {
  const g11 = RULES_BY_ID.get("G-11")!;
  it.each(SECTORS)("G-11 limit for %s matches conventions", (s) => {
    expect(resolvedMaxPages(g11, s, "2nd")).toBe(cvMaxPages(s));
    expect(resolvedMaxPages(g11, s, "1st", "spring")).toBe(cvMaxPages(s, "spring"));
  });
  it.each(SECTORS)("G-11 copy for %s states the same length", (s) => {
    const st = resolvedStatement(g11, s).toLowerCase();
    if (ONE_PAGE_SECTORS.includes(s)) {
      expect(st).toMatch(/\bone page\b/);
      expect(st).not.toMatch(/one or two/);
    } else expect(st).toMatch(/one or two (?:full )?(?:a4 )?pages/);
  });
  it("no other rule or doc says every CV must be one page", () => {
    const re = /\b(?:CVs?|résumés?|resumes?)\s+(?:must|should|has to|have to|needs? to)\s+be\s+(?:one|1|a single)[- ]page\b/i;
    // A myth entry states the myth in order to correct it.
    expect(offenders(ALL.filter((t) => !/^MYTHS.*\.myth$/.test(t.where)), re, (x) => NEGATED.test(x) || /\bmyth\b|^\|\s*M\d+\s*\|/i.test(x))).toEqual([]);
  });
  it("no non-finance rule caps the CV at one page", () => {
    const capped = RULES.filter((r) => r.check === "code" && r.checker === "page_count").flatMap((r) =>
      SECTORS.filter((s) => (r.sectors === "all" || r.sectors.includes(s)) && resolvedMaxPages(r, s, "2nd") !== cvMaxPages(s)).map((s) => `${r.id}/${s}`));
    expect(capped).toEqual([]);
  });
});

describe("grade disclosure (01#2, 02#9, 08#9)", () => {
  it("no CV rule copy nudges a student to hide an honest grade", () => {
    const cvAndCvDocs = [...CV_TEXTS, ...DOC_TEXTS.filter((t) => t.where.includes("cv-rules"))];
    expect(offenders(cvAndCvDocs, CV_GRADE_HIDING, () => false)).toEqual([]);
  });
  it("G-32 accepts any result and mentions extenuating circumstances", () => {
    const g32 = RULES_BY_ID.get("G-32")!;
    expect(g32.statement).toMatch(/2:2/);
    expect(g32.statement).toContain(GRADE_POLICY.cv.circumstances);
  });
  it("every LinkedIn Education-grade rule makes a missing grade never a fail", () => {
    const gradeRules = LI_RULES.filter((r) => /\bgrade\b|classification/i.test(r.statement) && /2:1/.test(r.statement));
    expect(gradeRules.length).toBeGreaterThanOrEqual(5);
    const bad = gradeRules.filter((r) => !/never (?:a )?fail|optional/i.test(r.statement)).map((r) => r.id);
    expect(bad).toEqual([]);
  });
});

describe("first person (01#29, 08#25)", () => {
  it("no CV rule tells students to write 'I' in bullets", () => {
    expect(offenders(CV_TEXTS, /\bsay "?I"?,? not "?we\b|\buse "?I"? (?:rather than|instead of|not) "?we\b|\bin (?:the )?first person\b/i, () => false)).toEqual([]);
  });
  it("G-24 limits the no-'I' rule to bullets and leaves the profile alone", () => {
    const g24 = RULES_BY_ID.get("G-24")!;
    expect(g24.statement).toMatch(/bullets/);
    expect(g24.llmGuidance).toMatch(/profile/i);
  });
  it("no LinkedIn rule requires first person", () => {
    expect(offenders(LI_TEXTS.filter((t) => /\.(statement|llmGuidance)$/.test(t.where)), /\b(?:in|written in|use) (?:the )?first[- ]person\b/i,
      (s) => /\bmay\b|\bfine\b|\beither\b|removed/i.test(s))).toEqual([]);
  });
});

describe("profile length (01#15): one rule, in words", () => {
  const cv = (summary: string | null): ParsedCV => ({
    name: "P", email: null, phone: null, location: null, links: [], summary, education: [], experience: [], projects: [], leadership: [],
    skills: [], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
  });
  const status = (words: number | null) => CHECKERS.summary_length(
    { text: "", pageTexts: ["x"], pageCount: 1, fileSize: 1, cv: cv(words === null ? null : Array(words).fill("word").join(" ")), year: "2nd", spellingErrors: [] } as CvContext,
    RULES_BY_ID.get("G-19")!).status;
  it("the checker uses the conventions thresholds", () => {
    expect(status(null)).toBe("not_applicable");
    expect(status(PROFILE_WORDS.pass)).toBe("pass");
    expect(status(PROFILE_WORDS.pass + 1)).toBe("partial");
    expect(status(PROFILE_WORDS.max)).toBe("partial");
    expect(status(PROFILE_WORDS.max + 1)).toBe("fail");
  });
  it("no rule states a different profile length", () => {
    const re = /\b(?:profile|personal statement|summary)\b[^.,;]{0,60}?\b(?:(\d{2,3}) words|(\d)\s*[–-]\s*(\d) lines|(?:two|three) lines)\b/i;
    const bad = CV_TEXTS.flatMap(({ where, text }) => sentences(text).flatMap((s) => {
      const m = s.match(re);
      if (!m) return [];
      const n = m[1] ? Number(m[1]) : null;
      return n === PROFILE_WORDS.pass || n === PROFILE_WORDS.max ? [] : [`${where}: ${s.trim()}`];
    }));
    expect(bad).toEqual([]);
  });
});

describe("cover-letter salutation (09#18): 'Dear Sir/Madam' is fine in the UK", () => {
  it("no rule or doc bans it outright", () => {
    expect(offenders([...CL_TEXTS, ...DOC_TEXTS], /\b(?:never|no|ban\w*|avoid)\b[^.]{0,60}(?:Dear )?Sir\s*(?:\/|or)\s*Madam/i, () => false)).toEqual([]);
  });
  it("CL-42 states the shared salutation copy", () => {
    expect(clRules.rules.find((r) => r.id === "CL-42")!.rule).toContain(SIR_MADAM.copy);
  });
  it("the lexicon treats it as low, 'To whom it may concern' as med", () => {
    expect(lintParagraph("Dear Sir or Madam,").map((h) => h.severity)).toEqual(["low"]);
    expect(lintParagraph("To whom it may concern,").map((h) => h.severity)).toEqual(["med"]);
  });
});

describe("'program' is British for software (09#5)", () => {
  it("the cover-letter lexicon doesn't flag a software program", () => {
    expect(lintParagraph("I wrote a Python program to clean 1,200 listings.")).toEqual([]);
  });
  it("no CV rule example treats 'program' as a US spelling", () => {
    expect(offenders(CV_TEXTS.filter((t) => /G-26/.test(t.where)), /\bprogram\b/i, (s) => /software|computer|Python|script/i.test(s))).toEqual([]);
  });
});

describe("FCQ-12 AI copy is firm-dependent (02#1)", () => {
  const fcq12 = RULES_BY_ID.get("FCQ-12")!;
  it("names the firm's policy when the target firm has one", () => {
    expect(resolvedStatement(fcq12, "consulting", { company: "Bain & Company" })).toMatch(/Bain/);
    expect(resolvedStatement(fcq12, "consulting", { company: "Bain & Company" })).toMatch(/spelling and grammar|grammar/i);
  });
  it("says so when the firm allows AI help", () => {
    expect(resolvedStatement(fcq12, "consulting", { company: "BCG" })).toMatch(/Boston Consulting Group allows AI help/);
  });
  it("stays neutral without a firm, and for a firm with no known policy", () => {
    const neutral = resolvedStatement(fcq12, "consulting");
    expect(neutral).not.toMatch(/AI can help you polish|Bain/i);
    expect(resolvedStatement(fcq12, "consulting", { company: "Acme Widgets Ltd" })).toBe(neutral);
  });
});

describe("role playbooks point at CV rules that exist (PR #52 merged rule ids)", () => {
  it("every ruleIds entry in lib/playbooks/data.json resolves", () => {
    const ids: string[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
        if (k === "ruleIds" && Array.isArray(x)) ids.push(...x);
        else walk(x);
      }
    };
    walk(rolePlaybooks);
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter((id) => !RULES_BY_ID.has(id))).toEqual([]);
  });
});
