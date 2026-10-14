/**
 * Role playbooks for tailoring (docs/research/tailor-playbooks-*.{md,json}): how a screener for each archetype reads
 * a student CV. They steer emphasis and wording only and are never a source of facts; the verify gate still decides.
 * Data is built by scripts/build-tailor-playbooks.ts.
 */
import { z } from "zod";
import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import data from "./playbook-data.json";

export const TailorPlaybook = z.object({
  recruiterScan: z.array(z.string()).min(1),
  leadWith: z.array(z.string()).min(1),
  summaryFormula: z.string(),
  verbs: z.object({ prefer: z.array(z.string()), avoid: z.array(z.string()) }),
  reframes: z.array(z.object({ from: z.string(), to: z.string(), onlyIf: z.string() })),
  competencyThemes: z.array(z.string()).default([]),
  sectionOrder: z.array(z.string()).default([]),
  pitfalls: z.array(z.string()).default([]),
});
export type TailorPlaybookT = z.infer<typeof TailorPlaybook>;

const PLAYBOOKS = data as Partial<Record<Archetype, TailorPlaybookT>>;

export function tailorPlaybook(archetype: Archetype | null | undefined): TailorPlaybookT | null {
  return (archetype && PLAYBOOKS[archetype]) || null;
}

/** The playbook as prompt text. Null when the job has no archetype or there is no playbook for it. */
export function playbookPrompt(archetype: Archetype | null | undefined): string | null {
  const p = tailorPlaybook(archetype);
  if (!p || !archetype) return null;
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return [
    `ROLE PLAYBOOK: ${ARCHETYPE_LABELS[archetype]}. Research on how screeners read student CVs for this kind of role. It shapes emphasis, order and wording only; it is never a source of facts.`,
    `What the screener checks first:\n${list(p.recruiterScan)}`,
    `Lead each entry with:\n${list(p.leadWith)}`,
    `Profile/summary: ${p.summaryFormula}`,
    `Verbs that read well (use one only when the original line describes that action): ${p.verbs.prefer.join(", ")}`,
    `Avoid for this role: ${p.verbs.avoid.join("; ")}`,
    `Reframes (use only when the condition holds; [brackets] are slots filled from the CV, never invented):\n${p.reframes.map((r) => `- "${r.from}" → "${r.to}" (only if ${r.onlyIf})`).join("\n")}`,
    `Reads badly for this role:\n${list(p.pitfalls)}`,
  ].join("\n");
}
