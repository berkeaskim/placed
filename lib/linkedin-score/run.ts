import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cvs, linkedinScores } from "@/lib/db/schema";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import { extractLinkedInLines } from "@/lib/linkedin/extract";
import { parseLinkedInExport, type ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import { fetchPublicProfile, normalizeProfileUrl } from "@/lib/linkedin/fetch-public";
import { parsePublicProfile } from "@/lib/linkedin/parse-public";
import { parseCapturedProfile, type CapturePayload } from "@/lib/linkedin/parse-capture";
import { parseLinkedInArchive } from "@/lib/linkedin/parse-archive";
import { judgeLinkedIn } from "@/lib/ai/judgeLinkedIn";
import { presenceTipFor, type LiInputSource } from "@/lib/linkedin-rules";
import { scoreLinkedIn, type LiScoreResult } from "./score";
import type { LiFix } from "./aggregate";

/** What the panel renders; also the shape stored in linkedin_scores. */
export type LiPanelData = {
  sector: Archetype;
  year: Year;
  total: number;
  label: LiScoreResult["label"];
  dimensions: LiScoreResult["dimensions"];
  capsApplied: string[];
  fixes: LiFix[];
  tips: LiScoreResult["tips"];
  importance: LiScoreResult["importance"];
  assessed: number;
  passed: number;
  notCovered: number;
  couldNotAssess: number;
  aiUnavailable: boolean;
  hasCv: boolean;
  parseWarnings: string[];
  /** Which input produced this score. Scores from different inputs aren't comparable (08 #4). Missing on rows saved before 2026-10-18. */
  source?: LiInputSource;
  /** What we read from the export, so the student can spot a misread. */
  profile: { headline: string | null; location: string | null; experience: number; education: number; topSkills: string[] };
  scoredAt: string;
  /** false when the insert failed: the result is shown but not kept. */
  saved: boolean;
};

/** True when the parsed PDF has the export's structure (headings + a LinkedIn URL), not some other document. */
export function looksLikeLinkedInExport(li: ParsedLinkedIn, text: string): boolean {
  const known = ["Contact", "Top Skills", "Summary", "Experience", "Education"].filter((h) => li.sections.includes(h)).length;
  return known >= 2 && (li.profileUrl !== null || /linkedin\.com/i.test(text));
}

export class NotLinkedInExportError extends Error {}
/** The profile's name doesn't match the CV on file: we only score the student's own profile. */
export class NotYourProfileError extends Error {}

const nameTokens = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 1);
/** True when the profile and CV share at least two name tokens (or the one token of a mononym). */
export function sameName(a: string, b: string): boolean {
  const ta = nameTokens(a), tb = new Set(nameTokens(b));
  const shared = ta.filter((t) => tb.has(t)).length;
  return shared >= Math.min(2, ta.length, tb.size);
}

function activeCv(userId: string): ParsedCV | null {
  const row = db.select({ parsed_json: cvs.parsed_json }).from(cvs).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  return (row?.parsed_json as ParsedCV | undefined) ?? null;
}

/**
 * Pasted profile link → public page → score. Refuses a profile whose name doesn't match the CV on file, so a
 * student can't run someone else's profile through the AI. Throws LinkedInFetchError when LinkedIn blocks the read.
 */
export async function scoreLinkedInUrl(
  i: { userId: string; url: string; sector: Archetype; year: Year; today?: Date },
): Promise<LiPanelData> {
  const cv = activeCv(i.userId);
  const canonical = normalizeProfileUrl(i.url);
  const html = await fetchPublicProfile(canonical);
  const { li, text } = parsePublicProfile(html, canonical);
  const cvName = cv?.name?.trim();
  if (cvName && li.name && !sameName(li.name, cvName)) throw new NotYourProfileError("profile name does not match the CV");
  return scoreParsed({ ...i, li, text, cv, source: "url" });
}

/** The extension posted a ticket that was already used. */
export class CaptureUsedError extends Error {}

/**
 * Profile read by the Placed extension in the student's own logged-in LinkedIn tab → score. The extension has no
 * Placed session; the signed ticket names the user. One score per ticket nonce.
 */
export async function scoreLinkedInCapture(
  i: { userId: string; nonce: string; payload: CapturePayload; sector: Archetype; year: Year; today?: Date },
): Promise<LiPanelData> {
  const used = db.select({ id: linkedinScores.id }).from(linkedinScores)
    .where(and(eq(linkedinScores.user_id, i.userId), sql`json_extract(${linkedinScores.meta}, '$.captureNonce') = ${i.nonce}`)).limit(1).get();
  if (used) throw new CaptureUsedError("ticket already used");
  const cv = activeCv(i.userId);
  const slug = i.payload.profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  const { li, text } = parseCapturedProfile(i.payload, slug ? `https://www.linkedin.com/in/${slug}` : "https://www.linkedin.com/in/me");
  const cvName = cv?.name?.trim();
  if (cvName && li.name && !sameName(li.name, cvName)) throw new NotYourProfileError("profile name does not match the CV");
  return scoreParsed({ ...i, li, text, cv, source: "extension", extraMeta: { captureNonce: i.nonce } });
}

