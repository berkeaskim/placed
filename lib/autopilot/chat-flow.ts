import type { Answers, PackGroup, PackItem } from "./pack";
import type { FormField } from "./forms/types";

export type RowState = "done" | "current" | "upcoming" | "skipped" | "yours";
export type ProgressRow = { key: string; label: string; state: RowState; group: PackGroup; sourceLabel: string | null };
export type Turn =
  | { kind: "summary"; filled: number }
  | { kind: "ask"; key: string }
  | { kind: "answer"; key: string; text: string }
  | { kind: "yours"; labels: string[] };
export type ControlKind = "chips" | "dropdown" | "multi" | "text";

type Opt = { label: string; value: string };
export const YES_NO: Opt[] = [{ label: "Yes", value: "true" }, { label: "No", value: "false" }];
export const optionsOf = (f: FormField): Opt[] | null => (f.options.length ? f.options : f.type === "boolean" ? YES_NO : null);
export const asArray = (v: string | string[] | null | undefined): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
export const displayValue = (f: FormField, v: string | string[] | null | undefined): string => {
  const opts = optionsOf(f);
  return asArray(v).map((x) => opts?.find((o) => o.value === x)?.label ?? x).join(", ");
};

export const coverKey = (item: PackItem): string => (item.field.type === "file" ? "upload" : item.field.key);
export const isAskable = (item: PackItem): boolean => item.group === "confirm" || item.group === "ask" || item.group === "draft" || item.group === "cover";

const isEmpty = (v: string | string[]) => (Array.isArray(v) ? v.every((x) => !x.trim()) : !v.trim());

export function isSkipped(item: PackItem, answers: Answers): boolean {
  const a = answers[item.field.key];
  return item.group === "draft" && !!a && isEmpty(a.value);
}

export function isDone(item: PackItem, answers: Answers, coverReady: ReadonlySet<string>): boolean {
  const a = answers[item.field.key];
  if (item.group === "cover") return coverReady.has(coverKey(item));
  if (item.group === "draft") return !!a && a.approved === true && !isEmpty(a.value);
  return (item.group === "confirm" || item.group === "ask") && a !== undefined;
}

/** An optional question still to ask (an optional diversity question, say) can be skipped in the chat and left blank on the form. */
export const canSkip = (item: PackItem): boolean => item.group === "ask" && !item.field.required;

/** `askSkipped`: field keys of optional questions the student skipped in this chat (client-only, like `coverSkipped`). */
export function nextToAsk(items: PackItem[], answers: Answers, coverReady: ReadonlySet<string>, coverSkipped: ReadonlySet<string>, askSkipped: ReadonlySet<string> = new Set()): PackItem | null {
  return items.find((i) => isAskable(i) && !isDone(i, answers, coverReady) && !isSkipped(i, answers)
    && !(i.group === "cover" && coverSkipped.has(coverKey(i))) && !(canSkip(i) && askSkipped.has(i.field.key))) ?? null;
}

export function progressRows(items: PackItem[], answers: Answers, coverReady: ReadonlySet<string>, current: string | null): ProgressRow[] {
  return items.map((i): ProgressRow => {
    const state: RowState =
      i.group === "vault" ? "done"
      : i.group === "yours" ? "yours"
      : isSkipped(i, answers) ? "skipped"
      : isDone(i, answers, coverReady) ? "done"
      : i.field.key === current ? "current"
      : "upcoming";
    return { key: i.field.key, label: i.field.label, state, group: i.group, sourceLabel: i.sourceLabel };
  });
}

export function transcript(items: PackItem[], answers: Answers, coverReady: ReadonlySet<string>): Turn[] {
  const turns: Turn[] = [];
  const filled = items.filter((i) => i.group === "vault").length;
  if (filled) turns.push({ kind: "summary", filled });
  for (const i of items) {
    if (!isAskable(i)) continue;
    const key = i.field.key;
    if (isSkipped(i, answers)) turns.push({ kind: "ask", key }, { kind: "answer", key, text: "Skipped, I'll write it on the form" });
    else if (isDone(i, answers, coverReady)) {
      const text = i.group === "cover" ? "Cover letter ready" : displayValue(i.field, answers[key].value);
      turns.push({ kind: "ask", key }, { kind: "answer", key, text });
    }
  }
  const yours = items.filter((i) => i.group === "yours").map((i) => i.field.label);
  if (yours.length) turns.push({ kind: "yours", labels: yours });
  return turns;
}

export function controlKind(field: FormField): ControlKind {
  const opts = optionsOf(field);
  if (!opts) return "text";
  if (field.type === "multiselect") return "multi";
  return opts.length <= 4 && opts.every((o) => o.label.length <= 40) ? "chips" : "dropdown";
}
