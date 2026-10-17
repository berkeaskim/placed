"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as KeyEvent, type ReactNode } from "react";
import type { CardView, OutputView } from "@/lib/cover-letter/service";
import { sameLetter } from "@/lib/cover-letter/spans";
import type { Span } from "@/lib/cover-letter/types";
import { paragraphs, type CardState } from "./card-state";
import { LintChips } from "./lint-chips";
import { tokenize, useReducedMotion, useWordStream } from "./use-word-stream";

type Range = { start: number; end: number };
type Tok = { t: string; mine: boolean };

const firstFlag = (spans: Span[]) => [...spans].sort((a, b) => a.start - b.start).find((x) => x.kind === "ai" && x.flag) ?? null;
const inRanges = (at: number, rs: Range[]) => rs.some((r) => at >= r.start && at < r.end);

/** Two-phase green: the class lands one frame after mount, so the background sweep transitions in. */
function useLit(on: boolean, startLit: boolean): boolean {
  const [lit, setLit] = useState(startLit);
  useEffect(() => {
    if (!on || lit) return;
    const id = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(id);
  }, [on, lit]);
  return on && lit;
}

/** The student's own words: green, sweeping in once when the letter has just been written (unless lit mid-stream). */
function Yours({ sweep, children }: { sweep: boolean; children: ReactNode }) {
  const lit = useLit(true, !sweep);
  return <span data-span="theirs" className={`yours${lit ? " lit" : ""}`}>{children}</span>;
}

/** A streamed word. Inside the student's own sentence it turns green as soon as that sentence closes. */
function Word({ t, mine, i }: { t: string; mine: boolean; i: number }) {
  const lit = useLit(mine, false);
  return <span className={`w${mine ? " yours" : ""}${lit ? " lit" : ""}`} style={mine ? { transitionDelay: `${(i % 40) * 12}ms` } : undefined}>{t}</span>;
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

/**
 * One paragraph's text with its spans: theirs green, flagged AI sentences amber. While the letter is editable, clicking
 * amber text places the caret like any other text, and a small "?" after it (outside the editable text) opens the
 * check; otherwise the amber span itself is focusable and Enter or Space opens it.
 */
function Segments({ text, range, spans, sweep, litTexts, removing, editable, onFlag }: {
  text: string; range: Range; spans: Span[]; sweep: boolean; litTexts: string[]; removing: Span | null; editable: boolean; onFlag: (el: HTMLElement) => void;
}) {
  const keys = (e: KeyEvent<HTMLElement>) => {
    // Only the focused control itself: never a key typed with the caret inside the letter.
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onFlag(e.currentTarget);
  };
  const inside = spans.filter((x) => x.end > range.start && x.start < range.end).sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let at = range.start;
  for (const x of inside) {
    const a = Math.max(x.start, at), b = Math.min(x.end, range.end);
    if (a > at) out.push(text.slice(at, a));
    if (b <= a) continue;
    const t = text.slice(a, b);
    if (x === removing) out.push(<Collapsing key={a}>{t}</Collapsing>);
    else if (x.kind === "theirs") out.push(<Yours key={a} sweep={sweep && !litTexts.includes(t.trim())}>{t}</Yours>);
    else if (x.flag && editable) {
      out.push(
        <span key={a} data-span="ai" data-flag={x.flag} data-start={x.start} className="flag">{t}</span>,
        <span key={`q${a}`} className="flag-q" role="button" tabIndex={0} contentEditable={false} data-check={x.start} aria-label={`Check: ${x.flag}`} onKeyDown={keys} />,
      );
    } else if (x.flag) {
      out.push(
        <span key={a} data-span="ai" data-flag={x.flag} data-start={x.start} className="flag" tabIndex={0} role="button" aria-label={`Check: ${x.flag}`} onKeyDown={keys}>{t}</span>,
      );
    } else out.push(<span key={a} data-span="ai" data-start={x.start}>{t}</span>);
    at = b;
  }
  if (at < range.end) out.push(text.slice(at, range.end));
  return <>{out}</>;
}

/** After an edit or undo, the changed paragraph glows and the glow fades over 1.6s. */
function GlowP({ glow, className = "", children }: { glow: boolean; className?: string; children: ReactNode }) {
  const [phase, setPhase] = useState(glow ? "changed" : "");
  useEffect(() => {
    if (phase !== "changed") return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("settled")));
    return () => cancelAnimationFrame(id);
  }, [phase]);
  return <p className={`${className} ${phase}`.trim() || undefined}>{children}</p>;
}

