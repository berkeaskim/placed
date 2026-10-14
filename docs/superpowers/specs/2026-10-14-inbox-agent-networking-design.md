# Inbox Agent and Networking — Design

Date: 2026-10-14 · Branch: `feat/inbox-network` (from `main`) · Worktree: `~/Repository/ucl-hackathon-inbox`
Status: approved in brainstorming, awaiting written-spec review.

## 1. Why

Two stages of the internship search are where students lose the most and Placed does nothing today:

- **Tracking.** Applications live in a spreadsheet that stops being updated within two weeks. The truth about each application (received, online test link, interview invite, rejection) sits in the student's inbox. Assessment links with 3–5 day deadlines are missed.
- **Networking.** Students don't know who to contact at a firm or what to write, so they don't.

Goal: the tracker updates itself from the inbox, and for every application the student knows which kinds of people to reach and has a draft they can send. Together with Autopilot this completes the pitch: find → tailor → fill → track → network.

### Decisions taken in brainstorming

| Question | Decision |
|---|---|
| Tracking source | Connect Gmail (read-only OAuth) |
| People data | Targeted LinkedIn search links; Placed never names or scrapes people |
| Message types | LinkedIn connection note, coffee-chat request, tracker-triggered suggestions |
| Gmail architecture | Separate "Connect Gmail" flow, on-demand sync (approach A). Cron sync is a later add-on. |

### Red lines (same as Autopilot)

- Placed never sends anything on the student's behalf. Every message is copied and sent by the student.
- No invented facts: outreach text may only use the student's CV, confirmed facts and the note the student typed.
- Full email bodies are never stored.
- An email never moves an application backwards.

## 2. Inbox Agent

### 2.1 Connection

- Routes: `GET /api/gmail/connect` builds the Google consent URL (scope `https://www.googleapis.com/auth/gmail.readonly`, `access_type=offline`, `prompt=consent`, a `state` nonce held in an httpOnly cookie). `GET /api/gmail/callback` checks `state`, exchanges the code and stores the refresh token.
- Independent of sign-in: a magic-link user can connect Gmail too. The Google account connected does not have to match the sign-in email; we store the connected address for display.
- The refresh token is encrypted with AES-256-GCM (`GMAIL_TOKEN_KEY`, 32 bytes base64) in `lib/gmail/crypto.ts` and written to `gmail_connections` with the service role. No user grant on that table: the client can only see whether a connection exists, through a server action.
- Disconnect: revoke at `https://oauth2.googleapis.com/revoke`, then delete the row and the user's `inbox_events`.
- The Google OAuth app stays in Testing mode; Berke adds test users. That is enough for the demo. Production would need Google's restricted-scope verification; this is out of scope.

### 2.2 Sync (`syncInbox` server action)

1. Get an access token from the refresh token.
2. Gmail search, `newer_than:60d`, max 100 messages, built in `lib/gmail/search.ts`:
   `from:(greenhouse.io OR greenhouse-mail.io OR ashbyhq.com OR lever.co OR hire.lever.co OR myworkday.com OR myworkdayjobs.com OR smartrecruiters.com OR hirevue.com OR shl.com OR arcticshores.com OR pymetrics.com OR sova.co.uk OR cappfinity.com) OR "<company name 1>" OR …` with the company names from the user's tracker (top 30, quoted).
   The domain list is a constant with a comment; it is a starting list and will be checked against real demo emails.
3. For each message not already in `inbox_events`: read `From`, `Subject`, `Date` and the first ~2,000 characters of the plain-text body (HTML stripped).
4. `classifyEmail` (`lib/inbox/classify.ts`, `tier:"fast"`, via `runAi`) returns, validated with zod:
   ```ts
   { kind: "received" | "assessment" | "interview" | "offer" | "rejection" | "other",
     company: string | null, roleHint: string | null,
     deadline: string | null /* ISO date, only if stated in the email */,
     actionUrl: string | null /* only a URL present in the email */,
     confidence: number /* 0..1 */ }
   ```
   Guard after the model: `deadline` must parse and be within ±1 year; `actionUrl` must appear verbatim in the email text, otherwise it is dropped.
5. `matchApplication` (`lib/inbox/match.ts`): normalised company name (case, punctuation, suffixes such as Ltd/LLP/plc, "&"→"and") against the user's applications. If several applications share the company, choose by `roleHint` token overlap with the job title; if still tied, pick none.
6. `applyEvent` (`lib/inbox/apply.ts`) decides the effect and writes `inbox_events` with the service role.

### 2.3 Update rules

- Status rank: saved 0 < applied 1 < interview 2 < offer 3. `rejected` is reachable from any status.
- Map: received→applied, assessment→applied, interview→interview, offer→offer, rejection→rejected, other→no change.
- Move only if the new rank is higher (or the event is a rejection). Never move backwards. Same rule as `statusAfterApply` on main.
- Auto-move only if `confidence ≥ 0.7` **and** the email matched an application. Otherwise the event is stored with `effect = 'suggested'` and shown as "This email might be about X".
- Unmatched emails with a known company and kind ≠ other: suggestion "Not in your tracker — add it?" (creates a `saved` card on click; does not auto-create).
- Each auto-move stores `prev_status` so it can be undone. `undoInboxEvent` restores `prev_status` only if the application is still in the status the event set; otherwise it reports "already changed".
- XP: status changes from the inbox award XP through the existing `awardXP` path, once per stage as today. Undo does not claw back XP (existing once-per-stage dedupe prevents farming).
- `applications.next_deadline` = earliest future deadline among the application's events; `last_event_at` = latest email date.

