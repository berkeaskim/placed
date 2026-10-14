import { describe, expect, it } from "vitest";
import { companyMatches, matchApplication, normalizeCompany } from "@/lib/inbox/match";
import type { AppRef, Classification, RawEmail } from "@/lib/inbox/types";

const a = (id: string, company: string, title = "Summer Analyst"): AppRef => ({ id, jobId: `j-${id}`, status: "applied", company, title });
const cls = (company: string | null, roleHint: string | null = null): Classification =>
  ({ kind: "received", company, roleHint, deadline: null, actionUrl: null, confidence: 0.9 });
const mail = (from = "no-reply@example.com", subject = "Your application"): RawEmail =>
  ({ id: "m1", from, subject, date: "2026-10-10T09:00:00Z", text: "" });

describe("normalizeCompany", () => {
  it("drops case, punctuation and legal suffixes", () => {
    expect(normalizeCompany("Lendable Ltd.")).toBe("lendable");
    expect(normalizeCompany("Jump Trading LLC")).toBe("jump trading");
    expect(normalizeCompany("Marks & Spencer plc")).toBe("marks and spencer");
    expect(normalizeCompany("  IMC  ")).toBe("imc");
  });
});

describe("companyMatches", () => {
  it("matches equal names and whole-word containment", () => {
    expect(companyMatches("IMC", "IMC Trading")).toBe(true);
    expect(companyMatches("Jane Street Capital", "Jane Street")).toBe(true);
    expect(companyMatches("Lendable Ltd", "lendable")).toBe(true);
  });
  it("does not match partial words or empty names", () => {
    expect(companyMatches("Monzo", "Monzoo")).toBe(false);
    expect(companyMatches("Ltd", "Lendable")).toBe(false);
    expect(companyMatches("", "Lendable")).toBe(false);
  });
});

describe("matchApplication", () => {
  const apps = [a("1", "Lendable", "Credit Analyst Intern"), a("2", "IMC Trading", "Software Engineer Intern"), a("3", "IMC Trading", "Quant Trader Intern")];

  it("matches by the classified company", () => {
    expect(matchApplication(cls("Lendable"), mail(), apps)).toEqual({ app: apps[0], ambiguous: false });
  });
  it("breaks a same-company tie with the role hint", () => {
    expect(matchApplication(cls("IMC", "Quant Trader"), mail(), apps).app?.id).toBe("3");
  });
  it("reports ambiguity when the role hint does not separate them", () => {
    expect(matchApplication(cls("IMC", null), mail(), apps)).toEqual({ app: null, ambiguous: true });
  });
  it("falls back to the sender and subject when the model gave no company", () => {
    expect(matchApplication(cls(null), mail("Lendable Careers <careers@lendable.co.uk>"), apps).app?.id).toBe("1");
  });
  it("does not pick an application when the email names two tracked companies", () => {
    expect(matchApplication(cls(null), mail("Agency <x@agency.com>", "Roles at Lendable and IMC Trading"), apps))
      .toEqual({ app: null, ambiguous: true });
  });
  it("returns no match for an unknown company", () => {
    expect(matchApplication(cls("Celonis"), mail(), apps)).toEqual({ app: null, ambiguous: false });
  });
});
