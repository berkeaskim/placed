import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import { extractLinkedInLines } from "@/lib/linkedin/extract";
import { parseLinkedInExport, type ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import { fetchPublicProfile, normalizeProfileUrl } from "@/lib/linkedin/fetch-public";
import { parsePublicProfile } from "@/lib/linkedin/parse-public";
import { judgeLinkedIn } from "@/lib/ai/judgeLinkedIn";
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
  /** What we read from the export, so the student can spot a misread. */
  profile: { headline: string | null; location: string | null; experience: number; education: number; topSkills: string[] };
  scoredAt: string;
  /** false when migration 0013 isn't applied: the result is shown but not kept. */
  saved: boolean;
};

const missingTable = (e: { code?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205");

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

async function activeCv(supabase: SupabaseClient, userId: string): Promise<ParsedCV | null> {
  const { data } = await supabase
    .from("cvs").select("parsed_json").eq("user_id", userId).eq("is_active", true)
    .maybeSingle<{ parsed_json: ParsedCV & { safety?: unknown } }>();
  return data?.parsed_json ?? null;
}

/**
 * Pasted profile link → public page → score. Refuses a profile whose name doesn't match the CV on file, so a
 * student can't run someone else's profile through the AI. Throws LinkedInFetchError when LinkedIn blocks the read.
 */
export async function scoreLinkedInUrl(
  supabase: SupabaseClient,
  i: { userId: string; url: string; sector: Archetype; year: Year; today?: Date },
): Promise<LiPanelData> {
  const cv = await activeCv(supabase, i.userId);
  const canonical = normalizeProfileUrl(i.url);
  const html = await fetchPublicProfile(canonical);
  const { li, text } = parsePublicProfile(html, canonical);
  const cvName = cv?.name?.trim();
  if (cvName && li.name && !sameName(li.name, cvName)) throw new NotYourProfileError("profile name does not match the CV");
  return scoreParsed(supabase, { ...i, li, text, cv, source: "url" });
}

/**
 * PDF bytes → parsed profile → score for one sector, compared with the user's active CV when there is one.
 * Persists to linkedin_scores (skipped with a warning while migration 0013 is unapplied). Never stores the PDF.
 */
export async function scoreLinkedInPdf(
  supabase: SupabaseClient,
  i: { userId: string; bytes: Uint8Array; sector: Archetype; year: Year; today?: Date },
): Promise<LiPanelData> {
  const cv = await activeCv(supabase, i.userId);
  const { lines, text } = await extractLinkedInLines(i.bytes);
  const li = parseLinkedInExport(lines, { knownName: cv?.name?.trim() || undefined });
  if (!looksLikeLinkedInExport(li, text)) throw new NotLinkedInExportError("not a LinkedIn export");
  return scoreParsed(supabase, { ...i, li, text, cv, source: "pdf" });
}

/** Shared core for both inputs: score, persist (when migration 0013 is applied), return the panel data. */
async function scoreParsed(
  supabase: SupabaseClient,
  i: { userId: string; li: ParsedLinkedIn; text: string; cv: ParsedCV | null; sector: Archetype; year: Year; today?: Date; source: "pdf" | "url" },
): Promise<LiPanelData> {
  const { li, text, cv } = i;
  const hash = createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
  const score = await scoreLinkedIn({
    li, rawText: text, cv, sector: i.sector, year: i.year, today: i.today ?? new Date(),
    judge: judgeLinkedIn, fixtureKey: `${hash.slice(0, 16)}-${i.sector}`,
  });

  const data: LiPanelData = {
    sector: i.sector, year: i.year, total: score.total, label: score.label, dimensions: score.dimensions,
    capsApplied: score.capsApplied, fixes: score.fixes, tips: score.tips, importance: score.importance,
    assessed: score.assessed, passed: score.passed, notCovered: score.notCovered, couldNotAssess: score.couldNotAssess,
    aiUnavailable: score.aiUnavailable, hasCv: cv !== null, parseWarnings: score.parseWarnings,
    profile: { headline: li.headline, location: li.location, experience: li.experience.length, education: li.education.length, topSkills: li.topSkills },
    scoredAt: new Date().toISOString(), saved: false,
  };

  const profileJson = { ...li, email: null };
  const ins = await supabase.from("linkedin_scores").insert({
    user_id: i.userId, sector: i.sector, year: i.year, total: data.total, label: data.label, dimensions: data.dimensions,
    caps_applied: data.capsApplied, fixes: data.fixes, rule_results: score.results, tips: data.tips,
    meta: { source: i.source, assessed: data.assessed, passed: data.passed, notCovered: data.notCovered, couldNotAssess: data.couldNotAssess, aiUnavailable: data.aiUnavailable, hasCv: data.hasCv, parseWarnings: data.parseWarnings, profile: data.profile },
    profile_json: profileJson, text_hash: hash,
  });
  if (missingTable(ins.error)) console.warn("linkedin_scores missing: run supabase/migrations/0014_linkedin_scores.sql");
  else if (ins.error) console.error("linkedin_scores insert failed", ins.error);
  else data.saved = true;
  return data;
}

type Row = {
  sector: Archetype; year: Year; total: number; label: LiPanelData["label"]; dimensions: LiPanelData["dimensions"];
  caps_applied: string[]; fixes: LiFix[]; tips: LiPanelData["tips"]; created_at: string;
  meta: Pick<LiPanelData, "assessed" | "passed" | "notCovered" | "couldNotAssess" | "aiUnavailable" | "hasCv" | "parseWarnings" | "profile">;
};

/** Latest saved score for a sector, or null (none yet, or migration 0013 not applied). */
export async function loadLatestLinkedInScore(supabase: SupabaseClient, userId: string, sector: Archetype, importance: LiPanelData["importance"]): Promise<LiPanelData | null> {
  const { data, error } = await supabase
    .from("linkedin_scores")
    .select("sector, year, total, label, dimensions, caps_applied, fixes, tips, meta, created_at")
    .eq("user_id", userId).eq("sector", sector).order("created_at", { ascending: false }).limit(1).maybeSingle<Row>();
  if (error) { if (!missingTable(error)) console.error("linkedin_scores read failed", error); return null; }
  if (!data) return null;
  return {
    sector: data.sector, year: data.year, total: data.total, label: data.label, dimensions: data.dimensions,
    capsApplied: data.caps_applied, fixes: data.fixes, tips: data.tips, importance, ...data.meta,
    scoredAt: data.created_at, saved: true,
  };
}
