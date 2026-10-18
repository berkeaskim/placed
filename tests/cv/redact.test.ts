import { describe, it, expect } from "vitest";
import { redactCv } from "@/lib/cv/redact";

const r = (text: string, opts?: Parameters<typeof redactCv>[1]) => redactCv(text, opts).redacted;

describe("redactCv: names", () => {
  it("redacts the heuristic first-line name everywhere it recurs, incl. signature", () => {
    const out = r(`James Smith
EDUCATION
University College London — BSc Economics
— James Smith`);
    expect(out).toBe(`[NAME]
EDUCATION
University College London — BSc Economics
— [NAME]`);
  });

  it("uses knownName when the first line is not a name, and catches surname-only and initial forms", () => {
    const out = r(`CURRICULUM VITAE
Oluwaseun Adebayo
Mr Adebayo led the team. Signed O. Adebayo`, { knownName: "Oluwaseun Adebayo" });
    expect(out).not.toMatch(/Oluwaseun|Adebayo/);
    expect(out).toContain("Mr [NAME] led the team. Signed [NAME]");
  });

  it("handles apostrophes, hyphens, accents and all-caps headers", () => {
    expect(r(`SIOBHAN O'NEILL\nReferences: Siobhan O’Neill`)).toBe(`[NAME]\nReferences: [NAME]`);
    expect(r(`Amara Okafor-Williams\nby Okafor-Williams`)).toBe(`[NAME]\nby [NAME]`);
    expect(r(`Chloé Martin\nChloé`)).toBe(`[NAME]\n[NAME]`);
  });

  it("does not treat a section heading as a name", () => {
    expect(r(`EDUCATION\nUCL — BSc`)).toBe(`EDUCATION\nUCL — BSc`);
  });

  it("does not redact a surname that is part of a university name", () => {
    const out = r(`Emma Brown\nBrown University — exchange term`, { knownName: "Emma Brown" });
    expect(out).toBe(`[NAME]\nBrown University — exchange term`);
  });
});

describe("redactCv: contact details", () => {
  it("redacts emails, including a knownEmail", () => {
    expect(r(`x\nContact: zhang.wei@outlook.com`)).toBe(`x\nContact: [EMAIL]`);
    expect(r(`x\nme: z_w+cv@uni.ac.uk`, { knownEmail: "z_w+cv@uni.ac.uk" })).toBe(`x\nme: [EMAIL]`);
  });

  it("redacts UK and international phone numbers but not dates or money", () => {
    const out = r(`x
+44 7700 900123 | 07700 900123 | +44 (0)20 7946 0958 | (020) 7946 0958
+1 (415) 555-0123 | +86 138 0013 8000 | +234 803 123 4567
Sep 2023 – Jun 2027 | £4,000 budget | 2019-2021 | 01/2024`);
    expect(out).toBe(`x
[PHONE] | [PHONE] | [PHONE] | [PHONE]
[PHONE] | [PHONE] | [PHONE]
Sep 2023 – Jun 2027 | £4,000 budget | 2019-2021 | 01/2024`);
  });

  it("never lets a phone number swallow the next line", () => {
    expect(r(`x\n+44 7700 900123\n12 Kensington Court, London W8 5DL`)).toBe(`x\n[PHONE]\n[ADDRESS]`);
  });

  it("redacts street addresses and UK postcodes, keeping an Address label", () => {
    expect(r(`x\n12 Kensington Court, London W8 5DL | +44 7700 900123`)).toBe(`x\n[ADDRESS] | [PHONE]`);
    expect(r(`x\nAddress: Flat 3, 45 Linthorpe Road, Middlesbrough TS1 5AH`)).toBe(`x\nAddress: [ADDRESS]`);
    expect(r(`x\nLondon EC1V 0HB`)).toBe(`x\n[ADDRESS]`);
  });

  it("keeps the platform domain but redacts profile slugs", () => {
    const out = r(`x
https://www.linkedin.com/in/oluwaseun-adebayo-4b2a91/ | github.com/oadebayo/rent-dashboard
oadebayo.github.io | kaggle.com/oadebayo | medium.com/@oadebayo`);
    expect(out).toBe(`x
https://www.linkedin.com/in/[HANDLE]/ | github.com/[HANDLE]/rent-dashboard
[PORTFOLIO] | kaggle.com/[HANDLE] | medium.com/@[HANDLE]`);
  });

  it("redacts a personal-domain portfolio that contains the name", () => {
    expect(r(`Zhang Wei\nzhangwei.dev | https://www.zhang-wei.co.uk/projects`)).toBe(`[NAME]\n[PORTFOLIO] | [PORTFOLIO]`);
  });

  it("does not touch tech names that look like domains", () => {
    expect(r(`x\nSkills: Node.js, ASP.NET, Next.js, scikit-learn`)).toBe(`x\nSkills: Node.js, ASP.NET, Next.js, scikit-learn`);
  });
});

