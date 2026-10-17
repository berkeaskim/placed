// Placed Autopilot service worker.
//  1. R8: claims the one-time pack and downloads the CV from the local Placed app, so neither the token nor the CV URL is ever fetched
//     from the employer page. The token is never logged.
//  2. Trusted input (chrome.debugger) for widgets that ignore synthetic events. Every trusted click is re-verified
//     here, at the exact point, with CDP before the mouse goes down: the node under the pointer must sit inside the
//     control the content script tagged with a one-shot nonce, and neither it nor its 3 nearest ancestors may be a
//     button, link, submit-ish input, role=button, or carry submit/apply/send wording.
importScripts("config.js");
importScripts("lib/geometry.js");

const ALLOWED = ["https://job-boards.greenhouse.io", "https://boards.greenhouse.io", "https://jobs.ashbyhq.com", "https://jobs.lever.co"];
const IDLE_MS = 60_000;
const CV_MAX_BYTES = 10 * 1024 * 1024;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const attached = new Set();
const idleTimers = new Map();

const placedOrigin = () => String(globalThis.PLACED_ORIGIN || "").replace(/\/+$/, "");
const cdp = (tabId, method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);

// ---------- sender checks ----------
function senderOrigin(sender) {
  try {
    return sender.origin || new URL(sender.url || "").origin;
  } catch {
    return "";
  }
}
function fromAllowedPage(sender) {
  return sender.id === chrome.runtime.id && Boolean(sender.tab) && sender.tab.id != null && sender.frameId === 0 && ALLOWED.includes(senderOrigin(sender));
}

