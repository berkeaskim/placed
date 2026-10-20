import { isImageOnly } from "@/lib/cv/image-only";
import type { Archetype, ArchetypeScore } from "@/lib/types";

/** Pure helpers for the quiz result and the /profile role cards (Task 19). */

/** Spec §9 step 4: role cards read as concrete roles ("Data Analyst Intern — 92%"). */
export const ROLE_TITLES: Record<Archetype, string> = {
  software_eng: "Software Engineer Intern",
  data_analytics: "Data Analyst Intern",
  quant_trading: "Quant Trader Intern",
  consulting: "Consulting Analyst Intern",
  product: "Product Manager Intern",
  finance_banking: "Banking & Finance Intern",
  marketing_growth: "Marketing & Growth Intern",
  research: "Research Intern",
  engineering: "Engineering Intern",
  science_pharma: "Lab Scientist Intern",
};

export type RoleCard = { key: Archetype; title: string; score: number; why: string[] };

/** Top 3 by score, archetypes scoring 0 never shown, 1–2 why lines each. */
export function roleCards(archetypes: ArchetypeScore[] | null | undefined): RoleCard[] {
  return [...(archetypes ?? [])]
    .map((a) => ({ ...a, score: Math.round(Math.min(100, Math.max(0, a.score))) }))
    .filter((a) => a.score > 0 && a.key in ROLE_TITLES)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((a) => ({ key: a.key, title: ROLE_TITLES[a.key], score: a.score, why: (a.why ?? []).filter((w) => w.trim()).slice(0, 2) }));
}

/**
 * The deterministic ranking (keys, order, scores) always wins; the AI may only supply friendlier why lines
 * for archetypes already in the ranking. Blank or missing AI lines keep the deterministic ones.
 */
export function mergeQuizWhy(ranking: ArchetypeScore[], ai: ArchetypeScore[] | null | undefined): ArchetypeScore[] {
  const byKey = new Map((ai ?? []).map((a) => [a.key, (a.why ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 2)]));
  return ranking.map((r) => {
    const lines = byKey.get(r.key);
    return { ...r, why: lines && lines.length ? lines : r.why };
  });
}

type ActiveCv = { page_texts: string[] | null; parsed_json: { archetypes?: ArchetypeScore[] } | null } | null;

/**
 * The quiz never silently overwrites CV-derived roles. It writes archetypes only when there is no active CV,
 * or the active CV gave no role signal (image-only, or no archetype scored above 0) — the same condition
 * under which uploadCv leaves archetypes untouched.
 */
export function quizMayWriteArchetypes(cv: ActiveCv): boolean {
  if (!cv) return true;
  if (isImageOnly(cv.page_texts ?? [])) return true;
  return !(cv.parsed_json?.archetypes ?? []).some((a) => a.score > 0);
}

/** http(s) links inside a MYTHS `sources` string, labelled by host. Anything else (javascript:, ftp:) is dropped. */
export function mythLinks(sources: string): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const m of sources.matchAll(/https?:\/\/[^\s,;"'<>]+/gi)) {
    const raw = m[0].replace(/[).,;:]+$/, "");
    let url: URL;
    try { url = new URL(raw); } catch { continue; }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    out.push({ href: url.href, label: url.hostname.replace(/^www\./, "") });
  }
  return out;
}
