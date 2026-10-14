import { peopleToReach, type OutreachTarget } from "@/lib/outreach/targets";
import type { OutreachPurpose } from "@/lib/outreach/draft";
import { OutreachDrafter } from "./outreach-drafter";

export function PeoplePanel({ company, title, jobId, initialTarget, initialPurpose }: {
  company: string; title: string; jobId: string; initialTarget?: OutreachTarget; initialPurpose?: OutreachPurpose;
}) {
  const people = peopleToReach(company, title);
  return (
    <section id="people" aria-label="People to reach" className="flex flex-col gap-3 rounded-[20px] border bg-white p-5">
      <h2 className="text-lg font-bold">People to reach</h2>
      <p className="text-sm text-muted-foreground">Placed doesn&apos;t look people up. Each link opens a LinkedIn search; pick someone there, then write to them here.</p>
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.key} className="flex flex-col gap-0.5 rounded-xl border p-3">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold">{p.label} ↗</a>
            <span className="text-xs text-muted-foreground">{p.why}</span>
          </li>
        ))}
      </ul>
      <OutreachDrafter jobId={jobId} initialTarget={initialTarget ?? "alumni"} initialPurpose={initialPurpose ?? "intro"} />
    </section>
  );
}
