#!/usr/bin/env python3
"""Placed's optional stealth sidecar (see lib/ingest/stealth.ts).

Reads one JSON request per stdin line: {"id", "url", "method", "headers", "body"}
Writes one JSON reply per stdout line: {"id", "status", "headers", "body"} or {"id", "error"}

It holds one Scrapling StealthySession (a headless Chromium) for its whole life and exits when stdin closes.
It exists for job boards that reject a plain Node fetch on TLS/header fingerprints. It never solves Cloudflare,
Turnstile or any other CAPTCHA: solve_cloudflare is hard-coded off, and a challenge page is passed back as-is so
Placed fails the board as "blocked".

How requests map onto Scrapling 0.4.15:
- GET: StealthySession.fetch(url) is a page load; for a non-HTML response Scrapling returns the raw body bytes.
- Other methods (POST with a JSON body, e.g. Workday/Oracle listings): StealthySession.fetch only does page loads,
  so the session loads the target's origin and then runs window.fetch() inside that page via page_action
  (page.evaluate). The request then carries the stealth browser's own TLS fingerprint and cookies.
"""
import json
import sys
from importlib.metadata import version
from urllib.parse import urlsplit

# Protocol lines go to the real stdout; anything a library prints goes to stderr.
OUT = sys.stdout
sys.stdout = sys.stderr

# Just under lib/ingest/stealth.ts's 90 s per-request timeout, so a hung in-page fetch() reports an error itself.
IN_PAGE_FETCH_TIMEOUT_MS = 85_000

PAGE_FETCH_JS = """
async ({ url, method, headers, body, timeoutMs }) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, headers, body: body ?? undefined, credentials: "include", signal: ctl.signal });
    const h = {};
    r.headers.forEach((v, k) => { h[k] = v; });
    return { status: r.status, headers: h, body: await r.text() };
  } finally {
    clearTimeout(timer);
  }
}
"""


def reply(obj):
    OUT.write(json.dumps(obj) + "\n")
    OUT.flush()


def decode(resp):
    raw = resp.body
    if isinstance(raw, str):
        return raw
    try:
        return raw.decode(getattr(resp, "encoding", None) or "utf-8", errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def handle(session, req):
    url = req["url"]
    method = (req.get("method") or "GET").upper()
    headers = req.get("headers") or {}
    if method == "GET":
        resp = session.fetch(url, extra_headers=headers, solve_cloudflare=False)
        return {"status": resp.status, "headers": dict(resp.headers), "body": decode(resp)}

    parts = urlsplit(url)
    origin = f"{parts.scheme}://{parts.netloc}/"
    holder = {}

    def action(page):
        # Scrapling logs and swallows page_action errors, so they are captured here.
        try:
            holder["result"] = page.evaluate(
                PAGE_FETCH_JS, {
                    "url": url, "method": method, "headers": headers, "body": req.get("body"),
                    "timeoutMs": IN_PAGE_FETCH_TIMEOUT_MS,
                },
            )
        except Exception as e:  # noqa: BLE001
            holder["error"] = f"in-page fetch failed: {e}"

    nav = session.fetch(origin, page_action=action, solve_cloudflare=False)
    if "result" in holder:
        return holder["result"]
    if "error" in holder:
        raise RuntimeError(holder["error"])
    # No result: hand back the origin page so a challenge there is still detected.
    return {"status": nav.status, "headers": dict(nav.headers), "body": decode(nav)}


def main():
    if "--version" in sys.argv[1:]:
        from scrapling.fetchers import StealthySession  # noqa: F401  (the install must import, not just exist)

        print(version("scrapling"), file=OUT)
        return 0

    session = None
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            req_id = None
            try:
                req = json.loads(line)
                req_id = req.get("id")
                if session is None:
                    from scrapling.fetchers import StealthySession

                    # One attempt per request (retries=1): a failure or a challenge goes back to Placed, never round again.
                    session = StealthySession(
                        headless=True, solve_cloudflare=False, google_search=False, disable_resources=True, retries=1
                    )
                    session.start()
                reply({"id": req_id, **handle(session, req)})
            except Exception as e:  # noqa: BLE001
                reply({"id": req_id, "error": f"{type(e).__name__}: {e}"})
    finally:
        if session is not None:
            try:
                session.close()
            except Exception:  # noqa: BLE001
                pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
