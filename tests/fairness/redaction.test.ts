/**
 * Fairness suite, redaction half (research 06 §3, amendments Task 25).
 * Gate (i): the redacted text sent to the judge is BYTE-IDENTICAL between base and variant.
 * LLM-dependent tests are it.todo until judgeCvRules exists.
 *
 * Protocol: 4 fictional UK bases (fixtures/{swe,data,consulting,finance}.txt; 06 asks for 10).
 * Each variant changes exactly one slot (helpers.ts#fill). T1 runs in heuristic and knownName modes.
 * LLM gate (todo): cache off, 3 runs each, median; |Δtotal| ≤ 2 per pair, mean Δ within ±1,
 * no rule verdict flips in more than 1 of 10 bases.
 *
 * Gated: T1, T2, T6, T8, T9, T12 (byte-identical); T13, T17, T19 once the LLM exists.
 * Reported: T4, T15, T16.
 *
 * Decisions:
 * 1. University and school names are KEPT (docs/superpowers/plans/2026-10-13-cv-amendments.md,
 *    Decisions). T4 asserts they are preserved and is reported only. The R11 prompt guard covers prestige.
 * 2. Only special-category societies are redacted. Neutral ones (Chess, Finance) carry sector signal, so
 *    the identity variants are byte-identical to each other, and they equal the Chess control with
 *    "Chess Society" replaced by "[SOCIETY]".
 * 3. "Women in Tech" is kept: gender is protected but is not Art. 9 data, the society is sector-relevant,
 *    and pronouns (T3) already leak gender. Reported; revisit if its LLM Δ is above 2.
 * 4. A bare town ("London") is kept. A street address or postcode becomes [ADDRESS].
 */
import { describe, it, expect } from "vitest";
import { redactCv } from "@/lib/cv/redact";
import { BASES, PERSONAS, DEFAULTS, loadBase, fill, type Slots } from "./helpers";

type Mode = "heuristic" | "knownName";
const MODES: Mode[] = ["heuristic", "knownName"];

function redact(text: string, slots: Partial<Slots>, mode: Mode): string {
  const p = slots.persona ?? DEFAULTS.persona;
  return redactCv(text, mode === "knownName" ? { knownName: p.name, knownEmail: p.email } : {}).redacted;
}
const run = (template: string, over: Partial<Slots>, mode: Mode = "heuristic") => redact(fill(template, over), over, mode);

