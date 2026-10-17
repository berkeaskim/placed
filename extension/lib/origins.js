// Where is the Placed app? The extension may have been loaded from an old checkout whose config.js names a port the
// app no longer uses, so the service worker tries, in order: the origin a Placed tab last reported, PLACED_ORIGIN,
// then the rest of PLACED_ORIGINS. Only loopback origins are ever tried, plus PLACED_ORIGIN itself (a packed zip may
// point at a deployed app). The next origin is tried only on a network error: any HTTP answer is final.
(function (root) {
  const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

  function parse(o) {
    if (typeof o !== "string" || !o) return null;
    try {
      const u = new URL(o);
      return u.protocol === "http:" || u.protocol === "https:" ? u : null;
    } catch {
      return null;
    }
  }

  function isLoopbackOrigin(o) {
    const u = parse(o);
    return Boolean(u && LOOPBACK.has(u.hostname));
  }

  /** The origin a Placed tab reported, if it is safe to remember: loopback, http(s), and nothing but an origin. */
  function rememberableOrigin(o) {
    const u = parse(o);
    if (!u || !LOOPBACK.has(u.hostname) || (u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) return null;
    return u.origin;
  }

  /** Ordered, deduped origins to claim from. */
  function claimOrigins({ last, primary, list } = {}) {
    const p = parse(primary) ? parse(primary).origin : null;
    const out = [];
    for (const o of [last, primary, ...(Array.isArray(list) ? list : [])]) {
      const u = parse(o);
      if (!u) continue;
      const origin = u.origin;
      if (!LOOPBACK.has(u.hostname) && origin !== p) continue;
      if (!out.includes(origin)) out.push(origin);
    }
    return out;
  }

  /**
   * fetch(origin + path) for each origin until one answers. Resolves { origin, res }, or null if none was reachable.
   * Redirects are refused (a redirect is a network error, so the next origin is tried): 307/308 keep the POST body, so
   * following one could carry the token off loopback.
   */
  async function fetchFirst(origins, path, init, fetchFn) {
    const f = fetchFn || root.fetch.bind(root);
    const opts = { ...(init || {}), redirect: "error" };
    for (const origin of origins || []) {
      let res;
      try {
        res = await f(`${origin}${path}`, opts);
      } catch {
        continue; // network error: this origin is not where Placed runs
      }
      return { origin, res };
    }
    return null;
  }

  const api = { isLoopbackOrigin, rememberableOrigin, claimOrigins, fetchFirst };
  root.PlacedOrigins = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
