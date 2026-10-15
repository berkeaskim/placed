# Board decisions (founder-approved only)

## 2026-10-13 — New features
- ✅ **Target Role mode** (founder proposal). The student picks one of 8 archetypes. The screen shows:
  - market demand (aggregate must-have skills across live jobs of that archetype);
  - a readiness % (computeCoverage);
  - the sector CV Score;
  - two boxes: "you have it but it isn't visible" (rewrite, checked by verifyTailoring) and "you don't have it yet" (a Role Playbook action).
- ✅ **Role Playbook per archetype**: employer signals (cited, linked to CV rules), projects, free courses, experiences, tagged by year of study. XP only when the student confirms evidence; a skill enters the CV only after confirmation.
- ✅ **Placement:** a "Target Role" tab on the profile page. Role choice is limited to the archetype list (no free text).
- ✅ Core tasks 15–25 stay the priority. Get an API key ASAP.
- ✅ Inside existing tasks: a visa badge only where the JD states it, otherwise an honest "Not stated"; an .ics link on job detail.
- 🗒️ Roadmap slide only: Placed Card, university careers dashboard, cover letter via verifier, interview prep.
- [DO_NOT_RESURFACE] A rule-based sponsorship detector meant to "fix 182 unknowns": the data doesn't support it.

## 2026-10-14 — Crown feature
- ✅ **Placed Autopilot** (founder proposal, approved). Reads each job's application form through APIs: Greenhouse `?questions=true`, Ashby non-user GraphQL `applicationForm`, Lever apply page. It fills fields from a one-time **Answer Vault**: "asked once, never again". It drafts free-text answers ("Why X?") only from CV lines and confirmed facts, through `verifyTailoring`, with a per-sentence source and the word limit. A **Chrome extension** (MV3) fills the real employer page, uploads the tailored CV and **stops at Submit**; the student presses Submit. Batch mode: pick N jobs, review each pack.
  - Red lines: never auto-submit; never answer EEO/diversity/demographic questions; Right to Work only from the student's own saved answer; no gate pass → no text in the form.
  - Evidence: live fetch of 111/152 Greenhouse forms gave a mean of 17.2 questions (max 46); 39/111 have a free-text question (Monzo, Anthropic, Figma "Why us?"). The API cannot submit (Greenhouse POST → 401 without the employer key), so the fill must happen in the browser.
  - Build: own worktree, no new migration (Vault goes in an existing JSON column, or claim 0011+ first), fixture mode, demo on the Monzo intern form.
  - Pitch line: "Autopilot fills the boring 90%. You write the part that matters, and press Submit."
- [DO_NOT_RESURFACE] Board proposals the founder rejected as not differentiating: Skill Unlock Radar, "This Week" board, ChatGPT Lie Check, Story Bank as the hero.
- 🗒️ Roadmap: an LLM agent mode for non-API forms (Workday) that maps fields from DOM labels.
- ⚠️ Still open (COO): `main` is 91 commits behind, there's a 0010 collision (playbook_progress vs smartrecruiters), and prod migrations are likely unapplied. Merge and deploy must finish before the demo.
