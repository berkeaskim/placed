import Link from "next/link";
import { applyXp, type Ranked } from "@/lib/feed/rank";
import { coverageLabel } from "@/lib/scoring/coverage";
import { closingLabel } from "@/lib/scoring/dates";
import { CuratedChip } from "./curated-chip";
import { CompanyMark } from "./company-mark";
import { FitBadge } from "./fit-badge";
import { SaveButton } from "./save-button";
import { MarkAppliedButton } from "./mark-applied";

/** "0/0 must-haves" read like a bug: with no must-haves listed, count the nice-to-haves instead. */
function mustLabel(c: Ranked["coverage"]): string {
  if (c.must.total > 0) return `${c.must.matched}/${c.must.total} must-haves`;
  if (c.nice.total > 0) return `No must-haves listed · ${c.nice.matched}/${c.nice.total} nice-to-haves`;
  return "No must-haves listed";
}

export function JobCard({ r, today, saved, applied }: { r: Ranked; today: string; saved: boolean; applied: boolean }) {
  const gate = r.fit.gates.find((g) => !g.passed);
  const sub = gate?.reason ?? (r.coverage.readable ? mustLabel(r.coverage) : coverageLabel(r.coverage));
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] border bg-white px-5 py-4">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <CompanyMark company={r.job.company} url={r.job.url} />
          {r.job.curated && <CuratedChip />}
        </div>
        <Link href={`/jobs/${r.job.id}`} className="text-base font-bold leading-snug text-foreground no-underline hover:underline">{r.job.title}</Link>
        <div className="text-[13px] text-muted-foreground">{r.job.location || "Location not stated"} · {sub}</div>
      </div>
      <div className="whitespace-nowrap text-[13px] font-semibold text-[#8A4B00]">{closingLabel(r.job, today)}</div>
      <FitBadge label={r.fit.label} score={r.fit.global} />
      <span className="chip-xp">+{applyXp(r.fit.label)} XP</span>
      <SaveButton key={saved ? "saved" : "unsaved"} jobId={r.job.id} initiallySaved={saved} />
      <MarkAppliedButton jobId={r.job.id} initiallyApplied={applied} title={r.job.title} />
      <Link href={`/jobs/${r.job.id}`} className="btn-quest px-4 py-2.5 no-underline">View</Link>
    </article>
  );
}