/**
 * The paragraph being rewritten (or restored by Undo): it breathes, its old words dissolve at once (staggered,
 * ≤260ms), then the new words come in one by one, catching up when the model is ahead. `onFinished` fires once
 * every word is in and the stream is over (Undo uses it to hand back to the plain paragraph and its glow).
 */
function EditingParagraph({ old, tokens, live, onFinished }: { old: string; tokens: Tok[]; live: boolean; onFinished?: () => void }) {
  const reduced = useReducedMotion();
  const words = useMemo(() => old.split(/(?<=\s)/), [old]);
  const [gone, setGone] = useState(false);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), reduced ? 0 : Math.min(words.length * 6, 260) + 300);
    return () => clearTimeout(t);
  }, [reduced, words.length]);
  useEffect(() => {
    if (!gone || shown >= tokens.length) return;
    const t = setTimeout(() => setShown((n) => (reduced ? tokens.length : Math.min(tokens.length, n + Math.max(1, Math.ceil((tokens.length - n) / 8))))), reduced ? 0 : 30);
    return () => clearTimeout(t);
  }, [gone, shown, tokens.length, reduced]);
  const finished = gone && !live && shown >= tokens.length;
  const done = useRef(onFinished);
  useEffect(() => { done.current = onFinished; });
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => done.current?.(), reduced ? 0 : 350);
    return () => clearTimeout(t);
  }, [finished, reduced]);
  return (
    <p className="editing">
      {gone
        ? tokens.slice(0, shown).map((x, i) => <Word key={i} t={x.t} mine={x.mine} i={i} />)
        : words.map((w, i) => <span key={i} className="out" style={{ animationDelay: `${Math.min(i * 6, 260)}ms` }}>{w}</span>)}
      {gone && live && <span className="caret" aria-hidden="true" />}
    </p>
  );
}

function StreamP({ tokens, lit, caret }: { tokens: { t: string; at: number }[]; lit: Range[]; caret: boolean }) {
  return <p>{tokens.map((x, i) => <Word key={i} t={x.t} mine={inRanges(x.at, lit)} i={i} />)}{caret && <span className="caret" aria-hidden="true" />}</p>;
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
  /** The undo animation has played. */
  onRestored: () => void;
};

