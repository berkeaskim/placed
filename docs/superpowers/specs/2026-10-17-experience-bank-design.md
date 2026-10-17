# Experience Bank: design

Date: 2026-10-17 · Branch: `feat/experience-bank` (worktree `worktrees/experience-bank`)

## 1. Why

Students often have more experience than fits on one page. To make it fit, they delete the "less important" items for good. But which items matter depends on the role: a hackathon project that is noise for a consulting role can be the strongest line for a quant role. Today Placed tailors from **one** active CV (`cvs.is_active`). The verify gate checks every claim against that CV, so tailoring can only rephrase and reorder what is already there. It can never bring back something the student cut.

Berke keeps his experience in two places that hold different things:
- **CV(s):** structured roles with bullets.
- **LinkedIn:** the experience section, plus **posts**. The posts tell stories ("we built X, won Y") that often never made it onto the CV.

The Experience Bank is one place that holds **everything**, collected from CVs, LinkedIn and manual entry. For each application, Placed **selects** the best one-page subset from the bank, then tailors it as it does today, and shows the student what it added and what it left out, and why.

Berke's own words for the failure that matters most: a CV that does not **fully reflect his potential and experience**. So underselling is the main risk, more than overstuffing.

## 2. Goals, non-goals, anti-goals

**Goals**
- One bank per student. Every experience, project and leadership entry, with all its bullets, and nothing is ever lost.
- Fill the bank from four sources:
  - the active CV (automatic);
  - other CV PDFs;
  - LinkedIn (existing extension capture, or the "Save to PDF" export);
  - pasted LinkedIn posts.
  - Manual add and edit are also available.
- Duplicates found across sources are offered as merges, and the student confirms each one once.
- Per job, a deterministic **selection step** picks entries and bullets from the bank to fill exactly one A4 page. It ranks by job fit **and** strength. Tailoring then runs on that selection.
- The tailor screen shows "Added from your bank" and "Left out for this role", each with a reason. A left-out item can be swapped back in with one click.

**Non-goals (v1)**
- Reading posts automatically (from the extension activity page or the LinkedIn data-archive zip). v1 uses paste only.
- Cover letter, Autopilot and interview prep reading from the bank. They keep using the active CV; that comes later.
- AI-assisted duplicate matching. v1 matching is deterministic.
- Banking education, skills, summary or contact details. These still come from the active CV.
- Two-page CVs. **Decided by Berke:** a tailored CV is always one A4 page, for every sector. This applies to every student, including those whose bank holds only their (possibly 2-page) active CV: their tailored CV is now trimmed to one page by the selection step. The bank-side CV score rules (G-11 etc.) are unchanged.

**Anti-goals (failure even if it "works")**
- **Underselling:** a half-empty page, or a strong quantified bullet dropped in favour of a weak keyword match.
- **Fabrication:** any claim in the output that is not traceable to a bank row. A post-derived bullet entering the bank without the student's explicit accept.
- **Overflow:** the rendered PDF goes past one page.
- **Silent change:** the active CV, or what scoring and Autopilot use, changes because of something done in the bank.
- **Regression:** a student who never opens the bank sees any change in tailoring other than the one-page rule below.

## 3. Data model (SQLite / Drizzle, new migration)

```
bank_entries
  id uuid pk, user_id, section ('experience'|'projects'|'leadership'),
  org, title, dates (as printed), start_ym text null ('2025-06'), end_ym text null (null = present),
  location, pinned bool default 0, hidden bool default 0,
  source_ids json string[]  -- bank_sources that contributed
  created_at, updated_at
  index (user_id, section)

bank_bullets
  id uuid pk, entry_id fk → bank_entries (cascade), user_id,
  text, position int, pinned bool default 0, hidden bool default 0,
  source_ids json string[]   -- every source this bullet was seen in (a deduped re-import appends, never adds a row)
  source_text text null      -- provenance: exact original line (or post excerpt) of the first source
  created_at, updated_at
  index (entry_id), index (user_id)

bank_sources
  id uuid pk, user_id,
  kind ('cv'|'linkedin_capture'|'linkedin_export'|'linkedin_post'|'manual'),
  ref text null  -- cv id, profile url, or null
  raw_text text  -- what was imported (post text, CV raw text), kept for the verify gate
  imported_at
  unique (user_id, kind, ref) where ref not null  -- re-importing the same CV/profile updates, never duplicates

bank_suggestions
  id uuid pk, user_id, source_id fk → bank_sources (cascade),
  kind ('new_entry'|'merge_into'|'new_bullet'),
  target_entry_id text null, payload json, status ('pending'|'accepted'|'rejected'),
  created_at, resolved_at
  index (user_id, status)
```

