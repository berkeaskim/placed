import Link from "next/link";

/** Shown to guest (anonymous) users on every app page: their work only survives on this browser until they save. */
export function GuestBanner() {
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b bg-[#F8F7FF] px-4 py-2.5 text-sm font-semibold text-[#3A20C4]">
      <span>You&apos;re using Placed as a guest. Save your account so you don&apos;t lose your progress.</span>
      <Link href="/save" className="btn-quest inline-flex h-9 items-center px-4 text-sm">Save my account</Link>
    </div>
  );
}