### 2.4 Tracker UI

- `InboxBanner` at the top of `/tracker`: Connect Gmail / last synced time + Sync button / reconnect warning / Disconnect.
- On a card: evidence line ("Moved to interview: 'Invitation to interview', 12 Oct" with Undo), countdown chip ("SHL test: 2 days left", red under 48 h), and a link to the email's action URL when present.
- Suggestions list under the banner for low-confidence and unmatched events.

### 2.5 Demo / fixture mode

- When `AI_MODE=fixture` or the user is the demo persona, `lib/gmail/fixtures.ts` returns 8 realistic emails instead of calling Gmail, and `fixtures/ai/classifyEmail/<id>.json` gives their classifications. Companies match the demo persona's tracker.
- The demo set covers: received, SHL assessment with deadline, HireVue invite, interview invite, rejection, an offer, a "talent community" newsletter (other), and one unmatched company (suggestion).

### 2.6 Errors

- `invalid_grant` / 401 from Google: delete the connection, banner says "Reconnect Gmail".
- Model error or schema failure for one email: store the event as `kind='other'`, `effect='none'`. Never touch the tracker on a failure.
- Gmail rate limit / network error: the sync reports partial progress; already-processed messages are skipped next time.
- Idempotency: `unique(user_id, gmail_message_id)`.

## 3. Networking

### 3.1 People to reach (`lib/outreach/targets.ts`, no AI)

Shown on the job detail page and on tracker cards as a **People to reach** panel. For each target type: who, why, and a LinkedIn people-search link `https://www.linkedin.com/search/results/people/?keywords=<encoded>`:

| Target | Why | Keywords |
|---|---|---|
| `alumni` — UCL alumni at the firm | Shared university; most likely to reply | `"<company>" UCL` |
| `recent_joiner` — joined the programme 1–2 years ago | Has just been through the same process | `"<company>" "<programme or role word>" analyst` |
| `team` — someone in the division | Concrete knowledge of the role | `"<company>" <division keyword>` |
| `recruiter` — early careers / campus recruiter | Process and deadline questions | `"<company>" "early careers" OR "campus recruiter" OR "graduate recruitment"` |

- The division keyword comes deterministically from the job title (strip seniority/programme words such as intern, summer, analyst, 2027, placement; keep the remaining head noun phrase, e.g. "Technology", "Investment Banking", "Data").
- Placed shows no names, no profiles, does no scraping. The results are whatever LinkedIn shows the logged-in student.
- The UCL alumni page link (`linkedin.com/school/<slug>/people/?keywords=`) is **not** used until Berke confirms the slug while logged in. It could not be verified on 2026-10-14 (LinkedIn requires login).

### 3.2 Drafting (`draftOutreach`, `lib/outreach/draft.ts`)

Input: target type, company, job title, the student's parsed CV and confirmed facts, an optional recipient first name, and an optional one-line note from the student ("we both studied Economics").
Output (zod):
```ts
{ connectionNote: string /* ≤ 300 chars */, coffeeChat: string, questions: string[] /* 2–3, role-specific */ }
```
- `tier:"fast"`, through `runAi`, fixtures for the demo persona.
- Coffee chat: short, asks for 15 minutes, includes the questions, no attachments, no request for a referral in the first message.

### 3.3 Guard (`lib/outreach/guard.ts`)

- `connectionNote.length ≤ 300` is enforced in code. If longer, one retry with the length stated, then hard truncate at the last sentence boundary under 300.
- Fabrication check: reuse `verifyTailoring`'s deterministic checks with the CV + confirmed facts + the student's note as the allowed source. Blocked: skills, numbers, employers, titles or tools not in the source; claims about the recipient ("I read your article", "we met at…") unless the student's note says so; claimed mutual connections.
- On a block: one re-prompt naming the blocked spans; if still blocked, remove the offending sentences and show "We removed a line we couldn't back up from your CV".

### 3.4 Tracker-triggered suggestions

- `interview` event → card shows "Interview at <company>. Ask a UCL alumnus there a prep question", opening the drafter with `alumni` preselected.
- No email for 21 days on an `applied` application → "Polite follow-up to the recruiter", drafter with `recruiter` preselected and a follow-up variant.
- (Priority 5, if time) post-interview thank-you.

### 3.5 Outreach records

`outreach` table: company, application (nullable), target type, drafted text, status `drafted | sent | replied` (the student marks sent/replied). Cards show "Reached 2 people, 1 reply". Never sends anything.

## 4. Data: `supabase/migrations/0013_inbox_outreach.sql`

(0012 is reserved by `feat/autopilot`. Re-check `ls supabase/migrations` on every branch before committing.)

