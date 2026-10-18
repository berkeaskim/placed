import { describe, it, expect } from "vitest";
import gh from "../fixtures/autopilot/greenhouse-monzo.json";
import { parseGreenhouse } from "@/lib/autopilot/forms/greenhouse";
import { assemblePack, canOpen, toFillPlan, type PackItem } from "@/lib/autopilot/pack";
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
    // audit 09 #11: Monzo's "why are you excited to work for Monzo?" is a motivation prompt, so the letter writer owns it
    expect(by("question_69481992")).toMatchObject({ group: "cover" });
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
  it("keeps consent out of vault/draft", () => {
    for (const i of items) if (/privacy/i.test(i.field.label)) expect(i.group).toBe("yours");
  });
  it("eeo is asked, and recalled exactly once remembered", () => {
    const gender = F({ key: "g", label: "How would you describe your gender identity?", type: "select", options: [{ label: "Woman", value: "1" }, { label: "Prefer not to say", value: "2" }] });
    const ask = (required: boolean) => assemblePack({ ats: "greenhouse", url: "u", fields: [{ ...gender, required }] }, AYSE_CORE, {}, {})[0];
    expect(ask(false).group).toBe("ask");
    expect(ask(true).group).toBe("ask");
    const again = assemblePack({ ats: "greenhouse", url: "u", fields: [gender] }, AYSE_CORE, { "how would you describe your gender identity": "Prefer not to say" }, {});
    expect(again[0]).toMatchObject({ group: "vault", value: "2", sourceLabel: "you answered this before" });
  });
  it("a consent label that mentions diversity stays yours", () => {
    const fields = ["I consent to the processing of my diversity data", "I have read the Equal Opportunities policy"].map((label, i) => F({ key: `c${i}`, label, type: "select", required: true, options: [{ label: "Yes", value: "1" }] }));
    for (const i of assemblePack({ ats: "greenhouse", url: "u", fields }, AYSE_CORE, { "i consent to the processing of my diversity data": "Yes" }, {})) expect(i.group).toBe("yours");
  });
  it("an optional ask item never blocks canOpen", () => {
    const g = F({ key: "g", label: "Gender?", type: "select", options: [{ label: "Woman", value: "1" }] });
    const item = (required: boolean): PackItem => ({ field: { ...g, required }, group: "ask", value: null, sourceLabel: null });
    expect(canOpen([item(false)], {})).toBe(true);
    expect(canOpen([item(true)], {})).toBe(false);
    expect(canOpen([item(true)], { g: { value: "1" } })).toBe(true);
  });
  it("opens only when ask/confirm are answered", () => {
    expect(canOpen(items, {})).toBe(false);
    const answers = Object.fromEntries(items.filter((i) => i.group === "ask" || i.group === "confirm").map((i) => [i.field.key, { value: i.field.options[0]?.value ?? "x" }]));
    expect(canOpen(items, answers)).toBe(true);
  });
  it("fills drafts only when approved", () => {
    // a non-motivation free-text question goes to the generic drafter
    const relabelled = { ...form, fields: form.fields.map((f) => (f.target === "question_69481992" ? { ...f, label: "Tell us about a project you're proud of" } : f)) } as NormalizedForm;
    const items = assemblePack(relabelled, AYSE_CORE, {}, { question_69481992: draft });
    expect(items.find((i) => i.field.target === "question_69481992")).toMatchObject({ group: "draft" });
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

describe("Greenhouse identity survey (Monzo)", () => {
  const demo = items.filter((i) => i.field.key.startsWith("demographic_"));
  it("asks every survey question once, without blocking, and leaves the consent box to the student", () => {
    expect(demo).toHaveLength(6);
    for (const i of demo) expect(i.group).toBe("ask");
    expect(canOpen(demo, {})).toBe(true);
    expect(by("gdpr_demographic_data_consent_given_1").group).toBe("yours");
  });
  it("fills the answered survey selects by option label and never ticks consent", () => {
    const plan = toFillPlan(items, { demographic_627: { value: ["3317"] }, demographic_632: { value: ["3353"] } });
    expect(plan.find((p) => p.target === "627")).toMatchObject({ type: "multiselect", mode: "fill", value: ["3317"], optionLabels: ["Woman"] });
    expect(plan.find((p) => p.target === "632")).toMatchObject({ mode: "fill", optionLabels: ["Prefer not to say"] });
    expect(plan.find((p) => p.target === "628")).toMatchObject({ mode: "select-yourself", value: null }); // unanswered: the student's call
    expect(plan.find((p) => p.target === "gdpr_demographic_data_consent_given_1")).toMatchObject({ mode: "yours", value: null });
  });
  it("remembers the answers for the next Greenhouse survey", () => {
    const again = assemblePack(form, AYSE_CORE, { "how would you describe your gender identity": ["Woman"], "do you identify as transgender": ["Prefer not to say"] }, {});
    const g = again.find((i) => i.field.target === "627")!;
    expect(g).toMatchObject({ group: "vault", value: ["3317"], sourceLabel: "you answered this before" });
    expect(toFillPlan(again, {}).find((p) => p.target === "628")).toMatchObject({ mode: "fill", optionLabels: ["Prefer not to say"] });
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

describe("cover group", () => {
  const mk = (label: string, type: FormField["type"]): FormField => ({ key: "k", label, type, required: false, options: [], target: "t" });
  const pack = (f: FormField) => assemblePack({ ...form, fields: [f] }, AYSE_CORE, {}, {})[0];
  it("puts a cover file field and a motivation textarea in the cover group", () => {
    expect(pack(mk("Cover Letter", "file")).group).toBe("cover");
    expect(pack(mk("Why do you want to join us?", "textarea")).group).toBe("cover");
  });
  it("leaves cover items for the student when there is no Ready output", () => {
    const it = [pack(mk("Cover Letter", "file")), pack(mk("Why do you want to join us?", "textarea"))];
    expect(toFillPlan(it, {}, {})).toEqual([expect.objectContaining({ mode: "yours", value: null }), expect.objectContaining({ mode: "yours", value: null })]);
    expect(toFillPlan(it, {})[0]).toMatchObject({ mode: "yours", value: null });
  });
  it("a Ready upload output fills the cover file field with asset: cover", () => {
    const it = [pack(mk("Cover Letter", "file"))];
    expect(toFillPlan(it, {}, { upload: { file: true } })[0]).toMatchObject({ mode: "fill", asset: "cover", value: null, sourceLabel: "your cover letter" });
  });
  it("a Ready field output fills the motivation textarea with its text", () => {
    const it = [pack(mk("Why do you want to join us?", "textarea"))];
    expect(toFillPlan(it, {}, { k: { text: "Because of X." } })[0]).toMatchObject({ mode: "fill", value: "Because of X.", sourceLabel: "your cover letter" });
    expect(toFillPlan(it, {}, { other: { text: "Nope" } })[0]).toMatchObject({ mode: "yours", value: null });
  });
  it("a file output never fills a textarea and a text output never fills a file field", () => {
    const f = pack(mk("Cover Letter", "file")), t = pack(mk("Why do you want to join us?", "textarea"));
    expect(toFillPlan([f], {}, { k: { text: "x" } })[0].mode).toBe("yours");
    expect(toFillPlan([t], {}, { upload: { file: true }, k: { file: true } })[0].mode).toBe("yours");
  });
  it("CV file fields carry asset: cv, and canOpen ignores cover items", () => {
    const cv = assemblePack({ ...form, fields: [mk("Resume/CV", "file")] }, AYSE_CORE, {}, {});
    expect(toFillPlan(cv, {})[0]).toMatchObject({ mode: "fill", asset: "cv" });
    expect(canOpen([pack(mk("Cover Letter", "file")), pack(mk("Why do you want to join us?", "textarea"))], {})).toBe(true);
  });
});