describe("redactCv: personal and work-authorisation lines", () => {
  it("redacts DOB, age and marital status", () => {
    const out = r(`x
Date of Birth: 03/04/2004 | Marital status: Single
Age: 21
Born 12 March 2004`);
    expect(out).toBe(`x
[REDACTED_PERSONAL] | [REDACTED_PERSONAL]
[REDACTED_PERSONAL]
[REDACTED_PERSONAL]`);
  });

  it("collapses visa, nationality and sponsorship statements to one placeholder", () => {
    for (const s of [
      "Student visa, eligible for Graduate Route",
      "British citizen",
      "Requires sponsorship",
      "Right to work: Student visa. Eligible for the Graduate Route.",
      "Nationality: Nigerian",
      "Indefinite Leave to Remain (ILR)",
    ]) {
      expect(r(`x\n${s}`)).toBe(`x\n[WORK_AUTHORISATION_STATEMENT]`);
    }
  });

  it("keeps an employer called Visa, Citizens Advice and hackathon sponsors", () => {
    const text = `x
Visa — Spring Insight Programme, 2025
Volunteer adviser, Citizens Advice Westminster
Secured £3k from 4 corporate sponsors for a 200-person hackathon`;
    expect(r(text)).toBe(text);
  });

  it("only replaces the work-authorisation sentence inside a profile paragraph", () => {
    expect(r(`x\nAnalytical economics student. Holds a Student visa with Graduate Route eligibility. Keen on markets.`)).toBe(
      `x\nAnalytical economics student. [WORK_AUTHORISATION_STATEMENT] Keen on markets.`,
    );
  });
});

describe("redactCv: language labels", () => {
  it("replaces native / mother tongue labels with a neutral [LEVEL], keeping the languages (audit 02#10)", () => {
    expect(r(`x\nLanguages: English (native), French (B2)`)).toBe(`x\nLanguages: English ([LEVEL]), French (B2)`);
    expect(r(`x\nLanguages: Urdu – native, English (fluent, IELTS 8.0)`)).toBe(`x\nLanguages: Urdu ([LEVEL]), English (fluent, IELTS 8.0)`);
    expect(r(`x\nMother tongue: Polish; English C2`)).toBe(`x\n[LEVEL]: Polish; English C2`);
    expect(r(`x\nLanguages: Native Mandarin speaker, English (C1)`)).toBe(`x\nLanguages: Mandarin ([LEVEL]), English (C1)`);
    expect(r(`x\nTurkish (native), French (B2)`)).toBe(`x\nTurkish ([LEVEL]), French (B2)`);
  });

  it("does not touch React Native", () => {
    expect(r(`x\nLanguages & frameworks: TypeScript, React Native`)).toBe(`x\nLanguages & frameworks: TypeScript, React Native`);
  });
});

