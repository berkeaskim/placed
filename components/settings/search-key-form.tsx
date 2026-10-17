"use client";
import { useActionState } from "react";
import { saveSearchKey, type SearchKeyState } from "@/app/(app)/settings/actions";

/** `last4` is all the page sends down: the key itself never leaves the server. */
export function SearchKeyForm({ source, last4 }: { source: "env" | "saved" | null; last4: string | null }) {
  const [state, action, pending] = useActionState<SearchKeyState, FormData>(saveSearchKey, null);
  if (source === "env") return <p className="text-sm text-muted-foreground">Using SERPER_API_KEY from your environment (…{last4}).</p>;
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="serper-key" className="text-sm font-semibold">Serper API key</label>
      <div className="flex flex-wrap gap-2">
        <input id="serper-key" name="key" type="password" autoComplete="off" spellCheck={false} maxLength={400}
          placeholder={source === "saved" ? `Saved (…${last4}). Leave empty and save to remove.` : "Paste your key"}
          className="min-h-11 min-w-0 flex-1 rounded-[12px] border px-3 text-sm" />
        <button type="submit" disabled={pending} className="min-h-11 rounded-[12px] border-2 border-border bg-white px-4 text-sm font-bold transition-colors hover:bg-muted">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {state?.ok === false ? <span className="font-semibold text-[#B42318]">{state.error}</span>
          : state?.ok ? state.message
          : <>Free key at <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="font-semibold">serper.dev</a>. Searches send the company, role and your university to Serper; nothing else leaves this computer.</>}
      </p>
    </form>
  );
}