Bank ids are **stable and distinct from ParsedCV ids**, and the selection step emits them as ParsedCV ids (see §5). Rejected suggestions are kept, so a re-import does not offer them again.

## 4. Filling and merging

**New active CV.** Uploading a new active CV does not touch the upload flow. On the next bank read (bank page or tailor), if the active CV's id has no `bank_sources` row, it is imported through the suggestion flow and the tailor panel shows "Your new CV added N suggestions to your bank".

**Bootstrap.** When a student has an active CV and an empty bank, the bank is seeded from `cvs.parsed_json` the first time the bank is read (bank page, or tailor). These rows are auto-accepted: it is the student's own CV. Uploading a new active CV later goes through the suggestion flow below. The bank is never wiped.

**Import flow (every other source):**
1. Parse the source into candidate entries and bullets. Reuse what exists:
   - CV PDF: `lib/cv/pdf-text` + `lib/ai/parseCV.ts` (AI parse with the `heuristicParseCv` fallback, 60s deadline; with AI off it is heuristic-only). Uploading here does **not** change the active CV.
   - LinkedIn, extension: v1 reads the latest stored `linkedin_scores.profile_json` (a `ParsedLinkedIn` saved by the existing capture → score flow). No new capture endpoint; if none exists, the button says "Capture your profile with the extension first" and links to the LinkedIn score page.
   - LinkedIn, Save-to-PDF: `lib/linkedin/parse-export.ts`.
   - `ParsedLinkedIn` only has `experience`: items titled `Project: X` (how the capture parser folds projects in) go to `projects` with the prefix stripped; everything else goes to `experience`. Volunteer/leadership from LinkedIn is out of v1. `description` text is split into bullets on line breaks and bullet characters.
2. Match each candidate entry against the bank, deterministically:
   - normalised org (lowercase, strip Ltd/LLP/Inc/punctuation) equal or contained, **and**
   - title token overlap ≥ 0.5 **or** date ranges overlap.
3. For each bullet of a matched entry: if it is a near-duplicate of an existing bullet (normalised-token Jaccard ≥ 0.7), skip it silently (count only). Otherwise make a `new_bullet` suggestion.
4. Unmatched entries become `new_entry` suggestions. A candidate that matches two bank entries becomes a `merge_into` suggestion, with the student choosing the target.
5. The student reviews the pending suggestions in a single list: accept, reject, or edit and accept. "Accept all from this source" is allowed for CV and LinkedIn sources, never for posts.

**Posts (AI).** The student pastes one or more post texts. The AI extracts candidate bullets, each one:
- written in CV voice;
- attributed to an existing bank entry, or to a proposed new project entry;
- carrying only facts and numbers present in the post. The existing verify checks are run against the post text, and any candidate that fails is dropped.

These are always `pending` suggestions, shown next to the post excerpt they came from, and they are never bulk-accepted. With AI off, post import is disabled behind the standard banner (never fixture text). CV and LinkedIn import work without AI.

**Editing.** On the bank page the student can edit entry and bullet text, reorder bullets, **pin** (always include) or **hide** (never include) entries and bullets, and add entries and bullets manually (source `manual`). Edited text is the student's own claim: its provenance becomes `manual` and the original `source_text` is kept for reference.

## 5. Selection step (per job)

`lib/bank/select.ts` is a pure, deterministic function with no AI, so it works with AI off and is unit-testable:

```
selectForJob(bank, activeCv, job, { pinnedForJob, excludedForJob }) →
  { base: ParsedCV, report: { added: Item[], leftOut: Item[] } }
```

- `base` is a ParsedCV:
  - `experience`, `projects` and `leadership` are built from the chosen bank rows, keeping the **bank ids** as entry and bullet ids;
  - everything else (contact, education, skills, summary, interests, sectionOrder) is copied from the active CV.
- **Bullet score** = job fit + strength + recency:
  - job fit: the bullet's coverage of the job's must and nice requirements, using `lib/scoring/coverage` / `jdRequirementSkills`; must-haves weigh more;
  - strength: has a number or outcome, starts with an action verb, penalised for clichés (`lib/cv/cliches`);
  - recency: a small bonus for newer entries.
  
  Strength must be able to keep a strong, off-topic bullet over a weak, on-topic one. This is the guard against underselling.
- **Entry score** = the sum of its top 3 bullet scores.
- **Greedy fill** under a line budget for one A4 page in `cv-document`:
  1. Pinned items go in first; hidden items are never used.
  2. Each included entry gets at least 2 bullets (or all of them, if it has fewer).
  3. Then entries and bullets are added in score order until the budget is used up.
  4. Entries render in date order within each section, not in score order.
