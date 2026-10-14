"use client";
import { useState, useTransition } from "react";
import { disconnectGmail, syncInbox, type SyncResult } from "@/app/(app)/tracker/inbox-actions";

const REASON: Record<Exclude<SyncResult, { ok: true }>["reason"], string> = {
  not_connected: "Connect Gmail first.",
  reconnect: "Google no longer lets Placed read your inbox. Reconnect Gmail to keep syncing.",
  failed: "Couldn't reach Gmail. Try again in a minute.",
};

export function InboxBanner({ connected, googleEmail, lastSynced, demo, flash, degraded = false }: {
  connected: boolean; googleEmail: string | null; lastSynced: string | null; demo: boolean; flash: string | null; degraded?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(flash);
  const sync = () => start(async () => {
    const r = await syncInbox();
    setMsg(r.ok ? `Checked ${r.scanned} emails: ${r.moved} card${r.moved === 1 ? "" : "s"} moved, ${r.suggested} to review.` : REASON[r.reason]);
  });
  return (
    <section aria-label="Inbox" className="card-quest flex flex-wrap items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="text-sm font-bold">Inbox Agent</h2>
        <p className="text-xs text-muted-foreground">
          {demo ? "Demo inbox: 8 sample emails." : degraded ? "Couldn't check your Gmail connection. Refresh to try again." : connected
            ? `Reading ${googleEmail} (read-only).${lastSynced ? ` Last checked ${new Date(lastSynced).toLocaleString("en-GB", { timeZone: "Europe/London" })}.` : ""}`
            : "Connect Gmail and Placed moves your cards when employers email you. Read-only; Placed never sends anything."}
        </p>
        {msg && <p role="status" className="mt-1 text-xs font-semibold">{msg}</p>}
      </div>
      {demo || connected ? (
        <>
          <button type="button" onClick={sync} disabled={pending} className="min-h-11 rounded-full bg-foreground px-4 text-sm font-bold text-background">
            {pending ? "Checking…" : "Sync inbox"}
          </button>
          {connected && (
            <button type="button" onClick={() => start(() => disconnectGmail())} className="min-h-11 text-sm font-semibold underline">Disconnect</button>
          )}
        </>
      ) : degraded ? null : (
        <a href="/api/gmail/connect" className="min-h-11 rounded-full bg-foreground px-4 py-3 text-sm font-bold text-background no-underline">Connect Gmail</a>
      )}
    </section>
  );
}
