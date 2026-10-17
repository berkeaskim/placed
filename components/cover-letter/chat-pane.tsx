"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { CardView, OutputView } from "@/lib/cover-letter/service";
import type { EditKind } from "@/lib/cover-letter/edit";
import type { Answer } from "@/lib/cover-letter/types";
import { readyToDraft, showsTyping, type CardState } from "./card-state";
import { EditChips } from "./edit-chips";
import { FactChips } from "./fact-chips";
import { ResearchCard } from "./research-card";

export type ChatHandlers = {
  onAnswer: (questionId: Answer["question"], text: string | null) => void;
  onPick: (factIds: string[]) => void;
  onSavedStory: (storyId: string) => void;
  onPerson: (name: string, ok: boolean) => void;
  onEdit: (kind: EditKind, say: string, instruction?: string) => void;
  onDraft: () => void;
  onRetry: () => void;
  onUndo: (localId: string, outputId: string, paragraph: number | null) => void;
  /** Research outlasted its wait: skip the facts question and go on. */
  onSkipResearch: () => void;
  /** The company lookup failed: run it again. */
  onRetryResearch: () => void;
};

/** A typed request in plain words, mapped to the edit it most likely means (the words go along as the instruction). */
function editFor(text: string): EditKind {
  if (/\b(short|shorter|cut|trim|tighten)\b/i.test(text)) return "shorter";
  if (/\bformal\b/i.test(text)) return "more_formal";
  if (/\b(add|write)\b.*\b(clos|end)/i.test(text)) return "add_close";
  return "free";
}

const staticProps = (on: boolean) => (on ? { "data-static": "" } : {});

/**
 * The left pane: the transcript (server messages, then this session's edit notes), the research block, the current
 * question's chips, and the composer. Messages already there when the card opened don't animate in again.
 */
