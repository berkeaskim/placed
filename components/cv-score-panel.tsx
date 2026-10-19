import Link from "next/link";
import { ARCHETYPE_LABELS } from "@/lib/types";
import type { Dimension } from "@/lib/cv-rules/types";
import { caveatFor } from "@/lib/cv-rules/profiles";
import type { Fix } from "@/lib/cv-score/aggregate";
import type { CvScorePanelData } from "@/lib/cv-score/panel-data";
import {
  DIM_LABEL, DISPUTED_TITLE, FAIRNESS_NOTE, IMAGE_ONLY_CAP_COPY, MODEL_CARD_URL, SELF_PREFERENCE_LABEL, SELF_PREFERENCE_NOTE, barColor, capBanners,
  couldntAssessLabel, coverageLabel, deltaLabel, disclaimer, fixWorthLabel, isConvention, judgeLabel, provisionalLabel, rulesPassedLabel, scoreBand,
  sourceChip, sparklineLabel, sparklinePoints, splitFixes,
} from "@/lib/cv-score/present";
import { DisagreeButton } from "@/components/cv-score/disagree-button";
import { CountUp, DrawCircle, GrowBar } from "@/components/agent/reveal";

/**
 * CV Score panel (spec §6.4, amendments B11). Server component; data comes from loadCvScorePanel().
 * Order: caps (never hidden) → next best fix → ring + bars → remaining fixes → "What our AI saw".
 * Two columns from lg up (next fix | score, then fixes | AI view) so the page does not run long.
 */

const DIMS: Dimension[] = ["ats", "impact", "clarity", "relevance", "uk"];

