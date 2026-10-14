import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getActiveCv, getLiveJobs, getProfile, toStudent } from "@/lib/db/queries";
import { rankJobs } from "@/lib/feed/rank";
import { applyFilters, feedHref, LOCATION_FILTERS, LOCATION_LABELS, parseFilters } from "@/lib/feed/filters";
import { todayLondon } from "@/lib/scoring/dates";
import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import { JobCard } from "@/components/job-card";

const chipClass = (active: boolean) =>
  `rounded-full border px-3.5 py-2 text-[13px] font-semibold no-underline ${active ? "border-foreground bg-foreground text-white" : "bg-white text-foreground"}`;

export default async function Feed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const { supabase, user } = await requireUser();
  const today = todayLondon();
  const [profile, cv, jobs, { data: apps }] = await Promise.all([
    getProfile(supabase, user.id), getActiveCv(supabase, user.id), getLiveJobs(supabase, today),
    supabase.from("applications").select("job_id").eq("user_id", user.id),
  ]);
  const student = toStudent(profile);
  const all = rankJobs(student, cv?.parsed ?? null, jobs, today);
  const ranked = applyFilters(all, filters, today);
  const savedIds = new Set((apps ?? []).map((x) => x.job_id as string));

  const topArchetypes: Archetype[] = student.archetypes.slice(0, 3).map((x) => x.key);
  if (filters.a && !topArchetypes.includes(filters.a)) topArchetypes.push(filters.a);

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Internships for you</h1>
        <p className="text-sm text-muted-foreground">{ranked.length} live roles, ranked by how well they fit you.</p>
      </div>
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
      {ranked.length === 0 && <p className="card-quest p-6 text-center font-semibold">No live roles match these filters right now. Try clearing a filter.</p>}
      {ranked.slice(0, 60).map((r) => <JobCard key={r.job.id} r={r} today={today} saved={savedIds.has(r.job.id)} />)}
    </div>
  );
}
