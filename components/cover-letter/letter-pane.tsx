"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CardView, OutputView } from "@/lib/cover-letter/service";
import type { Span } from "@/lib/cover-letter/types";
import type { CardState } from "./card-state";
import { LintChips } from "./lint-chips";
import { useReducedMotion, useWordStream } from "./use-word-stream";

type Range = { start: number; end: number };

/** Paragraph ranges, split on blank lines like the server's edit planner (so `editing` indexes line up). */
function paragraphs(text: string): Range[] {
  const out: Range[] = [];
  let start = 0;
  for (const m of text.matchAll(/\n[ \t]*\n/g)) {
    out.push({ start, end: m.index });
    start = m.index + m[0].length;
  }
  out.push({ start, end: text.length });
  return text.trim() ? out : [];
}

const firstFlag = (spans: Span[]) => [...spans].sort((a, b) => a.start - b.start).find((s) => s.kind === "ai" && s.flag) ?? null;

/** The student's own words: green, sweeping in once when the letter has just been written. */
function Yours({ sweep, children }: { sweep: boolean; children: ReactNode }) {
  const [lit, setLit] = useState(!sweep);
  useEffect(() => {
    if (lit) return;
    const id = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(id);
  }, [lit]);
  return <span data-span="theirs" className={`yours${lit ? " lit" : ""}`}>{children}</span>;
}

/** A flagged span being removed: its width collapses to 0 (the one layout animation allowed). */
function Collapsing({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.maxWidth = `${el.getBoundingClientRect().width}px`;
    void el.offsetWidth;
    el.style.maxWidth = "0px";
    el.style.opacity = "0";
    el.style.filter = "blur(3px)";
  }, []);
  return <span ref={ref} className="flag gone" data-span="ai">{children}</span>;
}

/** One paragraph's text with its spans: theirs green, flagged AI sentences amber. */
function Segments({ text, range, spans, sweep, removing }: { text: string; range: Range; spans: Span[]; sweep: boolean; removing: Span | null }) {
  const inside = spans.filter((s) => s.end > range.start && s.start < range.end).sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let at = range.start;
  for (const s of inside) {
    const a = Math.max(s.start, at), b = Math.min(s.end, range.end);
    if (a > at) out.push(text.slice(at, a));
    if (b <= a) continue;
    const t = text.slice(a, b);
    if (s === removing) out.push(<Collapsing key={a}>{t}</Collapsing>);
    else if (s.kind === "theirs") out.push(<Yours key={a} sweep={sweep}>{t}</Yours>);
    else out.push(<span key={a} data-span="ai" data-flag={s.flag ?? ""} data-start={s.start} className={s.flag ? "flag" : undefined}>{t}</span>);
    at = b;
  }
  if (at < range.end) out.push(text.slice(at, range.end));
  return <>{out}</>;
}

/** After an edit, the changed paragraph glows and the glow fades over 1.6s. */
function GlowP({ glow, className = "", children }: { glow: boolean; className?: string; children: ReactNode }) {
  const [phase, setPhase] = useState(glow ? "changed" : "");
  useEffect(() => {
    if (phase !== "changed") return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("settled")));
    return () => cancelAnimationFrame(id);
  }, [phase]);
  return <p className={`${className} ${phase}`.trim() || undefined}>{children}</p>;
}

/** The paragraph being rewritten: old words dissolve (staggered, ≤260ms), then the new words stream in. */
function EditingParagraph({ old, tokens, live }: { old: string; tokens: string[]; live: boolean }) {
  const reduced = useReducedMotion();
  const words = useMemo(() => old.split(/(?<=\s)/), [old]);
  const streaming = tokens.length > 0;
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!streaming || gone) return;
    const t = setTimeout(() => setGone(true), reduced ? 0 : Math.min(words.length * 6, 260) + 300);
    return () => clearTimeout(t);
  }, [streaming, gone, reduced, words.length]);
  return (
    <p className="editing">
      {gone
        ? tokens.map((t, i) => <span key={i} className="w">{t}</span>)
        : words.map((w, i) => <span key={i} className={streaming ? "out" : undefined} style={streaming ? { animationDelay: `${Math.min(i * 6, 260)}ms` } : undefined}>{w}</span>)}
      {gone && live && <span className="caret" aria-hidden="true" />}
    </p>
  );
}

