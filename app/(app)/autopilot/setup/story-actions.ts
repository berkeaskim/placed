"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/local-user";
import { deleteStory, findStories } from "@/lib/cover-letter/store";

export type SavedStory = { id: string; kind: "story" | "why_firm"; company: string | null; text: string };

/** The answers the cover letter writer remembered (CV stories and "why this firm"), newest first. */
export async function listSavedStories(): Promise<SavedStory[]> {
  const { user } = await requireUser();
  return [...findStories(user.id, { kind: "story" }), ...findStories(user.id, { kind: "why_firm" })]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((s) => ({ id: s.id, kind: s.kind as SavedStory["kind"], company: s.company, text: s.text }));
}

export async function forgetStory(id: string): Promise<{ ok: boolean }> {
  const { user } = await requireUser();
  if (typeof id !== "string" || !id || id.length > 64) return { ok: false };
  try {
    deleteStory(user.id, id);
  } catch {
    return { ok: false };
  }
  revalidatePath("/autopilot/setup");
  return { ok: true };
}
