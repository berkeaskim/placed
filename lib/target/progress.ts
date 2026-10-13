import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { awardXP } from "@/lib/gamify/award";
import { PLAYBOOKS, type Action } from "@/lib/playbooks";
import { ARCHETYPES } from "@/lib/types";

const MIN_NOTE = 10;
const MAX_NOTE = 500;

export function findAction(id: string): Action | null {
  for (const a of ARCHETYPES) {
    const hit = PLAYBOOKS[a].actions.find((x) => x.id === id);
    if (hit) return hit;
  }
  return null;
}

/** The note is the student's own words: trimmed, never rewritten. */
export function validateCompletion(note: string, url: string | undefined): { note: string; url: string | null } | { error: string } {
  const clean = note.replace(/\s+/g, " ").trim();
  if (clean.length < MIN_NOTE) return { error: "Tell us in a sentence what you did — that's what lets us use it on your CV." };
  if (clean.length > MAX_NOTE) return { error: `Keep it under ${MAX_NOTE} characters.` };
  const link = url?.trim() || null;
  if (link && !/^https:\/\/[^\s]+$/.test(link)) return { error: "Links must start with https://" };
  return { note: clean, url: link };
}

export async function planAction(supabase: SupabaseClient, userId: string, id: string) {
  if (!findAction(id)) return { error: "Unknown action." };
  const { data: prev } = await supabase.from("playbook_progress").select("status").eq("user_id", userId).eq("action_id", id).maybeSingle();
  if (prev?.status === "done") return { ok: true }; // never downgrade a done item
  const { error } = await supabase.from("playbook_progress").upsert({ user_id: userId, action_id: id, status: "planned", updated_at: new Date().toISOString() });
  return error ? { error: "Couldn't save that — try again." } : { ok: true };
}

export async function completeAction(supabase: SupabaseClient, userId: string, id: string, note: string, url: string | undefined) {
  const action = findAction(id);
  if (!action) return { error: "Unknown action." };
  const v = validateCompletion(note, url);
  if ("error" in v) return v;

  const { data: prev } = await supabase.from("playbook_progress").select("status").eq("user_id", userId).eq("action_id", id).maybeSingle();
  const up = await supabase.from("playbook_progress").upsert({
    user_id: userId, action_id: id, status: "done", evidence_note: v.note, evidence_url: v.url, updated_at: new Date().toISOString(),
  });
  if (up.error) return { error: "Couldn't save that — try again." };
  if (prev?.status === "done") return { award: null };

  // The only way a playbook item reaches tailoring: the student's own statement, stored as a confirmed fact.
  const fact = await supabase.from("confirmed_facts").insert({
    user_id: userId, claim: `${action.title}: ${v.note}${v.url ? ` (${v.url})` : ""}`, source: "user-stated",
  });
  if (fact.error) return { error: "Saved, but we couldn't add it to your facts — try again." };
  const award = await awardXP(supabase, userId, { type: "playbook_done", ref: id });
  return { award };
}
