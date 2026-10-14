// Runs at document_start, before the page's own scripts can read the URL.
// R5: the one-time token only ever travels in the fragment (#placed=<43 chars>), which browsers never send to the
// employer's server. We take it out of the URL immediately and keep it in this extension's isolated world, which the
// page cannot read. content.js (same extension, same frame, same isolated world) takes it exactly once.
(function (root) {
  function extractToken(hash) {
    const m = /(?:^#|&)placed=([A-Za-z0-9_-]{43})(?=$|&)/.exec(String(hash || ""));
    return m ? m[1] : null;
  }
  if (typeof module !== "undefined") module.exports = { extractToken };
  if (typeof location === "undefined" || typeof history === "undefined") return;

  let token = extractToken(location.hash);
  if (!token) return;
  const rest = location.hash.replace(/^#/, "").split("&").filter((p) => p && !p.startsWith("placed=")).join("&");
  history.replaceState(history.state, "", location.pathname + location.search + (rest ? `#${rest}` : ""));
  root.__placedTakeToken = function () {
    const t = token;
    token = null;
    delete root.__placedTakeToken;
    return t;
  };
})(globalThis);
