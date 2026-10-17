"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { extensionStatus, outdatedNotice, SHIPPED_EXTENSION_VERSION } from "@/lib/autopilot/extension-version";

export type ExtensionState = "checking" | "installed" | "outdated" | "missing";
export type ExtensionInfo = { state: ExtensionState; version: string | null };

// extension/hello.js stamps <html data-placed-autopilot="<version>"> on the Placed site once the extension is installed.
// An install older than the version this build ships (extension/manifest.json) is "outdated".
export function useAutopilotExtension(): ExtensionInfo {
  const [info, setInfo] = useState<ExtensionInfo>({ state: "checking", version: null });
  useEffect(() => {
    const root = document.documentElement;
    const check = (final: boolean) => {
      const version = root.getAttribute("data-placed-autopilot");
      if (version != null) setInfo({ state: extensionStatus(version), version });
      else if (final) setInfo({ state: "missing", version: null });
    };
    const obs = new MutationObserver(() => check(false));
    obs.observe(root, { attributes: true, attributeFilter: ["data-placed-autopilot"] });
    const now = setTimeout(() => check(false), 0);
    const t = setTimeout(() => check(true), 1500);
    return () => { obs.disconnect(); clearTimeout(now); clearTimeout(t); };
  }, []);
  return info;
}

const ZIP = "/placed-autopilot.zip";
const CTA = "Download the new version";

/** "Your Placed extension is out of date (a → b)." with "Download the new version" as the download link. */
function Outdated({ version, className }: { version: string | null; className?: string }) {
  const notice = outdatedNotice(version ?? "", SHIPPED_EXTENSION_VERSION);
  const lead = notice.endsWith(CTA) ? notice.slice(0, -CTA.length) : `${notice} `;
  const store = env.autopilotStoreUrl;
  return (
    <p role="status" className={className}>
      {lead}
      {store ? (
        <a href={store} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#5B3DF5] underline">{CTA}</a>
      ) : (
        <a href={ZIP} download className="font-semibold text-[#5B3DF5] underline">{CTA}</a>
      )}
      .
    </p>
  );
}

/** The full install card on /autopilot/setup: one button, and the manual steps only while there is no store listing. */
export function ExtensionInstall() {
  const { state, version } = useAutopilotExtension();
  const store = env.autopilotStoreUrl;
  return (
    <section id="extension" className="scroll-mt-20 rounded-2xl border border-[#E8E8EE] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">Get the Chrome extension</h2>
        {state === "installed" && <span className="rounded-full bg-[#E7F8EE] px-3 py-1 text-xs font-bold text-[#0F6B3A]">✓ Installed</span>}
        {state === "outdated" && <span className="rounded-full bg-[#FFF3E0] px-3 py-1 text-xs font-bold text-[#7A4100]">Update available</span>}
        {state === "missing" && <span className="rounded-full bg-[#FFF3E0] px-3 py-1 text-xs font-bold text-[#7A4100]">Not installed yet</span>}
      </div>
      <p className="mt-1 text-[14px] text-[#4A4A57]">Autopilot fills the form through a small Chrome extension. It never presses Submit.</p>

      {state === "installed" ? (
        <p className="mt-3 text-[14px] text-[#4A4A57]">You&apos;re set. Open a job, press <strong>Autopilot this application</strong>, then <strong>Open &amp; fill</strong>.</p>
      ) : state === "outdated" ? (
        <>
          <Outdated version={version} className="mt-3 text-[14px] font-semibold text-[#7A4100]" />
          {!store && (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] text-[#4A4A57]">
              <li>Unzip the new <code>placed-autopilot.zip</code>.</li>
              <li>In <code>chrome://extensions</code>, remove the old <strong>Placed Autopilot</strong>.</li>
              <li>Click <strong>Load unpacked</strong> and choose the new <code>placed-autopilot</code> folder, then reload this page.</li>
            </ol>
          )}
        </>
      ) : store ? (
        <a href={store} target="_blank" rel="noopener noreferrer" className="btn-quest mt-4 inline-flex min-h-12 items-center px-5 py-3">Add to Chrome →</a>
      ) : (
        <>
          <a href={ZIP} download className="btn-quest mt-4 inline-flex min-h-12 items-center px-5 py-3">Download the extension (.zip)</a>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[14px] text-[#4A4A57]">
            <li>Unzip <code>placed-autopilot.zip</code>. You get a <code>placed-autopilot</code> folder.</li>
            <li>Open <code>chrome://extensions</code> (paste it in the address bar) and switch on <strong>Developer mode</strong>, top right.</li>
            <li>Click <strong>Load unpacked</strong> and choose the <code>placed-autopilot</code> folder.</li>
            <li>Come back to this page. The badge above turns <strong>✓ Installed</strong>.</li>
          </ol>
        </>
      )}
    </section>
  );
}

/** One line under "Open & fill": quiet when installed, a clear pointer to the install card when not. */
export function ExtensionHint() {
  const { state, version } = useAutopilotExtension();
  if (state === "installed") return <p className="text-xs text-muted-foreground">Autopilot extension installed ✓. Placed never presses Submit.</p>;
  if (state === "outdated") return <Outdated version={version} className="text-xs font-semibold text-[#7A4100]" />;
  return (
    <p className="text-xs text-muted-foreground">
      Needs the Placed Autopilot Chrome extension. Placed never presses Submit.{" "}
      <Link href="/autopilot/setup#extension" className="font-semibold text-[#5B3DF5]">
        {state === "missing" ? "Install the extension (1 min) →" : "Install the extension"}
      </Link>
    </p>
  );
}
