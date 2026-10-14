import { OUTREACH_TARGETS, type OutreachTarget } from "./targets";
import type { OutreachPurpose } from "./draft";

const PURPOSES: readonly OutreachPurpose[] = ["intro", "follow_up", "interview_prep"];
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Server-action arguments are client-controlled: allow-list the enums and cap the free text before it reaches a prompt. */
export function cleanDraftInput(raw: { target: unknown; purpose: unknown; recipientName: unknown; note: unknown }) {
  if (!OUTREACH_TARGETS.includes(raw.target as OutreachTarget) || !PURPOSES.includes(raw.purpose as OutreachPurpose)) return null;
  return { target: raw.target as OutreachTarget, purpose: raw.purpose as OutreachPurpose, recipientName: text(raw.recipientName, 60), note: text(raw.note, 200) };
}