describe("redactCv: special-category terms", () => {
  it("keeps the role, verb and number around a society", () => {
    expect(r(`x\nTreasurer, Islamic Society, managed £4k budget`)).toBe(`x\nTreasurer, [SOCIETY], managed £4k budget`);
    expect(r(`x\nPresident of the LGBTQ+ Society (2025)`)).toBe(`x\nPresident of the [SOCIETY] (2025)`);
    expect(r(`x\nEvents Officer, UCL Afro-Caribbean Society (ACS) Sep 2024 – present`)).toBe(
      `x\nEvents Officer, UCL [SOCIETY] Sep 2024 – present`,
    );
    expect(r(`x\nMember, Jewish Society (JSoc); Christian Union; Chaplaincy volunteer`)).toBe(
      `x\nMember, [SOCIETY]; [SOCIETY]; [SOCIETY] volunteer`,
    );
  });

  it("uses [AWARD] for allowances and awards", () => {
    expect(r(`x\nRecipient, Disabled Students' Allowance (DSA)`)).toBe(`x\nRecipient, [AWARD]`);
    expect(r(`x\nParalympic GB trialist, wheelchair basketball`)).not.toMatch(/paralymp|wheelchair/i);
  });

  it("redacts health terms in prose", () => {
    const out = r(`x\nDiagnosed with dyslexia and ADHD; young carer for a parent; mental health first aider`);
    expect(out).not.toMatch(/dyslex|ADHD|carer|mental health/i);
  });

  it("keeps DSA as data structures & algorithms when there is no allowance context", () => {
    expect(r(`x\nSkills: Python, DSA, SQL`)).toBe(`x\nSkills: Python, DSA, SQL`);
  });

  it("keeps Women in Tech (documented decision) and neutral societies", () => {
    expect(r(`x\nTreasurer, Women in Tech Society`)).toBe(`x\nTreasurer, Women in Tech Society`);
    expect(r(`x\nTreasurer, Chess Society`)).toBe(`x\nTreasurer, Chess Society`);
  });
});

describe("redactCv: keeps and determinism", () => {
  const cv = `Mohammed Rahman
mohammed.rahman@gmail.com | +44 7700 900123
EDUCATION
University of Manchester — BSc Mathematics, First Class (78%)
Modules: Stochastic Processes (82), Linear Algebra
Manchester Grammar School — A-levels: A*A*A
EXPERIENCE
Goldman Sachs — Spring Week, Apr 2025
• Built a DCF model in Excel valuing a £120m retailer
SKILLS
Python, SQL, Excel, VBA`;

  it("keeps universities, schools, grades, modules, employers, skills and numbers", () => {
    const out = r(cv);
    for (const keep of [
      "University of Manchester — BSc Mathematics, First Class (78%)",
      "Modules: Stochastic Processes (82), Linear Algebra",
      "Manchester Grammar School — A-levels: A*A*A",
      "Goldman Sachs — Spring Week, Apr 2025",
      "• Built a DCF model in Excel valuing a £120m retailer",
      "Python, SQL, Excel, VBA",
    ]) expect(out).toContain(keep);
    expect(out.startsWith("[NAME]\n[EMAIL] | [PHONE]\n")).toBe(true);
  });

  it("is deterministic and reports replacements", () => {
    const a = redactCv(cv);
    const b = redactCv(cv);
    expect(a).toEqual(b);
    expect(a.replacements.map((x) => x.kind)).toEqual(expect.arrayContaining(["name", "email", "phone"]));
    expect(a.replacements.find((x) => x.kind === "email")).toEqual({
      placeholder: "[EMAIL]",
      kind: "email",
      original: "mohammed.rahman@gmail.com",
    });
  });

  it("returns empty input unchanged", () => {
    expect(redactCv("")).toEqual({ redacted: "", replacements: [] });
  });
});

