"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { celebrate } from "@/components/reward-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentStatus, AgentSteps, useAgentSteps } from "@/components/agent/agent-steps";
import { Reveal, StaggerItem } from "@/components/agent/reveal";
import { CoverageHero } from "@/components/tailor/coverage-hero";
import { TailoredForList } from "@/components/tailor/tailored-for-list";
import { ChangeCard } from "@/components/tailor/change-card";
import { NumberDialog, type NumberAsk, type NumberChoice } from "@/components/tailor/number-dialog";
import { CaughtList, VerificationBadge } from "@/components/tailor/verification";
import { RulesGainedPanel } from "@/components/tailor/rules-gained";
import { DefendList } from "@/components/tailor/defend-list";
import { DownloadIcon, InfoIcon, UndoIcon } from "@/components/tailor/icons";
import {
  applyGateBlocks, blockedByBullet, buildFinal, caughtNumbers, defendBullets, fallbackNotice, fillPlaceholder, hasPlaceholder,
  anyConfirmed, caughtStatus, decisionCounts, decisionsFromFinal, isDirty, keywordCounts, stripPlaceholder, verificationCopy, verificationState,
  type DefendQuestion, type DefendSource, type Decision, type Decisions, type OriginalParts, type TailorOutcome,
} from "@/lib/tailor/view";
import type { TailoredCV } from "@/lib/types";
import { swapBankItem, tailorForJob, type BankView, type OverflowResult, type TailorResult } from "./actions";
import { BankBlock, OverflowRemove, untailoredIdsOf } from "./bank-block";
import { confirmNumberWithXp, getDefendQuestions, previewTailoring, saveTailoredVersion, type PreviewResult } from "./tailor-actions";

type Preview = Exclude<PreviewResult, { error: string }>;
type DefendState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; key: string; questions: DefendQuestion[]; source: DefendSource };

/** C13 questions cached per job and exact lines for the session (the server also caches in tailored_json). */
const defendCache = new Map<string, { questions: DefendQuestion[]; source: DefendSource }>();

/** The real stages of tailorForJob → runTailoring, in order (context load, coverage pre-pass, LLM rewrite, gate, PDF). */
const TAILOR_STEPS = ["Reading the posting and your CV", "Measuring keyword coverage", "Rewriting your bullets for this role", "Checking every claim against your original", "Rendering your verified PDF"] as const;
/** Result sections arrive in sequence, only right after a tailoring run (not on a revisit). */
const resultIn: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };

const SECTIONS = ["experience", "projects", "leadership"] as const;
function lineOf(t: TailoredCV, id: string): string {
  if (id === "summary") return t.summary ?? "";
  for (const s of SECTIONS) for (const e of t[s]) for (const b of e.bullets) if (b.id === id) return b.text;
  return "";
}

