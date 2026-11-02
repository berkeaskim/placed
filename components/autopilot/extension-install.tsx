"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { extensionStatus, outdatedNotice, SHIPPED_EXTENSION_VERSION } from "@/lib/autopilot/extension-version";
import { AppIcon, Group, Row, StatusDot, btnPrimary } from "@/components/ui/apple";

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

const steps = "list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-black/65 marker:text-black/40";
const code = "rounded bg-black/[0.05] px-1 py-px font-mono text-[12px]";

/** The install group on /autopilot/setup: one button, and the manual steps only while there is no store listing. */
export function ExtensionInstall() {
  const { state, version } = useAutopilotExtension();
  const store = env.autopilotStoreUrl;
  const badge =
    state === "installed" ? <span className="flex items-center gap-1.5"><StatusDot state="ok" />Installed</span>
      : state === "outdated" ? <span className="flex items-center gap-1.5"><StatusDot state="checking" />Update available</span>
      : state === "missing" ? <span className="flex items-center gap-1.5"><StatusDot state="fail" />Not installed</span>
      : <span className="flex items-center gap-1.5"><StatusDot state="unknown" />Checking</span>;
  return (
    <section id="extension" className="scroll-mt-20">
      <Group title="Chrome extension" footer="Autopilot fills the form through a small Chrome extension. It never presses Submit.">
        <Row icon={<AppIcon kind="chrome" />} title="Placed Autopilot" subtitle={version ? `Version ${version}` : "For Google Chrome"} trailing={badge} />
        <div className="px-4 py-3">
          {state === "installed" ? (
            <p className="text-[13px] text-black/65">You&apos;re set. Open a job, press <strong className="font-semibold text-black/85">Autopilot this application</strong>, then <strong className="font-semibold text-black/85">Open &amp; fill</strong>.</p>
          ) : state === "outdated" ? (
            <>
              <Outdated version={version} className="text-[13px] font-medium text-[#8A4200]" />
              {!store && (
                <ol className={`mt-2 ${steps}`}>
                  <li>Unzip the new <code className={code}>placed-autopilot.zip</code>.</li>
                  <li>In <code className={code}>chrome://extensions</code>, remove the old <strong>Placed Autopilot</strong>.</li>
                  <li>Click <strong>Load unpacked</strong> and choose the new <code className={code}>placed-autopilot</code> folder, then reload this page.</li>
                </ol>
              )}
            </>
          ) : store ? (
            <a href={store} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} min-h-10 px-5 text-[14px]`}>Add to Chrome</a>
          ) : (
            <div className="flex flex-col gap-3">
              <a href={ZIP} download className={`${btnPrimary} min-h-10 w-fit px-5 text-[14px]`}>Download the extension (.zip)</a>
              <ol className={steps}>
                <li>Unzip <code className={code}>placed-autopilot.zip</code>. You get a <code className={code}>placed-autopilot</code> folder.</li>
                <li>Open <code className={code}>chrome://extensions</code> (paste it in the address bar) and switch on <strong>Developer mode</strong>, top right.</li>
                <li>Click <strong>Load unpacked</strong> and choose the <code className={code}>placed-autopilot</code> folder.</li>
                <li>Come back to this page. The status above turns <strong>Installed</strong>.</li>
              </ol>
            </div>
          )}
        </div>
      </Group>
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
