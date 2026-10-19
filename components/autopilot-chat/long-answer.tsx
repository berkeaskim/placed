"use client";
import { useState } from "react";
import Link from "next/link";
import type { Answer, PackItem } from "@/lib/autopilot/pack";
import type { DraftCaught, DraftResult } from "@/lib/autopilot/drafts";
import { draftFor, ideasFor, reviseFor } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { CHIP, SaveError, useSaver } from "./answer-controls";

type Mode = "menu" | "writing" | "draft" | "ideas" | "own" | "edit";
type Idea = { text: string; refs: string[] };
/** What this flow has said so far, oldest first: past bot replies are kept here so the order never shuffles. */
type Entry = { k: "me" | "bot" | "err" | "warn"; text: string; caught?: DraftCaught[] } | { k: "draft"; d: DraftResult } | { k: "ai-off" };

const GENERIC = "Something went wrong. Please try again.";
const THIN = "Not enough on your CV for this one. Add your own words.";
const NO_IDEAS = "I couldn't find a strong angle on your CV. Try writing a few lines and I'll tidy them.";
const IDEAS_LEAD = "A few angles from your CV. Pick any, then write a few lines.";
const KEPT = "I couldn't rewrite this without changing what you said, so I left your words as they are.";
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const sourceChip = (ref: string) => (ref.startsWith("fact:own-") ? "your words" : ref.startsWith("fact:") ? "your confirmed fact" : ref.startsWith("jd:") ? "the job post" : "your CV");
const hasText = (d: DraftResult) => d.source !== "none" && !!d.text.trim();
const usable = (d: DraftResult | null): d is DraftResult => !!d && hasText(d);

export const longLimit = (item: PackItem) => item.draft?.limit ?? item.field.wordLimit ?? 200;

function Counter({ words, limit }: { words: number; limit: number }) {
  return <span className={`count text-xs ${words > limit ? "font-bold text-[#7A4100]" : "text-muted-foreground"}`}>{words} / {limit} words</span>;
}

function DraftBubble({ d }: { d: DraftResult }) {
  const refs = [...new Set(d.sentences.flatMap((s) => s.refs).map(sourceChip))];
  return (
    <div className="msg bot flex flex-col gap-2 whitespace-normal!">
      <p className="whitespace-pre-line">{d.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Counter words={wordCount(d.text)} limit={d.limit} />
        {refs.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground">Built from:</span>
            {refs.map((r) => <span key={r} className="rounded-full bg-[#F1EEFF] px-2 py-0.5 font-semibold text-[#5B3DF5]">{r}</span>)}
          </span>
        )}
      </div>
      <Caught list={d.caught} />
    </div>
  );
}

function Caught({ list }: { list: DraftCaught[] }) {
  if (!list.length) return null;
  return (
    <details className="rounded-lg bg-white/70 px-2.5 py-2 text-xs whitespace-normal">
      <summary className="cursor-pointer font-bold">Caught it: {list.length} sentence{list.length === 1 ? "" : "s"} removed</summary>
      <ul className="mt-1 flex flex-col gap-1">{list.map((c, i) => <li key={i}><span className="font-semibold">{c.reason}:</span> {c.text}</li>)}</ul>
    </details>
  );
}

function LogEntry({ e }: { e: Entry }) {
  if (e.k === "draft") return <>{<DraftBubble d={e.d} />}{e.d.thin && <div className="msg bot">{THIN}</div>}</>;
  if (e.k === "ai-off") {
    return (
      <div className="msg bot err" role="alert">
        {/* AI_NOT_SET_UP (lib/ai/provider is server-side), with the Settings link the ai-off banner uses. */}
        <span>AI isn&apos;t set up yet. Choose Claude, Gemini, ChatGPT or a local model in <Link href="/settings/ai" className="underline">Settings → AI</Link>.</span>
      </div>
    );
  }
  if (e.k === "warn") return <div className="msg bot bg-[#FFF1DC]! font-semibold text-[#7A4100]!" role="status">{e.text}</div>;
  if (e.k === "me") return <div className="msg me self-end">{e.text}</div>;
  if (e.k === "err") return <div className="msg bot err" role="alert">{e.text}</div>;
  return <div className="msg bot flex flex-col gap-2">{e.text}{e.caught && <Caught list={e.caught} />}</div>;
}

