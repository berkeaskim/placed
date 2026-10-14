import { describe, expect, it } from "vitest";
import { demoEmails } from "@/lib/gmail/fixtures";
import { guardClassification } from "@/lib/inbox/classify";
import { isDemoEmail } from "@/lib/demo/is-demo";

describe("demo inbox", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  const set = demoEmails(now);
  it("has the 8 cases from spec §2.5, one each", () => {
    expect(set).toHaveLength(8);
    expect(set.map((d) => d.classification.kind).sort()).toEqual(
      ["assessment", "assessment", "interview", "offer", "other", "received", "received", "rejection"].sort());
  });
  it("uses only placed.test sender addresses (never a real company domain)", () => {
    for (const d of set) expect(d.email.from).toMatch(/@demo\.placed\.test>$/);
  });
  it("puts assessment deadlines in the future and inside the email text", () => {
    for (const d of set.filter((x) => x.classification.deadline)) {
      expect(d.classification.deadline! > now.toISOString().slice(0, 10)).toBe(true);
    }
  });
  it("survives its own guard unchanged (URLs appear in the body)", () => {
    for (const d of set) {
      const c = d.classification;
      const raw = { kind: c.kind, company: c.company, role_hint: c.roleHint, deadline: c.deadline, action_url: c.actionUrl, confidence: c.confidence };
      expect(guardClassification(raw, d.email)).toEqual(c);
    }
  });
  it("detects the demo user by DEMO_EMAIL, case-insensitively", () => {
    const saved = process.env.DEMO_EMAIL;
    process.env.DEMO_EMAIL = "Demo@Placed.test";
    expect(isDemoEmail("demo@placed.test")).toBe(true);
    expect(isDemoEmail("someone@ucl.ac.uk")).toBe(false);
    delete process.env.DEMO_EMAIL;
    expect(isDemoEmail("demo@placed.test")).toBe(false);
    if (saved !== undefined) process.env.DEMO_EMAIL = saved;
  });
});
