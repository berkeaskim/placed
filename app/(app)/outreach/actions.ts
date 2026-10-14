"use server";
import { requireUser } from "@/lib/supabase/server";
import { getActiveCv } from "@/lib/db/queries";
import { isUuid } from "@/lib/feed/save-result";
import { AiError } from "@/lib/ai/provider";
import { draftOutreach, isEmptyDraft, type OutreachDraft } from "@/lib/outreach/draft";
import { cleanDraftInput } from "@/lib/outreach/input";

export async function draftOutreachAction(
  jobId: string, raw: { target: unknown; purpose: unknown; recipientName: unknown; note: unknown },
): Promise<{ ok: true; id: string | null; draft: OutreachDraft } | { ok: false; message: string }> {
  const input = cleanDraftInput(raw);
  if (!isUuid(jobId) || !input) return { ok: false, message: "Something's off with that request." };
  const { supabase, user } = await requireUser();
  const [{ data: job }, cv, { data: facts }, { data: app }] = await Promise.all([
    supabase.from("jobs").select("id, title, companies(name)").eq("id", jobId).maybeSingle(),
    getActiveCv(supabase, user.id),
    supabase.from("confirmed_facts").select("claim").eq("user_id", user.id),
    supabase.from("applications").select("id").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!job) return { ok: false, message: "That role no longer exists." };
  if (!cv) return { ok: false, message: "Upload your CV first: messages are written only from what's on it." };
  const company = (job.companies as unknown as { name: string } | null)?.name ?? "";
  try {
    const draft = await draftOutreach({
      ...input, cv: cv.parsed, cvText: cv.rawText, facts: (facts ?? []).map((f) => f.claim as string), company, jobTitle: job.title,
    });
    if (isEmptyDraft(draft)) return { ok: false, message: "Couldn't write a message right now. Try again." };
    const { data: row } = await supabase.from("outreach").insert({
      user_id: user.id, job_id: jobId, application_id: app?.id ?? null, company, target: input.target, recipient_name: input.recipientName,
      body: `${draft.connectionNote}\n\n${draft.coffeeChat}`.slice(0, 4000),
    }).select("id").single();
    return { ok: true, id: row?.id ?? null, draft };
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    return { ok: false, message: "The AI service is unavailable right now. Try again shortly." };
  }
}

export async function setOutreachStatus(id: string, status: "sent" | "replied"): Promise<boolean> {
  if (!isUuid(id) || (status !== "sent" && status !== "replied")) return false;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("outreach").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  return !error;
}
