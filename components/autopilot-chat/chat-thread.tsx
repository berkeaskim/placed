"use client";
import { useId, useState } from "react";
import type { Answer, PackItem } from "@/lib/autopilot/pack";
import { asArray, displayValue, type Turn } from "@/lib/autopilot/chat-flow";
import { openCoverLetterCard } from "@/components/cover-letter/cover-letter-host";
import { AnswerControls, CHIP, SaveError, useSaver } from "./answer-controls";
import { LongAnswer, longLimit } from "./long-answer";

export type SaveAnswer = (key: string, value: string | string[], approved?: boolean) => Promise<boolean>;

export const turnId = (t: Turn) => ("key" in t ? `${t.kind}:${t.key}` : t.kind);
const staticProps = (on: boolean) => (on ? { "data-static": "" } : {});
const required = (item: PackItem) => (item.field.required ? " *" : "");
const asQuestion = (label: string) => { const q = label.trim().replace(/[\s:*]+$/, ""); return q.endsWith("?") ? q : `${q}?`; };
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function askText(item: PackItem): string {
  if (item.group === "cover") return item.field.type === "file" ? "This form needs a cover letter." : item.field.label;
  if (item.group === "draft") return `${item.field.label} (up to ${longLimit(item)} words)`;
  return item.field.label + required(item);
}

/** The transcript rebuilt from the pack: what was asked and answered so far, oldest first. */
export function ChatThread({ turns, byKey, initial, onShow }: { turns: Turn[]; byKey: Map<string, PackItem>; initial: Set<string>; onShow: () => void }) {
  return turns.map((t) => {
    const id = turnId(t);
    const s = staticProps(initial.has(id));
    if (t.kind === "summary") {
      return (
        <div key={id} className="msg bot" {...s}>
          I filled {t.filled} answer{t.filled === 1 ? "" : "s"} from your profile and past applications.
          <button type="button" className="act min-h-11!" onClick={onShow}>Show</button>
        </div>
      );
    }
    if (t.kind === "yours") {
      return (
        <div key={id} className="msg bot" {...s}>
          You&apos;ll fill these yourself on the form: {t.labels.join(", ")}.{"\n"}Diversity, consent and declarations stay yours.
        </div>
      );
    }
    const item = byKey.get(t.key);
    if (!item) return null;
    if (t.kind === "ask") return <div key={id} className="msg bot" {...s}>{askText(item)}</div>;
    return <div key={id} className="msg me line-clamp-4" {...s}>{t.text}</div>;
  });
}

/** The question being asked now, with its answer control. */
export function LiveQuestion({ jobId, item, answer, reasked, pendingConfirms, save, onKeep, onSkipCover }: {
  jobId: string; item: PackItem; answer: Answer | undefined; reasked: boolean; pendingConfirms: PackItem[];
  save: SaveAnswer; onKeep: () => void; onSkipCover: (item: PackItem) => void;
}) {
  const labelId = useId();
  const [changing, setChanging] = useState(false);
  const all = useSaver();
  const { field } = item;
  const key = field.key;
  const keep = reasked ? <button type="button" className={`${CHIP} quiet`} onClick={onKeep}>Keep my answer</button> : null;

  if (item.group === "draft") {
    return (
      <>
        <div id={labelId} className="msg bot">{askText(item)}</div>
        <LongAnswer key={key} jobId={jobId} item={item} answer={answer} onSave={(v, approved) => save(key, v, approved)} />
        {keep && <div className="actchips">{keep}</div>}
      </>
    );
  }
  if (item.group === "cover") {
    const file = field.type === "file";
    return (
      <>
        <div className="msg bot">{askText(item)}</div>
        <div data-autopilot-live="" className="actchips">
          <button type="button" className={`${CHIP} bg-[#5B3DF5]! text-white!`}
            onClick={() => openCoverLetterCard(file ? { kind: "upload" } : { kind: "field", fieldKey: key, label: field.label.slice(0, 300) }, true)}>
            {file ? "Write cover letter" : "Write this answer"}
          </button>
          <button type="button" className={`${CHIP} quiet`} onClick={() => onSkipCover(item)}>Skip for now</button>
          {keep}
        </div>
      </>
    );
  }

  const suggested = item.group === "confirm" && item.value != null && answer === undefined && !changing;
  if (suggested) {
    const shown = displayValue(field, item.value);
    const others = pendingConfirms.length >= 2 ? pendingConfirms : [];
    const confirmAll = () => void all.run(async () => {
      let ok = true;
      for (const i of others) ok = (await save(i.field.key, i.value!)) && ok;
      return ok;
    });
    return (
      <>
        <div id={labelId} className="msg bot">
          {item.sourceLabel ? `${capitalise(item.sourceLabel)}: ` : ""}{asQuestion(field.label)} I&apos;ve put <strong>{shown}</strong>.
        </div>
        <div data-autopilot-live="" className="flex flex-col gap-1.5 self-stretch">
          <div className="actchips">
            <ConfirmChip label={shown} onSave={() => save(key, item.value!)} disabled={all.pending} />
            <button type="button" className={CHIP} disabled={all.pending} onClick={() => setChanging(true)}>Change</button>
            {others.length > 0 && (
              <button type="button" className={`${CHIP} quiet`} disabled={all.pending} onClick={confirmAll}>Looks right, confirm all {others.length}</button>
            )}
          </div>
          {all.pending && <p className="text-xs text-muted-foreground">Saving…</p>}
          <SaveError on={all.failed} />
        </div>
      </>
    );
  }
  return (
    <>
      <div id={labelId} className="msg bot">{field.label}{required(item)}</div>
      <AnswerControls key={`${key}:${changing}`} field={field} labelId={labelId} initial={asArray(answer?.value ?? item.value)} onSave={(v) => save(key, v)} extra={keep} />
    </>
  );
}

function ConfirmChip({ label, onSave, disabled }: { label: string; onSave: () => Promise<boolean>; disabled: boolean }) {
  const { pending, failed, run } = useSaver();
  return (
    <>
      <button type="button" className={`${CHIP} bg-[#5B3DF5]! text-white!`} disabled={disabled || pending} onClick={() => void run(onSave)}>{label}</button>
      {failed && <SaveError on />}
    </>
  );
}
