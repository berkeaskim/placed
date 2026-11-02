"use client";
import { useActionState } from "react";
import { saveSearchKey, type SearchKeyState } from "@/app/(app)/settings/actions";
import { FieldRow, Note, Row, btn, field } from "@/components/ui/apple";

/** `last4` is all the page sends down: the key itself never leaves the server. */
export function SearchKeyForm({ source, last4 }: { source: "env" | "saved" | null; last4: string | null }) {
  const [state, action, pending] = useActionState<SearchKeyState, FormData>(saveSearchKey, null);
  if (source === "env") return <Row title="Serper API key" subtitle="Set by SERPER_API_KEY in your environment" trailing={<span className="font-mono">••••{last4}</span>} />;
  return (
    <form action={action}>
      <FieldRow
        label="Serper API key"
        htmlFor="serper-key"
        hint={
          state?.ok === false ? <Note tone="error">{state.error}</Note>
            : state?.ok ? <Note tone="ok">{state.message}</Note>
            : <>Free at <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="font-medium text-[#5B3DF5] hover:underline">serper.dev</a>.</>
        }
      >
        <input id="serper-key" name="key" type="password" autoComplete="off" spellCheck={false} maxLength={400}
          placeholder={source === "saved" ? `Saved ••••${last4} · empty + Save removes it` : "Paste your key"} className={`${field} font-mono`} />
        <button type="submit" disabled={pending} className={`${btn} shrink-0`}>{pending ? "Saving…" : "Save"}</button>
      </FieldRow>
    </form>
  );
}
