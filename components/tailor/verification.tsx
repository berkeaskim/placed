import type { CaughtNumber, RevertedChange, VerificationState } from "@/lib/tailor/view";
import { AlertIcon, CheckIcon, ShieldCheckIcon, UndoIcon } from "./icons";

/** Spec §8.4: the verification badge. It reads "Every claim traced" once anything unsupported has been reverted. */
export function VerificationBadge({ state, text }: { state: VerificationState; text: string }) {
  const bad = state === "blocked";
  return (
    <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${bad ? "bg-[#FDECEA] text-[#B42318]" : "bg-[#E3F6EE] text-[#0B6B49]"}`} role="status">
      {bad ? <AlertIcon size={18} className="shrink-0" /> : <ShieldCheckIcon size={18} className="shrink-0" />}{text}
    </p>
  );
}

/** B6 "Caught it": what the check stopped, struck through, with the reason. */
export function CaughtList({ reverted, caught, confirmed, onConfirm, onUndo }: {
  reverted: RevertedChange[]; caught: CaughtNumber[]; confirmed: Map<string, string>;
  onConfirm: (c: CaughtNumber) => void; onUndo: (bulletId: string) => void;
}) {
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
          const mine = confirmed.get(r.bulletId);
          return (
            <li key={`${r.bulletId}-${r.attempted}`} className="flex flex-col gap-1 rounded-xl bg-white p-2.5">
              {mine ? (
                <>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B6B49]"><CheckIcon size={12} />Confirmed by you</span>
                  <span className="font-semibold">{mine}</span>
                  <span className="text-xs text-muted-foreground">You told us this is accurate, so it&apos;s saved as your own statement.</span>
                  <button type="button" onClick={() => onUndo(r.bulletId)} className="mt-1 inline-flex min-h-11 items-center gap-1 self-start rounded-xl border-2 border-[#E6E6EF] px-3 text-xs font-bold hover:bg-[#F6F6FA]">
                    <UndoIcon size={12} />Undo
                  </button>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground line-through decoration-[#B42318] decoration-2"><span className="sr-only">Removed: </span>{r.attempted}</span>
                  <span className="text-xs font-semibold text-[#B42318]">{r.reason}</span>
                  {r.restored && <span className="text-xs text-[#4A4A57]">Now reads: &ldquo;{r.restored}&rdquo;</span>}
                  {c && (
                    <button type="button" onClick={() => onConfirm(c)} className="mt-1 min-h-11 self-start rounded-xl border-2 border-[#C2410C]/40 px-3 text-xs font-bold text-[#9A3412] hover:bg-[#FFF4EC]">
                      Is {c.claim} real? Confirm this number
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
