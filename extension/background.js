// Trusted input for widgets that ignore synthetic events (Greenhouse react-select, Ashby/Lever autocompletes).
// The service worker never fetches the claim (R5: that runs in the content script, from the employer origin).
// It only turns "click at (x, y)" / "type this text" into real input, and only for our own content scripts on the
// allow-listed ATS pages. The content script has already checked the point with PlacedGuard before asking.
const ALLOWED = ["https://job-boards.greenhouse.io", "https://boards.greenhouse.io", "https://jobs.ashbyhq.com", "https://jobs.lever.co"];
const attached = new Set();

async function ensureAttached(tabId) {
  if (attached.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, "1.3");
  attached.add(tabId);
}
chrome.debugger.onDetach.addListener((src) => attached.delete(src.tabId));

function fromAllowedPage(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.tab.id == null) return false;
  try {
    return ALLOWED.includes(new URL(sender.url || sender.tab.url || "").origin);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || !fromAllowedPage(sender)) return false;
  const tabId = sender.tab.id;
  const target = { tabId };
  (async () => {
    try {
      if (msg.kind === "trustedClick") {
        if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y) || msg.x < 0 || msg.y < 0) throw new Error("bad point");
        await ensureAttached(tabId);
        const base = { x: msg.x, y: msg.y, button: "left", clickCount: 1 };
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mouseMoved", x: msg.x, y: msg.y });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { ...base, type: "mousePressed" });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { ...base, type: "mouseReleased" });
        reply({ ok: true });
      } else if (msg.kind === "trustedType") {
        if (typeof msg.text !== "string" || !msg.text || msg.text.length > 200) throw new Error("bad text");
        await ensureAttached(tabId);
        await chrome.debugger.sendCommand(target, "Input.insertText", { text: msg.text });
        reply({ ok: true });
      } else if (msg.kind === "detach") {
        if (attached.has(tabId)) await chrome.debugger.detach(target);
        attached.delete(tabId);
        reply({ ok: true });
      } else {
        reply({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      reply({ ok: false, error: String(e) });
    }
  })();
  return true;
});
