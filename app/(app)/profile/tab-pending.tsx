"use client";

import { useLinkStatus } from "next/link";

/** A small spinner inside a profile tab while its page is still loading, so a click visibly registers. */
export function TabPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" aria-label="Loading" className="ml-2 inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
  ) : null;
}