describe("redactCv: review regressions", () => {
  it.each([
    "Completed National Citizen Service (NCS), leading a team of 12 to raise £500 for a local food bank",
    "Secured £2,500 in sponsorship from 3 firms to fund 5 workshops for 120 students",
    "Worked with sponsors; sponsorship covered 5 workshops",
    "Provided Tier 2 technical support to 300 staff, resolving 95% of tickets within SLA",
    "Processed 150 right-to-work checks for seasonal hires",
    "Processed visa applications for 40 visiting researchers",
  ])("keeps achievement line verbatim: %s", (line) => {
    expect(r(`x\n• ${line}`)).toBe(`x\n• ${line}`);
  });

  it.each([
    "I am a British citizen",
    "Holder of a Tier 4 visa",
    "Visa sponsorship required",
    "Eligible to work in the UK without sponsorship",
    "Citizenship: Irish",
    "Full right to work in the UK",
  ])("still redacts status statement: %s", (line) => {
    expect(r(`x\n${line}`)).toBe(`x\n[WORK_AUTHORISATION_STATEMENT]`);
  });

  it("never redacts a single name token inside a university or employer", () => {
    expect(r(`Sam York\nUniversity of York — BSc Physics\nby Sam York`)).toBe(`[NAME]\nUniversity of York — BSc Physics\nby [NAME]`);
    expect(r(`Ruby Morgan\nMorgan Stanley — Spring Week\nSkills: Ruby on Rails, Julia\n— Ruby Morgan`)).toBe(
      `[NAME]\nMorgan Stanley — Spring Week\nSkills: Ruby on Rails, Julia\n— [NAME]`,
    );
    expect(r(`Julia Grant\nResearch Grant: £2k; Julia, Python`)).toBe(`[NAME]\nResearch Grant: £2k; Julia, Python`);
    expect(r(`Priya Shah\nJ.P. Morgan — Insight Day; Chase UK`, { knownName: "Priya Morgan" })).toBe(
      `[NAME]\nJ.P. Morgan — Insight Day; Chase UK`,
    );
  });

  it("strips post-nominals from the guessed name", () => {
    expect(r(`Sam Lee MEng\nMEng Mechanical Engineering, Imperial College London\n— Sam Lee`)).toBe(
      `[NAME] MEng\nMEng Mechanical Engineering, Imperial College London\n— [NAME]`,
    );
  });

  it("finds the name behind pronouns, a Name: label, or with 5 tokens", () => {
    expect(r(`Sam Lee (she/her)\nLed by Sam Lee`)).not.toMatch(/Sam|Lee|she\/her/);
    expect(r(`Name: Sam Lee\nEmail: x@y.com\nSigned Sam Lee`)).toBe(`Name: [NAME]\nEmail: [EMAIL]\nSigned [NAME]`);
    expect(r(`Muhammad Ali Hassan Ahmed Khan\n— Muhammad Ali Hassan Ahmed Khan`)).toBe(`[NAME]\n— [NAME]`);
  });

  it("does not mangle tech bullets that look like postcodes, disab*, BME or React Native", () => {
    for (const line of [
      "• Benchmarked inference on an M1 8GB MacBook, cutting latency by 40%",
      "• Identified and disabled 3 unused feature flags, shrinking the bundle by 12%",
      "MEng Biomedical Engineering (BME), Year 3",
      "Mobile: React Native - shipped 2 apps",
    ]) {
      expect(r(`x\nEDUCATION\n${line}`)).toBe(`x\nEDUCATION\n${line}`);
    }
  });

  it("still redacts BME in a society context", () => {
    expect(r(`x\nTreasurer, BME Students' Network`)).toBe(`x\nTreasurer, [SOCIETY]`);
  });

  it("runs in linear time on pathological input", () => {
    for (const s of ["a.a.a.".repeat(7000), "a".repeat(40000), "a@".repeat(20000)]) {
      const t0 = performance.now();
      redactCv(s);
      expect(performance.now() - t0).toBeLessThan(150);
    }
  });
});

describe("T2: a name in the PATH of a personal link on any domain (Task 25a fix round 1)", () => {
  it("redacts example.com/<name-slug> to [PORTFOLIO], so two personas' links redact identically", () => {
    const a = redactCv("Ayşe Demir\nLondon | https://example.com/ayse-demir\nEDUCATION", { knownName: "Ayşe Demir" }).redacted;
    const b = redactCv("Oluwaseun Adebayo\nLondon | https://example.com/oluwaseun-adebayo\nEDUCATION", { knownName: "Oluwaseun Adebayo" }).redacted;
    expect(a).toContain("[PORTFOLIO]");
    expect(a).not.toMatch(/demir|ayse/i);
    expect(b).toBe(a);
  });
  it("keeps a link whose path carries no name part", () => {
    expect(redactCv("Ayşe Demir\nhttps://example.com/rent-tracker\nEDUCATION", { knownName: "Ayşe Demir" }).redacted).toContain("example.com/rent-tracker");
  });
});