export function ChatPane({ s, view, output, initial, h }: { s: CardState; view: CardView; output: OutputView | null; initial: Set<string>; h: ChatHandlers }) {
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const q = view.next && view.next.id !== "wait_research" ? view.next : null;
  const busy = s.pending;
  const streaming = s.gen !== null;
  const hasText = !!output?.text.trim();
  const interviewDone = view.next === null && !view.confirmPerson;
  const canEdit = hasText && interviewDone && !view.feedbackOnly && output?.mode !== "skip";
  const typing = showsTyping(s);

  const count = view.chat.length + s.local.length;
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, typing, s.state, view.next?.id, view.researchState]);

  // A new question takes the focus (the composer, or the first fact), so answering never needs a click first.
  const nextId = view.next?.id ?? null;
  const prevNext = useRef(nextId);
  useEffect(() => {
    if (prevNext.current === nextId) return;
    prevNext.current = nextId;
    if (!nextId || nextId === "wait_research") return;
    const el = nextId === "facts" ? chatRef.current?.querySelector<HTMLElement>(".fact") : inputRef.current;
    el?.focus({ preventScroll: true });
  }, [nextId]);

  const research = view.researchState === "running" || view.researchState === "done"
    ? <ResearchCard key="research" company={view.company} running={view.researchState === "running" && !s.stalled} stopped={s.stalled} facts={view.facts} isStatic={initial.has("research") && view.researchState !== "running"} />
    : null;
  const anchor = view.chat.findIndex((m) => m.from === "me" && m.questionId === "why_firm");
  // The echoed answer already popped in; its saved copy replaces it without animating again.
  const lastMe = view.chat.findLastIndex((m) => m.from === "me");
  // A failed lookup's note carries Retry (spec: the step that failed shows Retry).
  const failedNote = view.researchState === "failed" ? view.chat.findLastIndex((m) => m.kind === "research") : -1;
  const rows: ReactNode[] = [];
  view.chat.forEach((m, i) => {
    const echoed = !s.pending && i === lastMe && s.echo !== null && m.text === s.echo;
    rows.push(
      <div key={m.id} className={`msg ${m.from === "bot" ? "bot" : "me"}`} {...staticProps(initial.has(m.id) || echoed)}>
        {m.text}
        {i === failedNote && <button type="button" className="act" disabled={busy || streaming} onClick={h.onRetryResearch}>Retry</button>}
      </div>,
    );
    if (i === anchor && research) rows.push(research);
  });
  if (anchor < 0 && research) rows.push(research);

  const placeholder = view.feedbackOnly ? "Write your letter on the right"
    : q?.id === "facts" ? "Tick the ones that interest you"
      : q ? "Type your answer…"
        : view.next?.id === "wait_research" ? `Reading about ${view.company}…`
          : canEdit ? "Ask for a change, e.g. \"make it shorter\"" : "Type here…";
  // While a reply is pending the input stays focusable (read-only), so focus is never lost between questions.
  const composerOn = !view.feedbackOnly && ((q && q.id !== "facts") || canEdit);
  const canSend = composerOn && !busy;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!canSend || !t) return;
    setDraft("");
    if (q) h.onAnswer(q.id, t);
    else h.onEdit(editFor(t), t, t);
  };

  return (
    <div className="left">
      <div className="chat" ref={chatRef} aria-live="polite">
        {rows}
        {s.pending && s.echo && <div key="echo" className="msg me">{s.echo}</div>}
        {s.local.map((m) => (
          <div key={m.id} className={`msg ${m.from}`}>
            {m.text}
            {m.undo && (
              <button type="button" className="act" disabled={m.undo.used || busy || streaming} onClick={() => h.onUndo(m.id, m.undo!.outputId, m.undo!.paragraph)}>Undo</button>
            )}
          </div>
        ))}
        {s.state === "error" && s.error && (
          <div className="msg bot err" role="alert">
            <span>{s.error}</span>
            {s.retry && <button type="button" className="act" onClick={h.onRetry}>Retry</button>}
            {s.stalled && view.next?.id === "wait_research" && <button type="button" className="act" onClick={h.onSkipResearch}>Carry on without research</button>}
          </div>
        )}
        {typing && <div className="msg bot typing" aria-label="Writing"><span /><span /><span /></div>}

        {!busy && view.confirmPerson && (
          <>
            <div key={`person-${view.confirmPerson.name}`} className="msg bot">Can we name {view.confirmPerson.name} in your letter?</div>
            <div className="actchips">
              <button type="button" className="act" onClick={() => h.onPerson(view.confirmPerson!.name, true)}>Yes</button>
              <button type="button" className="act quiet" style={{ animationDelay: "70ms" }} onClick={() => h.onPerson(view.confirmPerson!.name, false)}>No</button>
            </div>
          </>
        )}
        {!busy && !view.confirmPerson && q?.id === "facts" && <FactChips key={q.id} facts={view.facts} disabled={busy} onPick={h.onPick} />}
        {!busy && !view.confirmPerson && q && q.id !== "facts" && (
          <div className="actchips" key={`chips-${q.id}`}>
            {q.chips.map((c, i) => (c === "Use my saved answer"
              ? view.savedStory && <button key={c} type="button" className="act" style={{ animationDelay: `${i * 70}ms` }} onClick={() => h.onSavedStory(view.savedStory!.id)}>{c}</button>
              : <button key={c} type="button" className="act quiet" style={{ animationDelay: `${i * 70}ms` }} onClick={() => h.onAnswer(q.id, null)}>{c}</button>))}
          </div>
        )}
        {!busy && !streaming && readyToDraft(view, output) && (
          <div className="actchips"><button type="button" className="act" onClick={h.onDraft}>Write my letter</button></div>
        )}
        {!busy && canEdit && <EditChips flagged={!!output?.spans.some((x) => x.kind === "ai" && x.flag)} disabled={busy} onEdit={(k, label) => h.onEdit(k, label)} />}
      </div>
      <form className="composer" onSubmit={submit}>
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={q ? q.text : "Message"} autoComplete="off"
          disabled={!composerOn} readOnly={busy} aria-disabled={busy || undefined} maxLength={1500} />
        <button type="submit" className="send" disabled={!canSend || !draft.trim()} aria-label="Send">↑</button>
      </form>
    </div>
  );
}
