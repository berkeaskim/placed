import { classify } from "./classify";
import { CONFIRM_KEYS, matchOption } from "./options";
import { findRemembered, normLabel, vaultValue, type Core, type Extra } from "./vault";
import type { FormField, NormalizedForm } from "./forms/types";
import type { DraftResult } from "./drafts";

export type PackGroup = "vault" | "ask" | "confirm" | "draft" | "cover" | "yours";
export type PackItem = { field: FormField; group: PackGroup; value: string | string[] | null; sourceLabel: string | null; draft?: DraftResult };
export type Answer = { value: string | string[]; approved?: boolean };
export type Answers = Record<string, Answer>;
export type FillMode = "fill" | "yours" | "select-yourself";
export type FillInstruction = { target: string; type: FormField["type"]; label: string; mode: FillMode; value: string | string[] | null; optionLabel?: string; optionLabels?: string[]; sourceLabel: string | null; asset?: "cv" | "cover" };
/** Ready cover-letter outputs by form field key; `upload` is the letter PDF for the cover file field. */
export type Covers = Record<string, { text: string } | { file: true }>;

const SETUP = "from your setup";
const normBool = (s: string): "true" | "false" | null => {
  const t = s.trim().toLowerCase();
  return t === "yes" || t === "true" ? "true" : t === "no" || t === "false" ? "false" : null;
};
const hasOptions = (f: FormField) => (f.type === "select" || f.type === "multiselect") && f.options.length > 0;
const BEFORE = "you answered this before", SIMILAR = "you answered a similar question";

/** Turns a remembered answer (text, Yes/No, or option label(s)) into this field's value, or null when it no longer fits the field. */
export function rememberedValue(field: FormField, saved: string | string[]): string | string[] | null {
  const list = Array.isArray(saved) ? saved : [saved];
  if (field.type === "boolean" && !field.options.length) return list.length === 1 ? normBool(list[0]) : null;
  if (field.options.length) {
    const hits = list.map((l) => field.options.find((o) => normLabel(o.label) === normLabel(l))?.value).filter((v): v is string => Boolean(v));
    if (!hits.length || (field.type !== "multiselect" && hits.length !== 1)) return null;
    return field.type === "multiselect" ? hits : hits[0];
  }
  if (field.type === "multiselect") return null;
  const t = list.join(", ").trim();
  return t || null;
}

export function assemblePack(form: NormalizedForm, core: Partial<Core>, extra: Extra, drafts: Record<string, DraftResult>): PackItem[] {
  return form.fields.map((field): PackItem => {
    const c = classify(field.label, field.type);
    const item = (group: PackGroup, value: PackItem["value"] = null, sourceLabel: string | null = null): PackItem => ({ field, group, value, sourceLabel });
    // An exact earlier answer fills like setup data; a near-identical question is pre-selected for a one-click confirm.
    // Right to work and sponsorship are always confirmed, whatever was remembered.
    const recall = (): PackItem | null => {
      const r = findRemembered(extra, field.label);
      const v = r && rememberedValue(field, r.value);
      if (!r || v == null) return null;
      const mustConfirm = !r.exact || (c.kind === "vault" && CONFIRM_KEYS.has(c.key));
      return item(mustConfirm ? "confirm" : "vault", v, r.exact ? BEFORE : SIMILAR);
    };
    switch (c.kind) {
      case "consent": case "yours": return item("yours");
      case "eeo": return recall() ?? item("ask"); // asked once whether required or not, then remembered like any short answer
      case "file": return c.which === "cv" ? item("vault", null, "your tailored CV") : c.which === "cover" ? item("cover") : item("yours");
      case "motivation": return item("cover");
      case "freeText": return { ...item("draft"), draft: drafts[field.key] };
      case "extra": {
        const r = recall();
        if (r) return r;
        return item(field.required ? "ask" : "yours"); // never block "Open & fill" on an optional question
      }
      case "vault": {
        if (hasOptions(field) || field.type === "boolean") {
          const opts = field.type === "boolean" && !field.options.length ? [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] : field.options;
          const m = matchOption(c.key, core, opts, field.label);
          if ("ambiguous" in m) return recall() ?? item(vaultValue(core, c.key) ? "confirm" : field.required ? "ask" : "yours");
          const value = field.type === "multiselect" ? [m.value] : m.value;
          return item(CONFIRM_KEYS.has(c.key) ? "confirm" : "vault", value, SETUP);
        }
        const v = vaultValue(core, c.key);
        if (!v) return recall() ?? item(field.required ? "ask" : "yours");
        return item(CONFIRM_KEYS.has(c.key) ? "confirm" : "vault", v, SETUP);
      }
    }
  });
}

export function canOpen(items: PackItem[], answers: Answers): boolean {
  return items.every((i) => (i.group !== "ask" && i.group !== "confirm") || (i.group === "ask" && !i.field.required) || answers[i.field.key] !== undefined);
}

function labelsFor(f: FormField, v: string[]): string[] {
  return v.map((x) => f.options.find((o) => o.value === x)?.label).filter((l): l is string => Boolean(l));
}

function labelFor(f: FormField, v: string | string[] | null): string | undefined {
  if (v == null || !f.options.length) return undefined;
  const first = Array.isArray(v) ? v[0] : v;
  return f.options.find((o) => o.value === first)?.label;
}

export function toFillPlan(items: PackItem[], answers: Answers, covers: Covers = {}): FillInstruction[] {
  return items.map(({ field, group, value, sourceLabel }): FillInstruction => {
    const base = { target: field.target, type: field.type, label: field.label, sourceLabel };
    const a = answers[field.key];
    if (group === "cover") {
      // Only Ready outputs reach `covers`; a file output never fills a text field and the reverse.
      const c = field.type === "file" ? covers.upload : covers[field.key];
      if (c && "file" in c && field.type === "file") return { ...base, mode: "fill", value: null, asset: "cover", sourceLabel: "your cover letter" };
      if (c && "text" in c && field.type !== "file" && c.text.trim()) return { ...base, mode: "fill", value: c.text, sourceLabel: "your cover letter" };
      return { ...base, mode: "yours", value: null };
    }
    if (group === "yours") return { ...base, mode: "yours", value: null };
    if (group === "draft") {
      const empty = !a || (Array.isArray(a.value) ? a.value.every((x) => !x.trim()) : !a.value.trim());
      return a?.approved && !empty ? { ...base, mode: "fill", value: a.value, sourceLabel: "your approved answer" } : { ...base, mode: "yours", value: null };
    }
    const v = group === "vault" ? (a?.value ?? value) : a?.value ?? null;
    if (field.type === "file") return { ...base, mode: "fill", value: null, asset: "cv" };
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
      return Array.isArray(out)
        ? { ...base, mode: "fill", value: out, optionLabel: labelFor(field, out), optionLabels: labelsFor(field, out) }
        : { ...base, mode: "fill", value: out, optionLabel: labelFor(field, out) };
    }
    return { ...base, mode: "fill", value: v };
  });
}
