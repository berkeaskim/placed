# Placed Autopilot: Design Spec

> **Status:** Approved in brainstorming (2026-10-14) · **Owner:** Berke · **Deadline:** Friday 2026-10-16
> **Board decision:** `memory/board-meetings/decisions.md`, 2026-10-14 ("Crown feature")
> **Branch / worktree:** `feat/autopilot` in `~/Repository/ucl-hackathon-autopilot`, based on `feat/placed-build` at 88be367

## 1. Goal

Students fill the same application form fields again and again. We fetched 111 of the 152 Greenhouse forms in `seed/jobs.json` from the public API on 2026-10-14:

- The average form has **17.2 questions**. The longest has 46.
- **39 of 111** (35%) have at least one free-text question, for example Monzo's "Let us know why you're excited to work for Monzo? (250 word limit)", "Why Anthropic?" and "Why do you want to join Figma?".

Autopilot reads each form through the ATS's public API and fills it from a one-time **Answer Vault**. It drafts the free-text answers only from the student's own evidence. A Chrome extension then fills the real employer page and **stops at Submit**.

**Success criterion (demo):**
1. Ayşe (the fictional demo persona) completes setup in about 2 minutes, which unlocks Autopilot.
2. On the Monzo Associate Data Scientist Intern job, she reviews the Application Pack.
3. She clicks "Open & fill", and the real Monzo form fills in seconds and stops at Submit.

**Pitch line:** "17 questions, 100 applications: 1,700 boxes. Autopilot fills the boring 90%. You write the part that matters, and press Submit."

## 2. Non-negotiable rules

1. **Placed never submits.** The extension never triggers a submit event or clicks a submit control. This is enforced by a unit test, plus a code guard in the fill engine that refuses `submit`/`requestSubmit` and clicks on `[type=submit]`.
2. **No EEO or diversity data.** Questions about gender, ethnicity, race, disability, veteran status, sexuality, religion, socio-economic background, free school meals, first-generation status or caring responsibilities are never stored and never filled. The server rejects writes of such keys to the Vault.
3. **Right to Work and sponsorship come only from the student's own answer.** They are never inferred from the CV or from `profiles.needs_visa` without confirmation. In the pack they always appear as "Confirm" items.
4. **No unapproved AI text in a form.** A free-text draft reaches the form only after the student approves it ("This is my answer"). Every sentence must cite a source. Sentences that fail the gate are removed and shown under "Caught it".
5. **Consent and declaration checkboxes** (privacy notice, candidate data, interview conduct, confidentiality) are left for the student to tick.

## 3. Scope

**In scope (v1):**
- `/autopilot/setup`: core Vault plus the unlock gate.
- Form adapters for Greenhouse, Ashby and Lever.
- Application Pack panel on `/jobs/[id]`.
- Free-text drafts through the gate.
- One-time handoff link.
- MV3 Chrome extension.
- Fixtures, tests, and a new demo step.

**Out of scope (roadmap slide):**
- Batch mode.
- Pairing the extension to an account (a long-lived token).
- An LLM agent mode for non-API forms such as Workday.
- Cover-letter generation. The cover letter field gets the tailored CV or is left for the student.

## 4. User flow

### 4.1 `/autopilot/setup`: the Answer Vault and unlock

Setup is a set of cards with a progress bar ("3 steps to unlock Autopilot"). Fields are prefilled from onboarding (`profiles`), the parsed CV and the auth email, and the student confirms each prefill.

The core fields come from how often each one appears across the 111 forms:

| Card | Fields (form frequency) |
|---|---|
| Identity | first name, last name, preferred name (opt), email (100%), phone (100%) |
| Education | university (46%), degree/course (42%), year of study, graduation month and year (41%), grades/classification (opt, 13%) |
| Eligibility | country and city of residence (80%), UK Right to Work status (32%) from fixed options, needs sponsorship now or in future (54%) as yes/no |
| Availability | earliest start date and preferred internship length (30%), outstanding offers/deadlines (opt) |
| Links | LinkedIn (67%), GitHub, portfolio or website (22%), all optional |
| Defaults | "How did you hear about us?" default answer (63%), languages with levels (opt), pronouns (opt, 22%) |

