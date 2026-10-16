"use client";
import { useActionState, useState } from "react";
import { deleteMyData, type DeleteState } from "./actions";
import { isDeleteConfirmed } from "@/lib/settings/confirm";

export function DeleteDataForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteMyData, null);
  const [value, setValue] = useState("");
  const confirmed = isDeleteConfirmed(value);
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        This permanently deletes your CVs, scores, tailored CVs, applications, XP, badges and saved feedback from this computer, and restarts
        onboarding. Your AI settings and the job list stay. This can&apos;t be undone.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-semibold">
          Type DELETE to confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="confirm-help"
          className="min-h-11 rounded-[14px] border-2 border-border bg-background px-3 py-2"
        />
        <span id="confirm-help" className="text-xs text-muted-foreground">
          The button below unlocks once you type DELETE in capitals.
        </span>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!confirmed || pending}
        className="min-h-11 rounded-[14px] border-2 border-destructive px-4 py-3 font-bold text-destructive disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Resetting..." : "Reset all local data"}
      </button>
    </form>
  );
}
