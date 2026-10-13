import Link from "next/link";
import { ARCHETYPE_LABELS } from "@/lib/types";
import type { Dimension } from "@/lib/cv-rules/types";
import { SECTOR_CAVEATS } from "@/lib/cv-rules/profiles";
import type { Fix } from "@/lib/cv-score/aggregate";
import type { CvScorePanelData } from "@/lib/cv-score/panel-data";
import {
  DIM_LABEL, IMAGE_ONLY_CAP_COPY, barColor, capBanners, couldntAssessLabel, disclaimer, isConvention, rulesPassedLabel,
  scoreBand, sourceChip, sparklineLabel, sparklinePoints, splitFixes,
} from "@/lib/cv-score/present";
import { DisagreeButton } from "@/components/cv-score/disagree-button";

/**
 * CV Score panel (spec §6.4, amendments B11). Server component; data comes from loadCvScorePanel().
 * Order: caps (never hidden) → next best fix → ring + bars → remaining fixes → "What our AI saw".
 */

const DIMS: Dimension[] = ["ats", "impact", "clarity", "relevance", "uk"];
const RING = 327; // 2πr for r = 52

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-auto transition-transform group-open:rotate-180">
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

function Tags({ fix, lead }: { fix: Fix; lead?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lead && <span className="text-xs font-bold uppercase tracking-wide text-[#3A20C4]">{lead}</span>}
      <span className="text-xs font-bold uppercase tracking-wide text-[#5B5B6B]">{DIM_LABEL[fix.dimension]}</span>
      {isConvention(fix) && (
        <span className="rounded-full border border-[#DCDCE6] px-2 py-0.5 text-[11px] font-semibold text-[#5B5B6B]" title="Evidence C or D: widely given advice rather than measured">
          Convention
        </span>
      )}
      <span className="chip-xp ml-auto">+{fix.lostPoints} pts</span>
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

function NextBestFix({ fix, cvId, sector }: { fix: Fix; cvId: string; sector: string }) {
  return (
    <section aria-labelledby="next-fix-h" className="card-quest flex flex-col gap-3 p-5">
      <h3 id="next-fix-h" className="flex items-center gap-2 text-base font-bold text-[#16161D]">
        <span className="text-[#5B3DF5]">{Icon.target}</span>Next best fix
      </h3>
      <Tags fix={fix} />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[#5B5B6B]">Your line</span>
        <OffendingLine line={fix.evidenceLine} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-[#5B5B6B]">Why it matters</span>
        <p className="text-sm leading-snug">{fix.statement}</p>
        <SourceChip fix={fix} />
      </div>
      {fix.fix && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#5B5B6B]">Try this</span>
          <p className="rounded-xl bg-[#EFEBFF] px-3 py-2 text-sm font-medium leading-snug text-[#16161D] break-words">{fix.fix}</p>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#5B5B6B]">
          Worth <span className="num-quest text-base text-[#9A6B00]">+{fix.lostPoints} pts</span>
        </span>
        <DisagreeButton cvId={cvId} ruleId={fix.ruleId} sector={sector} />
      </div>
    </section>
  );
}

function CompactFix({ fix, cvId, sector }: { fix: Fix; cvId: string; sector: string }) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-[#ECECF3] pt-3 first:border-t-0 first:pt-0">
      <Tags fix={fix} />
      {fix.evidenceLine && <p className="text-xs italic text-[#5B5B6B] break-words">“{fix.evidenceLine}”</p>}
      <p className="text-sm leading-snug">{fix.statement}</p>
      <SourceChip fix={fix} />
      {fix.fix && <p className="text-sm leading-snug text-[#16161D] break-words"><span className="font-semibold">Try: </span>{fix.fix}</p>}
      <div className="flex justify-end"><DisagreeButton cvId={cvId} ruleId={fix.ruleId} sector={sector} /></div>
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
  const label = ARCHETYPE_LABELS[sector];
  const band = scoreBand(total);
  const { next, rest } = splitFixes(data.fixes, 4);
  const caveat = SECTOR_CAVEATS[sector];
  const cna = couldntAssessLabel(data.couldNotAssess);
  const dash = Math.round((Math.min(100, Math.max(0, total)) / 100) * RING);

  return (
    <div className="flex w-full flex-col gap-4">
      {capBanners(data.capsApplied).map((c) => (
        <div key={c.text} role="note" className="flex gap-2 rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm text-[#7A4100]">
          {Icon.alert}
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{c.text}</span>
            {c.imageOnly && (
              <Link href="/profile/quiz" className="inline-flex min-h-11 items-center font-semibold text-[#7A4100] underline underline-offset-2">
                {IMAGE_ONLY_CAP_COPY}
              </Link>
            )}
          </div>
        </div>
      ))}

      {next && <NextBestFix fix={next} cvId={cvId} sector={sector} />}

      <section aria-labelledby="cv-score-h" className="flex flex-col gap-4 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="cv-score-h" className="text-base font-bold">Your CV Score</h2>
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: band.bg, color: band.fg }}>{band.label}</span>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <svg width="112" height="112" viewBox="0 0 120 120" role="img" aria-label={`CV score ${total} out of 100 for ${label}`}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#ECECF3" strokeWidth="12" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#5B3DF5" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${RING}`} transform="rotate(-90 60 60)" />
              <text x="60" y="66" textAnchor="middle" fontSize="34" fontWeight="700" fill="#16161D" style={{ fontFamily: "var(--font-quest)" }}>{total}</text>
              <text x="60" y="84" textAnchor="middle" fontSize="12" fontWeight="600" fill="#5B5B6B">/100</text>
            </svg>
            <p className="text-center text-sm font-semibold">
              <span className="num-quest">{total}/100</span> for {label}
            </p>
          </div>
          <div className="flex w-full flex-1 flex-col gap-2 text-xs">
            {DIMS.map((d) => {
              const v = dimensions[d];
              return (
                <div key={d} className="flex flex-col gap-0.5">
                  <div className="flex justify-between"><span>{DIM_LABEL[d]}</span><b>{v ?? "—"}</b></div>
                  <div className="h-[5px] rounded-full bg-[#ECECF3]">
                    {v !== null && <div className="h-[5px] rounded-full" style={{ width: `${v}%`, background: barColor(v) }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B5B6B]">
          <span className="font-semibold text-[#16161D]">{rulesPassedLabel(data.passed, data.assessed)}</span>
          {cna && <span title="The AI's answer didn't match a line in your CV, so these rules aren't counted.">{cna}</span>}
          <Sparkline history={data.history} />
        </div>

        {caveat && (
          <p className="flex gap-2 rounded-xl bg-[#F6F6FA] px-3 py-2 text-sm text-[#3F3F4C]">{Icon.info}<span>{caveat}</span></p>
        )}

        <p className="text-xs leading-snug text-[#5B5B6B]">{disclaimer(sector)}</p>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="more-fixes-h" className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
          <h3 id="more-fixes-h" className="text-sm font-bold">More fixes</h3>
          <ol className="flex flex-col gap-3">
            {rest.map((f) => <CompactFix key={f.ruleId} fix={f} cvId={cvId} sector={sector} />)}
          </ol>
        </section>
      )}

      {data.aiSaw && (
        <details className="group rounded-[20px] border border-[#E6E6EF] bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="text-[#5B3DF5]">{Icon.eye}</span>What our AI saw
            {Icon.chevron}
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
