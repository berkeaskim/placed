"use client";
import { useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Lock, Rocket } from "lucide-react";
import { canOpen, type Answers, type PackGroup, type PackItem } from "@/lib/autopilot/pack";
import type { FormField } from "@/lib/autopilot/forms/types";
import { asArray, displayValue as labelsOf, optionsOf } from "@/lib/autopilot/chat-flow";
import { openAndFill, preparePack, setAnswer } from "./autopilot-actions";
import { ExtensionHint } from "@/components/autopilot/extension-install";
import { openCoverLetterCard } from "@/components/cover-letter/cover-letter-host";

type Phase =
  | { s: "idle" } | { s: "loading" } | { s: "locked" }
  | { s: "error"; message: string; applyUrl: string | null }
  | { s: "ready"; items: PackItem[] };

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const sourceChip = (ref: string) => (ref.startsWith("fact:") ? "your confirmed fact" : ref.startsWith("jd:") ? "the job post" : "your CV");

const INPUT = "min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-[15px]";
const SMALL_BTN = "min-h-11 rounded-[14px] border-2 border-[#5B3DF5] px-4 py-2 text-sm font-bold text-[#5B3DF5] disabled:opacity-50";

function Group({ group, icon, title, count, children, collapsed }: { group: PackGroup; icon: string; title: string; count: number; children: ReactNode; collapsed?: boolean }) {
  const head = <><span aria-hidden="true">{icon}</span> {title} ({count})</>;
  if (collapsed) {
    return (
      <details data-autopilot-group={group} className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-bold">{head}</summary>
        <div className="mt-2 flex flex-col gap-2">{children}</div>
      </details>
    );
  }
  return (
    <section data-autopilot-group={group} aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-sm font-bold">{head}</h3>
      {children}
    </section>
  );
}

/** Choice control shared by the ask and confirm rows: select for options, checkboxes for multiselect, else free text. */
function Choice({ field, value, onChange, labelId }: { field: FormField; value: string[]; onChange: (v: string[]) => void; labelId: string }) {
  const opts = optionsOf(field);
  if (!opts) return <input aria-labelledby={labelId} className={INPUT} value={value[0] ?? ""} onChange={(e) => onChange([e.target.value])} />;
  // Short single choices (Yes/No and the like) are one tap: no dropdown to open.
  if (field.type !== "multiselect" && opts.length <= 4 && opts.every((o) => o.label.length <= 40)) {
    return (
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const on = value[0] === o.value;
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange([o.value])}
              className={`min-h-11 rounded-full border-2 px-4 py-2 text-sm font-bold ${on ? "border-[#5B3DF5] bg-[#5B3DF5] text-white" : "border-[#D8D8E0] bg-white text-[#2A2A35]"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === "multiselect") {
    return (
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1">
        {opts.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  return (
    <select aria-labelledby={labelId} className={INPUT} value={value[0] ?? ""} onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}>
      <option value="">Choose…</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function QuestionRow({ jobId, item, saved, mode, onSaved }: {
  jobId: string; item: PackItem; saved: Answers[string] | undefined; mode: "ask" | "confirm"; onSaved: (key: string, value: string | string[]) => void;
}) {
  const { field } = item;
  const labelId = useId();
  const answered = saved !== undefined;
  // A saved answer always wins over the suggestion, so a reload never shows a stale pre-filled value.
  const [value, setValue] = useState<string[]>(() => (saved ? asArray(saved.value) : mode === "confirm" ? asArray(item.value) : []));
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const multi = field.type === "multiselect";
  const empty = value.length === 0 || value.every((v) => !v.trim());

  // Every answer here is remembered server-side (option labels come from the stored form), so the next form asks less.
  const save = (next = value) => start(async () => {
    setFailed(false);
    const out: string | string[] = multi ? next : next[0];
    try {
      const r = await setAnswer(jobId, field.key, out);
      if (r.ok) onSaved(field.key, out); else setFailed(true);
    } catch { setFailed(true); }
  });
  // A single choice saves the moment it is picked: no extra "Save" click per question.
  const change = (next: string[]) => {
    setValue(next);
    if (!multi && optionsOf(field) && next.length && next[0].trim()) save(next);
  };

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${answered ? "border-[#0B6B49]/30 bg-[#E3F6EE]" : mode === "ask" ? "bg-[#FFF1DC]" : ""}`}>
      <p id={labelId} className="text-sm font-semibold">{field.label}{field.required && <span className="text-[#7A4100]"> *</span>}</p>
      {item.sourceLabel && !answered && <span className="w-fit rounded-full bg-[#EEEEF2] px-2 py-0.5 text-xs text-[#3F3F4C]">{item.sourceLabel}</span>}
      <Choice field={field} value={value} onChange={change} labelId={labelId} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => save()} disabled={pending || empty} className={SMALL_BTN}>
          {pending ? "Saving…" : answered ? "Update" : mode === "ask" ? "Save" : "Confirm"}
        </button>
        {answered && <span className="text-xs font-bold text-[#0B6B49]">{mode === "ask" ? "Saved" : "Confirmed"}</span>}
        {!answered && <span className="text-xs text-muted-foreground">We&apos;ll remember this for every application.</span>}
        {failed && <span role="alert" className="text-xs font-semibold text-[#7A4100]">Couldn&apos;t save. Try again.</span>}
      </div>
    </div>
  );
}

