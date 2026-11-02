// Runs on every localhost / 127.0.0.1 page, at document_start. Three jobs:
//  0. When the page is the Placed app (it renders <meta name="placed-app">), tell the service worker, which remembers
//     this origin (loopback only) and claims Autopilot packs from it first.
// The rest on any loopback origin, not just the ports in config.js: the app runs on :3000 in dev, :3917 as the Mac
// app, and anywhere else a worktree puts it, and an old unpacked copy must not lock the LinkedIn read to one port.
//  1. Tell the page the extension is installed (data-placed-extension on <html>), so /profile/linkedin can offer
//     the one-click LinkedIn read.
//  2. Pass a LinkedIn scoring ticket from the page to the service worker. Only messages from this same window and
//     origin, on a page that renders the Placed marker, are accepted; the service worker re-checks the origin is loopback.
(function () {
  const ARM = "placed:linkedin-arm";
  const ARMED = "placed:linkedin-armed";
  const FAILED = "placed:linkedin-failed";
  const TOKEN_RE = /^[A-Za-z0-9_-]{20,400}\.[A-Za-z0-9_-]{43}$/;
  const MARKER = 'meta[name="placed-app"]';
  // Reported on load AND whenever this tab becomes visible or focused: with two Placed apps on loopback (another
  // worktree on :3001), the tab the student is using, where Open & fill gets pressed, must be the one remembered.
  // The worker skips unchanged writes.
  const report = () => {
    if (!document.querySelector(MARKER)) return;
    try { chrome.runtime.sendMessage({ kind: "placedSeen" }, () => void chrome.runtime.lastError); } catch { /* extension reloaded */ }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", report, { once: true });
  else report();
  window.addEventListener("load", report, { once: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") report(); });
  window.addEventListener("focus", report);

  if (!globalThis.PlacedOrigins.isLoopbackOrigin(location.origin)) return;

  document.documentElement.dataset.placedExtension = chrome.runtime.getManifest().version;

  // The service worker reports a failed LinkedIn read (e.g. the name doesn't match the CV) so the page can stop waiting.
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id || sender.tab || !msg || msg.kind !== "liFailed") return;
    window.postMessage({ type: FAILED, error: String(msg.error || "").slice(0, 300) }, location.origin);
  });

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.type !== ARM || typeof d.token !== "string" || !TOKEN_RE.test(d.token)) return;
    if (!document.querySelector(MARKER)) return;
    chrome.runtime.sendMessage({ kind: "liArm", token: d.token }, (r) => {
      const ok = !chrome.runtime.lastError && Boolean(r && r.ok);
      window.postMessage({ type: ARMED, ok }, location.origin);
    });
  });
})();
