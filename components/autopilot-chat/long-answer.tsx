"use client";
import { useState } from "react";
import type { Answer, PackItem } from "@/lib/autopilot/pack";
import type { DraftResult } from "@/lib/autopilot/drafts";
import { draftFor, ideasFor, reviseFor } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { CHIP, SaveError, useSaver } from "./answer-controls";

type Mode = "menu" | "writing" | "draft" | "ideas" | "own" | "edit";
type Idea = { text: string; refs: string[] };

const GENERIC = "Something went wrong. Please try again.";
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const sourceChip = (ref: string) => (ref.startsWith("fact:") ? "your confirmed fact" : ref.startsWith("jd:") ? "the job post" : "your CV");
const usable = (d: DraftResult | null): d is DraftResult => !!d && d.source !== "none" && !!d.text.trim();

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
      {d.caught.length > 0 && (
        <details className="rounded-lg bg-white/70 px-2.5 py-2 text-xs">
          <summary className="cursor-pointer font-bold">Caught it: {d.caught.length} sentence{d.caught.length === 1 ? "" : "s"} removed</summary>
          <ul className="mt-1 flex flex-col gap-1">{d.caught.map((c, i) => <li key={i}><span className="font-semibold">{c.reason}:</span> {c.text}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

/** The long-answer flow for one free-text question: write it for me, ideas, own words, or skip. */
export function LongAnswer({ jobId, item, answer, onSave }: {
  jobId: string; item: PackItem; answer: Answer | undefined; onSave: (value: string, approved: boolean) => Promise<boolean>;
}) {
  const key = item.field.key;
  const saved = typeof answer?.value === "string" ? answer.value : "";
  const [mode, setMode] = useState<Mode>(saved.trim() ? "edit" : "menu");
  const [said, setSaid] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [text, setText] = useState(saved);
  const [unapproved, setUnapproved] = useState(!!saved.trim() && !answer?.approved);
  const [note, setNote] = useState<string | null>(null);
  const { pending, failed, run } = useSaver();
  const limit = draft?.limit ?? longLimit(item);
  const busy = pending || mode === "writing";

  const choose = (label: string, next: Mode) => { setSaid(label); setNote(null); setMode(next); };
  const write = async () => {
    choose("Write it for me", "writing");
    try {
      const r = await draftFor(jobId, key);
      if (r.ok) { setDraft(r.draft); setMode("draft"); } else { setNote(GENERIC); setMode("menu"); }
    } catch { setNote(GENERIC); setMode("menu"); }
  };
  const getIdeas = async () => {
    choose("Give me ideas", "ideas");
    setIdeas(null); setPicked(new Set());
    try {
      const r = await ideasFor(jobId, key);
      setIdeas(r.ok ? r.ideas : []);
    } catch { setIdeas([]); }
  };
  const revise = async (how: "shorter" | "warmer" | "tidy", label: string, source: string) => {
    const back = mode;
    choose(label, "writing");
    try {
      const r = await reviseFor(jobId, key, source, how);
      if (r.ok && usable(r.draft)) { setDraft(r.draft); setMode("draft"); return; }
    } catch { /* falls through to the note */ }
    setNote(GENERIC); setMode(back);
  };
  const save = (value: string, approved: boolean) => run(async () => {
    const ok = await onSave(value, approved);
    if (ok) setUnapproved(!approved && !!value.trim());
    return ok;
  });
  const own = (label: string) => { setText(""); choose(label, "own"); };
  const edit = () => { setText(draft?.text ?? text); setUnapproved(false); choose("Edit", "edit"); };

  const menuChips = (withWrite: boolean) => (
    <div className="actchips">
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
      {said && <div className="msg me self-end">{said}</div>}
      {note && <div className="msg bot err" role="alert">{note}</div>}
      {mode === "writing" && <div className="msg bot">Writing…</div>}
      {mode === "menu" && menuChips(true)}
      {mode === "draft" && (usable(draft) ? (
        <>
          <DraftBubble d={draft} />
          {draft.thin && <div className="msg bot">Not enough on your CV for this one. Add your own words.</div>}
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
          <div className="msg bot">Not enough on your CV for this one. Add your own words.</div>
          {menuChips(false)}
        </>
      ))}
      {mode === "ideas" && (ideas === null ? <div className="msg bot typing" aria-label="Writing"><span /><span /><span /></div> : (
        <>
          {ideas.length === 0
            ? <div className="msg bot">I couldn&apos;t find a strong angle on your CV. Try writing a few lines and I&apos;ll tidy them.</div>
            : (
              <>
                <div className="msg bot">A few angles from your CV. Pick any, then write a few lines.</div>
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
