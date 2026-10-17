# Autopilot chat: answering application questions one at a time

Date: 2026-10-17 · Branch: `feat/autopilot-chat`

## Intent

Today the Autopilot panel on a job page (`app/(app)/jobs/[id]/autopilot-panel.tsx`) lists every question of the
application form at once, split into groups (vault, ask, confirm, draft, cover, yours). Berke's complaint: the page
feels crowded. Even with most answers pre-filled, the user faces a wall of rows.

We replace the panel entirely with a chat: a bot asks one question at a time, the user answers with a tap or a few
words, and a slim progress list beside the chat shows where they are. Same idea as the cover-letter chat that already
ships, applied to Autopilot.

The back end does not change. Pack building (`lib/autopilot/server.ts` `buildPack`, `lib/autopilot/pack.ts`
`assemblePack`), answer saving (`autopilot-actions.ts` `setAnswer`), remembered answers (PR #20, `findRemembered`),
AI suggestions (`lib/autopilot/suggest.ts`) and drafts (`lib/autopilot/drafts.ts`) all stay. This is a UI rewrite
plus two small new AI calls for long answers and on-demand, stored drafts (see "Speed" below).

## Goals

- One question on screen at a time; the user never sees the full form as a wall.
- Answering a short question takes one tap where possible.
- Long free-text questions offer a choice: let the bot write it, get ideas and write it yourself, or write from scratch.
- The user can always see how much is left and jump back to change any answer.
- "Open & fill" appears once everything blocking is answered, exactly as `canOpen` decides today.

## Non-goals

- No change to which questions get asked, the remembered-answer rules, or the vault.
- No rewrite of the cover-letter chat. Cover-letter items hand off to the existing cover-letter chat.
- No change to the browser extension. It still claims a finished pack and fills the form.

## Anti-goals

- A chat that is slower than the old panel for a user whose answers are mostly remembered. If 12 of 14 are known,
  the chat must not walk them through 12 confirmations.
- A bot that invents things. Drafts and ideas follow the same grounding rule as today: only claims backed by the user's
  CV / facts survive (`gateSuggestions`, the drafts verifier).
- Any user-facing text in Turkish. All UI copy is English.

## Placement (Berke's decision)

The right sidebar of the job page (`page.tsx`, `lg:grid-cols-[minmax(0,1fr)_400px]`) is too narrow for two columns.
The sidebar keeps a compact Autopilot card with a **Start Autopilot** button (and a short status once started, e.g.
"3 of 5 left"). Pressing it opens the chat **full width above the job description**, the same way
`CoverLetterHost` opens the cover-letter chat today. If both are open, they stack in the same top area; opening one
from the other (the cover handoff) scrolls to it.

## Layout (Berke chose option B)

Two columns inside that full-width area:

- **Left: chat.** Bot bubbles, user bubbles, and a composer at the bottom.
- **Right: progress list.** A progress bar, then every form question as a compact row: ticked (answered / filled from
  memory), current (highlighted), upcoming. Clicking a row scrolls the chat to that question and re-asks it so the
  answer can be changed.
- When nothing blocking is left, the list shows the **Open & fill** button under it. There is no separate summary card
  at the end; the list is the summary. (Claude's call; Berke was unsure about a summary card and this covers it.)

The brainstorm mockups were rough wireframes. The real screen follows the app's existing visual language (the
cover-letter chat bubbles and `components/cover-letter/motion.css`, the current panel's colours and button styles).

On narrow screens the progress list collapses to a thin bar with "3 of 5 left" above the chat that expands on tap.
(Claude's call.)

## Which questions the bot asks, and how

The bot walks pack items in form order and only stops on items that need the user:

| Pack group | In the chat | In the list |
|---|---|---|
| `vault` (exact memory / setup) | Not asked. One opening bubble: "I filled 9 answers from your profile and past applications." with a "Show" link that highlights them in the list. | Ticked, with its source label |
| `confirm` (AI suggestion or similar past answer) | Bot states the suggestion and its source: "From your CV: you have the right to work in the UK. Right?" Chips: the suggested value (primary) and "Change". | Current / ticked |
| `ask` (required, unknown) | Bot asks the field label. Answer control depends on the field (below). | Current / ticked |
| `draft` (long free text) | Long-answer flow (below). | Current / ticked |
| `cover` | Bot says a cover letter is needed and offers "Write cover letter", which opens the existing cover-letter chat via its window event (as the panel does today, `autopilot-panel.tsx:345`). | Ticked when the letter is ready |
| `yours` (EEO, consent, optional unknown) | Not asked. One closing bubble lists them: "You'll fill these yourself on the form: …". | Shown greyed as "You'll fill" |

Answer controls reuse the current panel's `Choice` logic: Yes/No chips for boolean, one chip per option when there
are 4 or fewer short options, a searchable dropdown for long option lists, toggle chips plus "Done" for multiselect,
and the free-text composer for text. File fields other than CV/cover stay "yours".

Right-to-work and sponsorship always need an explicit confirm, as today.

Every answer goes through `setAnswer` immediately, so leaving and coming back resumes where the user stopped: the chat
transcript is rebuilt from the pack plus saved answers. No separate chat-history storage is needed. (Claude's call.)

Changing a `vault` row from the list saves the new answer with the default remember behaviour, so the new value also
replaces the remembered one for later forms, matching how `setAnswer` works today. (Claude's call.)

## Speed: no AI on every visit (Claude's call)

Today `preparePack` regenerates every draft and re-runs suggestions on each call, and drafts are not stored. The chat
needs to start fast and resume cheaply, so this is the one back-end change:

- Building the pack for the chat skips draft generation. Short questions start as soon as the form and suggestions
  are ready.
- A draft is generated on demand when the user picks **Write it for me**, then stored with the job's pack (alongside
  `autopilot_packs.answers` or in a sibling column; builder decides, via a Drizzle migration if a column is needed).
  Revisits reuse the stored draft. Suggestions are likewise reused from the stored pack rather than re-run per visit.

## Long-answer flow (Berke's idea)

For a `draft` item the bot asks the question with its word limit, e.g. "Why Goldman Sachs? (up to 200 words)",
and offers three chips:

1. **Write it for me.** Shows the draft that `buildPack` already produced, with word count and the "Built from"
   source chips and "Caught it" notes the current `DraftRow` shows. Follow-up chips: **Use this**, **Shorter**,
   **Warmer**, **Edit**. "Use this" saves with `approved: true`. "Edit" puts the text in the composer; editing after
   approval withdraws approval, as today.
2. **Give me ideas.** The bot suggests 2–3 angles drawn from the user's CV / facts and the job, each one line, e.g.
   "Your Trading Society role maps to Markets." The user picks one or more, then writes in the composer with a live
   word counter. A **Tidy up** chip then polishes their text without adding new claims. (Tidy up is Claude's addition.)
3. **I'll write it.** Empty composer with a word counter.

A fourth, quieter chip, **Skip, I'll write it on the form**, moves on. A skipped draft shows greyed as "You'll fill" in
the list, as an unapproved draft becomes "yours" today. Drafts never block **Open & fill**: the button appears as soon
as `canOpen` is true, even mid-draft, and anything unapproved is left for the user on the form. (Claude's call.)

The cover item is ticked when the letter is ready: the chat reads the letter status when it loads and listens for the
cover-letter host's "ready" event, so it ticks live without a reload. (Claude's call; the builder adds the event if it
does not exist.)

If the draft is `thin` or `source: "none"`, option 1 says so honestly ("Not enough on your CV for this one, add your
own words") and leans the user toward ideas or writing.

New AI calls needed: **ideas** (angles for a question) and **revise** (Shorter / Warmer / Tidy up). Both go through the
existing provider layer (`generateStructured` / `runAi`) and the same verification as drafts, so nothing ungrounded
reaches the user. For **revise**, the allowed sources are the CV, the facts, and the text being revised: the user's own
claims are kept, and only claims the model adds without support are caught. (Claude's call.) Both need fixture responses for `AI_MODE=fixture` so Playwright runs offline.

## What gets removed

`AutopilotPanel`'s grouped list (`QuestionRow`, `DraftRow`, the group sections, "Confirm all N suggestions"). Pieces
worth keeping move into the new chat: `Choice`, draft display bits (source chips, caught notes, word count). Whether
"Confirm all" survives as a single chip ("Looks right, confirm all 3") when several confirms are pending is left to the
builder.

## Left to the builder

- Component structure, file names, and whether a generic chat shell is extracted from the cover-letter `ChatPane` or
  written fresh. Recon suggested a new small shell reusing the cover-letter styles and the panel's `Choice`.
- Exact bot wording, as long as it is short, English, and names where a suggestion came from.
- Animation and typing-indicator details, following `motion.css`.
- Tests: unit tests for the "next item to ask" logic and transcript rebuild; a Playwright run of a full pack in fixture mode.

## Addendum (2026-10-17, Berke during the build)

Two requests that change the "no change to remembered-answer rules" non-goal:

1. **Diversity answers are remembered.** Gender, ethnicity, disability and other EEO questions are no longer left
   "yours". The bot asks them once (with the form's own options, which usually include "Prefer not to say"), the
   answer is stored like any other remembered answer (encrypted vault, listed under Remembered answers with Forget),
   and later forms fill it automatically. EEO answers are never AI-suggested. Optional EEO questions are asked but never
   block Open & fill. **Consent and declaration checkboxes stay the user's own** (Claude's call: they are legal
   attestations; Berke can override).
2. **Long answers are reused.** An approved long answer is kept per job. On a later form, a long-answer question that
   matches an earlier one (same matching as remembered answers: exact normalised label, or ≥0.75 word overlap) gets an
   extra first chip: **Use my answer from {company}**. It shows that answer with the usual Use this / Shorter / Warmer /
   Edit chips and the word counter (red when over the limit). Previous long answers are listed under Remembered answers
   with Forget. Goal: the second application takes clearly less time than the first.
