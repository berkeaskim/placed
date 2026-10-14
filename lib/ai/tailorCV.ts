import type { ParsedCV, TailorChange, TailoredBullet, TailoredCV, TailoredEntry } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import { stripPii } from "@/lib/cv-score/pii";
import { AiError, generateStructured, runAi } from "./provider";
import { SYSTEM_TAILOR, wrapJob } from "./prompts";
import { TailoredCvFixture, TailoredCvOutput, type TailoredCvFixtureT } from "./schemas";
import { heuristicTailor } from "./heuristics";

/**
 * tailorCV (spec §7.1, 05 §2 [2]). Smart tier, default temperature. `allowed` = existing ∪ supportedByResume skills only:
 * the caller's deterministic pre-pass never passes a gap skill. The output is NOT trusted: lib/tailor/run.ts runs
 * verifyTailoring on it, retries once and reverts what still blocks.
 */
export type TailorInput = { cv: ParsedCV; job: JobListItem; allowed: string[]; supported: string[]; feedback: string[] | null };

/** tailorCV's answer, plus whether it came from the reorder-only heuristic instead of the model (and why). */
export type TailorCvResult = TailoredCV & { usedFallback?: boolean; fallbackReason?: string };
export const FALLBACK_NO_FIXTURE = "No AI answer is recorded for this role, so we only reordered your bullets.";
export const FALLBACK_AI_ERROR = "The AI was unavailable, so we only reordered your bullets.";
const escapeData = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** CV content the model sees: named content fields only (never parsed_json, whose `safety` holds injected text), no contact details. */
function cvForPrompt(cv: ParsedCV) {
  const c = stripPii(cv);
  return {
    summary: c.summary, experience: c.experience, projects: c.projects, leadership: c.leadership,
    skills: c.skills,
    education: c.education.map((e) => ({ id: e.id, institution: e.institution, degree: e.degree, details: e.details })),
  };
}

/** 2–3 of the student's own bullets, so rephrasings keep their voice (05 §2 [2]). */
export function styleAnchors(cv: ParsedCV, max = 3): string[] {
  const bullets = [...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => e.bullets.map((b) => b.text.trim()));
  const words = (s: string) => s.split(/\s+/).length;
  const good = bullets.filter((b) => words(b) >= 5 && words(b) <= 35);
  return [...new Set(good.length ? good : bullets)].slice(0, max);
}

export function buildTailorPrompt(i: TailorInput): string {
  const anchors = styleAnchors(i.cv).map((b) => `- ${escapeData(b)}`).join("\n") || "- (none)";
  const out = [
    `ALLOWED KEYWORDS: ${i.allowed.map(escapeData).join(", ") || "(none)"}`,
    `MAY MOVE INTO SKILLS (already in the CV's prose): ${i.supported.map(escapeData).join(", ") || "(none)"}`,
    wrapJob(i.job.textLines.join("\n"), i.job.title),
    `STYLE ANCHORS (the student's own lines):\n${anchors}`,
    `<cv>\n${escapeData(JSON.stringify(cvForPrompt(i.cv)))}\n</cv>`,
  ];
  if (i.feedback?.length) {
    out.push(`YOUR PREVIOUS ATTEMPT WAS REJECTED because these claims are not supported by the CV. Remove them or restate the original wording:\n<rejected_claims>\n${i.feedback.map((f) => `- ${escapeData(f)}`).join("\n")}\n</rejected_claims>`);
  }
  return out.join("\n\n");
}

type RawBullet = TailoredCvFixtureT["experience"][number]["bullets"][number];
type RawEntry = TailoredCvFixtureT["experience"][number];

/**
 * Same post-processing for live and fixture output (C6): education and interests come from the source CV,
 * entry heads (org/title/dates/location) are restored by id, and bullets get their optional extras.
 * Unknown entries/bullets pass through unchanged: the gate decides about them.
 */
export function normalizeTailored(raw: TailoredCvFixtureT, cv: ParsedCV): TailoredCV {
  const heads = new Map([...cv.experience, ...cv.projects, ...cv.leadership].map((e) => [e.id, e]));
  const bullet = (b: RawBullet): TailoredBullet => ({
    id: b.id, text: b.text, sourceRefs: [...b.sourceRefs],
    ...(b.changeType ? { changeType: b.changeType } : {}),
    ...(b.qualifiersKept.length ? { qualifiersKept: [...b.qualifiersKept] } : {}),
    ...(b.changeType === "dropped" && b.dropReason ? { dropReason: b.dropReason } : {}),
  });
  const entries = (es: RawEntry[]): TailoredEntry[] => es.map((e) => {
    const src = heads.get(e.id);
    const head = src ? { org: src.org, title: src.title, dates: src.dates, location: src.location } : { org: e.org, title: e.title, dates: e.dates, location: e.location };
    return { id: e.id, ...head, bullets: e.bullets.map(bullet) };
  });
  const changes: TailorChange[] = raw.changes.map((c) => ({ ...c, keywordsAdded: [...c.keywordsAdded] }));
  return {
    summary: raw.summary,
    education: cv.education.map((e) => ({ ...e, details: e.details.map((d) => ({ ...d })) })),
    experience: entries(raw.experience), projects: entries(raw.projects), leadership: entries(raw.leadership),
    skills: raw.skills.map((g) => ({ group: g.group, items: [...g.items] })),
    interests: cv.interests,
    changes,
  };
}

export async function tailorCV(i: TailorInput): Promise<TailorCvResult> {
  const heuristic = (reason: string): TailorCvResult =>
    ({ ...heuristicTailor({ cv: i.cv, allowed: i.allowed, supported: i.supported }), usedFallback: true, fallbackReason: reason });
  const fallback = () => heuristic(FALLBACK_NO_FIXTURE);
  try {
    return await runAi<TailorCvResult, TailoredCvFixtureT>({
      fn: "tailorCV",
      fixtureKey: i.job.extId,
      schema: TailoredCvFixture,
      fromFixture: (raw) => normalizeTailored(raw, i.cv),
      live: async () => {
        const o = await generateStructured({
          tier: "smart", system: SYSTEM_TAILOR, schema: TailoredCvOutput, maxTokens: 16000, // no temperature: Claude rejects it, Gemini 3 should stay at its default
          parts: [{ type: "text", text: buildTailorPrompt(i) }],
        });
        return normalizeTailored(o, i.cv);
      },
      fallback,
    });
  } catch (e) {
    // The model being unavailable never blocks tailoring: the heuristic only reorders, so it can't fabricate.
    if (e instanceof AiError) {
      console.error("tailorCV: AI call failed, using the reorder-only heuristic", { code: e.name, message: e.message, cause: e.cause instanceof Error ? e.cause.message : undefined });
      return heuristic(FALLBACK_AI_ERROR);
    }
    throw e;
  }
}
