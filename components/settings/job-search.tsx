import { ago, inTime } from "@/lib/feed/when";
import { lastIngestSummary } from "@/lib/ingest/local";
import { INTERVAL_CHOICES, ingestIntervalHours, nextIngestAt } from "@/lib/ingest/scheduler";
import { JobSearchSelect } from "./job-search-select";

/** Settings → Job search: how often the app pulls new postings in the background while it runs. */
export function JobSearchSettings() {
  const last = lastIngestSummary();
  const next = nextIngestAt();
  return (
    <section className="card-quest flex flex-col gap-3 p-5">
      <h2 className="font-bold">Job search</h2>
      <p className="text-sm text-muted-foreground">
        While Placed is running it checks every company&apos;s careers site for new internships.
        {" "}{last ? `Last updated ${ago(last.finishedAt)}` : "Not updated yet"}{next ? `, next ${inTime(next)}.` : "."}
      </p>
      <JobSearchSelect value={ingestIntervalHours()} choices={INTERVAL_CHOICES} />
    </section>
  );
}
