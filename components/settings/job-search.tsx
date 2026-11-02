import { ago, inTime } from "@/lib/feed/when";
import { aiMode } from "@/lib/ai/config";
import { lastIngestSummary } from "@/lib/ingest/local";
import { discoveredCompanies, lastDiscovery, DISCOVERY_EVERY_DAYS } from "@/lib/ingest/discover";
import { launchAgentInstalled } from "@/lib/ingest/launchd";
import { scraperInstalled } from "@/lib/ingest/stealth";
import { DEFAULT_DAILY_AT, INTERVAL_CHOICES, ingestDailyAt, ingestIntervalHours, nextIngestAt } from "@/lib/ingest/scheduler";
import { isDesktop } from "@/lib/desktop";
import { DiscoveredCompanies } from "./discovered-companies";
import { JobSearchSelect } from "./job-search-select";
import { Group, Row } from "@/components/ui/apple";

/** Settings → Job search: when the app pulls new postings, whether it does so while closed, and the AI company search. */
export async function JobSearchSettings() {
  const last = lastIngestSummary();
  const next = nextIngestAt();
  const agent = launchAgentInstalled();
  const found = lastDiscovery();
  const desktop = isDesktop();
  const scraper = desktop ? false : await scraperInstalled();
  return (
    <Group
      title="Job search"
      footer={
        desktop
          ? "Runs while Placed is open. Turn on “Open Placed at login” so it runs every morning."
          : agent
            ? "Runs even while Placed is closed (background agent installed)."
            : <>Only runs while Placed is open. To keep it going while it&apos;s closed, run <code>npm run schedule:install</code> once.</>
      }
    >
      <Row
        title="Careers sites"
        subtitle={`${last ? `Updated ${ago(last.finishedAt)}` : "Not updated yet"}${next ? `, next ${inTime(next)}` : ""}`}
      />
      <JobSearchSelect value={ingestIntervalHours()} dailyAt={ingestDailyAt()} defaultAt={DEFAULT_DAILY_AT} choices={INTERVAL_CHOICES} />
      <DiscoveredCompanies rows={discoveredCompanies()} canSearch={aiMode() === "live"} />
      {!desktop && <Row title="Optional scraper" trailing={scraper ? "Installed" : <code className="text-[12px]">npm run scraper:setup</code>} />}
      {found ? <Row title="Last company search" subtitle={`Every ${DISCOVERY_EVERY_DAYS} days`} trailing={`${ago(found.at)} · ${found.added.length} added`} /> : null}
    </Group>
  );
}
