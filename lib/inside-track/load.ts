// Not a "use server" module: only the job page's server component calls this.
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { getActiveCv } from "@/lib/db/queries";
import { applications, companies, jobs, outreach } from "@/lib/db/schema";
import { isUuid } from "@/lib/feed/save-result";
import { universityFor } from "@/lib/profile/university";
import { isPastSaved } from "@/lib/tracker/status";
import { findPeople } from "./find";
import { toCards, type Card } from "./view";

/** People to reach for an application past `saved`, each with any draft the student already has for them. */
export async function loadInsideTrack(jobId: string): Promise<{ ok: true; cards: Card[]; searched: boolean; hasCv: boolean } | { ok: false }> {
  if (!isUuid(jobId)) return { ok: false };
  const { user } = await requireUser();
  const app = db.select({ status: applications.status }).from(applications)
    .where(and(eq(applications.user_id, user.id), eq(applications.job_id, jobId))).get();
  const job = db.select({ title: jobs.title, company: companies.name }).from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, jobId)).get();
  if (!job || !isPastSaved(app?.status)) return { ok: false };
  const rows = db.select({ id: outreach.id, target: outreach.target, recipient_name: outreach.recipient_name, body: outreach.body, status: outreach.status })
    .from(outreach).where(and(eq(outreach.user_id, user.id), eq(outreach.job_id, jobId))).orderBy(desc(outreach.created_at)).all();
  const [cv, found] = await Promise.all([getActiveCv(user.id), findPeople(job.company ?? "", job.title, universityFor(user.id))]);
  return { ok: true, cards: toCards(found, rows), searched: found.searched, hasCv: Boolean(cv) };
}
