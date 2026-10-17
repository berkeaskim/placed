import type { CardView, OutputView } from "@/lib/cover-letter/service";
import type { EditKind } from "@/lib/cover-letter/edit";
import type { Answer, Limit, Mode } from "@/lib/cover-letter/types";

/** What the card is doing. Mirrored on the card root as `data-cl-state` (the e2e test reads it). */
export type ClState = "idle" | "thinking" | "researching" | "asking" | "picking" | "drafting" | "checking" | "editing" | "done" | "error";

export type UserAction =
  | { kind: "open" }
  | { kind: "answer"; questionId: Answer["question"]; text: string | null }
  | { kind: "pick"; factIds: string[] }
  | { kind: "savedStory"; storyId: string }
  | { kind: "person"; name: string; ok: boolean }
  | { kind: "draft"; outputId: string }
  | { kind: "edit"; outputId: string; edit: EditKind; instruction?: string }
  | { kind: "save"; outputId: string; text: string }
  | { kind: "confirmTrue"; outputId: string; spanStart: number }
  | { kind: "undo"; outputId: string }
  | { kind: "ready"; outputId: string }
  | { kind: "mode"; outputId: string; mode: Mode }
  | { kind: "addField"; label: string; limit: Limit };

export type CardEvent =
  /** The student did something. `say` adds their words to the chat (edit requests are not in the server transcript). */
  | { type: "start"; action: UserAction; say?: string }
  | { type: "view"; view: CardView }
  | { type: "phase"; phase: "thinking" | "target" | "checking"; paragraph?: number }
  | { type: "delta"; visible: string }
  | { type: "done"; view: CardView }
  | { type: "error"; message: string }
  | { type: "select"; outputId: string }
  | { type: "undoUsed"; id: string };

/** Messages that live only in this card session: edit requests and the "Done: a → b words" notes. */
export type LocalMsg = { id: string; from: "bot" | "me"; text: string; undo?: { outputId: string; used: boolean } };

export type CardState = {
  state: ClState;
  view: CardView | null;
  outputId: string | null;
  /** The draft or edit streaming now; null once it finishes, fails or is interrupted. */
  gen: { kind: "draft"; outputId: string } | { kind: "edit"; outputId: string; edit: EditKind } | null;
  visible: string;
  /** The paragraph an edit is rewriting (0-based, blank-line separated), once the server names it. */
  editing: number | null;
  /** A server action is in flight (the chat shows the typing dots). */
  pending: boolean;
  /** Set when a new action interrupted a stream: the in-flight request must be aborted. */
  abort: boolean;
  error: string | null;
  retry: UserAction | null;
  last: UserAction | null;
  local: LocalMsg[];
  /** The letter was just written: the student's own spans sweep green once. */
  sweep: boolean;
  /** Bumped to replay the lint scan line, over one paragraph or (null) the whole letter. */
  scan: { paragraph: number | null; n: number };
  wordsBefore: number;
  seq: number;
  /** The student just answered: once the interview is over, the letter starts writing by itself. */
  armed: boolean;
  /** The student's answer, shown at once while the server saves it (then its saved copy takes its place). */
  echo: string | null;
};

export const initialCardState = (): CardState => ({
  state: "idle", view: null, outputId: null, gen: null, visible: "", editing: null, pending: false, abort: false,
  error: null, retry: null, last: null, local: [], sweep: false, scan: { paragraph: null, n: 0 }, wordsBefore: 0, seq: 0, armed: false, echo: null,
});

const MODE_NAMES: Partial<Record<Mode, string>> = {
  full_letter: "a full letter", short_letter: "a short letter", field_answer: "a field answer", short_note: "a startup note",
};
const CHAT_ACTIONS = new Set<UserAction["kind"]>(["answer", "pick", "savedStory", "person"]);

export const outputOf = (view: CardView | null, id: string | null): OutputView | null =>
  view?.outputs.find((o) => o.id === id) ?? null;

/** The resting state a view implies when nothing is streaming. */
export function settle(view: CardView | null, outputId: string | null): ClState {
  if (!view) return "idle";
  const n = view.next;
  if (n?.id === "wait_research") return "researching";
  if (n?.id === "facts") return "picking";
  if (n || view.confirmPerson) return "asking";
  return outputOf(view, outputId)?.text.trim() ? "done" : "idle";
}

/** Keeps the selected output; after "add a field answer" selects the new one; else the upload, else the first. */
function pickOutput(prev: CardView | null, next: CardView, current: string | null, preferNew: boolean): string | null {
  if (preferNew) {
    const known = new Set(prev?.outputs.map((o) => o.id));
    const fresh = next.outputs.find((o) => !known.has(o.id));
    if (fresh) return fresh.id;
  }
  if (current && next.outputs.some((o) => o.id === current)) return current;
  return (next.outputs.find((o) => o.target.kind === "upload") ?? next.outputs[0])?.id ?? null;
}

/** The interview is over and the selected output is empty: the letter can be written. */
export function readyToDraft(view: CardView | null, o: OutputView | null): boolean {
  return Boolean(view && o && !view.feedbackOnly && o.mode !== "skip" && view.next === null && !view.confirmPerson && !o.text.trim());
}

