"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartButton } from "@/components/start-button";
import { signInWithEmail, signInWithGoogle, signInWithPassword } from "./actions";

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

/** `initialError`: friendly copy for a known /login?error= code (page.tsx maps it; never the raw query string). */
export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const [sent, setSent] = useState(false);
  const [magic, setMagic] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, start] = useTransition();

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card className="card-quest w-full max-w-sm">
        <CardHeader>
          {/* The only <h1> on the page; Tailwind preflight resets h1 size/weight so CardTitle's styles still apply. */}
          <CardTitle className="text-2xl font-extrabold">
            <h1>Welcome to Placed</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <MailIcon />
              Check your inbox — we sent you a magic link.
            </p>
          ) : magic ? (
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
              <Input aria-label="Email address" name="email" type="email" autoComplete="email" placeholder="you@ucl.ac.uk" maxLength={254} required className="h-12 text-base" />
              <button type="submit" className="btn-quest h-12 w-full disabled:opacity-50" disabled={pending}>
                Email me a magic link
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault(); // not `action=`: React resets the form after an action, wiping the email on a wrong password
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  setError(null);
                  const r = await signInWithPassword(fd);
                  if (r?.error) setError(r.error);
                });
              }}
              className="space-y-3"
            >
              <Input aria-label="Email address" name="email" type="email" autoComplete="email" placeholder="you@ucl.ac.uk" maxLength={254} required className="h-12 text-base" />
              <Input aria-label="Password" name="password" type="password" autoComplete="current-password" placeholder="Password" maxLength={72} required className="h-12 text-base" />
              <button type="submit" className="btn-quest h-12 w-full disabled:opacity-50" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
          {!sent && (
            <button
              type="button"
              className="w-full text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setError(null);
                setMagic((m) => !m);
              }}
            >
              {magic ? "Sign in with a password instead" : "Email me a magic link instead"}
            </button>
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
          <div className="flex items-center justify-center gap-1 border-t pt-4 text-sm text-muted-foreground">
            New here?
            <StartButton className="font-bold text-primary underline-offset-4 hover:underline">Get started — no sign-up needed</StartButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
