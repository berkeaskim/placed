import { ago, inTime } from "@/lib/feed/when";
import { aiMode } from "@/lib/ai/config";
import { lastIngestSummary } from "@/lib/ingest/local";
import { discoveredCompanies, lastDiscovery, DISCOVERY_EVERY_DAYS } from "@/lib/ingest/discover";
import { launchAgentInstalled } from "@/lib/ingest/launchd";
import { scraperInstalled } from "@/lib/ingest/stealth";
import { DEFAULT_DAILY_AT, INTERVAL_CHOICES, ingestDailyAt, ingestIntervalHours, nextIngestAt } from "@/lib/ingest/scheduler";
import { DiscoveredCompanies } from "./discovered-companies";
import { JobSearchSelect } from "./job-search-select";

/** Settings → Job search: when the app pulls new postings, whether it does so while closed, and the AI company search. */
export async function JobSearchSettings() {
  const last = lastIngestSummary();
  const next = nextIngestAt();
  const agent = launchAgentInstalled();
  const found = lastDiscovery();
  const scraper = await scraperInstalled();
  return (
    <section className="card-quest flex flex-col gap-3 p-5">
      <h2 className="font-bold">Job search</h2>
      <p className="text-sm text-muted-foreground">
        Placed checks every company&apos;s careers site for new internships.
        {" "}{last ? `Last updated ${ago(last.finishedAt)}` : "Not updated yet"}{next ? `, next ${inTime(next)}.` : "."}
      </p>
      <JobSearchSelect value={ingestIntervalHours()} dailyAt={ingestDailyAt()} defaultAt={DEFAULT_DAILY_AT} choices={INTERVAL_CHOICES} />
      <p className="text-sm text-muted-foreground">
        {agent
          ? "Runs even while Placed is closed (background agent installed)."
          : <>Only runs while Placed is open. To keep it going while it&apos;s closed, run <code>npm run schedule:install</code> once (macOS).</>}
      </p>
      <p className="text-sm text-muted-foreground">
        {scraper
          ? "Optional scraper: installed"
          : <>Optional scraper: not installed — <code>npm run scraper:setup</code></>}
      </p>
      <h3 className="pt-2 font-bold">New companies</h3>
      <p className="text-sm text-muted-foreground">
        Every {DISCOVERY_EVERY_DAYS} days the AI suggests employers that fit you, and Placed adds the ones whose careers site it can read.
        {found ? ` Last search ${ago(found.at)}: ${found.added.length} added.` : ""}
      </p>
      <DiscoveredCompanies rows={discoveredCompanies()} canSearch={aiMode() === "live"} />
    </section>
  );
}
