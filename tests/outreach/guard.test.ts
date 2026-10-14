import { describe, expect, it } from "vitest";
import ayse from "@/seed/demo/ayse.json";
import type { ParsedCV } from "@/lib/types";
import { CONNECTION_NOTE_MAX, checkOutreach, fitToLimit, removeSentences, type GuardSource } from "@/lib/outreach/guard";

const cv = ayse as unknown as ParsedCV;
const src = (note: string | null = null): GuardSource => ({ cv, cvText: "", facts: [], note, company: "Lendable", jobTitle: "Credit Analyst Intern (June 2027)" });

describe("checkOutreach passes honest messages", () => {
  it("allows CV facts, the target company and the job title", () => {
    const t = "Hi Sam, I'm a second-year Economics student at UCL applying for Lendable's Credit Analyst Intern role. " +
      "I built a London rent tracker in Python and SQL covering 1,200 listings. Could I ask you 15 minutes of questions about the team?";
    expect(checkOutreach(t, src())).toEqual([]);
  });
});

describe("checkOutreach blocks fabrication", () => {
  it.each([
    ["an invented skill", "I have built trading models in Kubernetes and Rust."],
    ["an invented number", "I managed a £50,000 budget for the society."],
    ["an invented employer", "I interned at Goldman Sachs last summer."],
    ["a claim about the recipient", "I read your article on credit risk and loved it."],
    ["a mutual connection", "We have a mutual friend from the society."],
    ["a claimed referral", "Alex recommended I reach out to you."],
  ])("%s", (_label, sentence) => {
    const issues = checkOutreach(`Hi Sam, I'm a UCL Economics student. ${sentence} Could we chat?`, src());
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => sentence.includes(i.sentence.trim()) || i.sentence.includes(sentence.trim().slice(0, 20)))).toBe(true);
  });

  it("note backs a 'we met' sentence", () => {
    const t = "Hi Sam, we met at the UCL Finance Society careers evening. Could I ask about your team?";
    expect(checkOutreach(t, src())).not.toEqual([]);
    expect(checkOutreach(t, src("We met at the UCL Finance Society careers evening last week"))).toEqual([]);
  });

  it("note does not launder an employer claim", () => {
    const t = "Hi Sam, I interned at Goldman Sachs. Could we chat?";
    expect(checkOutreach(t, src("I'm a Goldman Sachs intern"))).not.toEqual([]);
  });
});

describe("removeSentences and fitToLimit", () => {
  it("removes whole sentences and tidies spaces", () => {
    expect(removeSentences("One. Two bad. Three.", ["Two bad."])).toBe("One. Three.");
  });
  it("cuts at the last sentence boundary under the limit", () => {
    const long = `${"A short sentence. ".repeat(30)}`.trim();
    const out = fitToLimit(long);
    expect(out.length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX);
    expect(out.endsWith(".")).toBe(true);
  });
  it("leaves a short note alone and hard-cuts one with no boundary", () => {
    expect(fitToLimit("Hi there.")).toBe("Hi there.");
    expect(fitToLimit("x".repeat(400)).length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX);
  });
});

const wrap = (x: string) => `Hi Sam, I'm a UCL Economics student. ${x} Could we chat?`;
const ROLE = "Hi Sam, I'm a second-year Economics student at UCL applying for Lendable's Credit Analyst Intern role. ";

describe("checkOutreach blocks every probe sentence", () => {
  it.each([
    "I'm President of the UCL Finance Society.",
    "As Head of Events at the UCL Finance Society, I ran our flagship conference.",
    "I'm the sole Events Officer at the UCL Finance Society.",
    "I'm on track for a First-class degree.",
    "I'm predicted a First.",
    "I'm a dean's list student.",
    "I won the UCL Economics Prize last year.",
    "I hold a full scholarship at UCL.",
    "I'm graduating with a Master's in Finance.",
    "I'm CFA Level I certified.",
    "I'm fluent in Spanish and French.",
    "I interned at a hedge fund last summer.",
    "I have three years of experience in data analysis.",
    "I trained dozens of new staff at Marlowe Café.",
    "I managed a budget of fifty thousand pounds.",
    "I'm an expert in credit modelling.",
    "I was solely responsible for the society budget.",
    "I have 3 years of banking experience.",
    "I interned at Lendable last summer.",
    "I worked at Lendable last summer.",
    "I've been offered a place on Lendable's spring week.",
    "I spoke at your panel last month.",
    "I attended your talk at the careers fair.",
    "Priya said you'd be the right person to ask.",
    "I built dashboards for the whole team.",
    "I led a team of five analysts.",
  ])("%s", (sentence) => {
    const t = wrap(sentence);
    const issues = checkOutreach(t, src());
    expect(issues.some((i) => i.sentence === sentence)).toBe(true);
    // every attributed sentence really is in the text, so removeSentences can drop it
    for (const i of issues) expect(t).toContain(i.sentence);
    expect(removeSentences(t, issues.map((i) => i.sentence))).not.toContain(sentence);
  });

  it("blocks Goldman employment claims when Goldman is the target", () => {
    const g = { ...src(), company: "Goldman Sachs" };
    for (const x of ["I was a Goldman Sachs Spring Week intern.", "I interned at Goldman Sachs."]) {
      expect(checkOutreach(wrap(x), g).some((i) => i.sentence === x)).toBe(true);
    }
  });

  it("reports every fabricated sentence, not only the first of each kind", () => {
    const t = wrap("I won the UCL Economics Prize. I hold a full scholarship.");
    const sentences = checkOutreach(t, src()).map((i) => i.sentence);
    expect(sentences).toContain("I won the UCL Economics Prize.");
    expect(sentences).toContain("I hold a full scholarship.");
  });
});

