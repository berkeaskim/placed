# Inside Track — real people to reach after you apply

Date: 2026-10-16 · Status: approved by Berke (design), spec pending review
Board: 2026-10-16 C-suite (CEO, CPO, CTO, CMO, CISO + critic), founder override recorded below.

## 1. Goal

When a student has applied to a role (status `applied` or later), the job page shows **Inside Track**: up to 5 real
people at that company they could message on LinkedIn: UCL alumni, someone in the team, an early-careers recruiter.
Each person comes with their LinkedIn profile link, why to contact them, and a sample message written from the
student's own CV. The purpose is to raise the odds of the application through a warm human touch.

Success: on a live job at a company with public LinkedIn presence, the panel shows ≥1 real, correctly named person
with a working profile link and a guard-checked sample message within ~10 s; on a company with no results it shows
the existing LinkedIn search links instead of an empty panel.

## 2. Decisions and their evidence

- **Names are required** (founder, 2026-10-16: "linkedin'i gösterecek, bir de sample mesaj"). The board's
  "role/seat only" recommendation is overridden.
- **Source: Serper.dev Google search** (`site:linkedin.com/in …`). Tested 2026-10-16: a plain web search for
  `site:linkedin.com/in Monzo "talent acquisition"` returned 2 real profiles out of 9 results. Gemini + Google Search
  grounding refused to return LinkedIn profiles, so it is not used. Firecrawl is out of credits.
- **JD-extracted hiring-manager titles are not used.** Measured 2026-10-16 on 93 early-careers Greenhouse JDs
  (Monzo, GoCardless, Cloudflare, Figma, Anthropic, Stripe, Wise): 0 genuine "reports to <title>" lines.
- **No LLM touches names.** Names and headlines are substrings of the search-result title. The LLM only writes the
  message, and only after the person has been found.
- **No scraping of LinkedIn.** Placed never fetches linkedin.com. It reads search-engine results only.
- **No new migration.** Search results are not stored in the database.

## 3. User experience

Placement: `app/(app)/jobs/[id]/page.tsx`. If `isPastSaved(status)` → render `<InsideTrackPanel>` in place of
`<PeoplePanel>`; otherwise `<PeoplePanel>` stays as it is today. The tracker card gets an "Inside Track →" link to
`/jobs/<id>#inside-track` for applications past `saved`.

Panel contents, top to bottom:
1. Header "Inside Track" + one line: "Real people at <Company> you could message. A warm note can get your application read."
2. Order hint: "Start with alumni, then the team, then the recruiter", with the existing `why` text per group.
3. Up to 5 person cards, grouped `alumni` (max 2) → `team` (max 2) → `recruiter` (max 1). Each card:
   - name (bold) and headline
   - **Open LinkedIn ↗** (`target=_blank rel="noopener noreferrer"`)
   - the group's `why` line
   - sample connection note (≤300 chars, counter shown) and a **Copy** button
   - **Mark as sent**, which calls the existing `setOutreachStatus`
   - small label: "Found via public web search. Check they still work at <Company>."