- **Unlock rule:** Autopilot unlocks when every non-optional field is set. `autopilot_vault.completed_at` is stamped and XP is awarded once through `awardXP`, with the service role.
- A permanent note on the page reads: "We never store questions about gender, ethnicity, disability and similar. You answer those on the form yourself."
- The Vault is editable later from the same page. A "Delete my Autopilot data" button is added, and the existing delete-my-data flow also clears both new tables.

### 4.2 Application Pack on `/jobs/[id]`

- An **"Autopilot this application"** button. When the Vault is incomplete it shows locked and links to setup.
- Clicking it builds the pack. Each form question appears in exactly one group:
  - ✅ **From your Vault:** value plus source chip, e.g. "Graduation year → 2028 · from your setup".
  - ❓ **Ask once:** a question that maps to no Vault key, e.g. "What's your level of German?". It is answered inline and stored in `autopilot_vault.extra` under its normalized label. Next time it is ✅.
  - ☑️ **Confirm:** RTW, sponsorship, and any select where option mapping was not exact. The student picks or confirms the option.
  - ✍️ **Draft, needs approval:** free-text questions. Each shows the draft, a word counter against the limit, a source per sentence and "Caught it" removals. The student edits, then clicks "This is my answer".
  - 🚫 **Yours to fill:** EEO, consent and declaration questions, and "Have you previously worked here?".
- **CV file:** the tailored PDF for this job if one exists (`applications.tailored_cv_path`), otherwise the active CV.
- **"Open & fill →"** is enabled when there are no open ❓ or ☑️ items. Drafts may stay unapproved; an unapproved draft field is left empty, not filled.

### 4.3 On the employer page (extension)

1. Placed opens `<canonical form URL>#placed=<token>`.
2. The extension claims the token, strips the hash with `history.replaceState`, and fills the fields.
3. Filled fields get a green outline and a small "Placed · from your setup" tag. Unfillable fields get a yellow "Please select this yourself". 🚫 fields get a grey "Your call" tag.
4. A floating panel shows "14/17 filled · 3 for you", with an arrow next to Submit: "Check everything. You press Submit."
5. When the student returns to Placed, the existing "Did you apply?" flow and the tracker take over.

## 5. Architecture

### 5.1 `lib/autopilot/`

| Unit | Responsibility | Depends on |
|---|---|---|
| `forms/types.ts` | `NormalizedForm`, `FormField { key, label, type: text\|textarea\|select\|multiselect\|boolean\|file\|date\|location, required, options: {label,value}[], wordLimit?, target }`. `target` is the ATS-specific DOM handle (Greenhouse field `name`, Ashby field `path`, Lever `name`). | none |
| `forms/greenhouse.ts` | `GET boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true`. Maps `questions[]` and `location_questions[]`, ignores `latitude`/`longitude` (location autocomplete internals), and parses the word limit from the label (`/(\d+)\s*word/i`). | fetch |
| `forms/ashby.ts` | `POST jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting` with `jobPosting.applicationForm.sections.fieldEntries`. Maps Ashby field types (String, Email, Phone, File, LongText, Boolean, ValueSelect, MultiValueSelect, Date, Location). | fetch |
| `forms/lever.ts` | `GET jobs.lever.co/{site}/{id}/apply`. Parses the standard fields (`name`, `email`, `phone`, `org`, `urls[...]`, `comments`, `resume`) plus custom `cards[...]` from the embedded `baseTemplate` JSON. | fetch |
| `forms/index.ts` | `fetchForm(job) → NormalizedForm` dispatches on `company_ats`. Caches the snapshot into the pack. | adapters |
| `classify.ts` | Deterministic label → `{ kind: "vault", key } \| "extra" \| "eeo" \| "consent" \| "freeText" \| "file" \| "unknown" }`. EEO and consent patterns are checked **before** anything else. No LLM. | none |
| `options.ts` | Maps a Vault value to a select's options: exact or normalized match, then a synonym table (RTW and sponsorship phrasings, yes/no, year names). Returns `{ value } \| { ambiguous: options }`. RTW and sponsorship are always marked `confirm: true`. | none |
| `drafts.ts` | Free-text drafts via `runAi({ fn: "autopilotDraft", fixtureKey: jobExtId })` with schema `{ sentences: [{ text, about: "me"\|"them", refs: string[] }] }`. `about:"me"` refs must be CV bullet ids or `confirmed_facts` ids. `about:"them"` refs must be JD `text_lines` indices. Then the gate (§5.2). | `lib/ai/provider`, `lib/verify/checks-extra` |
| `pack.ts` | `buildPack(userId, jobId)` runs fetch, classify, fill from the Vault, options and drafts, and returns `Pack { groups, cvFile }`. | all above |
| `vault.ts` | Read/write the Vault, the EEO key denylist, `isComplete(core)`. | supabase |
| `handoff.ts` | Creates a token (32 random bytes, base64url), stores its SHA-256 with a 10-minute expiry, `claim(token)`. | supabase admin client |

