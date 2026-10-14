/**
 * Right after an upload, uploadCv's after() is already scoring the active CV for the target sector. If the profile
 * page scored it too, a fresh CV would cost two live judge calls (the unique (cv_id, sector) upsert only dedupes the
 * row, not the call). So for this short window the page shows "Scoring your CV…" instead; after it, a missing
 * score (e.g. the background run failed) is scored on the page as before.
 */
export const UPLOAD_SCORING_GRACE_MS = 60_000;

export function uploadScoringInFlight(i: { uploadedAt: string | null; now?: number; sector: string; target: string | null }): boolean {
  if (!i.uploadedAt || i.target !== i.sector) return false;
  const t = Date.parse(i.uploadedAt);
  if (Number.isNaN(t)) return false;
  const age = (i.now ?? Date.now()) - t;
  return age > -UPLOAD_SCORING_GRACE_MS && age < UPLOAD_SCORING_GRACE_MS;
}