/** The long-answer flow for one free-text question: write it for me, ideas, own words, or skip. */
export function LongAnswer({ jobId, item, answer, onSave }: {
  jobId: string; item: PackItem; answer: Answer | undefined; onSave: (value: string, approved: boolean) => Promise<boolean>;
}) {
  const key = item.field.key;
  const saved = typeof answer?.value === "string" ? answer.value : "";
  const [mode, setMode] = useState<Mode>(saved.trim() ? "edit" : "menu");
  const [log, setLog] = useState<Entry[]>([]);
  // Back in a mode after a revise: its earlier bubbles are already in the log, so only its controls show again.
  const [resumed, setResumed] = useState(false);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [text, setText] = useState(saved);
  const [unapproved, setUnapproved] = useState(!!saved.trim() && !answer?.approved);
  const { pending, failed, run } = useSaver();
  const limit = draft?.limit ?? longLimit(item);
  const busy = pending || mode === "writing";

  /** The bot bubbles the current mode shows, moved into the log once the student answers them. */
  const shown = (): Entry[] => {
    if (resumed) return [];
    if (mode === "draft") return usable(draft) ? [{ k: "draft", d: draft }] : [{ k: "bot", text: THIN }];
    if (mode === "ideas" && ideas) {
      return [{ k: "bot", text: ideas.length ? `${IDEAS_LEAD}\n${ideas.map((x, i) => `${i + 1}. ${x.text}`).join("\n")}` : NO_IDEAS }];
    }
    return [];
  };
  const choose = (label: string, next: Mode) => { setLog((l) => [...l, ...shown(), { k: "me", text: label }]); setResumed(false); setMode(next); };
  const settle = (e: Entry, next: Mode) => { setLog((l) => [...l, e]); setResumed(true); setMode(next); };
  const write = async () => {
    choose("Write it for me", "writing");
    try {
      const r = await draftFor(jobId, key);
      if (r.ok) { setDraft(r.draft); setMode("draft"); } else settle(r.reason === "ai-off" ? { k: "ai-off" } : { k: "err", text: GENERIC }, "menu");
    } catch { settle({ k: "err", text: GENERIC }, "menu"); }
  };
  const getIdeas = async () => {
    choose("Give me ideas", "ideas");
    setIdeas(null); setPicked(new Set());
    try {
      const r = await ideasFor(jobId, key);
      if (!r.ok && r.reason === "ai-off") settle({ k: "ai-off" }, "menu");
      else setIdeas(r.ok ? r.ideas : []);
    } catch { setIdeas([]); }
  };
  const revise = async (how: "shorter" | "warmer" | "tidy", label: string, source: string) => {
    const back = mode;
    choose(label, "writing");
    try {
      const r = await reviseFor(jobId, key, source, how);
      if (!r.ok) settle(r.reason === "ai-off" ? { k: "ai-off" } : { k: "err", text: GENERIC }, back);
      else if (hasText(r.draft)) { setDraft(r.draft); setMode("draft"); }
      // The gate refused every rewritten sentence: nothing failed, the student's words simply stay as they were.
      else settle({ k: "bot", text: KEPT, caught: r.draft.caught }, back);
    } catch { settle({ k: "err", text: GENERIC }, back); }
  };
  const save = (value: string, approved: boolean) => run(async () => {
    const ok = await onSave(value, approved);
    if (ok) setUnapproved(!approved && !!value.trim());
    return ok;
  });
  const prev = item.previous;
  const prevLabel = `Use my answer from ${prev?.company || "an earlier application"}`;
  // An earlier answer that names its old company opens in Edit, so it is never reused unchanged.
  const namesOld = !!prev?.company.trim() && prev.text.toLowerCase().includes(prev.company.trim().toLowerCase());
  // The earlier answer is the student's own approved text: it gets the same Use this / Shorter / Warmer / Edit as a draft.
  const usePrevious = () => {
    if (!prev) return;
    if (namesOld) {
      setText(prev.text); setUnapproved(false);
      setLog((l) => [...l, ...shown(), { k: "me", text: prevLabel }, { k: "warn", text: `This mentions ${prev.company.trim()}. Edit it before you use it.` }]);
      setResumed(false); setMode("edit");
      return;
    }
    choose(prevLabel, "draft");
    setDraft({ text: prev.text, sentences: [], caught: [], words: prev.words, limit: longLimit(item), thin: false, source: "ai" });
  };
  const own = (label: string) => { setText(""); choose(label, "own"); };
  const edit = () => { setText(draft?.text ?? text); setUnapproved(false); choose("Edit", "edit"); };

  const menuChips = (withWrite: boolean) => (
    <div className="actchips">
      {prev && <button type="button" className={CHIP} disabled={busy} onClick={usePrevious}>{prevLabel}</button>}
      {withWrite && <button type="button" className={CHIP} disabled={busy} onClick={write}>Write it for me</button>}
      <button type="button" className={CHIP} disabled={busy} onClick={getIdeas}>Give me ideas</button>
      <button type="button" className={CHIP} disabled={busy} onClick={() => own("I'll write it")}>I&apos;ll write it</button>
      <button type="button" className={`${CHIP} quiet`} disabled={busy} onClick={() => void save("", false)}>Skip, I&apos;ll write it on the form</button>
    </div>
  );
  const composer = (opts: { send?: boolean }) => (
    <form className="flex flex-col gap-1.5 self-stretch" onSubmit={(e) => { e.preventDefault(); if (opts.send && text.trim()) void save(text, false); }}>
      <textarea aria-label={item.field.label} rows={6} value={text} onChange={(e) => setText(e.target.value)} readOnly={pending} maxLength={5000}
        className="w-full rounded-2xl border border-[rgba(22,22,29,.12)] bg-white px-3 py-2 text-[15px] leading-relaxed" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Counter words={wordCount(text)} limit={limit} />
        {opts.send && <button type="submit" className="send h-11! w-11!" aria-label="Save edit" disabled={pending || !text.trim()}>↑</button>}
      </div>
    </form>
  );
  const mine = (
    <button type="button" className={`${CHIP} bg-[#5B3DF5]! text-white!`} disabled={pending || !text.trim()} onClick={() => void save(text, true)}>This is my answer</button>
  );

  return (
    <div data-autopilot-live="" className="flex flex-col gap-2.5 self-stretch">
      {log.map((e, i) => <LogEntry key={i} e={e} />)}
      {mode === "writing" && <div className="msg bot">Writing…</div>}
      {mode === "menu" && menuChips(true)}
      {mode === "draft" && (usable(draft) ? (
        <>
          {!resumed && <><DraftBubble d={draft} />{draft.thin && <div className="msg bot">{THIN}</div>}</>}
          <div className="actchips">
            <button type="button" className={`${CHIP} bg-[#5B3DF5]! text-white!`} disabled={busy} onClick={() => void save(draft.text, true)}>Use this</button>
            <button type="button" className={CHIP} disabled={busy} onClick={() => revise("shorter", "Shorter", draft.text)}>Shorter</button>
            <button type="button" className={CHIP} disabled={busy} onClick={() => revise("warmer", "Warmer", draft.text)}>Warmer</button>
            <button type="button" className={CHIP} disabled={busy} onClick={edit}>Edit</button>
          </div>
          {draft.thin && menuChips(false)}
        </>
      ) : (
        <>
          {!resumed && <div className="msg bot">{THIN}</div>}
          {menuChips(false)}
        </>
      ))}
      {mode === "ideas" && (ideas === null ? <div className="msg bot typing" aria-label="Writing"><span /><span /><span /></div> : (
        <>
          {resumed ? null : ideas.length === 0
            ? <div className="msg bot">{NO_IDEAS}</div>
            : (
              <>
                <div className="msg bot">{IDEAS_LEAD}</div>
                <div className="facts">
                  {ideas.map((idea, i) => {
                    const on = picked.has(i);
                    return (
                      <button key={i} type="button" className={`fact min-h-11! ${on ? "on" : ""}`} aria-pressed={on} style={{ animationDelay: `${i * 60}ms` }}
                        onClick={() => setPicked((p) => { const n = new Set(p); if (on) n.delete(i); else n.add(i); return n; })}>
                        <span className="box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" /></svg></span>
                        <span><strong>{i + 1}.</strong> {idea.text}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          {composer({})}
          <div className="actchips">
            {text.trim() && <button type="button" className={CHIP} disabled={busy} onClick={() => revise("tidy", "Tidy up", text)}>Tidy up</button>}
            {mine}
          </div>
        </>
      ))}
      {mode === "own" && <>{composer({})}<div className="actchips">{mine}</div></>}
      {mode === "edit" && (
        <>
          {composer({ send: true })}
          <div className="actchips">
            {mine}
            {unapproved && <span className="self-center text-xs font-semibold text-[#7A4100]">Not approved yet</span>}
          </div>
        </>
      )}
      {pending && <p className="text-xs text-muted-foreground">Saving…</p>}
      <SaveError on={failed} />
    </div>
  );
}