### 5.2 Draft gate

For each sentence:
- **No refs, or refs that don't resolve:** remove it and report "no source".
- **`about:"me"`:** wrap it as a `TailoredBullet` with `sourceRefs = refs` and run `scopedMetrics` (with `confirmedFacts`), `siblingContamination`, `authorshipEscalation` and `qualifierDrop` against the referenced CV bullets. Remove it on any `block` issue.
- **`about:"them"`:** every number and proper noun in the sentence must appear in the referenced JD lines; otherwise remove it.

After the gate:
- Count words in code. If the draft is over the limit, drop trailing sentences.
- If the draft is under 40% of the limit, show "Too thin, add your own words".
- Removed sentences appear under "Caught it" with the reason.

The JD is wrapped in `<job_posting>` and the CV in `<cv>`. Both are treated as untrusted data, per the existing prompt rules.

### 5.3 Database: `supabase/migrations/0012_autopilot.sql`

Number 0012 is claimed: 0010 exists twice (`feat/target-role`, `feat/ingest-coverage`) and one of those will become 0011. **Berke applies it. Claude never runs migrations.**

```sql
create table public.autopilot_vault (
  user_id uuid primary key references auth.users on delete cascade,
  core jsonb not null default '{}',
  extra jsonb not null default '{}',      -- normalized question label -> answer
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
-- RLS: owner select/insert/update/delete. completed_at is written only by the server action after validation.

create table public.autopilot_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  form jsonb not null,                    -- NormalizedForm snapshot
  answers jsonb not null default '{}',    -- field key -> value / approved draft
  status text not null default 'draft' check (status in ('draft','ready','claimed')),
  token_hash text unique,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
-- RLS: owner select only. All writes go through server actions using createAdminClient(), same pattern as tailored_cv_path.
```

### 5.4 Handoff API: `app/api/autopilot/claim/route.ts`

- `POST { token }` → hash it → find the pack where `token_used_at is null and token_expires_at > now()` → set `token_used_at` and `status='claimed'`.
- Returns `{ ats, fields: [{ target, type, value | null, mode: "fill"|"yours"|"select-yourself", sourceLabel }], cv: { signedUrl (60 s), filename } }`.
- It returns only this form's fields and never the whole Vault.
- CORS is allowed only for `https://job-boards.greenhouse.io`, `https://boards.greenhouse.io`, `https://jobs.ashbyhq.com` and `https://jobs.lever.co`. `OPTIONS` is handled.
- Errors are 410 for expired or used tokens and 404 for unknown ones. The extension then shows "Re-open from Placed". In Placed, "Open & fill" always mints a fresh token.

### 5.5 Extension: `extension/`

- MV3, plain JS, no build step.
- `manifest.json` lists `content_scripts` for the four ATS hosts above and `host_permissions` for the Placed origin. The origin is configurable in `extension/config.js`, with localhost by default for the demo.
- `content.js`:
  1. Read `location.hash`.
  2. Claim the token.
  3. Strip the hash.
  4. Fill each field through an ATS-specific filler (`fillers/greenhouse.js`, `ashby.js`, `lever.js`).
