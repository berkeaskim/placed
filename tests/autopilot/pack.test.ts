import { describe, it, expect } from "vitest";
import gh from "../fixtures/autopilot/greenhouse-monzo.json";
import { parseGreenhouse } from "@/lib/autopilot/forms/greenhouse";
import { assemblePack, canOpen, toFillPlan } from "@/lib/autopilot/pack";
import { AYSE_CORE } from "./fixtures";
import type { DraftResult } from "@/lib/autopilot/drafts";

const form = parseGreenhouse(gh, "monzo", "8232726");
const draft: DraftResult = { text: "I like data.", sentences: [], caught: [], words: 3, limit: 250, thin: true, source: "fixture" };
const items = assemblePack(form, AYSE_CORE, {}, { question_69481992: draft });
const by = (t: string) => items.find((i) => i.field.target === t)!;

describe("assemblePack (Monzo)", () => {
  it("groups each question", () => {
    expect(by("first_name")).toMatchObject({ group: "vault", value: "Ayşe" });
    expect(by("resume")).toMatchObject({ group: "vault", sourceLabel: "your tailored CV" });
    expect(by("question_69481992")).toMatchObject({ group: "draft" });
    expect(by("question_69482005").group).toBe("confirm");              // RTW always confirm
    expect(by("question_69481993").group).toBe("yours");                // privacy notice = consent
    expect(by("question_69481997[]")).toMatchObject({ group: "vault", value: ["753686448"] }); // 2028
    expect(by("question_69481999[]").group).toBe("confirm");            // start-date options ambiguous
  });
  it("leaves unanswered optional questions to the student instead of blocking", () => {
    const pronouns = items.find((i) => /pronouns/i.test(i.field.label))!;
    expect(pronouns.group).toBe("yours");                                 // AYSE_CORE has no pronouns
    const coding = items.find((i) => /prior coding experience/i.test(i.field.label))!;
    expect(coding.group).toBe("draft");
  });
  it("never puts EEO or consent in vault/draft", () => {
    for (const i of items) if (/privacy|gender|ethnic/i.test(i.field.label)) expect(["yours"]).toContain(i.group);
  });
  it("opens only when ask/confirm are answered", () => {
    expect(canOpen(items, {})).toBe(false);
    const answers = Object.fromEntries(items.filter((i) => i.group === "ask" || i.group === "confirm").map((i) => [i.field.key, { value: i.field.options[0]?.value ?? "x" }]));
    expect(canOpen(items, answers)).toBe(true);
  });
  it("fills drafts only when approved", () => {
    const plan = toFillPlan(items, { question_69481992: { value: "My own words.", approved: false } });
    expect(plan.find((p) => p.target === "question_69481992")).toMatchObject({ mode: "yours", value: null });
    const ok = toFillPlan(items, { question_69481992: { value: "My own words.", approved: true } });
    expect(ok.find((p) => p.target === "question_69481992")).toMatchObject({ mode: "fill", value: "My own words." });
  });
  it("gives selects their option label", () => {
    const plan = toFillPlan(items, { question_69482005: { value: "753686453" } });
    expect(plan.find((p) => p.target === "question_69482005")).toMatchObject({ mode: "fill", value: "753686453", optionLabel: "I'm a citizen or have permanent residency" });
  });
});
