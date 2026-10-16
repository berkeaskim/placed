import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications, companies, jobs, outreach as outreachTable } from "@/lib/db/schema";
import { todayLondon } from "@/lib/scoring/dates";
import { OUTREACH_TARGETS, type OutreachTarget } from "@/lib/outreach/targets";
import { buildPlan } from "@/lib/strategy/plan";
import { universityFor } from "@/lib/profile/university";
import { isAppStatus } from "@/lib/tracker/status";
import { DeadlineChip } from "@/components/tracker/deadline-chip";
import { STATUS_COLOR, STATUS_TINT } from "@/components/tracker/status-style";
import { ReachMap, type ContactState } from "@/components/strategy/reach-map";
import { PlanBoard } from "@/components/strategy/plan-board";

export const metadata = { title: "Strategy · Placed" };

const ACTIVE = ["saved", "applied", "interview"] as const;
const STATUS_LABEL = { saved: "Saved", applied: "Applied", interview: "Interview" } as const;

export default async function Strategy({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { user } = await requireUser();
  const { job: wanted } = await searchParams;
  const today = todayLondon();

  const apps = db.select({
    jobId: applications.job_id, status: applications.status, updatedAt: applications.updated_at,
    title: jobs.title, deadline: jobs.deadline, company: companies.name,
  }).from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.job_id)).leftJoin(companies, eq(companies.id, jobs.company_id))
    .where(and(eq(applications.user_id, user.id), inArray(applications.status, [...ACTIVE])))
    .orderBy(desc(applications.updated_at)).all()
    .filter((a) => isAppStatus(a.status));

  if (apps.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <div className="card-quest flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-lg font-bold tracking-tight">Save a role to plan your approach</p>
          <p className="max-w-sm text-sm text-muted-foreground">Placed turns each saved role into a short plan: who to talk to, when to apply, and the message for each step.</p>
          <Link href="/feed" className="btn-quest mt-1 inline-flex min-h-11 items-center px-5 no-underline">Browse your feed</Link>
        </div>
      </div>
    );
  }

  // Default: a saved role closing soonest (time pressure first), else the most recently moved one.
  const urgent = apps.filter((a) => a.status === "saved" && a.deadline && a.deadline >= today).sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
  const selected = apps.find((a) => a.jobId === wanted) ?? urgent ?? apps[0];
  const company = selected.company ?? "this company";

  const sentRows = db.select({ target: outreachTable.target, status: outreachTable.status }).from(outreachTable)
    .where(and(eq(outreachTable.user_id, user.id), eq(outreachTable.job_id, selected.jobId))).all();
  const contact = Object.fromEntries(OUTREACH_TARGETS.map((t) => {
    const rows = sentRows.filter((r) => r.target === t);
    const s: ContactState = rows.some((r) => r.status === "replied") ? "replied" : rows.some((r) => r.status === "sent") ? "sent" : "none";
    return [t, s];
  })) as Record<OutreachTarget, ContactState>;

  const school = universityFor(user.id);
  const plan = buildPlan({
    status: selected.status as (typeof ACTIVE)[number], deadline: selected.deadline, updatedAt: selected.updatedAt, today, outreach: sentRows, school,
  });

  return (
    <div className="flex flex-col gap-5">
      <Header />

      <nav aria-label="Choose a role" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {apps.map((a) => {
          const on = a.jobId === selected.jobId;
          return (
            <Link key={a.jobId} href={`/strategy?job=${a.jobId}`} aria-current={on ? "page" : undefined} scroll={false}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm no-underline transition-transform duration-100 active:scale-95 ${on ? "border-[#1A1A2E] bg-[#1A1A2E] font-bold text-white" : "bg-white font-semibold text-foreground"}`}>
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[a.status as (typeof ACTIVE)[number]] }} />
              {a.company ?? a.title}
            </Link>
          );
        })}
      </nav>

      <section className="card-quest grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ background: STATUS_TINT[selected.status as (typeof ACTIVE)[number]], color: STATUS_COLOR[selected.status as (typeof ACTIVE)[number]] }}>
            {STATUS_LABEL[selected.status as (typeof ACTIVE)[number]]}
          </span>
          <h2 className="text-xl font-extrabold leading-tight tracking-tight">{company}</h2>
          <Link href={`/jobs/${selected.jobId}`} className="text-sm font-semibold text-foreground">{selected.title}</Link>
          {selected.deadline && selected.deadline >= today && selected.status === "saved" && (
            <DeadlineChip label="Closes" date={selected.deadline} today={today} url={null} />
          )}
          <p className="text-sm text-muted-foreground">Each box opens a LinkedIn search for that kind of person. Lines fill in as you message them.</p>
        </div>
        <ReachMap company={company} title={selected.title} state={contact} school={school} />
      </section>

      <PlanBoard key={selected.jobId} plan={plan} jobId={selected.jobId} company={company} title={selected.title} today={today}
        deadline={selected.status === "saved" ? selected.deadline : null} school={school} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Strategy</h1>
      <p className="text-sm text-muted-foreground">Who to talk to, when to apply, and what to say. You send every message yourself.</p>
    </div>
  );
}
