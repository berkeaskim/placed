"use client";
import "@/components/cover-letter/motion.css";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { canOpen, type Answers, type PackItem } from "@/lib/autopilot/pack";
import { coverKey, isAskable, isDone, isSkipped, nextToAsk, progressRows, transcript, type Turn } from "@/lib/autopilot/chat-flow";
import { coverReadyKeys, preparePack, setAnswer } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { onCoverReady } from "@/components/cover-letter/cover-letter-host";
import { announceAutopilotProgress } from "./autopilot-host";
import { ChatThread, LiveQuestion, turnId, type SaveAnswer } from "./chat-thread";
import { ProgressList, progressCounts } from "./progress-list";

type Phase = { s: "loading" } | { s: "locked" } | { s: "error"; message: string; applyUrl: string | null } | { s: "ready"; items: PackItem[]; answers: Answers };

const TYPING_MS = 450;
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => { const m = window.matchMedia(REDUCED); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useReducedMotion = () => useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

/** Loads the pack, then hands it to the chat. Locked and error states live here, in the chat area. */
export function AutopilotChat({ jobId }: { jobId: string }) {
  const [phase, setPhase] = useState<Phase>({ s: "loading" });
  useEffect(() => {
    let live = true;
    preparePack(jobId).then((r) => {
      if (!live) return;
      if ("locked" in r) setPhase({ s: "locked" });
      else if ("error" in r) setPhase({ s: "error", message: r.error, applyUrl: r.applyUrl });
      else setPhase({ s: "ready", items: r.items, answers: r.answers });
    }).catch(() => { if (live) setPhase({ s: "error", message: "Something went wrong building your pack.", applyUrl: null }); });
    return () => { live = false; };
  }, [jobId]);

  if (phase.s === "loading") return <p className="p-5 text-sm text-muted-foreground" aria-live="polite">Reading the form…</p>;
  if (phase.s === "locked") {
    return (
      <div className="p-5">
        <Link href="/autopilot/setup" className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#FFF1DC] px-4 py-3 text-center font-bold text-[#7A4100] no-underline">
          <Lock size={18} aria-hidden="true" /> Set up Autopilot first (2 min)
        </Link>
      </div>
    );
  }
  if (phase.s === "error") {
    return (
      <div className="flex flex-col gap-2 p-5">
        <p role="alert" className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]">{phase.message}</p>
        {phase.applyUrl && (
          <a href={phase.applyUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-[14px] border-2 px-4 py-3 text-center font-bold no-underline">
            Apply on company site <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    );
  }
  return <ReadyChat jobId={jobId} items={phase.items} saved={phase.answers} />;
}

/** Skipped cover items are client-only, so the transcript has no turn for them: place one at the item's form position. */
function withSkippedCovers(turns: Turn[], items: PackItem[], skipped: ReadonlySet<string>, ready: ReadonlySet<string>): Turn[] {
  const order = new Map(items.map((i, n) => [i.field.key, n]));
  const out = [...turns];
  for (const i of items) {
    if (i.group !== "cover" || !skipped.has(coverKey(i)) || ready.has(coverKey(i))) continue;
    const n = order.get(i.field.key)!;
    const at = out.findIndex((t) => t.kind === "yours" || ("key" in t && order.get(t.key)! > n));
    out.splice(at < 0 ? out.length : at, 0, { kind: "ask", key: i.field.key }, { kind: "answer", key: i.field.key, text: "Skip for now" });
  }
  return out;
}

function ReadyChat({ jobId, items, saved }: { jobId: string; items: PackItem[]; saved: Answers }) {
  const [answers, setAnswers] = useState<Answers>(saved);
  const [coverReady, setCoverReady] = useState<Set<string>>(() => new Set());
  const [coverSkipped, setCoverSkipped] = useState<Set<string>>(() => new Set());
  const [reask, setReask] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [bulk, setBulk] = useState<"idle" | "saving" | "failed">("idle");
  // Turns already there when the chat opened don't animate in again.
  const [initial] = useState(() => new Set(transcript(items, saved, new Set()).map(turnId)));
  const reduced = useReducedMotion();
  const logRef = useRef<HTMLDivElement>(null);
  const byKey = useMemo(() => new Map(items.map((i) => [i.field.key, i])), [items]);

  // Cover state: what the server says is ready (on mount and whenever the tab regains focus), plus live ready events.
  useEffect(() => {
    let live = true;
    const merge = (keys: string[]) => setCoverReady((s) => (keys.every((k) => s.has(k)) ? s : new Set([...s, ...keys])));
    const load = () => { coverReadyKeys(jobId).then((k) => { if (live) merge(k); }).catch(() => undefined); };
    load();
    window.addEventListener("focus", load);
    const off = onCoverReady((k) => {
      merge([k]);
      setReask((r) => (r && byKey.get(r)?.group === "cover" && coverKey(byKey.get(r)!) === k ? null : r));
    });
    return () => { live = false; window.removeEventListener("focus", load); off(); };
  }, [jobId, byKey]);

  const current = reask ? byKey.get(reask) ?? null : nextToAsk(items, answers, coverReady, coverSkipped);
  const rows = progressRows(items, answers, coverReady, current?.field.key ?? null).map((r) => {
    const item = byKey.get(r.key)!;
    if (r.key === reask) return { ...r, state: "current" as const };
    if (item.group === "cover" && r.state !== "done" && coverSkipped.has(coverKey(item))) return { ...r, state: "skipped" as const };
    return r;
  });
  const pickable = useMemo(() => new Set(items.filter((i) => isAskable(i) || (i.group === "vault" && i.field.type !== "file")).map((i) => i.field.key)), [items]);
  const { left } = progressCounts(rows);
  const ready = canOpen(items, answers);
  const turns = withSkippedCovers(transcript(items, answers, coverReady), items, coverSkipped, coverReady).filter((t) => !current || t.kind !== "yours");
  // A re-asked question that already had an answer (or was skipped) can be left as it was.
  const revisiting = !!current && reask === current.field.key && (current.group === "vault" || isDone(current, answers, coverReady)
    || isSkipped(current, answers) || (current.group === "cover" && coverSkipped.has(coverKey(current))));
  const pendingConfirms = items.filter((i) => i.group === "confirm" && i.value != null && answers[i.field.key] === undefined);

  useEffect(() => { announceAutopilotProgress(left); }, [left]);

  // A short typing beat before each new question (none with reduced motion).
  const liveKey = current ? `${current.field.key}:${reask ? "re" : ""}` : null;
  const [shown, setShown] = useState(liveKey);
  useEffect(() => {
    if (liveKey === shown) return;
    const t = setTimeout(() => setShown(liveKey), reduced ? 0 : TYPING_MS);
    return () => clearTimeout(t);
  }, [liveKey, shown, reduced]);
  const showLive = reduced || liveKey === shown;

  // Keep the newest turn in view, and give a new question the focus without scrolling the page.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    const obs = new MutationObserver(() => { el.scrollTop = el.scrollHeight; });
    obs.observe(el, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!showLive) return;
    logRef.current?.querySelector<HTMLElement>("[data-autopilot-live] :is(button, input, select, textarea):not(:disabled)")?.focus({ preventScroll: true });
  }, [liveKey, showLive]);

  const save: SaveAnswer = async (key, value, approved) => {
    const r = await setAnswer(jobId, key, value, approved === undefined ? {} : { approved });
    if (!r.ok) return false;
    setBulk((b) => (b === "failed" ? "idle" : b));
    const next = { ...answers, [key]: { value, approved: approved ?? false } };
    setAnswers((a) => ({ ...a, [key]: { value, approved: approved ?? false } }));
    const item = byKey.get(key);
    // An unapproved edit keeps the question open, so "This is my answer" stays one tap away.
    if (item && (item.group === "vault" || isDone(item, next, coverReady) || isSkipped(item, next))) setReask((k) => (k === key ? null : k));
    return true;
  };
  // Confirm-all runs here, not in the live question (which remounts after each save), with the question held back meanwhile.
  const confirmAll = async (list: PackItem[]) => {
    if (bulk === "saving") return;
    setBulk("saving");
    let ok = true;
    for (const i of list) {
      try { ok = (await save(i.field.key, i.value!)) && ok; } catch { ok = false; }
    }
    setBulk(ok ? "idle" : "failed");
  };
  const show = () => { setHighlight(true); setExpanded(true); setTimeout(() => setHighlight(false), 3000); };
  const pick = (key: string) => { setReask(key); setExpanded(false); };
  const skipCover = (item: PackItem) => {
    setCoverSkipped((s) => new Set(s).add(coverKey(item)));
    setReask((k) => (k === item.field.key ? null : k));
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="order-2 flex min-w-0 flex-col bg-[#FCFCFE] lg:order-1">
        <div ref={logRef} role="log" aria-live="polite" aria-label="Autopilot chat" className="chat min-h-[320px]">
          <ChatThread turns={turns} byKey={byKey} initial={initial} onShow={show} />
          {bulk === "saving" && <div className="msg bot">Saving…</div>}
          {bulk !== "saving" && current && !showLive && <div className="msg bot typing" aria-label="Writing"><span /><span /><span /></div>}
          {bulk === "failed" && <div className="msg bot err" role="alert">Some didn&apos;t save. Try again.</div>}
          {bulk !== "saving" && current && showLive && (
            <LiveQuestion key={liveKey} jobId={jobId} item={current} answer={answers[current.field.key]} reasked={revisiting}
              pendingConfirms={pendingConfirms} save={save} onKeep={() => setReask(null)} onSkipCover={skipCover} onConfirmAll={(list) => void confirmAll(list)} />
          )}
          {!current && <div className="msg bot">All answered. You&apos;re ready to fill the form.</div>}
        </div>
      </div>
      <div className="order-1 min-w-0 lg:order-2">
        <ProgressList jobId={jobId} rows={rows} pickable={pickable} ready={ready} highlight={highlight} expanded={expanded} onExpand={setExpanded} onPick={pick} />
      </div>
    </div>
  );
}
