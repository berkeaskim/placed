// Shared DOM helpers for the fillers. Every click goes through PlacedGuard.safeClick; every trusted (CDP) click is
// checked against the guard here and re-verified by the service worker at the exact point it will land.
(function (root) {
  const Guard = () => root.PlacedGuard;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
  const attrEsc = (s) => String(s).replace(/["\\]/g, "\\$&");
  const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
  let trustedReady = false; // set once the debugger is attached and the infobar has settled

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

  /** Attach chrome.debugger once, before anything is measured, and wait for the infobar to resize the page. */
  async function prepareTrusted() {
    const r = await send({ kind: "attach" });
    if (r && r.ok) await sleep(300);
    trustedReady = Boolean(r && r.ok);
    return trustedReady;
  }

  function nonce() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  /** A real (trusted) mouse click, only after checking what is actually under the pointer. */
  async function trustedClickOn(el) {
    if (!trustedReady || !el || Guard().isSubmitControl(el)) return false;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(150); // let scrolling settle before measuring
    const p = point(el);
    const hit = document.elementFromPoint(p.x, p.y);
    if (!hit || !(hit === el || el.contains(hit))) return false; // something else (overlay, banner, button) is on top
    if (Guard().isSubmitControl(hit)) return false;
    const n = nonce();
    el.setAttribute("data-placed-target", n); // the service worker refuses any point not inside this element
    try {
      const r = await send({ kind: "trustedClick", x: p.x, y: p.y, nonce: n });
      return Boolean(r && r.ok);
    } finally {
      el.removeAttribute("data-placed-target");
    }
  }

  /** Trusted typing, only into the intended input (or inside its widget shell) and never with control characters. */
  async function trustedType(text, intended, shell) {
    const a = document.activeElement;
    if (!trustedReady || !intended || !a || !(a === intended || (shell && shell.contains(a)))) return false;
    const clean = String(text == null ? "" : text).replace(CONTROL_CHARS, "").slice(0, 200);
    if (!clean) return false;
    const r = await send({ kind: "trustedType", text: clean });
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
    if (!scope) return null;
    const want = norm(label);
    const opts = [...scope.querySelectorAll(selector)];
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
   * Fallback when a trusted click/type is not possible: the field stays amber and, once the student opens THIS
   * dropdown, we pick the saved option. Options are searched only inside the field's own listbox (aria-controls /
   * aria-owns) or its shell. Not armed if the field already has a value; disarmed after the first pick, or as soon
   * as the field gets a value we did not set (the student chose something else).
   * Returns true when armed.
   */
  function armAutoPick({ input, scope, optionSelector, label, prefix, sourceLabel, hasValue }) {
    if (!input || !scope || !label) return false;
    if (hasValue && hasValue()) return false;
    const owned = () => {
      const id = input.getAttribute("aria-controls") || input.getAttribute("aria-owns");
      return id ? document.getElementById(id) : null;
    };
    let done = false;
    const stop = () => { done = true; obs.disconnect(); clearTimeout(timer); };
    const tryPick = () => {
      if (done) return;
      if (hasValue && hasValue()) return stop(); // the student picked something themselves
      const list = owned();
      const where = list || scope;
      if (input.getAttribute("aria-expanded") !== "true" && !where.querySelector(optionSelector)) return;
      const opt = findOption(where, optionSelector, label, prefix);
      if (!opt || Guard().isSubmitControl(opt)) return;
      stop();
      Guard().safeClick(opt);
      markPicked(input, sourceLabel);
    };
    const obs = new MutationObserver(tryPick);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    const timer = setTimeout(stop, 15 * 60_000);
    return true;
  }

  const api = { sleep, norm, attrEsc, setNative, uploadFile, send, prepareTrusted, trustedClickOn, trustedType, waitFor, findOption, markPicked, armAutoPick };
  root.PlacedDom = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
