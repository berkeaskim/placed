"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import type { FormField } from "@/lib/autopilot/forms/types";
import { controlKind, optionsOf } from "@/lib/autopilot/chat-flow";

export type SaveFn = (value: string | string[]) => Promise<boolean>;

export const CHIP = "act min-h-11!";
export const FIELD = "min-h-11 w-full min-w-0 rounded-xl border border-[rgba(22,22,29,.12)] bg-white px-3 py-2 text-[15px] text-[#16161D]";
const delay = (i: number) => ({ animationDelay: `${i * 60}ms` });

export function SaveError({ on }: { on: boolean }) {
  return on ? <p role="alert" className="text-xs font-semibold text-[#7A4100]">Couldn&apos;t save. Try again.</p> : null;
}

/** Runs a save, tracking pending and failure, so every control says the same thing when it fails. */
export function useSaver(): { pending: boolean; failed: boolean; run: (fn: () => Promise<boolean>) => Promise<boolean> } {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (fn: () => Promise<boolean>) => {
    setPending(true); setFailed(false);
    let ok = false;
    try { ok = await fn(); } catch { ok = false; }
    setPending(false); setFailed(!ok);
    return ok;
  };
  return { pending, failed, run };
}

/** The answer control for one question: chips, a dropdown, toggle chips + Done, or a one-line composer. */
export function AnswerControls({ field, initial, onSave, extra, labelId }: { field: FormField; initial: string[]; onSave: SaveFn; extra?: ReactNode; labelId: string }) {
  const kind = controlKind(field);
  const opts = optionsOf(field) ?? [];
  const [value, setValue] = useState<string[]>(initial);
  const [text, setText] = useState(initial[0] ?? "");
  const { pending, failed, run } = useSaver();
  const save = (v: string | string[]) => { void run(() => onSave(v)); };

  let control: ReactNode;
  if (kind === "chips") {
    control = (
      <div role="group" aria-labelledby={labelId} className="actchips">
        {opts.map((o, i) => (
          <button key={o.value} type="button" className={CHIP} style={delay(i)} aria-pressed={initial[0] === o.value} disabled={pending} onClick={() => save(o.value)}>{o.label}</button>
        ))}
        {extra}
      </div>
    );
  } else if (kind === "dropdown") {
    control = (
      <div className="flex w-full max-w-md flex-col gap-2 self-start">
        <select aria-labelledby={labelId} className={FIELD} value={value[0] ?? ""} disabled={pending}
          onChange={(e) => { const v = e.target.value; setValue(v ? [v] : []); if (v) save(v); }}>
          <option value="">Choose…</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {extra && <div className="actchips">{extra}</div>}
      </div>
    );
  } else if (kind === "multi") {
    control = (
      <div role="group" aria-labelledby={labelId} className="actchips">
        {opts.map((o, i) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" className={`${CHIP} ${on ? "bg-[#EEEAFE]! border-[#5B3DF5]!" : ""}`} style={delay(i)} aria-pressed={on} disabled={pending}
              onClick={() => setValue((v) => (on ? v.filter((x) => x !== o.value) : [...v, o.value]))}>
              {on ? "✓ " : ""}{o.label}
            </button>
          );
        })}
        <button type="button" className={`${CHIP} bg-[#5B3DF5]! text-white!`} disabled={pending || value.length === 0} onClick={() => save(value)}>Done</button>
        {extra}
      </div>
    );
  } else {
    const submit = (e: FormEvent) => { e.preventDefault(); if (text.trim()) save(text.trim()); };
    control = (
      <div className="flex w-full flex-col gap-2 self-stretch">
        <form onSubmit={submit} className="flex gap-2">
          <input aria-labelledby={labelId} className={`${FIELD} rounded-full! bg-[#F1F1F6]! px-4!`} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…" autoComplete="off" maxLength={500} readOnly={pending} />
          <button type="submit" className="send h-11! w-11!" aria-label="Send" disabled={pending || !text.trim()}>↑</button>
        </form>
        {extra && <div className="actchips">{extra}</div>}
      </div>
    );
  }
  return (
    <div data-autopilot-live="" className="flex flex-col gap-1.5 self-stretch">
      {control}
      {pending && <p className="text-xs text-muted-foreground">Saving…</p>}
      <SaveError on={failed} />
    </div>
  );
}