function StreamP({ tokens, caret }: { tokens: string[]; caret: boolean }) {
  return <p>{tokens.map((t, i) => <span key={i} className="w">{t}</span>)}{caret && <span className="caret" aria-hidden="true" />}</p>;
}

/** Plain text of the edited paper: one block per paragraph, blank-line separated. */
function readText(el: HTMLElement): string {
  const kids = [...el.children] as HTMLElement[];
  const raw = kids.some((k) => k.tagName === "P")
    ? kids.map((k) => k.innerText.replace(/ /g, " ").trim()).filter(Boolean).join("\n\n")
    : el.innerText.replace(/ /g, " ");
  return raw.replace(/\n{3,}/g, "\n\n").trim();
}

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
const tabLabel = (o: OutputView) => (o.target.kind === "upload" ? "Cover letter" : o.target.label.length > 40 ? `${o.target.label.slice(0, 39)}…` : o.target.label);

export type LetterHandlers = {
  onSelect: (outputId: string) => void;
  onSave: (text: string) => void;
  onConfirmTrue: (spanStart: number) => void;
  onReady: () => void;
  onWhyUs: () => void;
};

export function LetterPane({ s, view, output, autopilot, h }: { s: CardState; view: CardView; output: OutputView | null; autopilot: boolean; h: LetterHandlers }) {
  const gen = s.gen;
  const live = s.state === "drafting" || s.state === "editing";
  const tokens = useWordStream(gen ? s.visible : "", live);
  const paperRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ start: number; flag: string; top: number } | null>(null);
  const [typed, setTyped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanStyle, setScanStyle] = useState<{ top: number; h: number } | null>(null);

  const text = output?.text ?? "";
  const spans = output?.spans ?? [];
  const paras = useMemo(() => paragraphs(text), [text]);
  const busy = gen !== null || s.pending;
  const editable = !!output && output.mode !== "skip" && !gen && (view.feedbackOnly || text.trim().length > 0);

  // The lint scan: over the whole letter while checking, over the edited paragraph after an edit.
  useLayoutEffect(() => {
    if (!s.scan.n) return;
    const paper = paperRef.current;
    if (!paper) return;
    const p = s.scan.paragraph === null ? null : (paper.querySelectorAll(":scope > p")[s.scan.paragraph] as HTMLElement | undefined);
    setScanStyle(p ? { top: p.offsetTop, h: p.offsetHeight } : { top: 0, h: paper.offsetHeight });
  }, [s.scan.n, s.scan.paragraph]);

  useEffect(() => {
    if (!pop) return;
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest?.(".pop, [data-flag]")) setPop(null);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [pop]);

  const openFlag = (target: HTMLElement) => {
    const el = target.closest<HTMLElement>("[data-flag]");
    const flag = el?.dataset.flag;
    if (!el || !flag || !wrapRef.current) return;
    const top = el.getBoundingClientRect().bottom - wrapRef.current.getBoundingClientRect().top + 6;
    setPop({ start: Number(el.dataset.start), flag, top });
  };
  const editFlag = () => {
    const el = paperRef.current?.querySelector<HTMLElement>(`[data-start="${pop?.start}"]`);
    setPop(null);
    if (!el) return;
    paperRef.current!.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  };
  const blur = () => {
    const el = paperRef.current;
    if (!el || !editable || !output) return;
    const next = readText(el);
    if (next !== text.trim() && next !== text) h.onSave(next);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: nothing to do */ }
  };

  // ------------------------------------------------------------ the paper's content
  let body: ReactNode;
  if (gen?.kind === "draft") {
    body = !tokens.length
      ? <div className="skel" aria-hidden="true"><p style={{ width: "42%" }} /><p /><p style={{ width: "92%" }} /><p style={{ width: "70%" }} /></div>
      : tokens.map((t, i) => <StreamP key={i} tokens={t} caret={live && i === tokens.length - 1} />);
  } else {
    const removing = gen?.kind === "edit" && gen.edit === "remove_flag" && s.editing !== null ? firstFlag(spans) : null;
    const flat = tokens.flat();
    const rows: ReactNode[] = paras.map((r, i) => {
      if (gen?.kind === "edit" && s.editing === i && gen.edit !== "add_close" && gen.edit !== "remove_flag") {
        return <EditingParagraph key={`e${s.seq}`} old={text.slice(r.start, r.end)} tokens={flat} live={live} />;
      }
      const glow = !gen && s.scan.n > 0 && s.scan.paragraph === i;
      return (
        <GlowP key={glow ? `g${s.scan.n}` : `p${i}`} glow={glow} className={gen?.kind === "edit" && s.editing === i ? "editing" : ""}>
          <Segments text={text} range={r} spans={spans} sweep={s.sweep} removing={removing} />
        </GlowP>
      );
    });
    if (gen?.kind === "edit" && gen.edit === "add_close" && s.editing !== null) {
      rows.splice(Math.min(s.editing, rows.length), 0, (
        <p key="new" className="editing">{flat.map((t, i) => <span key={i} className="w">{t}</span>)}{live && <span className="caret" aria-hidden="true" />}</p>
      ));
    }
    body = rows;
  }

  const skip = output?.mode === "skip";
  const emptyText = skip ? null
    : view.feedbackOnly ? "Paste or type your letter here. I'll check it against the playbook."
      : "Your letter appears here as you answer.";
  const showEmpty = !gen && !text.trim() && !typed;
  const status = s.state === "error" && s.error && (s.retry?.kind === "draft" || s.retry?.kind === "edit") ? { text: s.error, error: true }
    : s.state === "thinking" || (gen?.kind === "draft" && s.state === "drafting") ? { text: "Drafting from your answers" }
      : s.state === "checking" ? { text: "Checking: facts, clichés, length" } : null;
  const ready = output?.canReady.ok === true;
  const isReady = output?.status === "ready";
  const pdf = isReady && output?.pdfPath ? `/api/files/letters/${output.pdfPath.split("/").map(encodeURIComponent).join("/")}?download=cover-letter.pdf` : null;

  return (
    <div className="right">
      {view.outputs.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Letters for this job">
          {view.outputs.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={o.id === output?.id} disabled={busy} onClick={() => h.onSelect(o.id)}>{tabLabel(o)}</button>
          ))}
        </div>
      )}
      <div className="paper-wrap" ref={wrapRef}>
        <div
          key={`${output?.id}:${hash(text)}:${hash(JSON.stringify(spans))}`}
          ref={paperRef}
          className="paper"
          contentEditable={editable}
          suppressContentEditableWarning
          role={editable ? "textbox" : undefined}
          aria-multiline={editable || undefined}
          aria-label="Your letter"
          aria-busy={live || undefined}
          onBlur={blur}
          onInput={() => setTyped(true)}
          onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
          onClick={(e) => openFlag(e.target as HTMLElement)}
        >
          {body}
        </div>
        {showEmpty && emptyText && <div className="empty">{emptyText}</div>}
        {skip && !gen && (
          <div className="empty" style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <span>This posting doesn&apos;t take a cover letter.</span>
            <button type="button" className="btn" disabled={busy} onClick={h.onWhyUs}>Write a &ldquo;why us&rdquo; answer</button>
          </div>
        )}
        {scanStyle && (
          <div key={s.scan.n} className="scan go" aria-hidden="true"
            style={{ top: scanStyle.top, "--h": `${scanStyle.h}px` } as CSSProperties} />
        )}
        {pop && (
          <div className="pop" role="dialog" aria-label="Something to check" style={{ top: pop.top }}>
            <p>{pop.flag}</p>
            <div className="row">
              <button type="button" className="act" onClick={editFlag}>Edit</button>
              <button type="button" className="act" disabled={busy} onClick={() => { setPop(null); h.onConfirmTrue(pop.start); }}>This is true</button>
            </div>
          </div>
        )}
      </div>
      <LintChips output={output} status={status} dim={gen?.kind === "edit"} feedbackOnly={view.feedbackOnly} />
      {output && !skip && (
        <>
          <div className="actions">
            {output.target.kind === "upload" && (pdf
              ? <a className="btn" href={pdf}>Download PDF</a>
              : <button type="button" className="btn" disabled>Download PDF</button>)}
            <button type="button" className="btn" disabled={!text.trim() || busy} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            <button type="button" className="btn p" disabled={!ready || busy || isReady} onClick={h.onReady}>
              {isReady ? "Ready ✓" : autopilot ? "Use in Autopilot" : "Mark ready"}
            </button>
          </div>
          {!output.canReady.ok && text.trim() && !gen && (
            <ul className="helper" aria-label="Before it can be marked ready">
              {output.canReady.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
