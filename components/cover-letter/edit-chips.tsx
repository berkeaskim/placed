"use client";
import type { EditKind } from "@/lib/cover-letter/edit";

export const EDIT_LABELS: Record<Exclude<EditKind, "free">, string> = {
  shorter: "Make it shorter",
  remove_flag: "Remove the claim to check",
  add_close: "Add a closing paragraph",
  more_formal: "Make it more formal",
};

/** One-tap edits under the finished letter. "Remove the claim to check" appears only while something is flagged. */
export function EditChips({ flagged, disabled, onEdit }: { flagged: boolean; disabled: boolean; onEdit: (kind: Exclude<EditKind, "free">, label: string) => void }) {
  const kinds = (Object.keys(EDIT_LABELS) as Exclude<EditKind, "free">[]).filter((k) => k !== "remove_flag" || flagged);
  return (
    <div className="actchips" role="group" aria-label="Quick edits">
      {kinds.map((k, i) => (
        <button key={k} type="button" className="act" disabled={disabled} style={{ animationDelay: `${i * 70}ms` }} onClick={() => onEdit(k, EDIT_LABELS[k])}>
          {EDIT_LABELS[k]}
        </button>
      ))}
    </div>
  );
}