const Icon = {
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  ),
  external: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  ),
  eye: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-[#5B5B6B] transition-transform group-open:rotate-180">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

function SourceChip({ fix }: { fix: Fix }) {
  const chip = sourceChip(fix);
  const pill = "inline-flex items-center gap-1 rounded-lg bg-[#F2F2F7] px-2.5 py-1 text-xs font-semibold text-[#3F3F4C]";
  if (!chip.href) return <span className="inline-flex min-h-11 items-center self-start"><span className={pill}>{chip.label}</span></span>;
  return (
    <a
      href={chip.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/chip inline-flex min-h-11 items-center self-start no-underline focus-visible:outline-2 focus-visible:outline-[#5B3DF5]"
      title={fix.citation?.title}
    >
      <span className={`${pill} group-hover/chip:bg-[#E9E9F1]`}>
        {chip.label}
        {Icon.external}
        <span className="sr-only">(opens in a new tab)</span>
      </span>
    </a>
  );
}

/** Neutral "worth ~N pts" chip (04#23): information, not an XP reward. */
function Worth({ fix, capped, small }: { fix: Fix; capped: boolean; small?: boolean }) {
  return (
    <span className={`shrink-0 rounded-full bg-[#F2F2F7] px-2 py-0.5 font-semibold text-[#3F3F4C] ${small ? "text-[11px]" : "ml-auto text-xs"}`}>
      {fixWorthLabel(fix, capped)}
    </span>
  );
}

function DisputedChip() {
  return (
    <span className="rounded-full border border-[#F5D9A8] bg-[#FFF8EC] px-2 py-0.5 text-[11px] font-semibold text-[#7A4100]" title={DISPUTED_TITLE}>
      Disputed<span className="sr-only">: {DISPUTED_TITLE}</span>
    </span>
  );
}

function Tags({ fix, lead, capped, disputed }: { fix: Fix; lead?: string; capped: boolean; disputed: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lead && <span className="text-xs font-bold uppercase tracking-wide text-[#3A20C4]">{lead}</span>}
      <span className="text-xs font-bold uppercase tracking-wide text-[#5B5B6B]">{DIM_LABEL[fix.dimension]}</span>
      {isConvention(fix) && (
        <span className="rounded-full border border-[#DCDCE6] px-2 py-0.5 text-[11px] font-semibold text-[#5B5B6B]" title="Evidence C or D: widely given advice rather than measured">
          Convention
        </span>
      )}
      {disputed && <DisputedChip />}
      <Worth fix={fix} capped={capped} />
    </div>
  );
}

function OffendingLine({ line }: { line: string | null }) {
  if (!line) return <p className="text-sm text-[#5B5B6B]">Nothing on your CV covers this yet.</p>;
  return (
    <blockquote className="rounded-xl border-l-4 border-[#5B3DF5] bg-[#F6F6FA] px-3 py-2 text-sm leading-snug text-[#16161D] break-words">
      “{line}”
    </blockquote>
  );
}

function NextBestFix({ fix, cvId, sector, capped, disputed }: { fix: Fix; cvId: string; sector: string; capped: boolean; disputed: boolean }) {
  return (
    <section aria-labelledby="next-fix-h" className="card-quest flex h-full flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <h3 id="next-fix-h" className="flex items-center gap-2 text-base font-bold text-[#16161D]">
          <span className="text-[#5B3DF5]">{Icon.target}</span>Next best fix
        </h3>
      </div>
      <Tags fix={fix} capped={capped} disputed={disputed} />
      <p className="text-sm font-semibold leading-snug text-[#16161D]">{fix.statement}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-[#5B5B6B]">Your line</span>
          <OffendingLine line={fix.evidenceLine} />
        </div>
        {fix.fix && (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-[#5B5B6B]">Try this</span>
            <p className="rounded-xl bg-[#EFEBFF] px-3 py-2 text-sm font-medium leading-snug text-[#16161D] break-words">{fix.fix}</p>
          </div>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2">
        <SourceChip fix={fix} />
        <DisagreeButton cvId={cvId} ruleId={fix.ruleId} sector={sector} disputed={disputed} />
      </div>
    </section>
  );
}

function CompactFix({ fix, cvId, sector, capped, disputed }: { fix: Fix; cvId: string; sector: string; capped: boolean; disputed: boolean }) {
  return (
    <li className="border-t border-[#ECECF3] first:border-t-0">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="w-20 shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#5B5B6B]">{DIM_LABEL[fix.dimension]}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium group-open:whitespace-normal">{fix.statement}</span>
          {disputed && <DisputedChip />}
          <Worth fix={fix} capped={capped} small />
          {Icon.chevron}
        </summary>
        <div className="flex flex-col gap-1.5 pb-3 pl-0 sm:pl-23">
          {isConvention(fix) && (
            <span className="self-start rounded-full border border-[#DCDCE6] px-2 py-0.5 text-[11px] font-semibold text-[#5B5B6B]" title="Evidence C or D: widely given advice rather than measured">
              Convention
            </span>
          )}
          {fix.evidenceLine && <p className="text-xs italic text-[#5B5B6B] break-words">“{fix.evidenceLine}”</p>}
          {fix.fix && <p className="text-sm leading-snug text-[#16161D] break-words"><span className="font-semibold">Try: </span>{fix.fix}</p>}
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <SourceChip fix={fix} />
            <DisagreeButton cvId={cvId} ruleId={fix.ruleId} sector={sector} disputed={disputed} />
          </div>
        </div>
      </details>
    </li>
  );
}

function Sparkline({ history }: { history: number[] }) {
  const pts = sparklinePoints(history, 72, 22);
  if (!pts) return null;
  const last = pts.split(" ").at(-1)!.split(",");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#5B5B6B]">
      <svg width="76" height="26" viewBox="-2 -2 76 26" role="img" aria-label={sparklineLabel(history)}>
        <polyline points={pts} fill="none" stroke="#5B3DF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="2.5" fill="#5B3DF5" />
      </svg>
      Your trend
    </span>
  );
}

export function CvScorePanel({ data }: { data: CvScorePanelData }) {
  const { total, dimensions, sector, cvId } = data;
  const label = data.track === "spring" ? `${ARCHETYPE_LABELS[sector]} spring weeks`
    : data.track === "placement" ? `${ARCHETYPE_LABELS[sector]} placements` : ARCHETYPE_LABELS[sector];
  const provisional = data.provisional;
  const band = provisional ? null : scoreBand(total);
  const { next, rest } = splitFixes(data.fixes, 4);
  const caveat = caveatFor(sector, data.track);
  const cna = couldntAssessLabel(data.couldNotAssess);
  const capped = data.capsApplied.length > 0;
  const judge = judgeLabel(data.scoredBy);
  const range = data.range ?? { low: total, high: total };
  const disputed = new Set(data.disputed);
  const edited = deltaLabel(data.delta);

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {capBanners(data.capsApplied).map((c) => (
        <div key={c.text} role="note" className="flex gap-2 rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm text-[#7A4100] lg:col-span-2">
          {Icon.alert}
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="font-semibold">{c.text}</span>
            {c.imageOnly && (
              <Link href="/profile/quiz" className="inline-flex min-h-11 items-center font-semibold text-[#7A4100] underline underline-offset-2">
                {IMAGE_ONLY_CAP_COPY}
              </Link>
            )}
          </div>
        </div>
      ))}

      {next && <NextBestFix fix={next} cvId={cvId} sector={sector} capped={capped} disputed={disputed.has(next.ruleId)} />}

      <section aria-labelledby="cv-score-h" className={`flex flex-col gap-4 rounded-[20px] border border-[#E6E6EF] bg-white p-5 ${next ? "" : "lg:col-span-2"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="cv-score-h" className="text-base font-bold">Your CV Score</h2>
          {band
            ? <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: band.bg, color: band.fg }}>{band.label}</span>
            : <span className="rounded-full bg-[#F2F2F7] px-2.5 py-1 text-xs font-bold text-[#3F3F4C]">Provisional</span>}
        </div>

        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-1">
            {provisional ? (
              <div role="img" aria-label={`Provisional CV score between ${range.low} and ${range.high} out of 100 for ${label}`} className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-full border-[12px] border-[#ECECF3] text-center">
                <span className="text-2xl font-bold text-[#16161D]" style={{ fontFamily: "var(--font-quest)" }}>{provisionalLabel(range)}</span>
                <span className="text-xs font-semibold text-[#5B5B6B]">/100</span>
              </div>
            ) : (
            <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`CV score ${total} out of 100 for ${label}`}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#ECECF3" strokeWidth="12" />
              <g transform="rotate(-90 60 60)"><DrawCircle cx={60} cy={60} r={52} value={total / 100} stroke="#5B3DF5" strokeWidth={12} /></g>
              <text x="60" y="66" textAnchor="middle" fontSize="34" fontWeight="700" fill="#16161D" style={{ fontFamily: "var(--font-quest)" }}><CountUp to={total} duration={1.1} /></text>
              <text x="60" y="84" textAnchor="middle" fontSize="12" fontWeight="600" fill="#5B5B6B">/100</text>
            </svg>
            )}
            <p className="text-center text-xs font-semibold text-[#5B5B6B]">
              <span className="sr-only">{provisional ? `${provisionalLabel(range)}` : total}/100 </span>for {label}
            </p>
          </div>
          <div className="flex w-full flex-1 flex-col gap-2 text-xs">
            {DIMS.map((d, i) => {
              const v = dimensions[d];
              return (
                <div key={d} className="flex flex-col gap-0.5">
                  <div className="flex justify-between"><span>{DIM_LABEL[d]}</span><b>{v ?? "—"}</b></div>
                  <div className="h-[6px] rounded-full bg-[#ECECF3]">
                    {v !== null && <GrowBar value={v / 100} delay={0.15 + i * 0.06} className="h-[6px] rounded-full" style={{ background: barColor(v) }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {data.aiUnavailable && (
          <p role="status" className="flex gap-2 rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm text-[#7A4100]">
            {Icon.info}<span><b>AI review unavailable — showing the automatic checks only.</b> Rules that need the AI to read your bullets aren&apos;t counted yet; score again in a moment for the full review.</span>
          </p>
        )}
        {provisional && !data.aiUnavailable && (
          <p role="status" className="flex gap-2 rounded-xl bg-[#F6F6FA] px-3 py-2 text-sm text-[#3F3F4C]">
            {Icon.info}<span><b>Provisional.</b> We couldn&apos;t check enough of the rules to give one number, so this shows the range your score falls in. Score again for a full review.</span>
          </p>
        )}

        {data.madeByPlaced && (
          <div role="note" className="flex gap-2 rounded-xl border border-[#DCDCE6] bg-[#F6F6FA] px-3 py-2 text-sm text-[#3F3F4C]">
            {Icon.info}<span><b>{SELF_PREFERENCE_LABEL}.</b> {SELF_PREFERENCE_NOTE}</span>
          </div>
        )}
        {edited && <p className="text-xs leading-snug text-[#5B5B6B]">{edited}</p>}

        {/* Visible, never collapsed (04#23): what the number is and isn't. */}
        <p className="text-xs leading-snug text-[#5B5B6B]">{disclaimer(sector)}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B5B6B]">
          <span className="font-semibold text-[#16161D]">{rulesPassedLabel(data.passed, data.assessed)}</span>
          {cna && <span title="The AI couldn't give a usable answer for these rules, so they're shown as a range, not counted as passes.">{cna}</span>}
          {data.coverage !== null && data.coverage < 1 && <span>{coverageLabel(data.coverage)}</span>}
          {judge && <span>{judge}</span>}
          <Sparkline history={data.history} />
        </div>

        <details className="group/about mt-auto text-xs text-[#5B5B6B]">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold [&::-webkit-details-marker]:hidden">
            {Icon.info}How this score works
          </summary>
          <div className="flex flex-col gap-2 pt-1">
            {caveat && <p className="rounded-xl bg-[#F6F6FA] px-3 py-2 text-sm text-[#3F3F4C]">{caveat}</p>}
            <p className="leading-snug">Each rule counts by how much it matters (critical, major or minor), and the sector shifts that a little. A fix shows how many points it would really add.</p>
            <p className="leading-snug">{FAIRNESS_NOTE}</p>
            <p className="leading-snug">Scores from different AI models aren&apos;t comparable, so your trend only shows scores from the same model.</p>
            <p className="leading-snug">A range instead of one number means the AI couldn&apos;t check enough rules: your score is somewhere in it. The bands (Developing, Strong, Polished) are rough guides, not yet set from data.</p>
            <p className="leading-snug">
              We haven&apos;t yet checked the AI&apos;s verdicts against careers advisers.{" "}
              <a href={MODEL_CARD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-[#3A20C4] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#5B3DF5]">
                Read the model card<span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              for what the score measures, what it doesn&apos;t, and its known limits.
            </p>
          </div>
        </details>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="more-fixes-h" className={`flex flex-col gap-1 rounded-[20px] border border-[#E6E6EF] bg-white px-5 pt-4 pb-2 ${data.aiSaw ? "" : "lg:col-span-2"}`}>
          <h3 id="more-fixes-h" className="text-sm font-bold">More fixes <span className="font-semibold text-[#5B5B6B]">· {rest.length}</span></h3>
          <ol className="flex flex-col">
            {rest.map((f) => <CompactFix key={f.ruleId} fix={f} cvId={cvId} sector={sector} capped={capped} disputed={disputed.has(f.ruleId)} />)}
          </ol>
        </section>
      )}

      {data.aiSaw && (
        <details className={`group self-start rounded-[20px] border border-[#E6E6EF] bg-white ${rest.length > 0 ? "" : "lg:col-span-2"}`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="text-[#5B3DF5]">{Icon.eye}</span>What our AI saw
            <span className="ml-auto">{Icon.chevron}</span>
          </summary>
          <div className="flex flex-col gap-2 px-5 pb-5">
            <p className="text-xs text-[#5B5B6B]">Your name, contact details and personal markers were removed before the AI read your CV.</p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#F6F6FA] p-3 font-mono text-xs leading-relaxed text-[#3F3F4C]">{data.aiSaw}</pre>
          </div>
        </details>
      )}
    </div>
  );
}