const flaggedCount = (o: OutputView | null) => o?.spans.filter((s) => s.kind === "ai" && s.flag).length ?? 0;

function doneNote(s: CardState, view: CardView): LocalMsg | null {
  if (!s.gen) return null;
  const o = outputOf(view, s.gen.outputId);
  const to = o?.words ?? 0;
  const id = `d${s.seq}`;
  const undo = { outputId: s.gen.outputId, used: false };
  if (s.gen.kind === "edit") return { id, from: "bot", text: `Done: ${s.wordsBefore} → ${to} words.`, undo };
  const n = flaggedCount(o);
  const check = n ? ` ${n === 1 ? "One thing" : `${n} things`} to check: highlighted in amber.` : "";
  return { id, from: "bot", text: `Done. ${to} words, your own words in green.${check}`, ...(s.wordsBefore ? { undo } : {}) };
}

export function cardReducer(s: CardState, e: CardEvent): CardState {
  switch (e.type) {
    case "start": {
      const a = e.action;
      const seq = s.seq + 1;
      const chat = CHAT_ACTIONS.has(a.kind);
      const local = e.say && !chat ? [...s.local, { id: `l${seq}`, from: "me" as const, text: e.say }] : s.local;
      const base: CardState = {
        ...s, seq, local, last: a, abort: s.gen !== null, error: null, gen: null, visible: "", editing: null, sweep: false, armed: false, echo: chat ? (e.say ?? null) : null,
        // The last edit's glow is spent: a later re-render must not light that paragraph again.
        scan: { paragraph: null, n: s.scan.n },
      };
      if (a.kind === "draft" || a.kind === "edit") {
        const words = outputOf(s.view, a.outputId)?.words ?? 0;
        const gen = a.kind === "draft" ? { kind: "draft" as const, outputId: a.outputId } : { kind: "edit" as const, outputId: a.outputId, edit: a.edit };
        return { ...base, outputId: a.outputId, gen, pending: false, wordsBefore: words, state: a.kind === "draft" ? "thinking" : "editing" };
      }
      if (chat) return { ...base, pending: true, state: "asking" };
      const state = s.gen || s.state === "error" ? settle(s.view, s.outputId) : s.state;
      return { ...base, pending: true, state };
    }
    case "view": {
      if (s.gen) return { ...s, view: e.view };
      const outputId = pickOutput(s.view, e.view, s.outputId, s.last?.kind === "addField");
      const armed = s.armed || (s.pending && s.last !== null && CHAT_ACTIONS.has(s.last.kind));
      // A new length starts the letter again; the old one went on the undo stack, so say how to get it back.
      const m = s.pending && s.last?.kind === "mode" ? s.last : null;
      const local = m && outputOf(s.view, m.outputId)?.text.trim()
        ? [...s.local, { id: `m${s.seq}`, from: "bot" as const, text: `Switched to ${MODE_NAMES[m.mode] ?? "a new length"}. Your previous letter is saved.`, undo: { outputId: m.outputId, used: false } }]
        : s.local;
      return { ...s, view: e.view, outputId, local, pending: false, abort: false, sweep: false, armed, state: settle(e.view, outputId) };
    }
    case "phase": {
      if (!s.gen) return s;
      if (e.phase === "thinking") return s.gen.kind === "draft" ? { ...s, state: "thinking" } : s;
      if (e.phase === "target") return { ...s, state: "editing", editing: e.paragraph ?? null };
      return { ...s, state: "checking", scan: { paragraph: null, n: s.scan.n + 1 } };
    }
    case "delta": {
      if (!s.gen) return s;
      if (s.state === "drafting" || s.state === "editing") return { ...s, visible: s.visible + e.visible };
      if (s.state === "thinking") return { ...s, state: s.gen.kind === "draft" ? "drafting" : "editing", visible: s.visible + e.visible };
      return s;
    }
    case "done": {
      if (!s.gen) return { ...s, view: e.view };
      const note = doneNote(s, e.view);
      const scan = s.gen.kind === "edit" ? { paragraph: s.editing, n: s.scan.n + 1 } : s.scan;
      return {
        ...s, view: e.view, state: "done", gen: null, editing: null, visible: "", pending: false, abort: false,
        sweep: s.gen.kind === "draft", scan, local: note ? [...s.local, note] : s.local,
        outputId: pickOutput(s.view, e.view, s.gen.outputId, false),
      };
    }
    case "error":
      return { ...s, state: "error", error: e.message, retry: s.last, gen: null, editing: null, visible: "", pending: false, abort: false };
    case "select":
      return s.gen || !s.view?.outputs.some((o) => o.id === e.outputId) ? s : { ...s, outputId: e.outputId, state: settle(s.view, e.outputId) };
    case "undoUsed":
      return { ...s, local: s.local.map((m) => (m.id === e.id && m.undo ? { ...m, undo: { ...m.undo, used: true } } : m)) };
  }
}
