// The one hard rule: Placed Autopilot never submits. Every click in the extension goes through safeClick,
// and every trusted (CDP) click target is checked with isSubmitControl first.
// This file holds the ONLY raw .click() call in the extension.
(function (root) {
  // JS-driven submit buttons are not always type=submit: Lever's is <button type="button" id="btn-submit">,
  // Ashby has no <form> and a typeless button with an onClick. So button-like elements are also judged by words and hooks.
  const SUBMIT_WORDS = /\b(submit|apply|send)\b/i;
  const SUBMIT_HOOK = /submit/i;
  const attr = (el, k) => (el.getAttribute ? el.getAttribute(k) : null);
  const str = (v) => (v == null ? "" : typeof v === "object" && "baseVal" in v ? String(v.baseVal) : String(v));

  function isButtonLike(el, tag, type) {
    if (tag === "BUTTON" || tag === "A") return true;
    if (tag === "INPUT" && (type === "button" || type === "submit" || type === "image" || type === "reset")) return true;
    return String(attr(el, "role") || "").toLowerCase() === "button";
  }

  function isSubmitControl(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toUpperCase();
    const type = String(el.type || attr(el, "type") || "").toLowerCase();
    if (tag === "INPUT" && (type === "submit" || type === "image")) return true;
    if (tag === "BUTTON" && (type === "submit" || (!type && el.form))) return true;
    if (isButtonLike(el, tag, type)) {
      const words = [str(el.textContent).slice(0, 200), str(attr(el, "value")), str(attr(el, "aria-label"))].join(" ");
      if (SUBMIT_WORDS.test(words)) return true;
      if (SUBMIT_HOOK.test(`${str(el.id)} ${str(el.className)} ${str(attr(el, "name"))}`)) return true;
    }
    const btn = el.closest ? el.closest("button, [role=button]") : null;
    return btn && btn !== el ? isSubmitControl(btn) : false;
  }

  function safeClick(el) {
    if (!el) throw new Error("Placed Autopilot: nothing to click.");
    if (isSubmitControl(el)) throw new Error("Placed Autopilot never submits: refused to click a submit control.");
    el.click();
  }

  const api = { isSubmitControl, safeClick };
  root.PlacedGuard = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
