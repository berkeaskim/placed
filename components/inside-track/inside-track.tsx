import { loadInsideTrack } from "@/lib/inside-track/load";
import { peopleToReach, type OutreachTarget } from "@/lib/outreach/targets";
import type { OutreachPurpose } from "@/lib/outreach/draft";
import { OutreachDrafter } from "@/components/outreach/outreach-drafter";
import { GROUPS, type Group } from "@/lib/inside-track/types";
import { InsideTrackPanel, type Fallback } from "./inside-track-panel";

/** Inside Track for an applied role. If it can't load, the panel still shows the LinkedIn search links for each group. */
export async function InsideTrack({ company, title, jobId, school }: { company: string; title: string; jobId: string; school: string | null }) {
  const r = await loadInsideTrack(jobId);
  const fallbacks: Fallback[] = peopleToReach(company, title, school)
    .filter((p): p is typeof p & { key: Group } => (GROUPS as readonly string[]).includes(p.key))
    .map(({ key, why, url }) => ({ key, why, url }));
  return <InsideTrackPanel jobId={jobId} company={company} cards={r.ok ? r.cards : []} fallbacks={fallbacks} hasCv={r.ok && r.hasCv} school={school} />;
}

/** The manual drafter, outside the Suspense boundary so tracker nudge links to #people scroll straight to it. */
export function WriteToSomeoneElse({ jobId, school, initialTarget, initialPurpose }: {
  jobId: string; school: string | null; initialTarget?: OutreachTarget; initialPurpose?: OutreachPurpose;
}) {
  return (
    <section id="people" aria-label="Write to someone else" className="flex flex-col gap-3 rounded-[20px] border bg-white p-5">
      <h2 className="text-base font-bold">Write to someone else</h2>
      <p className="text-xs text-muted-foreground">Found someone yourself? Pick who they are and we&apos;ll draft a message from your CV.</p>
      <OutreachDrafter jobId={jobId} school={school} initialTarget={initialTarget ?? "alumni"} initialPurpose={initialPurpose ?? "intro"} />
    </section>
  );
}