// ---------- debugger lifecycle ----------
function bumpIdle(tabId) {
  clearTimeout(idleTimers.get(tabId));
  idleTimers.set(tabId, setTimeout(() => detach(tabId), IDLE_MS));
}
async function attach(tabId) {
  if (!attached.has(tabId)) {
    await chrome.debugger.attach({ tabId }, "1.3");
    attached.add(tabId);
  }
  bumpIdle(tabId);
}
async function detach(tabId) {
  clearTimeout(idleTimers.get(tabId));
  idleTimers.delete(tabId);
  attached.delete(tabId);
  await chrome.debugger.detach({ tabId }).catch(() => {}); // unconditional: harmless when not attached
}
chrome.debugger.onDetach.addListener((src) => {
  if (src.tabId == null) return;
  clearTimeout(idleTimers.get(src.tabId));
  idleTimers.delete(src.tabId);
  attached.delete(src.tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => { if (attached.has(tabId)) detach(tabId); });
// Without the "tabs" permission changeInfo.url is withheld, so any navigation/reload ("loading") also detaches.
chrome.tabs.onUpdated.addListener((tabId, info) => { if (attached.has(tabId) && (info.status === "loading" || info.url)) detach(tabId); });

// ---------- trusted click verification ----------
const SUBMIT_WORDS = /\b(submit|apply|send)\b/i;
const SUBMIT_HOOK = /submit/i;
function badSummary(s) {
  const tag = String(s.tag || "").toUpperCase();
  const type = String(s.type || "").toLowerCase();
  if (tag === "BUTTON" || tag === "A") return true;
  if (tag === "INPUT" && ["submit", "image", "button", "reset"].includes(type)) return true;
  if (String(s.role || "").toLowerCase() === "button") return true;
  if (SUBMIT_WORDS.test(`${s.text || ""} ${s.value || ""} ${s.aria || ""} ${s.title || ""}`)) return true;
  return SUBMIT_HOOK.test(`${s.id || ""} ${s.cls || ""} ${s.name || ""}`);
}
function summaryFromDescribed(node) {
  const a = {};
  const attrs = node.attributes || [];
  for (let i = 0; i + 1 < attrs.length; i += 2) a[attrs[i].toLowerCase()] = attrs[i + 1];
  const text = (node.children || []).filter((c) => c.nodeType === 3).map((c) => c.nodeValue || "").join(" ").slice(0, 200);
  return { tag: node.nodeName, type: a.type, role: a.role, id: a.id, cls: a.class, name: a.name, value: a.value, aria: a["aria-label"], title: a.title, text };
}
// Runs in the page on the hit node: is it inside the nonce-tagged control, and what are it and its 3 ancestors?
const CHAIN_FN = `function (nonce) {
  let el = this.nodeType === 1 ? this : this.parentElement;
  const inside = Boolean(el && nonce && Element.prototype.closest.call(el, '[data-placed-target="' + nonce + '"]'));
  const chain = [];
  for (let i = 0; el && i < 4; i++, el = el.parentElement) {
    const g = (k) => el.getAttribute(k) || "";
    const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(" ").slice(0, 200);
    chain.push({ tag: el.tagName, type: g("type"), role: g("role"), id: g("id"), cls: g("class"), name: g("name"), value: g("value"), aria: g("aria-label"), title: g("title"), text });
  }
  return { inside, chain };
}`;
async function verifyPoint(tabId, x, y, nonce) {
  // (x, y) are viewport coordinates (they also drive Input.dispatchMouseEvent); getNodeForLocation wants document ones.
  const doc = globalThis.PlacedGeometry.toDocumentPoint(x, y, await cdp(tabId, "Page.getLayoutMetrics"));
  if (!doc) return false;
  // ignorePointerEventsNone: false hit-tests like a real mouse (pointer-events:none layers are skipped).
  const loc = await cdp(tabId, "DOM.getNodeForLocation", { x: doc.x, y: doc.y, includeUserAgentShadowDOM: false, ignorePointerEventsNone: false });
  if (!loc || !loc.backendNodeId) return false;
  const { node } = await cdp(tabId, "DOM.describeNode", { backendNodeId: loc.backendNodeId, depth: 1 });
  if (node && node.nodeType === 1 && badSummary(summaryFromDescribed(node))) return false; // not page-tamperable
  const { object } = await cdp(tabId, "DOM.resolveNode", { backendNodeId: loc.backendNodeId });
  if (!object || !object.objectId) return false;
  try {
    const { result } = await cdp(tabId, "Runtime.callFunctionOn", { objectId: object.objectId, functionDeclaration: CHAIN_FN, arguments: [{ value: nonce }], returnByValue: true });
    const v = result && result.value;
    return Boolean(v && v.inside && Array.isArray(v.chain) && v.chain.length && !v.chain.some(badSummary));
  } finally {
    cdp(tabId, "Runtime.releaseObject", { objectId: object.objectId }).catch(() => {});
  }
}

// ---------- claim ----------
// The claim answers with a same-origin path (/api/files/...): resolve it against the Placed origin, and never fetch
// anything that resolves elsewhere.
function cvUrl(u) {
  try {
    const url = new URL(u, `${placedOrigin()}/`);
    return url.origin === placedOrigin() && url.pathname.startsWith("/api/files/") ? url.href : null;
  } catch {
    return null;
  }
}
function toBase64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
/** Downloads a same-origin PDF the claim pointed at, capped at CV_MAX_BYTES; null leaves that field for the student. */
async function fetchPdf(ref, fallbackName) {
  const href = ref && typeof ref.url === "string" ? cvUrl(ref.url) : null;
  if (!href) return null;
  try {
    const r = await fetch(href, { credentials: "omit", cache: "no-store" });
    const buf = r.ok ? await r.arrayBuffer() : null;
    if (buf && buf.byteLength > 0 && buf.byteLength <= CV_MAX_BYTES) return { name: String(ref.filename || fallbackName), type: "application/pdf", base64: toBase64(buf) };
  } catch {
    return null;
  }
  return null;
}
async function claim(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: 400 };
  let res;
  try {
    res = await fetch(`${placedOrigin()}/api/autopilot/claim`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), credentials: "omit", cache: "no-store",
    });
  } catch {
    return { status: 0 };
  }
  if (!res.ok) return { status: res.status };
  const body = await res.json().catch(() => null);
  if (!body || !Array.isArray(body.fields)) return { status: 502 };
  const [cv, cover] = await Promise.all([fetchPdf(body.cv, "CV.pdf"), fetchPdf(body.cover, "Cover-Letter.pdf")]);
  const plan = { ats: body.ats, url: body.url, fields: body.fields }; // the CV URL never reaches the page
  return { status: 200, plan, cv, cover };
}

