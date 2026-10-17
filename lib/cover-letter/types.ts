export type Mode = "skip" | "full_letter" | "short_letter" | "field_answer" | "short_note";
export type Limit = { unit: "words" | "chars"; max: number } | null;
export type SpanKind = "ai" | "theirs";
/** `confirmed`: AI-written text the student marked "This is true" (theirs, shown apart from words they typed). */
export type Span = { start: number; end: number; kind: SpanKind; refs: string[]; flag?: string; confirmed?: boolean };
export type LintHit = { ruleId: string; label: string; severity: "block" | "high" | "med" | "low"; start: number; end: number; scope: SpanKind | "letter" };
export type Fact = { id: string; claim: string; url: string; publisher: string; date: string | null };
export type Answer = {
  id: string; question: "why_firm" | "facts" | "story" | "touchpoint" | "product"; text: string | null; pickedFactIds?: string[]; cvEntryId?: string;
  /** People the answer names: `ok` null until the student confirms (true) or declines (false); all but confirmed names are masked in prompts. */
  persons?: { name: string; ok: boolean | null }[];
};
export type OutputTarget = { kind: "upload" } | { kind: "field"; fieldKey: string; label: string };
export type OutputStatus = "draft" | "ready";
/** A previous state on an output's undo stack; `mode` and `limit` are set when a mode switch replaced it. */
export type UndoEntry = { text: string; spans: Span[]; mode?: Mode; limit?: Limit };
export type ChatMsg = { id: string; from: "bot" | "me"; text: string; kind?: "question" | "research" | "facts" | "done" | "error"; questionId?: Answer["question"] };