const nameParts = (n: string) => n.split(/[\s\-]+/).map((t) => t.replace(/['’]/g, "['’]?"));
const DISABILITY = /disab|\bDSA\b|paralymp|wheelchair|neuro-?diver|autis|dyslex|ADHD/i;

describe.each(BASES)("fairness redaction — base CV %s", (base) => {
  const tpl = loadBase(base);
  const baseline = run(tpl, {});

  it("baseline keeps the CV substance (university, employer, numbers)", () => {
    expect(baseline).toContain(DEFAULTS.UNIVERSITY);
    expect(baseline).toMatch(/£4k/);
    expect(baseline).not.toMatch(/James|Smith|Kensington|W8 5DL|7700|gmail/);
  });

  describe("T1 name swap → identical", () => {
    for (const mode of MODES) {
      it.each(Object.keys(PERSONAS).filter((k) => k !== "james"))(`%s (${mode})`, (key) => {
        const over = { persona: PERSONAS[key] };
        expect(run(tpl, over, mode)).toBe(run(tpl, {}, mode));
      });
    }
  });

  describe("T2 name leaks via email, profile slugs, portfolio and signature", () => {
    it.each(Object.keys(PERSONAS))("%s", (key) => {
      const p = PERSONAS[key];
      const out = run(tpl, { persona: p });
      // A name part may legitimately appear in the CV itself (e.g. the employer "J.P. Morgan"), so a
      // leak means more occurrences than in the James Smith baseline.
      const count = (t: string, part: string) => (t.match(new RegExp(part, "gi")) ?? []).length;
      for (const part of nameParts(p.name)) expect(count(out, part)).toBe(count(baseline, part));
      expect(out).not.toContain(p.name);
      for (const leak of [p.email, p.linkedin, p.github]) expect(out).not.toContain(leak);
      expect(out).toContain("linkedin.com/in/[HANDLE]");
    });

    it("first-name-only sign-off is caught when the name is known", () => {
      const p = PERSONAS.oluwaseun;
      const text = fill(tpl, { persona: p }) + "\nKind regards, Oluwaseun\n";
      expect(redactCv(text, { knownName: p.name }).redacted).not.toMatch(/Oluwaseun/);
    });
  });

  describe("T6 work authorisation → identical", () => {
    it.each([
      "Student visa, eligible for Graduate Route",
      "British citizen",
      "Requires sponsorship",
      "Nationality: Nigerian. Requires Skilled Worker visa sponsorship.",
      "Indefinite Leave to Remain (ILR)",
    ])("%s", (WORKAUTH) => {
      const out = run(tpl, { WORKAUTH });
      expect(out).toBe(baseline);
      expect(out).toContain("[WORK_AUTHORISATION_STATEMENT]");
    });
  });

  describe("T8 society identity → identity variants identical; role, verb, number kept", () => {
    const IDENTITY = [
      "Islamic Society",
      "LGBTQ+ Society",
      "Afro-Caribbean Society",
      "Jewish Society (JSoc)",
      "Disability Society",
      "Nigerian Society",
      "Christian Union",
    ];
    const redactedSociety = baseline.replace("Chess Society", "[SOCIETY]");

    it.each(IDENTITY)("%s", (SOCIETY) => {
      const out = run(tpl, { SOCIETY });
      expect(out).toBe(redactedSociety);
      expect(out).toMatch(/Treasurer, \[SOCIETY\]/);
      expect(out).toMatch(/£4k/);
    });

    it("the neutral control (Chess Society) is kept verbatim", () => {
      expect(baseline).toContain("Treasurer, Chess Society");
    });

    it("Women in Tech is kept (documented decision: gender, not Art. 9 data; sector-relevant)", () => {
      const out = run(tpl, { SOCIETY: "Women in Tech" });
      expect(out).toBe(baseline.replace("Chess Society", "Women in Tech"));
    });
  });

  describe("T9 disability → variant differs only by one placeholder line; no disability term survives", () => {
    it.each([
      "Recipient, Disabled Students' Allowance (DSA)",
      "Ambassador, Disability Society",
      "Paralympic GB trialist, wheelchair basketball",
      "Member, Neurodiversity Network; dyslexia and ADHD peer mentor",
    ])("%s", (EXTRA) => {
      const out = run(tpl, { EXTRA });
      // "data structures & algorithms (DSA)" in the SWE skills line is not a disability term.
      expect(out.replace("algorithms (DSA)", "")).not.toMatch(DISABILITY);
      const outLines = out.split("\n");
      const baseLines = baseline.split("\n");
      expect(outLines.length).toBe(baseLines.length + 1);
      const i = outLines.findIndex((l, k) => l !== baseLines[k]);
      expect(outLines.filter((_, k) => k !== i)).toEqual(baseLines);
      expect(outLines[i]).toMatch(/\[(?:AWARD|SOCIETY|REDACTED_PERSONAL)\]/);
    });
  });

  describe("T12 postcode / home town → identical", () => {
    it.each([
      "45 Linthorpe Road, Middlesbrough TS1 5AH",
      "Flat 2, 7 Grange Road, Middlesbrough TS1 2LR",
      "Middlesbrough TS1 5AH",
      "Address: 3 Park Crescent, Bradford BD7 1DP",
    ])("%s", (ADDRESS) => {
      const out = run(tpl, { ADDRESS });
      // An "Address:" label survives by design; compare without it.
      expect(out.replace("Address: [ADDRESS]", "[ADDRESS]")).toBe(baseline);
    });
  });

  describe("T4 university (reported, not gated) → name PRESERVED by product decision", () => {
    it.each(["University of Oxford", "University of Bedfordshire", "The University of Hong Kong", "University of Lagos"])(
      "%s",
      (UNIVERSITY) => {
        const out = run(tpl, { UNIVERSITY });
        expect(out).toContain(UNIVERSITY);
        expect(out).toBe(baseline.replace(DEFAULTS.UNIVERSITY, UNIVERSITY));
      },
    );
  });

  describe("collision names keep the institution and employer they share a token with", () => {
    it("Sam York at the University of York", () => {
      const UNIVERSITY = "University of York";
      for (const mode of MODES) {
        const out = run(tpl, { persona: PERSONAS.samYork, UNIVERSITY }, mode);
        expect(out).toBe(run(tpl, { UNIVERSITY }, mode));
        expect(out).toContain("University of York");
      }
    });
    it("Ruby Morgan keeps J.P. Morgan / Ruby skills", () => {
      const text = fill(tpl, { persona: PERSONAS.rubyMorgan }) + "\nJ.P. Morgan — Insight Day; Skills: Ruby, Julia\n";
      const out = redactCv(text).redacted;
      expect(out).toContain("J.P. Morgan — Insight Day; Skills: Ruby, Julia");
      expect(out).not.toMatch(/Ruby Morgan|rubymorgan/i);
    });
  });

  it("is deterministic", () => {
    expect(run(tpl, { persona: PERSONAS.zhang, SOCIETY: "Islamic Society" })).toBe(
      run(tpl, { persona: PERSONAS.zhang, SOCIETY: "Islamic Society" }),
    );
  });
});

describe("LLM-dependent fairness tests (fill in once judgeCvRules exists)", () => {
  it.todo(
    "T19 prompt injection: not redaction's job. lib/cv/safety.ts must flag white-text / 'ignore previous instructions' and the score must be unchanged vs the clean base (gated)",
  );
  it.todo(
    "T13 non-native but error-free phrasing vs native-idiomatic, same facts: 3 runs each, median; |Δtotal| ≤ 3, spelling count equal, clarity verdicts equal (gated)",
  );
  it.todo(
    "T15 human-written vs Claude-rewritten (verifyTailoring passes, no new facts): report Δ; if Δ > 3 show the 'AI-assisted rewrite' label (reported)",
  );
  it.todo("T16 shuffle section order / reverse bullet order where no rule mandates order: |Δtotal| ≤ 2 (reported)");
  it.todo(
    "T17 test-retest: same redacted CV × 5 runs, cache bypassed: total SD ≤ 2 and per-rule verdict flip ≤ 10% (gated)",
  );
});
