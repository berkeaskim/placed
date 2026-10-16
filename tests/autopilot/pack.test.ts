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
const planOf = (fields: FormField[], answers = {}, extra: Record<string, string | string[]> = {}, core = AYSE_CORE) => {
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

describe("file uploads and inverted sponsorship in the pack", () => {
  it("only a CV upload gets the CV; other uploads stay the student's", () => {
    const { it, plan } = planOf([
      F({ key: "resume", label: "Resume/CV", type: "file", required: true }),
      F({ key: "tr", label: "Upload your academic transcript", type: "file" }),
      F({ key: "ws", label: "Please provide a writing sample", type: "file" }),
      F({ key: "pr", label: "Proof of right to work", type: "file" }),
    ]);
    expect(it.map((i) => i.group)).toEqual(["vault", "yours", "yours", "yours"]);
    expect(plan.map((p) => p.mode)).toEqual(["fill", "yours", "yours", "yours"]);
  });
  it("inverted sponsorship wording is never preselected", () => {
    const f = F({ key: "s", label: "Are you able to work in the UK without needing visa sponsorship?", type: "boolean", required: true });
    expect(planOf([f]).it[0]).toMatchObject({ group: "confirm", value: null });
    const sel = F({ key: "s2", label: "Please confirm you do not require sponsorship", type: "select", required: true, options: [{ label: "Yes", value: "y" }, { label: "No", value: "n" }] });
    expect(planOf([sel]).it[0]).toMatchObject({ group: "confirm", value: null });
  });
  it("multiselects carry the label of every resolved value; singles keep optionLabel only", () => {
    const ms = F({ key: "m", label: "Pick some", type: "multiselect", required: true, options: [{ label: "A", value: "a" }, { label: "B", value: "b" }, { label: "C", value: "c" }] });
    const p = planOf([ms], { m: { value: ["a", "c", "zzz"] } }).plan[0];
    expect(p).toMatchObject({ value: ["a", "c"], optionLabels: ["A", "C"] });
    expect(planOf([NOTICE], { n: { value: "b" } }).plan[0]).toMatchObject({ optionLabel: "2 months" });
    expect(planOf([NOTICE], { n: { value: "b" } }).plan[0]).not.toHaveProperty("optionLabels");
  });
});

describe("remembered answers", () => {
  const offices = (label: string) => F({ key: "o", label, type: "multiselect", required: true, options: [{ label: "London", value: "L" }, { label: "Dublin", value: "D" }, { label: "Paris", value: "P" }] });
  const relocate = (label: string) => F({ key: "r", label, type: "select", required: true, options: [{ label: "Yes", value: "y" }, { label: "No", value: "n" }] });
  it("fills an exact earlier answer, including multiselect labels, without asking", () => {
    const { it, plan } = planOf([offices("Which offices would you consider?")], {}, { "which offices would you consider": ["London", "Paris"] });
    expect(it[0]).toMatchObject({ group: "vault", value: ["L", "P"], sourceLabel: "you answered this before" });
    expect(plan[0]).toMatchObject({ mode: "fill", value: ["L", "P"] });
  });
  it("pre-selects a near-identical question for a one-click confirm", () => {
    const { it } = planOf([relocate("Would you be willing to relocate to London?")], {}, { "are you willing to relocate to london": "Yes" });
    expect(it[0]).toMatchObject({ group: "confirm", value: "y", sourceLabel: "you answered a similar question" });
  });
  it("does not match a negated or different-number question", () => {
    expect(planOf([relocate("Are you NOT willing to relocate to London?")], {}, { "are you willing to relocate to london": "Yes" }).it[0].group).toBe("ask");
    expect(planOf([relocate("Can you work 5 days in the office?")], {}, { "can you work 3 days in the office": "Yes" }).it[0].group).toBe("ask");
  });
  it("asks again when the remembered option no longer exists", () => {
    expect(planOf([relocate("Level of French?")], {}, { "level of french": "Fluent" }).it[0].group).toBe("ask");
  });
  it("uses a remembered answer when setup can't decide, but right to work stays confirm", () => {
    const start = F({ key: "s", label: "When can you start?", type: "select", required: true, options: [{ label: "Summer 2027", value: "a" }, { label: "Autumn 2027", value: "b" }] });
    expect(planOf([start], {}, { "when can you start": "Autumn 2027" }).it[0]).toMatchObject({ group: "vault", value: "b" });
    const rtw = F({ key: "w", label: "What is your right to work status?", type: "select", required: true, options: [{ label: "Option A", value: "a" }, { label: "Option B", value: "b" }] });
    expect(planOf([rtw], {}, { "what is your right to work status": "Option B" }).it[0]).toMatchObject({ group: "confirm", value: "b" });
  });
});