function Section({ id, title, children, aside }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="font-bold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The tailoring screen (spec §8, amendments B6–B9, C13): what we tailored for, what changed and why, with every line
 * traced to the original CV. The student accepts, edits or rejects each change; every version is re-checked by the
 * same gate before a PDF can be made.
 */
export function TailorPanel({ jobId, hasCv, original, initial }: {
  jobId: string; hasCv: boolean; original: OriginalParts; initial: { outcome: TailorOutcome; final: TailoredCV | null; bank: BankView | null } | null;
}) {
  const [outcome, setOutcome] = useState<TailorOutcome | null>(initial?.outcome ?? null);
  const [pdfUrl, setPdfUrl] = useState(`/api/tailored/${jobId}`);
  // Fix 2: a revisit starts from the saved version (tailored_json.final), never from the AI version.
  const [decisions, setDecisions] = useState<Decisions>(() => (initial?.final ? decisionsFromFinal(initial.outcome, initial.final, original) : {}));
  const [history, setHistory] = useState<Decisions[]>([]);
  const [preview, setPreview] = useState<{ key: string; data: Preview } | null>(null);
  // The stored PDF is the version those decisions build (all-suggested right after tailorForJob, or the saved final).
  const [savedKey, setSavedKey] = useState<string | null>(() =>
    initial ? JSON.stringify(buildFinal(initial.outcome.tailored, initial.outcome.changes, decisions, original)) : null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState<BankView | null>(initial?.bank ?? null);
  // A one-page overflow: which call the removal buttons make depends on where it came from (a tailor stored nothing).
  const [overflow, setOverflow] = useState<{ o: Pick<OverflowResult, "message" | "remove">; source: "tailor" | "swap" } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ask, setAsk] = useState<NumberAsk | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [defend, setDefend] = useState<DefendState>({ status: "idle" });
  const [tailoring, startTailor] = useTransition();
  const [busy, startBusy] = useTransition();
  const firstRun = tailoring && !outcome;
  const steps = useAgentSteps(TAILOR_STEPS.length, firstRun, { stepMs: 2200 });
  const showSteps = firstRun || (steps.finishing && !!outcome);
  const [animateIn, setAnimateIn] = useState(false);

  const final = useMemo(() => (outcome ? buildFinal(outcome.tailored, outcome.changes, decisions, original) : null), [outcome, decisions, original]);
  const key = useMemo(() => (final ? JSON.stringify(final) : ""), [final]);
  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);

  // Live gate + exact recount + rules gained on every change (debounced). A blocked line is reverted, never rendered.
  useEffect(() => {
    if (!final) return;
    const k = key;
    const t = setTimeout(() => {
      previewTailoring(jobId, final).then((r) => {
        if (keyRef.current !== k) return;
        if ("error" in r) { setPreviewErr(k); return; }
        setPreview({ key: k, data: r });
        const blocked = blockedByBullet(r.report);
        if (blocked.size) {
          setDecisions((d) => applyGateBlocks(d, r.report));
          const first = [...blocked.values()][0];
          setNotice(`We put your original wording back: "${first.claim}" isn't in your CV.`);
        }
      }).catch(() => { if (keyRef.current === k) setPreviewErr(k); }); // advisory: the save path re-runs the same gate
    }, 350);
    return () => clearTimeout(t);
  }, [jobId, key, final, retry]);

  /** One place for every tailor / re-select / swap result: overflow shows removal buttons, success replaces the outcome. */
  const applyResult = (r: TailorResult, source: "tailor" | "swap") => {
    if ("remove" in r) { setOverflow({ o: r, source }); return; }
    if ("error" in r) { setError(r.error); return; }
    setOverflow(null);
    // After a swap the student's kept edits come back as `final`; a fresh tailor starts from the suggestions.
    const next = r.final ? decisionsFromFinal(r.outcome, r.final, original) : {};
    setOutcome(r.outcome); setPdfUrl(r.pdfUrl); setDecisions(next); setHistory([]); setPreview(null); setPreviewErr(null); setDefend({ status: "idle" });
    setSavedKey(JSON.stringify(buildFinal(r.outcome.tailored, r.outcome.changes, next, original)));
    setBank(r.bank);
    if (source === "tailor") { setAnimateIn(true); celebrate(r.award); }
  };

  const run = (extraExcluded?: string[]) => startTailor(async () => {
    setError(null); setNotice(null); setOverflow(null);
    applyResult(await tailorForJob(jobId, extraExcluded ? { extraExcluded } : undefined), "tailor");
  });

  const removeForOverflow = (bulletId: string) => {
    if (overflow?.source === "tailor") { run([bulletId]); return; }
    startBusy(async () => { setError(null); applyResult(await swapBankItem(jobId, bulletId, "remove"), "swap"); });
  };

  const decide = (id: string, d: Decision) => {
    setHistory((h) => [...h.slice(-30), decisions]);
    setDecisions((cur) => ({ ...cur, [id]: d }));
    setNotice(null);
  };
  const undo = () => {
    if (!history.length) return;
    setDecisions(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  const chooseNumber = (choice: NumberChoice, figure: string) => {
    if (!ask) return;
    const a = ask;
    startBusy(async () => {
      setAskError(null);
      const claim = a.kind === "caught" ? a.claim : figure;
      // Only a confirmed or corrected figure is stored; leave out / keep original / an empty rewrite store nothing.
      if (choice === "confirm" || (choice === "edit" && figure)) {
        const r = await confirmNumberWithXp(jobId, choice === "edit" && a.kind === "placeholder" ? a.text : claim, choice, figure);
        if ("error" in r) { setAskError(r.error); return; }
        celebrate(r.award);
      }
      if (a.kind === "placeholder") {
        if (choice === "confirm") decide(a.bulletId, { kind: "edited", text: fillPlaceholder(a.text, figure) });
        else if (choice === "edit") { decide(a.bulletId, { kind: "edited", text: figure ? fillPlaceholder(a.text, figure) : stripPlaceholder(a.text) }); setNotice("Your line is ready to edit: use Edit on the card to reword it."); }
        else if (choice === "remove") decide(a.bulletId, { kind: "edited", text: stripPlaceholder(a.text) });
        else decide(a.bulletId, { kind: "rejected" });
      } else if (choice === "confirm") {
        decide(a.bulletId, { kind: "edited", text: a.attempted });
      } else if (choice === "edit") {
        decide(a.bulletId, { kind: "edited", text: a.attempted.split(a.claim).join(figure) });
      }
      setAsk(null);
    });
  };

  const download = () => {
    if (!final) return;
    if (savedKey === key) { window.location.assign(pdfUrl); return; }
    startBusy(async () => {
      setError(null);
      const r = await saveTailoredVersion(jobId, final);
      if ("remove" in r) { setOverflow({ o: r, source: "swap" }); return; }
      if ("error" in r) {
        if ("report" in r && r.report) { const rep = r.report; setDecisions((d) => applyGateBlocks(d, rep)); }
        setError(r.error);
        return;
      }
      setSavedKey(key); setPdfUrl(r.pdfUrl);
      celebrate(r.award);
      window.location.assign(r.signedUrl ?? r.pdfUrl);
    });
  };

  if (!hasCv) {
    return (
      <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5">
        <h2 className="font-bold">Tailor my CV</h2>
        <p className="text-sm text-muted-foreground">Upload your CV first: we tailor what&apos;s already on it to this role, and never invent experience.</p>
        <Link href="/profile" className="btn-quest self-start px-4 py-2.5 text-sm no-underline">Upload my CV</Link>
      </section>
    );
  }

  if (!outcome || !final || showSteps) {
    return (
      <section className="flex flex-col gap-3 rounded-[20px] border bg-white p-5" aria-busy={showSteps}>
        <div className="flex items-center justify-between"><h2 className="font-bold">Tailor my CV</h2><span className="chip-xp">+30 XP</span></div>
        <p className="text-sm text-muted-foreground">We reword and reorder what&apos;s already on your CV so this posting&apos;s requirements are easy to find. Every claim is checked against your original.</p>
        {showSteps ? (
          <AgentSteps steps={TAILOR_STEPS} index={steps.index} label="Tailoring agent" />
        ) : (
          <button type="button" onClick={() => run()} className="btn-quest min-h-12 py-3">Tailor my CV for this role</button>
        )}
        {error && <p className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]" role="alert">{error}</p>}
        {overflow && !showSteps && <OverflowRemove overflow={overflow.o} pending={tailoring || busy} onRemove={removeForOverflow} />}
      </section>
    );
  }

  const fresh = preview?.key === key ? preview.data : null;
  const report = fresh?.report ?? outcome.report;
  const vstate = verificationState(report, outcome.reverted.length);
  const kw = keywordCounts(outcome.tailoredFor);
  const confirmed = new Map(caughtStatus(outcome.reverted, decisions).flatMap((x) => (x.confirmed === null ? [] : [[x.bulletId, x.confirmed] as const])));
  const fallback = fallbackNotice(outcome.usedFallback, outcome.fallbackReason);
  const caught = caughtNumbers(outcome);
  const toDefend = defendBullets(outcome.changes, decisions, final);
  const defendKey = `${jobId}:${JSON.stringify(toDefend)}`;
  const blocked = report.verdict === "block";
  const previewFailed = previewErr === key && preview?.key !== key;
  const checking = preview?.key !== key && !previewFailed;
  const saved = savedKey === key;
  const suggestedLeft = outcome.changes.some((c) => (decisions[c.bulletId]?.kind ?? "suggested") === "suggested");
  const tally = decisionCounts(outcome.changes, decisions);

  const loadDefend = () => {
    const hit = defendCache.get(defendKey);
    if (hit) { setDefend({ status: "ready", key: defendKey, ...hit }); return; }
    setDefend({ status: "loading" });
    getDefendQuestions(jobId, toDefend).then((r) => {
      if ("error" in r) { setDefend({ status: "error", message: r.error }); return; }
      if (r.source === "ai") defendCache.set(defendKey, { questions: r.questions, source: r.source });
      setDefend({ status: "ready", key: defendKey, questions: r.questions, source: r.source });
    }).catch(() => setDefend({ status: "error", message: "We couldn't prepare questions right now. Try again in a moment." }));
  };

  return (
    <motion.section className="flex flex-col gap-5 rounded-[20px] border bg-white p-5" aria-label="Your tailored CV" aria-busy={tailoring}
      variants={resultIn} initial={animateIn ? "hidden" : false} animate="show">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold tracking-tight">What we tailored for, and why</h2>
          <button type="button" onClick={() => run()} disabled={tailoring} className="inline-flex min-h-11 shrink-0 items-center px-1 text-xs font-semibold text-[#5B3DF5] hover:underline disabled:opacity-50">
            {tailoring ? "Tailoring…" : "Tailor again"}
          </button>
        </div>
        {tailoring && <AgentStatus className="text-xs">Re-tailoring against this posting…</AgentStatus>}
      </div>

      <div className={`flex flex-col gap-5 transition-opacity duration-300 ${tailoring ? "opacity-50" : ""}`}>
        {(fallback || outcome.fellBackToOriginal) && (
          <StaggerItem className="flex flex-col gap-2">
            {fallback && (
              <p className="flex gap-2 rounded-xl bg-[#EEF2FF] px-3 py-2.5 text-sm text-[#2340A8]" role="note"><InfoIcon size={18} className="shrink-0" />{fallback}</p>
            )}
            {outcome.fellBackToOriginal && (
              <p className="flex gap-2 rounded-xl bg-[#FFF1DC] px-3 py-2.5 text-sm text-[#7A4100]" role="note"><InfoIcon size={18} className="shrink-0" />We couldn&apos;t make changes we can stand behind, so your original CV stands unchanged.</p>
            )}
          </StaggerItem>
        )}

        <StaggerItem><CoverageHero before={outcome.coverageBefore} after={fresh?.coverageAfter ?? outcome.coverageAfter} must={kw.must} nice={kw.nice} /></StaggerItem>

        <StaggerItem>
          <Section id="tailored-for" title="What we tailored for">
            <TailoredForList items={outcome.tailoredFor} />
          </Section>
        </StaggerItem>

        {bank && (
          <StaggerItem>
            <Section id="from-bank" title="From your bank">
              <BankBlock report={bank.report} stale={bank.stale} newCvSuggestions={bank.newCvSuggestions} jobId={jobId}
                untailoredIds={untailoredIdsOf(outcome.tailored)} disabled={tailoring || busy}
                onResult={(r) => applyResult(r, "swap")} />
            </Section>
          </StaggerItem>
        )}

        {outcome.reverted.length > 0 && (
          <StaggerItem>
            <CaughtList reverted={outcome.reverted} caught={caught} confirmed={confirmed}
              onConfirm={(c) => { setAskError(null); setAsk({ kind: "caught", ...c }); }}
              onUndo={(id) => decide(id, { kind: "suggested" })} />
          </StaggerItem>
        )}

        <StaggerItem>
          <Section id="changes" title="What changed, and why"
            aside={history.length > 0
              ? <button type="button" onClick={undo} className="inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold text-[#5B3DF5] hover:underline"><UndoIcon size={12} />Undo</button>
              : undefined}>
            {notice && <Reveal key={notice}><p className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]" role="status">{notice}</p></Reveal>}
            {outcome.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your CV already covers this role well, so nothing needed changing.</p>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
                  <span><span className="rounded bg-[#FDECEA] px-1 text-[#B42318] line-through">struck out</span> = removed, <span className="rounded bg-[#E3F6EE] px-1 font-semibold text-[#0B6B49] underline decoration-2 underline-offset-2">underlined</span> = added.</span>
                  <span className="font-semibold text-foreground">{tally.accepted} accepted · {tally.rejected} kept original · {tally.pending} to decide</span>
                  {tally.pending > 0 && <span>Undecided lines use our suggestion in the PDF.</span>}
                </p>
                {/* --ink-base holds the AI-wording ink until the cards have faded in. */}
                <ul className="flex flex-col gap-3" style={animateIn ? ({ "--ink-base": "450ms" } as React.CSSProperties) : undefined}>
                  {outcome.changes.map((c) => {
                    const d = decisions[c.bulletId] ?? { kind: "suggested" as const };
                    return (
                      <ChangeCard key={c.bulletId} change={c} decision={d} text={stripPlaceholder(lineOf(final, c.bulletId) || c.after)}
                        onDecide={(x) => decide(c.bulletId, x)}
                        onUndo={() => decide(c.bulletId, { kind: "suggested" })}
                        onConfirmNumber={() => {
                          const text = d.kind === "edited" ? d.text : c.after;
                          if (hasPlaceholder(text)) { setAskError(null); setAsk({ kind: "placeholder", bulletId: c.bulletId, text, original: c.before }); }
                        }} />
                    );
                  })}
                </ul>
                {suggestedLeft && (
                  <button type="button" className="min-h-11 self-start rounded-xl border-2 border-[#0E8A5F]/40 px-3 text-sm font-bold text-[#0B6B49] hover:bg-[#E3F6EE]"
                    onClick={() => {
                      setHistory((h) => [...h, decisions]);
                      setDecisions((cur) => {
                        const next = { ...cur };
                        for (const c of outcome.changes) if ((cur[c.bulletId]?.kind ?? "suggested") === "suggested" && !c.needsNumber) next[c.bulletId] = { kind: "accepted" };
                        return next;
                      });
                    }}>
                    Accept all suggestions
                  </button>
                )}
              </>
            )}
          </Section>
        </StaggerItem>

        <StaggerItem><RulesGainedPanel rules={fresh?.rules ?? preview?.data.rules ?? null} /></StaggerItem>

        <StaggerItem><VerificationBadge state={vstate} text={verificationCopy(vstate, anyConfirmed(outcome, decisions))} /></StaggerItem>

        <StaggerItem className="flex flex-col gap-1.5">
          <button type="button" onClick={download} disabled={blocked || busy || checking}
            className="btn-quest inline-flex min-h-12 items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-60">
            <DownloadIcon size={18} />
            {busy ? "Checking and saving…" : checking ? "Checking your version…" : saved ? (isDirty(decisions) ? "Download your saved version" : "Download PDF") : "Save my version and download PDF"}
          </button>
          {checking && <AgentStatus className="text-xs">Re-running the claim check on your version…</AgentStatus>}
          <p className="text-xs text-muted-foreground">ATS-safe: one column, standard headings, contact details in the body.{isDirty(decisions) ? " Your choices are re-checked before the PDF is made." : ""}</p>
          {previewFailed && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-[#7A4100]" role="status">
              We couldn&apos;t check your version just now; saving re-checks it anyway.
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="inline-flex min-h-11 items-center px-1 font-bold text-[#5B3DF5] hover:underline">Try again</button>
            </p>
          )}
          {error && <p className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]" role="alert">{error}</p>}
          {overflow && <OverflowRemove overflow={overflow.o} pending={tailoring || busy} onRemove={removeForOverflow} />}
        </StaggerItem>

        <StaggerItem>
          <Section id="defend" title="Be ready to defend this">
            {toDefend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Accept or edit a change and we&apos;ll show the question an interviewer is most likely to ask about it.</p>
            ) : defend.status === "ready" && defend.key === defendKey ? (
              <DefendList bullets={toDefend} questions={defend.questions} source={defend.source} />
            ) : defend.status === "loading" ? (
              <div className="flex flex-col gap-2">
                <AgentStatus className="text-xs">Predicting what an interviewer will ask…</AgentStatus>
                <Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <>
                {!saved && <p className="text-xs text-muted-foreground">Download (which saves your version) first, then we&apos;ll prepare questions for exactly those lines.</p>}
                <button type="button" onClick={loadDefend} disabled={!saved || checking || blocked} className="min-h-11 self-start disabled:cursor-not-allowed disabled:opacity-50 rounded-xl border-2 border-[#5B3DF5] px-4 text-sm font-bold text-[#3A20C4] hover:bg-[#F4F1FF]">
                  Show likely interview questions ({toDefend.length})
                </button>
                {defend.status === "error" && <p className="text-sm text-[#B42318]" role="alert">{defend.message}</p>}
              </>
            )}
          </Section>
        </StaggerItem>
      </div>

      <NumberDialog key={ask ? `${ask.kind}-${ask.bulletId}` : "none"} ask={ask} pending={busy} error={askError} onChoose={chooseNumber} onClose={() => setAsk(null)} />
    </motion.section>
  );
}
