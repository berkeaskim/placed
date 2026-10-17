// Aurora: the presentation layer around a fill. It never fills, clicks or submits anything itself.
//  - A shadow-DOM overlay on <html>: edge aurora, a flowing ring that follows the active field, the words blur-in
//    layer, and the glass card (orb, status, n/N, progress, finish actions, the student's close button).
//  - Page-side state through overlay.css: data-placed-glow (halo on the active field), data-placed-ring (calm green /
//    amber ring once settled, keyed on the wrapper's data-placed), data-placed-typing (hides the real text while the
//    words layer draws it), .placed-tag badges and .placed-submit-hint.
// Everything here is pointer-events:none except the card, so trusted-click hit tests see the page, not the overlay.
(function (root) {
  const SPRING = "linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.281 6.7%, 0.723 13.6%, 0.861 16.4%, 0.938 19.2%, 0.981 22.5%, 0.997 26.4%, 1.003 31.1%, 1)";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const TEXT_TYPES = new Set(["", "text", "email", "tel", "url", "search", "number"]);
  const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer { position: fixed; inset: 0; pointer-events: none; font: 15px/1.47 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1d1d1f; -webkit-font-smoothing: antialiased; }
.edge { position: fixed; inset: 0; pointer-events: none; opacity: 0; transition: opacity .9s; overflow: hidden; }
.edge.on { opacity: 1; }
.edge i { position: absolute; border-radius: 50%; filter: blur(42px); opacity: .7; animation: drift 6s ease-in-out infinite alternate; }
.edge i:nth-child(1) { width: 55vw; height: 120px; left: -10vw; top: -80px; background: #7B61FF; }
.edge i:nth-child(2) { width: 50vw; height: 120px; right: -10vw; top: -80px; background: #FF6BD6; animation-delay: -2s; }
.edge i:nth-child(3) { width: 120px; height: 60vh; right: -80px; top: 20vh; background: #FF9F45; animation-delay: -4s; }
.edge i:nth-child(4) { width: 60vw; height: 120px; left: 20vw; bottom: -80px; background: #3CC8FF; animation-delay: -1s; }
.edge i:nth-child(5) { width: 120px; height: 60vh; left: -80px; top: 30vh; background: #FF6BD6; animation-delay: -3s; }
@keyframes drift { to { transform: translate(4vw, 1vh) scale(1.08); } }

.ring { position: fixed; left: 0; top: 0; width: 0; height: 0; pointer-events: none; padding: 1.5px; border-radius: 12px; opacity: 0; transition: opacity .3s;
  background: linear-gradient(90deg, #7B61FF, #FF6BD6, #FF9F45, #3CC8FF, #7B61FF); background-size: 300% 100%;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
  animation: flow 1.6s linear infinite; }
.ring.on { opacity: 1; }
@keyframes flow { to { background-position: 300% 0; } }

.words { position: fixed; left: 0; top: 0; pointer-events: none; overflow: hidden; border-style: solid; border-color: transparent; background: transparent; margin: 0; }
.words.line { display: flex; align-items: center; white-space: pre; }
.words.line > div { width: 100%; overflow: hidden; white-space: pre; }
.words.multi { display: block; white-space: pre-wrap; overflow-wrap: break-word; }
.w { display: inline; opacity: 0; filter: blur(6px); animation: wIn .55s ${SPRING} forwards; }
@keyframes wIn { to { opacity: 1; filter: none; } }

.glass { position: fixed; left: 50%; bottom: 24px; translate: -50% 0; width: 340px; max-width: calc(100vw - 32px); padding: 12px 14px; border-radius: 22px; color: #1d1d1f;
  background: rgba(255,255,255,.62); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: 0 18px 44px -14px rgba(30,20,80,.32), 0 0 0 .5px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.9);
  opacity: 0; scale: .92; filter: blur(10px); pointer-events: none;
  transition: opacity .45s ${SPRING}, scale .5s ${SPRING}, filter .45s ${SPRING}, width .55s ${SPRING}; }
.glass.on { opacity: 1; scale: 1; filter: none; pointer-events: auto; }
.glass.wide { width: 400px; }
.glass.top { bottom: auto; top: 16px; }
.glass.min .t2, .glass.min .track { display: none; } /* the finish actions stay: they are the student's next step */
.hd { display: flex; align-items: center; gap: 11px; }
.tx { flex: 1; min-width: 0; }
.orb { width: 30px; height: 30px; flex: none; border-radius: 50%; position: relative; background: conic-gradient(#7B61FF, #FF6BD6, #FF9F45, #3CC8FF, #7B61FF); animation: rot 3s linear infinite; transition: background .4s; }
.orb::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #f1ecff 60%, #e7e1ff); }
.orb svg { position: absolute; inset: 0; margin: auto; width: 16px; height: 16px; z-index: 1; opacity: 0; }
.orb.done { animation: none; background: #1E9E62; }
.orb.done::after, .orb.warn::after { display: none; }
.orb.done svg.ok { opacity: 1; }
.orb.warn { animation: none; background: #FF9F45; }
.orb.warn svg.bang { opacity: 1; }
.ok path { stroke-dasharray: 14; stroke-dashoffset: 14; }
.orb.done .ok path { animation: draw .45s .1s ${SPRING} forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes rot { to { transform: rotate(360deg); } }
.t1 { font-weight: 600; font-size: 14px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t2 { font-size: 12.5px; color: #6e6e73; height: 18px; position: relative; overflow: hidden; }
.t2 span { position: absolute; inset: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: swap .45s ${SPRING}; }
.glass.msg .t2 { height: auto; }
.glass.msg .t2 span { position: static; white-space: normal; }
@keyframes swap { from { opacity: 0; filter: blur(4px); transform: translateY(6px); } }
.count { font: 600 12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-variant-numeric: tabular-nums; color: #6e6e73; }
.x { flex: none; align-self: flex-start; width: 24px; height: 24px; margin: -4px -6px 0 0; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #6e6e73; font: 600 17px/24px -apple-system, system-ui, sans-serif; cursor: pointer; }
.x:hover, .x:focus-visible { background: rgba(0,0,0,.07); color: #1d1d1f; outline: none; }
.track { height: 3px; border-radius: 2px; margin-top: 10px; background: rgba(0,0,0,.07); overflow: hidden; }
.track i { display: block; height: 100%; width: 0; border-radius: 2px; background: linear-gradient(90deg, #7B61FF, #FF6BD6, #3CC8FF); transition: width .5s ${SPRING}; }
.glass.msg .track { display: none; }
.acts { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .5s ${SPRING}; }
.acts.show { grid-template-rows: 1fr; }
.acts > div { overflow: hidden; display: flex; gap: 8px; }
.acts button { margin-top: 11px; flex: 1; font: 600 12.5px -apple-system, BlinkMacSystemFont, system-ui, sans-serif; padding: 9px 10px; border-radius: 12px; border: 0; background: rgba(0,0,0,.06); color: #1d1d1f; cursor: pointer; }
.acts button:hover, .acts button:focus-visible { background: rgba(0,0,0,.1); outline: none; }
.acts button:active { transform: scale(.97); }
.acts .warm { background: rgba(255,159,69,.16); color: #9A5208; }
.acts .warm:hover, .acts .warm:focus-visible { background: rgba(255,159,69,.26); }
.acts [hidden] { display: none; }

@media (prefers-reduced-motion: reduce) {
  .edge i, .orb, .ring { animation: none !important; }
  .w { animation: none !important; opacity: 1; filter: none; }
  .t2 span { animation: fade .15s linear; }
  .glass { scale: 1; filter: none; transition: opacity .15s linear !important; }
  .track i, .acts, .edge { transition-duration: .15s !important; }
  .ok path { stroke-dashoffset: 0; animation: none !important; }
  @keyframes fade { from { opacity: 0; } }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: #fff; backdrop-filter: none; -webkit-backdrop-filter: none; }
  .edge i { opacity: .45; }
}
`;

  function svgIcon(cls, d, stroke) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    if (cls) svg.setAttribute("class", cls);
    for (const part of d) {
      const el = document.createElementNS(SVG_NS, part.tag || "path");
      for (const [k, v] of Object.entries(part)) if (k !== "tag") el.setAttribute(k, v);
      if (!el.hasAttribute("stroke") && el.tagName !== "circle") el.setAttribute("stroke", stroke || "currentColor");
      svg.appendChild(el);
    }
    return svg;
  }
  const CHECK = [{ d: "M3.5 8.5l3 3 6-7", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }];
  const HAND = [
    { tag: "circle", cx: "8", cy: "8", r: "6", stroke: "currentColor", "stroke-width": "1.6" },
    { d: "M8 5v3.5", "stroke-width": "1.6", "stroke-linecap": "round" },
    { tag: "circle", cx: "8", cy: "11", r: ".9", fill: "currentColor" },
  ];
  const BANG = [{ d: "M8 4v5", "stroke-width": "2", "stroke-linecap": "round" }, { tag: "circle", cx: "8", cy: "12", r: "1.1", fill: "#fff" }];

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  /** The element the ring hugs: the react-select control, else the first visible text-like control, else the wrapper. */
  function ringTarget(box) {
    if (!box || !box.querySelector) return null;
    const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const ctl = box.querySelector(".select__control");
    if (ctl && visible(ctl)) return ctl;
    const c = [...box.querySelectorAll("input, textarea, select, [role=combobox]")].find((e) => !["hidden", "checkbox", "radio", "file"].includes(String(e.type || "").toLowerCase()) && visible(e));
    return c || box;
  }

  function create() {
    let host = null, shadow = null, dismissed = false;
    let edge, ring, card, orb, t1, t2, count, bar, acts, leftBtn, reviewBtn;
    const tracked = new Map(); // overlay element -> page element it follows
    let raf = 0;

    function build() {
      host = document.createElement("placed-autopilot");
      host.setAttribute("style", "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important");
      shadow = host.attachShadow({ mode: "open" }); // open: e2e/autopilot.spec.ts reads .placed-panel through it
      const style = document.createElement("style");
      style.textContent = CSS;
      const layer = el("div", "layer");
      edge = el("div", "edge");
      for (let i = 0; i < 5; i++) edge.appendChild(el("i"));
      ring = el("div", "ring");
      card = el("div", "glass placed-panel");
      card.setAttribute("role", "status");
      card.setAttribute("aria-live", "polite");
      const hd = el("div", "hd");
      orb = el("div", "orb");
      orb.append(svgIcon("ok", CHECK, "#fff"), svgIcon("bang", BANG, "#fff"));
      const tx = el("div", "tx");
      t1 = el("div", "t1", "Placed Autopilot");
      t2 = el("div", "t2");
      tx.append(t1, t2);
      count = el("div", "count");
      const x = el("button", "x", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Close the Placed panel");
      x.addEventListener("click", () => { dismissed = true; destroy(); });
      hd.append(orb, tx, count, x);
      const track = el("div", "track");
      bar = el("i");
      track.appendChild(bar);
      acts = el("div", "acts");
      const row = el("div");
      leftBtn = el("button", "warm");
      leftBtn.type = "button";
      leftBtn.hidden = true;
      reviewBtn = el("button", null, "Review answers");
      reviewBtn.type = "button";
      row.append(leftBtn, reviewBtn);
      acts.appendChild(row);
      card.append(hd, track, acts);
      layer.append(edge, ring, card);
      shadow.append(style, layer);
    }

    /** Mounts (and re-mounts, if the page removed it) on <html>, after hydration; never after the student closed it. */
    function ensure() {
      if (dismissed) return false;
      if (!host) build();
      if (!host.isConnected) {
        document.documentElement.appendChild(host);
        void card.getBoundingClientRect(); // commit the hidden state first, so the card materialises
        requestAnimationFrame(() => card.classList.add("on"));
      }
      return true;
    }
    function destroy() {
      stopTracking();
      if (edge) edge.classList.remove("on");
      if (host) host.remove();
    }

    // ---------- follow page elements (ring, words layer) ----------
    function place(o, target) {
      if (!target.isConnected) { o.style.display = "none"; return; }
      const r = target.getBoundingClientRect();
      o.style.display = "";
      const pad = o === ring ? 1 : 0;
      o.style.left = `${r.left - pad}px`;
      o.style.top = `${r.top - pad}px`;
      o.style.width = `${r.width + pad * 2}px`;
      o.style.height = `${r.height + pad * 2}px`;
    }
    function tick() {
      raf = 0;
      if (!tracked.size) return;
      for (const [o, t] of tracked) place(o, t);
      raf = requestAnimationFrame(tick);
    }
    function track(o, target) {
      tracked.set(o, target);
      place(o, target);
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function untrack(o) { tracked.delete(o); }
    function stopTracking() { tracked.clear(); if (raf) cancelAnimationFrame(raf); raf = 0; }

    // ---------- card ----------
    function status(text) {
      if (!ensure()) return;
      card.classList.remove("msg");
      const s = el("span", null, text);
      t2.replaceChildren(s);
    }
    function progress(n, total) {
      if (!ensure()) return;
      bar.style.width = `${total ? Math.min(100, (n / total) * 100) : 0}%`;
      count.textContent = total && n < total ? `${n}/${total}` : "";
    }
    function start() {
      if (!ensure()) return;
      edge.classList.add("on");
      status("Reading the form…");
    }
    /** A message that ends the run (errors, wrong job, form not open): no aurora, an amber orb, wrapping text. */
    function message(text) {
      if (!ensure()) return;
      edge.classList.remove("on");
      clearActive();
      orb.classList.add("warn");
      t1.textContent = "Placed Autopilot";
      count.textContent = "";
      card.classList.add("msg");
      t2.replaceChildren(el("span", null, text));
    }

    // ---------- fields ----------
    let active = null; // { target }
    /** Scroll the field to the centre and light it up. Resolves once the scroll has settled (bounded by maxWaitMs). */
    async function activate(box, maxWaitMs) {
      clearActive();
      if (!box || !ensure()) return null;
      const target = ringTarget(box);
      if (!target) return null;
      try { box.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion() ? "instant" : "smooth" }); } catch { /* detached */ }
      target.setAttribute("data-placed-glow", "");
      const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      ring.style.borderRadius = `${Math.max(4, radius + 1)}px`;
      track(ring, target);
      ring.classList.add("on");
      active = { target };
      // Wait until the field stops moving (smooth scroll), so fills and trusted clicks measure a still page.
      const until = Date.now() + Math.max(0, maxWaitMs || 0);
      let last = target.getBoundingClientRect().top;
      while (Date.now() < until) {
        await sleep(50);
        const t = target.getBoundingClientRect().top;
        if (Math.abs(t - last) < 0.5) break;
        last = t;
      }
      return target;
    }
    function clearActive() {
      if (!active) return;
      active.target.removeAttribute("data-placed-glow");
      if (ring) { ring.classList.remove("on"); untrack(ring); }
      active = null;
    }
    /** Settle the wrapper (its data-placed is already set): calm ring keyed on data-placed, the active glow off. */
    function settle(box) {
      clearActive();
      const target = ringTarget(box);
      if (target) target.setAttribute("data-placed-ring", "");
    }
    /** The badge under a field: a self-drawing check (filled) or a hand (your turn), and its text. */
    function makeTag(text) {
      const tag = el("span", "placed-tag");
      tag.append(svgIcon("placed-ck", CHECK), svgIcon("placed-hand", HAND), el("span", "placed-tag-text", text));
      return tag;
    }

    /**
     * Words blur-in over a text input/textarea whose real value is already set. The real input is untouched except
     * for data-placed-typing (transparent text) while the layer draws; skipped where the layer cannot match the
     * input (scrolled text, long or overflowing textareas, reduced motion). Resolves after min(duration, waitMs);
     * the layer cleans itself up when its animation ends.
     */
    async function reveal(target, waitMs, budgetMs) {
      if (!target || dismissed || reducedMotion() || !ensure()) return;
      const isArea = target.tagName === "TEXTAREA";
      if (!isArea && !(target.tagName === "INPUT" && TEXT_TYPES.has(String(target.getAttribute("type") || "").toLowerCase()))) return;
      const text = String(target.value || "");
      if (!text.trim()) return;
      const r = target.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight) return;
      if (isArea ? target.scrollHeight > target.clientHeight + 1 || text.length > 600 : target.scrollWidth > target.clientWidth + 1 || /\n/.test(text)) return;
      const cs = getComputedStyle(target);
      if (cs.visibility === "hidden" || Number(cs.opacity) < 0.1) return;
      const P = root.PlacedPacing;
      const parts = P.splitWords(text);
      const words = parts.filter((p) => /\S/.test(p)).length;
      const stagger = P.wordStagger(words, budgetMs);
      const layer = el("div", `words ${isArea ? "multi" : "line"}`);
      for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "letterSpacing", "wordSpacing", "lineHeight", "textAlign", "textIndent", "textTransform",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing", "direction", "fontFeatureSettings", "fontVariantNumeric"]) {
        layer.style[k] = cs[k];
      }
      layer.style.color = cs.color;
      layer.style.boxSizing = "border-box";
      const inner = isArea ? layer : el("div");
      let i = 0;
      for (const p of parts) {
        if (/\S/.test(p)) {
          const w = el("span", "w", p);
          w.style.animationDelay = `${i++ * stagger}ms`;
          inner.appendChild(w);
        } else inner.appendChild(document.createTextNode(p));
      }
      if (!isArea) layer.appendChild(inner);
      ring.parentNode.insertBefore(layer, ring);
      track(layer, target);
      target.setAttribute("data-placed-typing", "");
      const duration = i * stagger + 560;
      const done = () => { untrack(layer); layer.remove(); target.removeAttribute("data-placed-typing"); };
      setTimeout(done, duration);
      await sleep(Math.min(duration, Math.max(0, waitMs || 0)));
    }

    // ---------- finish ----------
    function finish({ filled, total, theirs, submit }) {
      clearActive();
      if (submit) submit.classList.add("placed-submit-hint");
      if (!ensure()) return;
      edge.classList.remove("on");
      orb.classList.add("done");
      card.classList.add("wide");
      t1.textContent = `${filled} of ${total} filled`;
      status("Check everything, then press Submit yourself.");
      progress(total, total);
      let idx = -1;
      const left = () => (theirs || []).filter((b) => b.isConnected && b.dataset.placed !== "filled"); // an armed pick may have turned green
      const label = () => {
        const k = left().length;
        leftBtn.hidden = k === 0;
        leftBtn.textContent = `${k} left for you`;
      };
      label();
      leftBtn.addEventListener("click", () => {
        const list = left();
        label();
        if (!list.length) return;
        idx = (idx + 1) % list.length;
        const box = list[idx];
        box.scrollIntoView({ block: "center", behavior: reducedMotion() ? "instant" : "smooth" });
        const target = ringTarget(box);
        const focusable = box.querySelector("input:not([type=hidden]):not([type=file]), textarea, select, [role=combobox]");
        if (focusable) { try { focusable.focus({ preventScroll: true }); } catch { /* not focusable */ } }
        if (target) {
          target.removeAttribute("data-placed-ring"); // the settled ring is !important and would hide the pulse
          target.setAttribute("data-placed-glow", "");
          setTimeout(() => { target.removeAttribute("data-placed-glow"); target.setAttribute("data-placed-ring", ""); }, 1400);
        }
      });
      reviewBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion() ? "instant" : "smooth" }));
      acts.classList.add("show");
      if (submit) avoid(submit);
    }

    /** Never cover the submit button: move the card to the top, and collapse it if it still overlaps. */
    function avoid(submit) {
      const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      let queued = false;
      const placeCard = () => {
        queued = false;
        if (!host || !host.isConnected) return;
        card.classList.remove("top", "min");
        if (!overlaps(card.getBoundingClientRect(), submit.getBoundingClientRect())) return;
        card.classList.add("top");
        if (overlaps(card.getBoundingClientRect(), submit.getBoundingClientRect())) card.classList.add("min");
      };
      const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(placeCard); } };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      setTimeout(placeCard, 600);
    }

    return { ensure, start, status, progress, message, activate, clearActive, settle, makeTag, reveal, finish, get dismissed() { return dismissed; } };
  }

  root.PlacedAurora = { create, ringTarget, SPRING };
})(globalThis);