// ---------- LinkedIn Score: read the student's own profile in their logged-in tab ----------
// The Placed page hands over a signed ticket (liArm). The next tab that opens the student's OWN profile
// (?isSelfProfile=true, checked by linkedin.js) binds to it (liClaim), reads the profile (liStash), reads the full
// skills list on /details/skills/, and posts everything to the Placed origin that issued the ticket (liSubmit).
// Nothing is read on LinkedIn unless a ticket is waiting. State lives in storage.session: the worker may sleep.
const LI_KEY = "placedLinkedIn";
const LI_TTL_MS = 3 * 60_000;
const LI_TOKEN_RE = /^[A-Za-z0-9_-]{20,400}\.[A-Za-z0-9_-]{43}$/;
const placedOrigins = () => (globalThis.PLACED_ORIGINS || []).map((o) => String(o).replace(/\/+$/, ""));
const liGet = async () => {
  const s = (await chrome.storage.session.get(LI_KEY))[LI_KEY];
  if (s && Date.now() - s.armedAt > LI_TTL_MS) { await chrome.storage.session.remove(LI_KEY); return null; }
  return s || null;
};
const liSet = (s) => chrome.storage.session.set({ [LI_KEY]: s });
const liClear = () => chrome.storage.session.remove(LI_KEY);
function fromPlacedPage(sender) {
  return sender.id === chrome.runtime.id && Boolean(sender.tab) && sender.frameId === 0 && placedOrigins().includes(senderOrigin(sender));
}
function fromLinkedInProfile(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || senderOrigin(sender) !== "https://www.linkedin.com") return false;
  try { return new URL(sender.url).pathname.startsWith("/in/"); } catch { return false; }
}
/** Tells the Placed tab the read failed, so it shows the reason now instead of polling until it times out. */
async function liFail(s, error) {
  try {
    await chrome.tabs.sendMessage(s.placedTabId, { kind: "liFailed", error }, { frameId: 0 });
    const t = await chrome.tabs.update(s.placedTabId, { active: true });
    if (t && t.windowId != null) await chrome.windows.update(t.windowId, { focused: true });
  } catch { /* the Placed tab was closed */ }
  return { ok: false, error };
}
async function liHandle(msg, sender) {
  if (msg.kind === "liArm") {
    if (!fromPlacedPage(sender) || typeof msg.token !== "string" || !LI_TOKEN_RE.test(msg.token)) return { ok: false };
    await liSet({ token: msg.token, origin: senderOrigin(sender), placedTabId: sender.tab.id, armedAt: Date.now(), tabId: null, profile: null });
    return { ok: true };
  }
  if (!fromLinkedInProfile(sender)) return { ok: false };
  const s = await liGet();
  if (!s) return { ok: false };
  if (msg.kind === "liClaim") {
    if (s.tabId == null && msg.self === true) { s.tabId = sender.tab.id; await liSet(s); }
    return s.tabId === sender.tab.id ? { ok: true, phase: s.profile ? "skills" : "read" } : { ok: false };
  }
  if (s.tabId !== sender.tab.id) return { ok: false };
  if (msg.kind === "liStash") {
    if (!msg.profile || typeof msg.profile !== "object") return { ok: false };
    s.profile = msg.profile;
    await liSet(s);
    return { ok: true };
  }
  if (msg.kind === "liSubmit") {
    const profile = { ...(s.profile || msg.profile || {}) };
    if (Array.isArray(msg.skills) && msg.skills.length) { profile.skills = msg.skills; profile.skillsComplete = true; }
    await liClear(); // single use, whatever happens next
    let res;
    try {
      res = await fetch(`${s.origin}/api/linkedin/capture`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: s.token, profile }), credentials: "omit", cache: "no-store",
      });
    } catch {
      return liFail(s, "Couldn't reach Placed. Check you're online and press the button in Placed again.");
    }
    if (!res.ok) return liFail(s, (await res.text().catch(() => "")).slice(0, 200) || `Placed answered ${res.status}.`);
    const body = await res.json().catch(() => ({}));
    try {
      const t = await chrome.tabs.update(s.placedTabId, { active: true });
      if (t && t.windowId != null) await chrome.windows.update(t.windowId, { focused: true });
    } catch { /* the Placed tab was closed: the result is saved anyway */ }
    return { ok: true, total: body.total, label: body.label };
  }
  return { ok: false };
}

// ---------- messages ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && typeof msg.kind === "string" && msg.kind.startsWith("li")) {
    liHandle(msg, sender).then(reply, (e) => reply({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  }
  if (!msg || typeof msg.kind !== "string" || !fromAllowedPage(sender)) return false;
  const tabId = sender.tab.id;
  (async () => {
    try {
      if (msg.kind === "claim") {
        reply(await claim(msg.token));
      } else if (msg.kind === "attach") {
        await attach(tabId);
        reply({ ok: true });
      } else if (msg.kind === "trustedClick") {
        const { x, y, nonce } = msg;
        if (!attached.has(tabId)) throw new Error("not attached"); // attach happens once, before any measuring
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) throw new Error("bad point");
        if (typeof nonce !== "string" || !/^[a-f0-9]{16,64}$/.test(nonce)) throw new Error("bad nonce");
        bumpIdle(tabId);
        await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        if (!(await verifyPoint(tabId, x, y, nonce))) throw new Error("refused: point is not the intended control");
        const base = { x, y, button: "left", clickCount: 1 };
        await cdp(tabId, "Input.dispatchMouseEvent", { ...base, type: "mousePressed" });
        await cdp(tabId, "Input.dispatchMouseEvent", { ...base, type: "mouseReleased" });
        reply({ ok: true });
      } else if (msg.kind === "trustedType") {
        if (!attached.has(tabId)) throw new Error("not attached");
        const text = typeof msg.text === "string" ? msg.text.replace(CONTROL_CHARS, "").slice(0, 200) : "";
        if (!text) throw new Error("bad text");
        bumpIdle(tabId);
        await cdp(tabId, "Input.insertText", { text });
        reply({ ok: true });
      } else if (msg.kind === "detach") {
        await detach(tabId);
        reply({ ok: true });
      } else {
        reply({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      reply({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  })();
  return true;
});
