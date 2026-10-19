"use client";
import { useOptimistic, useTransition } from "react";
import { setAccepted, setChecklistItem } from "@/app/(app)/tracker/actions";
import { checklistProgress, PLACEMENT_CHECKLIST, type Checklist } from "@/lib/tracker/placement";

/** Shown above the board once a placement offer is accepted: what's left before it starts. */
export function PlacementSecured({ appId, company, title, checklist, othersOpen }: {
  appId: string; company: string; title: string; checklist: Checklist | null; othersOpen: { id: string; company: string; title: string }[];
}) {
  const [pending, start] = useTransition();
  const [items, setItem] = useOptimistic(checklist ?? {}, (s: Checklist, [k, v]: [string, boolean]) => ({ ...s, [k]: v }));
  const { done, total } = checklistProgress(items);
  return (
    <section aria-labelledby="placement-secured-h" className="card-quest flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="placement-secured-h" className="text-lg font-extrabold tracking-tight">Placement secured: {company} 🎉</h2>
        <span className="text-xs font-semibold text-muted-foreground">{done}/{total} steps done</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {title}. Placed has stopped suggesting placements. Graduate schemes for after your placement open from September of your placement year.
      </p>
      <ul className="flex flex-col gap-2">
        {PLACEMENT_CHECKLIST.map((c) => (
          <li key={c.key}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[#5B3DF5]" checked={items[c.key] === true} disabled={pending}
                onChange={(e) => { const v = e.target.checked; start(async () => { setItem([c.key, v]); await setChecklistItem(appId, c.key, v); }); }} />
              <span>
                <span className="font-semibold">{c.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.key === "withdraw" && othersOpen.length
                    ? `Still open: ${othersOpen.map((o) => o.company || o.title).join(", ")}.`
                    : c.hint}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setAccepted(appId, false); })}
        className="self-start text-xs font-semibold text-muted-foreground underline underline-offset-2">
        I haven&apos;t accepted it after all
      </button>
    </section>
  );
}

/** On a placement offer card: mark it accepted. */
export function AcceptOfferButton({ appId }: { appId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await setAccepted(appId, true); })}
      className="rounded-xl bg-[#E8F6EE] px-2.5 py-2 text-left text-xs font-bold text-[#1F7A47] disabled:opacity-60">
      {pending ? "Saving…" : "I've accepted this placement ✓"}
    </button>
  );
}
