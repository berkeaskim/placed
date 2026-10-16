"use server";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { getActiveCv } from "@/lib/db/queries";
import { applications, companies, confirmedFacts, jobs, outreach } from "@/lib/db/schema";
import { isUuid } from "@/lib/feed/save-result";
import { AiError } from "@/lib/ai/provider";
import { draftOutreach, isEmptyDraft, type OutreachDraft } from "@/lib/outreach/draft";
import { cleanDraftInput } from "@/lib/outreach/input";
import { universityFor } from "@/lib/profile/university";

export async function draftOutreachAction(
  jobId: string, raw: { target: unknown; purpose: unknown; recipientName: unknown; note: unknown },
): Promise<{ ok: true; id: string | null; draft: OutreachDraft } | { ok: false; message: string }> {
  const input = cleanDraftInput(raw);
  if (!isUuid(jobId) || !input) return { ok: false, message: "Something's off with that request." };
  const { user } = await requireUser();
  const job = db.select({ id: jobs.id, title: jobs.title, company: companies.name }).from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, jobId)).get();
  if (!job) return { ok: false, message: "That role no longer exists." };
  const cv = await getActiveCv(user.id);
  if (!cv) return { ok: false, message: "Upload your CV first: messages are written only from what's on it." };
  const facts = db.select({ claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, user.id)).all();
  const app = db.select({ id: applications.id }).from(applications)
    .where(and(eq(applications.user_id, user.id), eq(applications.job_id, jobId))).get();
  const company = job.company ?? "";
  try {
    const draft = await draftOutreach({
      ...input, university: universityFor(user.id), cv: cv.parsed, cvText: cv.rawText, facts: facts.map((f) => f.claim), company, jobTitle: job.title,
    });
    if (isEmptyDraft(draft)) return { ok: false, message: "Couldn't write a message right now. Try again." };
    let id: string | null = null;
    try {
      id = db.insert(outreach).values({
        user_id: user.id, job_id: jobId, application_id: app?.id ?? null, company, target: input.target, recipient_name: input.recipientName,
        body: `${draft.connectionNote}\n\n${draft.coffeeChat}`.slice(0, 4000),
      }).returning({ id: outreach.id }).get().id;
    } catch (err) {
      console.error("outreach insert failed", err);
    }
    return { ok: true, id, draft };
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    return { ok: false, message: "The AI service is unavailable right now. Try again shortly." };
  }
}

export async function setOutreachStatus(id: string, status: "sent" | "replied"): Promise<boolean> {
  if (!isUuid(id) || (status !== "sent" && status !== "replied")) return false;
  const { user } = await requireUser();
  try {
    db.update(outreach).set({ status, updated_at: new Date().toISOString() }).where(and(eq(outreach.id, id), eq(outreach.user_id, user.id))).run();
    return true;
  } catch {
    return false;
  }
}