/**
 * LinkedIn "Download your data" archive (zip) → score. The sanctioned input (08 #11): only the profile CSVs are read,
 * in memory, and the zip is never stored. Throws NotLinkedInArchiveError for anything else.
 */
export async function scoreLinkedInArchive(
  i: { userId: string; bytes: Uint8Array; sector: Archetype; year: Year; today?: Date },
): Promise<LiPanelData> {
  const cv = activeCv(i.userId);
  const { li, text } = parseLinkedInArchive(i.bytes);
  const cvName = cv?.name?.trim();
  if (cvName && li.name && !sameName(li.name, cvName)) throw new NotYourProfileError("profile name does not match the CV");
  return scoreParsed({ ...i, li, text, cv, source: "archive" });
}

/**
 * PDF bytes → parsed profile → score for one sector, compared with the user's active CV when there is one.
 * Persists to linkedin_scores. Never stores the PDF.
 */
export async function scoreLinkedInPdf(
  i: { userId: string; bytes: Uint8Array; sector: Archetype; year: Year; today?: Date },
): Promise<LiPanelData> {
  const cv = activeCv(i.userId);
  const { lines, text } = await extractLinkedInLines(i.bytes);
  const li = parseLinkedInExport(lines, { knownName: cv?.name?.trim() || undefined });
  if (!looksLikeLinkedInExport(li, text)) throw new NotLinkedInExportError("not a LinkedIn export");
  return scoreParsed({ ...i, li, text, cv, source: "pdf" });
}

/** Shared core for every input: score, persist, return the panel data. */
async function scoreParsed(
  i: { userId: string; li: ParsedLinkedIn; text: string; cv: ParsedCV | null; sector: Archetype; year: Year; today?: Date; source: LiInputSource; extraMeta?: Record<string, string> },
): Promise<LiPanelData> {
  const { li, text, cv } = i;
  const hash = createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
  const score = await scoreLinkedIn({
    li, rawText: text, cv, sector: i.sector, year: i.year, today: i.today ?? new Date(),
    judge: judgeLinkedIn, fixtureKey: `${hash.slice(0, 16)}-${i.sector}`, source: i.source,
  });

  const data: LiPanelData = {
    sector: i.sector, year: i.year, total: score.total, label: score.label, dimensions: score.dimensions,
    capsApplied: score.capsApplied, fixes: score.fixes, tips: score.tips, importance: score.importance,
    assessed: score.assessed, passed: score.passed, notCovered: score.notCovered, couldNotAssess: score.couldNotAssess,
    aiUnavailable: score.aiUnavailable, hasCv: cv !== null, parseWarnings: score.parseWarnings, source: i.source,
    profile: { headline: li.headline, location: li.location, experience: li.experience.length, education: li.education.length, topSkills: li.topSkills },
    scoredAt: new Date().toISOString(), saved: false,
  };

  const profileJson = { ...li, email: null };
  try {
    db.insert(linkedinScores).values({
    user_id: i.userId, sector: i.sector, year: i.year, total: data.total, label: data.label, dimensions: data.dimensions,
    caps_applied: data.capsApplied, fixes: data.fixes, rule_results: score.results, tips: data.tips,
    meta: { ...i.extraMeta, source: i.source, assessed: data.assessed, passed: data.passed, notCovered: data.notCovered, couldNotAssess: data.couldNotAssess, aiUnavailable: data.aiUnavailable, hasCv: data.hasCv, parseWarnings: data.parseWarnings, profile: data.profile },
    profile_json: profileJson, text_hash: hash,
    }).run();
    data.saved = true;
  } catch (e) {
    console.error("linkedin_scores insert failed", e);
  }
  return data;
}

type Row = {
  sector: Archetype; year: Year; total: number; label: LiPanelData["label"]; dimensions: LiPanelData["dimensions"];
  caps_applied: string[]; fixes: LiFix[]; tips: LiPanelData["tips"]; created_at: string;
  meta: Pick<LiPanelData, "assessed" | "passed" | "notCovered" | "couldNotAssess" | "aiUnavailable" | "hasCv" | "parseWarnings" | "profile" | "source">;
};

/** Latest saved score for a sector, or null. */
export async function loadLatestLinkedInScore(userId: string, sector: Archetype, importance: LiPanelData["importance"]): Promise<LiPanelData | null> {
  const s = linkedinScores;
  let data: Row | undefined;
  try {
    data = db.select({ sector: s.sector, year: s.year, total: s.total, label: s.label, dimensions: s.dimensions, caps_applied: s.caps_applied, fixes: s.fixes, tips: s.tips, meta: s.meta, created_at: s.created_at })
      .from(s).where(and(eq(s.user_id, userId), eq(s.sector, sector))).orderBy(desc(s.created_at)).limit(1).get() as Row | undefined;
  } catch (e) {
    console.error("linkedin_scores read failed", e);
    return null;
  }
  if (!data) return null;
  return {
    sector: data.sector, year: data.year, total: data.total, label: data.label, dimensions: data.dimensions,
    capsApplied: data.caps_applied, fixes: data.fixes, tips: data.tips.map((t) => ({ ...t, statement: presenceTipFor(t.ruleId, t.statement) })), importance, ...data.meta,
    scoredAt: data.created_at, saved: true,
  };
}
