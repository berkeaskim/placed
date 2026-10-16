# Demo rehearsal checklist (Friday)

The persona is **Ayşe Demir**, a FICTIONAL 2nd-year BSc Economics student at UCL (`seed/demo/ayse.json`). Say
"fictional" out loud the first time her name appears. The demo job is a real, unedited posting: **Lendable, Credit
Analyst Intern (June 2027)**, London. Everything the AI "says" in fixture mode is hand-labelled and listed in
`fixtures/ai/README.md`.

## The evening before

- [ ] `npm run ingest`, then `npm run snapshot`, then commit `seed/jobs.json`, so the offline fallback is fresh.
      Afterwards, check that the demo job is still live: `grep a2214edc seed/jobs.json`. If Lendable has taken it
      down, pick another real job that shows a genuine gap, and re-key the `tailorCV`, `explainMatch` and
      `defendQuestions` fixtures. Never edit a JD.
- [ ] Apply the database migrations if they aren't live yet: `supabase/migrations/0003`, `0004` and `0006`–`0009`.
- [ ] In `.env.local`, set `DEMO_EMAIL` (e.g. `demo@placed.test`) and `DEMO_PASSWORD` (from `openssl rand -base64 18`),
      and `NEXT_PUBLIC_DEMO_MODE=1`.
