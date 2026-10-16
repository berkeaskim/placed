import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications, companies, jobs, outreach as outreachTable } from "@/lib/db/schema";
import { isAppStatus } from "@/lib/tracker/status";
import { nudgeFor } from "@/lib/outreach/nudges";
import { OUTREACH_TARGETS, type OutreachTarget } from "@/lib/outreach/targets";
import { todayLondon } from "@/lib/scoring/dates";
import { showDeadline } from "@/components/tracker/deadline-chip";
import { Board, type Card } from "./board";

function loadApplications(userId: string) {
  try {
    return db.select({
      id: applications.id, job_id: applications.job_id, status: applications.status, last_event_at: applications.last_event_at,
      updated_at: applications.updated_at, title: jobs.title, deadline: jobs.deadline, company: companies.name,
    }).from(applications)
      .leftJoin(jobs, eq(jobs.id, applications.job_id)).leftJoin(companies, eq(companies.id, jobs.company_id))
      .where(eq(applications.user_id, userId)).orderBy(desc(applications.updated_at)).all();
  } catch (e) {
    console.error("tracker: loading applications failed", e instanceof Error ? e.message : e);
    return null;
  }
}

function loadOutreach(userId: string) {
  try {
    return db.select({ job_id: outreachTable.job_id, target: outreachTable.target, status: outreachTable.status }).from(outreachTable)
      .where(eq(outreachTable.user_id, userId)).all();
  } catch (e) {
    console.error("tracker: loading outreach failed", e instanceof Error ? e.message : e);
    return [];
  }
}

export default async function Tracker() {
  const { user } = await requireUser();
  const today = todayLondon();
  const apps = loadApplications(user.id);
  const outreach = loadOutreach(user.id);
  // Targets already messaged per job: a nudge toward them is not repeated.
  const sentTargets = new Map<string, Set<OutreachTarget>>();
  for (const o of outreach) {
    if (!o.job_id || o.status === "drafted" || !(OUTREACH_TARGETS as readonly string[]).includes(o.target)) continue;
    const set = sentTargets.get(o.job_id) ?? new Set<OutreachTarget>();
    set.add(o.target);
    sentTargets.set(o.job_id, set);
  }
  const cards: Card[] = (apps ?? []).filter((a) => isAppStatus(a.status)).map((a) => ({
    id: a.id, jobId: a.job_id, status: a.status, title: a.title ?? "Role", company: a.company ?? "",
    updatedAt: a.updated_at, lastEventAt: a.last_event_at,
    nudge: a.title !== null ? nudgeFor({ status: a.status, company: a.company ?? "this company", lastEventAt: a.last_event_at, updatedAt: a.updated_at }, new Date(),
      sentTargets.get(a.job_id)) : null,
    outreach: {
      sent: outreach.filter((o) => o.job_id === a.job_id && o.status !== "drafted").length,
      replied: outreach.filter((o) => o.job_id === a.job_id && o.status === "replied").length,
    },
    // The posting's own closing date, while the student hasn't applied yet.
    deadline: a.status === "saved" && a.deadline && showDeadline(a.deadline, today, a.status) ? { date: a.deadline, label: "Closes", url: null } : null,
  }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Your applications</h1>
      {apps === null
        ? <p role="alert" className="card-quest p-6 font-semibold">Could not load your applications. Refresh to try again.</p>
        : cards.length === 0
        ? <p className="card-quest p-6 font-semibold">Save a role from your feed to start tracking.</p>
        : <Board cards={cards} today={today} />}
    </div>
  );
}
