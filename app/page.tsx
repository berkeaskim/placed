import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">For UK students</p>
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
        Get <span className="text-primary">placed.</span>
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Find internships that actually fit you, see how your CV scores against what recruiters really
        look for, and tailor it in one click — without making anything up.
      </p>
      <Link
        href="/login"
        className="btn-quest inline-flex h-12 min-w-44 items-center justify-center px-8 text-base"
      >
        Get started
      </Link>
      <p className="text-sm text-muted-foreground">We never apply on your behalf. You stay in control.</p>
    </main>
  );
}
