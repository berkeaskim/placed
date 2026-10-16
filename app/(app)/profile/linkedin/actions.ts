"use server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { cvSizeError } from "@/lib/cv/upload-limits";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";
import { loadLatestLinkedInScore, NotLinkedInExportError, NotYourProfileError, scoreLinkedInPdf, scoreLinkedInUrl, type LiPanelData } from "@/lib/linkedin-score/run";
import { mintCaptureToken } from "@/lib/linkedin/capture-token";
import { LI_SECTOR_IMPORTANCE } from "@/lib/linkedin-rules";
import { LinkedInFetchError } from "@/lib/linkedin/fetch-public";

/** `offerPdf`: LinkedIn wouldn't show the profile to us, so the page opens the PDF fallback. */
export type UploadLinkedInResult = { ok: true; data: LiPanelData } | { error: string; offerPdf?: boolean };

async function sectorAndYear(formData: FormData): Promise<{ sector: Archetype; year: Year } | { error: string }> {
  const { user } = await requireUser();
  const s = String(formData.get("sector") ?? "");
  if (!(ARCHETYPES as readonly string[]).includes(s)) return { error: "Pick a sector to score against." };
  const prof = db.select({ year: profiles.year }).from(profiles).where(eq(profiles.user_id, user.id)).get();
  const year: Year = prof?.year && (YEARS as readonly string[]).includes(prof.year) ? (prof.year as Year) : "2nd";
  return { sector: s as Archetype, year };
}

/** Score the student's own public profile from a pasted linkedin.com/in/… link. */
export async function scoreLinkedInLink(formData: FormData): Promise<UploadLinkedInResult> {
  const { user } = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Paste your LinkedIn profile link first." };
  const sy = await sectorAndYear(formData);
  if ("error" in sy) return sy;
  try {
    return { ok: true, data: await scoreLinkedInUrl({ userId: user.id, url, ...sy }) };
  } catch (e) {
    if (e instanceof LinkedInFetchError) return { error: e.message, offerPdf: e.kind !== "invalid_url" && e.kind !== "not_found" };
    if (e instanceof NotYourProfileError) return { error: "The name on that profile doesn't match your CV. Paste your own profile link." };
    console.error("scoreLinkedInLink failed", e);
    return { error: "We couldn't score this profile right now. Try again in a minute." };
  }
}

/**
 * Score a LinkedIn "Save to PDF" export for the chosen sector. The PDF is read in memory and never stored;
 * the year comes from the profile (default 2nd), the sector from the form (validated against ARCHETYPES).
 */
export async function uploadLinkedIn(formData: FormData): Promise<UploadLinkedInResult> {
  const { user } = await requireUser();
  const file = formData.get("linkedin");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose your LinkedIn PDF first." };
  if (file.type !== "application/pdf") return { error: "Please upload a PDF." };
  const tooBig = cvSizeError(file.size);
  if (tooBig) return { error: tooBig };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return { error: "That doesn't look like a PDF." };

  const sy = await sectorAndYear(formData);
  if ("error" in sy) return sy;

  try {
    // pdf.js may detach the buffer it is given, so hand it a copy.
    const data = await scoreLinkedInPdf({ userId: user.id, bytes: bytes.slice(), ...sy });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof NotLinkedInExportError) {
      return { error: "This doesn't look like a LinkedIn export. On your profile, click More (or Resources) → Save to PDF, then upload that file." };
    }
    console.error("uploadLinkedIn failed", e);
    return { error: "We couldn't score this profile right now. Try again in a minute." };
  }
}

/** Ticket the Placed extension uses to post the profile it reads in the student's own logged-in LinkedIn tab. */
export async function startLinkedInCapture(formData: FormData): Promise<{ token: string; since: string } | { error: string }> {
  const { user } = await requireUser();
  const sy = await sectorAndYear(formData);
  if ("error" in sy) return sy;
  // `since` is server time, so polling compares against the database clock, not the browser's.
  return { token: mintCaptureToken({ userId: user.id, ...sy }), since: new Date().toISOString() };
}

/** The newest score for `sector` saved after `since` (ISO), or null while the extension is still working. */
export async function pollLinkedInCapture(sector: Archetype, since: string): Promise<LiPanelData | null> {
  const { user } = await requireUser();
  if (!(ARCHETYPES as readonly string[]).includes(sector)) return null;
  const latest = await loadLatestLinkedInScore(user.id, sector, LI_SECTOR_IMPORTANCE[sector]);
  return latest && Date.parse(latest.scoredAt) > Date.parse(since) ? latest : null;
}