4. For any group with 0 people: the existing LinkedIn people-search link card for that group ("We couldn't find
   anyone public. Search on LinkedIn ↗").
5. Footer: "Placed never sends anything. You copy, edit and send it yourself."

Messages: when the panel first loads, every person without a stored draft gets one, generated in parallel from the
client (one `draftInsideTrack` action per person; spinner per card). A stored draft is an `outreach` row with the
same `user_id`, `job_id`, `target` and `recipient_name`. It is reused on later visits, so each person costs one LLM
call per student per job, ever. A "Rewrite" button forces a new draft.

## 4. Components

### 4.1 `lib/inside-track/parse.ts` (pure)

`parseResult({ title, link, snippet }, company): Person | null`, where
`Person = { name: string; headline: string; url: string }`.

Accept only when **all** hold:
- `link` matches `^https://([a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?$` (no `/pub/`, `/posts/`, `/company/`,
  query or fragment). `url` is normalised to `https://www.linkedin.com/in/<slug>`.
- `title` with the trailing ` | LinkedIn` (and any ` - LinkedIn`) removed, split on ` - ` / ` – ` / ` — `, gives
  ≥1 part. `name = parts[0]`; `headline = parts.slice(1).join(" · ")` (may be empty).
- `name` is 2–4 words, letters only (Unicode letters, apostrophe, hyphen, dot), has no digits, and is not equal to the
  company name. A trailing `…` truncation or an emoji in the name rejects the result.
- The company name (case-insensitive, also with a trailing "Bank"/"Ltd"/"Group" stripped) appears in `title` or
  `snippet`.

### 4.2 `lib/inside-track/find.ts`

`findPeople(company, jobTitle): Promise<{ groups: Record<"alumni"|"team"|"recruiter", Person[]>; searched: boolean }>`

- Queries per group (company quoted, `divisionKeyword` from `lib/outreach/targets.ts`):
  - alumni: `site:linkedin.com/in "<company>" ("University College London" OR UCL)`
  - team: `site:linkedin.com/in "<company>" <division>`; skipped (empty group) when `divisionKeyword` is null
  - recruiter: `site:linkedin.com/in "<company>" ("early careers" OR "talent acquisition" OR "graduate recruitment" OR recruiter)`
- Serper: `POST https://google.serper.dev/search`, header `X-API-KEY: SERPER_API_KEY`, body
  `{ q, gl: "uk", hl: "en", num: 10 }`, 8 s timeout. Read `organic[].{title, link, snippet}`.
- Results go through `parseResult`, are de-duplicated by URL across groups (first group wins), and are capped
  2 / 2 / 1.
- Each group query is wrapped in `unstable_cache` keyed `["inside-track", v1, group, company, division]`,
  `revalidate: 604800` (7 days). Errors throw out of the cached function, so they are not cached; `findPeople`
  catches per group and returns an empty group.
- No `SERPER_API_KEY`, or `AI_MODE=fixture` → read `fixtures/inside-track/<company-slug>.json` if present, else
  return all groups empty with `searched: false`.

### 4.3 Drafting (no new code)

Reuses `draftOutreach` unchanged with `purpose: "intro"`, `target` = the group, and `recipientName` = first word of
the name (the existing `cleanDraftInput` limits apply). The guard already blocks claims about the recipient, so
nothing from their headline is passed to the model.

### 4.4 Server actions — `app/(app)/jobs/[id]/inside-track-actions.ts`

- `loadInsideTrack(jobId)`: auth, check the application is past `saved`, load the job + company, call
  `findPeople`, load the user's existing `outreach` rows for the job, and return the people with any stored
  draft text and outreach id.
- `draftInsideTrack(jobId, { target, recipientName })`: delegates to the existing `draftOutreachAction` path
  (same CV / facts loading, insert into `outreach`). Rate limit: max 8 drafts per user per job per day, counted
  from `outreach` rows.

### 4.5 UI — `components/inside-track/inside-track-panel.tsx` (client) + server wrapper

Server component calls `loadInsideTrack` and renders the client panel with the initial data; the client fires
drafts for cards without one. Uses the existing card and chip styles (`rounded-[20px] border bg-white p-5`).

## 5. Privacy and safety

- Search results live only in the Next data cache (7 days), never in Postgres. A person's name lands in the database
  only as `outreach.recipient_name` when a draft is made for that student; it is RLS-scoped and removed by
  delete-my-data (existing behaviour).
- `SERPER_API_KEY` is server-only (no `NEXT_PUBLIC_`). Titles, headlines and snippets are rendered as text, never as
  HTML. Profile links are rebuilt from the slug, not echoed.
- Placed never sends anything and never fetches linkedin.com.
- Cost: ≤3 Serper queries per company+division per 7 days, shared across all users.

## 6. Error handling

| Case | Behaviour |
|---|---|
| No key / fixture mode without fixture | All groups show the LinkedIn search fallback; no error banner |
| Serper 4xx/5xx/timeout for a group | That group shows the fallback; others render |
| 0 accepted results | Fallback card for that group |
| No CV | Cards render; message box says "Upload your CV to get a sample message" |
| Draft AI error | Card shows "Couldn't write a message right now" + Retry |
| Guard removed lines | Existing "We removed a line we couldn't back up" note |

## 7. Testing

- `tests/inside-track/parse.test.ts`: hyphen / en-dash / em-dash titles; `uk.linkedin.com`; `/pub/`, `/posts/`,
  `/company/` and query-string links rejected; truncated `…` names rejected; company mismatch rejected; name equal to
  the company rejected; slug normalisation.
- `tests/inside-track/find.test.ts`: mocked `fetch` → caps, cross-group de-duplication, a group error doesn't
  break the others, no key → `searched: false`, no division → team skipped.
- Action test: an application at `saved` → refused; stored draft reused instead of a new LLM call.
- Fixture `fixtures/inside-track/<demo company>.json` for the demo persona and e2e.
- Live check on a preview deployment with a real company; the prod live-demo persona is not used for testing.

## 8. Out of scope (roadmap)

Extension "find more" from the student's own LinkedIn search page; interview-stage prep plan from JD process text;
a dated multi-step follow-up schedule; paid enrichment (Apollo/Clay) after a DPIA.

## 9. Setup

Berke: create a Serper.dev key, add `SERPER_API_KEY` to `.env.local` and to Vercel (Preview + Production).