```sql
create table public.gmail_connections (
  user_id uuid primary key references auth.users on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);
alter table public.gmail_connections enable row level security;
-- no policies and no grants: service role only

create type public.inbox_kind as enum ('received','assessment','interview','offer','rejection','other');
create type public.inbox_effect as enum ('moved','suggested','none','undone');

create table public.inbox_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  gmail_message_id text not null,
  application_id uuid references public.applications on delete set null,
  company text,
  subject text not null,
  received_at timestamptz not null,
  kind public.inbox_kind not null,
  deadline date,
  action_url text,
  confidence real not null,
  effect public.inbox_effect not null,
  prev_status public.app_status,
  new_status public.app_status,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);
-- RLS: select own rows; writes service role only

alter table public.applications
  add column next_deadline date,
  add column last_event_at timestamptz;
-- service-role writes only; do NOT add to the user column grants in 0008

create type public.outreach_target as enum ('alumni','recent_joiner','team','recruiter');
create type public.outreach_status as enum ('drafted','sent','replied');
create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid references public.applications on delete set null,
  company text not null,
  target public.outreach_target not null,
  recipient_name text,
  body text not null,
  status public.outreach_status not null default 'drafted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: select/insert own rows; user may update only status, updated_at
```

Delete-my-data (`app/(app)/settings`) must also revoke and delete the Gmail connection and delete `inbox_events` and `outreach`.

## 5. Files

```
lib/gmail/oauth.ts        consent URL, code exchange, refresh, revoke
lib/gmail/crypto.ts       AES-256-GCM encrypt/decrypt of refresh token
lib/gmail/search.ts       query builder, list + get messages, body → plain text
lib/gmail/fixtures.ts     8 demo emails
lib/inbox/classify.ts     classifyEmail (runAi) + zod schema + post-guards
lib/inbox/match.ts        company normalisation + application matching
lib/inbox/apply.ts        forward-only transitions, evidence, undo, deadlines
lib/outreach/targets.ts   target types, division keyword, LinkedIn URLs
lib/outreach/draft.ts     draftOutreach (runAi) + zod schema
lib/outreach/guard.ts     length + fabrication guard
app/api/gmail/connect/route.ts
app/api/gmail/callback/route.ts
app/(app)/tracker/actions.ts   + syncInbox, undoInboxEvent, disconnectGmail, addSuggestedApplication
app/(app)/outreach/actions.ts  draftOutreachAction, setOutreachStatus
components/tracker/InboxBanner.tsx, CardEvidence.tsx, DeadlineChip.tsx
components/outreach/PeoplePanel.tsx, OutreachDrafter.tsx
fixtures/ai/classifyEmail/*.json, fixtures/ai/draftOutreach/*.json
supabase/migrations/0013_inbox_outreach.sql
```

Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_KEY`, plus the redirect URI `<origin>/api/gmail/callback` registered in Google Cloud for localhost and the Vercel domain.

## 6. Testing

Unit (vitest):
- `apply`: forward-only, rejection from every status, low confidence → suggestion, undo only when status unchanged.
- `match`: suffix/punctuation normalisation, multiple applications at one company, tie → no match.
- `classify` post-guards: invalid/far deadline dropped, URL not in email dropped.
- `crypto`: round trip; tampered ciphertext fails.
- `targets`: URL encoding, division keyword for 10 real job titles from the seed.
- `guard`: 300-char limit; at least 5 fabricated claims caught (new skill, invented number, invented employer, "I read your article" without a note, mutual connection).

Classification eval: 8 demo emails + 4 hard cases (marketing email, talent-community newsletter, rejection that mentions "interview", email naming two companies), hand-labelled; run live with `vitest.live.config.ts`. Target: 12/12 on kind; wrong auto-moves = 0.

E2E (Playwright, fixture mode): demo sign-in → tracker → Sync → cards move with evidence → Undo → open People to reach → draft → copy.

## 7. Priority (cut from the bottom if time runs out)

1. Migration, fixture-mode Inbox Agent, tracker evidence + undo + deadline chip. *The demo moment.*
2. Real Gmail OAuth and sync.
3. People panel, target links, `draftOutreach` with guard.
4. Tracker-triggered suggestions.
5. Follow-up after 21 days, outreach status tracking, post-interview thank-you.
Later (not this week): Vercel cron background sync with deadline notifications; Outlook / Microsoft Graph for UCL mailboxes.

## 8. Needs Berke (Claude does not do these)

- Create a Google Cloud OAuth client, enable the Gmail API, set the consent screen to Testing, add test users, register redirect URIs.
- Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_KEY` in `.env.local` and Vercel.
- Apply migration 0013.
- Optionally confirm the UCL LinkedIn school slug while logged in.

## 9. Coordination

- `feat/autopilot` reserves 0012; this work uses 0013.
- A `docs/linkedin-playbook` worktree exists (empty `docs/research/linkedin/` on 2026-10-14). If that work produces LinkedIn outreach guidance, `draftOutreach` prompts should cite it rather than duplicate it.
- Both features touch `app/(app)/tracker/`; `feat/applied-and-diff` also changes tracker status logic. Rebase on main before merging.
