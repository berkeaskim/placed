import { describe, it, expect } from "vitest";
import gh from "../fixtures/autopilot/greenhouse-monzo.json";
import { parseGreenhouse } from "@/lib/autopilot/forms/greenhouse";
import { assemblePack, canOpen, toFillPlan } from "@/lib/autopilot/pack";
import { AYSE_CORE } from "./fixtures";
import type { NormalizedForm, FormField } from "@/lib/autopilot/forms/types";
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

const F = (o: Partial<FormField> & Pick<FormField, "key" | "label" | "type">): FormField => ({ required: false, options: [], target: o.key, ...o });
const mk = (fields: FormField[]): NormalizedForm => ({ ats: "ashby", url: "x", fields });
const planOf = (fields: FormField[], answers = {}, extra: Record<string, string> = {}, core = AYSE_CORE) => {
  const it = assemblePack(mk(fields), core, extra, {});
  return { it, plan: toFillPlan(it, answers) };
};
const NOTICE = F({ key: "n", label: "Notice period", type: "select", required: true, options: [{ label: "1 month", value: "a" }, { label: "2 months", value: "b" }] });

describe("toFillPlan hardening", () => {
  it("stale select value -> select-yourself", () => {
    const { plan } = planOf([NOTICE], { n: { value: "STALE" } });
    expect(plan[0]).toMatchObject({ mode: "select-yourself", value: null });
  });
  it("multiselect drops unknown ids; all unknown -> select-yourself; string becomes array", () => {
    const ms = F({ key: "m", label: "Pick some", type: "multiselect", required: true, options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] });
    expect(planOf([ms], { m: { value: ["a", "zzz"] } }).plan[0]).toMatchObject({ mode: "fill", value: ["a"] });
    expect(planOf([ms], { m: { value: ["zzz"] } }).plan[0]).toMatchObject({ mode: "select-yourself", value: null });
    expect(planOf([ms], { m: { value: "b" } }).plan[0]).toMatchObject({ mode: "fill", value: ["b"] });
  });
  it("normalises booleans to true/false for vault and extra", () => {
    const sp = F({ key: "s", label: "Do you require visa sponsorship?", type: "boolean", required: true });
    const ex = F({ key: "e", label: "Are you over 18 and happy to relocate?", type: "boolean", required: true });
    const { it, plan } = planOf([sp, ex], { s: { value: "No" } }, { "are you over 18 and happy to relocate": "Yes" });
    expect(it[1]).toMatchObject({ group: "vault", value: "true" });
    expect(plan[0]).toMatchObject({ mode: "fill", value: "false" });
    expect(plan[1]).toMatchObject({ mode: "fill", value: "true" });
  });
  it("unrecognised boolean text: ask/yours in the pack, select-yourself in the plan", () => {
    const b = (required: boolean) => F({ key: "b", label: "Are you happy to relocate?", type: "boolean", required });
    const x = { "are you happy to relocate": "sometimes" };
    expect(planOf([b(true)], {}, x).it[0].group).toBe("ask");
    expect(planOf([b(false)], {}, x).it[0].group).toBe("yours");
    expect(planOf([b(true)], { b: { value: "maybe" } }, x).plan[0]).toMatchObject({ mode: "select-yourself", value: null });
  });
  it("file fields fill with null", () => {
    expect(planOf([F({ key: "resume", label: "Resume", type: "file" })]).plan[0]).toMatchObject({ mode: "fill", value: null });
  });
  it("confirm items are never filled without an answer", () => {
    const sp = F({ key: "s", label: "Do you require visa sponsorship?", type: "boolean", required: true });
    const { it, plan } = planOf([sp]);
    expect(it[0]).toMatchObject({ group: "confirm", value: "false" });
    expect(plan[0]).toMatchObject({ mode: "yours", value: null });
    expect(plan.find((p) => p.target === "question_69482005")).toBeUndefined();
    const monzo = toFillPlan(items, {}).find((p) => p.target === "question_69482001")!;
    expect(monzo).toMatchObject({ mode: "select-yourself", value: null });
  });
  it("empty approved draft is left to the student", () => {
    const d = (value: string | string[]) => toFillPlan(items, { question_69481992: { value, approved: true } }).find((p) => p.target === "question_69481992");
    expect(d("")).toMatchObject({ mode: "yours", value: null });
    expect(d([])).toMatchObject({ mode: "yours", value: null });
  });
});
