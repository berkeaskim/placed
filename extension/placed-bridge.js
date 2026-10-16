// Runs on the Placed app only. Two jobs:
//  1. Tell the page the extension is installed (data-placed-extension on <html>), so /profile/linkedin can offer
//     the one-click LinkedIn read.
//  2. Pass a LinkedIn scoring ticket from the page to the service worker. Only messages from this same window and
//     origin are accepted, and the service worker re-checks the origin against PLACED_ORIGINS.
(function () {
  const ARM = "placed:linkedin-arm";
  const ARMED = "placed:linkedin-armed";
  const FAILED = "placed:linkedin-failed";
  const TOKEN_RE = /^[A-Za-z0-9_-]{20,400}\.[A-Za-z0-9_-]{43}$/;
  const origins = globalThis.PLACED_ORIGINS || [];
  if (!origins.includes(location.origin)) return;

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
    chrome.runtime.sendMessage({ kind: "liArm", token: d.token }, (r) => {
      const ok = !chrome.runtime.lastError && Boolean(r && r.ok);
      window.postMessage({ type: ARMED, ok }, location.origin);
    });
  });
})();
