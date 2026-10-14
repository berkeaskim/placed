// Shared DOM helpers for the fillers. Every click goes through PlacedGuard.safeClick; every trusted (CDP) click is
// checked against the guard at the exact point it will land.
(function (root) {
  const Guard = () => root.PlacedGuard;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
  const attrEsc = (s) => String(s).replace(/["\\]/g, "\\$&");

  function setNative(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function uploadFile(input, file) {
    if (!input || input.type !== "file" || !file) return false;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function point(el) {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + Math.min(20, r.width / 2)), y: Math.round(r.top + r.height / 2) };
  }

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? { ok: false } : res || { ok: false }));
      } catch {
        resolve({ ok: false });
      }
    });
  }

  /** A real (trusted) mouse click via chrome.debugger, only after checking what is actually under the pointer. */
  async function trustedClickOn(el) {
    if (!el || Guard().isSubmitControl(el)) return false;
    const { x, y } = point(el);
    await sleep(120); // let scrolling settle before measuring again
    const p = point(el);
    const hit = document.elementFromPoint(p.x, p.y);
    if (!hit || !(hit === el || el.contains(hit))) return false; // something else (overlay, banner, button) is on top
    if (Guard().isSubmitControl(hit)) return false;
    if (Math.abs(p.x - x) > 2 || Math.abs(p.y - y) > 2) await sleep(100);
    const r = await send({ kind: "trustedClick", x: p.x, y: p.y });
    return Boolean(r && r.ok);
  }

  async function trustedType(text) {
    const r = await send({ kind: "trustedType", text: String(text).slice(0, 200) });
    return Boolean(r && r.ok);
  }

  async function waitFor(fn, tries = 15, ms = 120) {
    for (let i = 0; i < tries; i++) {
      const v = fn();
      if (v) return v;
      await sleep(ms);
    }
    return null;
  }

  function findOption(scope, selector, label, prefix) {
    const want = norm(label);
    const opts = [...(scope || document).querySelectorAll(selector)];
    return opts.find((o) => norm(o.textContent) === want) || (prefix ? opts.find((o) => norm(o.textContent).startsWith(want)) : null) || null;
  }

  /** After a successful late pick, flip the field's overlay from amber to green. */
  function markPicked(el, sourceLabel) {
    const box = el && el.closest && el.closest("[data-placed]");
    if (!box) return;
    box.dataset.placed = "filled";
    const tag = box.querySelector(":scope > .placed-tag");
    if (tag) tag.textContent = `Placed · ${sourceLabel || "from your setup"}`;
  }

  /**
   * Fallback when a trusted click is not possible: the field stays amber and, as soon as the student opens this
   * dropdown themselves, we pick the right option for them. Only reacts while this field's combobox is expanded.
   */
  function armAutoPick({ input, scope, optionSelector, label, prefix, sourceLabel }) {
    if (!input || !label) return;
    let done = false;
    const isOpen = () => input.getAttribute("aria-expanded") === "true" || (scope && scope.querySelector(optionSelector));
    const tryPick = () => {
      if (done || !isOpen()) return;
      const owned = input.getAttribute("aria-controls") || input.getAttribute("aria-owns");
      const where = (owned && document.getElementById(owned)) || (scope && scope.querySelector(optionSelector) ? scope : document);
      const opt = findOption(where, optionSelector, label, prefix);
      if (!opt || Guard().isSubmitControl(opt)) return;
      done = true;
      obs.disconnect();
      Guard().safeClick(opt);
      markPicked(input, sourceLabel);
    };
    const obs = new MutationObserver(tryPick);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    setTimeout(() => obs.disconnect(), 15 * 60_000);
  }

  const api = { sleep, norm, attrEsc, setNative, uploadFile, send, trustedClickOn, trustedType, waitFor, findOption, markPicked, armAutoPick };
  root.PlacedDom = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
