# Interview Prep — design

Date: 2026-10-16 · Status: approved in chat, awaiting spec review

## Goal

When a student has applied to a job, Placed gives them an interview prep pack for that company and role, built from what
candidates have publicly reported (Reddit, Glassdoor, WallStreetOasis, TheStudentRoom) plus the job description, and tied
back to stories from their own CV.

Success: on `/jobs/[id]` for an applied job, one click returns within ~60 s (a cache hit is instant) a pack with the hiring process, 8–15 likely
questions (each marked as publicly reported or inferred), real source links, and 2–3 CV stories mapped to behavioural
questions. A second student with the same company and role gets the shared part instantly from cache.

Out of scope: mock interviews, voice practice, direct Glassdoor scraping, background generation on status change.

## Decisions (from chat)

- Source: Gemini Flash with Google Search grounding. No scraper. Glassdoor is behind a login wall and Cloudflare, and
  Reddit JSON is often blocked from Vercel IPs, so grounding is the only robust option for the deadline.
- Placement: a panel on `/jobs/[id]`, plus a `Prep →` link on tracker cards in the Interview column.
- Trigger: on demand (button). No auto-generation.

## Data

Migration `0015_interview_preps.sql` (Berke applies it; Claude never runs migrations):

```sql
create table public.interview_preps (
  company_id int not null references public.companies on delete cascade,
  role_key text not null,               -- `${archetype ?? 'general'}:${employment_type}`
  pack jsonb not null,                  -- InterviewPrepPack (shared, not personal)
  sources jsonb not null default '[]',  -- [{url, title}] from grounding metadata only
  grounded boolean not null,            -- false = inferred mode (no search)
  model_id text not null,
  created_by uuid references auth.users on delete set null,  -- for the daily generation cap
  created_at timestamptz not null default now(),
  primary key (company_id, role_key)
);
alter table public.interview_preps enable row level security;
create policy "auth_read" on public.interview_preps for select to authenticated using (true);
-- no insert/update policy: writes go through the service-role client only
```

- `role_key` reuses the job's existing `archetype` and `employment_type`, so there is no new normalisation step.
- Freshness: a row older than 14 days is treated as a miss and overwritten.
- The personal part (CV story mapping) is not stored. It is cheap, it is recomputed per request, and it never leaves the
  user's session.

## Generation — `lib/ai/interviewPrep.ts`

Two functions, both through `runAi` so fixture mode and fallbacks behave like the other AI features.

1. `generatePrepPack({ company, jobTitle, archetype, employmentType, jdText })` → `{ pack, sources, grounded }`
   - **Two steps** (probe 2026-10-16: with `googleSearch` and a JSON schema in one call, Gemini 3.8 Flash returned
     JSON but no `groundingMetadata`, so it had not searched and its "source" domains were unverified):
     a. Research: a grounded free-text call (`googleSearch` tool, no schema) through a new `generateGrounded` in
        `provider.ts` / `geminiGrounded` in `gemini.ts`. It returns `{ text, chunks: {uri,title}[] }`. The probe took
        about 37 s, made 9 searches and returned 22 chunks.
     b. Source resolution: each chunk uri is a `vertexaisearch…/grounding-api-redirect/…` link. A HEAD request with
        `redirect: "manual"` reads the `location` header to get the real page URL. Up to 12 sources are resolved in
        parallel with a 4 s timeout each. If a lookup fails, that source is dropped. Duplicates are removed.
     c. Structure: a normal `generateStructured` call (fast, thinking low) gets the research text and a numbered list
        of the resolved sources. Each question returns `sourceIndex` (an index into that list) instead of a URL.
   - The system prompt tells the model to search for "<company> <role> interview" on Reddit (r/FinancialCareers,
     r/cscareerquestionsEU, r/UKJobs, r/UniUK), Glassdoor, WallStreetOasis and TheStudentRoom, and to prefer UK
     graduate and internship reports. The JD is wrapped with the existing `UNTRUSTED_JD_RULE` / `wrapJob`.
   - Schema (`InterviewPrepPack`):
     - `process: { stage: string; note: string }[]` — for example online test, HireVue, assessment centre or superday
     - `questions: { question; category: 'behavioural'|'technical'|'motivational'|'case'; reported: boolean; whyTheyAsk; prepTip; sourceUrl?: string }[]`, 8–15 items
     - `tips: string[]`, at most 5
   - **Source integrity:** `sources` are only the resolved grounding chunks. A `sourceIndex` that is out of range or
     missing makes that question `reported=false` and leaves it without a link. The stored question carries
     `sourceUrl` copied from the list, so the model never writes a URL that the UI shows.
   - Anthropic provider: no grounding. The same prompt runs in "inferred" mode, so `grounded=false`, every
     `reported=false` and there are no sources. The UI labels this mode.
   - Fixture mode: `fixtures/ai/interviewPrep/default.json`.
