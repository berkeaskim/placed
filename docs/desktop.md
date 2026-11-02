# The Mac app

Placed for macOS is an Electron shell around the same Next.js app. Nothing about the product changes: SQLite, no login,
your choice of AI backend. The shell only starts the server and shows it in a window. Source is in `desktop/`;
build and dev commands are in `desktop/README.md`.

## Architecture

```
Electron main process (desktop/src)
  └─ utilityProcess.fork → Next.js standalone server.js   (Electron's bundled Node)
        └─ listens on 127.0.0.1:3917 only
  └─ BrowserWindow → http://127.0.0.1:3917
```

- The server is the `output: "standalone"` build, switched on by `PLACED_DESKTOP_BUILD=1` so a normal `next build` is unchanged.
- `better-sqlite3` ships Node-API prebuilds, so it loads under Electron's Node with no rebuild. The stage step checks this.
- The server's working directory is its own folder, because it reads `seed/`, `drizzle/`, `fixtures/` and `public/` from there.
- The extension zip is built for `http://127.0.0.1:3917`, so Autopilot → Setup needs no editing.
- Port 3917 is fixed. If it is taken, the app says so instead of picking another one (the extension needs a known origin).

## Build pipeline

`npm run desktop:dist` runs, in order:

1. `desktop:build:next`: pack the extension for the app origin, then `next build` with a throwaway `PLACED_DATA_DIR` (so `./data` is never created).
2. `desktop:stage`: copy `.next/standalone`, `.next/static` and `public/` into `desktop/stage/server`; fail if `data/` or `.env*` slipped in.
3. Compile the shell with `tsc`.
4. electron-builder: package `Placed.app`, ad-hoc sign it in the `afterPack` hook, write the DMG.

Output: `desktop/out/Placed-<version>-arm64.dmg` (plus `.blockmap`). The version is taken from the root `package.json`.

## Where things live

| What | Where |
|---|---|
| Data (`placed.db`, `files/`, `secret.key`) | `~/Library/Application Support/Placed/data` |
| Logs | `~/Library/Application Support/Placed/logs/server.log` (truncated at 5 MB on start) |
| Shell preferences | `~/Library/Application Support/Placed/desktop.json` |

The app menu has **Open Data Folder** and **Open Logs Folder**. Back up by copying the `data` folder with the app quit.

## Environment overrides

| Variable | Effect |
|---|---|
| `PLACED_USER_DATA_DIR` | Use this folder instead of `~/Library/Application Support/Placed` for data, logs and settings. |
| `PLACED_DATA_DIR` | Use this folder for the data only. |
| `PLACED_IMPORT_FROM` | On first run, import this folder (it must contain `placed.db`) without asking. |
| `PLACED_SKIP_FIRST_RUN_DIALOG` | `1` starts fresh on first run without the dialog. For testing. |

## Releasing

```bash
npm version 1.2.3          # bumps package.json, commits, tags v1.2.3
git push --follow-tags
```

The `Release` workflow (`.github/workflows/release.yml`) runs on a `macos-14` (Apple Silicon) runner for any `v*` tag.
It builds the DMG, fails if the DMG version does not match the tag, and attaches the `.dmg` and `.dmg.blockmap` to the
GitHub release with generated notes. Pull requests only run the shell typecheck (`npm run desktop:check`) on Linux.
`npm version` also copies the new version into `desktop/package.json` (the root `version` script) and commits it with the tag.

Only distribute the DMG the workflow builds. A local `npm run desktop:dist` embeds the build machine's absolute paths
in the standalone server and bakes in any `NEXT_PUBLIC_*` values from your `.env.local`; it is fine for testing, not for sharing.

## QA checklist

Before tagging a release, on an Apple Silicon Mac:

```bash
npm run desktop:dist
APP=desktop/out/mac-arm64/Placed.app
TMP=$(mktemp -d)
PLACED_USER_DATA_DIR=$TMP PLACED_SKIP_FIRST_RUN_DIALOG=1 $APP/Contents/MacOS/Placed &
# wait for "[desktop] server is up" in $TMP/logs/server.log, then click around (or curl a few pages):
for p in feed onboarding settings; do curl -s http://127.0.0.1:3917/$p >/dev/null; done
kill %1
codesign --verify --deep --strict $APP   # must pass after a run
# must print nothing (CodeResources is written last, by the ad-hoc signing step; Info.plist is not a safe reference)
find $APP/Contents/Resources/server -type f -newer $APP/Contents/_CodeSignature/CodeResources
```

The app must never write inside its own bundle (that breaks the signature, and fails outright on a read-only or
translocated copy). The desktop build keeps Next's ISR/fetch cache in memory (`experimental.isrFlushToDisk: false` in
`next.config.ts`, only when `PLACED_DESKTOP_BUILD=1`); everything else goes under the data folder.

## Known limits

- **Not notarised.** There is no Developer ID, only an ad-hoc signature, so a downloaded DMG is blocked on first open
  (right-click → Open, or Privacy & Security → Open Anyway; `xattr -dr com.apple.quarantine /Applications/Placed.app` also works).
- **Apple Silicon only.** Intel Macs should run from source.
- **Updates are in-app, not silent.** Squirrel.Mac needs a Developer ID, so Placed does it itself: "Update and Restart" downloads the release DMG, checks the bundle id, version and signature, swaps `Placed.app` after quitting and reopens it (data lives outside the bundle). A copy that can't replace itself (run from the DMG, App Translocation, or a folder it can't write) links to the release page instead. See `desktop/src/lib/self-update.ts`.
- **Open at Login** may be refused by macOS for an unsigned app.
