"use client";
import "./motion.css";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  addFieldOutput, answerQuestion, applySavedStory, confirmPersonAction, confirmTrue, markReady, openCoverLetter, pickFacts,
  saveText, setMode, undoEdit, type CardResult,
} from "@/app/(app)/jobs/[id]/cover-letter-actions";
import type { CardView } from "@/lib/cover-letter/service";
import type { Mode, OutputTarget } from "@/lib/cover-letter/types";
import { cardReducer, initialCardState, outputOf, readyToDraft, type CardEvent, type UserAction } from "./card-state";
import { ChatPane, type ChatHandlers } from "./chat-pane";
import { LetterPane, type LetterHandlers } from "./letter-pane";

const GENERIC = "Something went wrong. Please try again.";
/** Bot replies wait at least this long behind the typing dots, so they don't flash (spec §7: ≤ 450ms). */
const MIN_TYPING_MS = 450;
const POLL_MS = 1500;
const MAX_POLLS = 80;
const CHAT_ACTIONS = new Set<UserAction["kind"]>(["answer", "pick", "savedStory", "person"]);
const MODES: { mode: Mode; label: string }[] = [
  { mode: "full_letter", label: "Full" }, { mode: "short_letter", label: "Short" },
  { mode: "field_answer", label: "Field answer" }, { mode: "short_note", label: "Startup note" },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function call(jobId: string, target: OutputTarget, a: Exclude<UserAction, { kind: "draft" } | { kind: "edit" }>): Promise<CardResult> {
  switch (a.kind) {
    case "open": return openCoverLetter(jobId, target);
    case "answer": return answerQuestion(jobId, a.questionId, a.text);
    case "pick": return pickFacts(jobId, a.factIds);
    case "savedStory": return applySavedStory(jobId, a.storyId);
    case "person": return confirmPersonAction(jobId, a.name, a.ok);
    case "save": return saveText(jobId, a.outputId, a.text);
    case "confirmTrue": return confirmTrue(jobId, a.outputId, a.spanStart);
    case "undo": return undoEdit(jobId, a.outputId);
    case "ready": return markReady(jobId, a.outputId);
    case "mode": return setMode(jobId, a.outputId, a.mode);
    case "addField": return addFieldOutput(jobId, a.label, a.limit);
  }
}

/** Splits an SSE buffer into complete frames; returns the frames and the unfinished rest. */
function frames(buf: string): { events: { event: string; data: string }[]; rest: string } {
  const parts = buf.split("\n\n");
  const rest = parts.pop() ?? "";
  const events = parts.map((f) => {
    let event = "message", data = "";
    for (const line of f.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    return { event, data };
  });
  return { events, rest };
}

/**
 * The cover letter card: chat on the left, the letter filling in live on the right (stacked below 900px).
 * Owns the state (a pure reducer, `card-state.ts`) and the stream reader. Every new action aborts the request in
 * flight and moves the state on at once; stale replies are dropped by sequence number.
 */
export function CoverLetterCard({ jobId, target, autopilot = false, onClose }: { jobId: string; target: OutputTarget; autopilot?: boolean; onClose?: () => void }) {
  const [s, dispatch] = useReducer(cardReducer, undefined, initialCardState);
  const [initial, setInitial] = useState<Set<string>>(() => new Set());
  const seq = useRef(0);
  const ac = useRef<AbortController | null>(null);
  const polls = useRef(0);

  const stream = useCallback(async (a: Extract<UserAction, { kind: "draft" } | { kind: "edit" }>, my: number, interrupted: boolean) => {
    const ctl = new AbortController();
    ac.current = ctl;
    const live = () => my === seq.current && !ctl.signal.aborted;
    const send = (e: CardEvent) => { if (live()) dispatch(e); };
    const body = a.kind === "draft" ? { outputId: a.outputId, kind: "draft" } : { outputId: a.outputId, kind: "edit", edit: a.edit, instruction: a.instruction };
    try {
      let res: Response;
      for (let attempt = 0; ; attempt++) {
        res = await fetch(`/api/cover-letter/${jobId}/draft`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
        });
        // The stream we just interrupted may not have let go of the letter yet: give it a moment.
        if (res.status === 409 && interrupted && attempt < 3) { await sleep(600); if (!live()) return; continue; }
        break;
      }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        send({ type: "error", message: j?.error ?? GENERIC });
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!live()) { void reader.cancel(); return; }
        const f = frames(buf + value);
        buf = f.rest;
        for (const ev of f.events) {
          const data = JSON.parse(ev.data || "null");
          if (ev.event === "phase") send({ type: "phase", phase: data.phase, paragraph: data.paragraph });
          else if (ev.event === "delta") send({ type: "delta", visible: data.visible });
          else if (ev.event === "done") { finished = true; send({ type: "done", view: data as CardView }); }
          else if (ev.event === "error") { finished = true; send({ type: "error", message: data?.message ?? GENERIC }); }
        }
      }
      if (!finished) send({ type: "error", message: "The connection dropped before the letter finished. Please try again." });
    } catch {
      if (!ctl.signal.aborted) send({ type: "error", message: "Couldn't reach Placed. Check it's still running, then try again." });
    } finally {
      if (ac.current === ctl) ac.current = null;
    }
  }, [jobId]);

  const run = useCallback(async (a: UserAction, say?: string) => {
    const interrupted = ac.current !== null;
    ac.current?.abort();
    ac.current = null;
    const my = ++seq.current;
    dispatch({ type: "start", action: a, say });
    if (a.kind === "draft" || a.kind === "edit") return stream(a, my, interrupted);
    const t0 = performance.now();
    let r: CardResult;
    try { r = await call(jobId, target, a); } catch { r = { error: GENERIC }; }
    if (CHAT_ACTIONS.has(a.kind)) await sleep(Math.max(0, MIN_TYPING_MS - (performance.now() - t0)));
    if (my !== seq.current) return;
    if ("error" in r) { dispatch({ type: "error", message: r.error }); return; }
    if (a.kind === "open") setInitial(new Set([...r.chat.map((m) => m.id), ...(r.researchState === "running" ? [] : ["research"])]));
    dispatch({ type: "view", view: r });
  }, [jobId, target, stream]);

  // Open (or reopen) once; leaving the card aborts any stream (the server marks the draft interrupted).
  useEffect(() => {
    const seqRef = seq, acRef = ac;
    queueMicrotask(() => void run({ kind: "open" }));
    return () => { seqRef.current++; acRef.current?.abort(); };
  }, [run]);

  // Research runs in the background: re-read the card every 1.5s while it does, so its block animates.
  const researching = s.view?.researchState === "running" && !s.gen && !s.pending;
  useEffect(() => {
    if (!researching || polls.current >= MAX_POLLS) return;
    const t = setTimeout(async () => {
      polls.current++;
      const my = seq.current;
      const r = await openCoverLetter(jobId, target).catch(() => null);
      if (r && !("error" in r) && my === seq.current) dispatch({ type: "view", view: r });
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [researching, s.view, jobId, target]);

  // Once the student's last answer completes the interview, the letter starts writing by itself.
  const output = outputOf(s.view, s.outputId);
  const canStart = s.armed && !s.gen && !s.pending && s.state !== "error" && readyToDraft(s.view, output);
  useEffect(() => {
    if (!canStart || !output) return;
    queueMicrotask(() => void run({ kind: "draft", outputId: output.id }));
  }, [canStart, output, run]);

  const view = s.view;
  if (!view) {
    return (
      <section className="cl" data-cl-state={s.state} aria-label="Cover letter">
        <div className="head"><h2>Cover letter</h2>{onClose && <button type="button" className="btn" onClick={onClose}>Close</button>}</div>
        <div className="chat" style={{ minHeight: 160 }}>
          {s.state === "error"
            ? <div className="msg bot err" role="alert"><span>{s.error}</span><button type="button" className="act" onClick={() => void run({ kind: "open" })}>Retry</button></div>
            : <div className="msg bot typing" aria-label="Loading"><span /><span /><span /></div>}
        </div>
      </section>
    );
  }

  const busy = s.pending || s.gen !== null;
  const answered = new Set(view.chat.filter((m) => m.from === "me" && m.questionId).map((m) => m.questionId)).size;
  const steps = Math.min(3, answered) + (output?.text.trim() ? 1 : 0);
  const showModes = !autopilot && !view.feedbackOnly && output?.target.kind === "upload" && output.mode !== "skip";

  const chat: ChatHandlers = {
    onAnswer: (questionId, text) => void run({ kind: "answer", questionId, text }, text?.trim() || "Skip"),
    onPick: (factIds) => void run({ kind: "pick", factIds }, view.facts.filter((f) => factIds.includes(f.id)).map((f) => f.claim).join("\n") || "None of these"),
    onSavedStory: (storyId) => void run({ kind: "savedStory", storyId }, view.savedStory?.text),
    onPerson: (name, ok) => void run({ kind: "person", name, ok }),
    onEdit: (edit, say, instruction) => output && void run({ kind: "edit", outputId: output.id, edit, instruction }, say),
    onDraft: () => output && void run({ kind: "draft", outputId: output.id }),
    onRetry: () => s.retry && void run(s.retry),
    onUndo: (id, outputId) => { dispatch({ type: "undoUsed", id }); void run({ kind: "undo", outputId }); },
  };
  const letter: LetterHandlers = {
    onSelect: (outputId) => dispatch({ type: "select", outputId }),
    onSave: (text) => output && void run({ kind: "save", outputId: output.id, text }),
    onConfirmTrue: (spanStart) => output && void run({ kind: "confirmTrue", outputId: output.id, spanStart }),
    onReady: () => output && void run({ kind: "ready", outputId: output.id }),
    onWhyUs: () => void run({ kind: "addField", label: `Why ${view.company}?`, limit: { unit: "words", max: 150 } }),
  };

  return (
    <section className="cl" data-cl-state={s.state} aria-label={`Cover letter for ${view.company}`}>
      <div className="head">
        <h2>Cover letter · {view.company}</h2>
        <div className="head-right">
          {showModes && (
            <div className="seg" role="group" aria-label="Length">
              {MODES.map((m) => (
                <button key={m.mode} type="button" aria-pressed={output.mode === m.mode} disabled={busy}
                  onClick={() => output.mode !== m.mode && void run({ kind: "mode", outputId: output.id, mode: m.mode })}>{m.label}</button>
              ))}
            </div>
          )}
          <div className="steps" aria-label={`Step ${steps} of 4`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < steps ? "on" : undefined} />)}</div>
          {onClose && <button type="button" className="act quiet" onClick={onClose}>Close</button>}
        </div>
      </div>
      <div className="split">
        <ChatPane s={s} view={view} output={output} initial={initial} h={chat} />
        <LetterPane s={s} view={view} output={output} autopilot={autopilot} h={letter} />
      </div>
    </section>
  );
}
