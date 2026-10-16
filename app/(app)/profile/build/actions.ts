"use server";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { activateCv } from "@/lib/db/functions";
import { cvs, profiles } from "@/lib/db/schema";
import { deleteFile, putFile } from "@/lib/files";
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
import { cvSizeError } from "@/lib/cv/upload-limits";

export type UploadCvResult =
  | { ok: true; award: AwardResult | null; imageOnly: boolean; cvId: string; safetyWarning: string | null }
  | { error: string };

export async function uploadCv(formData: FormData): Promise<UploadCvResult> {
  const { user } = await requireUser();
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF first." };
  if (file.type !== "application/pdf") return { error: "Please upload a PDF." };
  const tooBig = cvSizeError(file.size);
  if (tooBig) return { error: tooBig };

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

  const path = `${user.id}/${Date.now()}.pdf`;
  try { await putFile("cvs", path, bytes, "application/pdf"); } catch { return { error: "Upload failed — try again." }; }

  // Insert inactive, then swap atomically (activateCv): a failure or a concurrent upload never leaves
  // the user without exactly one active CV.
  let cvId: string;
  try {
    cvId = db.insert(cvs).values({
      user_id: user.id, storage_path: path, file_size: file.size, page_count: pdf.pageCount,
      raw_text: cleanText, page_texts: cleanPages,
      // Never pass parsed_json wholesale into an LLM prompt: safety.issues contains the injected text.
      parsed_json: { ...parsed, safety } as ParsedCV, is_active: false,
    }).returning({ id: cvs.id }).get().id;
  } catch {
    await deleteFile("cvs", path).catch(() => {});
    return { error: "Couldn't save your CV — try again." };
  }
  try {
    activateCv(user.id, cvId);
  } catch {
    // Roll back; the previous CV is still the active one.
    try { db.delete(cvs).where(eq(cvs.id, cvId)).run(); } catch { /* best effort */ }
    await deleteFile("cvs", path).catch(() => {});
    return { error: "Couldn't save your CV — try again." };
  }

  const skills = [...new Set([...parsed.skills.flatMap((g) => g.items.map((i) => canonicalize(i) ?? i)), ...extractSkills(cleanText)])];
  const scored = parsed.archetypes.filter((a) => a.score > 0);
  let prof: { year: Year | null; target_archetype: Archetype | null } | undefined;
  try { prof = db.select({ year: profiles.year, target_archetype: profiles.target_archetype }).from(profiles).where(eq(profiles.user_id, user.id)).get(); }
  catch { prof = undefined; }
  // An unreadable (image-only) or empty parse must not wipe archetypes/skills from e.g. the quiz.
  const hasSignal = !imageOnly && (skills.length > 0 || scored.length > 0);
  const target = prof?.target_archetype ?? (hasSignal ? scored[0]?.key : null) ?? null;
  const year = prof?.year ?? parsed.yearGuess ?? null;
  // If the profile read failed we can't tell what the user already chose: skip rather than overwrite year/target.
  if (prof) {
    try {
      db.update(profiles).set({
        ...(hasSignal ? { archetypes: scored, skills } : {}),
        target_archetype: target,
        year,
      }).where(eq(profiles.user_id, user.id)).run();
    } catch (e) { console.error("profile update after CV upload failed", e); }
  }

  // CV Score for the target sector, after the response is sent (one smart-tier call, ~116 rules): the
  // upload returns immediately and never fails because of scoring; the profile page retries a missing
  // score (Task 19). No XP for the score itself (amendment item 5).
  if ((ARCHETYPES as readonly string[]).includes(target ?? "")) {
    const y: Year = (YEARS as readonly string[]).includes(year ?? "") ? (year as Year) : "2nd";
    try {
      after(async () => {
        try {
          await scoreCv({ userId: user.id, cvId, sector: target as Archetype, year: y });
        } catch (e) {
          console.error("scoreCv failed after CV upload; retried on the profile page", e);
        }
      });
    } catch (e) {
      // after() throws outside a request scope (e.g. direct calls in tests): scoring is skipped, never the upload.
      console.error("couldn't schedule scoreCv after CV upload; retried on the profile page", e);
    }
  }

  // The CV is saved at this point: an XP hiccup must not turn it into a failed upload.
  let award: AwardResult | null = null;
  try {
    award = await awardXP(user.id, { type: "cv_uploaded", profileComplete: !imageOnly });
  } catch (e) {
    console.error("awardXP failed after CV upload", e);
  }
  return { ok: true as const, award, imageOnly, cvId, safetyWarning: flagged ? SAFETY_WARNING_COPY : null };
}
