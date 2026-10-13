import type { CaughtNumber, RevertedChange, VerificationState } from "@/lib/tailor/view";
import { AlertIcon, ShieldCheckIcon } from "./icons";

/** Spec §8.4: the verification badge. It reads "Every claim traced" once anything unsupported has been reverted. */
export function VerificationBadge({ state }: { state: VerificationState }) {
  if (state === "blocked") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-[#FDECEA] px-3 py-2.5 text-sm font-bold text-[#B42318]" role="status">
        <AlertIcon size={18} />Some lines aren&apos;t supported by your CV yet. Fix the flagged lines to download.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-xl bg-[#E3F6EE] px-3 py-2.5 text-sm font-bold text-[#0B6B49]" role="status">
      <ShieldCheckIcon size={18} />Every claim traced to your original CV
    </p>
  );
}

/** B6 "Caught it": what the check stopped, struck through, with the reason. */
export function CaughtList({ reverted, caught, onConfirm }: { reverted: RevertedChange[]; caught: CaughtNumber[]; onConfirm: (c: CaughtNumber) => void }) {
  if (!reverted.length) return null;
  const byId = new Map(caught.map((c) => [c.bulletId, c]));
  return (
    <section aria-labelledby="caught" className="flex flex-col gap-2 rounded-2xl border-2 border-[#FFD9A8] bg-[#FFF8EE] p-3.5">
      <h3 id="caught" className="flex items-center gap-1.5 text-sm font-extrabold text-[#7A4100]">
        <AlertIcon size={16} />Caught it: {reverted.length === 1 ? "1 line" : `${reverted.length} lines`} your CV doesn&apos;t support
      </h3>
      <p className="text-xs text-[#7A4100]">The AI suggested these. We checked every claim against your CV and put your own wording back.</p>
      <ul className="flex flex-col gap-2 text-sm">
        {reverted.map((r) => {
          const c = byId.get(r.bulletId);
          return (
            <li key={`${r.bulletId}-${r.attempted}`} className="flex flex-col gap-1 rounded-xl bg-white p-2.5">
              <span className="text-muted-foreground line-through decoration-[#B42318] decoration-2"><span className="sr-only">Removed: </span>{r.attempted}</span>
              <span className="text-xs font-semibold text-[#B42318]">{r.reason}</span>
              {r.restored && <span className="text-xs text-[#4A4A57]">Now reads: &ldquo;{r.restored}&rdquo;</span>}
              {c && (
                <button type="button" onClick={() => onConfirm(c)} className="mt-1 min-h-9 self-start rounded-xl border-2 border-[#C2410C]/40 px-3 text-xs font-bold text-[#9A3412] hover:bg-[#FFF4EC]">
                  Is {c.claim} real? Confirm this number
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
