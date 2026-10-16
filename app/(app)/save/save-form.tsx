"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { saveAccount } from "./actions";

export function SaveForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault(); // not `action=`: React resets the form after an action, wiping the email on a wrong password
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await saveAccount(fd);
          if (r?.error) setError(r.error);
        });
      }}
      className="space-y-3"
    >
      <Input aria-label="Your name" name="name" autoComplete="name" maxLength={80} placeholder="Your name" className="h-12 text-base" />
      <Input aria-label="Email address" name="email" type="email" autoComplete="email" placeholder="you@ucl.ac.uk" maxLength={254} required className="h-12 text-base" />
      <Input aria-label="Password" name="password" type="password" autoComplete="new-password" placeholder="Password (8+ characters)" minLength={8} maxLength={72} required className="h-12 text-base" />
      <button type="submit" className="btn-quest h-12 w-full disabled:opacity-50" disabled={pending}>
        {pending ? "Saving…" : "Save my account"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
