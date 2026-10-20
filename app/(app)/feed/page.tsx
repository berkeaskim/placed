import Link from "next/link";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications, companies, jobs as jobsTable } from "@/lib/db/schema";
import { getActiveCv, getProfile, toStudent } from "@/lib/db/queries";
import { getFeedJobs } from "@/lib/feed/jobs-cache";
import { rankJobs } from "@/lib/feed/rank";
import { applyFilters, feedHref, LOCATION_FILTERS, LOCATION_LABELS, parseFilters, resolveMode } from "@/lib/feed/filters";
import { isPlacementEligible, isSpringWeekEligible, placementCountdown, placementGradYear, placementStartYear, springCycleYear, springWeekGradYear } from "@/lib/profile/cycle";
import { todayLondon } from "@/lib/scoring/dates";
import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import { JobCard } from "@/components/job-card";
import { isPastSaved } from "@/lib/tracker/status";
import { ingestRunning, lastIngestSummary } from "@/lib/ingest/local";
import { nextIngestAt } from "@/lib/ingest/scheduler";
import { ago, inTime } from "@/lib/feed/when";
import { RefreshJobs } from "./refresh-jobs";

/** "2027-06-30" → "30 Jun 2027". */
const formatDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

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
  // An accepted placement offer (tracker): stop suggesting placements and say what comes next (DECISIONS.md §2).
  const secured = db.select({ company: companies.name, employer: jobsTable.employer_name }).from(applications)
    .innerJoin(jobsTable, eq(jobsTable.id, applications.job_id)).leftJoin(companies, eq(companies.id, jobsTable.company_id))
    .where(and(eq(applications.user_id, user.id), eq(applications.status, "offer"), isNotNull(applications.accepted_at), eq(jobsTable.employment_type, "placement")))
    .get();
  const placementEligible = !secured && isPlacementEligible({ year: profile.year ?? "2nd", gradYear: student.gradYear ?? null, placementStatus: student.placementStatus }, today);
  // With a placement secured the next step is graduate schemes: open on all roles (spring weeks stay one click away).
  const filters = { ...parsed, mode: resolveMode(parsed.mode, springEligible && !secured, placementEligible) };
  const spring = filters.mode === "spring";
  const placement = filters.mode === "placement";
  const start = placementStartYear(today);
  const countdown = placementCountdown(today, profile.placement_secure_by ?? null);
  const all = rankJobs(student, cv?.parsed ?? null, jobs, today, { course: profile.course });
  const ranked = applyFilters(secured ? all.filter((r) => r.job.employmentType !== "placement") : all, filters, today);
  const savedIds = new Set(apps.map((x) => x.job_id));
  const appliedIds = new Set(apps.filter((x) => isPastSaved(x.status)).map((x) => x.job_id));

  const topArchetypes: Archetype[] = student.archetypes.slice(0, 3).map((x) => x.key);
  if (filters.a && !topArchetypes.includes(filters.a)) topArchetypes.push(filters.a);

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">{spring ? "Spring weeks for you" : placement ? "Placement years for you" : "Internships for you"}</h1>
        <p className="text-sm text-muted-foreground">
          {spring
            ? `${ranked.length} spring weeks and insight events for spring ${springCycleYear(today)}, ranked by how well they fit you.`
            : placement
              ? `${ranked.length} placements starting in ${start}, usually 9–15 months, ranked by how well they fit you.`
              : `${ranked.length} live roles, ranked by how well they fit you.`}
        </p>
      </div>
      {secured && (
        <p className="card-quest p-4 text-sm">
          You&apos;ve accepted your placement at {secured.employer ?? secured.company}, so Placed has stopped showing placements.
          Graduate schemes for after your placement open from September of your placement year.{" "}
          <Link href="/tracker" className="font-semibold underline">See your next steps</Link>
        </p>
      )}
      {placementEligible && (
        <div className="card-quest flex flex-col gap-1.5 p-4 text-sm">
          <p className="font-bold">
            {countdown.phase === "passed"
              ? `Your university's deadline to secure a placement (${formatDay(countdown.secureBy)}) has passed`
              : `${countdown.days} days to secure your placement · university deadline ${formatDay(countdown.secureBy)}`}
          </p>
          <p>
            {countdown.phase === "main" && <>Your degree has a placement year and you graduate in {placementGradYear(today)}, so {start}/{String(start + 1).slice(2)} placements are open to you. Banks and pharma close first (September–October) and many others fill on a rolling basis, so apply early.</>}
            {countdown.phase === "late" && <>Most big schemes have closed, but smaller firms, startups and some engineering and public-sector employers keep recruiting until the summer. Look for rolling deadlines, apply widely, and send speculative applications to firms you&apos;d like to work for.</>}
            {countdown.phase === "final" && <>Under a month left. Talk to your placement team now: if you don&apos;t secure one by the deadline, most universities move you onto the 3-year version of your course. Apply to everything with a rolling deadline.</>}
            {countdown.phase === "passed" && <>Check with your placement team whether you can still be approved, or whether you&apos;re moving onto the 3-year course.</>}
            {springEligible && countdown.phase === "main" && " Spring weeks are open to you too: switch above."}
          </p>
          {!profile.placement_secure_by && <Link href="/settings" className="text-xs font-semibold underline">Set your university&apos;s own deadline</Link>}
        </div>
      )}
      {springEligible && !placementEligible && !secured && (
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
        {!secured && <Link href={feedHref(filters, { mode: "placement" })} aria-current={placement ? "true" : undefined} className={chipClass(placement)}>Placement years</Link>}
        <Link href={feedHref(filters, { mode: "all" })} aria-current={filters.mode === "all" ? "true" : undefined} className={chipClass(filters.mode === "all")}>Internships &amp; more</Link>
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
      {ranked.length === 0 && <p className="card-quest p-6 text-center font-semibold">{spring ? "No spring weeks match these filters right now. Many open from late October; try clearing a filter or check back after the next refresh."
        : placement ? "No placements match these filters right now. Try clearing a filter; smaller firms keep recruiting into the summer."
        : "No live roles match these filters right now. Try clearing a filter."}</p>}
      {ranked.slice(0, 60).map((r) => <JobCard key={r.job.id} r={r} today={today} saved={savedIds.has(r.job.id)} applied={appliedIds.has(r.job.id)} />)}
    </div>
  );
}
