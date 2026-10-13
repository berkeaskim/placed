"use server";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdf, isImageOnly } from "@/lib/cv/pdf-text";
import { parseCV } from "@/lib/ai/parseCV";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { contentHash } from "@/lib/ingest/fingerprint";
import { scanCvSafety, stripFlaggedSpans, type SafetyReport } from "@/lib/cv/safety";
import { SAFETY_WARNING_COPY } from "@/lib/cv/safety-copy";
import { dropFlaggedContent } from "@/lib/cv/strip-parsed";
import { ARCHETYPES, YEARS, type Archetype, type ParsedCV, type Year } from "@/lib/types";
import { scoreCv } from "@/lib/cv-score/run";
import { canonicalize, extractSkills } from "@/lib/skills/extract";

const MAX_BYTES = 5 * 1024 * 1024;

export type UploadCvResult =
  | { ok: true; award: AwardResult | null; imageOnly: boolean; cvId: string; safetyWarning: string | null }
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

  // A4: the CV is untrusted input. Scan before parsing; flagged spans never reach the parser or the stored text.
  let safety: SafetyReport;
  try { safety = await scanCvSafety({ text: pdf.text, pdfBytes: bytes.slice() }); }
  catch {
    try { safety = await scanCvSafety({ text: pdf.text }); }
    catch (e) { console.error("scanCvSafety failed; treating CV as clean", e); safety = { verdict: "clean", issues: [] }; }
  }
  const flagged = safety.verdict === "flag";
  const cleanText = flagged ? stripFlaggedSpans(pdf.text, safety) : pdf.text;
  const cleanPages = flagged ? pdf.pageTexts.map((t) => stripFlaggedSpans(t, safety)) : pdf.pageTexts;

  let parsed: ParsedCV;
  try {
    parsed = await parseCV({ base64, text: cleanText, fixtureKey: contentHash(base64).slice(0, 12), textOnly: flagged });
    // Defence in depth (flagged CVs are parsed text-only): drop any parsed content that still carries a flagged span.
    if (flagged) parsed = dropFlaggedContent(parsed, safety.issues.map((i) => i.span));
  } catch { return { error: "We couldn't read this CV right now. Try again in a minute, or take the quiz." }; }

  const admin = createAdminClient();
  const path = `${user.id}/${Date.now()}.pdf`;
  const up = await admin.storage.from("cvs").upload(path, bytes, { contentType: "application/pdf" });
  if (up.error) return { error: "Upload failed — try again." };

  // Insert inactive, then swap atomically (activate_cv, 0009): a failure or a concurrent upload never leaves
  // the user without exactly one active CV.
  const { data: cvRow, error } = await supabase.from("cvs").insert({
    user_id: user.id, storage_path: path, file_size: file.size, page_count: pdf.pageCount,
    raw_text: cleanText, page_texts: cleanPages,
    // Never pass parsed_json wholesale into an LLM prompt: safety.issues contains the injected text.
    parsed_json: { ...parsed, safety }, is_active: false,
  }).select("id").single();
  if (error || !cvRow) {
    await admin.storage.from("cvs").remove([path]);
    return { error: "Couldn't save your CV — try again." };
  }
  const cvId = cvRow.id as string;
  const swap = await supabase.rpc("activate_cv", { p_cv: cvId });
  if (swap.error) {
    // Roll back; the previous CV is still the active one.
    await supabase.from("cvs").delete().eq("id", cvId);
    await admin.storage.from("cvs").remove([path]);
    return { error: "Couldn't save your CV — try again." };
  }

  const skills = [...new Set([...parsed.skills.flatMap((g) => g.items.map((i) => canonicalize(i) ?? i)), ...extractSkills(cleanText)])];
  const scored = parsed.archetypes.filter((a) => a.score > 0);
  const { data: prof, error: profErr } = await supabase.from("profiles").select("year, target_archetype").eq("user_id", user.id).single();
  // An unreadable (image-only) or empty parse must not wipe archetypes/skills from e.g. the quiz.
  const hasSignal = !imageOnly && (skills.length > 0 || scored.length > 0);
  const target = prof?.target_archetype ?? (hasSignal ? scored[0]?.key : null) ?? null;
  const year = prof?.year ?? parsed.yearGuess ?? null;
  // If the profile read failed we can't tell what the user already chose: skip rather than overwrite year/target.
  if (!profErr) {
    await supabase.from("profiles").update({
      ...(hasSignal ? { archetypes: scored, skills } : {}),
      target_archetype: target,
      year,
    }).eq("user_id", user.id);
  }

  // CV Score for the target sector. Never fails the upload: the profile page retries (Task 19).
  // No XP for the score itself (amendment item 5).
  if ((ARCHETYPES as readonly string[]).includes(target ?? "")) {
    try {
      const y: Year = (YEARS as readonly string[]).includes(year ?? "") ? (year as Year) : "2nd";
      await scoreCv(supabase, { userId: user.id, cvId, sector: target as Archetype, year: y });
    } catch (e) {
      console.error("scoreCv failed after CV upload; retried on the profile page", e);
    }
  }

  // The CV is saved at this point: an XP hiccup must not turn it into a failed upload.
  let award: AwardResult | null = null;
  try {
    award = await awardXP(supabase, user.id, { type: "cv_uploaded", profileComplete: !imageOnly });
  } catch (e) {
    console.error("awardXP failed after CV upload", e);
  }
  return { ok: true as const, award, imageOnly, cvId, safetyWarning: flagged ? SAFETY_WARNING_COPY : null };
}