function DraftRow({ jobId, item, answer, onSaved }: {
  jobId: string; item: PackItem; answer: Answers[string] | undefined; onSaved: (key: string, value: string | string[], approved: boolean) => void;
}) {
  const { field, draft } = item;
  const labelId = useId();
  const initial = typeof answer?.value === "string" ? answer.value : (draft?.text ?? "");
  const [text, setText] = useState(initial);
  const [approved, setApproved] = useState(Boolean(answer?.approved));
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const none = !draft || draft.source === "none";
  const limit = draft?.limit ?? field.wordLimit ?? 200;
  const words = wordCount(text);
  const refs = [...new Set((draft?.sentences ?? []).flatMap((s) => s.refs).map(sourceChip))];

  const edit = (next: string) => {
    setText(next);
    if (!approved) return;
    setApproved(false); // editing after approval always withdraws it
    start(async () => {
      try {
        const r = await setAnswer(jobId, field.key, next, { approved: false });
        if (r.ok) onSaved(field.key, next, false); else setFailed(true);
      } catch { setFailed(true); }
    });
  };
  const approve = () => start(async () => {
    setFailed(false);
    try {
      const r = await setAnswer(jobId, field.key, text, { approved: true });
      if (r.ok) { setApproved(true); onSaved(field.key, text, true); } else setFailed(true);
    } catch { setFailed(true); }
  });
  const edited = !approved && answer !== undefined;

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <label id={labelId} htmlFor={`${labelId}-t`} className="text-sm font-semibold">{field.label}</label>
      {none && <p className="text-xs text-muted-foreground">Write this one yourself. Autopilot will leave it empty.</p>}
      {draft?.thin && !none && <p role="note" className="rounded-lg bg-[#FFF1DC] px-2.5 py-2 text-xs font-semibold text-[#7A4100]">Too thin, add your own words.</p>}
      <textarea id={`${labelId}-t`} rows={7} className="w-full rounded-xl border bg-white px-3 py-2 text-[15px] leading-relaxed" value={text} onChange={(e) => edit(e.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={words > limit ? "font-bold text-[#7A4100]" : "text-muted-foreground"} aria-live="polite">{words} / {limit} words</span>
        {refs.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground">Built from:</span>
            {refs.map((r) => <span key={r} className="rounded-full bg-[#F1EEFF] px-2 py-0.5 font-semibold text-[#5B3DF5]">{r}</span>)}
          </span>
        )}
      </div>
      {draft && draft.caught.length > 0 && (
        <details className="rounded-lg bg-[#F6F6FA] px-2.5 py-2 text-xs">
          <summary className="cursor-pointer font-bold">Caught it: {draft.caught.length} sentence{draft.caught.length === 1 ? "" : "s"} removed</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {draft.caught.map((c, i) => <li key={i}><span className="font-semibold">{c.reason}:</span> {c.text}</li>)}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={approve} disabled={pending || !text.trim() || approved} className={SMALL_BTN}>
          {pending ? "Saving…" : "This is my answer"}
        </button>
        {approved && <span className="text-xs font-bold text-[#0B6B49]">Approved. Autopilot will fill this.</span>}
        {edited && <span className="text-xs font-semibold text-[#7A4100]">Not approved yet</span>}
        {failed && <span role="alert" className="text-xs font-semibold text-[#7A4100]">Couldn&apos;t save. Try again.</span>}
      </div>
    </div>
  );
}

export function AutopilotPanel({ jobId }: { jobId: string }) {
  const [phase, setPhase] = useState<Phase>({ s: "idle" });
  const [answers, setAnswers] = useState<Answers>({});
  const [pending, start] = useTransition();
  const [opening, startOpen] = useTransition();
  const [openError, setOpenError] = useState<string | null>(null);
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);
  const [confirming, startConfirm] = useTransition();
  const [confirmFailed, setConfirmFailed] = useState(false);

  const prepare = () => start(async () => {
    setPhase({ s: "loading" });
    try {
      const r = await preparePack(jobId);
      if ("locked" in r) setPhase({ s: "locked" });
      else if ("error" in r) setPhase({ s: "error", message: r.error, applyUrl: r.applyUrl });
      else { setAnswers(r.answers); setPhase({ s: "ready", items: r.items }); }
    } catch {
      setPhase({ s: "error", message: "Something went wrong building your pack.", applyUrl: null });
    }
  });

  const save = (key: string, value: string | string[], approved = false) => setAnswers((a) => ({ ...a, [key]: { value, approved } }));

  if (phase.s === "idle" || phase.s === "loading") {
    return (
      <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5" aria-label="Autopilot">
        <button type="button" onClick={prepare} disabled={pending || phase.s === "loading"} className="btn-quest flex min-h-12 items-center justify-center gap-2 px-4 py-3 disabled:opacity-60">
          <Rocket size={18} aria-hidden="true" />
          {phase.s === "loading" ? "Reading the form…" : "Autopilot this application"}
        </button>
        <p className="text-xs text-muted-foreground">Placed gets the form ready; you check every answer and press Submit yourself.</p>
      </section>
    );
  }
  if (phase.s === "locked") {
    return (
      <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5" aria-label="Autopilot">
        <Link href="/autopilot/setup" className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#FFF1DC] px-4 py-3 text-center font-bold text-[#7A4100] no-underline">
          <Lock size={18} aria-hidden="true" /> Set up Autopilot first (2 min)
        </Link>
      </section>
    );
  }
  if (phase.s === "error") {
    return (
      <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5" aria-label="Autopilot">
        <p role="alert" className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]">{phase.message}</p>
        {phase.applyUrl && (
          <a href={phase.applyUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-[14px] border-2 px-4 py-3 text-center font-bold no-underline">
            Apply on company site <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </section>
    );
  }

  const by = (g: PackGroup) => phase.items.filter((i) => i.group === g);
  const vault = by("vault"), ask = by("ask"), confirm = by("confirm"), draft = by("draft"), yours = by("yours"), cover = by("cover");
  const ready = canOpen(phase.items, answers);
  const left = [...ask, ...confirm].filter((i) => answers[i.field.key] === undefined).length;
  const suggested = confirm.filter((i) => i.value != null && answers[i.field.key] === undefined);

  const confirmAll = () => startConfirm(async () => {
    setConfirmFailed(false);
    for (const i of suggested) {
      try {
        const r = await setAnswer(jobId, i.field.key, i.value!);
        if (r.ok) save(i.field.key, i.value!); else setConfirmFailed(true);
      } catch { setConfirmFailed(true); }
    }
  });

  const open = () => startOpen(async () => {
    setOpenError(null);
    try {
      const r = await openAndFill(jobId);
      if ("error" in r) { setOpenError(r.error); return; }
      setOpenedUrl(r.url);
      window.open(r.url, "_blank", "noopener");
    } catch {
      setOpenError("Couldn't open the form. Try again.");
    }
  });

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border bg-white p-5" aria-label="Application pack">
      <div className="flex items-center gap-2">
        <Rocket size={18} aria-hidden="true" />
        <h2 className="text-lg font-extrabold">Your application pack</h2>
      </div>
      <p aria-live="polite" className={`rounded-xl px-3 py-2 text-sm font-bold ${left ? "bg-[#FFF1DC] text-[#7A4100]" : "bg-[#E3F6EE] text-[#0B6B49]"}`}>
        {left ? `${left} question${left === 1 ? "" : "s"} left. Tap an answer and it's saved.` : "All answered. You're ready to fill the form."}
      </p>

      {vault.length > 0 && (
        <Group group="vault" icon="✅" title="From your setup" count={vault.length} collapsed>
          {vault.map((i) => (
            <div key={i.field.key} className="flex flex-col gap-0.5 rounded-lg bg-[#F6F6FA] px-3 py-2 text-sm">
              <span className="font-semibold">{i.field.label}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span>{i.field.type === "file" ? "Your tailored CV" : labelsOf(i.field, i.value) || "—"}</span>
                {i.sourceLabel && <span className="rounded-full bg-[#EEEEF2] px-2 py-0.5 text-xs text-[#3F3F4C]">{i.sourceLabel}</span>}
              </span>
            </div>
          ))}
        </Group>
      )}

      {ask.length > 0 && (
        <Group group="ask" icon="❓" title="Answer once" count={ask.length}>
          {ask.map((i) => <QuestionRow key={i.field.key} jobId={jobId} item={i} mode="ask" saved={answers[i.field.key]} onSaved={save} />)}
        </Group>
      )}

      {confirm.length > 0 && (
        <Group group="confirm" icon="☑️" title="Please confirm" count={confirm.length}>
          {suggested.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={confirmAll} disabled={confirming} className={SMALL_BTN}>
                {confirming ? "Confirming…" : suggested.length === 1 ? "Confirm the suggestion" : `Confirm all ${suggested.length} suggestions`}
              </button>
              {confirmFailed && <span role="alert" className="text-xs font-semibold text-[#7A4100]">Some didn&apos;t save. Try again.</span>}
            </div>
          )}
          {confirm.map((i) => <QuestionRow key={i.field.key} jobId={jobId} item={i} mode="confirm" saved={answers[i.field.key]} onSaved={save} />)}
        </Group>
      )}

      {draft.length > 0 && (
        <Group group="draft" icon="✍️" title="Your answer" count={draft.length}>
          {draft.map((i) => <DraftRow key={i.field.key} jobId={jobId} item={i} answer={answers[i.field.key]} onSaved={save} />)}
        </Group>
      )}

      {cover.length > 0 && (
        <Group group="cover" icon="✉️" title="Cover letter" count={cover.length}>
          {cover.map((i) => (
            <div key={i.field.key} className="flex flex-col gap-2 rounded-xl border p-3">
              <p className="text-sm font-semibold">{i.field.label}</p>
              <button type="button" className={`${SMALL_BTN} w-fit`}
                onClick={() => openCoverLetterCard(i.field.type === "file" ? { kind: "upload" } : { kind: "field", fieldKey: i.field.key, label: i.field.label.slice(0, 300) }, true)}>
                {i.field.type === "file" ? "Write the cover letter" : "Write this answer"}
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Built from your answers and your CV. You check it before it&apos;s used.</p>
        </Group>
      )}

      {yours.length > 0 && (
        <Group group="yours" icon="🚫" title="You'll fill these" count={yours.length}>
          <ul className="flex flex-col gap-1 text-sm">
            {yours.map((i) => <li key={i.field.key} className="rounded-lg bg-[#F6F6FA] px-3 py-2">{i.field.label}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">Diversity, consent and declarations stay yours.</p>
        </Group>
      )}

      <div className="flex flex-col gap-2 border-t pt-4">
        <button type="button" onClick={open} disabled={!ready || opening} className="btn-quest min-h-12 px-4 py-3 disabled:opacity-50">
          {opening ? "Opening…" : "Open & fill →"}
        </button>
        {!ready && <p className="text-xs font-semibold text-[#7A4100]">Answer the ❓ and ☑️ questions above to unlock this.</p>}
        {openError && <p role="alert" className="text-xs font-semibold text-[#7A4100]">{openError}</p>}
        {openedUrl && (
          <p className="text-xs text-muted-foreground">
            Nothing opened? <a href={openedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#5B3DF5]">Open the form</a>. This link works once.
          </p>
        )}
        <ExtensionHint />
      </div>
    </section>
  );
}
