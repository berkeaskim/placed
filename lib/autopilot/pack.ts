import { classify } from "./classify";
import { CONFIRM_KEYS, matchOption } from "./options";
import { normLabel, vaultValue, type Core } from "./vault";
import type { FormField, NormalizedForm } from "./forms/types";
import type { DraftResult } from "./drafts";

export type PackGroup = "vault" | "ask" | "confirm" | "draft" | "yours";
export type PackItem = { field: FormField; group: PackGroup; value: string | string[] | null; sourceLabel: string | null; draft?: DraftResult };
export type Answer = { value: string | string[]; approved?: boolean };
export type Answers = Record<string, Answer>;
export type FillMode = "fill" | "yours" | "select-yourself";
export type FillInstruction = { target: string; type: FormField["type"]; label: string; mode: FillMode; value: string | string[] | null; optionLabel?: string; sourceLabel: string | null };

const SETUP = "from your setup";
const normBool = (s: string): "true" | "false" | null => {
  const t = s.trim().toLowerCase();
  return t === "yes" || t === "true" ? "true" : t === "no" || t === "false" ? "false" : null;
};
const hasOptions = (f: FormField) => (f.type === "select" || f.type === "multiselect") && f.options.length > 0;

export function assemblePack(form: NormalizedForm, core: Partial<Core>, extra: Record<string, string>, drafts: Record<string, DraftResult>): PackItem[] {
  return form.fields.map((field): PackItem => {
    const c = classify(field.label, field.type);
    const item = (group: PackGroup, value: PackItem["value"] = null, sourceLabel: string | null = null): PackItem => ({ field, group, value, sourceLabel });
    switch (c.kind) {
      case "eeo": case "consent": case "yours": return item("yours");
      case "file": return c.which === "cv" ? item("vault", null, "your tailored CV") : item("yours");
      case "freeText": return { ...item("draft"), draft: drafts[field.key] };
      case "extra": {
        const saved = extra[normLabel(field.label)];
        if (!saved) return item(field.required ? "ask" : "yours"); // never block "Open & fill" on an optional question
        if (field.type === "boolean" && !field.options.length) {
          const b = normBool(saved);
          return b ? item("vault", b, "you answered this before") : item(field.required ? "ask" : "yours");
        }
        if (!hasOptions(field)) return item("vault", saved, "you answered this before");
        const hit = field.options.find((o) => normLabel(o.label) === normLabel(saved));
        return hit ? item("vault", field.type === "multiselect" ? [hit.value] : hit.value, "you answered this before") : item(field.required ? "ask" : "yours");
      }
      case "vault": {
        if (hasOptions(field) || field.type === "boolean") {
          const opts = field.type === "boolean" && !field.options.length ? [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] : field.options;
          const m = matchOption(c.key, core, opts);
          if ("ambiguous" in m) return item(vaultValue(core, c.key) ? "confirm" : field.required ? "ask" : "yours");
          const value = field.type === "multiselect" ? [m.value] : m.value;
          return item(CONFIRM_KEYS.has(c.key) ? "confirm" : "vault", value, SETUP);
        }
        const v = vaultValue(core, c.key);
        if (!v) return item(field.required ? "ask" : "yours");
        return item(CONFIRM_KEYS.has(c.key) ? "confirm" : "vault", v, SETUP);
      }
    }
  });
}

export function canOpen(items: PackItem[], answers: Answers): boolean {
  return items.every((i) => (i.group !== "ask" && i.group !== "confirm") || answers[i.field.key] !== undefined);
}

function labelFor(f: FormField, v: string | string[] | null): string | undefined {
  if (v == null || !f.options.length) return undefined;
  const first = Array.isArray(v) ? v[0] : v;
  return f.options.find((o) => o.value === first)?.label;
}

export function toFillPlan(items: PackItem[], answers: Answers): FillInstruction[] {
  return items.map(({ field, group, value, sourceLabel }): FillInstruction => {
    const base = { target: field.target, type: field.type, label: field.label, sourceLabel };
    const a = answers[field.key];
    if (group === "yours") return { ...base, mode: "yours", value: null };
    if (group === "draft") {
      const empty = !a || (Array.isArray(a.value) ? a.value.every((x) => !x.trim()) : !a.value.trim());
      return a?.approved && !empty ? { ...base, mode: "fill", value: a.value, sourceLabel: "your approved answer" } : { ...base, mode: "yours", value: null };
    }
    const v = group === "vault" ? (a?.value ?? value) : a?.value ?? null;
    if (field.type === "file") return { ...base, mode: "fill", value: null };
    if (v == null) return { ...base, mode: hasOptions(field) ? "select-yourself" : "yours", value: null };
    if (field.type === "boolean" && !field.options.length) {
      const b = typeof v === "string" ? normBool(v) : null;
      return b ? { ...base, mode: "fill", value: b } : { ...base, mode: "select-yourself", value: null };
    }
    if (field.options.length && (field.type === "select" || field.type === "multiselect" || field.type === "boolean")) {
      const known = new Set(field.options.map((o) => o.value));
      const vals = (Array.isArray(v) ? v : [v]).filter((x) => known.has(x));
      if (!vals.length) return { ...base, mode: "select-yourself", value: null };
      const out = field.type === "multiselect" ? vals : vals[0];
      return { ...base, mode: "fill", value: out, optionLabel: labelFor(field, out) };
    }
    return { ...base, mode: "fill", value: v };
  });
}
