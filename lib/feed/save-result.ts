import type { AwardResult } from "@/lib/gamify/core";

export type SaveResult = { ok: boolean; award: AwardResult | null; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

export const SAVE_FAILED = "Couldn't save — try again";

/** ok=false only when the save itself failed; a missing award (duplicate / daily cap / XP error) is still a successful save. */
export function toSaveResult(upsertFailed: boolean, award: AwardResult | null): SaveResult {
  return upsertFailed ? { ok: false, award: null, error: SAVE_FAILED } : { ok: true, award };
}
