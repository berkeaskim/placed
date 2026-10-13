"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithEmail, signInWithGoogle } from "./actions";

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function LoginPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card className="card-quest w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold">Welcome to Placed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <MailIcon />
              Check your inbox — we sent you a magic link.
            </p>
          ) : (
            <form
              action={(fd) =>
                start(async () => {
                  setError(null);
                  const r = await signInWithEmail(fd);
                  if (r?.error) setError(r.error);
                  else setSent(true);
                })
              }
              className="space-y-3"
            >
              <Input name="email" type="email" placeholder="you@ucl.ac.uk" required className="h-12 text-base" />
              <button type="submit" className="btn-quest h-12 w-full disabled:opacity-50" disabled={pending}>
                Email me a magic link
              </button>
            </form>
          )}
          <button
            type="button"
            disabled={pending}
            className="h-12 w-full rounded-[14px] border-2 border-border bg-white font-bold transition-colors hover:bg-muted disabled:opacity-50"
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await signInWithGoogle();
                if (r?.error) setError(r.error);
              })
            }
          >
            Continue with Google
          </button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
