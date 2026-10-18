# Playbook audit — shared brief (2026-10-18)

Product: Placed — an open-source, local-first career copilot for UK university students (first-years to finalists) targeting internships, spring weeks, placements and graduate roles in finance, consulting, tech, product, quant, data, marketing, research. Repo: ~/Repository/UCL_hackathon/placed (Next.js, SQLite). It scores CVs against rule sets, tailors CVs per job, scores LinkedIn, writes cover letters, recommends role-specific "playbook" actions, and computes job fit.

Prior research lives in docs/research/ (market-2026/, cv-rules-*.md, role-playbooks-*, tailor-playbooks-*, linkedin/, cover-letter/). Your job is NOT to summarise it. Your job is an adversarial, line-by-line audit: what is wrong, stale, unsupported, missing, contradictory, or badly implemented — and exactly how to fix or improve it.

## Method (mandatory)
1. Read your assigned playbook docs AND the code/data that actually ship them (the code is the truth of what users see). Note doc-vs-code drift.
2. Inventory every rule/claim/signal/action. For each one that matters, verify against credible sources found with WebSearch / WebFetch / firecrawl tools. Source hierarchy:
   - A: peer-reviewed studies, field experiments/audit studies, official employer careers pages & recruiter statements, regulators/government (ICO, EHRC, GOV.UK, UKVI), ISE / CIPD / HESA / Prospects-Luminate survey data.
   - B: large-sample industry data (LinkedIn Economic Graph, Indeed Hiring Lab, Greenhouse/Ashby/Workday/Gartner reports), university careers services (UCL, LSE, Imperial, Oxford, Cambridge, Warwick), established outlets (FT, eFinancialCareers, Bright Network, Gradcracker, Rate My Placement).
   - C: practitioner blogs, recruiter posts, Reddit/WSO/Blind — usable only as corroboration, labelled as such.
   - Vendor marketing (Jobscan, Resume Worded, Teal, etc.) is a claim to be checked, never evidence.
3. Check freshness: is it true for the 2026–27 recruiting cycle (UK)? Flag anything citing pre-2024 data where newer exists, dead URLs, changed application processes, firms that changed tests (e.g. HireVue/game-based/SHL changes), AI-screening policy changes.
4. Check cross-playbook consistency (e.g. CV rules vs tailor playbooks vs cover letter vs LinkedIn saying contradictory things).
5. Look for gaps: what top UK recruiters / careers services say matters that we don't cover at all; segments under-served (first-years, international students/visa, career switchers, non-Russell Group, neurodivergent, etc.); sectors missing.
6. Implementation critique: rule severity/weights, false positives/negatives the checker logic would produce, LLM-judge prompts that are ambiguous or non-binary, fairness/bias risks (UK Equality Act 2010, ICO guidance on automated decision-making), copy that overclaims.

Do not edit any code or existing files. Only write your report file. Do not run the app, the dev server, git commands that modify state, or any DB scripts.

## Report format — write to docs/research/audit-2026-10-18/<your-file>.md
- `# <Area> audit` + 5-line executive verdict (overall grade A–F and why).
- `## Scorecard` table: dimension | grade | one-line reason (evidence quality, freshness, coverage, implementation fidelity, consistency, UX/copy).
- `## Findings` — numbered, most severe first. Each finding:
  - **Severity**: P0 (wrong/harmful, fix now) / P1 (important) / P2 (improvement) / P3 (nice-to-have)
  - **Type**: wrong | stale | unsupported | missing | contradiction | implementation | copy | fairness
  - **Where**: exact `path:line` (doc and/or code), rule id if any
  - **Current**: quote what it says now (short)
  - **Evidence**: what the sources actually say, with grade A/B/C, full URL, publisher, date, and a ≤25-word quote
  - **Fix**: concrete replacement text / rule definition / code change (precise enough to implement without re-research)
- `## New rules / signals to add` — fully specified (id suggestion, text, severity, pass/fail anchors, sources).
- `## Rules to delete or downgrade` — with reasons.
- `## Open questions` — things you could not verify.
- `## Sources` — full list, graded.

Depth bar: this must not be a surface review. Aim for 25+ substantive findings where the material supports it, 30+ distinct credible sources, and verify claims at the source (open the page; don't trust snippets). If a claim can't be verified, say so explicitly rather than guess. Return to the orchestrator a ≤200-word summary: grade, top 5 findings, count of findings by severity, report path.