- "In the active CV" means the row's `source_ids` contains the active CV's `bank_sources` id (bullets: bullet-level `source_ids`; entries: entry-level). A bullet the student edited keeps its `source_ids`, so it still counts as "in the CV".
- `report.added`: bank items in `base` that are not in the active CV. `report.leftOut`: active-CV items, and the top-scoring other bank items, that did not make it. Each item's reason is templated from its score parts, for example "covers 'SQL', 'stakeholder management' (must-haves)" or "kept for a quantified result", and is not AI-written.
- **Page guarantee, two places:**
  - *At selection:* the line budget is an estimate, so `base` is rendered and its pages counted. Over the limit: drop the lowest-scoring unpinned bullet and re-render, up to 5 times. Under about 85% full with unused bank bullets left: add the next one and retry once. Selection scores are stored with `base`.
  - *At save:* the student's edits may push it over. Nothing they approved is dropped silently: save is refused with "This is 1.1 pages — remove one of these" and the 3 lowest-scoring bullets offered as one-click removals. A PDF over the limit is never saved.

**Integration with tailoring:**
1. `selectForJob` produces `base`.
2. The existing pipeline (`lib/tailor/run.ts`) runs **unchanged** with `cv = base`. The `rawText` passed to the gate is the active CV's `raw_text` plus the text and `source_text` of every bank row in `base`, so nothing that passes today starts blocking, and bank claims are grounded too.
3. `base` and `report` are stored in `applications.tailored_json` next to the outcome. `previewTailoring`, `saveTailoredVersion`, `finalizeTailoredCv` and `confirmNumber` read the stored `base` instead of `getActiveCv().parsed`. Old rows without `base` fall back to the active CV.
4. **One-click swap** ("Add this back" on a left-out item) re-runs selection with that item in `pinnedForJob`. It makes **no AI call**: the tailored bullets of items still in `base` are kept, and the new item goes in with its bank text unchanged (shown as "added, not tailored — Tailor again to polish"). "Remove" works the same way via `excludedForJob`. These per-job overrides are stored with the application, not on the bank row.
5. **Bank changed after tailoring:** the stored `base` stays frozen (it is what the student reviewed). If a bank row in it was edited or hidden since, the panel shows "Your bank changed since this was tailored" with a Re-select button. Nothing re-runs by itself.
6. **Bank holds only the active CV:** selection still runs (one-page rule). If the active CV already fits one page, every entry and bullet is kept and only the order and ids change; the report is empty. This is the test for the no-regression path: tailoring output for such a CV must match today's, apart from ids.

**UI on the tailor panel:** a "From your bank" block above the existing change list:
- **Added:** each item with its reason, and Remove.
- **Left out for this role:** collapsed, top 5 shown, each with its reason and Add back.

The existing before/after change cards are unchanged.

## 6. Bank page

The bank page lives under Profile (`/profile/bank`) and has three parts:
- **Entries:** entries grouped by section, each showing its bullets, a source badge (CV / LinkedIn / Post / Manual) and pin/hide toggles.
- **Pending suggestions:** a counter that opens the review list.
- **Import:** upload a CV PDF, import from LinkedIn (extension capture or PDF export), or paste posts.

Empty state: "We filled this from your CV. Add more from LinkedIn or your old CVs."

## 7. v1 scope

**In**
- Migration and the four tables; bootstrap from the active CV.
- Bank page: list, edit, reorder, pin, hide, manual add.
- Imports: CV PDF, LinkedIn extension capture, LinkedIn Save-to-PDF export, and pasted posts (AI).
- Suggestion review with deterministic matching and dedupe.
- `selectForJob` with tests, the tailor integration, stored `base`, Add back and Remove, and the page guarantee.

**Later**
- Automatic post reading (extension Activity page, or `Shares.csv` from the LinkedIn archive).
- Bank-backed cover letter, Autopilot answers and interview prep stories.
- AI-assisted matching for hard duplicates.
- Banked education and skills.

## 8. Calls made without Berke (check these)

- Selection is deterministic, with templated reasons and no AI. This makes it cheap, testable, and usable with AI off.
- Posts arrive by paste only in v1.
- Education, skills and summary stay on the active CV.
- Per-job Add back and Remove do not change the bank's global pin and hide.
- The bank is seeded automatically from the active CV, with no confirmation step.
- Extension import reuses the last stored LinkedIn capture; LinkedIn feeds only experience and projects.
- At save, overflow is refused with removal suggestions instead of auto-dropping approved bullets.
- Swaps don't call the AI; the gate's grounding text keeps the active CV's raw text.
- A new active CV is picked up lazily on the next bank read, not in the upload flow.

## 9. Left to the builder

Exact score weights and the line-budget constants (tune them on fixtures). Thresholds for org normalisation and Jaccard. Component layout and copy. Whether the page count comes from react-pdf's render result or from re-parsing the PDF.
