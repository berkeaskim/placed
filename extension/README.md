# Placed Autopilot (Chrome extension, MV3)

Fills an internship application form on Greenhouse, Ashby or Lever from your Placed pack, marks every field, and
stops. **It never presses Submit.** You check everything and submit yourself.

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and select this `extension/` folder.
3. Set `PLACED_ORIGIN` in `config.js` to where the Placed app runs (default `http://localhost:3200`; use your
   `https://<app>.vercel.app` for a deployed demo), then press the reload icon on the extension card.

## Use

In Placed, open a job, review the Application Pack and press **Open & fill**. The employer form opens with a one-time
link; the extension claims the pack, fills what it can and shows a purple panel bottom-right.

- Green outline: filled by Placed (the tag says where the answer came from).
- Amber: please choose this yourself. "Click this box, Autopilot will pick" means: open that dropdown and Autopilot
  selects your saved answer for you.
- Dashed grey: your call (diversity questions, consent boxes, unapproved drafts and anything Placed doesn't know).

## The "started debugging this browser" bar

While dropdowns are filled, Chrome shows **"Placed Autopilot started debugging this browser"**. This is expected:
dropdowns such as Greenhouse's ignore synthetic clicks, so the extension uses Chrome's debugger API to make a real
click on the dropdown box (only after checking it is not a submit button). It detaches when filling ends. If you
dismiss the bar or DevTools is open, those dropdowns turn amber instead.

## Security

- The one-time token travels only in the URL fragment (`#placed=…`), which is never sent to the employer. `capture.js`
  removes it from the URL at `document_start`, before the page's scripts run, and keeps it in the extension's
  isolated world, which the page cannot read.
- The pack is claimed from the content script, so the request comes from the employer page's origin, which the
  Placed CORS allowlist accepts. Each link works once and expires after 10 minutes.
- Every click goes through `PlacedGuard.safeClick` (`lib/guard.js`), which refuses submit controls, including
  JS-driven ones such as Lever's `#btn-submit` and Ashby's "Submit Application" button.
