# Recon: find the JSON endpoint a careers site calls

`capture_xhr.py` opens one careers search page in headless Chromium and prints every JSON
XHR/fetch response it saw: method, URL, request body, status, top-level keys and the first
item's keys. Use it to find the endpoint an employer's own careers site calls, then check that
endpoint with a plain `fetch` before writing a TypeScript provider for it.

It is a developer tool. Ingest never runs it, and `npm install` / `npm run setup` do not need Python.

## Setup (once)

Scrapling needs Python 3.10 or newer. Any venv works; with [uv](https://docs.astral.sh/uv/):

```sh
uv venv --python 3.12 .venv-recon
uv pip install --python .venv-recon/bin/python "scrapling[fetchers]"
.venv-recon/bin/scrapling install    # downloads Playwright Chromium
```

`.venv-recon/` is git-ignored. `scrapling[fetchers]` also installs its stealth browser packages; this script never imports them.

## Run

```sh
.venv-recon/bin/python scripts/recon/capture_xhr.py "<careers search URL>" [--pattern REGEX] [--wait MS]
# or, if python3 on PATH is that venv:
npm run recon -- "<careers search URL>"
```

- `--pattern` keeps only XHR URLs matching the regex (default: all, analytics included).
- `--wait` is extra milliseconds to wait after network idle (default 3000), for lazy search calls.
- `--timeout` is a hard limit in seconds (default 90). Some pages (long-polling, bot-manager sensors) never reach
  network idle; the script then prints the JSON calls it saw so far and exits 3. Check those with a plain `fetch`.

The script exits 2 with an install hint if `scrapling` is not importable.

## Rules

- `DynamicFetcher` only (plain Playwright). `StealthyFetcher` is deliberately not used, and there is no
  `solve_cloudflare`, no proxies, no logins, no CAPTCHA solving, no cookie-banner clicking.
- If the page shows a challenge or interstitial (Cloudflare "Just a moment", Turnstile, Akamai
  "Access Denied", PerimeterX press-and-hold), record the site as `blocked` and stop. Don't retry with
  more evasion. The script flags likely challenge markers, but check by hand: the word "captcha" also
  appears in harmless reCAPTCHA script tags.
- One search page per employer, sequential, a few seconds apart.
- Don't commit captured response bodies: they can hold personal data (recruiter names, emails).
  Record keys and URL templates only.

Findings live in `docs/research/employer-coverage-recon.md`.