- **Text and textarea:** native value setter, then `input`/`change` events.
- **Selects:** native `<select>` gets value plus `change`. React-select comboboxes are opened, the option text is typed, and the matching option is clicked; if that fails, the field is marked yellow.
- **Checkboxes and booleans:** clicked only for Vault booleans. Consent is never clicked.
- **File:** fetch the signed URL → `File` → `DataTransfer` → `input.files`, then `change`.
- **Overlay:** green, yellow and grey tags plus a floating progress panel.
- **Submit guard:** `fillers/guard.js` wraps every click helper and throws if the target is a submit control or inside a submit button.

## 6. Error handling

| Case | Behaviour |
|---|---|
| Form API unreachable, or job closed | No pack. Shows "We couldn't read this form. Here's the normal Apply link." |
| Token expired or used | Extension shows "Re-open from Placed". The pack is kept, and "Open & fill" mints a new token. |
| Field in pack not found on the page | That field is marked yellow and filling continues. |
| Drafts gutted by the gate (<40% of limit) | Shows the "Too thin" warning; approval is still required. |
| AI unavailable | Fixture if present, otherwise the draft field becomes "Write this one yourself" and the rest of the pack works. |
| Extension not installed | The "Open & fill" tooltip links to the install instructions. The page opens normally without filling. |

## 7. Testing

- **`classify`:** snapshot test over the real labels from the 111 forms, saved to `tests/fixtures/autopilot/labels.json`. A dedicated test asserts that no EEO or consent label ever maps to `vault`/`extra`.
- **`options`:** RTW and sponsorship phrasings from the real forms; ambiguous cases return `ambiguous`.
- **Adapters:** recorded fixtures for Greenhouse (Monzo 8232726), Ashby (Multiverse b8c115ed…) and Lever (Palantir 774cf5c9…). No live network in unit tests.
- **`drafts` gate:** fixture drafts containing a fabricated number, a sibling-tool swap, an unsourced sentence and a "them" sentence with an invented fact. All four are removed.
- **Claim route:** single use, expiry, unknown token, CORS allow and deny.
- **Vault:** EEO key write rejected; `isComplete`.
- **Extension:** a unit test for the submit guard. A Playwright e2e loads the unpacked extension in Chromium against a saved local copy of the Monzo form, checks that the fields are filled, and asserts **no submit network request** was made.
- **e2e app flow:** setup → unlock → Monzo pack → "Open & fill" mints a token.

## 8. Demo (new REHEARSAL step, about 40 s, after tailoring)

1. Ayşe opens the Monzo Associate Data Scientist Intern job and clicks **Autopilot**. The pack shows 15 green, "Level of German?" as ask-once, and the "Why Monzo?" draft with "Caught it: 1 sentence removed".
2. She approves and clicks **Open & fill**. The real Monzo page fills in seconds and stops at Submit.
3. Line to say: "Placed never presses Submit."

Fixtures: `fixtures/ai/autopilotDraft/<monzo ext_id>.json` (hand-labelled) and the Monzo form snapshot. Before the demo, check that the Monzo job is still live (as for Lendable). If it is gone, pick another live Greenhouse internship with a "Why us?" question and re-key the fixtures.

## 9. Delivery guardrails (from the COO)

- Work only in the `feat/autopilot` worktree; never in the shared main checkout.
- The only migration is 0012. No changes to `verifyTailoring`, scoring or ingest; Autopilot reuses `checks-extra` read-only.
- `AI_MODE=fixture` must run the whole demo path offline. The extension needs the network only to reach the employer page.
- Behind `NEXT_PUBLIC_AUTOPILOT=1`, off by default until it passes rehearsal.
- New feature work starts no later than Thu 12:00; code freeze Thu 20:00. Whatever isn't green goes to the roadmap slide.

## 10. Open risks

- **Greenhouse react-select comboboxes** may resist programmatic selection. Spike this first, within 2 hours, on the Monzo form. Fallback: mark selects yellow and fill everything else.
- **Programmatic file upload** may be rejected by some forms. Fallback: a yellow "Drag your CV here" tag with a download link to the right file.
- **Ashby rate limits or `null` postings:** the adapter treats `null` as "couldn't read this form".
- **Merge debt:** `main` is 91 commits behind and the 0010 collision is unresolved. This spec does not fix it, but the demo depends on it being fixed.
