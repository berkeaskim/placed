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