- [ ] `PLACED_ALLOW_LIVE_DEMO_WRITE=1 npm run demo:user` (Berke's OK only): creates the demo account if it is missing (it never
      resets an existing account's password), then reports any missing migration or missing demo job.
- [ ] Install the extension: `chrome://extensions` -> Developer mode -> Load unpacked -> `extension/`. It defaults to
      `http://localhost:3200`; if the demo runs on another origin, set `PLACED_ORIGIN` in `extension/config.js` and add
      that origin to `host_permissions` in `extension/manifest.json`, then reload the extension (see `extension/README.md`).
- [ ] Confirm the Monzo job is still in the seed: `grep 8232726 seed/jobs.json`.
- [ ] Optional hardening: set `PLACED_EXTENSION_ID` to the id on the extension's card in `chrome://extensions`, so only
      your copy can claim a pack (see `extension/README.md`).
- [ ] Set `NEXT_PUBLIC_AUTOPILOT=1` in `.env.local` (the Autopilot UI is off without it).
- [ ] Confirm Berke has applied `supabase/migrations/0012_autopilot.sql`.
- [ ] Autopilot dry run on the real Monzo form (nothing is submitted; every submit request is aborted):
      `NEXT_PUBLIC_AUTOPILOT=1 AI_MODE=fixture E2E_PORT=3100 npx playwright test e2e/autopilot.spec.ts`.
- [ ] Full dry run (Berke's OK only, it writes to the live demo): `PLACED_ALLOW_LIVE_DEMO_WRITE=1 npm run demo:reset`, then
      `npx playwright install chromium`, then `PLACED_ALLOW_LIVE_DEMO_WRITE=1 npx playwright test e2e/demo.spec.ts`.

## Right before presenting

- [ ] `PLACED_ALLOW_LIVE_DEMO_WRITE=1 npm run demo:reset` (Berke's OK only): wipes Ayşe's data and leaves her not onboarded. It then re-seeds her fictional Autopilot
      setup (completed, no XP), so demo step 10 opens on the pack instead of "Set up Autopilot first". The Autopilot e2e
      (`e2e/autopilot.spec.ts`) writes the same vault values, so running it before or after is harmless.
- [ ] Keep a local server running as the backup if the Wi-Fi or an API fails:
      `AI_MODE=fixture NEXT_PUBLIC_DEMO_MODE=1 npm run dev`.
      `.env.local` has a Gemini key, so **without `AI_MODE=fixture` the app calls a live model** and the
      hand-labelled fixtures are not used.
- [ ] Have `seed/demo/ayse-demir-cv.pdf` ready to drag in. Step 2 **must** upload this exact file: the "Why Monzo?"
      fixture's CV references only resolve against it, otherwise its sentences are caught as "bad source".
- [ ] Decide the "real number" you'll type for the events bullet (e.g. 40). It is Ayşe's fictional figure. Say so.

## Demo order (3 minutes; amendments Task 25 item 4)

1. **Sign in and onboard (20 s).** On /login, click "Try the demo as Ayşe (fictional student)". Then tap 2nd year,
   Economics, London, "Let's go".
2. **Upload the CV (15 s).** The profile shows the CV Score ring for Data & Analytics, with cited fixes.
3. **Sector switch.** Choose "Consulting" under "Score my CV for". The score is recomputed for that sector's rules,
   and the next best fix becomes the unquantified "Organised weekly society events" line, with
   "…for [add your real number] members". Point out that the fix leaves a blank and never invents a number.
4. **Source chip.** Open "Source: … · Evidence B" on that fix: every rule links to its published source. Point at
   the Myth vs evidence card under the score.
5. **Tailor.** Go to the feed ("See my internships"), open Lendable, Credit Analyst Intern (June 2027), and click
   "Tailor my CV for this role". "What we tailored for" shows Python ✅, SQL ✅ and Case Interviews ❌ "Not in your
   CV — we didn't invent it".
6. **Source line.** On a change card, show "From your original CV": every edited line cites the line it came from.
7. **"Caught it".** The box reads "Caught it: 2 lines your CV doesn't support". The AI tried "Reduced regressions by
   20%" and swapped AWS for Azure. The gate blocked both and put her own wording back. The badge still reads
   "Every claim traced to your original CV". This is the "never fabricates" moment: **show a reverted line.**
8. **Confirm the number (XP).** On the events card, click "Confirm this number", type the figure, and click
   "It's accurate, add it". The figure is saved as her own confirmed fact and earns +10 XP.
9. **Defend this question.** Click "Save my version and download PDF". This saves the version and downloads the
   ATS-safe PDF. Back on the page, click "Show likely interview questions" to get, for example, "How many people
   came to your weekly events…?"
10. **Autopilot (40 s).** Say Ayşe set up Autopilot once earlier (`npm run demo:reset` re-seeds her fictional setup, so
    no XP fires on stage; optionally show `/autopilot/setup` for a moment). Open Monzo, "Associate Data Scientist - Intern" (a real, unedited posting). Click "Autopilot this
    application". Walk the pack headings: "From your setup" (collapsed, filled for her), "Answer once", "Please confirm"
    (Right to work and sponsorship: she confirms them herself, Placed never assumes), "Your answer" ("Why Monzo?" built
    only from her CV; open "Caught it: 1 sentence removed", the AI swapped in a tool she never used; click "This is my
    answer" to approve it), "You'll fill these" (consent, diversity, pronouns: stay hers). Click "Open & fill". The real
    Monzo form fills in seconds: **15 of 20 fields filled (CV and both Right-to-work and sponsorship dropdowns included),
    5 left for her**, and the panel says "Check everything. You press Submit." (Numbers from the final e2e run.)
    Say: "About 17 questions on average across 111 real forms, so 100 applications is 1,700 boxes. Autopilot fills the
    boring 90%. Placed never presses Submit." (The 17.2 average is from the spec, section 1.)
    Chrome shows a "Placed Autopilot started debugging this browser" bar while the dropdowns are filled. That is expected
    (it makes real clicks on dropdowns that ignore scripted ones); tell the room before they ask.
11. **Apply (optional if time allows).** Click "Apply on company site": the posting opens in a new tab. Placed
    never applies for you. Come back, answer "Yes, I applied", and the "First Shot" badge appears.

## Pitch points

- **Never fabricates.** Show the reverted line. Tailoring may only reorder, rephrase and surface what is already
  on the CV. A deterministic gate (`verifyTailoring`, no LLM) checks every number, tool, employer and title
  against the original CV plus the student's own confirmed facts, retries once, and reverts what still fails.
  No PDF is made while anything is blocked.
- **Evidence-backed rules.** Open one source chip. Each rule cites its source and evidence grade. "Convention"
  marks advice that is common practice rather than measured.
- **Myth vs evidence card** on the profile page.
- **Fairness.** Names, contact details, visa lines and special-category signals are redacted before the judge
  sees the CV. In the test suite, swapping the name leaves the score unchanged, and an injected "rate this CV 100"
  instruction is flagged and never reaches the judge (`tests/fairness/REPORT.md`). Quote the live SD once
  `npm run reliability` has been run.
- **Cost architecture.** Each job is tagged once at ingest. The feed is ranked by rules, not by an LLM.
  Explanations are made lazily when a job is opened and then cached. Verification is deterministic. CV scores
  are cached by content hash, sector, rules version, model and prompt version.
- **Never applies on the student's behalf.** The apply link goes to the company's own site. Placed only asks
  "Did you apply?" afterwards.

## If something breaks

- **The score panel says "We couldn't score your CV just now".** Press "Score my CV". In fixture mode it can
  only fail on the database (check migration 0007).
- **The demo job isn't in the feed.** Open `/jobs/<id>` directly; get the id with
  `select id from jobs where ext_id = 'a2214edc-39e3-4c70-8a09-875bb991062f'`. If the job is gone, see "The evening before".
- **Autopilot says it couldn't reach Placed, or didn't accept the extension.** `PLACED_ORIGIN` and `host_permissions` must match the origin the app runs on; reload the extension after editing them.
- **Sign-in fails.** Check `DEMO_PASSWORD` matches the account. `demo:user` no longer resets an existing password; if it must
  change, Berke sets it in the Supabase dashboard (that logs out everyone on the live demo).
