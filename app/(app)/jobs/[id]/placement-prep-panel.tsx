"use client";
import { useMemo, useState } from "react";
import { ClipboardList, Lightbulb, Route, ShieldAlert, ShieldCheck, Video } from "lucide-react";
import { PLACEMENT_FRAMING, PLACEMENT_GROUPS, placementPracticeSet, placementQuestions, type PlacementContext } from "@/lib/interview-prep/placement-bank";
import type { StorySuggestion } from "@/lib/interview-prep/spring-stories";
import { Bank, SectionTitle, Stories } from "./spring-prep-panel";
import { VideoPractice } from "./video-practice";

/**
 * Placement interview practice: the 40-question placement bank (technicals for this stream), timed video practice and
 * STAR stories from the Experience Bank, built from the spring panel's parts. Local, no AI call. Shown before applying
 * too; the web-researched pack (InterviewPrepPanel) adds what candidates reported once the student has applied.
 */
export function PlacementPrepPanel({ ctx, stories, bankEmpty, coachOnly }: { ctx: PlacementContext; stories: StorySuggestion[]; bankEmpty: boolean; coachOnly: string | null }) {
  const [seed, setSeed] = useState(0);
  const set = useMemo(() => placementPracticeSet(ctx, { seed }), [ctx, seed]);
  const all = useMemo(() => placementQuestions(ctx), [ctx]);

  return (
    <section id="placement-prep" aria-label="Placement interview practice" className="relative flex scroll-mt-6 flex-col gap-8 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(31,20,90,0.12)] sm:p-7">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5B3DF5]">{ctx.firm} · Placement year</p>
        <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-0.022em] text-[#1C1C1E]">Interview practice</h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.47] tracking-[-0.01em] text-[#3C3C43]">{PLACEMENT_FRAMING.lead}</p>
        {coachOnly && (
          <p role="note" className="flex gap-2 rounded-[14px] bg-[#FFF4E5] px-4 py-3 text-[14px] leading-snug text-[#7A4100]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><span className="font-semibold">Coach-only. </span>{coachOnly}</span>
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <SectionTitle icon={Route}>How it usually runs</SectionTitle>
        <ol className="grid gap-2 sm:grid-cols-4">
          {PLACEMENT_FRAMING.process.map((s, i) => (
            <li key={s.stage} className="flex flex-col gap-1 rounded-[14px] bg-[#F6F5FB] p-3">
              <span className="text-[12px] font-semibold tabular-nums text-[#5B3DF5]">{i + 1}</span>
              <p className="text-[14px] font-semibold leading-snug text-[#1C1C1E]">{s.stage}</p>
              <p className="text-[13px] leading-[1.38] text-[#6E6E73]">{s.note}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle icon={Video}>Practise the video interview</SectionTitle>
        <p className="text-[14px] leading-[1.43] text-[#6E6E73]">{ctx.preset.note}</p>
        <VideoPractice key={seed} questions={set} prepSeconds={ctx.preset.prepSeconds} answerSeconds={ctx.preset.answerSeconds} onRestart={() => setSeed((s) => s + 1)} />
      </div>

      <Stories stories={stories} bankEmpty={bankEmpty} />

      <Bank title="The placement question bank" groups={PLACEMENT_GROUPS.filter((g) => all.some((q) => q.group === g.key))} questions={all} reported={[]} firm={ctx.firm} />

      <div className="flex flex-col gap-3">
        <SectionTitle icon={ClipboardList}>Interview formats to expect</SectionTitle>
        <ul className="flex flex-col gap-1.5 text-[14px] leading-snug text-[#3C3C43]">
          {PLACEMENT_FRAMING.formats.map((f) => <li key={f} className="flex gap-2"><span aria-hidden="true" className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3DF5]" />{f}</li>)}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle icon={Lightbulb}>What gets people through</SectionTitle>
        <ul className="flex flex-col divide-y divide-black/[0.06] overflow-hidden rounded-[18px] bg-[#F6F5FB]">
          {PLACEMENT_FRAMING.tips.map((t) => (
            <li key={t} className="flex gap-3 px-4 py-3 text-[15px] leading-[1.47] text-[#1C1C1E]">
              <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3DF5]" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex gap-2 border-t border-black/[0.06] pt-5 text-[12px] leading-snug text-[#8E8E93]">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>For practice only. Don&apos;t use Placed or any AI tool during a real video interview, test or assessment centre: employers treat it as misconduct, and some (the Bank of England) ban it outright. Question reports come from student accounts and can be out of date.</p>
      </footer>
    </section>
  );
}
