"use server";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdf, isImageOnly } from "@/lib/cv/pdf-text";
import { parseCV } from "@/lib/ai/parseCV";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { contentHash } from "@/lib/ingest/fingerprint";
import { canonicalize, extractSkills } from "@/lib/skills/extract";

const MAX_BYTES = 5 * 1024 * 1024;

export type UploadCvResult =
  | { ok: true; award: AwardResult | null; imageOnly: boolean; cvId: string }
  | { error: string };

export async function uploadCv(formData: FormData): Promise<UploadCvResult> {
  const { supabase, user } = await requireUser();
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF first." };
  if (file.type !== "application/pdf") return { error: "Please upload a PDF." };
  if (file.size > MAX_BYTES) return { error: "That file is over 5 MB — export a smaller PDF." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return { error: "That doesn't look like a PDF. Export your CV as PDF and try again." };
  let pdf;
  // pdf.js may detach the buffer it is given, so hand it a copy.
  try { pdf = await extractPdf(bytes.slice()); } catch { return { error: "We couldn't open this PDF. Try exporting it again, or take the quiz instead." }; }
  const base64 = Buffer.from(bytes).toString("base64");
  const imageOnly = isImageOnly(pdf.pageTexts);

  let parsed;
  try { parsed = await parseCV({ base64, text: pdf.text, fixtureKey: contentHash(base64).slice(0, 12) }); }
  catch { return { error: "We couldn't read this CV right now. Try again in a minute, or take the quiz." }; }

  const admin = createAdminClient();
  const path = `${user.id}/${Date.now()}.pdf`;
  const up = await admin.storage.from("cvs").upload(path, bytes, { contentType: "application/pdf" });
  if (up.error) return { error: "Upload failed — try again." };

  // Insert the new active row first, then deactivate the others: a failure never leaves the user without an active CV.
  const { data: cvRow, error } = await supabase.from("cvs").insert({
    user_id: user.id, storage_path: path, file_size: file.size, page_count: pdf.pageCount,
    raw_text: pdf.text, page_texts: pdf.pageTexts, parsed_json: parsed, is_active: true,
  }).select("id").single();
  if (error || !cvRow) {
    await admin.storage.from("cvs").remove([path]);
    return { error: "Couldn't save your CV — try again." };
  }
  const cvId = cvRow.id as string;
  const deact = await supabase.from("cvs").update({ is_active: false }).eq("user_id", user.id).neq("id", cvId);
  if (deact.error) {
    // Roll back so exactly one CV stays active (the previous one).
    await supabase.from("cvs").delete().eq("id", cvId);
    await admin.storage.from("cvs").remove([path]);
    return { error: "Couldn't save your CV — try again." };
  }

  const skills = [...new Set([...parsed.skills.flatMap((g) => g.items.map((i) => canonicalize(i) ?? i)), ...extractSkills(pdf.text)])];
  const scored = parsed.archetypes.filter((a) => a.score > 0);
  const { data: prof } = await supabase.from("profiles").select("year, target_archetype").eq("user_id", user.id).single();
  // An unreadable (image-only) or empty parse must not wipe archetypes/skills from e.g. the quiz.
  const hasSignal = !imageOnly && (skills.length > 0 || scored.length > 0);
  await supabase.from("profiles").update({
    ...(hasSignal ? { archetypes: scored, skills } : {}),
    target_archetype: prof?.target_archetype ?? (hasSignal ? scored[0]?.key : null) ?? null,
    year: prof?.year ?? parsed.yearGuess ?? null,
  }).eq("user_id", user.id);

  const award = await awardXP(supabase, user.id, { type: "cv_uploaded", profileComplete: !imageOnly });
  return { ok: true as const, award, imageOnly, cvId };
}
