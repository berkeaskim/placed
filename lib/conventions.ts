import type { Archetype } from "@/lib/types";

/**
 * Cross-engine conventions: one source of truth for the things the CV rules, LinkedIn rules and cover-letter rules
 * all state (audit 2026-10-18, theme T11 "contradictions between playbooks"). Rule data reads its wording and
 * thresholds from here, and tests/conventions/consistency.test.ts fails if any shipped rule, fix text, example or
 * playbook doc says something different.
 *
 * Pure data, no I/O.
 */

// ---------------------------------------------------------------- CV page length (settled in PR #52, audit 01#16, 02#3, 03#1)

/**
 * Finance, consulting and quant expect one page (Cambridge, LSE and Warwick careers services). Other sectors accept
 * one or two full A4 pages (TARGETjobs, Prospects); a mostly empty last page is partial. Spring-week CVs are one page.
 */
export const ONE_PAGE_SECTORS: readonly Archetype[] = ["finance_banking", "consulting", "quant_trading"];
export const DEFAULT_MAX_PAGES = 2;

export function cvMaxPages(sector: Archetype, track: "standard" | "spring" = "standard"): 1 | 2 {
  if (track === "spring") return 1;
  return ONE_PAGE_SECTORS.includes(sector) ? 1 : DEFAULT_MAX_PAGES;
}

export const PAGE_LENGTH_COPY = {
  onePage: "one page",
  default: "one or two full A4 pages",
} as const;

// ---------------------------------------------------------------- Grade disclosure (audit 01#2, 02#9, 08#9)

/**
 * Two surfaces, two policies, both honest:
 * - CV (sent to one employer, who asks on the form anyway): state your result in any format, a 2:2 included.
 *   A higher grade never earns extra credit. A missing CV grade fails G-32 by design (it reads as a low one).
 *   Copy must never nudge a student to hide a 2:2.
 * - LinkedIn (public): state it if 2:1 or above; below that it is optional, and a missing grade never fails.
 */
export const GRADE_POLICY = {
  cv: {
    statesAnyResult: true,
    extraCreditForHigherGrade: false,
    missingFails: true,
    circumstances: "If circumstances affected your result, say so in the application form's additional-information box, not on the CV.",
  },
  linkedin: {
    stateAtOrAbove: "2:1",
    belowIsOptional: true,
    missingFails: false,
    copy: "If your grade (or predicted grade) is 2:1 or above, state it in Education. Below that it is optional, and a missing grade is never a fail.",
  },
} as const;

/** CV copy that would tell a student to hide an honest grade. Only LinkedIn may make a 2:1+ grade optional-below. */
export const CV_GRADE_HIDING = /\b(?:only (?:if|when)[^.]{0,40}2[:.]1|(?:leave|omit|drop|hide|remove)[^.]{0,30}(?:a |your )?(?:2[:.]2|third|lower second|grade|result)s?\b(?! requirements)|if (?:it'?s|your grade is) (?:a )?2[:.]1 or above)/i;

// ---------------------------------------------------------------- CFA wording (audit 08#10, CFA Institute trademark guide)

/** https://www.cfainstitute.org/about/governance/policies/trademark-usage-guide-for-cfa-charterholders (accessed 2026-10-18). */
export const CFA = {
  passedLevelI: "Passed Level I of the CFA Program",
  candidate: "CFA Program candidate",
  candidateCondition: "only while registered for an upcoming exam or awaiting results",
  /** Forms CFA Institute does not allow: "CFA Level I", "CFA L1", "Level I CFA", a bare "CFA candidate", "CFA (expected …)". */
  forbidden: /\bCFA\s+(?:Level|L)\s*(?:I{1,3}|[123])\b|\bLevel\s+(?:I{1,3}|[123])\s+CFA\b|(?<!Program )\bCFA candidate\b|\bCFA\s*\(expected/i,
} as const;

/** The approved wording, for rule copy: `Passed Level I of the CFA Program`, not `CFA Level I`. */
export const CFA_WORDING_COPY = `Use CFA Institute's wording: "${CFA.passedLevelI}", or "${CFA.candidate}" (${CFA.candidateCondition}), never "CFA Level I" or "CFA candidate".`;

// ---------------------------------------------------------------- First person (audit 01#29, 08#25, T11)

export const FIRST_PERSON = {
  /** No "I", "my" or "me" in CV experience, project and activity bullets. */
  cvBullets: false,
  /** Prospects: a CV profile may be first or third person, as long as it is consistent. */
  cvProfile: "either, consistently",
  linkedin: true,
  coverLetter: true,
  note: "On LinkedIn and in cover letters \"I\" is fine; on your CV, leave it out of your bullets.",
} as const;

// ---------------------------------------------------------------- Virtual work experience naming (audit 08#26)

export const VIRTUAL_WORK_EXPERIENCE = {
  label: "virtual work experience",
  example: "virtual work experience (e.g. a Forage job simulation)",
  /** Never call it an internship: LinkedIn LI-GEN-02 fails a virtual programme shown as an internship. */
  forbidden: /\bvirtual internships?\b/i,
} as const;

// ---------------------------------------------------------------- CV profile length (audit 01#15)

/**
 * One rule, counted in words: ≤ 100 passes (about four lines), 101–150 is partial, over 150 fails. A profile is
 * optional, so a missing one is never a fail. Replaces the old G-19 (150) / GEN-08 (2–3 lines) / 400-character split.
 */
export const PROFILE_WORDS = { pass: 100, max: 150 } as const;
export const PROFILE_COPY = `A profile is optional. If you include one, keep it to about ${PROFILE_WORDS.pass} words (four lines or so) and make it specific to the role; over ${PROFILE_WORDS.max} words is too long.`;

// ---------------------------------------------------------------- Cover-letter salutation (audit 09#18)

/** Prospects (May 2025) and TARGETjobs still list "Dear Sir/Madam" with "Yours faithfully": fine, but a name or team reads warmer. */
export const SIR_MADAM = {
  allowed: true,
  copy: "'Dear Sir or Madam' is still fine in the UK (with 'Yours faithfully'), but a name or team reads warmer.",
} as const;