2. `mapStories({ pack, cvText })` → `{ question; story; angle }[]` (2–3 items)
   - `fast` tier, structured output, no tools. Picks the top behavioural questions and the CV experiences that answer
     them best. The CV text is untrusted data (the same pattern as `UNTRUSTED_BULLETS_RULE`), and the model never invents
     experience. Fixture: `fixtures/ai/interviewPrep/stories.json`.

## Server action — `app/(app)/jobs/[id]/prep-actions.ts`

`getInterviewPrep(jobId)`:
1. Require the user. Load the job and its company, and check that the user has an application with status ≥ applied
   (`isPastSaved`). Otherwise return an error.
2. Look up the cache by `(company_id, role_key)`. On a fresh hit, skip to step 4.
3. On a miss, check the rate limit: count `interview_preps` rows with `created_by = user` and `created_at > now() - 1 day`.
   If the count is 10 or more, refuse. Cache hits do not count. Otherwise call `generatePrepPack` and upsert with the
   service-role client, setting `created_by` and `created_at = now()`. An overwritten row loses its old author, which
   is an accepted approximation.
4. Call `mapStories` with the user's active CV. If there is no CV, skip it and return an empty stories list.
5. Return `{ pack, sources, grounded, stories, createdAt }`.

Errors are mapped to the existing `AI_UNAVAILABLE` / `AI_BAD_FORMAT` messages.

## UI

- `app/(app)/jobs/[id]/interview-prep-panel.tsx` (client), with `id="prep"`, shown when the application is past Saved.
  - Idle: a short explanation and a "Prep for this interview" button.
  - Loading: a skeleton and the line "Reading what candidates reported…".
  - Result:
    - the process as a stage timeline
    - questions in category tabs, each with a "Reported" badge (with a source link) or a "Likely" badge
    - an expandable "why they ask" and prep tip for each question
    - a "Your stories" card
    - a sources list
    - an "inferred" banner when `grounded=false`, or when no sources came back
- Tracker: cards in the Interview column get a `Prep →` link to `/jobs/[id]#prep`.
- Follow the existing panel styling (`tailor-panel.tsx`, `explain-panel.tsx`). British English, no em-dashes in user copy.

## Testing

- Unit (vitest):
  - zod schema parse of the fixture
  - `role_key` builder
  - the source-integrity filter (an invented URL is dropped and that question becomes `reported=false`)
  - inferred mode sets every question to `reported=false`
- Server action:
  - cache hit vs miss (the miss calls the generator, the hit does not)
  - the status gate rejects a saved or absent application
- Live check (local, `vitest.live.config.ts` style): one real grounded call for a known employer, which asserts at
  least 1 source and at least 1 `reported` question. Never run against the prod demo persona.
- Manual: the panel in the local dev server for one applied job.

## Risks

- Grounded research takes about 35–45 s and the full first generation about 50 s. Server actions on Vercel Fluid
  default to a 300 s limit, so `export const maxDuration = 120` is set on the job page to make it explicit.