export function LetterPane({ s, view, output, autopilot, h }: { s: CardState; view: CardView; output: OutputView | null; autopilot: boolean; h: LetterHandlers }) {
  const gen = s.gen;
  const live = gen !== null && (s.state === "drafting" || s.state === "editing");
  const tokens = useWordStream(gen ? s.visible : "", live);
  const paperRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ start: number; flag: string; top: number } | null>(null);
  const [typed, setTyped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanStyle, setScanStyle] = useState<{ top: number; h: number } | null>(null);
  const popRef = useRef<HTMLButtonElement>(null);

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

  // The check opens with the focus inside it, so Edit / "This is true" are one key away.
  useEffect(() => { if (pop) popRef.current?.focus(); }, [pop]);
  useEffect(() => {
    if (!pop) return;
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key !== "Escape" : (e.target as HTMLElement).closest?.(".pop, [data-flag], [data-check]")) return;
      setPop(null);
      if (e instanceof KeyboardEvent) paperRef.current?.querySelector<HTMLElement>(`[data-check="${pop.start}"], [data-flag][data-start="${pop.start}"]`)?.focus();
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [pop]);

  function openFlag(target: HTMLElement) {
    // In an editable letter only the "?" opens the check; a click on the amber text just places the caret.
    const q = target.closest<HTMLElement>("[data-check]");
    const el = q
      ? paperRef.current?.querySelector<HTMLElement>(`[data-flag][data-start="${q.dataset.check}"]`) ?? null
      : editable ? null : target.closest<HTMLElement>("[data-flag]");
    const flag = el?.dataset.flag;
    if (!el || !flag || !wrapRef.current) return;
    const top = el.getBoundingClientRect().bottom - wrapRef.current.getBoundingClientRect().top + 6;
    setPop({ start: Number(el.dataset.start), flag, top });
  }
  const editFlag = () => {
    const el = paperRef.current?.querySelector<HTMLElement>(`[data-flag][data-start="${pop?.start}"]`);
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
    // The paper collapses space runs (pre-line), so an unedited read-back can differ from the stored text in spacing only.
    if (!sameLetter(next, text)) h.onSave(next);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: nothing to do */ }
  };

  // ------------------------------------------------------------ the paper's content
  const ownAt = (at: number) => spans.some((x) => x.kind === "theirs" && at >= x.start && at < x.end);
  let body: ReactNode;
  if (gen?.kind === "draft") {
    body = !tokens.length
      ? <div className="skel" aria-hidden="true"><p style={{ width: "42%" }} /><p /><p style={{ width: "92%" }} /><p style={{ width: "70%" }} /></div>
      : tokens.map((t, i) => <StreamP key={i} tokens={t} lit={s.lit} caret={live && i === tokens.length - 1} />);
  } else {
    const removing = gen?.kind === "edit" && gen.edit === "remove_flag" && s.editing !== null ? firstFlag(spans) : null;
    const streamed: Tok[] = tokens.flat().map((x) => ({ t: x.t, mine: inRanges(x.at, s.lit) }));
    const undoing = s.pending && s.last?.kind === "undo";
    const restore = !gen ? s.restore : null;
    const rows: ReactNode[] = paras.map((r, i) => {
      if (gen?.kind === "edit" && s.editing === i && gen.edit !== "add_close" && gen.edit !== "remove_flag") {
        return <EditingParagraph key={`e${s.seq}`} old={text.slice(r.start, r.end)} tokens={streamed} live={live} />;
      }
      if (restore && !restore.removed && restore.paragraph === i) {
        // Undo, in reverse: the current words dissolve and the restored ones fade back in.
        const back = (tokenize(text.slice(r.start, r.end), false)[0] ?? []).map((x) => ({ t: x.t, mine: ownAt(r.start + x.at) }));
        return <EditingParagraph key={`r${restore.n}`} old={restore.from} tokens={back} live={false} onFinished={h.onRestored} />;
      }
      const glow = !gen && !restore && s.scan.n > 0 && s.scan.paragraph === i;
      const breathing = (gen?.kind === "edit" || undoing) && s.editing === i;
      return (
        <GlowP key={glow ? `g${s.scan.n}` : `p${i}`} glow={glow} className={breathing ? "editing" : ""}>
          <Segments text={text} range={r} spans={spans} sweep={s.sweep} litTexts={s.litTexts} removing={removing} editable={editable} onFlag={openFlag} />
        </GlowP>
      );
    });
    if (gen?.kind === "edit" && gen.edit === "add_close" && s.editing !== null) {
      rows.splice(Math.min(s.editing, rows.length), 0, (
        <p key="new" className="editing">{streamed.map((x, i) => <Word key={i} t={x.t} mine={x.mine} i={i} />)}{live && <span className="caret" aria-hidden="true" />}</p>
      ));
    }
    if (restore?.removed) {
      // Undoing an added paragraph: it fades and blurs out, then the letter closes up.
      rows.splice(Math.min(restore.paragraph, rows.length), 0, (
        <p key={`x${restore.n}`} className="leaving" aria-hidden="true" onAnimationEnd={h.onRestored}>{restore.from}</p>
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
              <button ref={popRef} type="button" className="act" onClick={editFlag}>Edit</button>
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
