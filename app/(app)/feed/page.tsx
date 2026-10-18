import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { getActiveCv, getProfile, toStudent } from "@/lib/db/queries";
import { getFeedJobs } from "@/lib/feed/jobs-cache";
import { rankJobs } from "@/lib/feed/rank";
import { applyFilters, feedHref, LOCATION_FILTERS, LOCATION_LABELS, parseFilters, resolveMode } from "@/lib/feed/filters";
import { isSpringWeekEligible, springCycleYear, springWeekGradYear } from "@/lib/profile/cycle";
import { todayLondon } from "@/lib/scoring/dates";
import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import { JobCard } from "@/components/job-card";
import { isPastSaved } from "@/lib/tracker/status";
import { ingestRunning, lastIngestSummary } from "@/lib/ingest/local";
import { nextIngestAt } from "@/lib/ingest/scheduler";
import { ago, inTime } from "@/lib/feed/when";
import { RefreshJobs } from "./refresh-jobs";

const chipClass = (active: boolean) =>
  `rounded-full border px-3.5 py-2 text-[13px] font-semibold no-underline ${active ? "border-foreground bg-foreground text-white" : "bg-white text-foreground"}`;

export default async function Feed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseFilters(await searchParams);
  const { user } = await requireUser();
  const today = todayLondon();
  const last = lastIngestSummary();
  const next = nextIngestAt();
  const [profile, cv, jobs] = await Promise.all([getProfile(user.id), getActiveCv(user.id), getFeedJobs(today, last?.finishedAt ?? null)]);
  const apps = db.select({ job_id: applications.job_id, status: applications.status }).from(applications).where(eq(applications.user_id, user.id)).all();
  const student = toStudent(profile);
  // A known grad year decides; without one, only a stated 1st year counts (a missing year reads as "2nd").
  const springEligible = isSpringWeekEligible({ year: profile.year ?? "2nd", gradYear: student.gradYear ?? null }, today);
  const filters = { ...parsed, mode: resolveMode(parsed.mode, springEligible) };
  const spring = filters.mode === "spring";
  const all = rankJobs(student, cv?.parsed ?? null, jobs, today);
  const ranked = applyFilters(all, filters, today);
  const savedIds = new Set(apps.map((x) => x.job_id));
  const appliedIds = new Set(apps.filter((x) => isPastSaved(x.status)).map((x) => x.job_id));

  const topArchetypes: Archetype[] = student.archetypes.slice(0, 3).map((x) => x.key);
  if (filters.a && !topArchetypes.includes(filters.a)) topArchetypes.push(filters.a);

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">{spring ? "Spring weeks for you" : "Internships for you"}</h1>
        <p className="text-sm text-muted-foreground">
          {spring
            ? `${ranked.length} spring weeks and insight events for spring ${springCycleYear(today)}, ranked by how well they fit you.`
            : `${ranked.length} live roles, ranked by how well they fit you.`}
        </p>
      </div>
      {springEligible && (
        <p className="card-quest p-4 text-sm">
          You&apos;re graduating in {springWeekGradYear(today)}, so spring weeks are your way in: short programmes that often fast-track you to a summer internship.
          Many fill on a rolling basis, so apply early.
        </p>
      )}
      {student.gradYear == null && (
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="font-semibold underline">Add your graduation year</Link> so Placed can tell whether spring weeks or internships are right for you.
        </p>
      )}
      <RefreshJobs running={ingestRunning()} lastRun={last ? ago(last.finishedAt) : null} next={next ? inTime(next) : null} lastNew={last?.newJobs ?? 0} />
      <nav className="flex flex-wrap gap-2" aria-label="Programme type">
        <Link href={feedHref(filters, { mode: "spring" })} aria-current={spring ? "true" : undefined} className={chipClass(spring)}>Spring weeks &amp; insights</Link>
        <Link href={feedHref(filters, { mode: "all" })} aria-current={!spring ? "true" : undefined} className={chipClass(!spring)}>Internships &amp; more</Link>
      </nav>
      <nav className="flex flex-wrap gap-2" aria-label="Role filters">
        <Link href={feedHref(filters, { a: null })} aria-current={!filters.a ? "true" : undefined} className={chipClass(!filters.a)}>All roles</Link>
        {topArchetypes.map((k) => (
          <Link key={k} href={feedHref(filters, { a: filters.a === k ? null : k })} aria-current={filters.a === k ? "true" : undefined} className={chipClass(filters.a === k)}>{ARCHETYPE_LABELS[k]}</Link>
        ))}
      </nav>
      <nav className="flex flex-wrap gap-2" aria-label="Location and deadline filters">
        <Link href={feedHref(filters, { loc: null })} aria-current={!filters.loc ? "true" : undefined} className={chipClass(!filters.loc)}>Anywhere</Link>
        {LOCATION_FILTERS.map((l) => (
          <Link key={l} href={feedHref(filters, { loc: filters.loc === l ? null : l })} aria-current={filters.loc === l ? "true" : undefined} className={chipClass(filters.loc === l)}>{LOCATION_LABELS[l]}</Link>
        ))}
        <Link href={feedHref(filters, { soon: !filters.soon })} aria-current={filters.soon ? "true" : undefined} className={chipClass(filters.soon)}>Closing soon</Link>
      </nav>
      {ranked.length === 0 && <p className="card-quest p-6 text-center font-semibold">{spring ? "No spring weeks match these filters right now. Many open from late October; try clearing a filter or check back after the next refresh." : "No live roles match these filters right now. Try clearing a filter."}</p>}
      {ranked.slice(0, 60).map((r) => <JobCard key={r.job.id} r={r} today={today} saved={savedIds.has(r.job.id)} applied={appliedIds.has(r.job.id)} />)}
    </div>
  );
}