describe("notes never launder the student's own claims", () => {
  it("a note number does not back a number claim", () => {
    const x = "I raised £50,000 for charity.";
    expect(checkOutreach(wrap(x), src("I raised £50,000 for charity")).some((i) => i.sentence === x)).toBe(true);
  });
  it("a negated note does not back 'we met'", () => {
    const x = "We met at the careers fair.";
    expect(checkOutreach(wrap(x), src("I never met him but talked to his colleague")).some((i) => i.sentence === x)).toBe(true);
  });
});

describe("checkOutreach passes honest messages", () => {
  it.each([
    ROLE + "I built a London rent tracker in Python and SQL covering 1,200 listings. Could I ask you two quick questions about the team?",
    ROLE + "Would you have time for a 10-minute call?",
    ROLE + "Any one or two pointers would be great.",
    "Hi Sam, I'm the Events Officer of the UCL Finance Society.",
    "Hi Sam, I'm fluent in English and a native Turkish speaker.",
    "Hi Sam, I'd love to learn more about Lendable's credit team.",
  ])("%s", (t) => {
    expect(checkOutreach(t, src())).toEqual([]);
  });
});

describe("fix round 2", () => {
  const has = (t: string, sentence: string, source: GuardSource = src()) => checkOutreach(t, source).some((i) => i.sentence === sentence);

  it("never blames an unrelated sentence (the greeting survives removal)", () => {
    const t = "Hi Sam, I'm a second-year Economics student at UCL. I led a team at the café. Could we chat?";
    const issues = checkOutreach(t, src());
    expect(issues.every((i) => i.sentence === "I led a team at the café.")).toBe(true);
    expect(removeSentences(t, issues.map((i) => i.sentence))).toContain("Hi Sam, I'm a second-year Economics student at UCL.");
  });

  it.each([
    "I won't take more than 15 minutes.",
    "I'm hoping to work at Lendable one day.",
    "I want to work at Lendable after I graduate.",
    "I've always wanted to intern at Lendable.",
    "I'd love to work at Lendable.",
    "I saw you joined Lendable after UCL.",
    "Keen to hear how you found the move to Lendable.",
    "Any advice for my internship applications would be great.",
    "I noticed Lendable won an award recently.",
    "I'm a member of the UCL Finance Society.",
    "I got A* in Maths.",
  ])("passes: %s", (x) => {
    expect(checkOutreach(`Hi Sam, ${x}`, src())).toEqual([]);
  });

  it.each([
    "I hold a Lendable offer for the summer.",
    "I've already passed the first round at Lendable.",
    "I have an interview with Lendable next week.",
    "I'm a member of the Oxford Chess Society.",
    "I was top of my class.",
    "I got A* in Further Maths.",
    "I tutor GCSE students.",
    "I volunteered at a food bank.",
    "I speak spanish at home.",
    "I told you I interned at Lendable.",
  ])("blocks: %s", (x) => {
    expect(has(wrap(x), x)).toBe(true);
  });

  it("interview claim at the target passes only with allowInterviewClaim", () => {
    const x = "I have an interview coming up at Lendable.";
    expect(has(wrap(x), x)).toBe(true);
    expect(checkOutreach(`Hi Sam, ${x}`, { ...src(), allowInterviewClaim: true })).toEqual([]);
    const o = "I hold a Lendable offer for the summer.";
    expect(has(wrap(o), o, { ...src(), allowInterviewClaim: true })).toBe(true);
  });

  it("does not split on decimals, initialisms or titles", () => {
    const x = "I'm at U.C.L. and raised £1.5m for charity.";
    const t = wrap(x);
    const issues = checkOutreach(t, src());
    expect(issues.some((i) => i.sentence === x)).toBe(true);
    expect(removeSentences(t, issues.map((i) => i.sentence))).not.toMatch(/£1|charity/);
    expect(removeSentences("Dear Mr. Patel, could we chat?", [])).toBe("Dear Mr. Patel, could we chat?");
    expect(removeSentences("Dear Mr. Patel, could we chat? Bad one.", ["Bad one."])).toBe("Dear Mr. Patel, could we chat?");
  });
});
