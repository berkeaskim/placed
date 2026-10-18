"use server";
import { requireUser } from "@/lib/auth/local-user";
import { isUuid } from "@/lib/feed/save-result";
import * as svc from "@/lib/cover-letter/service";
import type { CardView } from "@/lib/cover-letter/service";
import type { Answer, Limit, Mode, OutputTarget } from "@/lib/cover-letter/types";

/** Every action returns the whole card, or an error to show the student. */
export type CardResult = CardView | { error: string };

async function run(jobId: unknown, fn: (userId: string, jobId: string) => Promise<CardView>): Promise<CardResult> {
  const { user } = await requireUser();
  if (!isUuid(jobId)) return { error: "Unknown job" };
  try {
    return await fn(user.id, jobId);
  } catch (e) {
    if (e instanceof svc.CardError) return { error: e.message };
    console.error("cover-letter action:", e instanceof Error ? e.message : "unknown error");
    return { error: "Something went wrong. Please try again." };
  }
}

const validTarget = (t: unknown): t is OutputTarget => {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return x.kind === "upload" || (x.kind === "field" && typeof x.fieldKey === "string" && x.fieldKey.length <= 200 && typeof x.label === "string" && x.label.length <= 300);
};
const idOk = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

export async function openCoverLetter(jobId: string, target?: OutputTarget): Promise<CardResult> {
  if (target !== undefined && !validTarget(target)) return { error: "Unknown target" };
  return run(jobId, (u, j) => svc.openCard(u, j, target));
}

/** Retry on a failed company lookup. */
export async function retryResearch(jobId: string): Promise<CardResult> {
  return run(jobId, (u, j) => svc.retryResearch(u, j));
}

export async function answerQuestion(jobId: string, questionId: Answer["question"], text: string | null): Promise<CardResult> {
  return run(jobId, (u, j) => svc.answerQuestion(u, j, questionId, text));
}

export async function pickFacts(jobId: string, factIds: string[]): Promise<CardResult> {
  if (!Array.isArray(factIds) || !factIds.every(idOk)) return { error: "Unknown facts" };
  return run(jobId, (u, j) => svc.pickFacts(u, j, factIds));
}

/** The "Use my saved answer" chip (not `useSavedStory`: a `use` prefix reads as a React hook to the linter). */
export async function applySavedStory(jobId: string, storyId: string): Promise<CardResult> {
  if (!idOk(storyId)) return { error: "Unknown story" };
  return run(jobId, (u, j) => svc.applySavedStory(u, j, storyId));
}

export async function confirmPersonAction(jobId: string, name: string, ok: boolean): Promise<CardResult> {
  if (typeof name !== "string" || name.length > 100 || typeof ok !== "boolean") return { error: "Unknown person" };
  return run(jobId, (u, j) => svc.confirmPerson(u, j, name, ok));
}

export async function confirmTrue(jobId: string, outputId: string, spanStart: number, ownWords?: string | null): Promise<CardResult> {
  if (!idOk(outputId) || !Number.isInteger(spanStart) || spanStart < 0) return { error: "Unknown sentence" };
  return run(jobId, (u, j) => svc.confirmTrue(u, j, outputId, spanStart, ownWords));
}

export async function saveText(jobId: string, outputId: string, text: string): Promise<CardResult> {
  if (!idOk(outputId)) return { error: "Unknown letter" };
  return run(jobId, (u, j) => svc.saveText(u, j, outputId, text));
}

export async function undoEdit(jobId: string, outputId: string): Promise<CardResult> {
  if (!idOk(outputId)) return { error: "Unknown letter" };
  return run(jobId, (u, j) => svc.undoEdit(u, j, outputId));
}

export async function markReady(jobId: string, outputId: string): Promise<CardResult> {
  if (!idOk(outputId)) return { error: "Unknown letter" };
  return run(jobId, (u, j) => svc.markReady(u, j, outputId));
}

export async function addFieldOutput(jobId: string, label: string, limit: Limit): Promise<CardResult> {
  return run(jobId, (u, j) => svc.addFieldOutput(u, j, label, limit));
}

/** The manual entry point's mode control: the output restarts as an empty draft in the new mode. */
export async function setMode(jobId: string, outputId: string, mode: Mode, limit?: Limit): Promise<CardResult> {
  if (!idOk(outputId)) return { error: "Unknown letter" };
  return run(jobId, (u, j) => svc.setMode(u, j, outputId, mode, limit));
}
