import Link from "next/link";
import { applyXp, type Ranked } from "@/lib/feed/rank";
import { coverageLabel } from "@/lib/scoring/coverage";
import { closingLabel } from "@/lib/scoring/dates";
import { FitBadge } from "./fit-badge";
import { SaveButton } from "./save-button";

export function JobCard({ r, today, saved }: { r: Ranked; today: string; saved: boolean }) {
  const gate = r.fit.gates.find((g) => !g.passed);
  const sub = gate?.reason ?? (r.coverage.readable ? `${r.coverage.must.matched}/${r.coverage.must.total} must-haves` : coverageLabel(r.coverage));
  return (
    <article className="flex flex-wrap items-center gap-4 rounded-[18px] border bg-white px-5 py-4">
      <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EFEBFF] text-lg font-extrabold text-[#3A20C4]">{(r.job.company || "?").slice(0, 1).toUpperCase()}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/jobs/${r.job.id}`} className="text-base font-bold text-foreground no-underline hover:underline">{r.job.title}</Link>
        <div className="text-[13px] text-muted-foreground">{r.job.company} · {r.job.location || "Location not stated"} · {sub}</div>
      </div>
      <div className="whitespace-nowrap text-[13px] font-semibold text-[#8A4B00]">{closingLabel(r.job, today)}</div>
      <FitBadge label={r.fit.label} score={r.fit.global} />
      <span className="chip-xp">+{applyXp(r.fit.label)} XP</span>
      <SaveButton jobId={r.job.id} initiallySaved={saved} />
      <Link href={`/jobs/${r.job.id}`} className="btn-quest px-4 py-2.5 no-underline">View</Link>
    </article>
  );
}
