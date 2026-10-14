# Placed Autopilot (Chrome extension, MV3)

Fills an internship application form on Greenhouse, Ashby or Lever from your Placed pack, marks every field, and
stops. **It never presses Submit.** You check everything and submit yourself.

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and select this `extension/` folder.
3. Press the reload icon on the extension card whenever you change a file here.

### Pointing it at a deployed Placed

By default the extension talks to `http://localhost:3200`. For a deployed app, e.g. `https://placed-demo.vercel.app`:

1. In `config.js` set `globalThis.PLACED_ORIGIN = "https://placed-demo.vercel.app";` (no trailing slash).
2. In `manifest.json` add the same origin to `host_permissions`, e.g.
   `"host_permissions": ["http://localhost:3200/*", "https://placed-demo.vercel.app/*", "https://*.supabase.co/*"]`.
3. Reload the extension. The claim route only accepts `chrome-extension://` origins (never the employer page's own
   origin, so a page script cannot claim a leftover link); the token is the credential.

### Optional hardening: pin the extension id

By default the claim route accepts any well-formed `chrome-extension://<32 letters a-p>` origin. To accept only your
copy of the extension, set `PLACED_EXTENSION_ID` in the app's environment (`.env.local` or Vercel):

1. Open `chrome://extensions`, switch on **Developer mode**, and find the Placed Autopilot card.
2. Copy the 32-letter **ID** shown on the card (for an unpacked extension it is stable as long as you load the same folder path).
3. Set `PLACED_EXTENSION_ID=<that id>` and restart the app.

## Use

In Placed, open a job, review the Application Pack and press **Open & fill**. The employer form opens with a one-time
link; the extension claims the pack, fills what it can and shows a purple panel bottom-right.

- Green outline: filled by Placed (the tag says where the answer came from).
- Amber: please choose this yourself. "Click this box, Autopilot will pick" means: open that dropdown and Autopilot
  selects your saved answer for you.
- Dashed grey: your call (diversity questions, consent boxes, unapproved drafts and anything Placed doesn't know).

## What is not supported

- Greenhouse forms **embedded in an employer's own careers site** (an iframe from `boards.greenhouse.io/embed/...`).
  Open the job on `job-boards.greenhouse.io` instead; that is the link Placed opens.
- Pages where the application form is not open yet (e.g. an Ashby job's Overview tab). Autopilot waits up to
  10 seconds for the form and otherwise asks you to open the form and click **Open & fill** again. Your link is not
  used up in that case.

## The "started debugging this browser" bar

While dropdowns are filled, Chrome shows **"Placed Autopilot started debugging this browser"**. This is expected:
dropdowns such as Greenhouse's ignore synthetic clicks, so the extension uses Chrome's debugger API to make a real
click on the dropdown box. It attaches once before filling starts, checks every click twice (in the page and again
in Chrome at the exact pixel, which must be inside the dropdown Autopilot marked), and detaches when filling ends, on
navigation, when the tab closes, or after 60 seconds idle. If you dismiss the bar or DevTools is open, those
dropdowns turn amber instead.

## Security

- The one-time token travels only in the URL fragment (`#placed=…`), which is never sent to the employer. `capture.js`
  removes it from the URL at `document_start`, before the page's scripts run, and keeps it in the extension's
  isolated world, which the page cannot read.
- The pack is claimed by the extension's service worker (`background.js`), not by the employer page, and the signed
  CV link is downloaded there too, so neither ever touches the employer's page context. Each link works once and
  expires after 10 minutes. The token is never logged.
- `host_permissions` are only the Placed app and Supabase storage (for the CV). The employer sites need no host
  permission: the content scripts are injected by their `matches` entries, and the debugger API needs none.
- Every click goes through `PlacedGuard.safeClick` (`lib/guard.js`), which refuses submit controls, including
  JS-driven ones such as Lever's `#btn-submit` and Ashby's "Submit Application" button.
