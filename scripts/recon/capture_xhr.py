#!/usr/bin/env python3
"""Load one careers search page in a real browser and list the JSON XHR/fetch calls it makes.

Usage: capture_xhr.py <url> [--pattern REGEX] [--wait MS]

Recon only: it finds the endpoint an employer's own careers site calls, so a lightweight
TypeScript provider can call that endpoint directly. It never runs during ingest.

Only Scrapling's DynamicFetcher (plain Playwright Chromium) is used. StealthyFetcher is
deliberately not used here: recon must see what an ordinary browser sees, and a site that
shows a challenge page is recorded as blocked, never bypassed. No proxies, no logins, no
CAPTCHA solving, no clicking through cookie banners.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading

try:
    from scrapling.fetchers import DynamicFetcher
except ImportError:  # pragma: no cover
    print(
        "scrapling is not installed. Use a Python >= 3.10 venv:\n"
        '  pip install "scrapling[fetchers]" && scrapling install\n'
        "See scripts/recon/README.md.",
        file=sys.stderr,
    )
    sys.exit(2)

CHALLENGE_MARKERS = (
    "just a moment",
    "cf-challenge",
    "challenges.cloudflare.com",
    "turnstile",
    "access denied",
    "press & hold",
    "press and hold",
    "px-captcha",
    "captcha",
)


def first_item_keys(data):
    """Keys of the first object in the first list found at the top level (one level deep)."""
    if isinstance(data, list):
        return sorted(data[0].keys()) if data and isinstance(data[0], dict) else None
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                return sorted(value[0].keys())
            if isinstance(value, dict):
                for inner in value.values():
                    if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                        return sorted(inner[0].keys())
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("url")
    parser.add_argument("--pattern", default=None, help="regex the XHR URL must match (default: all)")
    parser.add_argument("--wait", type=int, default=3000, help="extra ms to wait after network idle")
    parser.add_argument("--timeout", type=int, default=90, help="hard limit in seconds for the whole run")
    args = parser.parse_args()

    # Scrapling's captured responses do not keep the request method or body. Record them from the
    # same "response" event with the same filter Scrapling uses, so entry i lines up with captured_xhr[i].
    pattern = args.pattern or ".*"
    requests: list[tuple[str, str | None]] = []
    seen: list[str] = []  # printed by the watchdog if the page never settles

    def page_setup(page):
        requests.clear()  # a retry calls page_setup again on a fresh page

        def on_response(resp):
            req = resp.request
            if req.resource_type in ("xhr", "fetch") and re.search(pattern, resp.url):
                try:
                    body = req.post_data
                except UnicodeDecodeError:  # binary/gzipped beacon bodies
                    body = f"<{len(req.post_data_buffer or b'')} binary bytes>"
                requests.append((req.method, body))
                ctype = resp.headers.get("content-type", "")
                seen.append(f"{req.method} {resp.status} {ctype.split(';')[0]} {resp.url[:300]}")

        page.on("response", on_response)

    def watchdog():
        # Some pages (long-polling, bot-manager sensors) never reach network idle and the fetch hangs.
        # Print what was seen so far, then exit; check those endpoints with a plain fetch instead.
        print(f"TIMEOUT after {args.timeout}s: page never settled. XHR/fetch seen so far:")
        print("\n".join(f"  {line}" for line in seen if "json" in line) or "  (no JSON)")
        sys.stdout.flush()
        os._exit(3)

    timer = threading.Timer(args.timeout, watchdog)
    timer.daemon = True
    timer.start()

    page = DynamicFetcher.fetch(
        args.url,
        headless=True,
        network_idle=True,
        wait=args.wait,
        capture_xhr=pattern,
        page_setup=page_setup,
        retries=1,  # one page load per run; a failure is reported, not retried
    )

    timer.cancel()
    html = page.body.decode("utf-8", "replace") if isinstance(page.body, bytes) else str(page.body)
    title = page.css("title::text").get() or ""
    lowered = (title + " " + html[:20000]).lower()
    hits = [m for m in CHALLENGE_MARKERS if m in lowered]
    print(f"PAGE {page.status} {page.url}")
    print(f"TITLE {title.strip()[:120]!r}")
    if hits:
        print(f"CHALLENGE? markers found: {hits} (check by hand; if it is a challenge, record blocked)")

    json_count = 0
    other: list[str] = []
    aligned = len(requests) == len(page.captured_xhr)
    for i, xhr in enumerate(page.captured_xhr):
        ctype = str({k.lower(): v for k, v in xhr.headers.items()}.get("content-type", ""))
        if "json" not in ctype:
            other.append(f"  {xhr.status} {ctype.split(';')[0] or '?'} {xhr.url[:160]}")
            continue
        json_count += 1
        method, body = requests[i] if aligned else ("?", None)
        print("-" * 72)
        print(f"{method} {xhr.status} {xhr.url}")
        if body:
            print(f"  body: {body[:4000]}")
        try:
            data = json.loads(xhr.body)
        except (ValueError, TypeError):
            print("  (not parseable as JSON)")
            continue
        if isinstance(data, dict):
            print(f"  top-level keys: {sorted(data.keys())[:40]}")
        elif isinstance(data, list):
            print(f"  top-level: list[{len(data)}]")
        keys = first_item_keys(data)
        if keys:
            print(f"  first item keys: {keys[:40]}")

    print("-" * 72)
    if other:
        print("non-JSON XHR/fetch:")
        print("\n".join(other))
    print(f"{len(page.captured_xhr)} XHR/fetch captured, {json_count} JSON")
    return 0


if __name__ == "__main__":
    sys.exit(main())
