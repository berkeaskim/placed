# Placed for macOS (Electron shell)

The Mac app is a thin Electron shell. Its main process forks the Next.js `output: "standalone"` server
(`server.js`) with `utilityProcess.fork`, so Electron's bundled Node runs it, and shows one window on
`http://127.0.0.1:3917`. The server only ever listens on `127.0.0.1`.

## Run it in dev

```sh
npm --prefix desktop ci        # once: installs Electron, electron-builder and TypeScript for the shell
npm run desktop:build          # builds the standalone server into desktop/stage/server and compiles the shell
npm run desktop:start          # launches Electron against desktop/stage/server
```

`npm run desktop:dev` will wrap these once the build pipeline lands. To work on the shell alone:
`cd desktop && npm run build && npm start` (without a staged server you get the "server stopped" dialog).

Unpackaged, the shell looks for the server in `desktop/stage/server/server.js`; packaged, in
`Placed.app/Contents/Resources/server/server.js`. The server's working directory is that folder, because it reads
`seed/`, `drizzle/`, `fixtures/` and `public/` relative to it.

## Where things live

| What | Where |
|---|---|
| Data (SQLite `placed.db`, `files/`, `secret.key`) | `~/Library/Application Support/Placed/data` |
| Logs (server output and shell lines, truncated at 5 MB on start) | `~/Library/Application Support/Placed/logs/server.log` |
| Shell preferences | `~/Library/Application Support/Placed/desktop.json` |

The app menu has **Open Data Folder** and **Open Logs Folder**. On first launch with no `placed.db`, Placed offers
**Start fresh** or **Import existing data…**: pick the `data` folder of a Placed you ran from the repo and it is
copied (never moved).

## Environment overrides

| Variable | Effect |
|---|---|
| `PLACED_USER_DATA_DIR=<dir>` | Use `<dir>` instead of `~/Library/Application Support/Placed` for data, logs and settings. Use a scratch folder for testing. |
| `PLACED_DATA_DIR=<dir>` | Use `<dir>` as the data folder (logs stay under the user-data folder). |
| `PLACED_IMPORT_FROM=<dir>` | On first run, import `<dir>` (must contain `placed.db`) without the dialog. Empty means unset. |
| `PLACED_SKIP_FIRST_RUN_DIALOG=1` | On first run, start fresh without the dialog (QA only). |

Example: `PLACED_USER_DATA_DIR=$(mktemp -d) PLACED_SKIP_FIRST_RUN_DIALOG=1 npm run desktop:start`.

## Errors you may see

- **Port 3917 is in use**: another copy of Placed, or `npm run dev -- -p 3917`, is running. Quit it and reopen.
- **Server stopped before it was ready**: the dialog shows the last 20 log lines and can open `server.log`.
